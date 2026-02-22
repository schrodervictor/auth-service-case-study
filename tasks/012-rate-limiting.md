# Task: Rate Limiting with Redis

## Status: done

## Context

Rate limiting is a high-value security feature that protects authentication
endpoints from brute-force attacks. In a distributed deployment (multiple app
instances), rate limit state must be shared — hence Redis as the backing store.

Design decisions:

- **Fixed-window counter** — Redis `INCR` + `EXPIRE` for simplicity and
  atomicity; no Lua scripts needed
- **Per-IP keying** — `rateLimit:login:{ip}` and `rateLimit:refresh:{ip}`
- **Fail-open** — if Redis is unavailable, requests pass through (availability
  over security for a non-critical path; logs a warning)
- **`ioredis` package** — mature, TypeScript-friendly, built-in reconnection and
  error handling
- **Factory middleware pattern** — follows the existing `createAuthMiddleware`
  convention (factory function returning Express middleware, not an injectable
  class)
- **Only login and refresh** — these are the brute-forceable endpoints;
  register, profile, logout are either idempotent or already auth-protected

## Technical Specification

### Architecture

```
                    ┌──────────────┐
                    │    Redis     │
                    │  (counter)   │
                    └──────┬───────┘
                           │
  POST /login ─────► rateLimitMiddleware("login") ─────► UserController.login
  POST /refresh ───► rateLimitMiddleware("refresh") ──► UserController.refresh

  rateLimitMiddleware(endpointKey):
    1. Build Redis key: `rateLimit:{endpointKey}:{req.ip}`
    2. INCR key → current count
    3. If count === 1 → EXPIRE key {windowSeconds}
    4. If count > maxAttempts → 429 + Retry-After header
    5. Else → next()
    6. On Redis error → log warning, next() (fail-open)
```

### New DI Symbols

| Symbol                     | Type                | Description                    |
| -------------------------- | ------------------- | ------------------------------ |
| `TYPES.RedisClient`        | `Redis` (ioredis)   | Shared Redis connection        |
| `TYPES.LoginRateLimiter`   | middleware function | Rate limiter for POST /login   |
| `TYPES.RefreshRateLimiter` | middleware function | Rate limiter for POST /refresh |

### Config Schema Additions

Add two new top-level sections to `src/config/schema.ts`:

```typescript
const redisSchema = z.object({
  host: z.string().default("redis"),
  port: z.number().default(6379),
  password: z.string().optional(),
});

const rateLimitEndpointSchema = z.object({
  maxAttempts: z.number(),
  windowSeconds: z.number(),
});

const rateLimitSchema = z.object({
  login: rateLimitEndpointSchema.default({
    maxAttempts: 5,
    windowSeconds: 900,
  }),
  refresh: rateLimitEndpointSchema.default({
    maxAttempts: 10,
    windowSeconds: 900,
  }),
});
```

Add to `configSchema`:

```typescript
redis: redisSchema.default({ host: 'redis', port: 6379 }),
rateLimit: rateLimitSchema.default({
    login: { maxAttempts: 5, windowSeconds: 900 },
    refresh: { maxAttempts: 10, windowSeconds: 900 },
}),
```

**Pattern note**: Follow the existing sub-schema extraction pattern (see
`serverSchema`, `databaseSchema`, `authSchema` at the top of `schema.ts`).
Extract each sub-schema into its own `const` before referencing in
`configSchema` — this avoids the Zod nested `.default({})` TypeScript issue
documented in MEMORY.md.

### Key Files

| File                                      | Action | Role                                                                     |
| ----------------------------------------- | ------ | ------------------------------------------------------------------------ |
| `src/config/schema.ts`                    | MODIFY | Add `redis` and `rateLimit` sections                                     |
| `config/default.json`                     | MODIFY | Add `redis` and `rateLimit` defaults                                     |
| `config/test.json`                        | MODIFY | Add `redis` and `rateLimit` for test env                                 |
| `src/lib/types.ts`                        | MODIFY | Add `RedisClient`, `LoginRateLimiter`, `RefreshRateLimiter` symbols      |
| `src/middleware/rate-limit-middleware.ts` | NEW    | `createRateLimitMiddleware` factory + `RateLimitMiddlewareFunction` type |
| `src/redis/redis-client-factory.ts`       | NEW    | `createRedisClient(config)` factory                                      |
| `src/inversify.config.ts`                 | MODIFY | Bind Redis client + rate limit middleware                                |
| `src/index.ts`                            | MODIFY | Create Redis client at startup, pass to container, graceful shutdown     |
| `src/controllers/user-controller.ts`      | MODIFY | Add rate limit middleware to `@httpPost` decorators                      |
| `src/errors/rate-limit-error.ts`          | NEW    | `RateLimitError` (429) extending `AppError`                              |
| `src/errors/index.ts`                     | MODIFY | Re-export `RateLimitError`                                               |
| `docker-compose.yml`                      | MODIFY | Add `redis` service                                                      |

