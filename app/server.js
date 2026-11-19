'use strict';

const { createDatabase } = require('./db');
const { createApp } = require('./app');

/**
 * Start an isolated banking app instance.
 * Port 0 asks the OS for a free port, which keeps test runs independent.
 */
async function startServer({
  port = Number.parseInt(process.env.PORT ?? '3000', 10),
  host = process.env.HOST ?? '127.0.0.1',
  seed = true,
} = {}) {
  const database = createDatabase({ seed });
  const app = createApp({ pool: database.pool, db: database.db });

  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(port, host);
    instance.once('listening', () => resolve(instance));
    instance.once('error', reject);
  });

  const address = server.address();
  const displayHost = host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host;
  const url = `http://${displayHost}:${address.port}`;

  let closed = false;
  async function close() {
    if (closed) {
      return;
    }
    closed = true;
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await database.close();
  }

  return { app, server, database, pool: database.pool, url, close };
}

if (require.main === module) {
  const port = Number.parseInt(process.env.PORT ?? '3000', 10);
  const host = process.env.HOST ?? '127.0.0.1';

  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    console.error(`Invalid PORT value: ${process.env.PORT}`);
    process.exit(1);
  }

  startServer({ port, host })
    .then((instance) => {
      console.log(`Banking QA Lab listening on ${instance.url}`);
      console.log(`Health check: ${instance.url}/api/health`);

      let shuttingDown = false;
      const shutdown = async (signal) => {
        if (shuttingDown) {
          return;
        }
        shuttingDown = true;
        console.log(`\nReceived ${signal}; shutting down.`);
        try {
          await instance.close();
          process.exit(0);
        } catch (error) {
          console.error('Shutdown failed', error);
          process.exit(1);
        }
      };

      process.once('SIGINT', () => shutdown('SIGINT'));
      process.once('SIGTERM', () => shutdown('SIGTERM'));
    })
    .catch((error) => {
      console.error('Failed to start Banking QA Lab', error);
      process.exit(1);
    });
}

module.exports = { startServer };
