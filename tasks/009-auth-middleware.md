# Task: Auth Middleware

## Status: done

## Context

INSTRUCTIONS.md Task 6 requires implementing authentication middleware to
protect routes that require a valid JWT token. The UserController already
references `TYPES.AuthMiddleware` in its
`@httpGet('/profile', TYPES.AuthMiddleware)` and
`@httpPut('/profile', TYPES.AuthMiddleware)` decorators, but no implementation
exists yet — only type definitions.

The existing file `src/middleware/auth-middleware.ts` defines two types:

```typescript
export type AuthenticatedRequest = Request & { user: { id: string } };
export type AuthMiddlewareFunction = (
  req: Request,
  res: Response,
  next: NextFunction,
) => void;
```

The DI symbol `TYPES.AuthMiddleware` is already declared in `src/lib/types.ts`.
The container in `src/inversify.config.ts` does NOT yet bind it.

The UserServiceImpl (task 008) signs JWTs with
`jwt.sign({ userId: user.id }, secret, { expiresIn })`, so the middleware must
decode tokens with the same `{ userId: string }` payload shape.

Dependencies already in place:

- **jsonwebtoken** (`^9.0.2`) + `@types/jsonwebtoken` — already installed
- **AuthenticatedRequest** type — defined, ready to use
- **TYPES.AuthMiddleware** symbol — defined, needs binding
- **UserController** — already casts `req as AuthenticatedRequest` for protected
  routes

## Technical Specification

### Architecture Decisions

1. **Pure function, not a class** — The middleware is a plain Express middleware
   function, not an InversifyJS `@injectable()` class. inversify-express-utils
   expects middleware referenced by DI symbol in `@httpGet('...', TYPES.X)` to
   resolve to a function `(req, res, next) => void`. Bind it as a constant
   value.

2. **Factory pattern for testability** — Create a factory function
   `createAuthMiddleware()` that returns the `AuthMiddlewareFunction`. This
   keeps the middleware pure and easy to unit test without DI overhead:

   ```typescript
   export function createAuthMiddleware(): AuthMiddlewareFunction {
     return (req: Request, res: Response, next: NextFunction): void => {
       // ... implementation
     };
   }
   ```

3. **JWT secret from environment** — Same pattern as UserServiceImpl: read
   `process.env.JWT_SECRET`. If missing, return 401 (do NOT throw — this is
   middleware, not a service). At the middleware level, a missing secret is an
   operational error that should result in a 401 response with a generic
   message, not an unhandled exception crashing the process.

4. **No database lookup** — The middleware only verifies the JWT and extracts
   `userId`. It does NOT check whether the user exists in the database — that
   responsibility belongs to the controller/service layer (the UserController
   already handles `UserNotFoundError` from the service).

5. **Token payload shape** — The JWT payload is `{ userId: string }` (matching
   `jwt.sign({ userId: user.id }, ...)` in UserServiceImpl). The middleware
   extracts `userId` and attaches it to `req.user = { id: payload.userId }`.

6. **Consistent 401 responses** — All error conditions return
   `res.status(401).json({ message: 'Unauthorized' })`. The middleware does NOT
   distinguish between missing token, malformed header, invalid token, or
   expired token in the response body — this prevents information leakage.
   Internally the conditions are:
   - Missing `Authorization` header → 401
   - Header does not start with `Bearer ` → 401
   - Token is empty after `Bearer ` → 401
   - `jwt.verify` throws (invalid signature, expired, malformed) → 401

### Implementation Details

#### File: `src/middleware/auth-middleware.ts`

Add `createAuthMiddleware` to the existing file (which already has the type
exports). The file should export:

- `AuthenticatedRequest` (existing)
- `AuthMiddlewareFunction` (existing)
- `createAuthMiddleware` (new)

```typescript
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

export type AuthenticatedRequest = Request & {
  user: { id: string };
};

export type AuthMiddlewareFunction = (
  req: Request,
  res: Response,
  next: NextFunction,
) => void;

interface JwtPayload {
  userId: string;
}

export function createAuthMiddleware(): AuthMiddlewareFunction {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const token = authHeader.slice(7); // Remove 'Bearer ' prefix

    if (!token) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    try {
      const decoded = jwt.verify(token, secret) as JwtPayload;

      (req as AuthenticatedRequest).user = { id: decoded.userId };
      next();
    } catch {
      res.status(401).json({ message: "Unauthorized" });
    }
  };
}
```

#### File: `src/inversify.config.ts`

Add the binding for `TYPES.AuthMiddleware`:

