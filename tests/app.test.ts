import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload } from 'jose';
import { createApp, getOpenApiDocument } from '../src/app.js';
import { createJwtVerifier } from '../src/auth/jwt.js';
import { JwtVerificationError } from '../src/errors.js';
import { TEXT_INSPECT_MAX_LENGTH } from '../src/schemas.js';
import type { AppLogger } from '../src/types/app.js';
import type { Bookmark, Note } from '../src/types/domain.js';
import { MemoryToolboxRepository } from './support/memory-repository.js';

const ISSUER = 'http://test-auth.example';
const AUDIENCE = 'matsu-toolbox-api';
const KEY_ID = 'toolbox-test-key';
const USER_A = '00000000-0000-4000-8000-000000000001';
const USER_B = '00000000-0000-4000-8000-000000000002';

const primaryKeys = await generateKeyPair('RS256');
const wrongKeys = await generateKeyPair('RS256');
const publicJwk = await exportJWK(primaryKeys.publicKey);
const keyResolver = createLocalJWKSet({
  keys: [{ ...publicJwk, alg: 'RS256', kid: KEY_ID, use: 'sig' }],
});
const verifyAccessToken = createJwtVerifier({
  issuer: ISSUER,
  audience: AUDIENCE,
  keyResolver,
});
const noopLogger: AppLogger = () => undefined;

interface TokenOptions {
  audience?: string;
  expiresAt?: number;
  issuer?: string;
  issuedAt?: number;
  key?: CryptoKey;
  keyId?: string;
  sub?: string;
  tokenUse?: string;
}

const tokenFor = async (options: TokenOptions = {}): Promise<string> => {
  const now = Math.floor(Date.now() / 1000);
  const payload: JWTPayload = {
    email: 'user@example.com',
    token_use: options.tokenUse ?? 'access',
  };

  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', kid: options.keyId ?? KEY_ID })
    .setIssuer(options.issuer ?? ISSUER)
    .setAudience(options.audience ?? AUDIENCE)
    .setSubject(options.sub ?? USER_A)
    .setIssuedAt(options.issuedAt ?? now)
    .setExpirationTime(options.expiresAt ?? now + 600)
    .sign(options.key ?? primaryKeys.privateKey);
};

const createTestApp = () =>
  createApp({
    repository: new MemoryToolboxRepository(),
    verifyAccessToken,
    logger: noopLogger,
  });

const authorizedRequest = (
  app: ReturnType<typeof createTestApp>,
  path: string,
  token: string,
  init: RequestInit = {}
) =>
  app.request(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...init.headers,
    },
  });

void test('health and public documentation routes do not require authentication', async () => {
  const app = createTestApp();

  const health = await app.request('/health');
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok' });
  assert.match(health.headers.get('x-request-id') ?? '', /^[0-9a-f-]{36}$/);

  assert.equal((await app.request('/openapi.json')).status, 200);
  assert.equal((await app.request('/docs')).status, 200);
});

void test('JWT middleware rejects invalid claims and accepts a valid RS256 access token', async () => {
  const app = createTestApp();
  const now = Math.floor(Date.now() / 1000);

  assert.equal((await app.request('/api/me')).status, 401);
  assert.equal(
    (
      await app.request('/api/me', {
        headers: { Authorization: 'Basic abc' },
      })
    ).status,
    401
  );
  assert.equal(
    (
      await app.request('/api/me', {
        headers: { Authorization: 'Bearer not.a.jwt' },
      })
    ).status,
    401
  );

  const rejectedTokens = [
    await tokenFor({ key: wrongKeys.privateKey }),
    await tokenFor({ keyId: 'unknown-test-key' }),
    await tokenFor({ issuer: 'http://wrong-issuer.example' }),
    await tokenFor({ audience: 'matsu-api' }),
    await tokenFor({ issuedAt: now - 120, expiresAt: now - 60 }),
    await tokenFor({ issuedAt: now + 600, expiresAt: now + 1200 }),
    await tokenFor({ tokenUse: 'refresh' }),
  ];

  for (const token of rejectedTokens) {
    assert.equal((await authorizedRequest(app, '/api/me', token)).status, 401);
  }

  const valid = await tokenFor();
  const response = await authorizedRequest(app, '/api/me', valid);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    sub: USER_A,
    email: 'user@example.com',
    issuer: ISSUER,
    audience: AUDIENCE,
  });
});

