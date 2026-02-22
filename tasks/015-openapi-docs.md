# Task: OpenAPI / Swagger Documentation

## Status: pending

## Context

The User Authentication Service has 7 fully implemented endpoints but no API
documentation. Adding OpenAPI 3.0 documentation served via Swagger UI will
provide interactive, self-documenting API reference for consumers and reviewers.
This is a professional polish differentiator for the case study.

## Technical Specification

### Approach: Static Spec + swagger-ui-express

Since inversify-express-utils decorators are not introspectable for automatic
spec generation, the most practical approach is:

1. A hand-written OpenAPI 3.0.3 spec object exported from a TypeScript file
2. `swagger-ui-express` middleware mounted in the Express app

This avoids JSDoc/decorator magic and keeps the spec as a first-class,
type-checked artifact.

### New Dependency

- `swagger-ui-express` (production) + `@types/swagger-ui-express` (dev)

### Files to Create

| File                              | Purpose                                               |
| --------------------------------- | ----------------------------------------------------- |
| `src/openapi/spec.ts`             | OpenAPI 3.0.3 spec object (exported as `openApiSpec`) |
| `src/openapi/index.ts`            | Barrel re-export                                      |
| `tests/unit/openapi/spec.test.ts` | Spec validation + structural tests                    |

### Files to Modify

| File           | Change                                                                       |
| -------------- | ---------------------------------------------------------------------------- |
| `src/index.ts` | Mount swagger-ui-express at `/partner-app/api/docs` inside `app.setConfig()` |
| `package.json` | Add `swagger-ui-express` + `@types/swagger-ui-express`                       |

### Mount Point

The Swagger UI should be served at `/partner-app/api/docs`. The raw JSON spec
should be available at `/partner-app/api/docs/spec.json` (or via the default
swagger-ui-express behavior which serves it automatically).

The middleware must be mounted inside `app.setConfig()` in `src/index.ts` since
this is the Express configuration callback before InversifyExpressServer builds
the app:

```typescript
app.setConfig((expressApp) => {
  expressApp.use(json());
  expressApp.use(
    "/partner-app/api/docs",
    swaggerUi.serve,
    swaggerUi.setup(openApiSpec),
  );
});
```

### API Endpoints to Document

All endpoints live under the root path `/partner-app/api`.

#### 1. GET /partner-app/api/health-check

- No auth required
- Response 200: `{ message: "Service is up and running" }`

#### 2. POST /partner-app/api/users/register

- No auth required
- Request body: `{ email, password, firstName, lastName }` (all strings,
  required)
- Response 201: `UserResponseDto` (id, email, firstName, lastName, createdAt,
  updatedAt)
- Response 400: `{ message: "Missing required fields" }`
- Response 409: `{ message: "Email \"...\" is already registered" }`
- Response 422:
  `{ message: "Validation failed", errors: { field: [messages] } }`

#### 3. POST /partner-app/api/users/login

- No auth required; rate-limited (5 attempts / 15 min per IP)
- Request body: `{ email, password }` (both strings, required)
- Response 200: `AuthResponseDto` (accessToken, refreshToken)
- Response 400: `{ message: "Missing required fields" }`
- Response 401: `{ message: "Invalid email or password" }`
- Response 429: `{ message: "Too many requests. Please try again later." }` +
  `Retry-After` header

#### 4. POST /partner-app/api/users/refresh

- No auth required; rate-limited (10 attempts / 15 min per IP)
- Request body: `{ refreshToken }` (string, required)
- Response 200: `AuthResponseDto` (accessToken, refreshToken)
- Response 400: `{ message: "Missing required fields" }`
- Response 401: `{ message: "Invalid or expired refresh token" }`
- Response 429: `{ message: "Too many requests. Please try again later." }` +
  `Retry-After` header

#### 5. POST /partner-app/api/users/logout

- Requires Bearer JWT in Authorization header
- No request body
- Response 204: No content
- Response 401: `{ message: "Unauthorized" }`

#### 6. GET /partner-app/api/users/profile

- Requires Bearer JWT in Authorization header
- Response 200: `UserResponseDto`
- Response 401: `{ message: "Unauthorized" }`

#### 7. PUT /partner-app/api/users/profile

- Requires Bearer JWT in Authorization header
- Request body: `{ firstName?, lastName? }` (at least one required)
- Response 200: `UserResponseDto`
- Response 400:
  `{ message: "At least one field (firstName or lastName) is required" }`
- Response 401: `{ message: "Unauthorized" }`
- Response 422:
  `{ message: "Validation failed", errors: { field: [messages] } }`

