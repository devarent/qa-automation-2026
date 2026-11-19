'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createDatabase } = require('../../app/db');
const manifest = require('../../db/queries/manifest');

const QUERY_DIR = path.join(__dirname, '..', '..', 'db', 'queries');
const sqlCache = new Map();

function querySql(id) {
  if (!sqlCache.has(id)) {
    const entry = manifest.find((item) => item.id === id);
    assert.ok(entry, `Unknown validation query: ${id}`);
    sqlCache.set(id, fs.readFileSync(path.join(QUERY_DIR, entry.file), 'utf8'));
  }
  return sqlCache.get(id);
}

async function withDb(callback) {
  const database = createDatabase();
  try {
    await callback(database.pool, database.db);
  } finally {
    await database.close();
  }
}

async function runQuery(pool, id) {
  const result = await pool.query(querySql(id));
  return result.rows;
}

async function runAll(pool) {
  const results = [];
  for (const entry of manifest) {
    results.push({
      id: entry.id,
      title: entry.title,
      rows: await runQuery(pool, entry.id),
    });
  }
  return results;
}

async function assertHealthy(pool) {
  const results = await runAll(pool);
  for (const result of results) {
    assert.deepEqual(
      result.rows,
      [],
      `${result.id} returned violations: ${JSON.stringify(result.rows)}`,
    );
  }
}

async function insertTransfer(
  pool,
  {
    id = randomUUID(),
    idempotencyKey = `db-${randomUUID()}`,
    fromAccountId = 1,
    toAccountId = 2,
    amount = '100.00',
    currency = 'USD',
    updateBalances = true,
    entries = 'both',
  } = {},
) {
  await pool.query(
    `
      INSERT INTO transfers
        (id, idempotency_key, from_account_id, to_account_id, amount, currency, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'COMPLETED')
    `,
    [id, idempotencyKey, fromAccountId, toAccountId, amount, currency],
  );

  if (updateBalances) {
    await pool.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [
      amount,
      fromAccountId,
    ]);
    await pool.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [
      amount,
      toAccountId,
    ]);
  }

  if (entries === 'both') {
    await pool.query(
      `
        INSERT INTO ledger_entries (transfer_id, account_id, entry_type, amount, currency)
        VALUES ($1, $2, 'DEBIT', $3, $4), ($1, $5, 'CREDIT', $3, $4)
      `,
      [id, fromAccountId, amount, currency, toAccountId],
    );
  } else if (entries === 'debit-only') {
    await pool.query(
      `
        INSERT INTO ledger_entries (transfer_id, account_id, entry_type, amount, currency)
        VALUES ($1, $2, 'DEBIT', $3, $4)
      `,
      [id, fromAccountId, amount, currency],
    );
  }

  return id;
}

test('seeded database passes every integrity invariant', async () => {
  await withDb(async (pool) => {
    const accounts = (
      await pool.query('SELECT id, balance, opening_balance FROM accounts ORDER BY id')
    ).rows;
    assert.equal(accounts.length, 3);
    assert.deepEqual(
      accounts.map((account) => Number(account.balance)),
      [1000, 250, 500],
    );
    assert.deepEqual(
      accounts.map((account) => Number(account.opening_balance)),
      [1000, 250, 500],
    );

    await assertHealthy(pool);
  });
});

test('a balanced transfer updates balances and passes every invariant', async () => {
  await withDb(async (pool) => {
    await insertTransfer(pool, { amount: '100.25' });

    const accounts = (
      await pool.query('SELECT id, balance FROM accounts ORDER BY id')
    ).rows;
    assert.equal(Number(accounts[0].balance), 899.75);
    assert.equal(Number(accounts[1].balance), 350.25);

    const ledger = await pool.query('SELECT * FROM ledger_entries ORDER BY id');
    assert.equal(ledger.rows.length, 2);
    assert.deepEqual(
      ledger.rows.map((entry) => entry.entry_type),
      ['DEBIT', 'CREDIT'],
    );

    await assertHealthy(pool);
  });
});

test('detects a transfer whose ledger does not net to zero', async () => {
  await withDb(async (pool) => {
    await insertTransfer(pool, {
      amount: '100.00',
      updateBalances: false,
      entries: 'debit-only',
    });

    const netZero = await runQuery(pool, 'ledger-net-zero');
    assert.equal(netZero.length, 1);
    assert.equal(Number(netZero[0].net_amount), -100);

    const pairing = await runQuery(pool, 'transfer-entry-pairing');
    assert.equal(pairing.length, 1);
    assert.equal(Number(pairing[0].entry_count), 1);

    const reconciliation = await runQuery(pool, 'account-balance-reconciliation');
    assert.equal(reconciliation.length, 1);
    assert.equal(Number(reconciliation[0].account_id), 1);
  });
});

test('detects account balances that drift from the ledger', async () => {
  await withDb(async (pool) => {
    await insertTransfer(pool, { amount: '100.00', updateBalances: false });

    assert.deepEqual(await runQuery(pool, 'ledger-net-zero'), []);
    assert.deepEqual(await runQuery(pool, 'transfer-entry-pairing'), []);

    const reconciliation = await runQuery(pool, 'account-balance-reconciliation');
    assert.equal(reconciliation.length, 2);
    assert.deepEqual(
      reconciliation.map((row) => Number(row.account_id)).sort((a, b) => a - b),
      [1, 2],
    );
  });
});

