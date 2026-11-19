# Performance testing with k6

The load test exercises the real transfer endpoint, including idempotency lookup,
balance checks, two balance updates and two ledger inserts.

## Prerequisites

- [k6](https://k6.io/docs/get-started/installation/) installed locally, **or**
  Docker with the `grafana/k6` image.
- The app running and reachable. Start it with:

```bash
npm start
# http://127.0.0.1:3000
```

## Run

```bash
# Local k6
k6 run performance/k6/transfer-load.js

# Point at another environment
BASE_URL=http://127.0.0.1:3100 k6 run performance/k6/transfer-load.js

# Docker (Linux containers)
docker run --rm --network host \
  -v "$PWD:/work" -w /work \
  -e BASE_URL=http://127.0.0.1:3000 \
  grafana/k6:0.54.0 run performance/k6/transfer-load.js
```

On Windows PowerShell, use `${PWD}:/work` for the bind mount.

## What the script does

1. **Setup** opens two USD accounts through `POST /api/accounts`:
   a funded source (1,000,000.00) and an empty destination.
2. Each virtual user sends a 1.00 USD transfer with a unique idempotency key.
3. A short think time (100 ms) keeps the test realistic without hiding throughput.
4. `handleSummary` writes `performance/k6/summary.json` and prints a compact summary.

## Thresholds

| Metric | Threshold | Why it matters |
| --- | --- | --- |
| `http_req_duration` p95 | `< 500 ms` | A transfer should feel immediate in a branch or mobile flow. |
| `http_req_failed` | `< 1%` | Error budget for a critical money-movement path. |
| `transfer_success_rate` | `> 99%` | Checks the domain response, not only the HTTP status. |
| `transfer_duration` p95 | `< 400 ms` | Domain-level latency for completed transfers. |

The run fails when a threshold is breached, which is what makes it useful in CI.

## Reading results

- **p95**: 95% of requests completed below this duration. Prefer it over the average,
  which hides tail latency.
- **http_req_failed**: HTTP-level failures (non-2xx or transport errors).
- **transfer_success_rate**: a custom metric that also checks `data.status`.
- **checks**: individual assertion pass rate; a high HTTP success rate with failing
  checks means the API returned the wrong domain result.

## CI

The `performance` job in `.github/workflows/ci.yml` is manual (`workflow_dispatch`)
only. It starts the app, waits for `/api/health`, runs k6 in Docker and uploads
`performance/k6/summary.json`. Performance is intentionally not a required gate on
every pull request because shared runners are noisy and the demo database is in-memory.

## Caveats

- pg-mem is single-process and the app serialises money operations, so these numbers
  describe the lab, not production PostgreSQL capacity.
- The seeded data is in-memory and resets when the app restarts.
- The source account is funded for roughly one million 1.00 transfers; a much longer
  run needs a larger opening balance or periodic account rotation.
- This is a load test, not a soak/stress test. Add longer stages and higher VUs when
  validating capacity on a real environment.
