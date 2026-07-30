import { createMiddleware } from 'hono/factory';
import { JwtVerificationError } from '../errors.js';
import type { AppBindings, AppLogger } from '../types/app.js';
import type { AccessTokenVerifier } from './jwt.js';

const bearerToken = (authorization: string | undefined): string | null => {
  if (!authorization) {
    return null;
  }

  const match = /^Bearer ([^\s]+)$/.exec(authorization);
  return match?.[1] ?? null;
};

export const createJwtAuthMiddleware = (verify: AccessTokenVerifier, logger: AppLogger) =>
  createMiddleware<AppBindings>(async (context, next) => {
    const token = bearerToken(context.req.header('Authorization'));

    if (!token) {
      return context.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'A valid Bearer access token is required.',
            details: [],
          },
        },
        401
      );
    }

    try {
      context.set('auth', await verify(token));
    } catch (error) {
      const unavailable = error instanceof JwtVerificationError && error.kind === 'unavailable';
      logger({
        level: unavailable ? 'error' : 'warn',
        event: unavailable ? 'jwks_unavailable' : 'token_rejected',
        requestId: context.get('requestId'),
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });

      if (unavailable) {
        return context.json(
          {
            error: {
              code: 'AUTH_SERVICE_UNAVAILABLE',
              message: 'Authentication keys are temporarily unavailable.',
              details: [],
            },
          },
          503
        );
      }

      return context.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'A valid Bearer access token is required.',
            details: [],
          },
        },
        401
      );
    }

    await next();
  });
