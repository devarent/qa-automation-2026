-- Digital Banking QA Lab - PostgreSQL schema
-- Canonical DDL used by the in-memory pg-mem runtime, database validation tests
-- and the documented production-style data model.

CREATE TABLE customers (
    id          SERIAL PRIMARY KEY,
    full_name   VARCHAR(120) NOT NULL,
    email       VARCHAR(254) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT customers_email_unique UNIQUE (email)
);

CREATE TABLE accounts (
    id               SERIAL PRIMARY KEY,
    customer_id      INTEGER NOT NULL,
    account_number   VARCHAR(24) NOT NULL,
    account_type     VARCHAR(16) NOT NULL DEFAULT 'CHECKING',
    currency         CHAR(3) NOT NULL,
    opening_balance  NUMERIC(14, 2) NOT NULL,
    balance          NUMERIC(14, 2) NOT NULL,
    status           VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT accounts_number_unique UNIQUE (account_number),
    CONSTRAINT accounts_customer_fk FOREIGN KEY (customer_id) REFERENCES customers (id),
    CONSTRAINT accounts_type_check CHECK (account_type IN ('CHECKING', 'SAVINGS')),
    CONSTRAINT accounts_currency_check CHECK (currency IN ('USD', 'EUR', 'GBP')),
    CONSTRAINT accounts_opening_balance_check CHECK (opening_balance >= 0),
    CONSTRAINT accounts_balance_check CHECK (balance >= 0),
    CONSTRAINT accounts_status_check CHECK (status IN ('ACTIVE', 'FROZEN', 'CLOSED'))
);

CREATE TABLE transfers (
    id                VARCHAR(36) PRIMARY KEY,
    idempotency_key   VARCHAR(80) NOT NULL,
    from_account_id   INTEGER NOT NULL,
    to_account_id     INTEGER NOT NULL,
    amount            NUMERIC(14, 2) NOT NULL,
    currency          CHAR(3) NOT NULL,
    status            VARCHAR(16) NOT NULL DEFAULT 'COMPLETED',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT transfers_idempotency_key_unique UNIQUE (idempotency_key),
    CONSTRAINT transfers_from_account_fk FOREIGN KEY (from_account_id) REFERENCES accounts (id),
    CONSTRAINT transfers_to_account_fk FOREIGN KEY (to_account_id) REFERENCES accounts (id),
    CONSTRAINT transfers_amount_positive CHECK (amount > 0),
    CONSTRAINT transfers_currency_check CHECK (currency IN ('USD', 'EUR', 'GBP')),
    CONSTRAINT transfers_status_check CHECK (status IN ('COMPLETED', 'FAILED')),
    CONSTRAINT transfers_distinct_accounts CHECK (from_account_id <> to_account_id)
);

CREATE TABLE ledger_entries (
    id           SERIAL PRIMARY KEY,
    transfer_id  VARCHAR(36) NOT NULL,
    account_id   INTEGER NOT NULL,
    entry_type   VARCHAR(6) NOT NULL,
    amount       NUMERIC(14, 2) NOT NULL,
    currency     CHAR(3) NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ledger_transfer_fk FOREIGN KEY (transfer_id) REFERENCES transfers (id),
    CONSTRAINT ledger_account_fk FOREIGN KEY (account_id) REFERENCES accounts (id),
    CONSTRAINT ledger_entry_type_check CHECK (entry_type IN ('DEBIT', 'CREDIT')),
    CONSTRAINT ledger_amount_positive CHECK (amount > 0),
    CONSTRAINT ledger_currency_check CHECK (currency IN ('USD', 'EUR', 'GBP'))
);

CREATE INDEX idx_accounts_customer_id ON accounts (customer_id);
CREATE INDEX idx_transfers_from_account ON transfers (from_account_id);
CREATE INDEX idx_transfers_to_account ON transfers (to_account_id);
CREATE INDEX idx_transfers_created_at ON transfers (created_at);
CREATE INDEX idx_ledger_account_id ON ledger_entries (account_id);
CREATE INDEX idx_ledger_transfer_id ON ledger_entries (transfer_id);
