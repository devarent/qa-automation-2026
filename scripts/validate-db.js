'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { createDatabase } = require('../app/db');
const manifest = require('../db/queries/manifest');

const QUERY_DIR = path.join(__dirname, '..', 'db', 'queries');

async function main() {
  const database = createDatabase();
  const { pool, db } = database;

  try {
    const backup = db.backup();
    try {
      const transferId = randomUUID();
      const idempotencyKey = `validate-db-${Date.now()}`;

      await pool.query('UPDATE accounts SET balance = balance - $1 WHERE id = 1', ['125.50']);
      await pool.query('UPDATE accounts SET balance = balance + $1 WHERE id = 2', ['125.50']);
      await pool.query(
        `
          INSERT INTO transfers
            (id, idempotency_key, from_account_id, to_account_id, amount, currency, status)
          VALUES ($1, $2, 1, 2, '125.50', 'USD', 'COMPLETED')
        `,
        [transferId, idempotencyKey],
      );
      await pool.query(
        `
          INSERT INTO ledger_entries (transfer_id, account_id, entry_type, amount, currency)
          VALUES ($1, 1, 'DEBIT', '125.50', 'USD'), ($1, 2, 'CREDIT', '125.50', 'USD')
        `,
        [transferId],
      );
    } catch (error) {
      backup.restore();
      throw error;
    }

    const results = [];
    for (const entry of manifest) {
      const sql = fs.readFileSync(path.join(QUERY_DIR, entry.file), 'utf8');
      const rows = (await pool.query(sql)).rows;
      results.push({ ...entry, rows });
    }

    const failures = results.filter((result) => result.rows.length > 0);

    console.log('Digital Banking QA Lab - database validation');
    console.log(`Seed data + 1 demo transfer (125.50 USD) - ${results.length} checks\n`);

    for (const result of results) {
      const status = result.rows.length === 0 ? 'PASS' : 'FAIL';
      console.log(
        `[${status}] ${result.id.padEnd(32)} ${String(result.rows.length).padStart(2)} violation(s)`,
      );
      if (result.rows.length > 0) {
        console.log(JSON.stringify(result.rows, null, 2));
      }
    }

    if (failures.length > 0) {
      console.error(`\nDatabase validation failed: ${failures.length} invariant(s) violated.`);
      process.exitCode = 1;
      return;
    }

    console.log(`\nDatabase validation passed: ${results.length} invariants, 0 violations.`);
  } finally {
    await database.close();
  }
}

main().catch((error) => {
  console.error('Database validation crashed:', error);
  process.exit(1);
});
