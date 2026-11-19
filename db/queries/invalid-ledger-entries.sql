-- Invariant: ledger rows only use valid entry types and positive amounts.
SELECT id, transfer_id, entry_type, amount
FROM ledger_entries
WHERE amount <= 0
   OR entry_type NOT IN ('DEBIT', 'CREDIT');