```typescript
import { createAuthMiddleware } from "./middleware/auth-middleware";
import type { AuthMiddlewareFunction } from "./middleware/auth-middleware";

// Inside createContainer():
container
  .bind<AuthMiddlewareFunction>(TYPES.AuthMiddleware)
  .toConstantValue(createAuthMiddleware());
```

### Files to Modify

| File                                            | Action                                                     |
| ----------------------------------------------- | ---------------------------------------------------------- |
| `src/middleware/auth-middleware.ts`             | Add `createAuthMiddleware` function + JwtPayload interface |
| `src/inversify.config.ts`                       | Add AuthMiddleware binding in container                    |
| `tests/unit/middleware/auth-middleware.test.ts` | New file — unit tests                                      |

### Testing Strategy

**Unit tests only** for this task. The middleware is a pure function — no DI
container needed for testing.

**Test file**: `tests/unit/middleware/auth-middleware.test.ts`

**Mock setup**:

```typescript
import jwt from "jsonwebtoken";

jest.mock("jsonwebtoken");
const mockVerify = jwt.verify as jest.Mock;
```

**Request/Response mocks** — Create simple mocks matching Express types:

```typescript
const createMockRequest = (authHeader?: string): Partial<Request> => ({
  headers: authHeader !== undefined ? { authorization: authHeader } : {},
});

const createMockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const createMockNext = (): NextFunction => jest.fn();
```

**Environment setup**: Set `process.env.JWT_SECRET = 'test-secret'` in
`beforeEach`, delete it in `afterEach` for the missing-secret test.

### Test Cases

#### Happy Path

1. **Valid token** — Sets `req.user.id` from token payload and calls `next()`
   - Set `Authorization: Bearer valid-token`
   - Mock `jwt.verify` to return `{ userId: 'user-123' }`
   - Assert `(req as AuthenticatedRequest).user.id` equals `'user-123'`
   - Assert `next()` was called
   - Assert `res.status` was NOT called

#### Missing/Malformed Authorization Header

2. **No Authorization header** — Returns 401
3. **Empty Authorization header** — Returns 401
4. **Authorization header without Bearer prefix** — Returns 401 (e.g.,
   `Authorization: Basic abc123`)
5. **Bearer with no token** — Returns 401 (e.g., `Authorization: Bearer ` —
   trailing space, empty token)

#### Invalid Token

6. **jwt.verify throws JsonWebTokenError** (invalid signature) — Returns 401
7. **jwt.verify throws TokenExpiredError** (expired token) — Returns 401
8. **jwt.verify throws generic error** — Returns 401

#### Missing JWT_SECRET

9. **JWT_SECRET env var not set** — Returns 401
   - Delete `process.env.JWT_SECRET` before calling middleware
   - Assert 401 response

#### Response Format

10. **All 401 responses use `{ message: 'Unauthorized' }`** — Verify the exact
    JSON body for each error case
11. **`next()` is NOT called on any error path** — Verify for each error case

### Coding Guidelines

- Use `import jwt from 'jsonwebtoken'` (default import, matching
  UserServiceImpl)
