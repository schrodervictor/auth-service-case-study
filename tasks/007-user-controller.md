# Task: User Controller (Outside-In TDD)

## Status: pending

## Context

INSTRUCTIONS.md Tasks 4, 5, and 6 require a UserService, UserController, and
auth middleware respectively. This task uses an outside-in TDD approach: build
the controller first, mocking the service interface to define what it should
look like. The service and auth middleware are defined as types/interfaces only
(no implementation) so the controller can be fully tested in isolation.

What already exists:

- Express + InversifyJS bootstrap (`src/index.ts`)
- `BaseController` at `src/lib/base-controller.ts` (extends
  `BaseHttpController`, provides `GET /health-check`)
- `HealthCheckController` at `src/controllers/health-check-controller.ts`
- User entity at `src/entities/user.ts` with id, email, password, firstName,
  lastName, createdAt, updatedAt
- `UserRepository` interface + impl at `src/repositories/user-repository.ts`
- `PasswordManagerService` interface + impl at
  `src/services/password-manager-service.ts`
- DI container at `src/inversify.config.ts` with Config, DataSource,
  PasswordManagerService, UserRepository already bound
- Placeholder at `src/controllers/user-controller.ts` (`// Fill here`)
- Placeholder at `src/services/user-service.ts` (`// Fill here`)

What this task produces:

- `UserService` interface + DTOs (types only, NO implementation)
- Custom domain error classes for service-layer errors
- `AuthMiddleware` interface (types only, NO implementation)
- `UserController` with all 4 routes from INSTRUCTIONS.md Task 5
- DI symbol additions for `UserService` and `AuthMiddleware`
- Comprehensive unit tests with mocked service and auth middleware
- DI wiring for the controller import (not the service/middleware bindings,
  since those have no implementations yet)

## Technical Specification

### Architecture Decisions

1. **Outside-in approach** -- The controller is built before the service. The
   `UserService` interface is defined as a type contract (what the controller
   needs to call). The actual `UserServiceImpl` will be built in a future task
   using the repository and password manager.

2. **Interface-only files for unimplemented dependencies** -- The `UserService`
   interface and its DTOs live in `src/services/user-service.ts`. The
   `AuthMiddleware` function type lives in `src/middleware/auth-middleware.ts`.
   Both files export ONLY types/interfaces -- no `@injectable()` class, no
   implementation. This is intentional: the controller depends on these
   interfaces via DI, and tests mock them.

3. **Custom error classes for domain errors** -- The service interface contract
   implies specific failure modes. Rather than having the service return error
   codes or null values that the controller must interpret, the service throws
   typed domain errors. The controller catches these and maps them to HTTP
   status codes. Error classes live in `src/errors/`.

4. **inversify-express-utils decorators** -- The controller uses `@controller`,
   `@httpPost`, `@httpGet`, `@httpPut`, `@request()`, `@response()` decorators
   from `inversify-express-utils`. This matches the patterns in
   `example-controller.ts` and `base-controller.ts`.

5. **Controller extends BaseController** -- Following the existing pattern where
   `HealthCheckController extends BaseController`. The `BaseController` extends
   `BaseHttpController` from inversify-express-utils and provides `this.json()`
   for responses.

6. **Auth middleware as inversify-express-utils middleware** -- Protected routes
   (`GET /users/profile`, `PUT /users/profile`) use the inversify-express-utils
   `@httpGet('...', MIDDLEWARE)` pattern where the middleware is injected via
   DI. The middleware function type signature follows Express middleware
   conventions: `(req, res, next) => void`.

7. **No input validation in the controller** -- The controller is a thin HTTP
   adapter. It extracts data from `req.body` and `req.user` (set by auth
   middleware), calls the service, and maps results/errors to HTTP responses.
   Input validation (email format, password complexity) belongs in the service
   layer. The controller only checks that required fields are present (not
   undefined/null).

8. **Response format** -- JSON responses. Successful operations return the
   relevant data. Error responses return `{ message: string }`. User profile
   responses NEVER include the password field.

