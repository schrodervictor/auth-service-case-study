# Task: Database Initialization and User Entity

## Status: done

## Context

The application has a JSON config system (task 003) and a containerized
PostgreSQL database, but no TypeORM DataSource initialization or entity
definitions. This task wires up the database layer: creating and initializing
the TypeORM DataSource, defining the User entity, and setting up migrations.
This is the foundation that all subsequent tasks (repository, service,
controller) depend on.

Key constraint: DB credentials (user, password) are secrets and do NOT live in
config JSON files. For dev/test they come from environment variables set in
`docker-compose.yml`. The existing `src/typeormconfig.ts` has AWS SSM support
for production — we keep that code but don't wire it yet.

## Technical Specification

### Architecture Decisions

1. **DataSource factory function** — A `createDataSource(config, credentials)`
   function that takes the validated `AppConfig` (for host, port, dbName) and a
   `DatabaseCredentials` object (user, password). This keeps the DataSource
   testable and decoupled from `process.env`.

2. **Credentials from environment** — A small `loadDatabaseCredentials()`
   function reads `DATABASE_USER` and `DATABASE_PASSWORD` from `process.env`.
   This is the only place that touches env vars for DB secrets. In future, this
   function can be swapped to read from a secrets manager.

3. **Migrations, not synchronize** — TypeORM CLI generates migration files.
   `synchronize: false` always. Migrations run programmatically via
   `dataSource.runMigrations()` at startup after `dataSource.initialize()`.

4. **DataSource in DI** — The initialized DataSource is bound to
   `TYPES.DataSource` in the container. Repositories will inject it.

5. **UUID primary keys** — Use `uuid` strategy with
   `@PrimaryGeneratedColumn('uuid')`.

6. **Keep existing SSM code** — `src/typeormconfig.ts` keeps the SSM function
   but is not imported by the new code. It remains for future production use.

### Credential Handling

```
docker-compose.yml          →  DATABASE_USER, DATABASE_PASSWORD env vars
         ↓
loadDatabaseCredentials()   →  { username: string, password: string }
         ↓
createDataSource(config, credentials)  →  DataSource
```

For tests, the integration test setup creates a DataSource directly with
hardcoded test credentials (matching docker-compose postgres service).

### User Entity Fields

Based on `INSTRUCTIONS.md` Task 1:

| Field       | Type     | Constraints                                 |
| ----------- | -------- | ------------------------------------------- |
| `id`        | `uuid`   | `@PrimaryGeneratedColumn('uuid')`           |
| `email`     | `string` | `@Column({ unique: true })`                 |
| `password`  | `string` | `@Column()` — stores scrypt hash            |
| `firstName` | `string` | `@Column({ name: 'first_name' })`           |
| `lastName`  | `string` | `@Column({ name: 'last_name' })`            |
| `createdAt` | `Date`   | `@CreateDateColumn({ name: 'created_at' })` |
| `updatedAt` | `Date`   | `@UpdateDateColumn({ name: 'updated_at' })` |

- Table name: `users` (via `@Entity({ name: 'users' })`)
- Column naming: `snake_case` in the database, `camelCase` in TypeScript

### Files to Create/Modify

| File                             | Action | Purpose                                           |
| -------------------------------- | ------ | ------------------------------------------------- |
| `src/entities/user.ts`           | Modify | Complete User entity with TypeORM decorators      |
| `src/database/data-source.ts`    | Create | `createDataSource()` factory + credentials loader |
| `src/database/index.ts`          | Create | Barrel export                                     |
| `src/lib/types.ts`               | Modify | Uncomment/add `DataSource` symbol                 |
| `src/inversify.config.ts`        | Modify | Bind initialized DataSource to container          |
| `src/index.ts`                   | Modify | Initialize DataSource at startup before server    |
| `src/migrations/`                | Create | Directory for TypeORM migration files             |
| `src/migrations/*-CreateUser.ts` | Create | Initial migration creating `users` table          |
| `package.json`                   | Modify | Add `typeorm` CLI script for migrations           |

### Coding Guidelines

- Follow existing patterns from `src/config/loader.ts` (pure functions, no side
  effects, clear error messages)
- `DatabaseCredentials` interface: `{ username: string; password: string }`
- `createDataSource` returns a `DataSource` (not initialized — caller calls
  `.initialize()`)
- The factory sets `synchronize: false`, `logging: false`, `entities: [User]`,
  `migrations: ['src/migrations/*.ts']`
- Export the `DatabaseCredentials` type from the barrel
- In `src/index.ts`, the startup sequence becomes:
  1. `loadConfig()` — config from JSON
  2. `loadDatabaseCredentials()` — secrets from env
  3. `createDataSource(config, credentials)` — build DataSource
  4. `await dataSource.initialize()` — connect
  5. `await dataSource.runMigrations()` — apply pending migrations
  6. `createContainer(config, dataSource)` — DI setup (signature changes)
  7. Build and start Express server
- `createContainer` gains a second parameter: `dataSource: DataSource`. It binds
  it as `TYPES.DataSource`. Existing tests for `createContainer` need updating
  to pass a mock/stub DataSource.

### Migration Strategy

- Migrations directory: `src/migrations/`
- Add a `typeorm` script to `package.json` for the CLI:
  ```json
  "typeorm": "tsx node_modules/typeorm/cli.js"
  ```
