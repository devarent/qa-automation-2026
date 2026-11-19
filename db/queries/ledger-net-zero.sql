-- Invariant: each transfer's DEBIT and CREDIT entries net to zero.
-- Wrapped in a derived table because pg-mem does not plan CASE aggregates in HAVING.
SELECT transfer_id, net_amount
FROM (
  SELECT t.id AS transfer_id,
         SUM(CASE WHEN le.entry_type = 'DEBIT' THEN -le.amount ELSE le.amount END) AS net_amount
  FROM transfers t
  JOIN ledger_entries le ON le.transfer_id = t.id
  GROUP BY t.id
) AS nets
WHERE net_amount <> 0;
