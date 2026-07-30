import { createRoute, type OpenAPIHono } from '@hono/zod-openapi';
import { HealthResponseSchema } from '../schemas.js';
import type { AppBindings } from '../types/app.js';
import { jsonContent } from './shared.js';

const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  tags: ['System'],
  responses: {
    200: {
      description: 'The process is healthy.',
      content: jsonContent(HealthResponseSchema),
    },
  },
});

export const registerHealthRoutes = (app: OpenAPIHono<AppBindings>): void => {
  app.openapi(healthRoute, context => context.json({ status: 'ok' as const }, 200));
};
