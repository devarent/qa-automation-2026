'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const YAML = require('yaml');
const Ajv2020 = require('ajv/dist/2020');
const { test, expect } = require('../fixtures/banking-app');
const {
  getAccount,
  getAccounts,
  getTransactions,
  postTransfer,
  transferPayload,
  uniqueIdempotencyKey,
} = require('../fixtures/test-data');

const specPath = path.join(__dirname, '..', '..', 'openapi', 'banking-api.yaml');
const spec = YAML.parse(fs.readFileSync(specPath, 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: false });
const compiled = new Map();

function resolvePointer(pointer) {
  if (!pointer.startsWith('#/')) {
    throw new Error(`Unsupported external $ref: ${pointer}`);
  }

  return pointer
    .slice(2)
    .split('/')
    .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'))
    .reduce((node, part) => {
      if (node === undefined) {
        throw new Error(`Unresolvable $ref: ${pointer}`);
      }
      return node[part];
    }, spec);
}

function dereference(value) {
  if (Array.isArray(value)) {
    return value.map((item) => dereference(item));
  }

  if (value && typeof value === 'object') {
    if (typeof value.$ref === 'string') {
      return dereference(resolvePointer(value.$ref));
    }

    const result = {};
    for (const [key, child] of Object.entries(value)) {
      result[key] = dereference(child);
    }
    return result;
  }

  return value;
}

function validateSchema(name, value) {
  if (!compiled.has(name)) {
    const schema = dereference(spec.components.schemas[name]);
    compiled.set(name, ajv.compile(schema));
  }

  const validate = compiled.get(name);
  const valid = validate(value);
  return { valid, errors: validate.errors };
}

function expectValid(name, value) {
  const result = validateSchema(name, value);
  expect(result.valid, JSON.stringify(result.errors, null, 2)).toBe(true);
}

function operation(pathname, method) {
  return spec.paths[pathname]?.[method];
}

