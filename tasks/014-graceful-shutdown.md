# Task: Graceful Shutdown

## Status: pending

## Context

When a containerized application receives SIGTERM (e.g., during a rolling
deployment or `docker stop`), it should shut down cleanly: stop accepting new
connections, drain in-flight requests, close database and Redis connections, and
exit with code 0. Without this, active requests are aborted mid-flight and
database connections leak.

This is a standard production-readiness feature and a differentiator for the
case study. The current `src/index.ts` has no signal handling —
`process.exit(1)` is only called on startup failure.

## Technical Specification

### Architecture

The shutdown logic must be **extracted into a testable unit**, not buried inside
`src/index.ts`. A pure function `createShutdownHandler` will accept the
dependencies it needs to close and return a handler function. The bootstrap code
in `index.ts` simply wires it up.

```
  SIGTERM / SIGINT
        │
        ▼
  shutdownHandler()
    1. server.close()          ← stop accepting new connections
    2. await drainTimeout      ← wait for in-flight requests (configurable)
    3. await dataSource.destroy()   ← close DB pool
    4. await redisClient.quit()     ← close Redis (if connected)
    5. process.exit(0)
```

### Key Design Decisions

- **Factory function, not a class** — follows the existing middleware factory
  pattern (`createAuthMiddleware`, `createRateLimitMiddleware`). A
  `createShutdownHandler(deps)` function returns `() => Promise<void>`.
- **Configurable drain timeout** — defaults to 10 seconds. After the timeout,
  force-close remaining connections and exit. Use `setTimeout` +
  `server.close()` callback.
- **Idempotent** — if SIGTERM is received twice (common with container
  orchestrators), the second call is a no-op. Use a `shuttingDown` boolean
  guard.
- **RedisClient needs a `quit()` method** — the current `RedisClient` facade
  does not expose disconnect. Add a `quit(): Promise<void>` method that calls
  `this.client.quit()` (or no-ops if `client` is null). This is a small,
  backward-compatible addition.
- **Logging** — use `console.log` for shutdown lifecycle events (consistent with
  existing startup logging in `index.ts`).
- **No new dependencies** — Node.js `http.Server.close()`, TypeORM
  `DataSource.destroy()`, and ioredis `Redis.quit()` are sufficient.

### New Files

| File                          | Role                                                       |
| ----------------------------- | ---------------------------------------------------------- |
| `src/shutdown.ts`             | `createShutdownHandler` factory + `ShutdownDeps` interface |
| `tests/unit/shutdown.test.ts` | Unit tests for shutdown handler                            |

### Modified Files

| File                                    | Change                                                                                             |
| --------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/redis/redis-client.ts`             | Add `quit(): Promise<void>` method                                                                 |
| `src/index.ts`                          | Capture `server.listen()` return value; call `createShutdownHandler` and register signal listeners |
| `tests/unit/redis/redis-client.test.ts` | Add tests for the new `quit()` method                                                              |

### `src/shutdown.ts` — Detailed Design

```typescript
import type { Server } from "http";
import type { DataSource } from "typeorm";
import type { RedisClient } from "./redis/redis-client";

export interface ShutdownDeps {
  server: Server;
  dataSource: DataSource;
  redisClient: RedisClient;
  drainTimeoutMs?: number; // default: 10_000
  logger?: Pick<Console, "log" | "error">; // default: console
  exit?: (code: number) => void; // default: process.exit — injectable for testing
}

