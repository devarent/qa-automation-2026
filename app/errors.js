'use strict';

class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  toEnvelope(requestId) {
    const error = {
      code: this.code,
      message: this.message,
      requestId,
    };

    if (this.details !== undefined) {
      error.details = this.details;
    }

    return { error };
  }
}

const errors = {
  validation(message, details) {
    return new ApiError(400, 'VALIDATION_ERROR', message, details);
  },
  sameAccount() {
    return new ApiError(
      400,
      'SAME_ACCOUNT',
      'The source and destination accounts must be different.',
    );
  },
  unsupportedCurrency(currency) {
    return new ApiError(
      400,
      'UNSUPPORTED_CURRENCY',
      `Currency "${currency}" is not supported. Supported currencies: USD, EUR, GBP.`,
      { currency },
    );
  },
  accountNotFound(accountId, field) {
    return new ApiError(404, 'ACCOUNT_NOT_FOUND', `Account ${accountId} was not found.`, {
      accountId,
      field,
    });
  },
  transferNotFound(transferId) {
    return new ApiError(404, 'TRANSFER_NOT_FOUND', `Transfer ${transferId} was not found.`, {
      transferId,
    });
  },
  accountNotActive(accountId, status) {
    return new ApiError(
      409,
      'ACCOUNT_NOT_ACTIVE',
      `Account ${accountId} is ${status.toLowerCase()} and cannot send or receive transfers.`,
      { accountId, status },
    );
  },
  idempotencyConflict(idempotencyKey) {
    return new ApiError(
      409,
      'IDEMPOTENCY_CONFLICT',
      'This idempotency key was already used with a different transfer payload.',
      { idempotencyKey },
    );
  },
  insufficientFunds(accountId, balance, requestedAmount) {
    return new ApiError(
      422,
      'INSUFFICIENT_FUNDS',
      `Account ${accountId} has insufficient funds for this transfer.`,
      { accountId, balance, requestedAmount },
    );
  },
  currencyMismatch(details) {
    return new ApiError(
      422,
      'CURRENCY_MISMATCH',
      'The transfer currency must match the currency of both accounts.',
      details,
    );
  },
  internal() {
    return new ApiError(
      500,
      'INTERNAL_ERROR',
      'An unexpected error occurred. Please try again later.',
    );
  },
};

module.exports = { ApiError, errors };