test.describe('OpenAPI contract', () => {
  test('spec is OpenAPI 3.1 and documents every required endpoint and status', async () => {
    expect(spec.openapi).toBe('3.1.0');
    expect(spec.info.title).toContain('Banking');
    expect(spec.info.version).toBe('1.0.0');

    const requiredOperations = [
      ['/api/health', 'get'],
      ['/api/accounts', 'get'],
      ['/api/accounts', 'post'],
      ['/api/accounts/{accountId}', 'get'],
      ['/api/accounts/{accountId}/transactions', 'get'],
      ['/api/transfers', 'post'],
      ['/api/transfers/{transferId}', 'get'],
    ];

    for (const [pathname, method] of requiredOperations) {
      expect(operation(pathname, method), `${method.toUpperCase()} ${pathname}`).toBeDefined();
      expect(operation(pathname, method).responses).toBeDefined();
    }

    expect(Object.keys(operation('/api/transfers', 'post').responses)).toEqual(
      expect.arrayContaining(['200', '201', '400', '404', '409', '422', '500']),
    );

    for (const schemaName of [
      'Health',
      'Account',
      'AccountList',
      'AccountCreateRequest',
      'TransferRequest',
      'Transfer',
      'Transaction',
      'TransactionList',
      'Error',
    ]) {
      expect(spec.components.schemas[schemaName], schemaName).toBeDefined();
    }

    expect(spec.components.schemas.TransferRequest.required).toEqual(
      expect.arrayContaining([
        'fromAccountId',
        'toAccountId',
        'amount',
        'currency',
        'idempotencyKey',
      ]),
    );
    expect(spec.components.responses.BadRequest).toBeDefined();
    expect(spec.components.responses.NotFound).toBeDefined();
    expect(spec.components.responses.Conflict).toBeDefined();
    expect(spec.components.responses.UnprocessableEntity).toBeDefined();
  });

  test('account, health and empty-history responses match their schemas', async ({ api }) => {
    const health = await api.get('/api/health');
    expect(health.status()).toBe(200);
    expectValid('Health', await health.json());

    const accounts = await getAccounts(api);
    expect(accounts.response.status()).toBe(200);
    expectValid('AccountList', accounts.body);

    const account = await getAccount(api, 1);
    expect(account.response.status()).toBe(200);
    expectValid('AccountResponse', account.body);

    const history = await getTransactions(api, 1);
    expect(history.response.status()).toBe(200);
    expectValid('TransactionList', history.body);

    // Prove the validator is not vacuous: a numeric balance violates the contract.
    const drifted = structuredClone(account.body);
    drifted.data.balance = 1000;
    const invalid = validateSchema('AccountResponse', drifted);
    expect(invalid.valid).toBe(false);
    expect(invalid.errors.some((error) => error.instancePath.includes('balance'))).toBe(true);
  });

  test('transfer creation, retrieval, replay and history match the contract', async ({ api }) => {
    const { response } = await postTransfer(api, { amount: '12.34' });
    expect(response.status()).toBe(201);
    const created = await response.json();
    expectValid('TransferResponse', created);

    const fetched = await api.get(`/api/transfers/${created.data.id}`);
    expect(fetched.status()).toBe(200);
    expectValid('TransferResponse', await fetched.json());

    const replay = await api.post('/api/transfers', {
      data: {
        ...transferPayload(),
        idempotencyKey: created.data.idempotencyKey,
        amount: '12.34',
      },
    });
    expect(replay.status()).toBe(200);
    expectValid('TransferResponse', await replay.json());

    const history = await getTransactions(api, created.data.fromAccountId);
    expect(history.response.status()).toBe(200);
    expectValid('TransactionList', history.body);
    expect(history.body.data[0]).toMatchObject({
      transferId: created.data.id,
      type: 'DEBIT',
      amount: '12.34',
    });
  });

  test('documented error responses all match the Error schema', async ({ api }) => {
    const badRequest = await api.post('/api/transfers', {
      data: { ...transferPayload(), amount: '0' },
    });
    expect(badRequest.status()).toBe(400);
    const badRequestBody = await badRequest.json();
    expectValid('Error', badRequestBody);
    expect(badRequestBody.error.code).toBe('VALIDATION_ERROR');

    const notFound = await api.post('/api/transfers', {
      data: transferPayload({ fromAccountId: 999 }),
    });
    expect(notFound.status()).toBe(404);
    expectValid('Error', await notFound.json());

    const key = uniqueIdempotencyKey('contract-conflict');
    const original = await api.post('/api/transfers', {
      data: transferPayload({ idempotencyKey: key, amount: '10.00' }),
    });
    expect(original.status()).toBe(201);
    const conflict = await api.post('/api/transfers', {
      data: transferPayload({ idempotencyKey: key, amount: '11.00' }),
    });
    expect(conflict.status()).toBe(409);
    expectValid('Error', await conflict.json());

    const insufficient = await api.post('/api/transfers', {
      data: transferPayload({ fromAccountId: 2, toAccountId: 1, amount: '999999.00' }),
    });
    expect(insufficient.status()).toBe(422);
    expectValid('Error', await insufficient.json());

    const unknownTransfer = await api.get(`/api/transfers/${randomUUID()}`);
    expect(unknownTransfer.status()).toBe(404);
    expectValid('Error', await unknownTransfer.json());

    const unknownRoute = await api.get('/api/not-a-route');
    expect(unknownRoute.status()).toBe(404);
    expectValid('Error', await unknownRoute.json());
  });

  test('request schemas accept documented examples and reject wrong types', async () => {
    const transferExample = {
      fromAccountId: 1,
      toAccountId: 2,
      amount: '125.50',
      currency: 'USD',
      idempotencyKey: '4f4c3c1e-6e0e-4c9c-9f5a-0d2b7a1f9c11',
    };
    expectValid('TransferRequest', transferExample);
    expectValid('TransferRequest', { ...transferExample, amount: 125.5 });

    const numericAmount = validateSchema('TransferRequest', {
      ...transferExample,
      amount: 125.5,
    });
    expect(numericAmount.valid).toBe(true);

    const badAmount = validateSchema('TransferRequest', {
      ...transferExample,
      amount: '12.345',
    });
    expect(badAmount.valid).toBe(false);

    const { idempotencyKey: _omittedKey, ...withoutKey } = transferExample;
    const missingKey = validateSchema('TransferRequest', withoutKey);
    expect(missingKey.valid).toBe(false);

    expectValid('AccountCreateRequest', {
      customerName: 'Nadia Patel',
      email: 'nadia.patel@example.com',
      currency: 'USD',
      openingBalance: '500.00',
      accountType: 'SAVINGS',
    });
  });
});