export function createShutdownHandler(deps: ShutdownDeps): () => Promise<void> {
  const {
    server,
    dataSource,
    redisClient,
    drainTimeoutMs = 10_000,
    logger = console,
    exit = process.exit,
  } = deps;

  let shuttingDown = false;

  return async () => {
    if (shuttingDown) return; // idempotent guard
    shuttingDown = true;

    logger.log("Shutdown signal received — closing server...");

    // 1. Stop accepting new connections
    server.close();

    // 2. Force-exit timer (safety net)
    const forceTimer = setTimeout(() => {
      logger.error("Drain timeout exceeded — forcing exit");
      exit(1);
    }, drainTimeoutMs);
    // Unref so it doesn't keep the process alive if everything closes cleanly
    if (typeof forceTimer.unref === "function") forceTimer.unref();

    try {
      // 3. Close database connection pool
      if (dataSource.isInitialized) {
        await dataSource.destroy();
        logger.log("Database connection closed");
      }

      // 4. Close Redis connection
      await redisClient.quit();
      logger.log("Redis connection closed");
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`Error during shutdown: ${msg}`);
    }

    clearTimeout(forceTimer);
    logger.log("Shutdown complete");
    exit(0);
  };
}
```

**Key testability features**:

- `exit` is injectable (tests pass a mock instead of `process.exit`)
- `logger` is injectable (tests can assert log messages or suppress output)
- The returned function is a plain async function — no signal registration
  inside, so tests call it directly without sending real signals

### `src/redis/redis-client.ts` — New Method

```typescript
async quit(): Promise<void> {
    if (!this.client) return;

    try {
        await this.client.quit();
    } catch (error: unknown) {
        this.logWarning('quit', error);
    }
}
```

Follows the same fail-safe pattern as existing methods (`incr`, `expire`,
`ttl`).

### `src/index.ts` — Bootstrap Changes

```typescript
// Change: capture the return value of server.listen()
const httpServer = server.listen(config.server.port, () => {
  console.log(`Server listening on port ${config.server.port}`);
});

