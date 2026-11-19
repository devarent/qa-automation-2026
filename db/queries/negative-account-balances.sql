-- Invariant: account balances can never be negative.
SELECT id, balance
FROM accounts
WHERE balance < 0;
