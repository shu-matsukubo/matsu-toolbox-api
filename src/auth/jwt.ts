import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTHeaderParameters,
  type JWTVerifyGetKey,
  type FlattenedJWSInput,
} from 'jose';
import { JwtVerificationError } from '../errors.js';
import type { AuthContext } from '../types/app.js';

export interface JwtVerifierOptions {
  issuer: string;
  audience: string;
  jwksUrl?: string;
  cacheMaxAgeMilliseconds?: number;
  timeoutDurationMilliseconds?: number;
  keyResolver?: JWTVerifyGetKey;
}

export type AccessTokenVerifier = (token: string) => Promise<AuthContext>;

class JwksUnavailableError extends Error {
  constructor(options: ErrorOptions) {
    super('Unable to resolve a JWKS signing key.', options);
    this.name = 'JwksUnavailableError';
  }
}

const createRemoteKeyResolver = (options: JwtVerifierOptions): JWTVerifyGetKey => {
  if (!options.jwksUrl) {
    throw new Error('jwksUrl is required when keyResolver is not provided.');
  }

  const remote = createRemoteJWKSet(new URL(options.jwksUrl), {
    cacheMaxAge: options.cacheMaxAgeMilliseconds,
    cooldownDuration: 0,
    timeoutDuration: options.timeoutDurationMilliseconds,
  });

  return async (protectedHeader: JWTHeaderParameters, token: FlattenedJWSInput) => {
    try {
      return await remote(protectedHeader, token);
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === 'JWKSNoMatchingKey' || error.name === 'JWKSMultipleMatchingKeys')
      ) {
        throw error;
      }

      throw new JwksUnavailableError({ cause: error });
    }
  };
};

export const createJwtVerifier = (options: JwtVerifierOptions): AccessTokenVerifier => {
  const keyResolver = options.keyResolver ?? createRemoteKeyResolver(options);

  return async token => {
    try {
      const { payload, protectedHeader } = await jwtVerify(token, keyResolver, {
        algorithms: ['RS256'],
        audience: options.audience,
        issuer: options.issuer,
      });

      const now = Math.floor(Date.now() / 1000);
      const issuedAt = payload.iat;
      const expiresAt = payload.exp;
      const validIssuedAt =
        typeof issuedAt === 'number' &&
        Number.isInteger(issuedAt) &&
        issuedAt > 0 &&
        issuedAt <= now + 300;
      const validExpiresAt =
        typeof expiresAt === 'number' &&
        Number.isInteger(expiresAt) &&
        expiresAt > 0 &&
        typeof issuedAt === 'number' &&
        expiresAt > issuedAt;
      const validEmail = payload.email === undefined || typeof payload.email === 'string';

      if (
        protectedHeader.alg !== 'RS256' ||
        typeof protectedHeader.kid !== 'string' ||
        protectedHeader.kid.length === 0 ||
        payload.iss !== options.issuer ||
        payload.aud !== options.audience ||
        typeof payload.sub !== 'string' ||
        payload.sub.length === 0 ||
        payload.token_use !== 'access' ||
        !validIssuedAt ||
        !validExpiresAt ||
        !validEmail
      ) {
        throw new JwtVerificationError('invalid');
      }

      return {
        sub: payload.sub,
        ...(typeof payload.email === 'string' ? { email: payload.email } : {}),
        issuer: options.issuer,
        audience: options.audience,
      };
    } catch (error) {
      if (error instanceof JwtVerificationError) {
        throw error;
      }

      if (error instanceof JwksUnavailableError) {
        throw new JwtVerificationError('unavailable', { cause: error });
      }

      throw new JwtVerificationError('invalid', { cause: error });
    }
  };
};
