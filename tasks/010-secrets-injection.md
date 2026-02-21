# Task: Secrets Injection — Centralize All Secrets via loadSecrets()

## Status: done

## Context

Currently, secrets are scattered across `process.env` reads:

- `JWT_SECRET` — read in `src/middleware/auth-middleware.ts:34` and
  `src/services/user-service.ts:129`
- `DATABASE_USER` / `DATABASE_PASSWORD` — read in
  `src/database/data-source.ts:28-40` via `loadDatabaseCredentials()`

This is fragile, untestable, and won't scale. We need a single `loadSecrets()`
function that:

1. Reads secrets from a **local JSON file** (dev/test) or **AWS SSM**
   (production)
2. Validates them with **Zod** (fail-fast on missing secrets)
3. Returns a frozen `AppSecrets` object
4. Gets bound into DI as `TYPES.Secrets` so every consumer receives secrets via
   injection — no more `process.env` reads in application code

### Why This Matters

- **Testability**: Unit tests currently manipulate `process.env` — fragile and
  global. DI-injected secrets are trivially mockable.
- **Security**: Centralized validation catches missing secrets at startup, not
  at runtime when a user hits an endpoint.
- **Architecture**: Aligns with InversifyJS DI patterns already in use.
  `@aws-sdk/client-ssm` is already a dependency.
- **Competitive edge**: No other candidate centralized secrets management.

## Technical Specification

### Architecture Overview

```
startup flow:
  loadConfig()          → AppConfig (from JSON file)
  loadSecrets(config)   → AppSecrets (from JSON file or SSM)
  createDataSource(config, secrets)  → DataSource
  createContainer(config, dataSource, secrets) → Container
```

### AppSecrets Type

```typescript
// src/config/secrets-schema.ts
import { z } from "zod";

export const secretsSchema = z.object({
  jwtSecret: z.string().min(1, "jwtSecret is required"),
  databaseUser: z.string().min(1, "databaseUser is required"),
  databasePassword: z.string().min(1, "databasePassword is required"),
});

export type AppSecrets = z.infer<typeof secretsSchema>;
```

### Config Schema Extension

Added `ssm` as a top-level optional field on `configSchema` in
`src/config/schema.ts`:

```typescript
// Already implemented in schema.ts
ssm: ssmSchema.optional(),
```

`secretsPath` was removed from the config schema — the file backend now uses the
`SECRETS_PATH` environment variable instead.

- If `config.ssm` is set → load from AWS SSM (takes priority)
- If `SECRETS_PATH` env var is set → load from local JSON file
- If neither → throw at startup

### Secrets Loader

```
src/config/secrets-loader.ts
```

- `loadSecrets(config: AppConfig): Promise<AppSecrets>`
- Two internal backends: `loadFromFile(path)` and `loadFromSSM(ssmConfig)`
- Validates result with `secretsSchema.parse()`
- Returns `Object.freeze(result)`
- The SSM backend reuses the existing `@aws-sdk/client-ssm` dependency (see
  skeleton in `src/typeormconfig.ts` for reference, but write clean new code)

### DI Symbol

Add `Secrets: Symbol.for('Secrets')` to `src/lib/types.ts`.

### Secrets Path

The file backend reads from the `SECRETS_PATH` environment variable (not from
config JSON). Set in `docker-compose.yml` for the app service and passed as env
var in test environments.

**config/secrets.json** (new file, dev/test only):

```json
{
  "jwtSecret": "dev-jwt-secret-do-not-use-in-production",
  "databaseUser": "postgres",
  "databasePassword": "postgres"
}
```

### Docker Compose Cleanup

Removed `DATABASE_USER`, `DATABASE_PASSWORD` from `docker-compose.yml` app
service environment. Added `SECRETS_PATH: /app/config/secrets.json`. Secrets
come from the JSON file mounted via the existing `./config:/app/config` volume.
`POSTGRES_USER` and `POSTGRES_PASSWORD` remain on the postgres service (for
PostgreSQL itself, not our app).

### Files Deleted

- `src/typeormconfig.ts` — skeleton SSM code, replaced by `secrets-loader.ts`

### Coding Guidelines

- Follow the existing Zod pattern in `src/config/schema.ts` — extract
  sub-schemas into `const` before composing
- Use `async/await` consistently (SSM calls are async)
- `loadSecrets` is `async` even for file backend (consistent API, and
  `fs.readFile` should be async)
- Freeze the returned secrets object — no mutation after startup
- Use named exports, no default exports (matches codebase convention)
- Keep the secrets-loader pure — no DI decorators, just a function (like
  `loadConfig`)

### Testing Strategy

- **Unit tests for secrets-loader**: Mock `fs.readFile` and SSM client. Test
  file backend, SSM backend, validation failures, freeze behavior.
