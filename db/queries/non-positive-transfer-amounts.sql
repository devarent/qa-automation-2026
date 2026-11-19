-- Invariant: transfer amounts must always be positive.
SELECT id, amount
FROM transfers
WHERE amount <= 0;
