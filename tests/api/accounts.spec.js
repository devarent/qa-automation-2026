'use strict';

const { randomUUID } = require('node:crypto');
const { test, expect } = require('../fixtures/banking-app');

test.describe('accounts API', () => {
  test('lists the three deterministic seeded accounts', async ({ api }) => {
    const response = await api.get('/api/accounts');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(3);
    expect(body.data.map((a) => a.accountNumber)).toEqual([
      'QA-1001-USD',
      'QA-1002-USD',
      'QA-1003-EUR',
    ]);

    const first = body.data[0];
    expect(first.id).toBe(1);
    expect(first.accountType).toBe('CHECKING');
    expect(first.currency).toBe('USD');
    expect(first.balance).toBe(first.openingBalance);
    expect(first.status).toBe('ACTIVE');
    expect(first.customer.fullName).toBe('Alice Morgan');
    expect(first.customer.email).toBe('alice.morgan@example.com');
    expect(new Date(first.createdAt).toISOString()).toBe(first.createdAt);
  });

  test('gets one account by id with customer details', async ({ api }) => {
    const response = await api.get('/api/accounts/3');
    expect(response.status()).toBe(200);

    const { data } = await response.json();
    expect(data.accountNumber).toBe('QA-1003-EUR');
    expect(data.accountType).toBe('SAVINGS');
    expect(data.currency).toBe('EUR');
    expect(data.balance).toBe('500.00');
    expect(data.customer.fullName).toBe('Chloe Laurent');
  });

  test('returns 404 for a missing account', async ({ api }) => {
    const response = await api.get('/api/accounts/999999');
    expect(response.status()).toBe(404);

    const body = await response.json();
    expect(body.error.code).toBe('ACCOUNT_NOT_FOUND');
    expect(body.error.details.accountId).toBe(999999);
  });

  test('rejects a non numeric account id', async ({ api }) => {
    const response = await api.get('/api/accounts/not-a-number');
    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details.field).toBe('id');
  });

  test('creates an account with a valid payload', async ({ api }) => {
    const unique = randomUUID().slice(0, 8);
    const response = await api.post('/api/accounts', {
      data: {
        customerName: 'QA Test Customer',
        email: `qa.${unique}@example.com`,
        currency: 'USD',
        openingBalance: '75.25',
        accountType: 'SAVINGS',
      },
    });

    expect(response.status()).toBe(201);
    expect(response.headers()['location']).toMatch(/^\/api\/accounts\/\d+$/);

    const { data } = await response.json();
    expect(data.accountNumber).toMatch(/^QA-[0-9A-F]{10}$/);
    expect(data.openingBalance).toBe('75.25');
    expect(data.balance).toBe('75.25');
    expect(data.accountType).toBe('SAVINGS');
    expect(data.status).toBe('ACTIVE');

    const lookup = await api.get(response.headers()['location']);
    expect(lookup.status()).toBe(200);
    expect((await lookup.json()).data.id).toBe(data.id);
  });

  test('validates account creation input', async ({ api }) => {
    const response = await api.post('/api/accounts', {
      data: {
        customerName: 'X',
        email: 'bad-email',
        currency: 'JPY',
        openingBalance: '-10.00',
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details.field).toBe('customerName');
  });
});