### Middleware Pattern

Follow the existing factory pattern from `src/middleware/auth-middleware.ts`:

```typescript
// src/middleware/rate-limit-middleware.ts
import type { Request, Response, NextFunction } from "express";
import type Redis from "ioredis";

export type RateLimitMiddlewareFunction = (
  req: Request,
  res: Response,
  next: NextFunction,
) => void;

export interface RateLimitConfig {
  maxAttempts: number;
  windowSeconds: number;
}

export function createRateLimitMiddleware(
  redisClient: Redis | null,
  endpointKey: string,
  config: RateLimitConfig,
): RateLimitMiddlewareFunction {
  // ... implementation
}
```

**Key design details**:

- `redisClient` is `Redis | null` — when `null`, middleware is a no-op
  passthrough
- Use `req.ip` for the client IP (Express sets this from `X-Forwarded-For` when
  `trust proxy` is configured)
- Redis key format: `rateLimit:{endpointKey}:{ip}`
- The `INCR` → `EXPIRE` pair is not perfectly atomic but is good enough for rate
  limiting (worst case: one extra request leaks through on the first window). If
  a Lua script is preferred for strictness, that's acceptable too
- `Retry-After` header value: the TTL remaining on the Redis key (use `TTL`
  command), or fall back to `windowSeconds` if TTL is unavailable

### Error Response

HTTP 429:

```json
{ "message": "Too many requests. Please try again later." }
```

With `Retry-After: <seconds>` header.

The `RateLimitError` class:

```typescript
export class RateLimitError extends AppError {
  readonly statusCode = 429;
  constructor() {
    super("Too many requests. Please try again later.");
  }
}
```

Note: The middleware itself will send the 429 response directly (like auth
middleware sends 401 directly), so `RateLimitError` is provided for consistency
with the error hierarchy but is not strictly required in the middleware. It can
be used if the controller-level `handleError` needs to handle it.

### Controller Wiring

The `inversify-express-utils` `@httpPost` decorator accepts middleware symbols:

```typescript
@httpPost('/login', TYPES.LoginRateLimiter)
async login(req: Request, res: Response): Promise<void> { ... }

@httpPost('/refresh', TYPES.RefreshRateLimiter)
async refresh(req: Request, res: Response): Promise<void> { ... }
```

This follows the same pattern as `TYPES.AuthMiddleware` on `/logout`,
`/profile`.

### DI Wiring (`inversify.config.ts`)

```typescript
// Bind Redis client (may be null if connection failed)
container.bind<Redis | null>(TYPES.RedisClient).toConstantValue(redisClient);

// Bind rate limit middleware
container
  .bind<RateLimitMiddlewareFunction>(TYPES.LoginRateLimiter)
  .toConstantValue(
    createRateLimitMiddleware(redisClient, "login", config.rateLimit.login),
  );

container
  .bind<RateLimitMiddlewareFunction>(TYPES.RefreshRateLimiter)
  .toConstantValue(
    createRateLimitMiddleware(redisClient, "refresh", config.rateLimit.refresh),
  );
```

### Bootstrap Changes (`src/index.ts`)

```typescript
import { createRedisClient } from "./redis/redis-client-factory";

// After loadConfig/loadSecrets, before createContainer:
const redisClient = await createRedisClient(config);

const diContainer = createContainer(config, dataSource, secrets, redisClient);
```

The `createRedisClient` factory:

- Attempts to connect to Redis
- On success: returns the `Redis` instance
- On failure: logs a warning (`console.warn`), returns `null`
- The container and middleware handle `null` gracefully (fail-open)

### Docker Compose

Add a Redis service:

```yaml
redis:
  image: redis:7-alpine
  container_name: marta-redis
  ports:
    - "6379:6379"
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 5s
    timeout: 5s
    retries: 5
```

Update `app.depends_on` to include `redis` with `condition: service_healthy`.

### Testing Strategy

**Unit tests** (`tests/unit/middleware/rate-limit-middleware.test.ts`):

