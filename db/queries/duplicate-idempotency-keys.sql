-- Invariant: idempotency keys are unique across all transfers.
SELECT idempotency_key, occurrences
FROM (
  SELECT idempotency_key,
         COUNT(*) AS occurrences
  FROM transfers
  GROUP BY idempotency_key
) AS key_counts
WHERE occurrences > 1;
