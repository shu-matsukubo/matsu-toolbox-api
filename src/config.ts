import { z } from 'zod';

const EnvironmentSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  DATABASE_URL: z
    .string()
    .min(1)
    .default('postgres://matsu-toolbox:matsu-toolbox-pass@localhost:15433/matsu-toolbox'),
  AUTH_ISSUER: z.string().url().default('http://localhost:18081'),
  AUTH_AUDIENCE: z.string().min(1).default('matsu-toolbox-api'),
  AUTH_JWKS_URL: z.string().url().default('http://localhost:18081/.well-known/jwks.json'),
  AUTH_JWKS_CACHE_SECONDS: z.coerce.number().int().positive().default(600),
  AUTH_JWKS_TIMEOUT_MILLISECONDS: z.coerce.number().int().positive().default(5000),
});

const parsed = EnvironmentSchema.safeParse(process.env);

if (!parsed.success) {
  const reasons = parsed.error.issues
    .map(issue => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');
  throw new Error(`Invalid environment configuration: ${reasons}`);
}

export const config = {
  port: parsed.data.PORT,
  databaseUrl: parsed.data.DATABASE_URL,
  authIssuer: parsed.data.AUTH_ISSUER,
  authAudience: parsed.data.AUTH_AUDIENCE,
  authJwksUrl: parsed.data.AUTH_JWKS_URL,
  authJwksCacheMilliseconds: parsed.data.AUTH_JWKS_CACHE_SECONDS * 1000,
  authJwksTimeoutMilliseconds: parsed.data.AUTH_JWKS_TIMEOUT_MILLISECONDS,
} as const;