### Route Specifications

#### POST /users/register

- **Request body**: `{ email, password, firstName, lastName }` (all required)
- **Success**: 201 Created with
  `{ id, email, firstName, lastName, createdAt, updatedAt }` (no password in
  response)
- **Errors**:
  - 400 Bad Request -- missing required fields
  - 409 Conflict -- email already registered (service throws
    `EmailAlreadyExistsError`)
  - 422 Unprocessable Entity -- validation failures like weak password or
    invalid email (service throws `ValidationError`)

#### POST /users/login

- **Request body**: `{ email, password }` (both required)
- **Success**: 200 OK with `{ token }` (JWT access token)
- **Errors**:
  - 400 Bad Request -- missing required fields
  - 401 Unauthorized -- invalid credentials (service throws
    `InvalidCredentialsError`)

#### GET /users/profile (protected)

- **Auth**: Requires valid JWT via auth middleware. Middleware sets `req.user`
  with `{ id }`.
- **Success**: 200 OK with
  `{ id, email, firstName, lastName, createdAt, updatedAt }` (no password)
- **Errors**:
  - 401 Unauthorized -- no/invalid token (handled by auth middleware before
    controller)
  - 404 Not Found -- user ID from token not found in DB (service throws
    `UserNotFoundError`)

#### PUT /users/profile (protected)

- **Auth**: Same as GET /users/profile.
- **Request body**: `{ firstName?, lastName? }` (at least one required)
- **Success**: 200 OK with
  `{ id, email, firstName, lastName, createdAt, updatedAt }` (no password)
- **Errors**:
  - 400 Bad Request -- no updatable fields provided
  - 401 Unauthorized -- no/invalid token (auth middleware)
  - 404 Not Found -- user not found (service throws `UserNotFoundError`)

### Interface Contracts

#### UserService Interface

```typescript
export interface UserService {
  register(data: RegisterUserDto): Promise<UserResponseDto>;
  authenticate(email: string, password: string): Promise<AuthResponseDto>;
  getProfile(userId: string): Promise<UserResponseDto>;
  updateProfile(
    userId: string,
    data: UpdateProfileDto,
  ): Promise<UserResponseDto>;
}
```

#### DTOs

```typescript
export type RegisterUserDto = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
};

export type UpdateProfileDto = {
  firstName?: string;
  lastName?: string;
};

export type UserResponseDto = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
  updatedAt: Date;
};

export type AuthResponseDto = {
  token: string;
};
```

#### AuthMiddleware

```typescript
import type { Request, Response, NextFunction } from "express";

export type AuthenticatedRequest = Request & {
  user: { id: string };
};

export type AuthMiddlewareFunction = (
  req: Request,
  res: Response,
  next: NextFunction,
) => void;
```

### Error Classes

All custom errors extend a base `AppError` class. They live in `src/errors/`.

```typescript
// src/errors/app-error.ts
export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

// src/errors/email-already-exists-error.ts
export class EmailAlreadyExistsError extends AppError {
  readonly statusCode = 409;
  constructor(email: string) {
    super(`Email "${email}" is already registered`);
  }
}

// src/errors/invalid-credentials-error.ts
export class InvalidCredentialsError extends AppError {
  readonly statusCode = 401;
  constructor() {
    super("Invalid email or password");
  }
}

// src/errors/user-not-found-error.ts
export class UserNotFoundError extends AppError {
  readonly statusCode = 404;
  constructor(userId: string) {
    super(`User not found: ${userId}`);
  }
}

// src/errors/validation-error.ts
export class ValidationError extends AppError {
  readonly statusCode = 422;
  constructor(message: string) {
    super(message);
  }
}
```

### Files to Create

