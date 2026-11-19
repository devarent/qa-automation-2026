# Test Strategy - Digital Banking QA Lab

| Field | Value |
| --- | --- |
| Document owner | QA Engineer (test automation) |
| Version | 1.0 |
| Status | Approved for Release 2026.1 |
| Last updated | 2026-11-19 |
| System under test | Digital Banking QA Lab (Express 5 + pg-mem) |
| Related plan | [`test-plan.md`](test-plan.md) |

## 1. Purpose

This strategy defines how quality is engineered into the accounts, transfers and
ledger domain. It is deliberately risk-based: the highest effort goes to money
movement, duplicate prevention and ledger integrity, because those failures would
be material in a real bank.

The strategy is implemented by a layered automation portfolio rather than a single
UI suite:

- PostgreSQL schema and constraint tests against the same SQL used by the runtime.
- API integration tests with a fresh database per test.
- OpenAPI contract checks that detect response drift.
- Chromium end-to-end tests for the customer-visible transfer journey.
- A k6 load profile with enforceable latency and error thresholds.

## 2. Scope

### In scope

| Area | Coverage |
| --- | --- |
| Accounts | Listing, detail, opening an account, seeded balances, 404 behaviour |
| Transfers | Happy path, validation, insufficient funds, same account, currency rules, unknown accounts |
| Idempotency | Replay, concurrent replay, key reuse with a different payload |
| Ledger | One debit and one credit per transfer, net-zero, reconciliation, orphans, pairing |
| History | Ordering, counterparty, debit/credit direction, balance consistency |
| Contract | OpenAPI 3.1 paths, schemas, status codes, error envelope |
| UI | Dashboard rendering, successful transfer, three error paths |
| Non-functional | p95 latency, HTTP error rate and domain success rate under load |
| Continuous testing | DB -> API -> E2E gates, reports and artifacts in GitHub Actions |

### Out of scope

- Real authentication, authorization, MFA, session management and fraud scoring.
- Real payment rails, clearing, settlement, interest, fees and statements.
- Production PostgreSQL performance, replication, backups and disaster recovery.
- PCI DSS, GDPR or other regulatory certification.
- Mobile native clients, screen-reader certification and cross-browser matrices.
- Penetration testing and infrastructure security.

These are recorded as assumptions and future work, not as untested claims.

## 3. Quality objectives

| Objective | Measure | Target |
| --- | --- | --- |
| Correct money movement | API and DB assertions for balance and ledger deltas | 100% of automated cases pass |
| No duplicate debit | Idempotency replay and concurrency tests | One debit per key, always |
| Ledger integrity | Ten invariant queries | Zero violations |
| Contract stability | OpenAPI schema validation on real responses | Zero schema errors |
| Customer-visible confidence | Chromium E2E for success and error flows | 100% pass in CI |
| Performance budget | k6 p95 and error rate | p95 < 500 ms, errors < 1% |
| Fast feedback | CI wall-clock target | Under 10 minutes on a clean runner |

## 4. Risk-based approach

Likelihood and impact are rated High / Medium / Low. The test depth follows the
score, not the number of screens.

| ID | Risk | Likelihood | Impact | Mitigation and evidence |
| --- | --- | --- | --- | --- |
| R1 | Concurrent duplicate requests debit an account twice | Medium | High | Serialised idempotency lookup + unique key constraint; replay and six-way concurrency tests |
| R2 | Debit succeeds but credit or ledger insert fails | Low | High | All-or-nothing restore point in the service; reconciliation and net-zero queries |
| R3 | Insufficient-funds check bypassed at a boundary | Medium | High | Exact-balance test then a one-cent rejection; DB `balance >= 0` check |
| R4 | Cross-currency transfer corrupts balances | Medium | High | Currency mismatch and unsupported-currency tests at API and UI |
| R5 | History disagrees with the account balance | Medium | High | History-to-balance reconciliation test and SQL reconciliation query |
| R6 | Contract drifts from implementation | Medium | Medium | OpenAPI schema validation of success and error responses |
| R7 | UI reports success while balances are stale | Medium | Medium | E2E polls balances and reloads the page; UI refreshes accounts before history |
| R8 | Test data collisions make the suite order-dependent | High | Medium | Fresh DB per API test; dedicated account pair per E2E test; unique keys |
| R9 | Flaky CI retries hide a real defect | Medium | Medium | One worker retry policy, traces on first retry, flake review, no blind retries locally |
| R10 | pg-mem behaviour diverges from PostgreSQL | High | Medium | Standard DDL, constraint tests, documented production transaction mapping |

## 5. Test levels and types

| Level | Purpose | Implementation |
| --- | --- | --- |
| Static / contract | Detect schema and contract drift before runtime | OpenAPI 3.1 review, Ajv schema compilation, `tests/api/contract.spec.js` |
| Database integration | Prove constraints and invariants hold | `node:test` + pg-mem, `tests/db/integrity.test.js`, `db/queries/` |
| API integration | Validate business rules, status codes and envelopes | Playwright request context, fresh app per test, `tests/api/transfers.spec.js` |
| System / E2E | Validate the customer journey through the real UI and API | Chromium, `tests/e2e/transfer.spec.js` |
| Regression | Re-run the whole pack before release | `npm test` in the same order as CI |
| Performance | Validate a latency/error budget under load | k6 stages, thresholds and summary |
| Exploratory | Probe races, usability and unscripted combinations | Time-boxed sessions; findings become cases or defects |

Functional, negative, boundary, concurrency, integration and data-integrity
techniques are applied at the levels where they are cheapest and most reliable.
For example, boundary amounts are covered at API level rather than through repeated
browser submissions.

