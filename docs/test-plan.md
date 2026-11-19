# Test Plan - Release 2026.1

| Field | Value |
| --- | --- |
| Release | Digital Banking QA Lab 2026.1 |
| Plan version | 1.0 |
| Owner | QA Engineer / Test Automation |
| Status | Approved |
| Test window | 2026-11-09 to 2026-11-20 |
| Release date | 2026-11-20 |
| Strategy | [`test-strategy.md`](test-strategy.md) |

## 1. Release scope

Release 2026.1 delivers the accounts, transfer and ledger slice of the digital
banking demo, plus the automated quality gates that will be reused for later
releases.

### Features in scope

| Feature | Description | Priority |
| --- | --- | --- |
| Account portfolio | List accounts, open an account, view detail and balance | P1 |
| Domestic transfer | Move USD between accounts with validation and idempotency | P1 |
| Ledger history | Debit/credit entries with counterparty and ordering | P1 |
| Error handling | Stable `400/404/409/422/500` envelopes with request ids | P1 |
| Customer UI | Account cards, transfer form, success/error feedback, history | P1 |
| Database integrity | Constraints, indexes and reconciliation invariants | P1 |
| Contract | OpenAPI 3.1 specification and schema validation | P2 |
| Performance baseline | k6 thresholds for transfer latency and errors | P2 |
| CI/CD | DB -> API -> E2E gates and artifact retention | P1 |

### Out of scope

Authentication, authorization, external payment rails, multi-currency FX,
statements, notifications, mobile clients, production PostgreSQL operations and
regulatory certification. These are not implied by a passing release.

## 2. Objectives and success criteria

1. Demonstrate a complete STLC for a banking money-movement feature.
2. Prevent duplicate debits, negative balances and ledger drift.
3. Prove the UI and API agree on balances and history.
4. Keep the full regression pack under ten minutes on a clean GitHub runner.
5. Leave behind reusable documentation, test data helpers and CI evidence.

The release is successful when all exit criteria in section 6 are met and the
release owner accepts the residual risks in section 8.

## 3. Schedule

| Phase | Dates (2026) | Activities | Output |
| --- | --- | --- | --- |
| Planning | Nov 9-10 | Scope, risk workshop, requirement IDs, entry criteria | Strategy, plan, RTM draft |
| Environment and data | Nov 11 | Workspace setup, schema/seed review, Playwright install, CI skeleton | Reproducible local and CI environment |
| Database automation | Nov 12 | Schema constraints, invariant queries, node:test suite, validation runner | `tests/db/`, `db/queries/`, `scripts/validate-db.js` |
| API automation | Nov 12-13 | Happy, negative, boundary, idempotency, concurrency and error-envelope cases | `tests/api/transfers.spec.js` |
| Contract | Nov 14 | OpenAPI 3.1 spec, Ajv validation, request/response examples | `openapi/banking-api.yaml`, `tests/api/contract.spec.js` |
| E2E automation | Nov 15-16 | Dashboard, success, insufficient funds, same account, currency mismatch | `tests/e2e/transfer.spec.js` |
| Performance | Nov 17 | k6 setup, stages, thresholds, result interpretation | `performance/` |
| Full regression and CI hardening | Nov 18 | Run all suites, fix flakes, upload artifacts, test workflow on clean runner | Green pipeline, reports |
| Release readiness | Nov 19 | Exit review, defect status, residual risk, documentation check | Signed release note |
| Release window | Nov 20 | Tag/package and publish the portfolio repository | Release 2026.1 |

Dates are the planned portfolio timeline. The automation can be re-run at any time;
the test evidence is the CI run, not the calendar.

## 4. Roles and responsibilities

| Activity | QA engineer | Developer | Reviewer / product owner | Release manager |
| --- | --- | --- | --- | --- |
| Strategy and plan | R / A | C | C | I |
| Test cases and RTM | R / A | C | C | I |
| API and DB automation | R / A | C | I | I |
| E2E automation | R / A | C | I | I |
| Defect triage | R | C | A for priority | I |
| CI pipeline | R / A | C | I | A |
| Release sign-off | C | C | A | R |

R = responsible, A = accountable, C = consulted, I = informed. One person may hold
multiple roles in the portfolio, but the decision rights stay explicit.

## 5. Deliverables

| Deliverable | Location | Acceptance |
| --- | --- | --- |
| System under test | `app/` | Starts with `npm start`; UI and six core endpoints work |
| PostgreSQL schema and seed | `db/schema.sql`, `db/seed.sql` | Applies to a fresh pg-mem database |
| Validation queries | `db/queries/` | Ten queries; zero violations on healthy data |
| DB integrity suite | `tests/db/integrity.test.js` | 10 passing tests |
| API and contract suites | `tests/api/` | 30 passing tests |
| E2E suite | `tests/e2e/transfer.spec.js` | 5 passing tests |
| OpenAPI contract | `openapi/banking-api.yaml` | Valid 3.1 document; schemas compile |
| Performance profile | `performance/k6/transfer-load.js` | Thresholds defined; manual CI job |
| Test documentation | `docs/` | Strategy, plan, 36 cases, RTM, defects, guides |
| CI pipeline | `.github/workflows/ci.yml` | Green on a clean GitHub runner; artifacts always |
| Governance | `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md` | Present and consistent with the repo |

