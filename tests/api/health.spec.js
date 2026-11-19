'use strict';

const { test, expect } = require('@playwright/test');

test.describe('health endpoints', () => {
  for (const path of ['/health', '/api/health']) {
    test(`GET ${path} reports a healthy service and database`, async ({ request }) => {
      const response = await request.get(path);

      expect(response.ok()).toBeTruthy();
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('application/json');
      expect(response.headers()['x-request-id']).toBeTruthy();

      const body = await response.json();
      expect(body.status).toBe('ok');
      expect(body.service).toBe('banking-qa-lab');
      expect(body.database).toBe('up');
      expect(body.version).toBe('1.0.0');
      expect(Number.isFinite(body.uptimeSeconds)).toBe(true);
      expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
    });
  }

  test('health echoes a valid caller supplied request id', async ({ request }) => {
    const response = await request.get('/health', {
      headers: { 'x-request-id': 'qa-health-check-001' },
    });

    expect(response.headers()['x-request-id']).toBe('qa-health-check-001');
  });

  test('unknown API routes return a structured 404', async ({ request }) => {
    const response = await request.get('/api/does-not-exist');

    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe('ROUTE_NOT_FOUND');
    expect(body.error.requestId).toBeTruthy();
  });
});
