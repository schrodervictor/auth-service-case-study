# Task: Improve API Error Feedback

## Status: done

## Context

The API currently has three error feedback problems that hurt developer
experience:

1. **Generic "Missing required fields" message**: When required fields are
   absent from a request body, the response says
   `{ message: "Missing required fields" }` without listing WHICH fields are
   missing. Clients must guess.

2. **Misleading error on wrong Content-Type**: When a client sends a request
   with a body but without `Content-Type: application/json` (e.g., plain text or
   form-encoded), Express's `body-parser` silently skips parsing. The controller
   sees `req.body` as `undefined` and reports "Missing required fields" — hiding
   the real issue (unsupported media type).

3. **Inconsistent error response format**: The controller returns flat 400
   `{ message: "Missing required fields" }` while the service returns structured
   422 `{ message: "Validation failed", errors: { field: ["..."] } }`. Clients
   must handle two different error shapes for the same category of problem
   (invalid input).

## Technical Specification

### Architecture Decisions

**Content-Type middleware (Milestone 1)**: A standalone Express middleware
function (not DI-injectable — same pattern as `body-parser`). It runs AFTER
`json()` but BEFORE route handlers, inside `app.setConfig()` in `src/index.ts`.

The middleware checks: if the request method is POST or PUT AND the
`Content-Type` header is not `application/json` (ignoring parameters like
`charset=utf-8`), return 415 with
`{ message: "Content-Type must be application/json" }`. Use Express's built-in
`req.is('json')` for the check — it handles content-type parsing, charset
parameters, and case insensitivity.

Important edge cases:

- GET and DELETE requests must pass through untouched (no body expected).
- POST/PUT with `Content-Type: application/json` must pass through normally.
- POST/PUT with `Content-Type: application/json; charset=utf-8` (with
  parameters) must pass through — `req.is('json')` handles these.

**Unified validation at service layer (Milestone 2)**: Remove ALL controller-
level missing-field checks (400 responses) for register, login, and refresh. The
controller simply destructures `req.body` and passes values to the service. The
service handles ALL validation — including null/undefined fields — and throws
`ValidationError` (422) with structured per-field errors.

This gives clients a single, consistent error shape for all input problems:
`{ message: "Validation failed", errors: { field: ["Error message"] } }`

The `PUT /profile` endpoint keeps its controller-level "at least one field"
check (400) because its semantics are different ("at least one of" rather than
"all required").

**Service changes needed**: The service currently crashes on null/undefined
fields (e.g., `EMAIL_REGEX.test(null)` throws, `data.password.length` throws).
Each method needs null checks BEFORE format validation:

- `register()`: check null/undefined for email, password, firstName, lastName →
  e.g., `errors.email = ['Email is required']`, then skip regex/strength checks
  for that field
- `authenticate()`: check null/undefined for email, password → throw
  ValidationError
- `refreshAccessToken()`: check null/empty token → throw ValidationError

### Files to Modify

| File                                                    | Change                                                     |
| ------------------------------------------------------- | ---------------------------------------------------------- |
| `src/middleware/content-type-middleware.ts`             | **NEW** — Content-Type validation middleware               |
| `tests/unit/middleware/content-type-middleware.test.ts` | **NEW** — Unit tests for the middleware                    |
| `src/index.ts`                                          | Wire the middleware in `app.setConfig()` after `json()`    |
| `src/services/user-service.ts`                          | Add null/undefined field validation to register,           |
|                                                         | authenticate, refreshAccessToken                           |
| `tests/unit/services/user-service.test.ts`              | Add tests for null/undefined field handling                |
| `src/controllers/user-controller.ts`                    | Remove manual field checks from register, login, refresh   |
| `tests/unit/controllers/user-controller.test.ts`        | Remove 400 tests, expect 422 from service for missing      |
|                                                         | fields; keep updateProfile 400 test                        |
| `src/openapi/spec.ts`                                   | Add 415 responses; replace 400 "missing fields" with 422   |
|                                                         | ValidationError on register, login, refresh                |
| `tests/unit/openapi/spec.test.ts`                       | Update expected status codes if needed                     |
| `tests/acceptance/specs/registration.test.ts`           | Update missing-field tests: 400 → 422 with structured body |
| `tests/acceptance/specs/login.test.ts`                  | Same                                                       |
| `tests/acceptance/specs/refresh.test.ts`                | Same                                                       |
| `tests/acceptance/specs/profile.test.ts`                | Add Content-Type 415 test                                  |

### Coding Guidelines

- Follow the existing middleware pattern: a plain function that returns
  `(req, res, next) => void`.
- The new middleware does NOT need DI (no `TYPES` symbol) — wired directly in
  `app.setConfig()` alongside `json()`.
