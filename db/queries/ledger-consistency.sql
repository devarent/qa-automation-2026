-- Invariant: ledger rows agree with the transfer amount/currency and with the
-- correct debit/credit side, and the account currency matches the ledger.
SELECT le.id AS ledger_entry_id,
       le.transfer_id,
       le.account_id,
       le.entry_type,
       le.amount AS ledger_amount,
       t.amount AS transfer_amount,
       le.currency AS ledger_currency,
       t.currency AS transfer_currency,
       a.currency AS account_currency
FROM ledger_entries le
JOIN transfers t ON t.id = le.transfer_id
JOIN accounts a ON a.id = le.account_id
WHERE le.amount <> t.amount
   OR le.currency <> t.currency
   OR a.currency <> le.currency
   OR (le.entry_type = 'DEBIT' AND le.account_id <> t.from_account_id)
   OR (le.entry_type = 'CREDIT' AND le.account_id <> t.to_account_id);
