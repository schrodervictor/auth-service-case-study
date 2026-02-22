# Testing Strategy

## Test Layers

This project uses three test layers, each with different scope, speed, and
dependency requirements.

| Layer           | Purpose                          | External Deps      | Speed  |
| --------------- | -------------------------------- | ------------------ | ------ |
| **Unit**        | Pure logic, isolated functions   | None               | Fast   |
| **Integration** | DB queries, service interactions | PostgreSQL + Redis | Medium |
| **Acceptance**  | Black-box HTTP against the API   | Full stack         | Slow   |

## Running Tests

### Unit tests

No external services needed.

```bash
make test-unit
```

### Integration tests

Require running PostgreSQL and Redis instances (provided by docker-compose).

```bash
make test-integration
```

### Acceptance tests

Acceptance tests run in a **separate Docker container** that has no access to
the application source code. The test container only makes HTTP requests against
the running API — true black-box testing.

```bash
make test-acceptance
```

This will:

1. Start the full stack (`app` + `postgres` + `redis`)
2. Wait for the app health-check to pass
3. Run the `acceptance` container (Jest runs and exits)
4. Tear down all containers

The acceptance test client lives in `tests/acceptance/` with its own
`package.json`, `Dockerfile`, and Jest configuration. It is completely isolated
from the main application's `node_modules` and `src/`.

### All tests (unit + integration)

```bash
make test
```

Note: `make test` runs unit and integration tests only. Acceptance tests are
excluded because they require the full stack and run in a separate container.

## Directory Structure

```
tests/
├── unit/                          # No external dependencies
│   ├── config/
│   │   ├── config-schema.test.ts      # Zod config schema validation
│   │   ├── loader.test.ts             # Config loading
│   │   ├── secrets-schema.test.ts     # Secrets schema validation
│   │   ├── secrets-loader.test.ts     # Secrets loader (file + SSM backends)
│   │   └── di-integration.test.ts     # DI container bindings
│   ├── controllers/
│   │   ├── health-check-controller.test.ts  # HealthCheckController (mocked DataSource + RedisClient)
│   │   └── user-controller.test.ts    # UserController routes (mocked service)
│   ├── database/
│   │   └── data-source.test.ts        # DataSource factory and credentials
│   ├── entities/
│   │   ├── user.test.ts               # User entity metadata
│   │   └── refresh-token.test.ts      # RefreshToken entity metadata
│   ├── errors/
│   │   ├── incorrect-password-error.test.ts
│   │   ├── invalid-refresh-token-error.test.ts
│   │   └── rate-limit-error.test.ts
│   ├── middleware/
│   │   ├── auth-middleware.test.ts     # Auth middleware (JWT verification)
│   │   ├── content-type-middleware.test.ts  # Content-Type validation (415 responses)
│   │   └── rate-limit-middleware.test.ts  # Rate limit (mocked Redis)
│   ├── redis/
│   │   ├── redis-client.test.ts       # RedisClient facade (incr/expire/ttl/quit/ping)
│   │   └── redis-client-factory.test.ts  # Redis factory (connect + fail-open)
│   ├── repositories/
│   │   ├── user-repository.test.ts    # UserRepository (mocked TypeORM)
│   │   └── refresh-token-repository.test.ts  # RefreshTokenRepository (mocked)
│   ├── services/
│   │   ├── password-manager-service.test.ts  # Hashing and comparison
│   │   └── user-service.test.ts       # Register, auth, profile, refresh, logout, changePassword
│   ├── openapi/
│   │   └── spec.test.ts               # OpenAPI spec structure and coverage
│   └── shutdown.test.ts               # Graceful shutdown handler
├── integration/                   # Requires PostgreSQL + Redis
│   ├── database/
│   │   └── connection.test.ts         # DB connectivity, migrations, CRUD
│   ├── middleware/
│   │   └── rate-limit-middleware.test.ts  # Rate limiting against real Redis
│   └── repositories/
│       ├── user-repository.test.ts    # UserRepository against real DB
│       └── refresh-token-repository.test.ts  # RefreshTokenRepository against DB
├── acceptance/                    # Separate Docker container (black-box)
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── jest.config.json
│   └── specs/
│       ├── helpers/
│       │   ├── api.ts                 # Shared helpers (validUserData, auth)
│       │   └── redis.ts               # Redis flush helper (rate limit reset)
│       ├── health-check.test.ts       # GET /health-check — status body, no legacy message field
│       ├── registration.test.ts       # POST /users/register
│       ├── login.test.ts              # POST /users/login
│       ├── profile.test.ts            # GET/PUT /users/profile
│       ├── refresh.test.ts            # POST /users/refresh
│       ├── logout.test.ts            # POST /users/logout
│       ├── change-password.test.ts   # PUT /users/password
│       └── openapi.test.ts           # OpenAPI docs (UI, JSON, YAML)
├── setup.ts             # Shared setup (sets CONFIG_PATH to config/test.json)
├── teardown.ts          # Shared teardown
└── helpers.ts           # Shared test utilities
```

## When to Use Which Layer

- **Unit**: Testing pure functions, data transformations, validation logic,
  utility helpers — anything that has no side effects or external dependencies.
- **Integration**: Testing repository methods, TypeORM queries, service methods
  that interact with the database, or any code that depends on external
  infrastructure.
- **Acceptance**: End-to-end verification of API contracts. Tests hit the HTTP
  endpoints as a client would, with no knowledge of internal implementation.
  Ideal for verifying that the deployed system behaves correctly.

## Conventions

- Test files use the `.test.ts` extension.
- Place tests in the layer directory that matches their dependency requirements.
- Use `it.todo()` for planned tests that cannot run yet (e.g., missing entities
  or endpoints).
- Integration and acceptance tests that require unavailable infrastructure
  should be skipped rather than left to fail.