- Mock the Redis client (jest mock object with `incr`, `expire`, `ttl` methods)
- Test cases:
  - Under limit → calls `next()`, does not send response
  - At limit (count === maxAttempts) → calls `next()` (still allowed)
  - Over limit (count > maxAttempts) → sends 429 with correct body and
    `Retry-After` header
  - First request in window (count === 1) → calls `expire` to set TTL
  - Subsequent requests → does NOT call `expire`
  - Redis error → logs warning, calls `next()` (fail-open)
  - `redisClient` is `null` → calls `next()` immediately (no-op)
  - Correct Redis key format: `rateLimit:{endpointKey}:{req.ip}`
  - `Retry-After` header uses TTL from Redis

**Unit tests** (`tests/unit/config/schema.test.ts` — extend existing):

- New `redis` section defaults correctly
- New `rateLimit` section defaults correctly
- Custom values override defaults

**Integration tests**
(`tests/integration/middleware/rate-limit-middleware.test.ts`):

- Against real Redis (available in docker-compose)
- Test full window lifecycle: make N requests, verify N+1 is blocked
- Verify TTL is set correctly
- Verify counter resets after window expires (use small window for test)

### Dependencies

- **Add**: `ioredis` (production dependency)
- **Add**: `@types/ioredis` — **not needed**, `ioredis` ships its own types

### Edge Cases

1. **`req.ip` is `undefined`** — Express can return `undefined` if proxy headers
   are malformed. Use a fallback key like `unknown` to avoid Redis key issues.
2. **Redis reconnection** — `ioredis` handles reconnection automatically with
   exponential backoff. During reconnection, commands will fail → fail-open.
3. **Race condition on INCR/EXPIRE** — if the process crashes between `INCR` and
   `EXPIRE`, the key lives forever. Mitigate: always set `EXPIRE` when count is
   1, and use `TTL` to check if a key somehow lost its expiry (defensive, not
   mandatory for first implementation).
4. **IPv6 addresses** — Redis keys are strings, so IPv6 addresses work fine as
   key components.

## Milestones

### Milestone 1: Config Schema + Redis/RateLimit Sections

- **Description**: Extend the Zod config schema with `redis` and `rateLimit`
  sections. Update `config/default.json` and `config/test.json`.
- **Acceptance Criteria**:
  - [x] `redisSchema` with `host` (default `'redis'`), `port` (default `6379`),
        optional `password`
  - [x] `rateLimitEndpointSchema` with `maxAttempts` (number) and
        `windowSeconds` (number)
  - [x] `rateLimitSchema` with `login` (default 5/900) and `refresh` (default
        10/900) sub-objects
  - [x] Both added to `configSchema` with sensible `.default()` values
  - [x] `AppConfig` type correctly infers the new sections
  - [x] `config/default.json` includes `redis` and `rateLimit` sections
  - [x] `config/test.json` includes `redis` (host `localhost` for isolated runs)
        and `rateLimit` sections
  - [x] Unit tests: schema parses with defaults, custom values override, invalid
        values rejected
- **Red phase**: Write schema unit tests first (extend existing config tests or
  create new ones)
- **Green phase**: Modify `src/config/schema.ts`, update JSON config files
- **Status**: done

### Milestone 2: Redis Client Factory

- **Description**: Create a factory function that connects to Redis and handles
  failures gracefully (returns `null` on connection failure).
- **Acceptance Criteria**:
  - [x] `src/redis/redis-client-factory.ts` exports
        `createRedisClient(config: AppConfig): Promise<Redis | null>`
  - [x] On successful connection: returns `Redis` instance
  - [x] On connection failure: logs warning, returns `null`
  - [x] `TYPES.RedisClient` symbol added to `src/lib/types.ts`
  - [x] Unit tests: mock `ioredis` constructor, test success path (returns
        client), test failure path (returns `null`, logs warning)
- **Red phase**: Write unit tests for `createRedisClient` (mock ioredis)
- **Green phase**: Implement `src/redis/redis-client-factory.ts`, add DI symbol
- **Status**: done

### Milestone 3: Rate Limit Middleware

- **Description**: Create `createRateLimitMiddleware` factory following the
  existing auth middleware pattern.