test('foreign keys reject orphan ledger entries', async () => {
  await withDb(async (pool) => {
    const transferId = await insertTransfer(pool, { entries: 'none' });

    await assert.rejects(
      pool.query(
        `
          INSERT INTO ledger_entries (transfer_id, account_id, entry_type, amount, currency)
          VALUES ($1, 1, 'DEBIT', '10.00', 'USD')
        `,
        [randomUUID()],
      ),
      'a ledger entry with an unknown transfer must be rejected',
    );

    await assert.rejects(
      pool.query(
        `
          INSERT INTO ledger_entries (transfer_id, account_id, entry_type, amount, currency)
          VALUES ($1, 999, 'DEBIT', '10.00', 'USD')
        `,
        [transferId],
      ),
      'a ledger entry with an unknown account must be rejected',
    );

    assert.deepEqual(await runQuery(pool, 'orphan-ledger-entries'), []);
  });
});

test('unique constraints reject duplicate idempotency keys', async () => {
  await withDb(async (pool) => {
    const key = `duplicate-${randomUUID()}`;
    await insertTransfer(pool, { idempotencyKey: key, entries: 'none' });

    await assert.rejects(
      pool.query(
        `
          INSERT INTO transfers
            (id, idempotency_key, from_account_id, to_account_id, amount, currency, status)
          VALUES ($1, $2, 1, 2, '5.00', 'USD', 'COMPLETED')
        `,
        [randomUUID(), key],
      ),
      'a second transfer with the same idempotency key must be rejected',
    );

    const count = await pool.query('SELECT COUNT(*)::int AS count FROM transfers');
    assert.equal(Number(count.rows[0].count), 1);
    assert.deepEqual(await runQuery(pool, 'duplicate-idempotency-keys'), []);
  });
});

test('check constraints reject non-positive amounts and self-transfers', async () => {
  await withDb(async (pool) => {
    const insert = (amount, fromAccountId, toAccountId) =>
      pool.query(
        `
          INSERT INTO transfers
            (id, idempotency_key, from_account_id, to_account_id, amount, currency, status)
          VALUES ($1, $2, $3, $4, $5, 'USD', 'COMPLETED')
        `,
        [randomUUID(), `constraint-${randomUUID()}`, fromAccountId, toAccountId, amount],
      );

    await assert.rejects(insert('0.00', 1, 2), 'zero amount must be rejected');
    await assert.rejects(insert('-5.00', 1, 2), 'negative amount must be rejected');
    await assert.rejects(insert('5.00', 1, 1), 'same-account transfer must be rejected');

    assert.deepEqual(await runQuery(pool, 'non-positive-transfer-amounts'), []);
    assert.deepEqual(await runQuery(pool, 'self-transfers'), []);

    await insertTransfer(pool, { amount: '0.01' });
    await assertHealthy(pool);
  });
});

test('check constraints reject invalid ledger entries', async () => {
  await withDb(async (pool) => {
    const transferId = await insertTransfer(pool, { entries: 'none' });

    const insertLedger = (entryType, amount, currency) =>
      pool.query(
        `
          INSERT INTO ledger_entries (transfer_id, account_id, entry_type, amount, currency)
          VALUES ($1, 1, $2, $3, $4)
        `,
        [transferId, entryType, amount, currency],
      );

    await assert.rejects(insertLedger('DEBIT', '0.00', 'USD'), 'zero ledger amount');
    await assert.rejects(insertLedger('HOLD', '10.00', 'USD'), 'invalid entry type');
    await assert.rejects(insertLedger('DEBIT', '10.00', 'JPY'), 'invalid currency');

    assert.deepEqual(await runQuery(pool, 'invalid-ledger-entries'), []);
  });
});

test('detects missing and duplicate ledger entries for a transfer', async () => {
  await withDb(async (pool) => {
    await insertTransfer(pool, { entries: 'none' });
    let pairing = await runQuery(pool, 'transfer-entry-pairing');
    assert.equal(pairing.length, 1);
    assert.equal(Number(pairing[0].entry_count), 0);

    await withDb(async (secondPool) => {
      const transferId = await insertTransfer(secondPool, {
        amount: '10.00',
        entries: 'none',
      });
      await secondPool.query(
        `
          INSERT INTO ledger_entries (transfer_id, account_id, entry_type, amount, currency)
          VALUES
            ($1, 1, 'DEBIT', '5.00', 'USD'),
            ($1, 1, 'DEBIT', '5.00', 'USD'),
            ($1, 2, 'CREDIT', '10.00', 'USD')
        `,
        [transferId],
      );

      pairing = await runQuery(secondPool, 'transfer-entry-pairing');
      assert.equal(pairing.length, 1);
      assert.equal(Number(pairing[0].entry_count), 3);
      assert.equal(Number(pairing[0].debit_count), 2);
      assert.equal(Number(pairing[0].credit_count), 1);
    });
  });
});

test('validation manifest covers every required invariant', () => {
  const ids = new Set(manifest.map((entry) => entry.id));
  for (const required of [
    'ledger-net-zero',
    'account-balance-reconciliation',
    'orphan-ledger-entries',
    'duplicate-idempotency-keys',
    'non-positive-transfer-amounts',
  ]) {
    assert.ok(ids.has(required), `Missing validation query: ${required}`);
  }
});