| File                                             | Purpose                                                         |
| ------------------------------------------------ | --------------------------------------------------------------- |
| `src/errors/app-error.ts`                        | Base error class with statusCode                                |
| `src/errors/email-already-exists-error.ts`       | 409 Conflict domain error                                       |
| `src/errors/invalid-credentials-error.ts`        | 401 Unauthorized domain error                                   |
| `src/errors/user-not-found-error.ts`             | 404 Not Found domain error                                      |
| `src/errors/validation-error.ts`                 | 422 Unprocessable Entity domain error                           |
| `src/errors/index.ts`                            | Barrel export for all errors                                    |
| `src/middleware/auth-middleware.ts`              | Type exports only: AuthenticatedRequest, AuthMiddlewareFunction |
| `src/middleware/index.ts`                        | Barrel export                                                   |
| `tests/unit/controllers/user-controller.test.ts` | Unit tests for UserController                                   |

### Files to Modify

| File                                 | Action                                                           |
| ------------------------------------ | ---------------------------------------------------------------- |
| `src/services/user-service.ts`       | Replace placeholder with interface + DTO type exports (NO impl)  |
| `src/services/index.ts`              | Uncomment/add user-service export                                |
| `src/controllers/user-controller.ts` | Replace placeholder with full controller implementation          |
| `src/controllers/index.ts`           | Uncomment/add user-controller export                             |
| `src/lib/types.ts`                   | Add `UserService` and `AuthMiddleware` symbols                   |
| `src/inversify.config.ts`            | Add controller import (side-effect import for auto-registration) |

### Coding Guidelines

Follow the exact patterns established in the codebase:

- **Import style**: Named imports, single quotes, trailing semicolons, 4-space
  indentation (matching Prettier/ESLint config).
- **Controller pattern**: See `src/controllers/health-check-controller.ts` and
  `src/controllers/example-controller.ts` (commented out). Controllers use
  `@controller('/path')`, extend `BaseController`, inject services via
  constructor with `@inject(TYPES.X)`.
- **Decorator imports**: From `inversify-express-utils`: `controller`,
  `httpPost`, `httpGet`, `httpPut`, `request`, `response`.
- **Service injection**: Constructor injection with
  `@inject(TYPES.UserService) private userService: UserService`.
- **Request/Response access**: Use `@request() req: Request` and
  `@response() res: Response` parameter decorators.
- **Response pattern**: Use `res.status(code).json(data)` for all responses. Do
  NOT use `this.json()` from `BaseHttpController` -- it requires the
  inversify-express-utils request context, which is not available in unit tests
  that instantiate the controller directly. The `example-controller.ts` pattern
  uses `res.status(200).json(...)` which confirms this approach.
- **Interface + impl convention**: See `password-manager-service.ts`. Interface
  is a plain TypeScript interface (not abstract class). Impl class has
  `@injectable()` decorator. Both are named exports.
- **Error class convention**: Each error in its own file, extending `AppError`.
  Use `this.name = this.constructor.name` in the base to ensure proper error
  names.

### Controller Implementation Details

```typescript
// src/controllers/user-controller.ts
import { Request, Response } from "express";
import { inject } from "inversify";
import {
  controller,
  httpPost,
  httpGet,
  httpPut,
  request,
  response,
} from "inversify-express-utils";

import { BaseController } from "../lib/base-controller";
import { TYPES } from "../lib/types";
import type { UserService } from "../services/user-service";
import type { AuthenticatedRequest } from "../middleware/auth-middleware";
import { AppError } from "../errors";

@controller("/users")
export class UserController extends BaseController {
  constructor(@inject(TYPES.UserService) private userService: UserService) {
    super();
  }

  @httpPost("/register")
  async register(@request() req: Request, @response() res: Response) {
    try {
      const { email, password, firstName, lastName } = req.body ?? {};
      if (!email || !password || !firstName || !lastName) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      const user = await this.userService.register({
        email,
        password,
        firstName,
        lastName,
      });
      return res.status(201).json(user);
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  @httpPost("/login")
  async login(@request() req: Request, @response() res: Response) {
    try {
      const { email, password } = req.body ?? {};
      if (!email || !password) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      const result = await this.userService.authenticate(email, password);
      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  @httpGet("/profile", TYPES.AuthMiddleware)
  async getProfile(@request() req: Request, @response() res: Response) {
    try {
      const userId = (req as AuthenticatedRequest).user.id;
      const user = await this.userService.getProfile(userId);
      return res.status(200).json(user);
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  @httpPut("/profile", TYPES.AuthMiddleware)
  async updateProfile(@request() req: Request, @response() res: Response) {
    try {
      const userId = (req as AuthenticatedRequest).user.id;
      const { firstName, lastName } = req.body ?? {};
      if (!firstName && !lastName) {
        return res
          .status(400)
          .json({
            message: "At least one field (firstName or lastName) is required",
          });
      }
      const data: { firstName?: string; lastName?: string } = {};
      if (firstName) data.firstName = firstName;
      if (lastName) data.lastName = lastName;
      const user = await this.userService.updateProfile(userId, data);
      return res.status(200).json(user);
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }
}
```

