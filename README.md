# User Authentication Service

A microservice for user registration, authentication, and profile management.

## Tech Stack

- **Runtime:** Node.js with TypeScript
- **Framework:** Express.js with inversify-express-utils
- **Database:** PostgreSQL with TypeORM
- **Cache / Rate limiting:** Redis (ioredis)
- **DI Container:** Inversify
- **Testing:** Jest with Supertest

## API Endpoints

All routes are prefixed with `/partner-app/api`.

| Method | Path              | Auth | Description                           |
| ------ | ----------------- | ---- | ------------------------------------- |
| GET    | `/health-check`   | No   | Health-check (200 OK)                 |
| POST   | `/users/register` | No   | Register a new user (201)             |
| POST   | `/users/login`    | No   | Authenticate and get token pair (200) |
| POST   | `/users/refresh`  | No   | Refresh access token (200)            |
| POST   | `/users/logout`   | Yes  | Invalidate refresh tokens (204)       |
| GET    | `/users/profile`  | Yes  | Get current user profile (200)        |
| PUT    | `/users/profile`  | Yes  | Update profile fields (200)           |

Interactive API documentation is available at `/partner-app/api/docs` (Swagger
UI) when the service is running. The raw spec can be downloaded as
[JSON](/partner-app/api/docs/spec.json) or
[YAML](/partner-app/api/docs/spec.yaml).

## Features

- **JWT Authentication**: Access + refresh token pair with token rotation
- **Password Hashing**: `crypto.scrypt` with `timingSafeEqual` comparison
- **Rate Limiting**: Redis-backed fixed-window counter on login and refresh
  endpoints. Fail-open — degrades gracefully if Redis is unavailable
- **Graceful Shutdown**: Handles SIGTERM/SIGINT with ordered cleanup (drain
  connections, close DB pool, disconnect Redis) and configurable timeout
- **Secrets Management**: File-based (dev/test) or AWS SSM (production)

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
| `make up`               | Start the dev stack (app + postgres + redis)          |
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
