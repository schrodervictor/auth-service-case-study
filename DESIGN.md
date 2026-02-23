# Design Decisions

## Architecture

The service follows the layered architecture provided by the boilerplate:

```
Controller → Service → Repository → Database
```

**Dependency injection** is handled by InversifyJS. All bindings live in a
single `createContainer()` factory that receives the four runtime dependencies
(config, DataSource, secrets, RedisClient) and wires everything else. This keeps
the composition root explicit and makes integration testing straightforward —
swap any binding with a mock.

**Configuration** is loaded from a single JSON file (path via `CONFIG_PATH` env
var), validated at startup with Zod. No dotenv — the JSON file is the single
source of truth for all non-secret settings. Secrets follow the same pattern but
from a separate file (or AWS SSM in production).

## Configuration & Secrets

The boilerplate used **dotenv** with environment variables for all settings
(database credentials, JWT secret, server port, etc.). This was replaced with a
**JSON-based configuration** system:

- **Non-secret config** lives in a single JSON file (`config/default.json`),
  pointed to by the `CONFIG_PATH` env var. Validated at startup with a Zod
  schema that provides defaults, enforces types, and rejects unknown keys. A
  single structured file is easier to review, diff, and manage across
  environments than scattered `KEY=value` pairs — and avoids the stringly-typed
  pitfalls of `process.env`.

- **Secrets** are loaded separately via `loadSecrets()`, which supports two
  backends: a local JSON file (dev/test) or **AWS SSM Parameter Store**
  (production). The backend is selected by a `secrets.source` field in the
  config file (`"file"` or `"ssm"`). Secrets are validated with their own Zod
  schema and frozen after loading.

Why remove dotenv and env vars for secrets:

1. **Env vars leak easily** — they appear in process listings
   (`/proc/PID/environ`), crash dumps, logging middleware, and child processes.
   A dedicated secrets loader with explicit access control is safer.
2. **SSM integration** gives secrets rotation, audit trails, and IAM-based
   access control out of the box — none of which are possible with env vars
   alone.
3. **Type safety** — JSON parsed through Zod gives typed config objects at
   startup. Env vars are always strings and require manual parsing/coercion.
4. **Single source of truth** — one file per environment instead of `.env`,
   `.env.local`, `.env.production`, docker `--env-file`, and CI secrets all
   potentially conflicting.

## Password Hashing

Passwords are hashed with **scrypt** (Node.js `crypto` module) using a 32-byte
random salt and 64-byte derived key. Stored as `salt.hash` in hex. Comparison
uses `timingSafeEqual` to prevent timing attacks — even the length check happens
before the constant-time comparison to avoid leaking information through early
returns.

Why scrypt over bcrypt: scrypt is memory-hard in addition to being CPU-hard,
making it more resistant to GPU/ASIC attacks. It ships with Node.js — no native
addon needed.

## Authentication & Token Strategy

Dual-token system:

- **Access tokens**: Short-lived JWTs (15 min), stateless verification
- **Refresh tokens**: Long-lived (7 days), opaque random values, SHA-256 hashed
  before storage

Refresh tokens are **rotated on every use** — the old token is deleted and a new
one is issued. This limits the window of exposure if a token is stolen. On
logout or password change, all refresh tokens for the user are revoked.

The auth middleware is a factory function (`createAuthMiddleware(jwtSecret)`)
rather than an injectable class. This keeps it framework-agnostic and avoids
circular DI issues since it only needs the JWT secret.

## Input Validation

Request bodies are validated by a generic `validate(schema)` middleware factory
using **Zod schemas**. Validation runs after content-type checking but before
rate limiting and auth, so invalid requests are rejected early without consuming
rate limit budget.

Validation errors return 422 with structured per-field error messages:

```json
{ "message": "Validation failed", "errors": { "email": ["Invalid email"] } }
```

This separates input-shape validation (middleware) from business-rule validation
(service layer), keeping each layer focused.

## Rate Limiting

Rate limiting uses a **Redis-backed fixed-window counter** with per-IP keying.
Each endpoint has its own counter (`rateLimit:{endpoint}:{ip}`). The middleware
uses atomic `INCR` to both check and increment in a single operation, with
`EXPIRE` set on the first request to auto-reset the window.

**Fail-open strategy**: The `RedisClient` facade wraps ioredis and catches all
errors, returning safe defaults (`incr→0`, `ttl→-1`). When Redis is down,
requests pass through unthrottled and a `[RATE-LIMIT DEGRADED]` warning is
logged. Rate limiting is a security enhancement — it should never block
legitimate users due to infrastructure issues.

Rate limits are configurable per endpoint in the JSON config file:

| Endpoint             | Max Attempts | Window |
| -------------------- | ------------ | ------ |
| POST /login          | 5            | 15 min |
| POST /refresh        | 10           | 15 min |
| POST /reset-key      | 3            | 15 min |
| POST /validate-reset | 10           | 15 min |
| POST /password/reset | 5            | 15 min |

## Password Reset

The password reset flow uses a three-endpoint design that separates concerns and
enables UI flexibility:

1. **POST /users/reset-key** — Generates a reset key for an email. Always
   returns 200 with a generic message regardless of whether the email exists
   (prevents user enumeration). Publishes a `PASSWORD_RESET_REQUESTED` domain
   event containing the plain-text key for email delivery.

2. **POST /users/validate-reset-key** — Validates a key without consuming it.
   Returns `{ valid: true/false }`. Allows the UI to show a "valid key" screen
   before asking for the new password.

