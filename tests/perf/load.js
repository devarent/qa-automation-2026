/*
 * k6 load script for the Northstar Bank QA Lab.
 *
 * Run with:
 *   k6 run --vus 10 --duration 30s tests/perf/load.js
 *
 * Override the target with BASE_URL=http://127.0.0.1:3100.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:3100';

const transferErrors = new Rate('transfer_errors');
const transferDuration = new Trend('transfer_duration');

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
    transfer_errors: ['rate<0.01'],
  },
};

export default function () {
  const health = http.get(`${BASE_URL}/health`, {
    tags: { endpoint: 'health' },
  });
  check(health, {
    'health status is 200': (response) => response.status === 200,
    'health reports ok': (response) => {
      try {
        return response.json('status') === 'ok';
      } catch {
        return false;
      }
    },
  });

  const payload = JSON.stringify({
    fromAccountId: 1,
    toAccountId: 2,
    amount: '1.00',
    currency: 'USD',
    idempotencyKey: `k6-${__VU}-${__ITER}-${Date.now()}`,
  });

  const startedAt = Date.now();
  const transfer = http.post(`${BASE_URL}/api/transfers`, payload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { endpoint: 'transfers' },
  });
  transferDuration.add(Date.now() - startedAt);
  transferErrors.add(transfer.status !== 201);

  check(transfer, {
    'transfer status is 201': (response) => response.status === 201,
    'transfer is completed': (response) => {
      try {
        return response.json('data.status') === 'COMPLETED';
      } catch {
        return false;
      }
    },
  });

  sleep(1);
}
