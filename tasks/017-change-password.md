# Task: Change Password

## Status: pending

## Context

Authenticated users need the ability to change their password. This is a
standard security feature that completes the user account management surface
alongside the existing register, login, refresh, logout, and profile endpoints.

The endpoint requires the user to provide their current password (to prevent
unauthorized changes by someone who obtained a stolen access token) and a new
password that meets the same strength requirements as registration.

As a security measure, changing the password revokes all existing refresh
tokens, forcing re-authentication on all devices.

## Technical Specification

### Architecture Decisions

**Endpoint**: `PUT /users/password` (authenticated, JSON body required).

**Request body**:

```json
{ "currentPassword": "OldP@ss1", "newPassword": "NewP@ss2" }
```

**Response**: `204 No Content` (no body) on success.

**Middleware chain**: `TYPES.AuthMiddleware`, `TYPES.JsonContentType` — same
pattern as other authenticated endpoints that accept a JSON body. The decorator
will be `@httpPut('/password', TYPES.AuthMiddleware, TYPES.JsonContentType)`.

**New error class — `IncorrectPasswordError`**: The existing
`InvalidCredentialsError` has the hardcoded message "Invalid email or password",
which is misleading in a change-password context. Create a new error class:

```
src/errors/incorrect-password-error.ts
  - extends AppError
  - statusCode = 401
  - message = "Current password is incorrect"
```

Export it from `src/errors/index.ts`.

**New DTO type**:

```typescript
export type ChangePasswordDto = {
  currentPassword: string;
  newPassword: string;
};
```

Defined in `src/services/user-service.ts` alongside the existing DTOs.

**Service method — `changePassword(userId, data)`**:

1. Validate input (service-layer validation, consistent with existing pattern):
   - If `currentPassword` is missing/empty: `ValidationError` with
     `{ currentPassword: ['Current password is required'] }`
   - If `newPassword` is missing/empty: `ValidationError` with
     `{ newPassword: ['New password is required'] }`
   - Both can fail simultaneously (collect all errors, throw once).
   - If `newPassword` is present, apply the same strength rules as `register()`:
     min 8 chars, uppercase, lowercase, digit. Reuse by extracting a private
     `validatePasswordStrength(password)` method from `register()` and calling
     it from both `register()` and `changePassword()`. The method should return
     `string[]` (list of error messages, empty if valid).

2. Fetch user by `userId` from repository. If not found, throw
   `UserNotFoundError`.

3. Compare `currentPassword` against `user.passwordHash` using
   `passwordManager.compare()`. If mismatch, throw `IncorrectPasswordError`.

4. Hash `newPassword` via `passwordManager.toHash()`.

5. Update the password hash in the database via a new repository method
   `updatePasswordHash(userId, hash)`.

6. Revoke all refresh tokens via
   `refreshTokenRepository.deleteAllByUserId(userId)`.

7. Return void.

**Repository method — `updatePasswordHash(id, hash)`**: Add to the
`UserRepository` interface and `UserRepositoryImpl`. The existing
`UpdateUserData` type only has `firstName`/`lastName` — adding `passwordHash` to
it would be a semantic mismatch (profile updates should not touch passwords).
Instead, add a dedicated method:

```typescript
// Interface
updatePasswordHash(id: string, passwordHash: string): Promise<boolean>;

// Implementation
async updatePasswordHash(id: string, passwordHash: string): Promise<boolean> {
    const result = await this.repository.update(id, { passwordHash });
    return (result.affected ?? 0) > 0;
}
```

Returns `true` if the row was updated, `false` if not found. The service should
throw `UserNotFoundError` if `false` is returned (defensive — the auth
middleware already validated the user exists via the JWT, but the user could
have been deleted between token issuance and this request).

**Controller handler**: Follow the existing pattern in `user-controller.ts`.
Destructure `req.body`, call the service, return 204. Map `UserNotFoundError` to
401 (same as `getProfile`/`updateProfile`). The `handleError` method already
covers `ValidationError` (422) and `AppError` subclasses (their respective
status codes).

### Files to Modify/Create

| File                                                 | Change                                                                                                                 |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `src/errors/incorrect-password-error.ts`             | **NEW** — `IncorrectPasswordError` (401)                                                                               |
| `src/errors/index.ts`                                | Add export for `IncorrectPasswordError`                                                                                |
| `src/repositories/user-repository.ts`                | Add `updatePasswordHash()` to interface and impl                                                                       |
| `src/services/user-service.ts`                       | Add `ChangePasswordDto`, `changePassword()` to interface and impl; extract `validatePasswordStrength()` private method |
| `src/controllers/user-controller.ts`                 | Add `PUT /password` handler                                                                                            |
| `src/openapi/spec.ts`                                | Add `/users/password` PUT path and `ChangePasswordRequest` schema                                                      |
| `tests/unit/errors/incorrect-password-error.test.ts` | **NEW** — Unit tests for new error class                                                                               |
| `tests/unit/repositories/user-repository.test.ts`    | Add tests for `updatePasswordHash()`                                                                                   |
| `tests/unit/services/user-service.test.ts`           | Add tests for `changePassword()` (validation, wrong password, success, token revocation)                               |
| `tests/unit/controllers/user-controller.test.ts`     | Add tests for `PUT /password` handler                                                                                  |
| `tests/unit/openapi/spec.test.ts`                    | Add tests for the new path/schema                                                                                      |
| `tests/acceptance/specs/change-password.test.ts`     | **NEW** — End-to-end acceptance tests                                                                                  |

### Coding Guidelines

- Follow existing patterns exactly. Controllers use try/catch with
  `this.handleError(res, error)`.
- Service-layer validation collects all field errors before throwing a single
  `ValidationError`.
- Error classes follow the `AppError` abstract pattern with readonly
  `statusCode`.