void test('JWKS lookup failures are normalized separately from invalid tokens', async () => {
  const app = createApp({
    repository: new MemoryToolboxRepository(),
    verifyAccessToken: () => Promise.reject(new JwtVerificationError('unavailable')),
    logger: noopLogger,
  });
  const response = await authorizedRequest(app, '/api/me', 'opaque-token');
  assert.equal(response.status, 503);
  assert.equal(
    ((await response.json()) as { error: { code: string } }).error.code,
    'AUTH_SERVICE_UNAVAILABLE'
  );
});

void test('request validation produces the standard safe JSON error', async () => {
  const app = createTestApp();
  const token = await tokenFor();
  const response = await authorizedRequest(app, '/api/notes', token, {
    method: 'POST',
    body: JSON.stringify({ title: '', content: 'invalid' }),
  });

  assert.equal(response.status, 400);
  const body = (await response.json()) as {
    error: { code: string; message: string; details: unknown[] };
  };
  assert.equal(body.error.code, 'VALIDATION_ERROR');
  assert.equal(body.error.message, 'Request validation failed.');
  assert.ok(body.error.details.length > 0);
});

void test('notes CRUD is ordered and isolated by JWT sub', async () => {
  const app = createTestApp();
  const tokenA = await tokenFor({ sub: USER_A });
  const tokenB = await tokenFor({ sub: USER_B });

  const firstResponse = await authorizedRequest(app, '/api/notes', tokenA, {
    method: 'POST',
    body: JSON.stringify({ title: 'First', content: 'one' }),
  });
  assert.equal(firstResponse.status, 201);
  const first = (await firstResponse.json()) as Note;

  const secondResponse = await authorizedRequest(app, '/api/notes', tokenA, {
    method: 'POST',
    body: JSON.stringify({ title: 'Second' }),
  });
  const second = (await secondResponse.json()) as Note;

  const listResponse = await authorizedRequest(app, '/api/notes', tokenA);
  assert.deepEqual(
    ((await listResponse.json()) as Note[]).map(note => note.id),
    [second.id, first.id]
  );

  assert.equal((await authorizedRequest(app, `/api/notes/${first.id}`, tokenB)).status, 404);
  assert.equal(
    (
      await authorizedRequest(app, `/api/notes/${first.id}`, tokenB, {
        method: 'PATCH',
        body: JSON.stringify({ title: 'stolen' }),
      })
    ).status,
    404
  );
  assert.equal(
    (
      await authorizedRequest(app, `/api/notes/${first.id}`, tokenB, {
        method: 'DELETE',
      })
    ).status,
    404
  );

  const updateResponse = await authorizedRequest(app, `/api/notes/${first.id}`, tokenA, {
    method: 'PATCH',
    body: JSON.stringify({ title: 'Updated', content: '' }),
  });
  assert.equal(updateResponse.status, 200);
  assert.equal(((await updateResponse.json()) as Note).title, 'Updated');

  assert.equal(
    (
      await authorizedRequest(app, `/api/notes/${first.id}`, tokenA, {
        method: 'DELETE',
      })
    ).status,
    204
  );
  assert.equal((await authorizedRequest(app, `/api/notes/${first.id}`, tokenA)).status, 404);
});