- Use `jwt.verify(token, secret)` — NOT `jwt.decode` (decode doesn't validate)
- Cast the decoded result as `JwtPayload` (local interface)
- Use `authHeader.startsWith('Bearer ')` — with trailing space
- Use `authHeader.slice(7)` to extract the token (length of `'Bearer '`)
- All 401 responses: `res.status(401).json({ message: 'Unauthorized' })`
- No `async` — the middleware is synchronous (`jwt.verify` is synchronous)
- Follow 4-space indentation, single quotes, `const` preference
- Test file: `import 'reflect-metadata'` as first import (project convention)

### Edge Cases & Pitfalls

1. **`jwt.verify` vs `jwt.decode`** — MUST use `verify` which validates the
   signature. `decode` only parses without verification.
2. **Bearer prefix parsing** — Be careful with `'Bearer '` (7 characters). Don't
   use `split(' ')` which breaks on tokens containing spaces (unlikely but
   defensive).
3. **Token after Bearer** — Check that the token is non-empty after slicing.
   `'Bearer '` with nothing after it should be rejected.
4. **Error swallowing** — The catch block must NOT re-throw. Any error from
   `jwt.verify` (expired, invalid, malformed) should result in a 401.
5. **Type assertion** — Use `(req as AuthenticatedRequest).user = ...` to attach
   user data, matching the pattern already used in UserController.

## Milestones

### Milestone 1: Unit tests for auth middleware (Red phase)

- **Description**: Write comprehensive unit tests for the `createAuthMiddleware`
  factory function covering all happy and error paths. Tests should fail because
  `createAuthMiddleware` does not exist yet.
- **Acceptance Criteria**:
  - [x] Test: valid Bearer token sets `req.user.id` and calls `next()`
  - [x] Test: missing Authorization header returns 401
  - [x] Test: empty Authorization header returns 401
  - [x] Test: non-Bearer Authorization header returns 401
  - [x] Test: Bearer with empty token returns 401
  - [x] Test: invalid token (jwt.verify throws) returns 401
  - [x] Test: expired token (jwt.verify throws) returns 401
  - [x] Test: missing JWT_SECRET env var returns 401
  - [x] Test: all error responses use `{ message: 'Unauthorized' }`
  - [x] Test: `next()` is never called on error paths
  - [x] Tests fail because `createAuthMiddleware` does not exist yet
- **Status**: done

### Milestone 2: Implement createAuthMiddleware (Green phase)

- **Description**: Implement the `createAuthMiddleware` factory function in
  `src/middleware/auth-middleware.ts` to make all tests pass.
- **Acceptance Criteria**:
  - [x] `createAuthMiddleware` exported from `src/middleware/auth-middleware.ts`
  - [x] Parses Bearer token from Authorization header
  - [x] Verifies token with `jwt.verify` using `process.env.JWT_SECRET`
  - [x] Sets `req.user = { id: payload.userId }` on success
  - [x] Returns 401 with `{ message: 'Unauthorized' }` for all error conditions
  - [x] All unit tests pass (`make test-unit`)
  - [x] TypeScript compiles cleanly (`make typecheck`)
  - [x] Linting passes (`make lint`)
- **Status**: done

### Milestone 3: Wire DI container binding

- **Description**: Bind the auth middleware in the DI container so
  inversify-express-utils can resolve it for protected routes.
- **Acceptance Criteria**:
  - [x] `createAuthMiddleware` imported in `src/inversify.config.ts`
  - [x] `container.bind<AuthMiddlewareFunction>(TYPES.AuthMiddleware).toConstantValue(createAuthMiddleware())`
        added
  - [x] `make typecheck` passes
  - [x] `make test-unit` passes (no regressions)
- **Status**: done

### Milestone 4: Review and refactor

- **Description**: Review the implementation for code quality, security, and
  adherence to project conventions.
- **Acceptance Criteria**:
  - [x] Uses `jwt.verify` (NOT `jwt.decode`)
  - [x] No information leakage in error responses (all say "Unauthorized")
  - [x] No database lookup in middleware
  - [x] Token payload correctly mapped to `req.user.id`
  - [x] Consistent with UserServiceImpl JWT signing (`{ userId }` payload)
  - [x] Code follows existing patterns (4-space indent, single quotes, const)
  - [x] All tests pass: `make test-unit`
  - [x] TypeScript compiles: `make typecheck`
  - [x] Lint passes: `make lint`
- **Status**: done

### Milestone 5: Rename `password` to `passwordHash` in entity and data layer

- **Description**: The `password` column and entity field give the false
  impression that raw passwords are stored. In reality, the field holds a scrypt
  hash. Rename throughout the data layer for semantic clarity. Since the app has
  never been released, we change everything in place — no new migration needed.
- **Scope of changes**:
  - `src/entities/user.ts` — field `password` → `passwordHash`, column name
    `password` → `password_hash`
  - `src/migrations/1740000000000-CreateUser.ts` — column `"password"` →
    `"password_hash"`
  - `src/repositories/user-repository.ts` — `CreateUserData.password` →
    `passwordHash`
  - `src/services/user-service.ts` — `RegisterUserDto.password` stays (raw input
    from user), but entity references `user.password` → `user.passwordHash` and
    `{ password: hashedPassword }` → `{ passwordHash: hashedPassword }`. The
    `toUserResponse` helper already omits `password` — update it to omit
    `passwordHash` instead.
  - `src/controllers/user-controller.ts` — untouched (handles raw passwords from
    request body, passed to service layer)
  - `src/services/password-manager-service.ts` — untouched (operates on strings,
    not entity fields)
  - All test files referencing `password` on mock User entities or
    CreateUserData objects must be updated
- **Acceptance Criteria**:
  - [x] Entity field renamed to `passwordHash` with column `password_hash`
  - [x] Migration uses `password_hash` column name
  - [x] `CreateUserData` type uses `passwordHash`
  - [x] Service layer stores hash as `passwordHash`, reads `user.passwordHash`
  - [x] `toUserResponse` does not leak `passwordHash`
  - [x] All tests updated and passing (`make test-unit`,
        `make test-integration`)
  - [x] `make typecheck` passes
  - [x] `make lint` passes
- **Status**: done
