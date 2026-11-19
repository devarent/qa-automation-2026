'use strict';

const { randomUUID } = require('node:crypto');
const { test, expect } = require('../fixtures/banking-app');
const {
  SEEDED_ACCOUNTS,
  createAccount,
  getAccount,
  getAccounts,
  getTransactions,
  moneyToCents,
  postTransfer,
  transferPayload,
  uniqueIdempotencyKey,
} = require('../fixtures/test-data');

function accountById(accounts, id) {
  return accounts.find((account) => account.id === id);
}

test.describe('Banking API - accounts and transfers', () => {
  test('health check and seeded accounts are available', async ({ api }) => {
    const health = await api.get('/api/health');
    expect(health.status()).toBe(200);
    expect(health.headers()['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);

    const healthBody = await health.json();
    expect(healthBody).toMatchObject({
      status: 'ok',
      service: 'banking-qa-lab',
      database: 'up',
      version: '1.0.0',
    });
    expect(Number.isNaN(Date.parse(healthBody.timestamp))).toBe(false);

    const { response, body } = await getAccounts(api);
    expect(response.status()).toBe(200);
    expect(body.data).toHaveLength(3);
    expect(body.data.map((account) => account.id)).toEqual([1, 2, 3]);

    expect(accountById(body.data, SEEDED_ACCOUNTS.aliceUsd.id)).toMatchObject({
      accountNumber: 'QA-1001-USD',
      currency: 'USD',
      balance: '1000.00',
      openingBalance: '1000.00',
      status: 'ACTIVE',
      customer: { fullName: 'Alice Morgan' },
    });
    expect(accountById(body.data, SEEDED_ACCOUNTS.benUsd.id).balance).toBe('250.00');
    expect(accountById(body.data, SEEDED_ACCOUNTS.chloeEur.id)).toMatchObject({
      currency: 'EUR',
      balance: '500.00',
    });

    const detail = await getAccount(api, 1);
    expect(detail.response.status()).toBe(200);
    expect(detail.body.data.customer.email).toBe('alice.morgan@example.com');
  });

  test('completes a transfer atomically and exposes matching debit/credit entries', async ({
    api,
  }) => {
    const { response, payload } = await postTransfer(api, { amount: '125.50' });
    expect(response.status()).toBe(201);

    const body = await response.json();
    const transfer = body.data;
    expect(transfer).toMatchObject({
      idempotencyKey: payload.idempotencyKey,
      fromAccountId: 1,
      toAccountId: 2,
      amount: '125.50',
      currency: 'USD',
      status: 'COMPLETED',
      fromAccount: { id: 1, accountNumber: 'QA-1001-USD' },
      toAccount: { id: 2, accountNumber: 'QA-1002-USD' },
    });
    expect(transfer.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(response.headers().location).toBe(`/api/transfers/${transfer.id}`);
    expect(response.headers()['idempotent-replayed']).toBeUndefined();

    const fetched = await api.get(`/api/transfers/${transfer.id}`);
    expect(fetched.status()).toBe(200);
    expect((await fetched.json()).data).toEqual(transfer);

    const { body: accountsBody } = await getAccounts(api);
    expect(accountById(accountsBody.data, 1).balance).toBe('874.50');
    expect(accountById(accountsBody.data, 2).balance).toBe('375.50');
    expect(accountById(accountsBody.data, 3).balance).toBe('500.00');

    const debitHistory = await getTransactions(api, 1);
    expect(debitHistory.response.status()).toBe(200);
    expect(debitHistory.body.data).toHaveLength(1);
    expect(debitHistory.body.data[0]).toMatchObject({
      transferId: transfer.id,
      accountId: 1,
      type: 'DEBIT',
      amount: '125.50',
      currency: 'USD',
      counterpartyAccountId: 2,
      counterpartyAccountNumber: 'QA-1002-USD',
    });

    const creditHistory = await getTransactions(api, 2);
    expect(creditHistory.body.data).toHaveLength(1);
    expect(creditHistory.body.data[0]).toMatchObject({
      transferId: transfer.id,
      accountId: 2,
      type: 'CREDIT',
      amount: '125.50',
      counterpartyAccountId: 1,
      counterpartyAccountNumber: 'QA-1001-USD',
    });
  });

  test('rejects insufficient funds and leaves every balance untouched', async ({ api }) => {
    const { response } = await postTransfer(api, {
      fromAccountId: 2,
      toAccountId: 1,
      amount: '250.01',
    });
    expect(response.status()).toBe(422);

    const body = await response.json();
    expect(body.error).toMatchObject({
      code: 'INSUFFICIENT_FUNDS',
      details: {
        accountId: 2,
        balance: '250.00',
        requestedAmount: '250.01',
      },
    });
    expect(body.error.requestId).toMatch(/^[0-9a-f-]{36}$/);

    const { body: accountsBody } = await getAccounts(api);
    expect(accountById(accountsBody.data, 1).balance).toBe('1000.00');
    expect(accountById(accountsBody.data, 2).balance).toBe('250.00');

    const history = await getTransactions(api, 2);
    expect(history.body.data).toEqual([]);
  });

  test('rejects invalid and out-of-boundary amounts with 400 responses', async ({ api }) => {
    const cases = [
      { label: 'zero', amount: 0 },
      { label: 'negative', amount: -5 },
      { label: 'too many decimals', amount: '10.999' },
      { label: 'non-numeric', amount: 'abc' },
      { label: 'null', amount: null },
      { label: 'empty string', amount: '' },
      { label: 'above maximum', amount: '1000000.01' },
      { label: 'below minimum', amount: '0.001' },
      { label: 'missing' },
    ];

    for (const testCase of cases) {
      await test.step(testCase.label, async () => {
        const payload = transferPayload({
          idempotencyKey: uniqueIdempotencyKey('invalid-amount'),
        });

        if (testCase.label === 'missing') {
          delete payload.amount;
        } else {
          payload.amount = testCase.amount;
        }

        const response = await api.post('/api/transfers', { data: payload });
        expect(response.status()).toBe(400);
        const body = await response.json();
        expect(body.error.code).toBe('VALIDATION_ERROR');
        expect(body.error.details).toMatchObject({ field: 'amount' });
      });
    }

    const { body: accountsBody } = await getAccounts(api);
    expect(accountById(accountsBody.data, 1).balance).toBe('1000.00');
    expect(accountById(accountsBody.data, 2).balance).toBe('250.00');
  });

  test('rejects a transfer to the same account', async ({ api }) => {
    const response = await api.post('/api/transfers', {
      data: transferPayload({ toAccountId: 1 }),
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('SAME_ACCOUNT');

    const { body: accountsBody } = await getAccounts(api);
    expect(accountById(accountsBody.data, 1).balance).toBe('1000.00');
    expect(accountById(accountsBody.data, 2).balance).toBe('250.00');
  });

  test('replays an idempotent request without double debiting', async ({ api }) => {
    const key = uniqueIdempotencyKey('replay');
    const payload = transferPayload({ amount: '25.00', idempotencyKey: key });

    const first = await api.post('/api/transfers', { data: payload });
    expect(first.status()).toBe(201);
    const firstBody = await first.json();

    const second = await api.post('/api/transfers', { data: payload });
    expect(second.status()).toBe(200);
    expect(second.headers()['idempotent-replayed']).toBe('true');
    const secondBody = await second.json();
    expect(secondBody).toEqual(firstBody);

    // The API normalises numeric amounts and currency casing before comparing.
    const third = await api.post('/api/transfers', {
      data: { ...payload, amount: 25, currency: 'usd' },
    });
    expect(third.status()).toBe(200);
    expect((await third.json()).data.id).toBe(firstBody.data.id);

    const { body: accountsBody } = await getAccounts(api);
    expect(accountById(accountsBody.data, 1).balance).toBe('975.00');
    expect(accountById(accountsBody.data, 2).balance).toBe('275.00');

    const debitHistory = await getTransactions(api, 1);
    const creditHistory = await getTransactions(api, 2);
    expect(debitHistory.body.data).toHaveLength(1);
    expect(creditHistory.body.data).toHaveLength(1);
  });

  test('serialises concurrent requests that share an idempotency key', async ({ api }) => {
    const payload = transferPayload({
      amount: '30.00',
      idempotencyKey: uniqueIdempotencyKey('concurrent'),
    });

    const responses = await Promise.all(
      Array.from({ length: 6 }, () => api.post('/api/transfers', { data: payload })),
    );
    const statuses = responses.map((response) => response.status()).sort();
    expect(statuses).toEqual([200, 200, 200, 200, 200, 201]);

    const bodies = await Promise.all(responses.map((response) => response.json()));
    const ids = new Set(bodies.map((body) => body.data.id));
    expect(ids.size).toBe(1);

    const { body: accountsBody } = await getAccounts(api);
    expect(accountById(accountsBody.data, 1).balance).toBe('970.00');
    expect(accountById(accountsBody.data, 2).balance).toBe('280.00');

    const history = await getTransactions(api, 1);
    expect(history.body.data).toHaveLength(1);
  });

  test('rejects reuse of an idempotency key with a different payload', async ({ api }) => {
    const key = uniqueIdempotencyKey('conflict');
    const first = await api.post('/api/transfers', {
      data: transferPayload({ amount: '10.00', idempotencyKey: key }),
    });
    expect(first.status()).toBe(201);

    const conflicting = await api.post('/api/transfers', {
      data: transferPayload({ amount: '11.00', idempotencyKey: key }),
    });
    expect(conflicting.status()).toBe(409);
    const conflictBody = await conflicting.json();
    expect(conflictBody.error).toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT',
      details: { idempotencyKey: key },
    });

    const replay = await api.post('/api/transfers', {
      data: transferPayload({ amount: '10.00', idempotencyKey: key }),
    });
    expect(replay.status()).toBe(200);

    const { body: accountsBody } = await getAccounts(api);
    expect(accountById(accountsBody.data, 1).balance).toBe('990.00');
    expect(accountById(accountsBody.data, 2).balance).toBe('260.00');
  });

  test('returns 404 for unknown source and destination accounts', async ({ api }) => {
    const missingSource = await api.post('/api/transfers', {
      data: transferPayload({ fromAccountId: 999 }),
    });
    expect(missingSource.status()).toBe(404);
    expect((await missingSource.json()).error).toMatchObject({
      code: 'ACCOUNT_NOT_FOUND',
      details: { accountId: 999, field: 'fromAccountId' },
    });

    const missingDestination = await api.post('/api/transfers', {
      data: transferPayload({ toAccountId: 999 }),
    });
    expect(missingDestination.status()).toBe(404);
    expect((await missingDestination.json()).error).toMatchObject({
      code: 'ACCOUNT_NOT_FOUND',
      details: { accountId: 999, field: 'toAccountId' },
    });

    const { body: accountsBody } = await getAccounts(api);
    expect(accountById(accountsBody.data, 1).balance).toBe('1000.00');
    expect(accountById(accountsBody.data, 2).balance).toBe('250.00');
  });

  test('enforces supported currencies and account currency matching', async ({ api }) => {
    const crossCurrency = await api.post('/api/transfers', {
      data: transferPayload({ toAccountId: 3, currency: 'USD' }),
    });
    expect(crossCurrency.status()).toBe(422);
    expect((await crossCurrency.json()).error).toMatchObject({
      code: 'CURRENCY_MISMATCH',
      details: { currency: 'USD', fromCurrency: 'USD', toCurrency: 'EUR' },
    });

    const requestCurrencyMismatch = await api.post('/api/transfers', {
      data: transferPayload({ currency: 'EUR' }),
    });
    expect(requestCurrencyMismatch.status()).toBe(422);
    expect((await requestCurrencyMismatch.json()).error.code).toBe('CURRENCY_MISMATCH');

    const unsupported = await api.post('/api/transfers', {
      data: transferPayload({ currency: 'JPY' }),
    });
    expect(unsupported.status()).toBe(400);
    expect((await unsupported.json()).error.code).toBe('UNSUPPORTED_CURRENCY');

    const { body: accountsBody } = await getAccounts(api);
    expect(accountById(accountsBody.data, 1).balance).toBe('1000.00');
    expect(accountById(accountsBody.data, 2).balance).toBe('250.00');
    expect(accountById(accountsBody.data, 3).balance).toBe('500.00');
  });

  test('keeps history and balances consistent across multiple transfers', async ({ api }) => {
    const first = await postTransfer(api, { amount: '10.25' });
    expect(first.response.status()).toBe(201);
    const second = await postTransfer(api, { amount: '40.00' });
    expect(second.response.status()).toBe(201);

    const firstTransfer = (await first.response.json()).data;
    const secondTransfer = (await second.response.json()).data;

    const { body: accountsBody } = await getAccounts(api);
    const alice = accountById(accountsBody.data, 1);
    const ben = accountById(accountsBody.data, 2);
    expect(alice.balance).toBe('949.75');
    expect(ben.balance).toBe('300.25');

    const aliceHistory = await getTransactions(api, 1);
    const benHistory = await getTransactions(api, 2);
    expect(aliceHistory.body.meta).toMatchObject({ accountId: 1, count: 2 });
    expect(aliceHistory.body.data.map((entry) => entry.amount)).toEqual(['40.00', '10.25']);
    expect(aliceHistory.body.data.map((entry) => entry.type)).toEqual(['DEBIT', 'DEBIT']);
    expect(benHistory.body.data.map((entry) => entry.amount)).toEqual(['40.00', '10.25']);
    expect(benHistory.body.data.map((entry) => entry.type)).toEqual(['CREDIT', 'CREDIT']);

    const debitCents = aliceHistory.body.data.reduce(
      (total, entry) => total + moneyToCents(entry.amount),
      0,
    );
    expect(moneyToCents(alice.balance)).toBe(
      moneyToCents(alice.openingBalance) - debitCents,
    );
    expect(moneyToCents(ben.balance)).toBe(
      moneyToCents(ben.openingBalance) + debitCents,
    );

    for (const transfer of [firstTransfer, secondTransfer]) {
      const debit = aliceHistory.body.data.find(
        (entry) => entry.transferId === transfer.id,
      );
      const credit = benHistory.body.data.find(
        (entry) => entry.transferId === transfer.id,
      );
      expect(debit).toBeDefined();
      expect(credit).toBeDefined();
      expect(debit.amount).toBe(credit.amount);
      expect(debit.counterpartyAccountId).toBe(2);
      expect(credit.counterpartyAccountId).toBe(1);
    }
  });

  test('allows the exact available balance and blocks the next cent', async ({ api }) => {
    const exact = await postTransfer(api, {
      fromAccountId: 2,
      toAccountId: 1,
      amount: '250.00',
    });
    expect(exact.response.status()).toBe(201);

    const { body: afterExact } = await getAccounts(api);
    expect(accountById(afterExact.data, 2).balance).toBe('0.00');
    expect(accountById(afterExact.data, 1).balance).toBe('1250.00');

    const oneCent = await postTransfer(api, {
      fromAccountId: 2,
      toAccountId: 1,
      amount: '0.01',
    });
    expect(oneCent.response.status()).toBe(422);
    const body = await oneCent.response.json();
    expect(body.error).toMatchObject({
      code: 'INSUFFICIENT_FUNDS',
      details: { accountId: 2, balance: '0.00', requestedAmount: '0.01' },
    });

    const { body: afterReject } = await getAccounts(api);
    expect(accountById(afterReject.data, 2).balance).toBe('0.00');
    expect(accountById(afterReject.data, 1).balance).toBe('1250.00');
  });

  test('validates required transfer fields and identifier formats', async ({ api }) => {
    const cases = [
      { field: 'fromAccountId', patch: { fromAccountId: undefined } },
      { field: 'toAccountId', patch: { toAccountId: undefined } },
      { field: 'currency', patch: { currency: 'US' } },
      { field: 'idempotencyKey', patch: { idempotencyKey: '   ' } },
      { field: 'fromAccountId', patch: { fromAccountId: 0 } },
      { field: 'toAccountId', patch: { toAccountId: 'abc' } },
    ];

    for (const testCase of cases) {
      await test.step(`${testCase.field}: ${JSON.stringify(testCase.patch)}`, async () => {
        const payload = { ...transferPayload(), ...testCase.patch };
        if (
          Object.prototype.hasOwnProperty.call(testCase.patch, 'fromAccountId') &&
          testCase.patch.fromAccountId === undefined
        ) {
          delete payload.fromAccountId;
        }
        if (
          Object.prototype.hasOwnProperty.call(testCase.patch, 'toAccountId') &&
          testCase.patch.toAccountId === undefined
        ) {
          delete payload.toAccountId;
        }

        const response = await api.post('/api/transfers', { data: payload });
        expect(response.status()).toBe(400);
        const body = await response.json();
        expect(body.error.code).toBe('VALIDATION_ERROR');
        expect(body.error.details).toMatchObject({ field: testCase.field });
      });
    }

    const emptyBody = await api.post('/api/transfers', { data: {} });
    expect(emptyBody.status()).toBe(400);
    expect((await emptyBody.json()).error.code).toBe('VALIDATION_ERROR');
  });

  test('returns consistent 400/404 envelopes for unknown resources', async ({ api }) => {
    const missingAccount = await api.get('/api/accounts/999');
    expect(missingAccount.status()).toBe(404);
    expect((await missingAccount.json()).error.code).toBe('ACCOUNT_NOT_FOUND');

    const malformedAccount = await api.get('/api/accounts/not-a-number');
    expect(malformedAccount.status()).toBe(400);
    expect((await malformedAccount.json()).error.code).toBe('VALIDATION_ERROR');

    const missingHistory = await api.get('/api/accounts/999/transactions');
    expect(missingHistory.status()).toBe(404);
    expect((await missingHistory.json()).error.code).toBe('ACCOUNT_NOT_FOUND');

    const missingTransfer = await api.get(`/api/transfers/${randomUUID()}`);
    expect(missingTransfer.status()).toBe(404);
    expect((await missingTransfer.json()).error.code).toBe('TRANSFER_NOT_FOUND');

    const unknownRoute = await api.get('/api/does-not-exist');
    expect(unknownRoute.status()).toBe(404);
    expect((await unknownRoute.json()).error.code).toBe('ROUTE_NOT_FOUND');
  });

  test('opens new accounts for isolated test and load-test scenarios', async ({ api }) => {
    const created = await createAccount(api, {
      customerName: 'Nadia Patel',
      openingBalance: '500.00',
      accountType: 'SAVINGS',
    });
    expect(created.response.status()).toBe(201);
    expect(created.response.headers().location).toBe(`/api/accounts/${created.body.data.id}`);
    expect(created.body.data).toMatchObject({
      accountNumber: expect.stringMatching(/^QA-[A-F0-9]{10}$/),
      accountType: 'SAVINGS',
      currency: 'USD',
      balance: '500.00',
      openingBalance: '500.00',
      status: 'ACTIVE',
      customer: { fullName: 'Nadia Patel', email: created.payload.email },
    });

    const newAccountId = created.body.data.id;
    const detail = await getAccount(api, newAccountId);
    expect(detail.response.status()).toBe(200);
    expect(detail.body.data.id).toBe(newAccountId);

    const { body: accountsBody } = await getAccounts(api);
    expect(accountsBody.data).toHaveLength(4);

    const transfer = await postTransfer(api, {
      fromAccountId: newAccountId,
      toAccountId: 1,
      amount: '50.00',
    });
    expect(transfer.response.status()).toBe(201);

    const { body: afterTransfer } = await getAccounts(api);
    expect(accountById(afterTransfer.data, newAccountId).balance).toBe('450.00');
    expect(accountById(afterTransfer.data, 1).balance).toBe('1050.00');

    const sameCustomer = await createAccount(api, {
      email: created.payload.email,
      customerName: 'Nadia Patel',
      openingBalance: '10.00',
    });
    expect(sameCustomer.response.status()).toBe(201);
    expect(sameCustomer.body.data.customer.id).toBe(created.body.data.customer.id);

    const invalid = await createAccount(api, { openingBalance: '-1.00' });
    expect(invalid.response.status()).toBe(400);
    expect((await invalid.response.json()).error).toMatchObject({
      code: 'VALIDATION_ERROR',
      details: { field: 'openingBalance' },
    });
  });
});