### DI Wiring Changes

1. **`src/lib/types.ts`** -- Add two new symbols:

   ```typescript
   UserService: Symbol.for('UserService'),
   AuthMiddleware: Symbol.for('AuthMiddleware'),
   ```

2. **`src/inversify.config.ts`** -- Add the side-effect controller import so
   inversify-express-utils discovers the controller:

   ```typescript
   import "./controllers/user-controller";
   ```

   Do NOT bind `UserService` or `AuthMiddleware` yet -- they have no
   implementations. The controller file is imported for its decorator
   side-effects, but it will fail at runtime until the service and middleware
   are bound. This is intentional for the outside-in TDD approach. Unit tests
   mock these dependencies directly.

3. **`src/controllers/index.ts`** -- Add export:

   ```typescript
   export * from "./user-controller";
   ```

4. **`src/services/index.ts`** -- Add export:

   ```typescript
   export * from "./user-service";
   ```

### Test Strategy

All tests are **unit tests** for the controller. They run without a database,
without a real Express server, and without real service implementations.

#### Test Approach

The inversify-express-utils controller methods receive `@request()` and
`@response()` decorated parameters. For unit testing, we instantiate the
controller directly (bypassing inversify-express-utils routing) and pass mock
Request/Response objects.

**Setup pattern:**

```typescript
import "reflect-metadata";
import type { Request, Response } from "express";
import { UserController } from "../../../src/controllers/user-controller";
import type { UserService } from "../../../src/services/user-service";
import {
  EmailAlreadyExistsError,
  InvalidCredentialsError,
  UserNotFoundError,
  ValidationError,
} from "../../../src/errors";

const createMockUserService = (): jest.Mocked<UserService> => ({
  register: jest.fn(),
  authenticate: jest.fn(),
  getProfile: jest.fn(),
  updateProfile: jest.fn(),
});

const createMockRequest = (
  body?: Record<string, unknown>,
  user?: { id: string },
): Partial<Request> => ({
  body,
  ...(user ? { user } : {}),
});

const createMockResponse = (): Partial<Response> & {
  statusCode?: number;
  body?: unknown;
} => {
  const res: Partial<Response> & { statusCode?: number; body?: unknown } = {};
  res.status = jest.fn().mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn().mockImplementation((data: unknown) => {
    res.body = data;
    return res;
  });
  return res;
};
```

**Controller instantiation:**

```typescript
let mockService: jest.Mocked<UserService>;
let controller: UserController;

beforeEach(() => {
  mockService = createMockUserService();
  controller = new UserController(mockService);
});
```

#### Test Cases -- POST /users/register

1. Returns 201 with user data (no password) on successful registration
2. Calls `userService.register` with email, password, firstName, lastName from
   request body
3. Returns 400 when email is missing
4. Returns 400 when password is missing
5. Returns 400 when firstName is missing
6. Returns 400 when lastName is missing
7. Returns 400 when body is empty/undefined
8. Returns 409 when service throws `EmailAlreadyExistsError`
9. Returns 422 when service throws `ValidationError` (e.g., weak password)
10. Returns 500 when service throws an unexpected error

#### Test Cases -- POST /users/login

