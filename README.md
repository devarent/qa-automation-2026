# Qa-Automation-2026
<sub><span style="opacity: 0.85">Digital-banking QA lab: Playwright E2E + API tests, SQL data-integrity checks, k6 load tests, CI reporting.</span></sub>
<div align="center" style="font-size: 0.9em">
<img src="assets/brand-logo.svg" alt="Arya Fatthurahman" width="130px" />
</div>

[![CI](https://github.com/devarent/qa-automation-2026/actions/workflows/ci.yml/badge.svg)](https://github.com/devarent/qa-automation-2026/actions/workflows/ci.yml)

---


<!-- identity-block -->
<div align="center">

# qa-automation-2026

<sub>Digital-banking QA lab: Playwright E2E + API tests, SQL data-integrity checks, k6 load tests, CI reporting.</sub>

</div>

## At a glance

| Field | Detail |
| --- | --- |
| Repository | qa-automation-2026 |
| Primary language | JavaScript |
| Topics | api-testing, ci-cd, github-actions, javascript, k6, nodejs, playwright, qa, sql, test-automation |
| License | MIT |
| Branch | main |
| Maintainer | [@devarent](https://github.com/devarent) |

## Overview

qa-automation-2026 is a hands-on repository focused on: Digital-banking QA lab: Playwright E2E + API tests, SQL data-integrity checks, k6 load tests, CI reporting.. Primary language: JavaScript. Topics: api-testing, ci-cd, github-actions, javascript, k6, nodejs, playwright, qa, sql, test-automation. The README below documents the project; use the table above for a quick overview.

### Global references

<div align="center">

🇮🇸 Iceland &middot; 🇳🇿 New Zealand &middot; 🇨🇭 Switzerland &middot; 🇸🇮 Slovenia &middot; 🇮🇪 Ireland &middot; 🇦🇹 Austria &middot; 🇵🇹 Portugal &middot; 🇸🇬 Singapore &middot; 🇫🇮 Finland

</div>

---

<!-- dbx-style-kit -->
<div align="center">

<img src="https://img.shields.io/badge/qa-automation-2026-1f6feb?style=for-the-badge" alt="qa-automation-2026" />
<img src="https://img.shields.io/badge/LANG%20JavaScript-3178c6?style=for-the-badge" alt="LANG JavaScript" />
<img src="https://img.shields.io/badge/STARS%200-eab308?style=for-the-badge" alt="STARS 0" />
<img src="https://img.shields.io/badge/LICENSE%20MIT-22c55e?style=for-the-badge" alt="LICENSE MIT" />

<br>

<img src="https://img.shields.io/badge/OPEN%20SOURCE-yes-22c55e?style=for-the-badge&logo=github&logoColor=white" alt="OPEN SOURCE" />
<img src="https://img.shields.io/badge/BUILT%20IN%20PUBLIC-true-6366f1?style=for-the-badge&logo=opensourceinitiative&logoColor=white" alt="BUILT IN PUBLIC" />
<img src="https://img.shields.io/badge/HANDS%20ON%20LABS-52-0ea5e9?style=for-the-badge&logo=docker&logoColor=white" alt="HANDS ON LABS" />
<img src="https://img.shields.io/badge/DOCUMENTED-yes-14b8a6?style=for-the-badge&logo=markdown&logoColor=white" alt="DOCUMENTED" />

<br>

<b>Digital-banking QA lab: Playwright E2E + API tests, SQL data-integrity checks, k6 load tests, CI reporting.</b>

</div>

---
# Digital Banking QA Automation Lab

![CI](https://img.shields.io/badge/CI-GitHub_Actions-2088FF?logo=githubactions&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-1.65-2EAD33?logo=playwright&logoColor=white)
![Node](https://img.shields.io/badge/Node.js-22%2B-339933?logo=node.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pg--mem-4169E1?logo=postgresql&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-yellow.svg)

A production-style QA portfolio project built around a small **digital banking**
system under test: customers, accounts, idempotent transfers and a double-entry
ledger. One repository demonstrates test strategy, API and UI automation, SQL
data-integrity validation, contract testing, performance testing and continuous
testing in GitHub Actions.

> This is a demo. It contains no real customer data, no authentication and no
> external services. All data is in memory and resets when the process restarts.

---

## Overview

The app is an Express 5 service backed by **pg-mem**, a pure-JavaScript PostgreSQL
implementation. The canonical PostgreSQL DDL and seed data live in `db/` and are
executed by both the runtime and the database validation suite, so there is no
Docker database to install for local testing.

Three seeded accounts cover the main scenarios:

| Account | Customer | Currency | Opening balance |
| --- | --- | --- | --- |
| `QA-1001-USD` | Alice Morgan | USD | 1,000.00 |
| `QA-1002-USD` | Ben Okafor | USD | 250.00 |
| `QA-1003-EUR` | Chloe Laurent | EUR | 500.00 |

The web UI at `/` shows account cards, a transfer form and a ledger history view.
Stable `data-testid` attributes keep E2E selectors readable and resilient.

### Core endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Service and database health |
| `GET` | `/api/accounts` | List accounts with balances |
| `GET` | `/api/accounts/:id` | Account detail |
| `POST` | `/api/transfers` | Idempotent, atomic account-to-account transfer |
| `GET` | `/api/transfers/:id` | Transfer detail |
| `GET` | `/api/accounts/:id/transactions` | Ledger entries with counterparty |
| `POST` | `/api/accounts` | Open an account (used by isolated E2E and load-test setup) |

### Business rules under test

- Amount must be greater than zero, have at most two decimals and not exceed 1,000,000.00.
- Source and destination must exist, be different and be `ACTIVE`.
- Source and destination must share the transfer currency (`USD`, `EUR`, `GBP`).
- The source must have sufficient available funds.
- A repeated idempotency key with an identical payload returns the original transfer
  and must not move money again; a different payload returns `409`.
- A completed transfer writes one `DEBIT` and one `CREDIT` ledger entry and updates
  both balances as one all-or-nothing operation.
- Errors use a stable envelope: `{ "error": { "code", "message", "details?", "requestId" } }`
  with `400`, `404`, `409`, `422` or `500` status codes.

The full contract is in [`openapi/banking-api.yaml`](openapi/banking-api.yaml).

---

## Test architecture

```mermaid
flowchart LR
  subgraph CI["GitHub Actions - Node 22"]
    DBJOB["Database integrity<br/>node:test + pg-mem"]
    APIJOB["API + contract<br/>Playwright request"]
    E2EJOB["End-to-end<br/>Chromium"]
    PERF["Performance<br/>k6 - manual only"]
    ART["Artifacts<br/>HTML - JUnit - traces"]
  end

  subgraph SUT["Digital banking app - Express 5"]
    UI["Web UI<br/>vanilla JS + data-testid"]
    REST["REST API<br/>validation + error envelope"]
    MONEY["Transfer service<br/>serialised money operations"]
  end

  subgraph DATA["Data layer"]
    SCHEMA["db/schema.sql<br/>constraints + indexes"]
    SEED["db/seed.sql"]
    PG[("pg-mem<br/>in-memory PostgreSQL")]
    QUERIES["db/queries/*.sql<br/>10 invariants"]
  end

  SPEC["OpenAPI 3.1<br/>banking-api.yaml"]

  DBJOB --> QUERIES
  QUERIES --> PG
  APIJOB --> REST
  APIJOB -. validates .-> SPEC
  E2EJOB --> UI
  UI --> REST
  REST --> MONEY
  MONEY --> PG
  SCHEMA --> PG
  SEED --> PG
  PERF --> REST
  APIJOB --> ART
  E2EJOB --> ART
  DBJOB --> ART
```

The API project starts a **fresh app and database per test** on an ephemeral port.
The E2E project uses the Playwright web server, but each test creates its own
account pair through the API, so tests are independent and can run in parallel.

---

## Coverage mapped to the QA job description

| Job requirement | How this repository demonstrates it | Evidence |
| --- | --- | --- |
| STLC / SDLC | Strategy, release plan, 36 test cases, traceability, defect workflow and release criteria | `docs/test-strategy.md`, `docs/test-plan.md`, `docs/test-cases.md`, `docs/requirements-traceability-matrix.md` |
| Test strategy, plans and cases | Risk-based strategy, entry/exit criteria, schedule, roles, risk matrix and detailed cases | `docs/` |
| Automation frameworks | Playwright with API and Chromium projects, custom fixtures, deterministic data helpers | `playwright.config.js`, `tests/fixtures/` |
| Functional, integration, system, E2E and regression | API, contract, database and browser suites that can run as a regression pack | `tests/api/`, `tests/e2e/`, `tests/db/` |
| Banking transaction flows and data integrity | Transfers, double-entry ledger, idempotency, reconciliation and orphan checks | `tests/api/transfers.spec.js`, `db/queries/`, `tests/db/integrity.test.js` |
| REST API validation | Positive, negative, boundary, concurrency and error-envelope assertions | `tests/api/transfers.spec.js` |
| SQL / database validation | PostgreSQL DDL, seed, constraints, indexes and 10 invariant queries | `db/`, `scripts/validate-db.js` |
| Defect management | Template plus three realistic defects with severity, root cause and verification | `docs/defect-report-template.md`, `docs/defect-log.md` |
| CI/CD continuous testing | Node 22 workflow, DB -> API -> E2E gates, artifacts, optional performance job | `.github/workflows/ci.yml`, `docs/ci-cd-testing.md` |
| Playwright / Cypress / Selenium | Playwright 1.65 with HTML/JUnit reporters, retries, traces and screenshots | `playwright.config.js` |
| Postman / REST Assured | Equivalent API coverage in Playwright request contexts; OpenAPI importable into Postman | `openapi/banking-api.yaml`, `docs/api-testing.md` |
| JMeter / k6 | k6 load profile with setup, custom success metric and p95/error-rate thresholds | `performance/k6/transfer-load.js`, `performance/README.md` |

---

## Repository map

```text
qa-automation-2026/
+-- app/                     Express API, banking service, web UI, Dockerfile
+-- db/                      PostgreSQL schema, seed and reusable validation SQL
+-- docs/                    Strategy, plan, cases, RTM, defects and test guides
+-- openapi/                 OpenAPI 3.1 contract
+-- performance/             k6 load test and interpretation guide
+-- scripts/                 Database validation runner
+-- tests/
|   +-- api/                 Playwright API and contract suites
|   +-- db/                  node:test database integrity suite
|   +-- e2e/                 Chromium end-to-end suite
|   +-- fixtures/            Isolated server, data and API helpers
+-- .github/workflows/ci.yml Continuous testing pipeline
+-- playwright.config.js
+-- package.json             npm workspace root
```

---

## Quickstart

Requirements: **Node.js 22+** and npm. No database or Docker is required for tests.

```bash
npm install
npx playwright install chromium
npm start
```

Open <http://127.0.0.1:3000>. In another terminal:

```bash
npm test
```

On Linux CI or a fresh machine, install browser dependencies with:

```bash
npx playwright install --with-deps chromium
```

### Test commands

| Command | What runs | Typical count |
| --- | --- | --- |
| `npm run test:db` | `node:test` + pg-mem integrity suite | 10 tests |
| `npm run test:api` | Playwright `api` project: accounts, health, transfers, OpenAPI contract | 30 tests |
| `npm run test:e2e` | Playwright `e2e` project: Chromium UI flows | 5 tests |
| `npm test` | DB -> API -> E2E, the same order as CI | 45 tests |
| `npm run validate:db` | Standalone SQL invariant runner with a demo transfer | 10 checks |
| `npm run report` | Opens the last Playwright HTML report | - |

Run a single project or test file:

```bash
npx playwright test --project=api
npx playwright test tests/api/transfers.spec.js --grep "idempotent"
npx playwright test --project=e2e --headed
```

The Playwright web server listens on `127.0.0.1:3100` by default. Override it with
`BASE_URL`, for example:

```bash
BASE_URL=http://127.0.0.1:3000 npm run test:e2e
```

On PowerShell: `$env:BASE_URL='http://127.0.0.1:3000'; npm run test:e2e`.

### Performance

```bash
npm start
k6 run performance/k6/transfer-load.js
```

See [`performance/README.md`](performance/README.md) for Docker usage, thresholds
and result interpretation. Performance is a manual CI job, not a pull-request gate.

---

## How to read the reports

After a Playwright run:

- **HTML report** - `playwright-report/index.html`, or `npm run report`.
- **JUnit XML** - `test-results/junit.xml`, suitable for CI dashboards.
- **Failure artifacts** - `test-results/artifacts/` contains traces on first retry,
  screenshots on failure and retained videos.
- **Console output** - the `list` reporter shows each test and failure diff.

A trace is the fastest way to debug an E2E failure:

```bash
npx playwright show-trace test-results/artifacts/<test-folder>/trace.zip
```

Database validation prints one line per invariant. Any `FAIL` line includes the
offending rows as JSON. The same queries are used by `tests/db/integrity.test.js`.

---

## Continuous integration

`.github/workflows/ci.yml` runs on push, pull request and manual dispatch:

1. Checkout, Node 22 with npm cache, `npm ci`.
2. Install Chromium with system dependencies.
3. `npm run test:db`.
4. `npm run test:api`.
5. `npm run test:e2e`.
6. Upload `playwright-report/` and `test-results/junit.xml` **always**.

The optional `performance` job only runs on `workflow_dispatch`. It starts the app,
waits for `/api/health`, runs k6 in Docker against the local service and uploads the
summary. No secrets, services or external databases are required.

See [`docs/ci-cd-testing.md`](docs/ci-cd-testing.md) for branch protection, flake
policy and extension notes.

---

## Docker

Build from the repository root so the Dockerfile can copy the workspace manifest,
app and database SQL:

```bash
docker build -f app/Dockerfile -t banking-qa-lab .
docker run --rm -p 3000:3000 banking-qa-lab
```

Then open <http://127.0.0.1:3000>. The image runs as the non-root `node` user and
has a container health check against `/api/health`.

> `app/.dockerignore` documents app-local build exclusions. The effective build
> context for the command above is the repository root, so the root `.dockerignore`
> is the one Docker applies.

---

## Design notes and caveats

- **Money is a decimal string** (`"125.50"`) in API responses. Requests accept a
  JSON number or a decimal string; the API normalises to cents before writing.
- **Atomicity without a real database transaction.** pg-mem's pg adapter executes
  each statement in its own implicit transaction, so `BEGIN`/`COMMIT` cannot span
  awaited statements. The app serialises all money operations and uses a pg-mem
  restore point to roll back partial writes. A production PostgreSQL implementation
  would use `BEGIN`, `SELECT ... FOR UPDATE` row locks and `COMMIT`; this trade-off
  is documented in [`docs/database-validation.md`](docs/database-validation.md).
- **Test isolation over shared state.** API tests each get a fresh server/database.
  E2E tests create dedicated account pairs through the API instead of mutating seed
  balances, so retries and parallel workers stay deterministic.
- **No authentication, rate limiting or PII.** The lab is intentionally narrow.
  Security testing is represented by input validation and error-envelope cases,
  not by a production auth model.
- **pg-mem is a test double.** The SQL is standard PostgreSQL and the schema is
  validated by constraints, but pg-mem is not a production database. The DB suite
  is designed to catch logical drift, not PostgreSQL planner behaviour.
- **k6 results are lab results.** Shared CI runners and the in-memory database make
  absolute numbers non-production; the thresholds prove the pipeline can enforce
  a performance budget.

---

## Documentation

| Document | Purpose |
| --- | --- |
| [`docs/test-strategy.md`](docs/test-strategy.md) | Scope, risks, levels, environments, entry/exit and defect workflow |
| [`docs/test-plan.md`](docs/test-plan.md) | Release 2026.1 schedule, roles, deliverables and risk matrix |
| [`docs/test-cases.md`](docs/test-cases.md) | 36 detailed cases with priority, type, automation and traceability |
| [`docs/requirements-traceability-matrix.md`](docs/requirements-traceability-matrix.md) | Requirement -> test -> automation mapping |
| [`docs/api-testing.md`](docs/api-testing.md) | API strategy, isolation, idempotency and error matrix |
| [`docs/database-validation.md`](docs/database-validation.md) | Schema, invariants, pg-mem trade-offs and production mapping |
| [`docs/ci-cd-testing.md`](docs/ci-cd-testing.md) | Pipeline stages, artifacts, flake policy and branch protection |
| [`docs/defect-report-template.md`](docs/defect-report-template.md) | Reusable defect report structure |
| [`docs/defect-log.md`](docs/defect-log.md) | Three sample defects with root cause and verification |

---

## License

MIT - see [`LICENSE`](LICENSE). The demo is provided for portfolio and educational
use and is not affiliated with any real bank.

---

<!-- tech-stack-wall -->
## Tech Stack

<div align="center">

<img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript" />
<img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
<img src="https://img.shields.io/badge/Playwright-2EAD33?style=for-the-badge&logo=playwright&logoColor=white" alt="Playwright" />
<img src="https://img.shields.io/badge/k6-7D64FF?style=for-the-badge&logo=k6&logoColor=white" alt="k6" />
<img src="https://img.shields.io/badge/GitHub%20Actions-2088FF?style=for-the-badge&logo=githubactions&logoColor=white" alt="GitHub Actions" />

</div>

<details>
<summary><b>Full Tech Stack Wall</b></summary>
<br>

<div align="center">

<b>Languages</b><br>
<img src="https://img.shields.io/badge/Rust-dea584?style=for-the-badge&logo=rust&logoColor=black" alt="Rust" />
<img src="https://img.shields.io/badge/Go-00ADD8?style=for-the-badge&logo=go&logoColor=white" alt="Go" />
<img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
<img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript" />
<img src="https://img.shields.io/badge/Java-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white" alt="Java" />
<img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
<img src="https://img.shields.io/badge/C-A8B9CC?style=for-the-badge&logo=c&logoColor=black" alt="C" />
<img src="https://img.shields.io/badge/C%2B%2B-00599C?style=for-the-badge&logo=cplusplus&logoColor=white" alt="C++" />
<img src="https://img.shields.io/badge/Kotlin-7F52FF?style=for-the-badge&logo=kotlin&logoColor=white" alt="Kotlin" />
<img src="https://img.shields.io/badge/Swift-F05138?style=for-the-badge&logo=swift&logoColor=white" alt="Swift" />
<img src="https://img.shields.io/badge/Ruby-CC342D?style=for-the-badge&logo=ruby&logoColor=white" alt="Ruby" />
<img src="https://img.shields.io/badge/PHP-777BB4?style=for-the-badge&logo=php&logoColor=white" alt="PHP" />
<img src="https://img.shields.io/badge/Lua-2C2D72?style=for-the-badge&logo=lua&logoColor=white" alt="Lua" />
<img src="https://img.shields.io/badge/Shell-4EAA25?style=for-the-badge&logo=gnubash&logoColor=white" alt="Shell" />
<br><br>
<b>Frontend &amp; Desktop</b><br>
<img src="https://img.shields.io/badge/Vue-4FC08D?style=for-the-badge&logo=vuedotjs&logoColor=black" alt="Vue" />
<img src="https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
<img src="https://img.shields.io/badge/Svelte-FF3E00?style=for-the-badge&logo=svelte&logoColor=white" alt="Svelte" />
<img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js" />
<img src="https://img.shields.io/badge/Nuxt-00DC82?style=for-the-badge&logo=nuxtdotjs&logoColor=black" alt="Nuxt" />
<img src="https://img.shields.io/badge/Flutter-02569B?style=for-the-badge&logo=flutter&logoColor=white" alt="Flutter" />
<img src="https://img.shields.io/badge/React%20Native-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React Native" />
<img src="https://img.shields.io/badge/Tauri-FFC131?style=for-the-badge&logo=tauri&logoColor=black" alt="Tauri" />
<img src="https://img.shields.io/badge/Electron-47848F?style=for-the-badge&logo=electron&logoColor=white" alt="Electron" />
<img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
<img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5" />
<img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3" />
<img src="https://img.shields.io/badge/Sass-CC6699?style=for-the-badge&logo=sass&logoColor=white" alt="Sass" />
<img src="https://img.shields.io/badge/Less-1D365D?style=for-the-badge&logo=less&logoColor=white" alt="Less" />
<img src="https://img.shields.io/badge/Tailwind%20CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
<img src="https://img.shields.io/badge/Bootstrap-7952B3?style=for-the-badge&logo=bootstrap&logoColor=white" alt="Bootstrap" />
<img src="https://img.shields.io/badge/Three.js-000000?style=for-the-badge&logo=threedotjs&logoColor=white" alt="Three.js" />
<img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
<img src="https://img.shields.io/badge/jQuery-0769AD?style=for-the-badge&logo=jquery&logoColor=white" alt="jQuery" />
<br><br>
<b>Database &amp; Storage</b><br>
<img src="https://img.shields.io/badge/MySQL-4479A1?style=for-the-badge&logo=mysql&logoColor=white" alt="MySQL" />
<img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
<img src="https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite" />
<img src="https://img.shields.io/badge/SQL%20Server-CC2927?style=for-the-badge&logo=microsoftsqlserver&logoColor=white" alt="SQL Server" />
<img src="https://img.shields.io/badge/Oracle-F80000?style=for-the-badge&logo=oracle&logoColor=white" alt="Oracle" />
<img src="https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis" />
<img src="https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
<img src="https://img.shields.io/badge/DuckDB-FFCB00?style=for-the-badge&logo=duckdb&logoColor=black" alt="DuckDB" />
<img src="https://img.shields.io/badge/ClickHouse-FFCC00?style=for-the-badge&logo=clickhouse&logoColor=black" alt="ClickHouse" />
<img src="https://img.shields.io/badge/Elasticsearch-005571?style=for-the-badge&logo=elasticsearch&logoColor=white" alt="Elasticsearch" />
<img src="https://img.shields.io/badge/Neo4j-008CC1?style=for-the-badge&logo=neo4j&logoColor=white" alt="Neo4j" />
<img src="https://img.shields.io/badge/InfluxDB-22ADF6?style=for-the-badge&logo=influxdb&logoColor=white" alt="InfluxDB" />
<img src="https://img.shields.io/badge/Cassandra-1287B1?style=for-the-badge&logo=apachecassandra&logoColor=white" alt="Cassandra" />
<img src="https://img.shields.io/badge/DynamoDB-4053D6?style=for-the-badge&logo=amazondynamodb&logoColor=white" alt="DynamoDB" />
<img src="https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black" alt="Firebase" />
<img src="https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=black" alt="Supabase" />
<img src="https://img.shields.io/badge/MinIO-C72E49?style=for-the-badge&logo=minio&logoColor=white" alt="MinIO" />
<img src="https://img.shields.io/badge/Firebird-FC521F?style=for-the-badge" alt="Firebird" />
<img src="https://img.shields.io/badge/IBM%20DB2-1F70C1?style=for-the-badge" alt="IBM DB2" />
<img src="https://img.shields.io/badge/MariaDB-003545?style=for-the-badge&logo=mariadb&logoColor=white" alt="MariaDB" />
<img src="https://img.shields.io/badge/CockroachDB-7B52C0?style=for-the-badge" alt="CockroachDB" />
<img src="https://img.shields.io/badge/IRIS-3B82F6?style=for-the-badge" alt="IRIS" />
<img src="https://img.shields.io/badge/Databricks%20SQL-FF3621?style=for-the-badge&logo=databricks&logoColor=white" alt="Databricks SQL" />
<img src="https://img.shields.io/badge/Snowflake-29B5E8?style=for-the-badge&logo=snowflake&logoColor=white" alt="Snowflake" />
<img src="https://img.shields.io/badge/Qdrant-DC244C?style=for-the-badge" alt="Qdrant" />
<img src="https://img.shields.io/badge/Redshift-8C4FFF?style=for-the-badge&logo=amazonredshift&logoColor=white" alt="Redshift" />
<img src="https://img.shields.io/badge/Apache%20Kylin-F59E0B?style=for-the-badge" alt="Apache Kylin" />
<img src="https://img.shields.io/badge/BigQuery-4285F4?style=for-the-badge&logo=googlebigquery&logoColor=white" alt="BigQuery" />
<img src="https://img.shields.io/badge/VictoriaMetrics-3483EB?style=for-the-badge" alt="VictoriaMetrics" />
<img src="https://img.shields.io/badge/Databend-4F46E5?style=for-the-badge" alt="Databend" />
<img src="https://img.shields.io/badge/TDengine-1B8FD4?style=for-the-badge" alt="TDengine" />
<img src="https://img.shields.io/badge/Teradata-0055A6?style=for-the-badge" alt="Teradata" />
<br><br>
<b>Messaging &amp; Streaming</b><br>
<img src="https://img.shields.io/badge/Kafka-231F20?style=for-the-badge&logo=apachekafka&logoColor=white" alt="Kafka" />
<img src="https://img.shields.io/badge/RabbitMQ-FF6600?style=for-the-badge&logo=rabbitmq&logoColor=white" alt="RabbitMQ" />
<img src="https://img.shields.io/badge/RocketMQ-FF6A00?style=for-the-badge&logoColor=white" alt="RocketMQ" />
<img src="https://img.shields.io/badge/Pulsar-188FFF?style=for-the-badge&logo=apachepulsar&logoColor=white" alt="Pulsar" />
<img src="https://img.shields.io/badge/Flink-E6526F?style=for-the-badge&logo=apacheflink&logoColor=white" alt="Flink" />
<br><br>
<b>DevOps &amp; Cloud Native</b><br>
<img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
<img src="https://img.shields.io/badge/Kubernetes-326CE5?style=for-the-badge&logo=kubernetes&logoColor=white" alt="Kubernetes" />
<img src="https://img.shields.io/badge/Terraform-7B42BC?style=for-the-badge&logo=terraform&logoColor=white" alt="Terraform" />
<img src="https://img.shields.io/badge/Ansible-EE0000?style=for-the-badge&logo=ansible&logoColor=white" alt="Ansible" />
<img src="https://img.shields.io/badge/Jenkins-D24939?style=for-the-badge&logo=jenkins&logoColor=white" alt="Jenkins" />
<img src="https://img.shields.io/badge/GitHub%20Actions-2088FF?style=for-the-badge&logo=githubactions&logoColor=white" alt="GitHub Actions" />
<img src="https://img.shields.io/badge/GitLab%20CI-FC6D26?style=for-the-badge&logo=gitlab&logoColor=white" alt="GitLab CI" />
<img src="https://img.shields.io/badge/Prometheus-E6522C?style=for-the-badge&logo=prometheus&logoColor=white" alt="Prometheus" />
<img src="https://img.shields.io/badge/Grafana-F46800?style=for-the-badge&logo=grafana&logoColor=white" alt="Grafana" />
<img src="https://img.shields.io/badge/Nginx-009639?style=for-the-badge&logo=nginx&logoColor=white" alt="Nginx" />
<img src="https://img.shields.io/badge/AWS-232F3E?style=for-the-badge&logo=amazonwebservices&logoColor=white" alt="AWS" />
<img src="https://img.shields.io/badge/Azure-0078D4?style=for-the-badge&logo=microsoftazure&logoColor=white" alt="Azure" />
<img src="https://img.shields.io/badge/Cloudflare-F38020?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Cloudflare" />
<br><br>
<b>Tools &amp; Platforms</b><br>
<img src="https://img.shields.io/badge/Git-F05032?style=for-the-badge&logo=git&logoColor=white" alt="Git" />
<img src="https://img.shields.io/badge/Linux-FCC624?style=for-the-badge&logo=linux&logoColor=black" alt="Linux" />
<img src="https://img.shields.io/badge/macOS-000000?style=for-the-badge&logo=apple&logoColor=white" alt="macOS" />
<img src="https://img.shields.io/badge/VS%20Code-007ACC?style=for-the-badge&logo=visualstudiocode&logoColor=white" alt="VS Code" />
<img src="https://img.shields.io/badge/Vim-019733?style=for-the-badge&logo=vim&logoColor=white" alt="Vim" />
<img src="https://img.shields.io/badge/Tmux-1BB91F?style=for-the-badge&logoColor=white" alt="Tmux" />
<img src="https://img.shields.io/badge/Homebrew-FAB316?style=for-the-badge&logo=homebrew&logoColor=black" alt="Homebrew" />
<img src="https://img.shields.io/badge/Postman-FF6C37?style=for-the-badge&logo=postman&logoColor=white" alt="Postman" />
<img src="https://img.shields.io/badge/Figma-F24E1E?style=for-the-badge&logo=figma&logoColor=white" alt="Figma" />
<img src="https://img.shields.io/badge/Markdown-000000?style=for-the-badge&logo=markdown&logoColor=white" alt="Markdown" />
<img src="https://img.shields.io/badge/Maven-C71A36?style=for-the-badge&logo=apachemaven&logoColor=white" alt="Maven" />
<img src="https://img.shields.io/badge/Gradle-02303A?style=for-the-badge&logo=gradle&logoColor=white" alt="Gradle" />
<img src="https://img.shields.io/badge/CMake-064F8C?style=for-the-badge&logo=cmake&logoColor=white" alt="CMake" />

</div>
</details>

<div align="center">
<sub>Hands-on engineering, built and documented in the open.</sub>
</div>