-- Invariant: a transfer cannot debit and credit the same account.
SELECT id, from_account_id, to_account_id
FROM transfers
WHERE from_account_id = to_account_id;