11. Returns 200 with `{ token }` on successful authentication
12. Calls `userService.authenticate` with email and password from body
13. Returns 400 when email is missing
14. Returns 400 when password is missing
15. Returns 401 when service throws `InvalidCredentialsError`
16. Returns 500 when service throws an unexpected error

#### Test Cases -- GET /users/profile

17. Returns 200 with user data (no password) on success
18. Calls `userService.getProfile` with the userId from `req.user.id`
19. Returns 404 when service throws `UserNotFoundError`
20. Returns 500 when service throws an unexpected error

#### Test Cases -- PUT /users/profile

21. Returns 200 with updated user data (no password) on success
22. Calls `userService.updateProfile` with userId and update data
23. Returns 200 when only firstName is provided (partial update)
24. Returns 200 when only lastName is provided (partial update)
25. Returns 400 when neither firstName nor lastName is provided
26. Returns 400 when body is empty/undefined
27. Returns 404 when service throws `UserNotFoundError`
28. Returns 500 when service throws an unexpected error

#### Test Cases -- Error response format

29. All error responses include a `message` field (e.g., `{ message: '...' }`)
30. Domain error messages are passed through from the error class

#### Test File Structure

```
tests/unit/controllers/user-controller.test.ts
  describe('UserController')
    describe('POST /register')
      it('should return 201 with user data on successful registration')
      it('should call userService.register with body fields')
      it('should return 400 when email is missing')
      ...
    describe('POST /login')
      ...
    describe('GET /profile')
      ...
    describe('PUT /profile')
      ...
```

### Edge Cases

- **req.body is undefined**: Express can send `undefined` body if no body parser
  matches. The controller must handle `req.body ?? {}` defensively.
- **Extra fields in request body**: The controller extracts only known fields
  via destructuring. Extra fields are ignored and never passed to the service.
- **Empty string fields**: An empty string `""` for email/password should be
  treated as missing (falsy check with `!field`). This means `!""` is `true`, so
  empty strings are caught by the required-fields check.