// Add: register graceful shutdown
const shutdown = createShutdownHandler({
  server: httpServer,
  dataSource,
  redisClient,
});

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
```

### Testing Strategy

**Unit tests** (`tests/unit/shutdown.test.ts`) — all pure mocks, no real servers
or databases:

Mock objects:

- `server`: `{ close: jest.fn(cb => cb()) }` — simulates `http.Server`
- `dataSource`:
  `{ isInitialized: true, destroy: jest.fn().mockResolvedValue(undefined) }`
- `redisClient`: `{ quit: jest.fn().mockResolvedValue(undefined) }`
- `exit`: `jest.fn()`
- `logger`: `{ log: jest.fn(), error: jest.fn() }`

Test cases:

1. **Happy path**: calls `server.close()`, `dataSource.destroy()`,
   `redisClient.quit()`, then `exit(0)`
2. **Cleanup order**: `server.close()` is called before `dataSource.destroy()`
   and `redisClient.quit()`
3. **Idempotent**: calling the handler twice only executes cleanup once
4. **DataSource not initialized**: skips `dataSource.destroy()` when
   `dataSource.isInitialized` is `false`
5. **DataSource.destroy() rejects**: logs error, still calls `exit(0)` (does not
   hang)
6. **RedisClient.quit() rejects**: logs error, still calls `exit(0)`
7. **Both destroy and quit reject**: logs errors, still exits
8. **Logging**: shutdown lifecycle messages are logged via the injected logger
9. **Default drain timeout**: force timer is set (verify via `setTimeout` spy or
   by testing the timeout behavior with fake timers)

**Unit tests** (`tests/unit/redis/redis-client.test.ts` — extend existing):

1. `quit()` with null client returns without error
2. `quit()` delegates to underlying client
3. `quit()` swallows errors and logs warning (fail-safe)

### Edge Cases

1. **Double signal** — container orchestrators often send SIGTERM then SIGINT
   shortly after. The idempotent guard prevents double cleanup.
2. **DataSource never initialized** — if shutdown happens during startup (before
   `dataSource.initialize()`), `isInitialized` is `false` so `destroy()` is
   skipped.
3. **Redis was null at startup** — `RedisClient.quit()` on a null-backed
   instance is a no-op (by design of the new method).
4. **Force timeout** — if `dataSource.destroy()` hangs (e.g., long-running
   query), the force timer ensures the process exits after `drainTimeoutMs`.
5. **`server.close()` callback timing** — `server.close()` invokes its callback
   after all existing connections are drained. We do NOT await this callback in
   the shutdown handler (we use the force timer instead) to avoid indefinite
   hangs from keep-alive connections.

## Milestones

### Milestone 1: Add `quit()` Method to RedisClient

- **Description**: Extend the `RedisClient` facade with a `quit()` method that
  gracefully disconnects from Redis (or no-ops if no connection exists). This is
  a prerequisite for the shutdown handler.
- **Acceptance Criteria**:
  - [ ] `RedisClient.quit()` returns `Promise<void>`
  - [ ] When `client` is `null`, `quit()` resolves immediately without error
  - [ ] When `client` is connected, `quit()` calls `this.client.quit()`
  - [ ] When `this.client.quit()` rejects, the error is caught and logged via
        `logWarning('quit', error)` — does NOT throw
  - [ ] Unit tests added to `tests/unit/redis/redis-client.test.ts` covering all
        three cases (null client, success, error)
  - [ ] All existing RedisClient tests still pass
- **Red phase**: Add 3 new test cases to the existing `redis-client.test.ts`
- **Green phase**: Add `quit()` method to `src/redis/redis-client.ts`
- **Status**: pending

### Milestone 2: Create Shutdown Handler

- **Description**: Implement `createShutdownHandler` as a testable factory
  function with fully injectable dependencies.
- **Acceptance Criteria**:
  - [ ] `src/shutdown.ts` exports `createShutdownHandler` and `ShutdownDeps`
  - [ ] Handler calls `server.close()` first
  - [ ] Handler calls `dataSource.destroy()` when `isInitialized` is `true`
  - [ ] Handler skips `dataSource.destroy()` when `isInitialized` is `false`
  - [ ] Handler calls `redisClient.quit()`
  - [ ] Handler calls `exit(0)` on success
  - [ ] Handler is idempotent — second invocation is a no-op
  - [ ] Errors in `destroy()` or `quit()` are caught, logged, and do not prevent
        `exit(0)`
  - [ ] Force timeout calls `exit(1)` if cleanup exceeds `drainTimeoutMs`
  - [ ] All lifecycle events are logged via the injected `logger`
  - [ ] Unit tests in `tests/unit/shutdown.test.ts` cover all 9 test cases
        listed in the Testing Strategy
  - [ ] `make test-unit` passes
- **Red phase**: Write `tests/unit/shutdown.test.ts` with all test cases
  (failing — no implementation yet)
- **Green phase**: Implement `src/shutdown.ts`
- **Status**: pending

### Milestone 3: Wire Shutdown into Bootstrap

- **Description**: Integrate the shutdown handler into `src/index.ts` by
  capturing the HTTP server instance and registering signal listeners.
- **Acceptance Criteria**:
  - [ ] `server.listen()` return value is captured as `httpServer`
  - [ ] `createShutdownHandler` is called with `httpServer`, `dataSource`,
        `redisClient`
  - [ ] `process.on('SIGTERM', shutdown)` is registered
  - [ ] `process.on('SIGINT', shutdown)` is registered
  - [ ] Application starts normally (`make up` succeeds)
  - [ ] `docker stop <container>` triggers graceful shutdown (visible in logs:
        "Shutdown signal received", "Database connection closed", "Shutdown
        complete")
  - [ ] `make test-unit` still passes (no regressions)
  - [ ] `make typecheck` passes
- **Red phase**: N/A — this is pure wiring of already-tested components
- **Green phase**: Modify `src/index.ts`
- **Status**: pending

## Implementation Order

Milestones 1 -> 2 -> 3 (strictly sequential). Milestone 1 is a prerequisite for
Milestone 2 (the shutdown handler depends on `RedisClient.quit()`). Milestone 3
is pure wiring that depends on both prior milestones.

## Coding Guidelines

- Follow existing factory function pattern (see `createAuthMiddleware`,
  `createRateLimitMiddleware`)
- Follow existing `RedisClient` fail-safe pattern for the new `quit()` method
- No `any` types, no type assertions except where unavoidable (e.g., mocks use
  `as never` per existing convention)
- Use `console.log`/`console.error` for consistency with existing bootstrap
  logging (no new logging library)
- Keep `src/shutdown.ts` as a single focused module — no classes, just the
  factory function and its types
- Mocks in tests follow the existing style: plain objects cast with `as never`
  (see `tests/unit/redis/redis-client.test.ts` line 30)
