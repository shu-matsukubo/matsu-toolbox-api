import { randomUUID } from 'node:crypto';
import { createMiddleware } from 'hono/factory';
import type { AppBindings, AppLogger } from './types/app.js';

export const jsonLogger: AppLogger = entry => {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), ...entry }));
};

export const createRequestLogger = (logger: AppLogger) =>
  createMiddleware<AppBindings>(async (context, next) => {
    const requestId = randomUUID();
    const startedAt = performance.now();
    context.set('requestId', requestId);

    await next();

    context.header('X-Request-Id', requestId);
    logger({
      level: context.res.status >= 500 ? 'error' : context.res.status >= 400 ? 'warn' : 'info',
      event: 'request_completed',
      requestId,
      method: context.req.method,
      path: context.req.path,
      status: context.res.status,
      durationMilliseconds: Math.round((performance.now() - startedAt) * 100) / 100,
    });
  });