- **Unit tests for secrets-schema**: Validate schema parsing, required fields,
  edge cases.
- **Update auth-middleware tests**: Replace `process.env.JWT_SECRET`
  manipulation with passing `jwtSecret` as factory parameter.
- **Update user-service tests**: Inject mock secrets via constructor instead of
  `process.env`.
- **Update data-source tests**: Remove `loadDatabaseCredentials` tests, update
  `createDataSource` to accept secrets directly.
- **Integration tests**: Verify the full bootstrap loads secrets from the JSON
  file.

### Edge Cases

- Missing secrets file → clear error message with file path
- Invalid JSON in secrets file → clear parse error
- SSM returns partial parameters → Zod validation catches it
- Empty string values → Zod `.min(1)` rejects them
- `loadSecrets` called without valid config or env var → throw before attempting
  any I/O
- SSM: multiple config keys mapping to the same parameter name → all keys get
  the value (forward lookup, not reverse map)

---

## Milestones

### Milestone 1: AppSecrets Zod Schema + Config Schema Extension

- **Description**: Create the `AppSecrets` Zod schema and type. Extend the
  existing `configSchema` with an optional `secrets` section for `secretsPath`
  and `ssm` configuration.
- **Files to create**:
  - `src/config/secrets-schema.ts` — `secretsSchema`, `AppSecrets` type
- **Files to modify**:
  - `src/config/schema.ts` — add `secrets` field to `configSchema`
- **Tests to create**:
  - `tests/unit/config/secrets-schema.test.ts`
- **Patterns to follow**: See how `serverSchema`, `databaseSchema`, etc. are
  composed in `src/config/schema.ts:1-35`. Extract sub-schemas as `const` before
  composing into the parent.
- **Acceptance Criteria**:
  - [x] `secretsSchema` validates
        `{ jwtSecret, databaseUser, databasePassword }`
  - [x] All three fields are required strings with `.min(1)`
  - [x] `AppSecrets` type is exported
  - [x] `configSchema` has optional `secretsPath` and `ssm` fields
  - [x] `AppConfig` type now includes `secretsPath?` and `ssm?` properties
  - [x] Existing config tests still pass (fields are optional, no breaking
        change)
  - [x] New schema tests cover valid input, missing fields, empty strings
- **Status**: done

### Milestone 2: Secrets Loader Function

- **Description**: Implement `loadSecrets(config)` with file and SSM backends.
  File backend reads and parses a JSON file. SSM backend fetches parameters from
  AWS SSM. Both validate with Zod and freeze the result.
- **Files to create**:
  - `src/config/secrets-loader.ts` — `loadSecrets()`, `loadFromFile()`,
    `loadFromSSM()`
- **Files to modify**:
  - `src/config/index.ts` — re-export `loadSecrets`
- **Tests to create**:
  - `tests/unit/config/secrets-loader.test.ts`
- **Implementation notes**:
  - Use `fs.readFile` (from `node:fs/promises`) for the file backend
  - Use `SSMClient` + `GetParametersCommand` from `@aws-sdk/client-ssm` for the
    SSM backend (already a dependency)
  - If `config.ssm` is set, use SSM backend (takes priority)
  - If `SECRETS_PATH` env var is set, use file backend
  - If neither is set, throw a descriptive error
  - Validate with `secretsSchema.parse()`, freeze with `Object.freeze()`
- **Patterns to follow**: See `src/config/loader.ts` for the file-reading
  pattern used by `loadConfig()`. The secrets loader should be similar in style
  but async.
- **Acceptance Criteria**:
  - [x] `loadSecrets(config)` returns a `Promise<AppSecrets>`
  - [x] File backend reads JSON, parses, and validates
  - [x] SSM backend fetches parameters and maps them to schema fields
  - [x] Zod validation rejects missing/empty fields
  - [x] Returned object is frozen (`Object.isFrozen()`)
  - [x] Throws descriptive error when no secrets source is configured
  - [x] Tests mock `fs.readFile` and SSM client — no real I/O
  - [x] Tests cover: happy path (file), happy path (SSM), missing file, invalid
        JSON, missing fields, empty strings, both sources set, neither source
        set
- **Status**: done

### Milestone 3: DI Integration — TYPES.Secrets

- **Description**: Add `Secrets` symbol to `TYPES` and update `createContainer`
  to accept and bind `AppSecrets` as a third parameter.
- **Files to modify**:
  - `src/lib/types.ts` — add `Secrets: Symbol.for('Secrets')`
  - `src/inversify.config.ts` — add `secrets: AppSecrets` (required) parameter
    to `createContainer`, bind as `TYPES.Secrets`
- **Tests to update**:
  - Any tests that call `createContainer(config, dataSource)` must now pass a
    third `secrets` argument. If no such tests exist yet, note this for
    milestone 8.
