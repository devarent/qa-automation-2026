'use strict';

const crypto = require('node:crypto');
const path = require('node:path');
const express = require('express');
const repository = require('./repository');
const { ApiError, errors } = require('./errors');
const { amountToCents, centsToAmount, formatMoney, parseMoney } = require('./money');

const PUBLIC_DIR = path.join(__dirname, 'public');
const SUPPORTED_CURRENCIES = new Set(['USD', 'EUR', 'GBP']);
const ACCOUNT_TYPES = new Set(['CHECKING', 'SAVINGS']);

function createSerialQueue() {
  let tail = Promise.resolve();

  return function runExclusive(operation) {
    const result = tail.then(operation, operation);
    tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
}

function asyncRoute(handler) {
  return function wrapped(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function requestContext(req, res, next) {
  const incoming = req.get('x-request-id');
  const validIncoming =
    typeof incoming === 'string' && /^[A-Za-z0-9._:-]{1,100}$/.test(incoming);

  req.id = validIncoming ? incoming : crypto.randomUUID();
  res.set('X-Request-Id', req.id);
  next();
}

function securityHeaders(req, res, next) {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'no-referrer');
  res.set(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'",
  );
  next();
}

function serializeAccount(row) {
  return {
    id: row.id,
    accountNumber: row.account_number,
    customer: {
      id: row.customer_id,
      fullName: row.full_name,
      email: row.email,
    },
    accountType: row.account_type,
    currency: String(row.currency).trim(),
    balance: formatMoney(row.balance),
    openingBalance: formatMoney(row.opening_balance),
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function serializeTransfer(row) {
  return {
    id: row.id,
    idempotencyKey: row.idempotency_key,
    fromAccountId: row.from_account_id,
    toAccountId: row.to_account_id,
    amount: formatMoney(row.amount),
    currency: String(row.currency).trim(),
    status: row.status,
    fromAccount: {
      id: row.from_account_id,
      accountNumber: row.from_account_number,
    },
    toAccount: {
      id: row.to_account_id,
      accountNumber: row.to_account_number,
    },
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function serializeTransaction(row) {
  return {
    id: row.id,
    transferId: row.transfer_id,
    accountId: row.account_id,
    type: row.entry_type,
    amount: formatMoney(row.amount),
    currency: String(row.currency).trim(),
    counterpartyAccountId: row.counterparty_account_id,
    counterpartyAccountNumber: row.counterparty_account_number,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function parseAccountId(value) {
  if (typeof value === 'string' && !/^\d+$/.test(value.trim())) {
    return null;
  }

  const number = Number(value);
  return Number.isInteger(number) && number > 0 && number <= 2_147_483_647 ? number : null;
}

function requireObject(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw errors.validation('Request body must be a JSON object.');
  }
  return body;
}

function validateCurrency(input) {
  if (typeof input !== 'string' || !/^[A-Za-z]{3}$/.test(input.trim())) {
    throw errors.validation('currency must be a three-letter ISO currency code.', {
      field: 'currency',
    });
  }

  const currency = input.trim().toUpperCase();
  if (!SUPPORTED_CURRENCIES.has(currency)) {
    throw errors.unsupportedCurrency(currency);
  }
  return currency;
}

function validateIdempotencyKey(input) {
  if (typeof input !== 'string') {
    throw errors.validation('idempotencyKey is required and must be a string.', {
      field: 'idempotencyKey',
    });
  }

  const key = input.trim();
  if (key.length < 1 || key.length > 80 || /[\u0000-\u001f\u007f]/.test(key)) {
    throw errors.validation(
      'idempotencyKey must contain between 1 and 80 printable characters.',
      { field: 'idempotencyKey' },
    );
  }
  return key;
}

function validateTransferBody(body) {
  requireObject(body);

  const fromAccountId = parseAccountId(body.fromAccountId);
  if (!fromAccountId) {
    throw errors.validation('fromAccountId must be a positive integer.', {
      field: 'fromAccountId',
    });
  }

  const toAccountId = parseAccountId(body.toAccountId);
  if (!toAccountId) {
    throw errors.validation('toAccountId must be a positive integer.', {
      field: 'toAccountId',
    });
  }

  const amountCents = parseMoney(body.amount);
  if (amountCents === null) {
    throw errors.validation(
      'amount must be greater than 0, have at most 2 fraction digits, and not exceed 1,000,000.00.',
      { field: 'amount' },
    );
  }

  const currency = validateCurrency(body.currency);
  const idempotencyKey = validateIdempotencyKey(body.idempotencyKey);

  if (fromAccountId === toAccountId) {
    throw errors.sameAccount();
  }

  return {
    fromAccountId,
    toAccountId,
    amountCents,
    amount: centsToAmount(amountCents),
    currency,
    idempotencyKey,
  };
}

function validateAccountBody(body) {
  requireObject(body);

  if (
    typeof body.customerName !== 'string' ||
    body.customerName.trim().length < 2 ||
    body.customerName.trim().length > 120
  ) {
    throw errors.validation('customerName must be between 2 and 120 characters.', {
      field: 'customerName',
    });
  }

  const email =
    typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw errors.validation('email must be a valid email address.', { field: 'email' });
  }

  const currency = validateCurrency(body.currency);

  const openingBalanceCents = parseMoney(body.openingBalance, { allowZero: true });
  if (openingBalanceCents === null) {
    throw errors.validation(
      'openingBalance must be between 0 and 1,000,000.00 with at most 2 fraction digits.',
      { field: 'openingBalance' },
    );
  }

  const accountType =
    body.accountType === undefined ? 'CHECKING' : String(body.accountType).toUpperCase();
  if (!ACCOUNT_TYPES.has(accountType)) {
    throw errors.validation('accountType must be CHECKING or SAVINGS.', {
      field: 'accountType',
    });
  }

  return {
    customerName: body.customerName.trim(),
    email,
    currency,
    openingBalance: centsToAmount(openingBalanceCents),
    accountType,
  };
}

function transferPayloadMatches(row, input) {
  return (
    row.from_account_id === input.fromAccountId &&
    row.to_account_id === input.toAccountId &&
    formatMoney(row.amount) === input.amount &&
    String(row.currency).trim() === input.currency
  );
}

function createApp({ pool, db }) {
  if (!pool || !db) {
    throw new Error('createApp requires a pg pool and a pg-mem database instance.');
  }

  const app = express();
  const runExclusive = createSerialQueue();

  app.disable('x-powered-by');
  app.use(requestContext);
  app.use(securityHeaders);
  app.use(express.json({ limit: '32kb' }));

  const healthHandler = asyncRoute(async (req, res) => {
    await pool.query('SELECT 1 AS ok');
    res.json({
      status: 'ok',
      service: 'banking-qa-lab',
      version: '1.0.0',
      database: 'up',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    });
  });

  // Both paths are supported: /health for probes, /api/health for API clients.
  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);

  app.get(
    '/api/accounts',
    asyncRoute(async (req, res) => {
      const rows = await runExclusive(() => repository.listAccounts(pool));
      res.json({ data: rows.map(serializeAccount) });
    }),
  );

  app.post(
    '/api/accounts',
    asyncRoute(async (req, res) => {
      const input = validateAccountBody(req.body);
      const row = await runExclusive(() => repository.createAccount(pool, db, input));
      res
        .status(201)
        .location(`/api/accounts/${row.id}`)
        .json({ data: serializeAccount(row) });
    }),
  );

  app.get(
    '/api/accounts/:id',
    asyncRoute(async (req, res) => {
      const accountId = parseAccountId(req.params.id);
      if (!accountId) {
        throw errors.validation('Account id must be a positive integer.', {
          field: 'id',
        });
      }

      const row = await runExclusive(() => repository.getAccount(pool, accountId));
      if (!row) {
        throw errors.accountNotFound(accountId, 'id');
      }
      res.json({ data: serializeAccount(row) });
    }),
  );

  app.get(
    '/api/accounts/:id/transactions',
    asyncRoute(async (req, res) => {
      const accountId = parseAccountId(req.params.id);
      if (!accountId) {
        throw errors.validation('Account id must be a positive integer.', {
          field: 'id',
        });
      }

      const result = await runExclusive(async () => {
        const account = await repository.getAccount(pool, accountId);
        if (!account) {
          throw errors.accountNotFound(accountId, 'id');
        }
        const rows = await repository.listTransactions(pool, accountId);
        return { account, rows };
      });

      res.json({
        data: result.rows.map(serializeTransaction),
        meta: {
          accountId,
          accountNumber: result.account.account_number,
          count: result.rows.length,
        },
      });
    }),
  );

  app.post(
    '/api/transfers',
    asyncRoute(async (req, res) => {
      const input = validateTransferBody(req.body);

      const result = await runExclusive(async () => {
        const existing = await repository.findTransferByIdempotencyKey(
          pool,
          input.idempotencyKey,
        );

        if (existing) {
          if (!transferPayloadMatches(existing, input)) {
            throw errors.idempotencyConflict(input.idempotencyKey);
          }
          return { transfer: existing, replay: true };
        }

        const from = await repository.getAccount(pool, input.fromAccountId);
        if (!from) {
          throw errors.accountNotFound(input.fromAccountId, 'fromAccountId');
        }

        const to = await repository.getAccount(pool, input.toAccountId);
        if (!to) {
          throw errors.accountNotFound(input.toAccountId, 'toAccountId');
        }

        if (from.status !== 'ACTIVE') {
          throw errors.accountNotActive(from.id, from.status);
        }
        if (to.status !== 'ACTIVE') {
          throw errors.accountNotActive(to.id, to.status);
        }

        const fromCurrency = String(from.currency).trim();
        const toCurrency = String(to.currency).trim();
        if (fromCurrency !== input.currency || toCurrency !== input.currency) {
          throw errors.currencyMismatch({
            currency: input.currency,
            fromCurrency,
            toCurrency,
          });
        }

        if (amountToCents(from.balance) < input.amountCents) {
          throw errors.insufficientFunds(
            from.id,
            formatMoney(from.balance),
            input.amount,
          );
        }

        const transfer = await repository.createTransfer(pool, db, input);
        return { transfer, replay: false };
      });

      if (result.replay) {
        res.set('Idempotent-Replayed', 'true');
      }
      res
        .status(result.replay ? 200 : 201)
        .location(`/api/transfers/${result.transfer.id}`)
        .json({ data: serializeTransfer(result.transfer) });
    }),
  );

  app.get(
    '/api/transfers/:id',
    asyncRoute(async (req, res) => {
      const transferId = req.params.id;
      if (!transferId || transferId.length > 64) {
        throw errors.validation('Transfer id is invalid.', { field: 'id' });
      }

      const row = await runExclusive(() =>
        repository.findTransferById(pool, transferId),
      );
      if (!row) {
        throw errors.transferNotFound(transferId);
      }
      res.json({ data: serializeTransfer(row) });
    }),
  );

  app.get(
    '/api/transactions',
    asyncRoute(async (req, res) => {
      const rows = await runExclusive(() => repository.listAllTransactions(pool));
      res.json({
        data: rows.map(serializeTransaction),
        meta: { count: rows.length },
      });
    }),
  );

  app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

  app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
      res.status(404).json({
        error: {
          code: 'ROUTE_NOT_FOUND',
          message: `Route ${req.method} ${req.path} was not found.`,
          requestId: req.id,
        },
      });
      return;
    }
    res.status(404).type('text/plain').send('Not found');
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }

    if (error && error.type === 'entity.parse.failed') {
      const apiError = errors.validation('Request body must be valid JSON.');
      return res.status(apiError.status).json(apiError.toEnvelope(req.id));
    }

    if (error && error.type === 'entity.too.large') {
      return res.status(413).json({
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'Request body must not exceed 32 KB.',
          requestId: req.id,
        },
      });
    }

    if (error instanceof ApiError) {
      return res.status(error.status).json(error.toEnvelope(req.id));
    }

    if (process.env.NODE_ENV !== 'test') {
      console.error(`[${req.id}] Unhandled error`, error);
    }

    const apiError = errors.internal();
    return res.status(apiError.status).json(apiError.toEnvelope(req.id));
  });

  return app;
}

module.exports = {
  createApp,
  serializeAccount,
  serializeTransfer,
  serializeTransaction,
};
