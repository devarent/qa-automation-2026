# Contributing

This repository is a QA automation portfolio, but it follows the same contribution
rules as a small production project. The goal is to keep the evidence trustworthy:
green tests must mean something.

## Getting started

```bash
npm install
npx playwright install chromium
npm test
```

Requirements: Node.js 22+ and npm. No database server or Docker is required for the
test suites.

## Workflow

1. Create a branch with a descriptive name (`test/transfer-boundaries`,
   `fix/idempotency-replay`).
2. Make the smallest change that solves the problem.
3. Run the affected suite, then the full pack before opening a pull request.
4. Update documentation and traceability when behaviour or coverage changes.
5. Open a pull request with a short description, commands run and results.

## Definition of done

- `npm run test:db`, `npm run test:api` and `npm run test:e2e` pass locally.
- New behaviour has a happy path and at least one negative or boundary test.
- API changes update `openapi/banking-api.yaml` and the contract suite.
- Schema changes update `db/schema.sql`, `db/seed.sql` if needed, the relevant
  `db/queries/` files, the manifest and `tests/db/integrity.test.js`.
- Test cases and the RTM are updated for new or changed requirements.
- No secrets, credentials, real customer data or personal information.
- No `test.only`, no committed `node_modules`, no generated reports.

## Test conventions

- One behaviour per test; use `test.step` for related variants.
- Assert the domain result, not only the status code. A `201` with the wrong balance
  is a failure.
- A negative test must prove that no side effect occurred.
- Do not use fixed sleeps. Use Playwright auto-waiting and `expect.poll`.
- Generate unique idempotency keys; never reuse a fixed key across tests.
- Keep API tests isolated with the per-test server fixture.
- E2E tests create their own accounts; do not mutate seed balances.
- Money is asserted as a two-decimal string in API responses.

## Adding a validation query

1. Add a read-only SQL file under `db/queries/` that returns zero rows when healthy.
2. Register it in `db/queries/manifest.js`.
3. Add healthy and deliberately broken fixtures to `tests/db/integrity.test.js`.
4. Run `npm run test:db` and `npm run validate:db`.
5. Update `docs/database-validation.md` and, if relevant, the RTM.

## Adding a test case

1. Assign the next id in the right family (`TC-ACC`, `TC-TRF`, `TC-E2E`, `TC-DB`,
   `TC-API`, `TC-NFR`, `TC-UI`, `TC-REG`).
2. Add the row to `docs/test-cases.md` with priority, type and requirement.
3. Add the requirement mapping to `docs/requirements-traceability-matrix.md`.
4. Implement the automation and reference the file in the case row.
5. If the case is manual, say why automation is disproportionate.

## Defects

Use [`docs/defect-report-template.md`](docs/defect-report-template.md). A defect needs
reproduction steps, expected/actual, evidence and requirement/test-case links. Fixes
must add or update a regression test where automation is practical.

## Commit style

Short imperative subject, optional body explaining why:

```text
Add exact-balance transfer boundary test

Covers REQ-TRF-03. Proves 250.00 succeeds and 0.01 is rejected with
INSUFFICIENT_FUNDS and no ledger entry.
```

## Code style

- CommonJS in `app/`, `scripts/` and `tests/` for consistency with the runtime.
- 2-space indentation, single quotes, semicolons, trailing commas in multiline
  literals (see `.editorconfig`).
- No new runtime dependency without a reason; prefer the standard library and the
  existing toolchain.
- Keep error envelopes stable; clients depend on `code`, `message` and `requestId`.

## Reporting security issues

Do not open a public issue for a security problem. See [`SECURITY.md`](SECURITY.md).