- **Implementation notes**:
  - `createContainer(config, dataSource, secrets)` — secrets is required, bind
    as `container.bind<AppSecrets>(TYPES.Secrets).toConstantValue(secrets)`
  - Keep it simple: secrets is a plain object, not an injectable class
  - No conditional guards — app won't boot without secrets
- **Patterns to follow**: See how `TYPES.Config` is bound in
  `src/inversify.config.ts:28`.
- **Acceptance Criteria**:
  - [x] `TYPES.Secrets` symbol exists in `src/lib/types.ts`
  - [x] `createContainer` accepts 3 parameters: `config`, `dataSource`,
        `secrets`
  - [x] `AppSecrets` is bound to `TYPES.Secrets` as a constant value
  - [x] Existing DI bindings are unaffected
  - [x] Unit tests pass
- **Status**: done

### Milestone 4: Auth Middleware — Factory Takes jwtSecret Param

- **Description**: Refactor `createAuthMiddleware()` to accept `jwtSecret` as a
  parameter instead of reading `process.env.JWT_SECRET`. Update the DI binding
  to pass the secret from the container.
- **Files to modify**:
  - `src/middleware/auth-middleware.ts` —
    `createAuthMiddleware(jwtSecret: string)`
  - `src/inversify.config.ts` — pass `secrets.jwtSecret` when creating the
    middleware
- **Tests to update**:
  - `tests/unit/middleware/auth-middleware.test.ts` — remove all
    `process.env.JWT_SECRET` manipulation, pass `jwtSecret` as argument to
    `createAuthMiddleware('test-secret')` instead
- **Implementation notes**:
  - The factory currently reads `process.env.JWT_SECRET` at line 34. Replace
    with the `jwtSecret` parameter.
  - Remove the `if (!secret)` null check inside the handler — the secret is
    validated at startup by Zod. The factory itself should throw if called with
    an empty string (defensive, but startup-time).
  - In `inversify.config.ts`, change:
    ```typescript
    container
      .bind<AuthMiddlewareFunction>(TYPES.AuthMiddleware)
      .toConstantValue(createAuthMiddleware(secrets.jwtSecret));
    ```
- **Patterns to follow**: The factory pattern is already in use. We're just
  adding a parameter.
- **Acceptance Criteria**:
  - [x] `createAuthMiddleware` accepts `jwtSecret: string` parameter
  - [x] No `process.env` reads in `auth-middleware.ts`
  - [x] Factory throws if `jwtSecret` is empty/missing (startup guard)
  - [x] DI binding passes `secrets.jwtSecret`
  - [x] All auth middleware tests pass without `process.env` manipulation
  - [x] Tests for the "missing secret" case now test the factory throw, not a
        500 response
- **Status**: done

### Milestone 5: UserService — Inject TYPES.Secrets

- **Description**: Refactor `UserServiceImpl` to receive `AppSecrets` via DI
  injection instead of reading `process.env.JWT_SECRET`.
- **Files to modify**:
  - `src/services/user-service.ts` — add `@inject(TYPES.Secrets)` to
    constructor, use `this.secrets.jwtSecret` in `authenticate()`
- **Tests to update**:
  - `tests/unit/services/user-service.test.ts` — remove all
    `process.env.JWT_SECRET` manipulation, pass mock secrets via constructor
    instead
- **Implementation notes**:
  - Add a 4th constructor parameter:
    ```typescript
    @inject(TYPES.Secrets) private readonly secrets: AppSecrets,
    ```
  - In `authenticate()`, replace lines 129-132 with:
    ```typescript
    const token = jwt.sign({ userId: user.id }, this.secrets.jwtSecret, {
      expiresIn: this.config.auth.accessToken.expiresIn,
    });
    ```
  - Remove the `if (!secret)` throw — Zod validates at startup.
- **Patterns to follow**: See how `@inject(TYPES.Config)` is used in the same
  constructor at `src/services/user-service.ts:58`.
- **Acceptance Criteria**:
  - [x] `UserServiceImpl` constructor has 4th param: `@inject(TYPES.Secrets)`
  - [x] No `process.env` reads in `user-service.ts`
  - [x] `authenticate()` uses `this.secrets.jwtSecret`
  - [x] All user-service tests pass without `process.env` manipulation
  - [x] Tests provide mock secrets object in constructor
- **Status**: done

### Milestone 6: Remove loadDatabaseCredentials

- **Description**: Remove `loadDatabaseCredentials()` from
  `src/database/data-source.ts`. Update `createDataSource` to accept
  `AppSecrets` (or just the credentials portion) instead of
  `DatabaseCredentials`.
