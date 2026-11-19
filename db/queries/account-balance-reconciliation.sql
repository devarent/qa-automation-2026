-- Invariant: current balance = opening balance + credits - debits.
SELECT account_id, opening_balance, balance, expected_balance
FROM (
  SELECT a.id AS account_id,
         a.opening_balance,
         a.balance,
         a.opening_balance
           + COALESCE(SUM(CASE WHEN le.entry_type = 'CREDIT' THEN le.amount ELSE 0 END), 0)
           - COALESCE(SUM(CASE WHEN le.entry_type = 'DEBIT' THEN le.amount ELSE 0 END), 0)
           AS expected_balance
  FROM accounts a
  LEFT JOIN ledger_entries le ON le.account_id = a.id
  GROUP BY a.id, a.opening_balance, a.balance
) AS reconciliation
WHERE (balance - expected_balance) > 0.001
   OR (balance - expected_balance) < -0.001;
