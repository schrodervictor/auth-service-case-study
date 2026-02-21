# Task: User Service

## Status: in-progress

## Context

INSTRUCTIONS.md Task 4 requires implementing the UserService — the core business
logic layer that sits between the UserController (task 007, implemented) and the
UserRepository (task 006, implemented). The UserController already injects
`TYPES.UserService` and calls all four methods (`register`, `authenticate`,
`getProfile`, `updateProfile`), but no implementation exists yet.

The UserService interface and DTOs are already defined at
`src/services/user-service.ts`. The DI symbol `TYPES.UserService` exists in
`src/lib/types.ts`. The container binding in `src/inversify.config.ts` is
commented out. The barrel export in `src/services/index.ts` already exports from
`user-service.ts`.

Dependencies that are already implemented and tested:

- **UserRepository** (`src/repositories/user-repository.ts`) — `findByEmail`,
  `findById`, `create`, `update`
- **PasswordManagerServiceImpl** (`src/services/password-manager-service.ts`) —
  `toHash`, `compare` (scrypt + timingSafeEqual)
- **Error classes** (`src/errors/`) — `ValidationError`,
  `EmailAlreadyExistsError`, `InvalidCredentialsError`, `UserNotFoundError`
- **AppConfig** (`src/config/schema.ts`) — `auth.accessToken.expiresIn` (default
  `'15m'`)

Missing dependency: the `jsonwebtoken` npm package is NOT installed yet. It must
be added along with its `@types/jsonwebtoken` type definitions.

## Technical Specification

### Architecture Decisions

1. **Single file** — `UserServiceImpl` class lives alongside the existing
   interface in `src/services/user-service.ts`, matching the project's
   interface-plus-impl convention (see `password-manager-service.ts` for the
   pattern: interface + `@injectable()` impl in the same file).

2. **Constructor injection** — The impl class uses InversifyJS `@inject`
   decorators for three dependencies:
   - `@inject(TYPES.UserRepository) private readonly userRepository: UserRepository`
   - `@inject(TYPES.PasswordManagerService) private readonly passwordManager: PasswordManagerService`
   - `@inject(TYPES.Config) private readonly config: AppConfig`

3. **JWT secret from environment** — The JWT signing secret comes from
   `process.env.JWT_SECRET`. If the env var is missing or empty, the service
   should throw an `Error('JWT_SECRET environment variable is not set')` at sign
   time (fail-fast, no fallback secrets). Do NOT store the secret in config JSON
   (secrets come from a secrets manager, not config files).

4. **Validation at the service layer** — Input validation (email format,
   password strength, required fields) happens in the service, not the
   controller. The controller does basic null checks for 400 responses; the
   service does semantic validation and throws `ValidationError` with structured
   field errors.

5. **UserResponseDto mapping** — A private helper method
   `toUserResponse(user: User): UserResponseDto` strips the `password` field
   from the User entity. Every method that returns `UserResponseDto` must use
   this helper. Never return the password hash to callers.

6. **No try/catch around repository calls** — Let repository errors (e.g.,
   TypeORM unique constraint violations) propagate. The service catches only
   what it needs to (e.g., checking `findByEmail` result before calling
   `create`).

### Dependencies to Install

```bash
npm install jsonwebtoken
npm install --save-dev @types/jsonwebtoken
```

These must be installed BEFORE the implementation phase. Update `package.json`
accordingly.

### Interface Contract (already defined)

