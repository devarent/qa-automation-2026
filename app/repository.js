'use strict';

const crypto = require('node:crypto');
const { errors } = require('./errors');

const ACCOUNT_SELECT = `
  SELECT a.id,
         a.customer_id,
         a.account_number,
         a.account_type,
         a.currency,
         a.opening_balance,
         a.balance,
         a.status,
         a.created_at,
         c.full_name,
         c.email
  FROM accounts a
  JOIN customers c ON c.id = a.customer_id
`;

const TRANSFER_SELECT = `
  SELECT t.id,
         t.idempotency_key,
         t.from_account_id,
         t.to_account_id,
         t.amount,
         t.currency,
         t.status,
         t.created_at,
         fa.account_number AS from_account_number,
         ta.account_number AS to_account_number
  FROM transfers t
  JOIN accounts fa ON fa.id = t.from_account_id
  JOIN accounts ta ON ta.id = t.to_account_id
`;

/**
 * pg-mem's pg adapter executes each statement in its own implicit transaction,
 * so BEGIN/COMMIT cannot span multiple awaited statements. Restore points give
 * the demo the same all-or-nothing guarantee. A production PostgreSQL service
 * would use a real transaction with SELECT ... FOR UPDATE row locks instead.
 */
async function atomic(db, operation) {
  const backup = db.backup();
  try {
    return await operation();
  } catch (error) {
    backup.restore();
    throw error;
  }
}

async function listAccounts(pool) {
  const result = await pool.query(`${ACCOUNT_SELECT} ORDER BY a.id ASC`);
  return result.rows;
}

async function getAccount(pool, accountId) {
  const result = await pool.query(`${ACCOUNT_SELECT} WHERE a.id = $1`, [accountId]);
  return result.rows[0] ?? null;
}

async function findCustomerByEmail(pool, email) {
  const result = await pool.query('SELECT id, full_name, email FROM customers WHERE email = $1', [
    email,
  ]);
  return result.rows[0] ?? null;
}

async function findTransferById(pool, transferId) {
  const result = await pool.query(`${TRANSFER_SELECT} WHERE t.id = $1`, [transferId]);
  return result.rows[0] ?? null;
}

async function findTransferByIdempotencyKey(pool, idempotencyKey) {
  const result = await pool.query(`${TRANSFER_SELECT} WHERE t.idempotency_key = $1`, [
    idempotencyKey,
  ]);
  return result.rows[0] ?? null;
}

const TRANSACTION_SELECT = `
      SELECT le.id,
             le.transfer_id,
             le.account_id,
             le.entry_type,
             le.amount,
             le.currency,
             le.created_at,
             CASE
               WHEN le.entry_type = 'DEBIT' THEN t.to_account_id
               ELSE t.from_account_id
             END AS counterparty_account_id,
             CASE
               WHEN le.entry_type = 'DEBIT' THEN ta.account_number
               ELSE fa.account_number
             END AS counterparty_account_number
      FROM ledger_entries le
      JOIN transfers t ON t.id = le.transfer_id
      JOIN accounts fa ON fa.id = t.from_account_id
      JOIN accounts ta ON ta.id = t.to_account_id
`;

async function listTransactions(pool, accountId) {
  const result = await pool.query(
    `${TRANSACTION_SELECT} WHERE le.account_id = $1 ORDER BY le.created_at DESC, le.id DESC`,
    [accountId],
  );
  return result.rows;
}

async function listAllTransactions(pool) {
  const result = await pool.query(
    `${TRANSACTION_SELECT} ORDER BY le.created_at DESC, le.id DESC LIMIT 500`,
  );
  return result.rows;
}

async function createAccount(pool, db, { customerName, email, currency, openingBalance, accountType }) {
  return atomic(db, async () => {
    let customer = await findCustomerByEmail(pool, email);

    if (!customer) {
      const inserted = await pool.query(
        'INSERT INTO customers (full_name, email) VALUES ($1, $2) RETURNING id, full_name, email',
        [customerName, email],
      );
      customer = inserted.rows[0];
    }

    const accountNumber = `QA-${crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;
    const inserted = await pool.query(
      `
        INSERT INTO accounts
          (customer_id, account_number, account_type, currency, opening_balance, balance, status)
        VALUES ($1, $2, $3, $4, $5, $5, 'ACTIVE')
        RETURNING id
      `,
      [customer.id, accountNumber, accountType, currency, openingBalance],
    );

    return getAccount(pool, inserted.rows[0].id);
  });
}

async function createTransfer(
  pool,
  db,
  { idempotencyKey, fromAccountId, toAccountId, amount, currency },
) {
  return atomic(db, async () => {
    const debit = await pool.query(
      `
        UPDATE accounts
        SET balance = balance - $1
        WHERE id = $2
          AND status = 'ACTIVE'
          AND balance >= $1
      `,
      [amount, fromAccountId],
    );

    if (debit.rowCount !== 1) {
      const account = await getAccount(pool, fromAccountId);
      throw errors.insufficientFunds(fromAccountId, account?.balance ?? '0.00', amount);
    }

    const credit = await pool.query(
      `
        UPDATE accounts
        SET balance = balance + $1
        WHERE id = $2
          AND status = 'ACTIVE'
      `,
      [amount, toAccountId],
    );

    if (credit.rowCount !== 1) {
      throw errors.accountNotActive(toAccountId, 'UNKNOWN');
    }

    const transferId = crypto.randomUUID();
    await pool.query(
      `
        INSERT INTO transfers
          (id, idempotency_key, from_account_id, to_account_id, amount, currency, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'COMPLETED')
      `,
      [transferId, idempotencyKey, fromAccountId, toAccountId, amount, currency],
    );

    await pool.query(
      `
        INSERT INTO ledger_entries
          (transfer_id, account_id, entry_type, amount, currency)
        VALUES
          ($1, $2, 'DEBIT', $3, $4),
          ($1, $5, 'CREDIT', $3, $4)
      `,
      [transferId, fromAccountId, amount, currency, toAccountId],
    );

    const transfer = await findTransferById(pool, transferId);
    if (!transfer) {
      throw errors.internal();
    }
    return transfer;
  });
}

module.exports = {
  listAccounts,
  getAccount,
  findTransferById,
  findTransferByIdempotencyKey,
  listTransactions,
  listAllTransactions,
  createAccount,
  createTransfer,
};
