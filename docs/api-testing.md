# API Testing Guide

The API is the primary integration surface: the browser, the load test and any future
mobile client all depend on the same transfer rules. API tests therefore carry most
of the business-rule coverage, while the E2E suite proves the customer journey.

## 1. Approach

| Layer | Question answered | Implementation |
| --- | --- | --- |
| Contract | Does the documented shape match reality? | Ajv validation of real responses against OpenAPI 3.1 |
| Functional API | Do the banking rules hold? | Playwright request contexts with status/body assertions |
| Data integrity | Do balances and ledger entries agree? | History arithmetic plus SQL invariant suite |
| Concurrency | Does idempotency survive parallel requests? | Six simultaneous POSTs with one key |
| Regression | Did a change break a previously working rule? | `npm run test:api` in CI |

Tests assert the **domain** result, not only the HTTP status. A `201` with the wrong
amount, a missing ledger pair or an unchanged balance is a failure.

## 2. Isolation and determinism

`tests/fixtures/banking-app.js` extends the Playwright test fixture:

1. Start an Express app on an ephemeral port.
2. Apply `db/schema.sql` and `db/seed.sql` to a new pg-mem database.
3. Create a Playwright API request context pointed at that server.
4. Dispose the context, close the server and close the database after the test.

This gives every test the same starting balances:

| Account | Currency | Balance |
| --- | --- | --- |
| 1 | USD | 1,000.00 |
| 2 | USD | 250.00 |
| 3 | EUR | 500.00 |

No test depends on another test's transfers, and no cleanup endpoint is needed.
E2E tests use a different strategy: they create dedicated account pairs through
`POST /api/accounts`, leaving the seed accounts untouched.

## 3. Coverage matrix

| Scenario | Assertion highlights | Test |
| --- | --- | --- |
| Health and seed | Service metadata, three accounts, exact balances | `health check and seeded accounts are available` |
| Happy path | 201, UUID, Location, balances, debit and credit | `completes a transfer atomically...` |
| Insufficient funds | 422, details, unchanged balances, empty history | `rejects insufficient funds...` |
| Invalid amounts | 0, negative, 3 decimals, text, null, max, minimum | `rejects invalid and out-of-boundary amounts...` |
| Same account | 400 `SAME_ACCOUNT`, no side effects | `rejects a transfer to the same account` |
| Idempotent replay | 201 then 200, replay header, same id, one debit | `replays an idempotent request...` |
| Concurrent replay | One 201, five 200, one id, one ledger pair | `serialises concurrent requests...` |
| Key conflict | 409, original replay still works | `rejects reuse of an idempotency key...` |
| Unknown accounts | 404 with the offending field | `returns 404 for unknown source...` |
| Currency rules | 422 mismatch, 400 unsupported currency | `enforces supported currencies...` |
| History consistency | Newest-first, debit/credit, arithmetic to balance | `keeps history and balances consistent...` |
| Exact balance | 250.00 succeeds, 0.01 rejected | `allows the exact available balance...` |
| Required fields | 400 with `details.field` | `validates required transfer fields...` |
| Unknown resources | 400/404 envelopes and route-not-found | `returns consistent 400/404 envelopes...` |
| Account opening | 201, location, reuse customer, invalid balance | `opens new accounts...` |
| Contract | All success and error schemas | `tests/api/contract.spec.js` |

## 4. Idempotency rules

`POST /api/transfers` requires a client-generated `idempotencyKey`.

| Situation | Result |
| --- | --- |
| First request with key K and payload P | `201`, transfer created, balances moved once |
| Replay K + P, including numeric amount or lowercase currency | `200`, `Idempotent-Replayed: true`, original body, no movement |
| K + different payload | `409 IDEMPOTENCY_CONFLICT`, original unchanged |
| Concurrent K + P | One `201`, remaining requests replay the same transfer |

The API normalises amount to a two-decimal string and currency to uppercase before
comparing a replay. The database also has a unique constraint on `idempotency_key`
as the final backstop. The service serialises the lookup and write so the check is
not vulnerable to a check-then-act race.

## 5. Error matrix

| Status | Code | Typical cause |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Missing field, bad id, amount format, missing JSON body |
| 400 | `SAME_ACCOUNT` | Source and destination are equal |
| 400 | `UNSUPPORTED_CURRENCY` | Currency outside USD/EUR/GBP |
| 404 | `ACCOUNT_NOT_FOUND` | Unknown source, destination or detail id |
| 404 | `TRANSFER_NOT_FOUND` | Unknown transfer id |
| 404 | `ROUTE_NOT_FOUND` | Unknown API route |
| 409 | `IDEMPOTENCY_CONFLICT` | Key reused with a different payload |
| 409 | `ACCOUNT_NOT_ACTIVE` | Frozen or closed account (schema supports it) |
| 413 | `PAYLOAD_TOO_LARGE` | JSON body over 32 KB |
| 422 | `INSUFFICIENT_FUNDS` | Source balance below the amount |
| 422 | `CURRENCY_MISMATCH` | Request, source and destination currencies differ |
| 500 | `INTERNAL_ERROR` | Unexpected failure; internals are not leaked |

Every error carries a `requestId` that is also returned in the `X-Request-Id` header,
so a UI report can be correlated with server logs.

## 6. Contract testing

`openapi/banking-api.yaml` is the source of truth for paths, schemas, examples and
status codes. `tests/api/contract.spec.js`:

- Parses the YAML with `yaml`.
- Resolves local `$ref` pointers.
- Compiles schemas with Ajv's 2020-12 build (OpenAPI 3.1 uses JSON Schema 2020-12).
- Validates real success and error responses.
- Proves the validator is effective by rejecting a deliberately numeric balance.
- Validates documented request examples and rejects a three-decimal amount.

The spec is importable into Postman or another REST client. Playwright was chosen as
the single automation toolchain so API, contract and UI tests share fixtures,
reporting and CI. REST Assured or Postman would cover the same scenarios; the
OpenAPI file keeps the contract portable.

## 7. Running and debugging

```bash
npm run test:api
npx playwright test --project=api --grep "idempotent"
npx playwright test --project=api --reporter=line
```

Useful evidence:

- `test-results/junit.xml` for CI dashboards.
- `playwright-report/index.html` for the full run.
- `test-results/artifacts/` for traces on the first retry.
- The API returns `X-Request-Id`; include it when filing a defect.

For manual exploration:

```bash
npm start
curl http://127.0.0.1:3000/api/health
curl http://127.0.0.1:3000/api/accounts
```

## 8. Conventions

- Generate a unique key per logical transfer; never reuse a fixed key across tests.
- Assert status, code, message presence and the relevant fields, not the entire body
  unless the full body is stable by contract.
- Assert money as two-decimal strings in API responses.
- Assert both sides of a transfer, not only the source.
- Prefer one behaviour per test; use `test.step` for a table of boundary variants.
- Do not add sleeps. Use Playwright auto-waiting and `expect.poll` for UI updates.
- A negative test must also prove there was no side effect.

## 9. Known gaps

- No authentication or authorization scenarios; the lab has no auth model.
- No rate limiting, retry-after, or circuit-breaker behaviour.
- No real network failure or timeout injection at the HTTP layer; the atomicity
  failure path is covered at the service/database level and in the defect log.
- No multi-process idempotency test; the unique constraint is the documented
  production backstop.

These gaps are explicit so a reviewer does not mistake green API tests for complete
production readiness.