- Use `req.is('json')` for Content-Type checking — it handles charset params,
  case insensitivity, and returns `false`/`null` appropriately.
- Error response shape for validation:
  `{ message: string, errors: Record<string, string[]> }`.
- Error response shape for Content-Type: `{ message: string }`.
- Use `make test-unit` to run tests, never npm/npx directly.

### Edge Cases

1. **GET requests**: No body expected, middleware must call `next()`.
2. **Malformed JSON with correct Content-Type**: `body-parser` already returns
   400 with its own error; the middleware should not interfere.
3. **`Content-Type: application/json; charset=utf-8`**: `req.is('json')` handles
   this correctly; middleware passes through.
4. **Null field in register**: Service must not crash. Add null check before
   regex/length checks. E.g., `if (!data.email)` before `EMAIL_REGEX.test()`.
5. **Empty string vs null**: `authenticate()` and `refreshAccessToken()` should
   treat empty string and null/undefined the same — both mean "field is
   missing".

## Milestones

### Milestone 1: Content-Type Validation Middleware

- **Description**: Create a middleware that checks POST/PUT requests for the
  correct `Content-Type: application/json` header and returns 415 Unsupported
  Media Type when it's wrong or missing. Wire it into the Express app after
  `json()`.
- **Acceptance Criteria**:
  - [x] New file `src/middleware/content-type-middleware.ts` exports a
        middleware function
  - [x] Middleware returns 415 with
        `{ message: "Content-Type must be application/json" }` when POST/PUT
        request does not have `application/json` content type
  - [x] Middleware calls `next()` for GET/DELETE requests
  - [x] Middleware calls `next()` for POST/PUT with correct Content-Type
  - [x] Middleware calls `next()` for Content-Type with charset params
        (`application/json; charset=utf-8`)
  - [x] Unit tests in `tests/unit/middleware/content-type-middleware.test.ts`
  - [x] Middleware is wired in `src/index.ts` inside `app.setConfig()` after
        `app.use(json())`
  - [x] `make test-unit` passes
- **Status**: done

### Milestone 2: Move Field Validation to Service Layer

- **Description**: Remove controller-level missing-field checks (400) from
  register, login, and refresh. Update the service to handle null/undefined
  fields gracefully, throwing `ValidationError` (422) with per-field structured
  errors. This gives clients a single, consistent error format for all input
  validation failures.
- **Acceptance Criteria**:
  - [x] `register()` handles null/undefined email →
        `{ email: ['Email is required'] }`
  - [x] `register()` handles null/undefined password →
        `{ password: ['Password is required'] }`
  - [x] `register()` handles null firstName/lastName → field-specific errors
  - [x] `register()` with ALL null fields → ValidationError with all 4 fields
  - [x] `authenticate()` handles null email → ValidationError
  - [x] `authenticate()` handles null password → ValidationError
  - [x] `refreshAccessToken()` handles null/empty token → ValidationError
  - [x] Controller register/login/refresh: no more manual field checks
  - [x] Controller updateProfile: keeps existing "at least one field" check
  - [x] Service tests added for all null/undefined scenarios
  - [x] Controller tests updated: 400 "missing fields" tests removed/replaced
  - [x] `make test-unit` passes
- **Status**: done

### Milestone 3: Update OpenAPI Spec

- **Description**: Update the OpenAPI spec to add 415 responses to all endpoints
  with a request body, and replace 400 "missing fields" responses with 422
  ValidationError responses on register, login, and refresh.
- **Acceptance Criteria**:
  - [x] All endpoints with a `requestBody` (register, login, refresh,
        updateProfile) have a `415` response entry
  - [x] Register, login, refresh: 400 "missing fields" replaced with 422
        ValidationError referencing the ValidationErrorResponse schema
  - [x] OpenAPI unit tests updated if status code assertions changed
  - [x] `make test-unit` passes
- **Status**: done

### Milestone 4: Acceptance Tests

- **Description**: Update acceptance tests to verify the unified 422 validation
  error responses and 415 Content-Type responses across all endpoints.
- **Acceptance Criteria**:
  - [x] `POST /register` with `Content-Type: text/plain` returns 415
  - [x] `POST /login` with `Content-Type: text/plain` returns 415
  - [x] `POST /refresh` with `Content-Type: text/plain` returns 415
  - [x] `PUT /profile` with `Content-Type: text/plain` returns 415
  - [x] `POST /register` with missing email returns 422 with
        `{ errors: { email: [...] } }`
  - [x] `POST /login` with empty body returns 422 with structured errors
  - [x] `POST /refresh` with empty body returns 422 with structured errors
  - [x] Existing acceptance tests updated (400 → 422 where applicable)
  - [x] `make test-acceptance` passes
- **Status**: done

## Implementation Order

Milestones 1 → 2 → 3 → 4 (strictly sequential).