- Generate migrations with:
  ```bash
  npm run typeorm migration:generate -- -d src/database/data-source.ts src/migrations/CreateUser
  ```
  (But for this task, write the initial migration manually since no DataSource
  CLI config exists yet.)
- Migrations run automatically at startup via `dataSource.runMigrations()`
- The initial migration creates the `users` table with all columns, a unique
  index on `email`, and uses `uuid_generate_v4()` or `gen_random_uuid()` for the
  default

### Initial Migration Contents

The migration `CreateUser` should:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE "users" (
    "id"         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    "email"      VARCHAR NOT NULL UNIQUE,
    "password"   VARCHAR NOT NULL,
    "first_name" VARCHAR NOT NULL,
    "last_name"  VARCHAR NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);
```

Down migration: `DROP TABLE "users";`

### Test Strategy

**Unit tests** (`tests/unit/database/`):

- `data-source.test.ts`:
  - `createDataSource` returns a `DataSource` instance with correct options
  - Reads host/port/database from config
  - Reads username/password from credentials
  - `synchronize` is always `false`
  - Entities array includes `User`
- `credentials.test.ts` (or same file):
  - `loadDatabaseCredentials` reads from `process.env`
  - Throws clear error when `DATABASE_USER` is missing
  - Throws clear error when `DATABASE_PASSWORD` is missing

**Unit tests** (`tests/unit/entities/`):

- `user.test.ts`:
  - User entity has expected metadata (column names, types, constraints)
  - Can verify via `getMetadataArgsStorage()` from TypeORM that decorators
    registered correctly

**Unit tests** (`tests/unit/config/`):

- Update `di-integration.test.ts` to pass a mock DataSource to `createContainer`
  and verify `TYPES.DataSource` is bound

**Integration tests** (`tests/integration/database/`):

- `connection.test.ts`:
  - Creates a DataSource with test credentials, initializes, runs a raw
    `SELECT 1`, then destroys — proves connectivity
  - Runs migrations, verifies `users` table exists in
    `information_schema.tables`
  - Can insert and read back a User entity

**Note**: Integration tests need a running PostgreSQL. They run via
`make test-integration` which starts postgres via docker-compose.

### Edge Cases

- `loadDatabaseCredentials` must fail fast with a clear message if env vars are
  missing — don't let TypeORM show a cryptic connection error
- DataSource initialization failure (wrong host, wrong credentials) should be
  caught in `src/index.ts` and logged before `process.exit(1)`
- Migration failures should also be caught and logged clearly
- The `users` table `email` column must have a UNIQUE constraint — this is
  enforced both in the entity decorator and in the migration

### Dependencies

- No new npm packages needed. `typeorm`, `pg`, and `reflect-metadata` are
  already in `package.json`. `tsx` is available for the typeorm CLI.

## Milestones

### Milestone 1: User Entity

- **Description**: Complete the User entity with all required fields and TypeORM
  decorators
- **Acceptance Criteria**:
  - [x] `src/entities/user.ts` defines the `User` class with `@Entity`,
        `@PrimaryGeneratedColumn('uuid')`, `@Column`, `@CreateDateColumn`,
        `@UpdateDateColumn` decorators
  - [x] Table name is `users`, columns use `snake_case` in DB
  - [x] `email` column has `unique: true`
  - [x] Unit tests verify entity metadata is correctly registered
  - [x] `make typecheck` passes
- **Status**: done

### Milestone 2: DataSource Factory and Credentials

- **Description**: Create the DataSource factory function and credentials loader
- **Acceptance Criteria**:
  - [x] `src/database/data-source.ts` exports
        `createDataSource(config,     credentials)` returning a non-initialized
        `DataSource`
  - [x] `src/database/data-source.ts` exports `loadDatabaseCredentials()`
        reading from `process.env`
  - [x] `DatabaseCredentials` interface exported
  - [x] `src/database/index.ts` barrel export
  - [x] `synchronize` is `false`, entities include `User`
  - [x] Credentials loader throws clear errors for missing env vars
  - [x] Unit tests cover factory output and credentials loader
  - [x] `make typecheck` passes
- **Status**: done

### Milestone 3: Initial Migration

- **Description**: Create the first TypeORM migration that creates the `users`
  table
- **Acceptance Criteria**:
  - [x] Migration file in `src/migrations/` with timestamp prefix
  - [x] `up` creates `users` table with all columns, UUID primary key, unique
        email index
  - [x] `down` drops the `users` table
  - [x] `package.json` has a `typeorm` script for CLI usage
  - [x] Integration test: DataSource initializes and runs migrations
        successfully against real PostgreSQL
  - [x] Integration test: `users` table exists after migrations
- **Status**: done

### Milestone 4: DI Wiring and Startup Integration

- **Description**: Wire the DataSource into the DI container and update the
  application startup sequence
- **Acceptance Criteria**:
  - [x] `TYPES.DataSource` symbol added to `src/lib/types.ts`
  - [x] `createContainer(config, dataSource)` accepts and binds DataSource
  - [x] `src/index.ts` startup: load config → load credentials → create
        DataSource → initialize → run migrations → create container → start
        server
  - [x] Startup logs connection success or fails fast with clear error
  - [x] Existing DI integration tests updated to pass mock DataSource
  - [x] Integration test: full DataSource → DI → entity insert roundtrip
  - [x] `make test-unit` passes
  - [x] `make test-integration` passes
- **Status**: done
