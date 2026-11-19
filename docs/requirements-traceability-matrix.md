# Requirements Traceability Matrix - Release 2026.1

Every requirement is mapped to at least one designed test case and to executable
evidence. The matrix is the release audit trail: if a requirement changes, this file
and the affected cases must change with it.

## 1. Requirements and coverage

| ID | Requirement | Priority | Test cases | Automation evidence | Status |
| --- | --- | --- | --- | --- | --- |
| REQ-ACC-01 | The API lists all accounts with customer, currency, opening balance and current balance in ascending id order. | P1 | TC-ACC-001, TC-E2E-001 | `tests/api/transfers.spec.js`, `tests/e2e/transfer.spec.js` | Covered |
| REQ-ACC-02 | The API returns one account by id and returns a stable 404 for an unknown account. | P1 | TC-ACC-002, TC-ACC-003 | `tests/api/transfers.spec.js` | Covered |
| REQ-ACC-03 | A customer account can be opened with a valid name, email, currency and opening balance; invalid input is rejected. | P1 | TC-ACC-004, TC-ACC-005 | `tests/api/transfers.spec.js` | Covered |
| REQ-TRF-01 | A valid same-currency transfer moves the amount from source to destination and returns the completed transfer. | P1 | TC-TRF-001, TC-TRF-002, TC-E2E-002 | `tests/api/transfers.spec.js`, `tests/e2e/transfer.spec.js` | Covered |
| REQ-TRF-02 | Transfer input is validated for required fields, positive amount, two decimals and the 1,000,000.00 maximum. | P1 | TC-TRF-004, TC-TRF-014 | `tests/api/transfers.spec.js` | Covered |
| REQ-TRF-03 | A transfer is rejected when the source has insufficient funds, including the exact-balance boundary. | P1 | TC-TRF-003, TC-TRF-012, TC-E2E-003 | `tests/api/transfers.spec.js`, `tests/e2e/transfer.spec.js` | Covered |
| REQ-TRF-04 | Source and destination must be different accounts. | P1 | TC-TRF-005, TC-E2E-004 | `tests/api/transfers.spec.js`, `tests/e2e/transfer.spec.js` | Covered |
| REQ-TRF-05 | Source, destination and request currencies must match and be supported. | P1 | TC-TRF-007, TC-TRF-008, TC-E2E-005 | `tests/api/transfers.spec.js`, `tests/e2e/transfer.spec.js` | Covered |
| REQ-TRF-06 | Repeating an idempotency key with the same payload returns the original transfer and does not move money twice, including concurrent requests. | P1 | TC-TRF-009, TC-TRF-010 | `tests/api/transfers.spec.js` | Covered |
| REQ-TRF-07 | Reusing an idempotency key with a different payload is rejected with 409. | P1 | TC-TRF-011 | `tests/api/transfers.spec.js` | Covered |
| REQ-TRF-08 | A completed transfer writes exactly one DEBIT and one CREDIT and updates both balances atomically. | P1 | TC-TRF-001, TC-TRF-013, TC-DB-001, TC-DB-002 | `tests/api/transfers.spec.js`, `tests/db/integrity.test.js` | Covered |
| REQ-TRF-09 | Account history returns debit/credit entries newest first with amount, currency and counterparty. | P1 | TC-TRF-013, TC-E2E-002 | `tests/api/transfers.spec.js`, `tests/e2e/transfer.spec.js` | Covered |
| REQ-TRF-10 | Unknown accounts and transfers return stable 404 envelopes; malformed identifiers return 400. | P1 | TC-TRF-002, TC-TRF-006, TC-TRF-016 | `tests/api/transfers.spec.js` | Covered |
| REQ-API-01 | The API is described by a complete OpenAPI 3.1 contract and responses validate against it. | P1 | TC-API-001, TC-API-002 | `tests/api/contract.spec.js`, `openapi/banking-api.yaml` | Covered |
| REQ-API-02 | Errors use one envelope with `code`, `message`, optional `details` and `requestId`, and the correct 400/404/409/422/500 status. | P1 | TC-ACC-003, TC-ACC-005, TC-TRF-015, TC-API-002 | `tests/api/transfers.spec.js`, `tests/api/contract.spec.js` | Covered |
| REQ-DB-01 | The schema enforces positive amounts, valid currencies, valid statuses, foreign keys and non-negative balances. | P1 | TC-DB-003, TC-DB-004 | `tests/db/integrity.test.js`, `db/schema.sql` | Covered |
| REQ-DB-02 | Ledger debits and credits net to zero per transfer and every transfer has one entry per side. | P1 | TC-DB-001 | `tests/db/integrity.test.js`, `db/queries/ledger-net-zero.sql` | Covered |
| REQ-DB-03 | Each account balance equals opening balance plus credits minus debits. | P1 | TC-DB-002, TC-TRF-013 | `tests/db/integrity.test.js`, `db/queries/account-balance-reconciliation.sql` | Covered |
| REQ-DB-04 | No orphan ledger entries, duplicate idempotency keys or invalid ledger rows exist. | P1 | TC-DB-003, TC-DB-004 | `tests/db/integrity.test.js`, `db/queries/` | Covered |
| REQ-UI-01 | The dashboard shows accounts, balances, a transfer form, API status and history, and remains usable at mobile and desktop widths. | P1 | TC-E2E-001, TC-UI-001, TC-UI-002 | `tests/e2e/transfer.spec.js`; two manual exploratory cases | Covered (2 manual) |
| REQ-UI-02 | A successful UI transfer shows a success message, refreshes balances and displays the ledger entry. | P1 | TC-E2E-002 | `tests/e2e/transfer.spec.js` | Covered |
| REQ-UI-03 | UI error paths show the domain error and leave balances unchanged. | P1 | TC-E2E-003, TC-E2E-004, TC-E2E-005 | `tests/e2e/transfer.spec.js` | Covered |
| REQ-NFR-01 | The transfer path meets the p95 latency, error-rate and domain-success thresholds under the k6 profile. | P2 | TC-NFR-001 | `performance/k6/transfer-load.js` | Covered (manual workflow) |
| REQ-NFR-02 | The complete regression pack runs on a clean Node 22 runner and publishes reports. | P1 | TC-REG-001 | `.github/workflows/ci.yml`, `npm test` | Covered |

