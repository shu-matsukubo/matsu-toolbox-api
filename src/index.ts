import { serve } from '@hono/node-server';
import { app } from './app.js';
import { config } from './config.js';
import { pool } from './db/client.js';
import { jsonLogger } from './logger.js';

const server = serve(
  {
    fetch: app.fetch,
    hostname: '0.0.0.0',
    port: config.port,
  },
  info => {
    jsonLogger({
      level: 'info',
      event: 'server_started',
      port: info.port,
    });
  }
);

let shuttingDown = false;

const shutdown = (signal: NodeJS.Signals): void => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  jsonLogger({ level: 'info', event: 'server_shutdown_started', signal });

  server.close(error => {
    void pool.end().finally(() => {
      if (error) {
        jsonLogger({
          level: 'error',
          event: 'server_shutdown_failed',
          errorName: error.name,
          errorMessage: error.message,
        });
        process.exitCode = 1;
      } else {
        jsonLogger({ level: 'info', event: 'server_shutdown_completed' });
      }
    });
  });
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
