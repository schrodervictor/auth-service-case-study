# Testing Strategy

## Test Layers

This project uses three test layers, each with different scope, speed, and
dependency requirements.

| Layer           | Purpose                          | External Deps | Speed  |
| --------------- | -------------------------------- | ------------- | ------ |
| **Unit**        | Pure logic, isolated functions   | None          | Fast   |
| **Integration** | DB queries, service interactions | PostgreSQL    | Medium |
| **Acceptance**  | Black-box HTTP against the API   | Full stack    | Slow   |

## Running Tests

### Unit tests

No external services needed.

```bash
make test-unit
```

### Integration tests

Require a running PostgreSQL instance (provided by docker-compose).

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

1. Start the full stack (`app` + `postgres`)
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
├── unit/                        # No external dependencies
│   ├── config/
│   │   ├── loader.test.ts       # Config loading and Zod validation
│   │   └── di-integration.test.ts  # DI container bindings
│   ├── database/
│   │   └── data-source.test.ts  # DataSource factory and credentials loader
│   ├── entities/
│   │   └── user.test.ts         # User entity metadata (TypeORM decorators)
│   ├── repositories/
│   │   └── user-repository.test.ts  # UserRepository methods (mocked TypeORM)
│   ├── services/
│   │   └── password-manager-service.test.ts  # Hashing and comparison logic
│   └── example.test.ts
├── integration/                 # Requires PostgreSQL
│   ├── database/
│   │   └── connection.test.ts   # DB connectivity, migrations, CRUD roundtrip
│   ├── repositories/
│   │   └── user-repository.test.ts  # UserRepository CRUD against real DB
│   └── example.test.ts
├── acceptance/                  # Separate Docker container (black-box)
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── jest.config.json
│   └── specs/
│       └── example.test.ts
├── setup.ts           # Shared setup (sets CONFIG_PATH to config/test.json)
├── teardown.ts        # Shared teardown
└── helpers.ts         # Shared test utilities
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
