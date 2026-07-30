# matsu Toolbox API

`matsu-toolbox-api` is an independent resource server for small personal tools. It uses
`matsu-auth` for identity but does not contain household-accounting domain logic and does not
share the databases or Redis instances used by other matsu services.

The current features are:

- per-user notes
- per-user bookmarks with optional exact-tag filtering
- stateless Unicode-aware text inspection

Every `/api/*` route requires an RS256 access token issued for the `matsu-toolbox-api` audience.
Ownership is always derived from the verified JWT `sub`; a client-supplied user identifier is
never used.

## Technology

- Node.js 22 and strict TypeScript
- Hono, `@hono/zod-openapi`, and Swagger UI
- Zod request/response schemas and generated OpenAPI
- `jose` JWT/JWKS verification
- PostgreSQL 16 and Drizzle ORM
- ESLint, Prettier, and the Node test runner through `tsx`
- Docker Compose

## Start, migrate, and stop

Start the API and its dedicated PostgreSQL database:

```bash
docker compose up -d --build
```

The API container runs the checked-in SQL migrations before starting. Migrations may also be
run explicitly and are safe to repeat:

```bash
docker compose run --rm api npm run db:migrate
```

Stop the services without deleting the database volume:

```bash
docker compose down
```

Do not add `--volumes` unless the local Toolbox data is intentionally being discarded.

When a local TLS inspection product requires a custom CA for package installation, pass the CA
as a BuildKit secret instead of disabling certificate validation:

```bash
docker build --secret id=npm_ca,src=/path/to/local-ca.pem -t matsu-toolbox-api:local .
docker compose up -d --no-build
```

The CA secret is available only during `npm ci` and is not copied into the image.

## Local ports

| Service            | Host    | Container |
| ------------------ | ------- | --------- |
| Toolbox API        | `18083` | `8080`    |
| Toolbox PostgreSQL | `15433` | `5432`    |

Local database defaults:

```text
database: matsu-toolbox
user: matsu-toolbox
password: matsu-toolbox-pass
```

These values are for local development only.

## Environment variables

| Variable                         | Local default                                                               | Purpose               |
| -------------------------------- | --------------------------------------------------------------------------- | --------------------- |
| `PORT`                           | `8080`                                                                      | API listen port       |
| `DATABASE_URL`                   | `postgres://matsu-toolbox:matsu-toolbox-pass@localhost:15433/matsu-toolbox` | PostgreSQL connection |
| `AUTH_ISSUER`                    | `http://localhost:18081`                                                    | Required JWT issuer   |
| `AUTH_AUDIENCE`                  | `matsu-toolbox-api`                                                         | Required JWT audience |
| `AUTH_JWKS_URL`                  | `http://localhost:18081/.well-known/jwks.json`                              | JWKS endpoint         |
| `AUTH_JWKS_CACHE_SECONDS`        | `600`                                                                       | JWKS cache lifetime   |
| `AUTH_JWKS_TIMEOUT_MILLISECONDS` | `5000`                                                                      | JWKS request timeout  |

Docker Compose changes `DATABASE_URL` to use `toolbox-db` and `AUTH_JWKS_URL` to use
`host.docker.internal`.

## URLs

- API: <http://localhost:18083>
- Health: <http://localhost:18083/health>
- OpenAPI JSON: <http://localhost:18083/openapi.json>
- Swagger UI: <http://localhost:18083/docs>

Protected endpoints:

```text
GET    /api/me
POST   /api/notes
GET    /api/notes
GET    /api/notes/:noteId
PATCH  /api/notes/:noteId
DELETE /api/notes/:noteId
POST   /api/bookmarks
GET    /api/bookmarks?tag=optional
GET    /api/bookmarks/:bookmarkId
PATCH  /api/bookmarks/:bookmarkId
DELETE /api/bookmarks/:bookmarkId
POST   /api/tools/text/inspect
```

## Obtain a Toolbox token

Start `matsu-auth`, register or log in with the Toolbox audience, and use the returned access
token as a Bearer token:

```bash
curl -X POST http://localhost:18081/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password","audience":"matsu-toolbox-api"}'
```

```bash
curl http://localhost:18083/api/me \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

Omitting `audience` asks Auth for its backward-compatible default `matsu-api` token. That token
is intentionally rejected by this service.

## JWT trust conditions

The authentication middleware accepts only `Authorization: Bearer <token>` and requires:

- `alg=RS256`
- a non-empty `kid` resolved through the configured JWKS
- a valid signature
- exact `iss=http://localhost:18081`
- exact `aud=matsu-toolbox-api`
- valid integer `iat` and `exp` claims
- `token_use=access`
- a non-empty `sub`

JWKS keys are cached. An unknown `kid` can trigger a JWKS refresh. Invalid tokens return a safe
`401`; a JWKS transport failure is logged separately and returns a safe `503`. Internal JWT or
SQL details are never returned to clients.

The checked-in Auth development key and all development passwords are local fixtures. They must
not be reused as production secrets.

## Development commands

Install dependencies:

```bash
npm install
```

On Windows PowerShell, use `npm.cmd` in place of `npm`.

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm run format
npm run format:check
npm run check
npm test
npm run db:migrate
npm run openapi:generate
npm run openapi:check
```

The OpenAPI artifact at `openapi/openapi.json` is generated from the registered route schemas.
Run `openapi:generate` after a contract change and `openapi:check` in verification.

The Docker image includes the development toolchain so the main gates are reproducible in the
same Node 22 environment:

```bash
docker compose run --rm api npm run check
docker compose run --rm api npm test
docker compose run --rm api npm run build
```