3. **POST /users/password/reset** — Consumes the key and sets the new password.
   Revokes all refresh tokens for the user.

Reset keys are **SHA-256 hashed** before storage (same principle as refresh
tokens — the database never stores the plain-text key). Keys are single-use and
expire after 15 minutes.

## Error Handling

Custom error classes extend a base `AppError` with a `statusCode` property.
Controllers catch service-layer errors and map them to HTTP responses. This
keeps HTTP semantics out of the service layer.

Content-type validation returns 415 for POST/PUT requests with a non-JSON
`Content-Type` header. Bodyless requests pass through (the header is optional
for GET/DELETE).

Authentication and authorization errors always return the same generic 401
message to prevent information leakage.

## Health Check

`GET /health-check` probes both PostgreSQL (`SELECT 1`) and Redis (`PING`):

- Both up → `{ status: "healthy" }` (200)
- Redis down → `{ status: "degraded" }` (200)
- PostgreSQL down → `{ status: "unhealthy" }` (503)

This reflects the fail-open Redis strategy — the service can operate without
Redis, but not without the database.

## Graceful Shutdown

A `createShutdownHandler` factory listens for SIGTERM/SIGINT and performs
ordered cleanup: stop accepting new connections → drain in-flight requests →
close database → close Redis. An idempotent guard prevents double-shutdown on
rapid signals, and a configurable timeout force-exits if cleanup stalls.

## Testing Strategy

Three levels of testing, 592 unit + integration and 56 acceptance tests:

- **Unit tests** (~475): Services, middleware, and utilities tested in isolation
  with mocked dependencies. Fast, no I/O.
- **Integration tests** (~117): Repository and middleware tests against real
  PostgreSQL and Redis instances.
- **Acceptance tests** (~56): Black-box HTTP tests against the running Docker
  Compose stack, covering all endpoints including rate limiting.

**Coverage** (unit + integration, excluding migrations):

| Metric     | Coverage |
| ---------- | -------- |
| Statements | 98.34%   |
| Branches   | 93.85%   |
| Functions  | 90.69%   |
| Lines      | 98.39%   |

All tests run inside Docker — no local Node.js installation required. The
Makefile provides the interface (`make test-unit`, `make test-integration`,
`make test-acceptance`).

## API Documentation

Hand-written OpenAPI 3.0.3 spec served via `swagger-ui-express` at
`/partner-app/api/docs`. All endpoints, request/response schemas, and error
codes are documented. The spec is co-located with the source code
(`src/openapi/spec.ts`) so it stays in sync with the implementation.

## Infrastructure (Terraform)

AWS infrastructure is defined in `infra/` using Terraform with an S3 backend
(DynamoDB locking). All resources are tagged with project and environment, and
named with a `marta-{env}-` prefix.

**Resources provisioned:**

- **AWS SSM Parameter Store** — Three `SecureString` parameters
  (`/marta/{env}/jwt-secret`, `/marta/{env}/database-user`,
  `/marta/{env}/database-password`) matching the app's `secrets-schema.ts`. The
  app's config JSON points to these paths, and `loadSecrets()` fetches them via
  the AWS SDK at startup.

- **RDS PostgreSQL 16** — Single instance in private subnets, encrypted at rest,
  7-day backup retention. Security group allows port 5432 from within the VPC
  only.

- **ElastiCache Redis 7.1** — Single-node replication group in private subnets
  with at-rest and in-transit encryption. Security group allows port 6379 from
  within the VPC only.

- **IAM Role (IRSA)** — Bound to a specific EKS service account via OIDC
  federation. The role's policy grants `ssm:GetParameters` scoped to the three
  parameter ARNs only — no wildcard access. The K8s service account is annotated
  with this role ARN, so pods automatically receive temporary credentials.

## Kubernetes Deployment (Helm)

The app is deployed to EKS via a Helm chart in `deployment/`. The chart produces
six resources: Deployment, Service, ServiceAccount, ConfigMap, and optionally an
Ingress.

**Config as ConfigMap**: The app's entire JSON config is rendered from
`values.config` into a ConfigMap and mounted at `/app/config/config.json`. The
`CONFIG_PATH` env var points there. A `checksum/config` pod annotation triggers
rolling restarts when config values change.

**No K8s Secrets**: Application secrets (JWT key, DB credentials) are fetched at
runtime from AWS SSM via the IRSA-annotated service account — not stored as K8s
Secrets. This avoids etcd-level secret exposure and leverages IAM for access
control.

**Health probes**: Both liveness and readiness probes hit
`GET /partner-app/api/health-check`. Readiness starts checking after 5s (fast
failure detection), liveness after 10s (avoids killing slow-starting pods).

**ALB Ingress**: An optional `networking.k8s.io/v1` Ingress with ALB annotations
routes traffic to the NodePort service on `/partner-app`.

## Trade-offs & Future Improvements

1. **Token blacklisting**: Access tokens can't be revoked before expiry. A
   Redis-based blacklist would close this gap for high-security scenarios.

2. **Account lockout**: Rate limiting is per-IP. A determined attacker with
   multiple IPs could still brute-force a specific account. Per-account lockout
   after N failures would add defense in depth.

3. **Request ID tracing**: Adding a unique request ID to every log line would
   make debugging production issues significantly easier.

4. **Structured logging**: The service currently uses `console.error` for rate
   limit degradation warnings. A structured logger (pino/winston) with JSON
   output would be more appropriate for production.