## 2. Coverage summary

| Metric | Result |
| --- | --- |
| Requirements | 24 |
| Requirements with at least one test case | 24 (100%) |
| Designed test cases | 36 |
| Automated cases | 34 (94.4%) |
| Manual cases | 2 (5.6%) |
| P1 cases | 25 |
| P2 cases | 9 |
| P3 cases | 2 |
| Open Critical / High defects | 0 |
| Open Medium / Low defects | 1 (DEF-2026-003, P3, accepted) |

## 3. Test case index

| Test case | Requirement(s) |
| --- | --- |
| TC-ACC-001 | REQ-ACC-01 |
| TC-ACC-002 | REQ-ACC-02 |
| TC-ACC-003 | REQ-ACC-02, REQ-API-02 |
| TC-ACC-004 | REQ-ACC-03 |
| TC-ACC-005 | REQ-ACC-03, REQ-API-02 |
| TC-TRF-001 | REQ-TRF-01, REQ-TRF-08 |
| TC-TRF-002 | REQ-TRF-01, REQ-TRF-10 |
| TC-TRF-003 | REQ-TRF-03 |
| TC-TRF-004 | REQ-TRF-02 |
| TC-TRF-005 | REQ-TRF-04 |
| TC-TRF-006 | REQ-TRF-10 |
| TC-TRF-007 | REQ-TRF-05 |
| TC-TRF-008 | REQ-TRF-05 |
| TC-TRF-009 | REQ-TRF-06 |
| TC-TRF-010 | REQ-TRF-06 |
| TC-TRF-011 | REQ-TRF-07 |
| TC-TRF-012 | REQ-TRF-03 |
| TC-TRF-013 | REQ-TRF-08, REQ-TRF-09, REQ-DB-03 |
| TC-TRF-014 | REQ-TRF-02, REQ-API-02 |
| TC-TRF-015 | REQ-API-02 |
| TC-TRF-016 | REQ-TRF-10 |
| TC-E2E-001 | REQ-ACC-01, REQ-UI-01 |
| TC-E2E-002 | REQ-TRF-01, REQ-TRF-09, REQ-UI-02 |
| TC-E2E-003 | REQ-TRF-03, REQ-UI-03 |
| TC-E2E-004 | REQ-TRF-04, REQ-UI-03 |
| TC-E2E-005 | REQ-TRF-05, REQ-UI-03 |
| TC-DB-001 | REQ-TRF-08, REQ-DB-02 |
| TC-DB-002 | REQ-TRF-08, REQ-DB-03 |
| TC-DB-003 | REQ-DB-01, REQ-DB-04 |
| TC-DB-004 | REQ-DB-01, REQ-DB-04 |
| TC-API-001 | REQ-API-01 |
| TC-API-002 | REQ-API-01, REQ-API-02 |
| TC-NFR-001 | REQ-NFR-01 |
| TC-UI-001 | REQ-UI-01 |
| TC-UI-002 | REQ-UI-01 |
| TC-REG-001 | REQ-NFR-02 |

## 4. Traceability rules

1. A new requirement needs at least one happy-path case and one negative or
   boundary case where the risk warrants it.
2. A new endpoint needs an OpenAPI entry, contract validation and at least one API
   case; if it has a UI, an E2E case is added.
3. A schema change needs an invariant review, a DB case and a seed review.
4. A defect fix must reference the requirement and case; the regression case is
   added or updated before closure.
5. Manual cases are acceptable only when automation would be disproportionate
   (responsive and accessibility exploration). They are never counted as automated
   coverage.

## 5. Verification commands

```bash
npm run test:db
npm run test:api
npm run test:e2e
npm test
npm run validate:db
```

The release evidence is the green CI run plus the uploaded Playwright HTML/JUnit
artifacts. See [`ci-cd-testing.md`](ci-cd-testing.md) for the pipeline details.
