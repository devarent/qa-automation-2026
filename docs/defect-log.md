# Defect Log - Release 2026.1

Three representative defects from the banking QA lab. Two were fixed and verified;
one low-severity UI race remains open and is explicitly accepted for this release.
The purpose is to show the full lifecycle, not to claim that a demo is defect-free.

## Summary

| ID | Title | Severity | Priority | Status | Found in | Requirement |
| --- | --- | --- | --- | --- | --- | --- |
| DEF-2026-001 | Concurrent idempotent requests double-debited the source account | Critical | P0 | Closed / Verified | API concurrency testing | REQ-TRF-06 |
| DEF-2026-002 | Ledger insert failure left a debit without its credit | High | P1 | Closed / Verified | Database failure-path review | REQ-TRF-08, REQ-DB-02 |
| DEF-2026-003 | Rapid history switching can show stale entries | Low | P3 | Open / Accepted | Exploratory E2E | REQ-UI-01 |

## DEF-2026-001 - Concurrent idempotent requests double-debited the source account

| Field | Value |
| --- | --- |
| Severity / priority | Critical / P0 |
| Status | Closed / Verified |
| Environment | Local Node 22, pg-mem, build 2026.1-rc1 |
| Component | Transfer service, idempotency |
| Reproducibility | Intermittent, 2 of 6 concurrent requests in the failing run |
| Requirement / case | REQ-TRF-06 / TC-TRF-010 |

**Preconditions**

- Fresh seeded database: account 1 has 1,000.00 USD and account 2 has 250.00 USD.
- One payload: 25.00 USD from account 1 to account 2 with idempotency key `race-001`.

**Steps**

1. Send six `POST /api/transfers` requests concurrently with the same payload.
2. Record each status code and transfer id.
3. Read both account balances and both histories.

**Expected**

Exactly one `201`, five `200` replays with `Idempotent-Replayed: true`, one transfer
id, one debit and one credit, and balances 975.00 / 275.00.

**Actual**

Two requests returned `201` with different transfer ids. The source balance was
950.00, the destination 300.00, and four ledger entries existed for the same
idempotency key. The unique constraint was not a sufficient guard because the
check-then-insert sequence was not serialised.

**Root cause**

The idempotency lookup and the transfer write were separated by `await` points, so
two requests could both observe "no existing key" before either inserted the row.
The unique constraint prevented a duplicate key row but the losing request surfaced
as an internal error instead of a replay.

**Fix**

- Serialise the idempotency lookup, validation and write for all money operations.
- Keep the database unique constraint as the final backstop.
- Normalise amount and currency before comparing a replay payload.
- Add the six-way concurrency case to the API suite.

**Verification**

`TC-TRF-010` passes: one `201`, five `200`, one transfer id, one debit/credit pair,
balances 970.00 / 280.00 for the 30.00 test amount. The full API and DB suites remain
green. Closed 2026-11-13.

## DEF-2026-002 - Ledger insert failure left a debit without its credit

| Field | Value |
| --- | --- |
| Severity / priority | High / P1 |
| Status | Closed / Verified |
| Environment | Local Node 22, pg-mem, build 2026.1-rc1 |
| Component | Transfer service, ledger |
| Reproducibility | Always when the ledger insert was forced to fail |
| Requirement / case | REQ-TRF-08, REQ-DB-02 / TC-DB-001, TC-DB-002 |

**Preconditions**

- Fresh seeded database.
- A test harness that forces the ledger insert to fail after the balance updates
  (for example by injecting an invalid ledger row or a database error).

**Steps**

1. Submit a 125.50 USD transfer.
2. Force the ledger insert to fail after the debit and credit updates.
3. Query both balances and run the reconciliation and net-zero SQL.

**Expected**

The transfer fails as a whole: source and destination balances are unchanged and
no transfer or ledger rows remain.

**Actual**

The debit and credit updates were applied, the transfer row was inserted, and the
ledger insert failed. The account balances moved but no ledger pair existed, so
reconciliation drifted and the history could not explain the balance.

**Root cause**

The service performed several awaited statements. pg-mem's pg adapter executes each
statement in its own implicit transaction, so a `BEGIN`/`ROLLBACK` pair did not span
the operation. There was no compensating action on the error path.

**Fix**

- Added an `atomic()` helper that takes a pg-mem restore point before the write and
  restores it if any step throws.
- Serialised all money operations so no reader observes a partial transfer.
- Kept the production mapping explicit: real PostgreSQL would use a transaction
  with `SELECT ... FOR UPDATE` row locks.
- Added reconciliation and net-zero checks as release gates.

**Verification**

The database suite proves balanced transfers reconcile, deliberately unbalanced
fixtures are detected, and the API leaves no partial state on validation failures.
`npm run validate:db` reports 10 invariants and zero violations. Closed 2026-11-14.

## DEF-2026-003 - Rapid history switching can show stale entries

| Field | Value |
| --- | --- |
| Severity / priority | Low / P3 |
| Status | Open / Accepted for 2026.1 |
| Environment | Chromium, local app, throttled network |
| Component | Web UI, history panel |
| Reproducibility | Intermittent under artificial latency |
| Requirement / case | REQ-UI-01 / TC-E2E-001 |

**Preconditions**

- At least two accounts with transaction history.
- Browser DevTools network throttling or a delayed history response.

**Steps**

1. Open the dashboard and select account 1 in the history panel.
2. Quickly select account 2, then account 1 again.
3. Delay the first response so it arrives after the later selection.
4. Observe the history list and the selected account.

**Expected**

The list always matches the currently selected account; the newest selection wins.

**Actual**

An older in-flight response can render after the latest selection, leaving account
2 entries visible while account 1 is selected. Balances and the ledger are not
affected; only the displayed list is stale.

**Root cause**

`loadHistory()` does not abort or tag requests. It renders whichever response
resolves last, independent of the current selector value.

**Workaround**

Reselect the account or refresh the page. No financial data is changed.

**Proposed fix**

Use an `AbortController` and a monotonically increasing request token; ignore a
response whose token is not current. Add a Playwright case with `page.route` delay
to prove the race and prevent regression.

**Release decision**

Accepted for 2026.1 because the issue is cosmetic, has a trivial workaround and does
not affect balances or ledger integrity. Scheduled for the next UI hardening cycle;
tracked as P3. If the history panel becomes a regulated statement view, the priority
must be raised.

## Defect management notes

- Critical and High defects block release; Medium requires a workaround and owner
  acceptance; Low can be deferred with a documented decision.
- Every fix references a requirement and test case, and adds or updates a regression
  case where automation is practical.
- The defect template is in [`defect-report-template.md`](defect-report-template.md).
- Sensitive data is never placed in a defect; this lab uses synthetic accounts only.