- **Files to modify**:
  - `src/database/data-source.ts` — remove `loadDatabaseCredentials`, update
    `createDataSource` to use secrets
  - `src/database/index.ts` — remove `loadDatabaseCredentials` export
- **Tests to update**:
  - `tests/unit/database/data-source.test.ts` — remove `loadDatabaseCredentials`
    tests, update `createDataSource` tests to pass secrets-shaped object
- **Implementation notes**:
  - Option A: Change `createDataSource(config, credentials)` to
    `createDataSource(config, secrets)` where secrets is `AppSecrets` and
    extract `username: secrets.databaseUser`,
    `password: secrets.databasePassword`.
  - Option B: Keep the `DatabaseCredentials` interface but have the caller
    (bootstrap) map from secrets. **Prefer Option A** — simpler, fewer
    intermediary types.
  - Remove the `DatabaseCredentials` interface entirely.
- **Acceptance Criteria**:
  - [x] `loadDatabaseCredentials` function is deleted
  - [x] `DatabaseCredentials` interface is deleted
  - [x] `createDataSource` accepts `AppSecrets` as second parameter
  - [x] DataSource uses `secrets.databaseUser` and `secrets.databasePassword`
  - [x] No `process.env` reads remain in `data-source.ts`
  - [x] All data-source tests pass with updated signatures
  - [x] `src/database/index.ts` only exports `createDataSource`
- **Status**: done

### Milestone 7: Bootstrap + Config Files + Cleanup

- **Description**: Wire everything together in `src/index.ts`. Update config
  JSON files. Add `config/secrets.json`. Remove `src/typeormconfig.ts`. Clean up
  docker-compose.
- **Files to modify**:
  - `src/index.ts` — call `loadSecrets(config)`, pass secrets to
    `createDataSource` and `createContainer`
  - `config/default.json` — add `secrets.secretsPath`
  - `config/test.json` — add `secrets.secretsPath`
  - `docker-compose.yml` — remove `DATABASE_USER`, `DATABASE_PASSWORD`; add
    `SECRETS_PATH: /app/config/secrets.json` to app service environment
- **Files to create**:
  - `config/secrets.json` — dev/test secrets (not production secrets!)
- **Files to delete**:
  - `src/typeormconfig.ts`
- **Implementation notes**:
  - Bootstrap becomes:
    ```typescript
    const config = loadConfig();
    const secrets = await loadSecrets(config);
    const dataSource = createDataSource(config, secrets);
    await dataSource.initialize();
    await dataSource.runMigrations();
    const diContainer = createContainer(config, dataSource, secrets);
    ```
  - Remove `loadDatabaseCredentials` import from `src/index.ts`
  - `config/secrets.json` is mounted into the container via the existing
    `./config:/app/config` volume mount — no docker-compose change needed for
    that
- **Acceptance Criteria**:
  - [x] `src/index.ts` calls `loadSecrets` and passes secrets through
  - [x] No `process.env` reads for secrets remain in any `src/` file
  - [x] `docker-compose.yml` sets `SECRETS_PATH` env var for app service
  - [x] `config/secrets.json` exists with dev values
  - [x] `src/typeormconfig.ts` is deleted
  - [x] `docker-compose.yml` no longer sets `DATABASE_USER` /
        `DATABASE_PASSWORD` on the app service
  - [x] App starts successfully with `make build` or compose up
- **Status**: done

### Milestone 8: Integration Test Fixes + Final Verification

- **Description**: Ensure all test layers pass after the migration. Fix any
  remaining test breakages. Run full verification.
- **Verification commands**:
  - `make test-unit` — all unit tests pass
  - `make typecheck` — no type errors
  - `make lint` — no lint errors
  - `make test-integration` — integration tests pass (if applicable)
- **Implementation notes**:
  - Tests that previously set `process.env.JWT_SECRET` should now pass secrets
    via constructor/factory parameters
  - Integration tests may need `config/secrets.json` or a test-specific secrets
    file
  - Grep for any remaining `process.env.JWT_SECRET`,
    `process.env.DATABASE_USER`, `process.env.DATABASE_PASSWORD` in `src/` —
    there should be zero matches
  - Grep in `tests/` for `process.env.JWT_SECRET` — should only appear in legacy
    comments (if any), not in active test code
- **Acceptance Criteria**:
  - [x] `make test-unit` passes (all unit tests green)
  - [x] `make typecheck` passes (no type errors)
  - [x] `make lint` passes (no lint errors)
  - [x] Zero `process.env.JWT_SECRET` reads in `src/`
  - [x] Zero `process.env.DATABASE_USER` reads in `src/`
  - [x] Zero `process.env.DATABASE_PASSWORD` reads in `src/`
  - [x] `loadDatabaseCredentials` no longer exists anywhere in `src/`
  - [x] `src/typeormconfig.ts` no longer exists
- **Status**: done