- Use `make test-unit` and `make test-acceptance` for testing — never npm/npx
  directly.
- The password validation refactoring (extracting the private method) must not
  change any existing behavior — `register()` tests must still pass unchanged.

### Testing Strategy

**Unit tests (Red phase)**:

1. `IncorrectPasswordError`: extends `AppError`, statusCode 401, correct
   message.
2. `UserRepository.updatePasswordHash()`: updates hash, returns true; returns
   false for nonexistent user.
3. `UserService.changePassword()`:
   - Missing `currentPassword` → `ValidationError` with field-specific error
   - Missing `newPassword` → `ValidationError` with field-specific error
   - Both missing → `ValidationError` with both fields
   - Weak `newPassword` (short, no uppercase, no lowercase, no digit) →
     `ValidationError` with strength errors
   - User not found → `UserNotFoundError`
   - Wrong current password → `IncorrectPasswordError`
   - Success: hashes new password, calls `updatePasswordHash`, calls
     `deleteAllByUserId`, returns void
   - Verify `validatePasswordStrength` refactoring: existing `register()` tests
     still pass
4. `UserController.changePassword()`:
   - 204 on success
   - 401 when `UserNotFoundError`
   - 401 when `IncorrectPasswordError`
   - 422 when `ValidationError`
   - 500 on unexpected error

**Acceptance tests**:

1. Change password with valid credentials → 204
2. Subsequent login with old password → 401
3. Subsequent login with new password → 200
4. Wrong current password → 401
5. Weak new password → 422
6. Missing fields → 422
7. Unauthenticated request → 401
8. Wrong Content-Type → 415

### Edge Cases

1. **Same old and new password**: Allowed — no business rule prevents it. The
   service does not compare old vs new (keep it simple; this can be added
   later).
2. **User deleted between auth and handler**: The `updatePasswordHash` returning
   `false` triggers `UserNotFoundError`, which the controller maps to 401.
3. **Race condition on token revocation**: The `deleteAllByUserId` call runs
   after the password update. If it fails, the password is still changed but old
   sessions remain valid. This is acceptable for a case study — a production
   system might wrap both in a transaction.
4. **Content-Type enforcement**: Already handled by the `TYPES.JsonContentType`
   middleware in the decorator chain.

### Implementation Order

Milestones 1 → 2 → 3 → 4 (strictly sequential).

## Milestones

### Milestone 1: Error Class and Repository Method

- **Description**: Create the `IncorrectPasswordError` class and add the
  `updatePasswordHash()` method to the user repository interface and
  implementation.
- **Acceptance Criteria**:
  - [ ] `src/errors/incorrect-password-error.ts` exists, extends `AppError`,
        statusCode 401, message "Current password is incorrect"
  - [ ] `src/errors/index.ts` exports `IncorrectPasswordError`
  - [ ] `UserRepository` interface has
        `updatePasswordHash(id, hash): Promise<boolean>`
  - [ ] `UserRepositoryImpl` implements it using `this.repository.update()`
  - [ ] Unit tests for the error class pass
  - [ ] Unit tests for `updatePasswordHash` pass (success + not-found cases)
  - [ ] `make test-unit` passes with no regressions
- **Status**: pending

### Milestone 2: Service Layer

- **Description**: Add `changePassword()` to the `UserService` interface and
  implementation. Extract `validatePasswordStrength()` from `register()` to
  reuse in both methods.
- **Acceptance Criteria**:
  - [ ] `ChangePasswordDto` type defined in `user-service.ts`
  - [ ] `changePassword(userId, data)` added to `UserService` interface
  - [ ] `UserServiceImpl.changePassword()` validates input, verifies current
        password, hashes new password, updates DB, revokes refresh tokens
  - [ ] Private `validatePasswordStrength(password)` method extracted; called by
        both `register()` and `changePassword()`
  - [ ] All existing `register()` tests still pass (no behavioral change)
  - [ ] Unit tests cover: missing fields (422), weak password (422), user not
        found, wrong current password (401), success path (204-equivalent)
  - [ ] `make test-unit` passes
- **Status**: pending

### Milestone 3: Controller and OpenAPI

- **Description**: Add the `PUT /password` handler to `UserController` and
  update the OpenAPI spec with the new endpoint and request schema.
- **Acceptance Criteria**:
  - [ ] `@httpPut('/password', TYPES.AuthMiddleware, TYPES.JsonContentType)`
        handler in `UserController`
  - [ ] Handler returns 204 on success, maps errors correctly
  - [ ] `UserNotFoundError` mapped to 401 (consistent with profile endpoints)
  - [ ] OpenAPI spec has `/users/password` PUT with `ChangePasswordRequest`
        schema, `bearerAuth` security, responses for 204, 401, 415, 422
  - [ ] `ChangePasswordRequest` component schema added with `currentPassword`
        and `newPassword` fields
  - [ ] Controller unit tests pass
  - [ ] OpenAPI unit tests pass
  - [ ] `make test-unit` passes
- **Status**: pending

### Milestone 4: Acceptance Tests

- **Description**: End-to-end acceptance tests verifying the full change
  password flow including authentication, validation, and session invalidation.
- **Acceptance Criteria**:
  - [ ] `tests/acceptance/specs/change-password.test.ts` exists
  - [ ] Test: valid change returns 204
  - [ ] Test: login with old password fails (401) after change
  - [ ] Test: login with new password succeeds (200) after change
  - [ ] Test: wrong current password returns 401
  - [ ] Test: weak new password returns 422 with structured errors
  - [ ] Test: missing fields returns 422
  - [ ] Test: unauthenticated request returns 401
  - [ ] Test: wrong Content-Type returns 415
  - [ ] `make test-acceptance` passes
- **Status**: pending
