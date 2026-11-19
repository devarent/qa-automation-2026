'use strict';

/**
 * Canonical list of database invariants used by both the node:test suite and
 * `npm run validate:db`. Each query must return zero rows in a healthy database;
 * any row is a violation with diagnostic columns.
 */
module.exports = [
  {
    id: 'ledger-net-zero',
    title: 'Ledger debits and credits net to zero for every transfer',
    file: 'ledger-net-zero.sql',
  },
  {
    id: 'account-balance-reconciliation',
    title: 'Account balance equals opening balance plus credits minus debits',
    file: 'account-balance-reconciliation.sql',
  },
  {
    id: 'orphan-ledger-entries',
    title: 'No ledger entry references a missing transfer or account',
    file: 'orphan-ledger-entries.sql',
  },
  {
    id: 'duplicate-idempotency-keys',
    title: 'Transfer idempotency keys are unique',
    file: 'duplicate-idempotency-keys.sql',
  },
  {
    id: 'non-positive-transfer-amounts',
    title: 'Every transfer amount is positive',
    file: 'non-positive-transfer-amounts.sql',
  },
  {
    id: 'transfer-entry-pairing',
    title: 'Every transfer has exactly one DEBIT and one CREDIT entry',
    file: 'transfer-entry-pairing.sql',
  },
  {
    id: 'ledger-consistency',
    title: 'Ledger amounts, currencies and account sides match their transfer',
    file: 'ledger-consistency.sql',
  },
  {
    id: 'negative-account-balances',
    title: 'No account has a negative balance',
    file: 'negative-account-balances.sql',
  },
  {
    id: 'self-transfers',
    title: 'No transfer uses the same account on both sides',
    file: 'self-transfers.sql',
  },
  {
    id: 'invalid-ledger-entries',
    title: 'Ledger entry types and amounts are valid',
    file: 'invalid-ledger-entries.sql',
  },
];
