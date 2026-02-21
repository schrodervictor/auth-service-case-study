# User Authentication Service

A microservice for user registration, authentication, and profile management.

## Tech Stack

- **Runtime:** Node.js with TypeScript
- **Framework:** Express.js with inversify-express-utils
- **Database:** PostgreSQL with TypeORM
- **DI Container:** Inversify
- **Testing:** Jest with Supertest

## Getting Started

The project is fully containerized — no local Node.js or npm required.

```bash
# Build the Docker image
make build

# Start the development stack (app + PostgreSQL)
make up

# Stop everything
make down
```

## Commands

| Command                 | Description                                           |
| ----------------------- | ----------------------------------------------------- |
| `make build`            | Build the Docker image                                |
| `make up`               | Start the dev stack (app + postgres)                  |
| `make down`             | Stop all containers                                   |
| `make test`             | Run all test layers (unit + integration + acceptance) |
| `make test-unit`        | Run unit tests (no external deps)                     |
| `make test-integration` | Run integration tests (with PostgreSQL)               |
| `make test-acceptance`  | Run acceptance tests (full stack, black-box)          |
| `make lint`             | ESLint check                                          |
| `make typecheck`        | TypeScript type check                                 |

## Common Issues

### Changes to config files not taking effect

Files like `package.json`, `jest.config.json`, `tsconfig.json`, `.eslintrc`, and
`prettierrc.json` are copied into the Docker image at build time. If you modify
any of these, rebuild first:

```bash
make build
```

### Docker Compose using a stale app image

If `make up` keeps running an old version of the app, remove the existing image
first:

```bash
docker image rm marta-app:latest
make up
```
