'use strict';

/*
 * Small vanilla client for the Northstar Bank QA Lab demo page.
 * It talks only to the same-origin REST API exposed by app/app.js.
 */

const state = {
  accounts: [],
  transactions: [],
  selectedHistoryId: null,
};

function byTestId(id, root = document) {
  return root.querySelector(`[data-testid="${id}"]`);
}

function formattedMoney(amount, currency) {
  const value = Number(amount).toFixed(2);
  if (currency === 'USD') {
    return `$${value}`;
  }
  if (currency === 'GBP') {
    return `GBP${value}`;
  }
  return `EUR${value}`;
}

async function api(path, options) {
  const response = await fetch(path, {
    ...options,
    headers: { Accept: 'application/json', ...(options?.headers || {}) },
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const error = new Error(payload?.error?.message || `Request failed (${response.status})`);
    error.code = payload?.error?.code || 'REQUEST_FAILED';
    error.status = response.status;
    throw error;
  }
  return payload;
}

function setSystemStatus(online, text) {
  const status = byTestId('system-status');
  if (!status) {
    return;
  }
  status.dataset.state = online ? 'online' : 'offline';
  const label = status.querySelector('[data-role="status-text"]');
  if (label) {
    label.textContent = text;
  }
}

function renderAccounts() {
  const grid = byTestId('accounts-grid');
  if (!grid) {
    return;
  }
  grid.innerHTML = '';
  for (const account of state.accounts) {
    const card = document.createElement('article');
    card.className = 'account-card';
    card.dataset.testid = 'account-card';
    card.dataset.accountId = String(account.id);
    card.innerHTML = `
      <div data-testid="account-card-${account.id}">
        <div class="account-card__top">
          <span class="account-type">${account.accountType}</span>
          <span class="account-status">${account.status}</span>
        </div>
        <h3>${account.customer.fullName}</h3>
        <div class="account-number">${account.accountNumber}</div>
        <div class="account-balance-label">Available balance</div>
        <div class="account-balance" data-testid="account-balance">${formattedMoney(account.balance, account.currency)} ${account.currency}</div>
        <div class="sr-only" data-testid="account-balance-${account.id}">${formattedMoney(account.balance, account.currency)}</div>
      </div>
    `;
    grid.appendChild(card);
  }
}

function fillSelect(select, accounts, includePlaceholder) {
  if (!select) {
    return;
  }
  select.innerHTML = '';
  if (includePlaceholder) {
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Select an account';
    select.appendChild(placeholder);
  }
  for (const account of accounts) {
    const option = document.createElement('option');
    option.value = String(account.id);
    option.textContent = `${account.accountNumber} - ${formattedMoney(account.balance, account.currency)}`;
    option.dataset.currency = account.currency;
    select.appendChild(option);
  }
}

function renderTransactions() {
  const list = byTestId('transaction-list');
  if (!list) {
    return;
  }
  list.innerHTML = '';
  if (state.transactions.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    empty.dataset.testid = 'transaction-empty';
    empty.textContent = 'No activity yet for this account.';
    list.appendChild(empty);
    return;
  }
  for (const tx of state.transactions) {
    const debit = tx.type === 'DEBIT';
    const sign = debit ? '-' : '+';
    const item = document.createElement('li');
    item.className = `transaction ${debit ? 'transaction--debit' : 'transaction--credit'}`;
    item.dataset.testid = 'transaction';
    item.dataset.type = tx.type;
    item.dataset.transferId = tx.transferId;
    item.innerHTML = `
      <div
        class="transaction-row"
        data-testid="transaction-row"
        data-type="${tx.type}"
        data-transfer-id="${tx.transferId}"
      >
        <span class="transaction__icon" aria-hidden="true">${sign}</span>
        <span class="transaction__title">
          <strong>${debit ? 'Transfer sent' : 'Transfer received'}</strong>
          <span class="transaction__meta">${tx.type} &middot; ${tx.counterpartyAccountNumber} &middot; ${tx.createdAt.slice(0, 10)}</span>
        </span>
        <span class="transaction__amount" data-testid="transaction-amount">${sign}${formattedMoney(tx.amount, tx.currency)}</span>
      </div>
    `;
    list.appendChild(item);
  }
}

function showSuccess(message, transferId) {
  const success = byTestId('transfer-success');
  const error = byTestId('transfer-error');
  if (error) {
    error.hidden = true;
  }
  if (!success) {
    return;
  }
  success.dataset.transferId = transferId;
  const text = success.querySelector('[data-role="message"]');
  if (text) {
    text.textContent = message;
  }
  const reference = byTestId('transfer-reference');
  if (reference) {
    reference.textContent = transferId;
  }
  success.hidden = false;
}

function showError(message, code) {
  const success = byTestId('transfer-success');
  const error = byTestId('transfer-error');
  if (success) {
    success.hidden = true;
  }
  if (!error) {
    return;
  }
  error.dataset.errorCode = code;
  const text = error.querySelector('[data-role="message"]');
  if (text) {
    text.textContent = message;
  }
  const codeNode = byTestId('transfer-error-code');
  if (codeNode) {
    codeNode.textContent = code;
  }
  error.hidden = false;
}

async function loadAccounts() {
  const result = await api('/api/accounts');
  state.accounts = result.data;
  renderAccounts();
  fillSelect(byTestId('transfer-from'), state.accounts, true);
  fillSelect(byTestId('transfer-to'), state.accounts, true);

  const history = byTestId('history-account');
  fillSelect(history, state.accounts, false);
  if (history && state.selectedHistoryId && state.accounts.some((a) => String(a.id) === String(state.selectedHistoryId))) {
    history.value = String(state.selectedHistoryId);
  }
  await loadTransactions();
}

async function loadTransactions() {
  const history = byTestId('history-account');
  const chosen = history?.value || state.selectedHistoryId || state.accounts[0]?.id;
  if (!chosen) {
    state.transactions = [];
    renderTransactions();
    return;
  }
  state.selectedHistoryId = chosen;
  const result = await api(`/api/accounts/${chosen}/transactions`);
  state.transactions = result.data;
  renderTransactions();
}

async function onTransferSubmit(event) {
  event.preventDefault();
  const form = byTestId('transfer-form');
  const submit = byTestId('transfer-submit');
  const label = submit?.querySelector('[data-role="submit-label"]');
  const from = byTestId('transfer-from')?.value;
  const to = byTestId('transfer-to')?.value;
  const amount = byTestId('transfer-amount')?.value.trim();
  const currency = byTestId('transfer-currency')?.value;

  if (!from || !to || !amount) {
    showError('Please complete every field before submitting.', 'VALIDATION_ERROR');
    return;
  }

  if (label) {
    label.textContent = 'Sending...';
  }
  if (submit) {
    submit.disabled = true;
  }

  try {
    const result = await api('/api/transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromAccountId: Number(from),
        toAccountId: Number(to),
        amount,
        currency,
        idempotencyKey: crypto.randomUUID(),
      }),
    });

    const transfer = result.data;
    const destination = state.accounts.find((a) => String(a.id) === String(to));
    state.selectedHistoryId = from;
    showSuccess(
      `Transfer completed: ${formattedMoney(transfer.amount, transfer.currency)} to ${destination?.accountNumber ?? `account ${to}`}.`,
      transfer.id,
    );
    form?.reset();
    await loadAccounts();
  } catch (error) {
    showError(error.message, error.code);
  } finally {
    if (label) {
      label.textContent = 'Send transfer';
    }
    if (submit) {
      submit.disabled = false;
    }
  }
}

async function init() {
  const year = byTestId('footer-year');
  if (year) {
    year.textContent = String(new Date().getFullYear());
  }

  byTestId('transfer-form')?.addEventListener('submit', onTransferSubmit);
  byTestId('history-account')?.addEventListener('change', loadTransactions);

  try {
    await api('/api/health');
    setSystemStatus(true, 'Systems operational');
    await loadAccounts();
  } catch (error) {
    setSystemStatus(false, 'API unavailable');
    const grid = byTestId('accounts-grid');
    if (grid) {
      grid.innerHTML = `<div class="empty-state" data-testid="accounts-error">Unable to load accounts: ${error.message}</div>`;
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
