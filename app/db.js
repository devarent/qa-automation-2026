'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { newDb } = require('pg-mem');

const SCHEMA_PATH = path.join(__dirname, '..', 'db', 'schema.sql');
const SEED_PATH = path.join(__dirname, '..', 'db', 'seed.sql');

function readSql(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

/**
 * Create a fresh in-memory PostgreSQL database.
 *
 * pg-mem is used so the demo has no external database dependency. The same
 * schema/seed SQL files are executed by the SQL validation suite.
 */
function createDatabase({ seed = true } = {}) {
  const db = newDb({ autoCreateForeignKeyIndices: true });
  db.public.none(readSql(SCHEMA_PATH));

  if (seed) {
    db.public.none(readSql(SEED_PATH));
  }

  const { Pool } = db.adapters.createPg();
  const pool = new Pool();

  return {
    db,
    pool,
    async close() {
      await pool.end();
    },
  };
}

module.exports = {
  SCHEMA_PATH,
  SEED_PATH,
  createDatabase,
  readSql,
};
