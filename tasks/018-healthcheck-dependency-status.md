# Task: Health Check with Dependency Status

## Status: pending

## Context

The current health check endpoint (`GET /partner-app/api/health-check`) returns
a static `{ message: "Service is up and running" }` regardless of whether
dependencies (PostgreSQL, Redis) are actually reachable. This is inadequate for
production monitoring — orchestrators and load balancers need to know if the
service can actually serve requests.

Additionally, the health check logic currently lives inside `BaseController` as
an `@httpGet('/')` method (line 10-13 of `src/lib/base-controller.ts`), which
violates separation of concerns. A base class should not contain endpoint logic.
`HealthCheckController` already exists but is an empty shell that just extends
`BaseController`.

## Technical Specification

### Architecture Decisions

**Move health check out of BaseController**: Remove the `@httpGet('/')` method
and the `@controller('/health-check')` decorator from `BaseController`. The base
class becomes a plain abstract class extending `BaseHttpController` with no
route decorators. All health check logic moves into `HealthCheckController`.

**HealthCheckController gets DI injection**: The controller needs `DataSource`
and `RedisClient` to probe dependencies. Use constructor injection with
`@inject(TYPES.DataSource)` and `@inject(TYPES.RedisClient)`, following the same
pattern as `UserController` (see `src/controllers/user-controller.ts` lines
13-17).

**Add `ping()` method to RedisClient facade**: The facade currently exposes
`incr`, `expire`, `ttl`, and `quit`. Add a `ping()` method that returns
`Promise<boolean>` — `true` if the underlying client responds to PING, `false`
if the client is null or the command fails. Follows the existing fail-open
pattern (no throw, log warning on failure).

**Opaque response format**: The response exposes only an overall status — no
dependency names or infrastructure details are revealed to consumers.

```
200 — healthy (all dependencies up)
{ "status": "healthy" }

200 — degraded (cache down, DB up — cache is non-critical)
{ "status": "degraded" }

503 — unhealthy (database down — DB is critical)
{ "status": "unhealthy" }
```

**Status determination logic** (internal, not exposed in the response):

- Database UP + Cache UP → `healthy`
- Database UP + Cache DOWN → `degraded` (cache is non-critical, fail-open)
- Database DOWN + Cache UP → `unhealthy` (database is critical)
- Database DOWN + Cache DOWN → `unhealthy`

**Dependency check methods**:

- Database: `dataSource.query('SELECT 1')` — a no-op query that verifies the
  connection is alive. Wrap in try/catch; any error means "down".
- Cache: `redisClient.ping()` — the new method on the facade.

### Files to Modify/Create

| File                                                     | Change                                                                                                                                  |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `src/redis/redis-client.ts`                              | Add `ping(): Promise<boolean>` method                                                                                                   |
| `tests/unit/redis/redis-client.test.ts`                  | Add tests for `ping()` (null client, working client, error)                                                                             |
| `src/lib/base-controller.ts`                             | Remove `@controller('/health-check')` decorator and `healthCheck()` method. Keep as plain abstract class extending `BaseHttpController` |
| `src/controllers/health-check-controller.ts`             | Add constructor with `@inject(TYPES.DataSource)` and `@inject(TYPES.RedisClient)`. Implement `@httpGet('/')` with dependency checks     |
| `tests/unit/controllers/health-check-controller.test.ts` | **NEW** — Unit tests for the controller (mock DataSource and RedisClient)                                                               |
| `src/openapi/spec.ts`                                    | Update `/health-check` path with new response schema (200, 503), add `HealthCheckResponse` component schema                             |
| `tests/unit/openapi/spec.test.ts`                        | Update/add assertions for new health check response schema                                                                              |
| `tests/acceptance/specs/health-check.test.ts`            | Expand: verify response body shape, `status: "healthy"`                                                                                 |

### Coding Guidelines

- Follow the existing controller pattern: `@controller` decorator, constructor
  with `@inject`, `super()` call, `this.json()` for responses.
- `RedisClient.ping()` follows the exact same pattern as `incr`/`expire`/`ttl`:
  null client returns safe default (`false`), error logs warning and returns
  `false`. Keep the existing `[RATE-LIMIT DEGRADED]` log prefix to avoid scope
  creep.
- The health check method should run both dependency checks in parallel using
  `Promise.all` (both are individually wrapped in try/catch so no unhandled
  rejections).
- Use `make test-unit` for unit tests, `make test-acceptance` for acceptance
  tests. Never run npm/npx directly.

### Testing Strategy

**Unit tests for `RedisClient.ping()`** (in existing test file
`tests/unit/redis/redis-client.test.ts`):

- `ping()` with null client returns `false`
- `ping()` with working client returns `true` (mock `client.ping()` resolving to
  `'PONG'`)
- `ping()` with failing client returns `false` and logs warning

Follow the existing mock pattern in that file: `createMockIoredis()` returns an
object with jest.fn() stubs, cast as `never` when passed to the constructor. Add
`ping: jest.fn()` to the mock factory.