```typescript
// src/services/user-service.ts (existing)
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

### Method Specifications

#### `register(data: RegisterUserDto): Promise<UserResponseDto>`

1. **Validate input** — Collect all validation errors into a single
   `Record<string, string[]>` and throw one `ValidationError` with all of them:
   - `email`: Must be a valid email format. Use a regex such as
     `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`. Error: `'Invalid email format'`.
   - `password`: Minimum 8 characters, at least one uppercase letter
     (`/[A-Z]/`), at least one lowercase letter (`/[a-z]/`), at least one number
     (`/[0-9]/`). Each failed rule is a separate error string in the array:
     - `'Password must be at least 8 characters long'`
     - `'Password must contain at least one uppercase letter'`
     - `'Password must contain at least one lowercase letter'`
     - `'Password must contain at least one number'`
   - `firstName`: Must be a non-empty string after trimming. Error:
     `'First name is required'`.
   - `lastName`: Must be a non-empty string after trimming. Error:
     `'Last name is required'`.
2. **Check email uniqueness** — Call `userRepository.findByEmail(data.email)`.
   If a user is found, throw `EmailAlreadyExistsError(data.email)`.
3. **Hash password** — Call `passwordManager.toHash(data.password)`.
4. **Create user** — Call
   `userRepository.create({ ...data, password: hashedPassword })`.
5. **Return** — `toUserResponse(createdUser)`.

#### `authenticate(email: string, password: string): Promise<AuthResponseDto>`

1. **Find user** — Call `userRepository.findByEmail(email)`. If `null`, throw
   `InvalidCredentialsError()`. Use the same generic error for both "user not
   found" and "wrong password" to avoid leaking information about which emails
   are registered.
2. **Compare password** — Call
   `passwordManager.compare(user.password, password)`. If `false`, throw
   `InvalidCredentialsError()`.
3. **Sign JWT** — Call `jwt.sign({ userId: user.id }, secret, { expiresIn })`
   where:
   - `secret` = `process.env.JWT_SECRET` (throw if missing)
   - `expiresIn` = `this.config.auth.accessToken.expiresIn`
4. **Return** — `{ token }`.

#### `getProfile(userId: string): Promise<UserResponseDto>`

1. **Find user** — Call `userRepository.findById(userId)`. If `null`, throw
   `UserNotFoundError(userId)`.
2. **Return** — `toUserResponse(user)`.

#### `updateProfile(userId: string, data: UpdateProfileDto): Promise<UserResponseDto>`

1. **Validate input** — If provided, `firstName` and `lastName` must be
   non-empty strings after trimming. Collect errors into
   `Record<string, string[]>` and throw `ValidationError` if any:
   - `firstName`: `'First name cannot be empty'` (only if key is present but
     value is empty/whitespace)
   - `lastName`: `'Last name cannot be empty'` (only if key is present but value
     is empty/whitespace)
2. **Update user** — Call `userRepository.update(userId, data)`. If `null` is
   returned, throw `UserNotFoundError(userId)`.
3. **Return** — `toUserResponse(updatedUser)`.

### Private Helper

```typescript
private toUserResponse(user: User): UserResponseDto {
    return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    };
}
```

### Files to Modify

| File                                       | Action                                                       |
| ------------------------------------------ | ------------------------------------------------------------ |
| `package.json`                             | Add `jsonwebtoken` to deps, `@types/jsonwebtoken` to devDeps |
| `src/services/user-service.ts`             | Add `UserServiceImpl` class below existing interface/types   |
| `src/inversify.config.ts`                  | Add `UserService` import and container binding               |
| `tests/unit/services/user-service.test.ts` | New file — unit tests                                        |

### Testing Strategy

**Unit tests only** for this task. The service is a pure logic layer — all I/O
(database, hashing) is injected and mockable.

**Test file**: `tests/unit/services/user-service.test.ts`

**Mock setup** (follow the pattern from
`tests/unit/controllers/user-controller.test.ts`):

```typescript
const createMockUserRepository = (): jest.Mocked<UserRepository> => ({
  findByEmail: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
});

