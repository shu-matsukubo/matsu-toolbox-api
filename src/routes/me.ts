import { createRoute, type OpenAPIHono } from '@hono/zod-openapi';
import { MeResponseSchema } from '../schemas.js';
import type { AppBindings } from '../types/app.js';
import { bearerSecurity, jsonContent, standardErrorResponses } from './shared.js';

const meRoute = createRoute({
  method: 'get',
  path: '/api/me',
  tags: ['Identity'],
  security: bearerSecurity,
  responses: {
    200: {
      description: 'Verified access-token identity.',
      content: jsonContent(MeResponseSchema),
    },
    401: standardErrorResponses[401],
    500: standardErrorResponses[500],
    503: standardErrorResponses[503],
  },
});

export const registerMeRoutes = (app: OpenAPIHono<AppBindings>): void => {
  app.openapi(meRoute, context => {
    const auth = context.get('auth');
    return context.json(auth, 200);
  });
};