- **Acceptance Criteria**:
  - [x] `src/middleware/rate-limit-middleware.ts` exports
        `createRateLimitMiddleware`, `RateLimitMiddlewareFunction`,
        `RateLimitConfig` types
  - [x] Under limit → calls `next()`
  - [x] Over limit → responds 429 with
        `{ message: "Too many requests. Please try again later." }` and
        `Retry-After` header
  - [x] First request sets `EXPIRE` on the Redis key
  - [x] Redis error → logs warning, calls `next()` (fail-open)
  - [x] `null` Redis client → calls `next()` immediately (no-op)
  - [x] Key format: `rateLimit:{endpointKey}:{req.ip}`
  - [x] Handles `undefined` `req.ip` gracefully (fallback key)
  - [x] `RateLimitError` class in `src/errors/rate-limit-error.ts` (429)
  - [x] `TYPES.LoginRateLimiter` and `TYPES.RefreshRateLimiter` symbols added
  - [x] Full unit test suite with mocked Redis client
- **Red phase**: Write comprehensive unit tests for the middleware factory
- **Green phase**: Implement `rate-limit-middleware.ts`, `rate-limit-error.ts`,
  add DI symbols
- **Status**: done

### Milestone 4: DI Wiring + Controller Integration

- **Description**: Wire rate limit middleware into the DI container and apply to
  login and refresh endpoints.
- **Acceptance Criteria**:
  - [x] `createContainer` accepts `redisClient: Redis | null` as 4th parameter
  - [x] `TYPES.LoginRateLimiter` bound to
        `createRateLimitMiddleware(redisClient, 'login', config.rateLimit.login)`
  - [x] `TYPES.RefreshRateLimiter` bound to
        `createRateLimitMiddleware(redisClient, 'refresh', config.rateLimit.refresh)`
  - [x] `TYPES.RedisClient` bound to constant value
  - [x] `@httpPost('/login', TYPES.LoginRateLimiter)` on `UserController.login`
  - [x] `@httpPost('/refresh', TYPES.RefreshRateLimiter)` on
        `UserController.refresh`
  - [x] `src/index.ts` calls `createRedisClient(config)` and passes result to
        `createContainer`
  - [x] Existing unit tests for UserController still pass (middleware is applied
        at decorator level, not in controller logic)
- **Red phase**: Write/update DI container tests verifying new bindings
- **Green phase**: Modify `inversify.config.ts`, `user-controller.ts`,
  `index.ts`
- **Status**: done

### Milestone 5: Docker Compose + Config Files

- **Description**: Add Redis service to docker-compose and ensure all services
  start correctly.
- **Acceptance Criteria**:
  - [x] `redis` service in `docker-compose.yml` (redis:7-alpine, healthcheck)
  - [x] `app` service `depends_on` includes `redis` with
        `condition: service_healthy`
  - [x] `config/default.json` `redis.host` is `'redis'` (docker service name)
  - [x] `config/test.json` `redis.host` is `'redis'` (for
        `make test-integration` which runs inside Docker)
  - [x] `make up` starts Redis alongside Postgres and the app
  - [x] App starts successfully even if Redis is unavailable (fail-open
        verified)
- **Red phase**: N/A (infrastructure change — verified by running `make up`)
- **Green phase**: Modify `docker-compose.yml`, verify startup
- **Status**: done

### Milestone 6: Integration Tests

- **Description**: Test rate limiting against a real Redis instance via
  docker-compose.
- **Acceptance Criteria**:
  - [x] `tests/integration/middleware/rate-limit-middleware.test.ts`
  - [x] Test: requests under limit pass through
  - [x] Test: request at limit+1 returns 429 with correct body
  - [x] Test: `Retry-After` header is present and numeric
  - [x] Test: counter resets after window expires (use a small windowSeconds
        like 2 for test speed)
  - [x] Test: different IPs / endpoint keys have independent counters
  - [x] Uses real Redis connection (host: `redis`, port: `6379` — matches
        docker-compose)
  - [x] Follows existing integration test patterns (see
        `tests/integration/repositories/refresh-token-repository.test.ts`)
- **Red phase**: Write integration tests
- **Green phase**: Tests should pass against implementation from prior
  milestones
- **Status**: done

## Implementation Order

Milestones 1→2→3→4→5→6 (sequential — each builds on the previous). Milestone 5
(Docker) can be done in parallel with Milestone 3 or 4 if desired, but it's
cleaner to do it after the code is ready.

## Coding Guidelines

- Follow existing patterns strictly (factory functions for middleware, `TYPES`
  symbols, Zod sub-schema extraction)
- Keep `ioredis` as the only new dependency — do not add `express-rate-limit` or
  similar libraries
- The middleware must not modify `req` or `res` on the happy path (just call
  `next()`)
- All `console.warn` calls for Redis failures should include the error message
  for debugging
- TypeScript strict mode — no `any` types, no type assertions except where
  unavoidable
