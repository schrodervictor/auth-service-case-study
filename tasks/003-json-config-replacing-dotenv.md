# Task: Replace dotenv with JSON-Based Configuration

## Status: done

## Context

The project currently uses dotenv to load environment variables from `.env`
files. This is a common but limited approach — env vars are always strings,
require manual casting, have flat naming conventions, and can't express nested
structures. For a containerized application where deployment parameters
(replicas, resource limits, image tags) belong in the orchestrator and runtime
configuration (database settings, token lifetimes, feature flags) belongs in the
application, a structured JSON config file is a better fit.

The new approach:

- **One env var**: `CONFIG_PATH` tells the app where to find its JSON config
  file on the filesystem
- **JSON config file**: Typed, nested, no casting needed — loaded once at
  startup
- **Validation**: Zod schema validates the config at load time and fails fast on
  misconfiguration
- **No secrets**: Sensitive values (JWT secrets, DB passwords) are NOT included.
  They will be loaded later from a proper secrets manager. Code that needs
  secrets is deferred until that integration exists

## Technical Specification

### Config File Structure

Only non-sensitive runtime parameters:

```json
{
  "server": {
    "port": 9000
  },
  "database": {
    "host": "postgres",
    "port": 5432,
    "name": "case_study_db"
  },
  "auth": {
    "accessToken": {
      "expiresIn": "15m"
    },
    "refreshToken": {
      "expiresIn": "7d"
    }
  }
}
```

Database credentials (`user`, `password`) and JWT secrets are intentionally
absent. They will be provided by a secrets manager in a future task.

### Zod Schema

A Zod schema defines the expected shape, types, and defaults. Validation happens
once at startup. If invalid, the app prints a clear error and exits with a
non-zero code.

### Config in DI Container

The validated config is loaded into the InversifyJS container. All consumers get
typed config via `@inject(TYPES.Config)` — no more scattered `process.env.X`
calls.

### Files to Create/Modify

| File                      | Action | Purpose                                |
| ------------------------- | ------ | -------------------------------------- |
| `src/config/schema.ts`    | Create | Zod schema + TypeScript type           |
| `src/config/loader.ts`    | Create | Read JSON file, validate, return typed |
| `src/config/index.ts`     | Create | Barrel export                          |
| `config/default.json`     | Create | Default config for local dev           |
| `config/test.json`        | Create | Test config (port 9001, test DB name)  |
| `src/index.ts`            | Modify | Load config before DI bootstrap        |
| `src/inversify.config.ts` | Modify | Bind validated config to container     |
| `src/lib/types.ts`        | Modify | Add `TYPES.Config` symbol              |
| `docker-compose.yml`      | Modify | Mount config dir, set `CONFIG_PATH`    |
| `Makefile`                | Modify | Pass config path to test containers    |
| `tests/setup.ts`          | Modify | Load test config instead of dotenv     |
| `package.json`            | Modify | Add zod, remove dotenv                 |
| `.env.test`               | Delete | Replaced by `config/test.json`         |
| `env.example`             | Delete | Replaced by `config/default.json`      |

## Milestones

### Milestone 1: Config Schema and Loader

- **Description**: Create the Zod schema, JSON loader, and config type
- **Acceptance Criteria**:
  - [x] `src/config/schema.ts` defines Zod schema matching the structure above
  - [x] `src/config/loader.ts` reads JSON from path provided via `CONFIG_PATH`
        env var, validates with Zod, returns typed config object
  - [x] Loader throws a clear, descriptive error if `CONFIG_PATH` is unset, file
        doesn't exist, JSON is malformed, or validation fails
  - [x] TypeScript type inferred from the Zod schema (`z.infer<>`)
  - [x] Unit tests cover: valid config, missing file, malformed JSON, missing
        required fields, wrong types, default values applied
- **Status**: done

### Milestone 2: DI Integration

- **Description**: Wire the validated config into the InversifyJS container
- **Acceptance Criteria**:
  - [x] `TYPES.Config` symbol added to `src/lib/types.ts`
  - [x] Config loaded and validated before DI container is created
  - [x] Validated config bound as constant value in the container
  - [x] `src/index.ts` updated to load config at startup (replaces
        `dotenv.config()`)
  - [x] Unit test verifies config is injectable
- **Status**: done

### Milestone 3: Config Files and Docker Integration

- **Description**: Create default and test JSON config files, wire into Docker
- **Acceptance Criteria**:
  - [x] `config/default.json` with development defaults (no secrets)
  - [x] `config/test.json` with test values (port 9001, test DB name)
  - [x] `docker-compose.yml` mounts `./config` and sets `CONFIG_PATH`
  - [x] `Makefile` test targets pass correct `CONFIG_PATH`
  - [x] `tests/setup.ts` sets `CONFIG_PATH` pointing to `config/test.json`
        (replaces dotenv import)
- **Status**: done

### Milestone 4: Cleanup

- **Description**: Remove dotenv and legacy env files
- **Acceptance Criteria**:
  - [x] `dotenv` removed from `package.json` dependencies
  - [x] `.env.test` deleted
  - [x] `env.example` deleted
  - [x] No remaining `dotenv` imports in the codebase
  - [x] No remaining `process.env` access outside the config loader (only
        `CONFIG_PATH`)
  - [x] `docs/testing.md` updated if needed
  - [x] All three test layers pass (`make test-unit`, `make test-integration`,
        `make test-acceptance`)
- **Status**: done

### Milestone 5: Config Immutability

- **Description**: Ensure the config object is deeply frozen after loading so no
  code can accidentally mutate it at runtime
- **Acceptance Criteria**:
  - [x] `loadConfig()` returns a deeply frozen object (all nested objects
        frozen)
  - [x] Attempting to modify any property at any nesting level throws a
        `TypeError` (in strict mode)
  - [x] Existing tests still pass — frozen config doesn't break reads
  - [x] Unit tests verify immutability at top-level and nested levels
- **Status**: done