- **Auth middleware not tested here**: The auth middleware is a type stub. The
  controller tests for protected routes assume `req.user.id` is already set (the
  middleware's job). Testing the middleware itself is a separate task.
- **Password never in response**: The `UserResponseDto` intentionally omits the
  `password` field. The service is responsible for constructing this DTO from
  the User entity. The controller test verifies that the service's return value
  is passed through as-is.
- **`this.json()` vs `res.status().json()`**: Since unit tests instantiate the
  controller directly without the inversify-express-utils request context,
  `this.json()` would fail. Use `res.status(code).json(data)` consistently. This
  also gives the controller explicit control over status codes.

### Dependencies

No new npm packages required. All imports are from existing dependencies:

- `inversify` (inject)
- `inversify-express-utils` (controller, httpPost, httpGet, httpPut, request,
  response)
- `express` (Request, Response, NextFunction -- types only)

### Implementation Order

1. Create error classes in `src/errors/` (app-error.ts, domain errors, index.ts
   barrel)
2. Define `UserService` interface + DTOs in `src/services/user-service.ts`
   (types only)
3. Update `src/services/index.ts` to export user-service
4. Define auth middleware types in `src/middleware/auth-middleware.ts`
5. Create `src/middleware/index.ts` barrel
6. Add `UserService` and `AuthMiddleware` symbols to `src/lib/types.ts`
7. Implement `UserController` in `src/controllers/user-controller.ts`
8. Update `src/controllers/index.ts` to export user-controller
9. Add controller import in `src/inversify.config.ts`
10. Write unit tests in `tests/unit/controllers/user-controller.test.ts`
11. Run `make test-unit` and `make typecheck` to verify

## Milestones

### Milestone 1: Error Classes

- **Description**: Create the domain error hierarchy used by the service
  interface contract and caught by the controller for HTTP status mapping.
- **Acceptance Criteria**:
  - [ ] `src/errors/app-error.ts` exports abstract `AppError` extending `Error`
        with abstract `statusCode` property
  - [ ] `src/errors/email-already-exists-error.ts` exports
        `EmailAlreadyExistsError` (statusCode 409)
  - [ ] `src/errors/invalid-credentials-error.ts` exports
        `InvalidCredentialsError` (statusCode 401)
  - [ ] `src/errors/user-not-found-error.ts` exports `UserNotFoundError`
        (statusCode 404)
  - [ ] `src/errors/validation-error.ts` exports `ValidationError`
        (statusCode 422)
  - [ ] `src/errors/index.ts` barrel exports all error classes
  - [ ] Each error sets `this.name = this.constructor.name`
  - [ ] `make typecheck` passes
- **Status**: pending

### Milestone 2: UserService Interface and DTOs

- **Description**: Define the UserService interface and all DTO types. NO
  implementation class -- types only.
- **Acceptance Criteria**:
  - [ ] `src/services/user-service.ts` exports `UserService` interface with
        `register`, `authenticate`, `getProfile`, `updateProfile` methods
  - [ ] Exports `RegisterUserDto`, `UpdateProfileDto`, `UserResponseDto`,
        `AuthResponseDto` types
  - [ ] File contains NO `@injectable()` class, NO implementation
  - [ ] `src/services/index.ts` exports user-service
  - [ ] `TYPES.UserService` symbol added to `src/lib/types.ts`
  - [ ] `make typecheck` passes
- **Status**: pending

### Milestone 3: Auth Middleware Types

- **Description**: Define the auth middleware type contract. Types only, no
  implementation.
- **Acceptance Criteria**:
  - [ ] `src/middleware/auth-middleware.ts` exports `AuthenticatedRequest` type
        and `AuthMiddlewareFunction` type
  - [ ] `src/middleware/index.ts` barrel exports all types
  - [ ] `TYPES.AuthMiddleware` symbol added to `src/lib/types.ts`
  - [ ] `make typecheck` passes
- **Status**: pending

### Milestone 4: UserController Implementation

- **Description**: Implement the UserController with all 4 routes, injecting
  UserService, using auth middleware symbol for protected routes.
- **Acceptance Criteria**:
  - [ ] `src/controllers/user-controller.ts` exports `UserController` class
  - [ ] Class has `@controller('/users')` decorator and extends `BaseController`
  - [ ] Constructor injects `UserService` via `@inject(TYPES.UserService)`
  - [ ] `POST /register` route: extracts body, validates required fields, calls
        `userService.register`, returns 201
  - [ ] `POST /login` route: extracts body, validates required fields, calls
        `userService.authenticate`, returns 200 with token
  - [ ] `GET /profile` route: protected via `TYPES.AuthMiddleware`, extracts
        userId from `req.user.id`, calls `userService.getProfile`, returns 200
  - [ ] `PUT /profile` route: protected via `TYPES.AuthMiddleware`, extracts
        userId and body, validates at least one field, calls
        `userService.updateProfile`, returns 200
  - [ ] All routes catch `AppError` and map to appropriate HTTP status
  - [ ] All routes catch unexpected errors and return 500
  - [ ] Response bodies never include password
  - [ ] `src/controllers/index.ts` exports user-controller
  - [ ] `src/inversify.config.ts` imports `'./controllers/user-controller'`
  - [ ] `make typecheck` passes
- **Status**: pending

### Milestone 5: Unit Tests

- **Description**: Comprehensive unit tests for all controller routes with
  mocked UserService, covering happy paths, validation errors, domain errors,
  and unexpected errors.
- **Acceptance Criteria**:
  - [ ] `tests/unit/controllers/user-controller.test.ts` exists
  - [ ] Tests instantiate the controller directly with a mocked UserService
  - [ ] Tests use mock Request/Response objects (no real Express server)
  - [ ] All 30 test cases from the test strategy are covered
  - [ ] Tests verify correct HTTP status codes for all scenarios
  - [ ] Tests verify response body structure (user data, token, error messages)
  - [ ] Tests verify service methods are called with correct arguments
  - [ ] Tests verify password is never included in responses
  - [ ] `make test-unit` passes with all tests green
- **Status**: pending