## 6. Entry and exit criteria

### Entry

- Requirements and acceptance criteria reviewed; requirement IDs agreed.
- Schema, seed and OpenAPI spec available.
- Node 22+ and Chromium installed; `npm ci` reproducible from the lockfile.
- No open blocker in the app startup path.
- Test data strategy agreed: fresh DB for API tests, dedicated accounts for E2E.

### Exit

- `npm run test:db` passes 10/10.
- `npm run test:api` passes 30/30.
- `npm run test:e2e` passes 5/5.
- `npm run validate:db` reports 10 invariants and zero violations.
- No open Critical or High defects; no P1 case without a result.
- HTML and JUnit artifacts uploaded from the release run.
- Residual risks reviewed and accepted.

## 7. Test execution approach

| Cycle | Focus | Suites | Exit |
| --- | --- | --- | --- |
| Smoke | App starts, health, one transfer | API health + happy path | Green in under 2 minutes |
| Cycle 1 | Business rules and validation | DB + full API | No Critical/High open |
| Cycle 2 | Customer journey and regressions | API + E2E | All P1/P2 cases pass |
| Cycle 3 | Contract and release candidate | Contract + full regression | Zero schema errors, CI green |
| Performance | Baseline only, manual | k6 | Thresholds met or risk accepted |

Execution is automated first. Exploratory sessions are time-boxed and focus on
concurrency, rapid UI switching and error recovery, which are hard to enumerate in
scripted cases. Any finding is added to the defect log and, where practical, becomes
a regression test.

## 8. Risk matrix

Likelihood (L) and impact (I) use H/M/L. Score: HxH = 9, HxM = 6, MxM = 4, etc.
Response is avoid, mitigate, transfer or accept.

| ID | Risk | L | I | Score | Response | Owner | Trigger |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | Duplicate debit from concurrent idempotent requests | M | H | 6 | Mitigate: serialise lookup + write, unique key, concurrency test | QA/Dev | Any 200/201 mismatch or extra ledger row |
| R2 | Partial transfer leaves ledger unbalanced | L | H | 3 | Mitigate: all-or-nothing restore point, net-zero and reconciliation checks | Dev | Reconciliation failure |
| R3 | Balance boundary bypass | M | H | 6 | Mitigate: exact-balance and one-cent tests, DB check constraint | QA | Transfer succeeds with zero funds |
| R4 | Cross-currency transfer accepted | M | H | 6 | Mitigate: API and UI mismatch tests | QA | Wrong currency in response |
| R5 | History and balance disagree | M | H | 6 | Mitigate: history arithmetic test, SQL reconciliation | QA | Sum of entries != delta |
| R6 | OpenAPI drift | M | M | 4 | Mitigate: Ajv validation of real responses | QA | Schema error in contract suite |
| R7 | Stale UI after transfer | M | M | 4 | Mitigate: E2E polls balances and reloads | QA | Success toast with old balance |
| R8 | Order-dependent test data | H | M | 6 | Avoid: fresh DB per API test, dedicated E2E accounts | QA | A test passes alone but fails in suite |
| R9 | Flaky CI retries mask a defect | M | M | 4 | Mitigate: trace on first retry, flake review, retry count limited to 2 | QA | Same test retries repeatedly |
| R10 | pg-mem differs from PostgreSQL | H | M | 6 | Accept + document; validate standard DDL and constraints | QA/Dev | Production-only SQL failure |

The top three risks (R1, R3, R4) are covered by dedicated automated cases and are
reviewed at every release readiness meeting.

## 9. Environments and configuration

| Item | Value |
| --- | --- |
| Node | 22 LTS or newer |
| App port (manual) | 3000 |
| Playwright web server | 3100 |
| Database | pg-mem, schema + seed from `db/` |
| Browser | Chromium bundled with Playwright |
| CI | `ubuntu-latest`, Node 22, `npm ci`, Chromium with deps |
| Secrets | None |
| Reports | `playwright-report/`, `test-results/junit.xml`, k6 `summary.json` |

## 10. Suspension, resumption and change control

Suspend the cycle if the app cannot start, the database cannot be seeded, or more
than 20% of a suite fails for an environmental reason. Record the incident, restore
the environment and resume only after a smoke transfer passes.

Changes after plan approval follow this rule:

1. Update the requirement and OpenAPI spec.
2. Add or update at least one happy path and one negative test.
3. Update the RTM, test cases and risk matrix.
4. Run the full regression pack before merging.

## 11. Status reporting and approvals

A release status note is produced after each cycle with: suites executed, pass/fail
counts, defect counts by severity, flaky tests, performance result and open risks.

| Role | Name | Decision | Date |
| --- | --- | --- | --- |
| QA engineer | QA Automation Lab | Recommend release | 2026-11-19 |
| Reviewer / product owner | Portfolio reviewer | Accept residual risk | 2026-11-19 |
| Release manager | Repository owner | Approve release | 2026-11-20 |

Approval is a portfolio exercise; no production deployment is performed by this
repository.
