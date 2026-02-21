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

No external services needed. Can run locally or inside a Docker container with
mounted source code.

```bash
npm run test:unit
```

### Integration tests

Require a running PostgreSQL instance (provided by docker-compose).

```bash
docker compose up -d postgres
npm run test:integration
```

### Acceptance tests

Require the full application stack running (API + database).

```bash
docker compose up -d
npm run test:acceptance
```

### All tests (unit + integration)

```bash
npm test
```

Note: `npm test` runs unit and integration tests only. Acceptance tests are
excluded because they require the full stack and are meant to run separately.

## Directory Structure

```
tests/
├── unit/              # No external dependencies
│   └── *.test.ts
├── integration/       # Requires database
│   └── *.test.ts
├── acceptance/        # Requires full running stack
│   └── *.test.ts
├── setup.ts           # Shared setup (loads .env.test)
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
