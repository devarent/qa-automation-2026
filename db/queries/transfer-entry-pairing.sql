-- Invariant: each transfer has exactly one debit and one credit ledger entry.
SELECT transfer_id, entry_count, debit_count, credit_count
FROM (
  SELECT t.id AS transfer_id,
         COUNT(le.id) AS entry_count,
         SUM(CASE WHEN le.entry_type = 'DEBIT' THEN 1 ELSE 0 END) AS debit_count,
         SUM(CASE WHEN le.entry_type = 'CREDIT' THEN 1 ELSE 0 END) AS credit_count
  FROM transfers t
  LEFT JOIN ledger_entries le ON le.transfer_id = t.id
  GROUP BY t.id
) AS entry_counts
WHERE entry_count <> 2
   OR debit_count <> 1
   OR credit_count <> 1;
