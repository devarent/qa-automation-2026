'use strict';

const { test: base, expect, request } = require('@playwright/test');
const { startServer } = require('../../app/server');

/**
 * Every API test gets its own app instance and seeded pg-mem database on an
 * ephemeral port. This makes balance assertions deterministic and removes any
 * ordering dependency between tests.
 */
const test = base.extend({
  api: async ({}, use) => {
    const instance = await startServer({ port: 0, host: '127.0.0.1', seed: true });
    const context = await request.newContext({
      baseURL: instance.url,
      extraHTTPHeaders: {
        Accept: 'application/json',
      },
    });

    try {
      await use(context);
    } finally {
      await context.dispose();
      await instance.close();
    }
  },
});

module.exports = { test, expect };
