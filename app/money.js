'use strict';

const MAX_AMOUNT_CENTS = 100_000_000; // 1,000,000.00

/**
 * Parse a money value from a JSON number or decimal string into integer cents.
 * Returns null when the value is malformed, negative, too precise or out of range.
 */
function parseMoney(input, { allowZero = false } = {}) {
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) {
      return null;
    }
    input = String(input);
  }

  if (typeof input !== 'string') {
    return null;
  }

  const value = input.trim();
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(value)) {
    return null;
  }

  const [whole, fraction = ''] = value.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));

  if (!Number.isSafeInteger(cents) || cents > MAX_AMOUNT_CENTS) {
    return null;
  }
  if (cents === 0 && !allowZero) {
    return null;
  }

  return cents;
}

function centsToAmount(cents) {
  return (cents / 100).toFixed(2);
}

function formatMoney(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : '0.00';
}

function amountToCents(value) {
  return Math.round(Number(value) * 100);
}

module.exports = {
  MAX_AMOUNT_CENTS,
  parseMoney,
  centsToAmount,
  formatMoney,
  amountToCents,
};