## 6. Environments and test data

| Environment | Purpose | Database | Notes |
| --- | --- | --- | --- |
| Local development | Manual exploration and UI work | pg-mem, seeded | `npm start`, port 3000 |
| Local automated | API, E2E, DB suites | pg-mem, fresh per API test | Playwright web server on port 3100 |
| CI | Release gate | pg-mem, fresh per run/test | Ubuntu, Node 22, Chromium with deps |
| Docker | Packaging smoke check | pg-mem | Non-root image, health check |
| Performance | Manual load profile | pg-mem | `workflow_dispatch` only |

**Data rules**

- Seed data is deterministic: three accounts, two USD and one EUR.
- API tests never share a database; each test starts an isolated server.
- E2E tests create a dedicated account pair through `POST /api/accounts` and never
  mutate the seeded accounts used by the dashboard test.
- Idempotency keys are generated with a timestamp and UUID; no fixed keys are reused
  across tests.
- No production or personal data is used. Emails are `example.com` addresses.
- Database tests create their own transfers and ledger entries; each test closes its
  database.

## 7. Entry and exit criteria

### Entry criteria

- Node 22+ and dependencies installed; Chromium available for E2E.
- Schema and seed SQL apply cleanly to a fresh pg-mem database.
- OpenAPI spec parses and compiles.
- No known blocker or critical defect without an approved waiver.
- CI workflow and test commands are available on the release branch.

### Exit criteria

- `npm run test:db`, `npm run test:api` and `npm run test:e2e` pass.
- 100% of Priority 1 and Priority 2 cases pass; no open Critical or High defects.
- Database validation reports zero violations for the demo transfer.
- Contract tests pass against the running API.
- E2E success and error journeys pass in Chromium.
- Reports and JUnit XML are uploaded as CI artifacts.
- Residual risks are documented and accepted by the release owner.

### Suspension and resumption

Suspend execution if the app cannot start, the database cannot be seeded, or more
than 20% of a suite fails for an environmental reason. Resume after the environment
is restored and a smoke check (`/api/health` plus one transfer) passes.

## 8. Defect management

### Workflow

```text
New -> Triaged -> Assigned -> In Progress -> Fixed -> Ready for Retest -> Closed
                                  ?                         |
                                  +---- Reopened <-----------?
```

### Severity

| Severity | Definition | Example |
| --- | --- | --- |
| Critical | Money loss, duplicate debit, data corruption or total outage | Idempotent request debits twice |
| High | Major business rule broken, no workaround | Transfer succeeds with insufficient funds |
| Medium | Incorrect but contained behaviour with a workaround | Stale history after rapid account switching |
| Low | Cosmetic, minor usability or documentation issue | Error text alignment |

### Priority

- **P0** - fix immediately; release blocked.
- **P1** - fix in the current release.
- **P2** - fix if capacity allows; otherwise schedule.
- **P3** - backlog.

Every defect must include environment, build, steps, expected/actual, evidence,
requirement/test-case traceability and regression scope. The template is in
[`defect-report-template.md`](defect-report-template.md); worked examples are in
[`defect-log.md`](defect-log.md).

## 9. Metrics and reporting

| Metric | Definition | Target |
| --- | --- | --- |
| Execution pass rate | Passed / executed automated tests | 100% on the release branch |
| Automation coverage | Automated cases / total designed cases | >= 90% |
| Requirement coverage | Requirements with at least one mapped test | 100% |
| Defect leakage | Defects found after exit / total defects | 0 for Critical/High |
| Flake rate | Tests needing a retry without a product change | < 2% |
| Mean time to feedback | CI start to artifact upload | < 10 minutes |
| Performance | k6 p95 and error rate | Within thresholds |

Reports are produced per run: Playwright HTML + JUnit, node:test console output,
database validation console output and an optional k6 JSON summary.

## 10. Roles and responsibilities

| Role | Responsibility |
| --- | --- |
| QA engineer / automation owner | Strategy, cases, automation, execution, defect triage, release report |
| Developer | Fixes, unit-level checks, review of testability and failure injection |
| Product owner / reviewer | Risk acceptance, priority calls, exit sign-off |
| Release manager | Pipeline, branch protection, artifact retention, deployment decision |

In this portfolio the same person may hold several roles; the responsibilities are
still separated in the documents so the process is auditable.

## 11. Tools

| Tool | Use |
| --- | --- |
| Node.js 22 + npm | Runtime and workspace management |
| Express 5 | System under test |
| pg-mem | In-memory PostgreSQL for runtime and DB tests |
| Playwright 1.65 | API request contexts, Chromium E2E, HTML/JUnit/trace artifacts |
| Ajv 2020 | OpenAPI 3.1 schema validation |
| node:test | Database integrity suite |
| k6 | Load profile and thresholds |
| GitHub Actions | Continuous testing, artifacts, optional performance job |
| Docker | Packaging and optional k6 execution |

## 12. Assumptions, constraints and change control

- The lab is a single-process demo; horizontal scaling and distributed idempotency
  are out of scope but the unique constraint is the production backstop.
- pg-mem does not provide persistent multi-statement transactions through its pg
  adapter. The service uses serialisation and restore points; the production mapping
  is documented in [`database-validation.md`](database-validation.md).
- Test counts and thresholds are reviewed when a requirement or endpoint changes.
- Any new endpoint requires: OpenAPI update, at least one happy path, one negative
  case, contract validation and traceability updates.
- Changes to the schema require: migration note, seed update, invariant review and
  DB suite update.