**Unit tests for `HealthCheckController`** (new file
`tests/unit/controllers/health-check-controller.test.ts`):

- All dependencies up → 200, `{ status: "healthy" }`
- Cache down, DB up → 200, `{ status: "degraded" }`
- DB down, cache up → 503, `{ status: "unhealthy" }`
- Both down → 503, `{ status: "unhealthy" }`
- DB query throws → treated as "down"

Check `tests/unit/controllers/user-controller.test.ts` for the existing
controller testing pattern (how mocks are set up, how `this.json()` is
asserted). Mock `DataSource` with `{ query: jest.fn() }` and `RedisClient` with
`{ ping: jest.fn() }`.

**Acceptance tests** (`tests/acceptance/specs/health-check.test.ts`): The
existing test only checks `res.status === 200`. Expand it to verify the response
body structure. In the Docker environment both PostgreSQL and Redis are running,
so expect `{ status: "healthy" }`.

### Edge Cases

1. **DataSource.query() hangs**: Not handled in this task (would need a timeout
   wrapper). The `SELECT 1` query should be near-instant on any live connection.
   Document as a future improvement if needed.
2. **RedisClient with null underlying client**: `ping()` returns `false`. The
   health check shows overall status as "degraded" (not "unhealthy", since cache
   is non-critical).
3. **Both checks failing simultaneously**: Return 503 with `"unhealthy"`.
4. **BaseController import side-effect**: After removing the `@controller`
   decorator from `BaseController`, the side-effect import
   `import './lib/base-controller'` in `src/inversify.config.ts` (line 5) is no
   longer needed for route registration. Remove it. `HealthCheckController` and
   `UserController` both import `BaseController` directly via their own import
   statements, so TypeScript still loads the module.

## Milestones

### Milestone 1: RedisClient.ping() and BaseController Cleanup

- **Description**: Add `ping()` to `RedisClient` and remove the health check
  endpoint from `BaseController`. After this milestone, the health check route
  temporarily stops working (the old one is removed, the new one is not yet
  implemented).
- **Acceptance Criteria**:
  - [ ] `RedisClient.ping()` returns `true` when underlying client responds
  - [ ] `RedisClient.ping()` returns `false` when client is null
  - [ ] `RedisClient.ping()` returns `false` and logs warning on error
  - [ ] Unit tests for `ping()` added to `tests/unit/redis/redis-client.test.ts`
  - [ ] `BaseController` no longer has `@controller('/health-check')` or
        `healthCheck()` method
  - [ ] `BaseController` is a plain abstract class extending
        `BaseHttpController`
  - [ ] Side-effect import of `'./lib/base-controller'` removed from
        `src/inversify.config.ts` (line 5)
  - [ ] `make test-unit` passes (health check acceptance tests may fail
        temporarily)
- **Status**: pending

### Milestone 2: HealthCheckController with Dependency Status

- **Description**: Implement the new health check endpoint in
  `HealthCheckController` with dependency probing and the three-state response
  format (healthy / degraded / unhealthy).
- **Acceptance Criteria**:
  - [ ] `HealthCheckController` has constructor with `@inject(TYPES.DataSource)`
        and `@inject(TYPES.RedisClient)`
  - [ ] `@httpGet('/')` method probes both dependencies
  - [ ] Returns 200 with `{ status: "healthy" }` when all deps are up
  - [ ] Returns 200 with `{ status: "degraded" }` when cache is down but DB is
        up
  - [ ] Returns 503 with `{ status: "unhealthy" }` when DB is down
  - [ ] Response body contains ONLY the `status` field — no dependency details
  - [ ] New unit test file
        `tests/unit/controllers/health-check-controller.test.ts` with all
        scenarios
  - [ ] `make test-unit` passes
- **Status**: pending

### Milestone 3: OpenAPI Spec Update

- **Description**: Update the OpenAPI spec to reflect the new health check
  response schema and the 503 response.
- **Acceptance Criteria**:
  - [ ] `/health-check` GET `200` response uses `HealthCheckResponse` schema
        with `status` enum (`healthy`, `degraded`)
  - [ ] `/health-check` GET has `503` response for unhealthy state with same
        schema (status: `unhealthy`)
  - [ ] `HealthCheckResponse` schema added to `components.schemas`
  - [ ] Old `message` property removed from health check response
  - [ ] OpenAPI unit tests updated
  - [ ] `make test-unit` passes
- **Status**: pending

### Milestone 4: Acceptance Tests

- **Description**: Update acceptance tests to verify the new health check
  response format against the live Docker environment.
- **Acceptance Criteria**:
  - [ ] `GET /partner-app/api/health-check` returns 200
  - [ ] Response body has `status: "healthy"`
  - [ ] Response body does NOT contain `message` field (old format removed)
  - [ ] `make test-acceptance` passes
- **Status**: pending

## Implementation Order

Milestones 1 → 2 → 3 → 4 (strictly sequential).
