import { swaggerUI } from '@hono/swagger-ui';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { createJwtAuthMiddleware } from './auth/middleware.js';
import { createJwtVerifier, type AccessTokenVerifier } from './auth/jwt.js';
import { config } from './config.js';
import { database } from './db/client.js';
import { PublicError, type ErrorDetail, type PublicErrorStatus } from './errors.js';
import { createRequestLogger, jsonLogger } from './logger.js';
import { DrizzleToolboxRepository } from './repositories/drizzle-toolbox-repository.js';
import type { ToolboxRepository } from './repositories/toolbox-repository.js';
import { registerBookmarkRoutes } from './routes/bookmarks.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerMeRoutes } from './routes/me.js';
import { registerNoteRoutes } from './routes/notes.js';
import { registerTextInspectorRoutes } from './routes/text-inspector.js';
import type { AppBindings, AppLogger } from './types/app.js';

export const openApiConfig = {
  openapi: '3.0.0' as const,
  info: {
    version: '0.1.0',
    title: 'matsu Toolbox API',
    description: 'JWT-protected notes, bookmarks, and stateless text inspection.',
  },
  servers: [{ url: 'http://localhost:18083', description: 'Local development' }],
  tags: [
    { name: 'System' },
    { name: 'Identity' },
    { name: 'Notes' },
    { name: 'Bookmarks' },
    { name: 'Tools' },
  ],
};

export interface AppDependencies {
  repository: ToolboxRepository;
  verifyAccessToken: AccessTokenVerifier;
  logger?: AppLogger;
}

const errorPayload = (code: string, message: string, details: ErrorDetail[] = []) => ({
  error: { code, message, details },
});

const errorResponse = (
  context: Context<AppBindings>,
  status: PublicErrorStatus,
  code: string,
  message: string,
  details: ErrorDetail[] = []
): Response => {
  const payload = errorPayload(code, message, details);
  switch (status) {
    case 400:
      return context.json(payload, 400);
    case 401:
      return context.json(payload, 401);
    case 404:
      return context.json(payload, 404);
    case 409:
      return context.json(payload, 409);
    case 500:
      return context.json(payload, 500);
    case 503:
      return context.json(payload, 503);
  }
};

export const createApp = (dependencies: AppDependencies): OpenAPIHono<AppBindings> => {
  const logger = dependencies.logger ?? jsonLogger;
  const app = new OpenAPIHono<AppBindings>({
    defaultHook: (result, context) => {
      if (!result.success) {
        return context.json(
          errorPayload(
            'VALIDATION_ERROR',
            'Request validation failed.',
            result.error.issues.map(issue => ({
              path: issue.path.map(String).join('.'),
              message: issue.message,
            }))
          ),
          400
        );
      }
    },
  });

  app.use('*', createRequestLogger(logger));
  app.use('/api/*', createJwtAuthMiddleware(dependencies.verifyAccessToken, logger));

  app.openAPIRegistry.registerComponent('securitySchemes', 'BearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'RS256 access token issued by matsu-auth for the matsu-toolbox-api audience.',
  });

  registerHealthRoutes(app);
  registerMeRoutes(app);
  registerNoteRoutes(app, dependencies.repository);
  registerBookmarkRoutes(app, dependencies.repository);
  registerTextInspectorRoutes(app);

  app.doc('/openapi.json', openApiConfig);
  app.get('/docs', swaggerUI({ url: '/openapi.json' }));

  app.notFound(context =>
    context.json(errorPayload('NOT_FOUND', 'The requested route was not found.'), 404)
  );

  app.onError((error, context) => {
    if (error instanceof PublicError) {
      return errorResponse(context, error.statusCode, error.code, error.message, error.details);
    }

    if ((error instanceof HTTPException && error.status === 400) || error instanceof SyntaxError) {
      return errorResponse(context, 400, 'VALIDATION_ERROR', 'Request validation failed.', [
        { path: 'body', message: 'The request body must be valid JSON.' },
      ]);
    }

    logger({
      level: 'error',
      event: 'unhandled_error',
      requestId: context.get('requestId'),
      errorName: error instanceof Error ? error.name : 'UnknownError',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    return errorResponse(
      context,
      500,
      'INTERNAL_SERVER_ERROR',
      'An unexpected server error occurred.'
    );
  });

  return app;
};

const repository = new DrizzleToolboxRepository(database);
const verifyAccessToken = createJwtVerifier({
  issuer: config.authIssuer,
  audience: config.authAudience,
  jwksUrl: config.authJwksUrl,
  cacheMaxAgeMilliseconds: config.authJwksCacheMilliseconds,
  timeoutDurationMilliseconds: config.authJwksTimeoutMilliseconds,
});

export const app = createApp({ repository, verifyAccessToken });

export const getOpenApiDocument = () => app.getOpenAPIDocument(openApiConfig);
