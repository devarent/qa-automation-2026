'use strict';

const { randomUUID } = require('node:crypto');

const SEEDED_ACCOUNTS = Object.freeze({
  aliceUsd: Object.freeze({ id: 1, accountNumber: 'QA-1001-USD', balance: '1000.00' }),
  benUsd: Object.freeze({ id: 2, accountNumber: 'QA-1002-USD', balance: '250.00' }),
  chloeEur: Object.freeze({ id: 3, accountNumber: 'QA-1003-EUR', balance: '500.00' }),
});

function uniqueIdempotencyKey(prefix = 'qa') {
  return `${prefix}-${Date.now()}-${randomUUID()}`;
}

function uniqueEmail(prefix = 'qa.user') {
  return `${prefix}.${Date.now()}.${randomUUID().slice(0, 8)}@example.com`;
}

function transferPayload(overrides = {}) {
  return {
    fromAccountId: SEEDED_ACCOUNTS.aliceUsd.id,
    toAccountId: SEEDED_ACCOUNTS.benUsd.id,
    amount: '25.00',
    currency: 'USD',
    idempotencyKey: uniqueIdempotencyKey('transfer'),
    ...overrides,
  };
}

async function postTransfer(api, overrides = {}) {
  const payload = transferPayload(overrides);
  const response = await api.post('/api/transfers', { data: payload });
  return { response, payload };
}

async function getAccounts(api) {
  const response = await api.get('/api/accounts');
  return { response, body: await response.json() };
}

async function getAccount(api, accountId) {
  const response = await api.get(`/api/accounts/${accountId}`);
  return { response, body: await response.json() };
}

async function getTransactions(api, accountId) {
  const response = await api.get(`/api/accounts/${accountId}/transactions`);
  return { response, body: await response.json() };
}

async function createAccount(api, overrides = {}) {
  const payload = {
    customerName: 'QA Test User',
    email: uniqueEmail('api.account'),
    currency: 'USD',
    openingBalance: '500.00',
    accountType: 'CHECKING',
    ...overrides,
  };

  const response = await api.post('/api/accounts', { data: payload });
  return { response, payload, body: await response.json() };
}

function moneyToCents(value) {
  return Math.round(Number(value) * 100);
}

module.exports = {
  SEEDED_ACCOUNTS,
  uniqueIdempotencyKey,
  uniqueEmail,
  transferPayload,
  postTransfer,
  getAccounts,
  getAccount,
  getTransactions,
  createAccount,
  moneyToCents,
};