void test('bookmarks CRUD deduplicates tags, filters by tag, and enforces ownership', async () => {
  const app = createTestApp();
  const tokenA = await tokenFor({ sub: USER_A });
  const tokenB = await tokenFor({ sub: USER_B });

  const createResponse = await authorizedRequest(app, '/api/bookmarks', tokenA, {
    method: 'POST',
    body: JSON.stringify({
      url: 'https://example.com/docs',
      title: 'Docs',
      tags: ['reference', 'reference', 'typescript'],
    }),
  });
  assert.equal(createResponse.status, 201);
  const bookmark = (await createResponse.json()) as Bookmark;
  assert.deepEqual(bookmark.tags, ['reference', 'typescript']);

  await authorizedRequest(app, '/api/bookmarks', tokenA, {
    method: 'POST',
    body: JSON.stringify({
      url: 'http://example.net',
      title: 'Other',
      tags: ['other'],
    }),
  });

  const filtered = await authorizedRequest(app, '/api/bookmarks?tag=reference', tokenA);
  assert.deepEqual(
    ((await filtered.json()) as Bookmark[]).map(value => value.id),
    [bookmark.id]
  );

  assert.equal((await authorizedRequest(app, `/api/bookmarks/${bookmark.id}`, tokenB)).status, 404);
  assert.equal(
    (
      await authorizedRequest(app, `/api/bookmarks/${bookmark.id}`, tokenB, {
        method: 'PATCH',
        body: JSON.stringify({ title: 'stolen' }),
      })
    ).status,
    404
  );
  assert.equal(
    (
      await authorizedRequest(app, `/api/bookmarks/${bookmark.id}`, tokenB, {
        method: 'DELETE',
      })
    ).status,
    404
  );

  const updated = await authorizedRequest(app, `/api/bookmarks/${bookmark.id}`, tokenA, {
    method: 'PATCH',
    body: JSON.stringify({ tags: ['updated', 'updated'] }),
  });
  assert.deepEqual(((await updated.json()) as Bookmark).tags, ['updated']);

  assert.equal(
    (
      await authorizedRequest(app, `/api/bookmarks/${bookmark.id}`, tokenA, {
        method: 'DELETE',
      })
    ).status,
    204
  );
});

void test('text inspector handles Unicode, line endings, empty input, and its size limit', async () => {
  const app = createTestApp();
  const token = await tokenFor();

  const unicodeText = 'A😀\n世界';
  const unicodeResponse = await authorizedRequest(app, '/api/tools/text/inspect', token, {
    method: 'POST',
    body: JSON.stringify({ text: unicodeText }),
  });
  assert.equal(unicodeResponse.status, 200);
  assert.deepEqual(await unicodeResponse.json(), {
    codePointCount: 5,
    utf8ByteCount: 12,
    wordCount: 2,
    lineCount: 2,
    sha256: createHash('sha256').update(unicodeText).digest('hex'),
  });

  const emptyResponse = await authorizedRequest(app, '/api/tools/text/inspect', token, {
    method: 'POST',
    body: JSON.stringify({ text: '' }),
  });
  const empty = (await emptyResponse.json()) as {
    codePointCount: number;
    utf8ByteCount: number;
    wordCount: number;
    lineCount: number;
  };
  assert.deepEqual(
    {
      codePointCount: empty.codePointCount,
      utf8ByteCount: empty.utf8ByteCount,
      wordCount: empty.wordCount,
      lineCount: empty.lineCount,
    },
    { codePointCount: 0, utf8ByteCount: 0, wordCount: 0, lineCount: 0 }
  );

  assert.equal(
    (
      await authorizedRequest(app, '/api/tools/text/inspect', token, {
        method: 'POST',
        body: JSON.stringify({ text: 'a'.repeat(TEXT_INSPECT_MAX_LENGTH) }),
      })
    ).status,
    200
  );
  assert.equal(
    (
      await authorizedRequest(app, '/api/tools/text/inspect', token, {
        method: 'POST',
        body: JSON.stringify({ text: 'a'.repeat(TEXT_INSPECT_MAX_LENGTH + 1) }),
      })
    ).status,
    400
  );
});

void test('checked-in OpenAPI artifact matches the registered route definitions', async () => {
  const artifact = JSON.parse(
    await readFile(resolve(process.cwd(), 'openapi/openapi.json'), 'utf8')
  ) as unknown;
  assert.deepEqual(artifact, getOpenApiDocument());
});
