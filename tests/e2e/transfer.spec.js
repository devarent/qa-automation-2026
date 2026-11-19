'use strict';

const { test, expect } = require('@playwright/test');
const { uniqueEmail } = require('../fixtures/test-data');

async function createTestAccount(request, overrides = {}) {
  const payload = {
    customerName: 'E2E Test User',
    email: uniqueEmail('e2e.account'),
    currency: 'USD',
    openingBalance: '500.00',
    accountType: 'CHECKING',
    ...overrides,
  };

  const response = await request.post('/api/accounts', { data: payload });
  if (response.status() !== 201) {
    throw new Error(
      `Account creation failed with ${response.status()}: ${await response.text()}`,
    );
  }
  const body = await response.json();
  return { ...body.data, email: payload.email };
}

async function readBalance(page, accountId) {
  const text = await page.getByTestId(`account-balance-${accountId}`).textContent();
  return Number(String(text).replace(/[^0-9.-]/g, ''));
}

async function openDashboard(page, accountIds) {
  await page.goto('/');
  await expect(page.getByTestId('app-title')).toBeVisible();
  for (const accountId of accountIds) {
    await expect(page.getByTestId(`account-card-${accountId}`)).toBeVisible();
  }
}

test.describe('Digital banking UI', () => {
  test('loads the dashboard with seeded accounts and a usable transfer form', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page.getByTestId('app-title')).toContainText('Banking flows');
    await expect(page.getByTestId('system-status')).toHaveAttribute('data-state', 'online');

    await expect(page.getByTestId('account-card-1')).toContainText('Alice Morgan');
    await expect(page.getByTestId('account-card-1')).toContainText('QA-1001-USD');
    await expect(page.getByTestId('account-card-2')).toContainText('Ben Okafor');
    await expect(page.getByTestId('account-card-3')).toContainText('Chloe Laurent');

    await expect(page.getByTestId('account-balance-1')).toHaveText(/^\$[\d,]+\.\d{2}$/);
    await expect(page.getByTestId('account-balance-2')).toHaveText(/^\$[\d,]+\.\d{2}$/);

    await expect(page.getByTestId('transfer-form')).toBeVisible();
    await expect(page.getByTestId('transfer-from')).toContainText('QA-1001-USD');
    await expect(page.getByTestId('transfer-to')).toContainText('QA-1002-USD');
    await expect(page.getByTestId('transfer-submit')).toBeEnabled();
    await expect(page.getByTestId('transaction-list')).toBeVisible();
  });

  test('submits a transfer, updates balances and shows the ledger entry', async ({
    page,
    request,
  }) => {
    const source = await createTestAccount(request, { openingBalance: '500.00' });
    const destination = await createTestAccount(request, {
      openingBalance: '100.00',
      customerName: 'E2E Destination',
    });

    await openDashboard(page, [source.id, destination.id]);
    await expect(page.getByTestId(`account-balance-${source.id}`)).toHaveText('$500.00');
    await expect(page.getByTestId(`account-balance-${destination.id}`)).toHaveText('$100.00');

    await page.getByTestId('transfer-from').selectOption(String(source.id));
    await page.getByTestId('transfer-to').selectOption(String(destination.id));
    await page.getByTestId('transfer-amount').fill('75.25');
    await page.getByTestId('transfer-currency').selectOption('USD');
    await page.getByTestId('transfer-submit').click();

    const success = page.getByTestId('transfer-success');
    await expect(success).toBeVisible();
    await expect(success).toContainText('Transfer completed');
    await expect(success).toContainText('$75.25');
    await expect(success).toContainText(destination.accountNumber);

    const transferId = await success.getAttribute('data-transfer-id');
    expect(transferId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );

    await expect
      .poll(async () => readBalance(page, source.id))
      .toBeCloseTo(424.75, 2);
    await expect
      .poll(async () => readBalance(page, destination.id))
      .toBeCloseTo(175.25, 2);

    await expect(page.getByTestId('history-account')).toHaveValue(String(source.id));
    const debitRow = page.getByTestId('transaction-row').first();
    await expect(debitRow).toContainText('DEBIT');
    await expect(debitRow).toContainText(destination.accountNumber);
    await expect(debitRow.getByTestId('transaction-amount')).toHaveText('-$75.25');
    await expect(debitRow).toHaveAttribute('data-transfer-id', transferId);

    await page.getByTestId('history-account').selectOption(String(destination.id));
    const creditRow = page.getByTestId('transaction-row').first();
    await expect(creditRow).toContainText('CREDIT');
    await expect(creditRow).toContainText(source.accountNumber);
    await expect(creditRow.getByTestId('transaction-amount')).toHaveText('+$75.25');

    await page.reload();
    await expect(page.getByTestId(`account-balance-${source.id}`)).toHaveText('$424.75');
    await expect(page.getByTestId(`account-balance-${destination.id}`)).toHaveText('$175.25');
  });

  test('shows an insufficient-funds error and does not move money', async ({
    page,
    request,
  }) => {
    const source = await createTestAccount(request, { openingBalance: '50.00' });
    const destination = await createTestAccount(request, {
      openingBalance: '10.00',
      customerName: 'E2E Low Balance Destination',
    });

    await openDashboard(page, [source.id, destination.id]);

    await page.getByTestId('transfer-from').selectOption(String(source.id));
    await page.getByTestId('transfer-to').selectOption(String(destination.id));
    await page.getByTestId('transfer-amount').fill('500.00');
    await page.getByTestId('transfer-currency').selectOption('USD');
    await page.getByTestId('transfer-submit').click();

    const error = page.getByTestId('transfer-error');
    await expect(error).toBeVisible();
    await expect(error).toContainText(/insufficient funds/i);
    await expect(error).toHaveAttribute('data-error-code', 'INSUFFICIENT_FUNDS');
    await expect(page.getByTestId('transfer-success')).toBeHidden();

    await expect(page.getByTestId(`account-balance-${source.id}`)).toHaveText('$50.00');
    await expect(page.getByTestId(`account-balance-${destination.id}`)).toHaveText('$10.00');

    await page.getByTestId('history-account').selectOption(String(source.id));
    await expect(page.getByTestId('transaction-empty')).toBeVisible();
  });

  test('rejects a same-account transfer with a clear validation error', async ({
    page,
    request,
  }) => {
    const account = await createTestAccount(request, { openingBalance: '100.00' });

    await openDashboard(page, [account.id]);
    await page.getByTestId('transfer-from').selectOption(String(account.id));
    await page.getByTestId('transfer-to').selectOption(String(account.id));
    await page.getByTestId('transfer-amount').fill('5.00');
    await page.getByTestId('transfer-currency').selectOption('USD');
    await page.getByTestId('transfer-submit').click();

    const error = page.getByTestId('transfer-error');
    await expect(error).toBeVisible();
    await expect(error).toContainText(/must be different/i);
    await expect(error).toHaveAttribute('data-error-code', 'SAME_ACCOUNT');
    await expect(page.getByTestId(`account-balance-${account.id}`)).toHaveText('$100.00');
  });

  test('surfaces a currency-mismatch error without changing either balance', async ({
    page,
    request,
  }) => {
    const usdAccount = await createTestAccount(request, {
      openingBalance: '100.00',
      currency: 'USD',
    });
    const eurAccount = await createTestAccount(request, {
      openingBalance: '100.00',
      currency: 'EUR',
      customerName: 'E2E Euro Account',
    });

    await openDashboard(page, [usdAccount.id, eurAccount.id]);
    await page.getByTestId('transfer-from').selectOption(String(usdAccount.id));
    await page.getByTestId('transfer-to').selectOption(String(eurAccount.id));
    await page.getByTestId('transfer-amount').fill('10.00');
    await page.getByTestId('transfer-currency').selectOption('USD');
    await page.getByTestId('transfer-submit').click();

    const error = page.getByTestId('transfer-error');
    await expect(error).toBeVisible();
    await expect(error).toContainText(/currency must match/i);
    await expect(error).toHaveAttribute('data-error-code', 'CURRENCY_MISMATCH');
    await expect(page.getByTestId(`account-balance-${usdAccount.id}`)).toHaveText('$100.00');
    await expect(page.getByTestId(`account-balance-${eurAccount.id}`)).toHaveText('EUR100.00');
  });
});
