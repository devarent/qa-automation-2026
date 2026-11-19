import http from 'k6/http';
import { check, fail, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:3000';

const transferSuccess = new Rate('transfer_success_rate');
const transferDuration = new Trend('transfer_duration', true);

export const options = {
  stages: [
    { duration: '10s', target: 5 },
    { duration: '30s', target: 10 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
    transfer_success_rate: ['rate>0.99'],
    transfer_duration: ['p(95)<400'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  tags: {
    suite: 'banking-transfer-load',
  },
};

export function setup() {
  const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const accounts = [
    {
      customerName: 'Load Test Source',
      email: `load.source.${stamp}@example.com`,
      currency: 'USD',
      openingBalance: '1000000.00',
    },
    {
      customerName: 'Load Test Destination',
      email: `load.destination.${stamp}@example.com`,
      currency: 'USD',
      openingBalance: '0.00',
    },
  ];

  const ids = accounts.map((payload) => {
    const response = http.post(`${BASE_URL}/api/accounts`, JSON.stringify(payload), {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'setup-create-account' },
    });

    if (response.status !== 201) {
      fail(
        `Account setup failed (${response.status}): ${response.body?.slice(0, 300)}`,
      );
    }

    return response.json('data.id');
  });

  console.log(
    `Load test accounts ready: source=${ids[0]} destination=${ids[1]} base=${BASE_URL}`,
  );

  return {
    sourceId: ids[0],
    destinationId: ids[1],
  };
}

export default function (data) {
  const payload = {
    fromAccountId: data.sourceId,
    toAccountId: data.destinationId,
    amount: '1.00',
    currency: 'USD',
    idempotencyKey: `k6-${__VU}-${__ITER}-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`,
  };

  const response = http.post(`${BASE_URL}/api/transfers`, JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'create-transfer' },
  });

  const succeeded = check(response, {
    'transfer returns 201': (result) => result.status === 201,
    'transfer is completed': (result) => {
      try {
        return result.json('data.status') === 'COMPLETED';
      } catch {
        return false;
      }
    },
  });

  transferSuccess.add(succeeded);
  transferDuration.add(response.timings.duration);
  sleep(0.1);
}

export function handleSummary(data) {
  const metrics = data.metrics;
  const p95 = metrics.http_req_duration?.values?.['p(95)'] ?? 0;
  const failureRate = metrics.http_req_failed?.values?.rate ?? 0;
  const successRate = metrics.transfer_success_rate?.values?.rate ?? 0;
  const iterations = metrics.iterations?.values?.count ?? 0;

  const lines = [
    '',
    'Digital Banking QA Lab - k6 transfer load summary',
    '------------------------------------------------',
    `Base URL:             ${BASE_URL}`,
    `Iterations:           ${iterations}`,
    `HTTP p95:             ${p95.toFixed(2)} ms (threshold < 500 ms)`,
    `HTTP failure rate:    ${(failureRate * 100).toFixed(2)}% (threshold < 1%)`,
    `Transfer success:     ${(successRate * 100).toFixed(2)}% (threshold > 99%)`,
    '',
  ];

  return {
    'performance/k6/summary.json': JSON.stringify(data, null, 2),
    stdout: `${lines.join('\n')}\n`,
  };
}