const createMockPasswordManager = (): jest.Mocked<PasswordManagerService> => ({
  toHash: jest.fn(),
  compare: jest.fn(),
});
```

**JWT mock** — Mock the `jsonwebtoken` module:

```typescript
jest.mock("jsonwebtoken", () => ({
  sign: jest.fn().mockReturnValue("mock-jwt-token"),
}));
```

**Config fixture**:

```typescript
const mockConfig: AppConfig = {
  server: { port: 9000 },
  database: { host: "localhost", port: 5432, name: "test" },
  auth: {
    accessToken: { expiresIn: "15m" },
    refreshToken: { expiresIn: "7d" },
  },
};
```

**Environment setup** — Set `process.env.JWT_SECRET = 'test-secret'` in
`beforeEach`, delete it in `afterEach` for the JWT_SECRET-missing tests.

### Coding Guidelines

- Use `import 'reflect-metadata'` as the first import in the test file
- Use `@injectable()` and `@inject(TYPES.X)` decorators
- Use `const` for all variables that are not reassigned
- Use single quotes for strings
- Use 4-space indentation
- Match the error message strings exactly as specified (tests will assert them)
- All methods are `async` (return `Promise`)

## Milestones

### Milestone 1: Install jsonwebtoken dependency

- **Description**: Add `jsonwebtoken` and `@types/jsonwebtoken` packages to the
  project. Verify the build still passes after installation.
- **Acceptance Criteria**:
  - [ ] `jsonwebtoken` appears in `dependencies` in `package.json`
  - [ ] `@types/jsonwebtoken` appears in `devDependencies` in `package.json`
  - [ ] `make typecheck` passes
  - [ ] `make test-unit` passes (no regressions)
- **Status**: pending

### Milestone 2: Unit tests for register method (Red phase)

- **Description**: Write unit tests covering all paths of the `register` method.
- **Acceptance Criteria**:
  - [ ] Test: successful registration returns `UserResponseDto` without password
  - [ ] Test: throws `ValidationError` for invalid email format
  - [ ] Test: throws `ValidationError` for weak password (too short)
  - [ ] Test: throws `ValidationError` for password missing uppercase
  - [ ] Test: throws `ValidationError` for password missing lowercase
  - [ ] Test: throws `ValidationError` for password missing number
  - [ ] Test: throws `ValidationError` with multiple errors for multiple fields
  - [ ] Test: throws `ValidationError` for empty firstName
  - [ ] Test: throws `ValidationError` for empty lastName
  - [ ] Test: throws `EmailAlreadyExistsError` when email is taken
  - [ ] Test: calls `passwordManager.toHash` with the raw password
  - [ ] Test: calls `userRepository.create` with the hashed password (not raw)
  - [ ] Tests fail because `UserServiceImpl` does not exist yet
- **Status**: pending

### Milestone 3: Unit tests for authenticate method (Red phase)

- **Description**: Write unit tests covering all paths of the `authenticate`
  method.
- **Acceptance Criteria**:
  - [ ] Test: successful authentication returns `{ token }` (AuthResponseDto)
  - [ ] Test: throws `InvalidCredentialsError` when email not found
  - [ ] Test: throws `InvalidCredentialsError` when password does not match
  - [ ] Test: calls `jwt.sign` with `{ userId }` payload, secret, and expiresIn
  - [ ] Test: throws Error when `JWT_SECRET` env var is not set
  - [ ] Tests fail because `UserServiceImpl` does not exist yet
- **Status**: pending

### Milestone 4: Unit tests for getProfile and updateProfile (Red phase)

- **Description**: Write unit tests covering all paths of `getProfile` and
  `updateProfile`.
- **Acceptance Criteria**:
  - [ ] Test: `getProfile` returns `UserResponseDto` for existing user
  - [ ] Test: `getProfile` throws `UserNotFoundError` when user not found
  - [ ] Test: `getProfile` response does not contain `password` field
  - [ ] Test: `updateProfile` returns updated `UserResponseDto`
  - [ ] Test: `updateProfile` throws `UserNotFoundError` when user not found
  - [ ] Test: `updateProfile` throws `ValidationError` for empty firstName
  - [ ] Test: `updateProfile` throws `ValidationError` for empty lastName
  - [ ] Test: `updateProfile` passes only provided fields to repository
  - [ ] Tests fail because `UserServiceImpl` does not exist yet
- **Status**: pending

### Milestone 5: Implement UserServiceImpl (Green phase)

- **Description**: Implement the `UserServiceImpl` class to make all tests pass.
  Add the class to `src/services/user-service.ts` below the existing interface
  and type definitions.
- **Acceptance Criteria**:
  - [ ] `UserServiceImpl` is `@injectable()` with three `@inject` dependencies
  - [ ] All four methods implemented per the specification above
  - [ ] `toUserResponse` private helper strips password from User entity
  - [ ] Input validation throws `ValidationError` with structured field errors
  - [ ] JWT signing uses `process.env.JWT_SECRET` and config expiresIn
  - [ ] All unit tests pass (`make test-unit`)
  - [ ] TypeScript compiles cleanly (`make typecheck`)
  - [ ] Linting passes (`make lint`)
- **Status**: pending

### Milestone 6: Wire DI container binding

- **Description**: Add the `UserService` binding to the DI container so the
  UserController can resolve it at runtime.
- **Acceptance Criteria**:
  - [ ] `UserServiceImpl` imported in `src/inversify.config.ts`
  - [ ] `container.bind<UserService>(TYPES.UserService).to(UserServiceImpl)`
        added
  - [ ] `make typecheck` passes
  - [ ] `make test-unit` passes (including DI integration tests)
- **Status**: pending

### Milestone 7: Review and refactor

- **Description**: Review the implementation for code quality, refactoring
  opportunities, and adherence to project conventions.
- **Acceptance Criteria**:
  - [ ] No password data leaks in any return value
  - [ ] Error messages match the specification exactly
  - [ ] Validation collects all errors before throwing (not fail-fast per field)
  - [ ] JWT secret access is fail-fast (throws immediately if missing)
  - [ ] Code follows existing patterns (injectable, inject decorators,
        async/await)
  - [ ] All tests pass: `make test-unit`
  - [ ] TypeScript compiles: `make typecheck`
  - [ ] Lint passes: `make lint`
- **Status**: pending