### Spec Structure (src/openapi/spec.ts)

The spec object should define:

- **info**: title "User Authentication Service", version "1.0.0", description
- **servers**: `[{ url: "/partner-app/api" }]`
- **components/schemas**: `UserResponse`, `AuthResponse`, `ErrorResponse`,
  `ValidationErrorResponse`, `RegisterRequest`, `LoginRequest`,
  `RefreshRequest`, `UpdateProfileRequest`
- **components/securitySchemes**: `bearerAuth` (http, bearer, JWT)
- **paths**: All 7 endpoints with full request/response documentation
- **tags**: `Health`, `Auth`, `Profile` for logical grouping

### Coding Guidelines

- Export the spec as a plain object with type `object` (swagger-ui-express
  accepts any object). No need for a dedicated OpenAPI type package.
- Keep the spec in a single file (`src/openapi/spec.ts`) since it is a static
  data structure. If it grows unwieldy, it can be split later.
- Use `as const` or explicit object literal to get good type inference.
- Follow the project convention of barrel exports (`src/openapi/index.ts`).

### Testing Strategy

Tests live at `tests/unit/openapi/spec.test.ts`. What to test:

1. **Structural validation**: The spec object has required OpenAPI fields
   (`openapi`, `info`, `paths`).
2. **Path coverage**: Every endpoint path exists in `spec.paths`.
3. **Method coverage**: Each path has the correct HTTP method(s).
4. **Security annotations**: Protected endpoints have
   `security: [{ bearerAuth: [] }]`.
5. **Response codes**: Each operation lists the expected status codes.
6. **Schema references**: Request bodies and responses reference defined
   schemas.

These are unit tests on a static data structure — no HTTP calls or mocking
needed. They ensure the spec stays in sync with the actual API as the codebase
evolves.

An optional integration-level test can verify that `GET /partner-app/api/docs`
returns HTML (status 200 or 301 redirect). This would go in
`tests/integration/openapi/docs-endpoint.test.ts` but is lower priority.

### Edge Cases

- `swagger-ui-express` serves static assets (CSS/JS) — these must not conflict
  with existing routes. The `/partner-app/api/docs` path is unused.
- The middleware must be mounted BEFORE `app.build()` (inside `setConfig`), not
  after, because InversifyExpressServer does not allow middleware after build.
- `swagger-ui-express` v5+ changed its API slightly — pin to v4.x or handle v5
  import style (`import swaggerUi from 'swagger-ui-express'`).

### Implementation Order

1. Install dependencies
2. Create `src/openapi/spec.ts` with the full spec object
3. Create `src/openapi/index.ts` barrel
4. Mount the middleware in `src/index.ts`
5. Write unit tests for spec structure
6. (Optional) Write integration test for the docs endpoint

## Milestones

### Milestone 1: OpenAPI Spec Object

- **Description**: Create the OpenAPI 3.0.3 specification as a TypeScript module
  that documents all 7 endpoints with request/response schemas, auth
  requirements, rate limiting notes, and error responses.
- **Acceptance Criteria**:
  - [ ] `src/openapi/spec.ts` exports an `openApiSpec` object
  - [ ] `src/openapi/index.ts` barrel re-exports the spec
  - [ ] Spec covers all 7 endpoints (health-check, register, login, refresh,
        logout, GET profile, PUT profile)
  - [ ] Each endpoint documents all possible status codes and response shapes
  - [ ] Protected endpoints annotated with `bearerAuth` security scheme
  - [ ] Rate-limited endpoints note the limits in their description
  - [ ] Components/schemas defined for reusable types (UserResponse,
        AuthResponse, error shapes)
  - [ ] Unit tests in `tests/unit/openapi/spec.test.ts` validate spec structure
  - [ ] `make test-unit` passes
  - [ ] `make typecheck` passes
- **Status**: pending

### Milestone 2: Swagger UI Middleware

- **Description**: Install `swagger-ui-express`, mount it at
  `/partner-app/api/docs`, and verify the endpoint serves the Swagger UI.
- **Acceptance Criteria**:
  - [ ] `swagger-ui-express` added to `dependencies` in `package.json`
  - [ ] `@types/swagger-ui-express` added to `devDependencies` in `package.json`
  - [ ] Middleware mounted in `app.setConfig()` in `src/index.ts`
  - [ ] `GET /partner-app/api/docs` serves Swagger UI HTML (verifiable manually
        or via acceptance test)
  - [ ] Existing endpoints unaffected — `make test-unit` and
        `make test-acceptance` still pass
  - [ ] `make typecheck` passes
- **Status**: pending
