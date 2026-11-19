-- Invariant: every ledger entry points at an existing transfer and account.
SELECT le.id AS ledger_entry_id,
       le.transfer_id,
       le.account_id
FROM ledger_entries le
LEFT JOIN transfers t ON t.id = le.transfer_id
LEFT JOIN accounts a ON a.id = le.account_id
WHERE t.id IS NULL
   OR a.id IS NULL;
