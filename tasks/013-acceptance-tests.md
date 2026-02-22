# Task: Acceptance Tests for All Endpoints

## Status: pending

## Context

All 6 core endpoints and 2 bonus endpoints are implemented with comprehensive
unit and integration tests (362 tests). However, the acceptance test layer only
has a single health-check smoke test. We need black-box acceptance tests that
exercise every endpoint from the client perspective against the real running
application (Docker Compose stack: app + postgres + redis).

Acceptance tests validate the full request/response cycle — no mocks, no DI,
just HTTP calls via supertest against the live API.

## Technical Specification

### Test Infrastructure

- Tests live in `tests/acceptance/specs/`
- Specs are bind-mounted into the acceptance Docker container
- Run via `make test-acceptance` (docker compose up → wait → run → down)
- Use `supertest` with `process.env.API_URL ?? 'http://app:9000'`
- Base path: `/partner-app/api`
- Jest config: `testTimeout: 10000`, roots: `./specs`

### Endpoints to Cover

| #   | Method | Path            | Auth | Rate Limited  | Notes                                       |
| --- | ------ | --------------- | ---- | ------------- | ------------------------------------------- |
| 1   | GET    | /health-check   | No   | No            | Already covered in example.test.ts          |
| 2   | POST   | /users/register | No   | No            | Returns 201 + user DTO                      |
| 3   | POST   | /users/login    | No   | Yes (login)   | Returns 200 + { accessToken, refreshToken } |
| 4   | POST   | /users/refresh  | No   | Yes (refresh) | Returns 200 + new token pair                |
| 5   | POST   | /users/logout   | Yes  | No            | Returns 204                                 |
| 6   | GET    | /users/profile  | Yes  | No            | Returns 200 + user DTO                      |
| 7   | PUT    | /users/profile  | Yes  | No            | Returns 200 + updated user DTO              |

### Test Scenarios Per Endpoint

**POST /users/register**

- Happy path: register with valid data → 201, response has
  id/email/firstName/lastName
- Missing fields → 400
- Duplicate email → 409
- Invalid email format → 400
- Weak password → 400

**POST /users/login**

- Happy path: login with valid credentials → 200, response has accessToken +
  refreshToken
- Wrong password → 401
- Non-existent email → 401
- Missing fields → 400

**GET /users/profile**

- Happy path: with valid token → 200, response matches registered user
- No Authorization header → 401
- Invalid/expired token → 401

**PUT /users/profile**

- Happy path: update firstName → 200, response reflects change
- Update lastName → 200
- No fields provided → 400
- No Authorization header → 401

**POST /users/refresh**

- Happy path: with valid refresh token → 200, new token pair
- Invalid/expired refresh token → 401
- Missing refreshToken field → 400

**POST /users/logout**

- Happy path: with valid token → 204
- Refresh token invalidated after logout (login again, get new tokens, old
  refresh fails)
- No Authorization header → 401

### Guidelines

- Each test file should be self-contained — register its own user(s) as needed
- Use unique emails per test (e.g., `test-{uuid}@example.com`) to avoid
  cross-test interference since tests share the same database
- Tests run sequentially (`--runInBand` is not set, but the acceptance container
  runs `jest` which defaults to parallel — keep tests independent)
- Do NOT mock anything — these are true black-box tests
- Keep the existing `example.test.ts` health-check test as-is

## Milestones

### Milestone 1: Registration and Login Tests

- **Description**: Cover POST /register and POST /login (happy + error paths)
- **Acceptance Criteria**:
  - [ ] Register happy path: 201 with user DTO (id, email, firstName, lastName,
        no password)
  - [ ] Register error paths: missing fields (400), duplicate email (409),
        invalid email (400), weak password (400)
  - [ ] Login happy path: 200 with { accessToken, refreshToken }
  - [ ] Login error paths: wrong password (401), non-existent user (401),
        missing fields (400)
  - [ ] All tests pass via `make test-acceptance`
- **Status**: pending

### Milestone 2: Profile Tests

- **Description**: Cover GET /profile and PUT /profile (auth required)
- **Acceptance Criteria**:
  - [ ] Get profile: 200 with correct user data
  - [ ] Update profile: 200 with updated fields
  - [ ] Auth enforcement: 401 without token, 401 with invalid token
  - [ ] Update validation: 400 when no fields provided
  - [ ] All tests pass via `make test-acceptance`
- **Status**: pending

### Milestone 3: Refresh and Logout Tests

- **Description**: Cover POST /refresh and POST /logout
- **Acceptance Criteria**:
  - [ ] Refresh happy path: 200 with new token pair
  - [ ] Refresh error paths: invalid token (401), missing field (400)
  - [ ] Logout happy path: 204
  - [ ] Logout invalidates refresh tokens (subsequent refresh fails)
  - [ ] Auth enforcement on logout: 401 without token
  - [ ] All tests pass via `make test-acceptance`
- **Status**: pending

### Milestone 4: Review and Documentation

- **Description**: Code review and documentation update
- **Acceptance Criteria**:
  - [ ] Review-engineer approves test quality
  - [ ] Librarian updates documentation if needed
  - [ ] Full suite passes: `make test-acceptance`
- **Status**: pending
