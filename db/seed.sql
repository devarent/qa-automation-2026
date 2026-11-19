-- Digital Banking QA Lab - deterministic seed data
-- Three customers/accounts: two USD accounts for transfer scenarios and one
-- EUR account for currency-mismatch validation.

INSERT INTO customers (full_name, email) VALUES
    ('Alice Morgan', 'alice.morgan@example.com'),
    ('Ben Okafor', 'ben.okafor@example.com'),
    ('Chloe Laurent', 'chloe.laurent@example.com');

INSERT INTO accounts (customer_id, account_number, account_type, currency, opening_balance, balance, status) VALUES
    (1, 'QA-1001-USD', 'CHECKING', 'USD', 1000.00, 1000.00, 'ACTIVE'),
    (2, 'QA-1002-USD', 'CHECKING', 'USD', 250.00, 250.00, 'ACTIVE'),
    (3, 'QA-1003-EUR', 'SAVINGS', 'EUR', 500.00, 500.00, 'ACTIVE');
