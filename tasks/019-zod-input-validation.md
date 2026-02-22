# Task: Zod Input Validation Middleware

## Status: in-progress

## Context

The service layer currently handles both input-shape validation (missing/empty
fields) and business-rule validation (password strength, email uniqueness) in
the same place. This violates separation of concerns — the controller/middleware
layer should reject malformed requests before they reach the service.

Zod is already a project dependency (used for config validation in
`src/config/schema.ts`). This task introduces Zod request-body schemas and a
generic `validate()` Express middleware that runs before controller methods via
inversify-express-utils decorator chains.

## Technical Specification

### Architecture

```
Request → JsonContentType → validate(schema) → RateLimiter → Controller → Service
```

The validate middleware sits in the decorator chain, after content-type checking
and before rate limiting / auth middleware. It parses `req.body` and either:

- **On success**: replaces `req.body` with the parsed (typed, stripped) data and
  calls `next()`
- **On failure**: returns 422 with the existing error response structure

### New Files

| File                                    | Purpose                                 |
| --------------------------------------- | --------------------------------------- |
| `src/schemas/user-schemas.ts`           | Zod schemas for all user request bodies |
| `src/middleware/validate-middleware.ts` | Generic `validate(schema)` factory      |

### Files to Modify

| File                                 | Change                                                                                                                                                   |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/controllers/user-controller.ts` | Add `validate(...)` to decorator chains; remove manual field destructuring defaults (`?? {}`) where the middleware guarantees shape                      |
| `src/services/user-service.ts`       | Remove input-shape validation (null/empty checks for required fields); keep business-rule validation (password strength, email format, email uniqueness) |
| `src/lib/types.ts`                   | No change needed — validate is a direct function import, not a DI symbol                                                                                 |
| `src/inversify.config.ts`            | No change needed — validate is used as a direct import in decorators                                                                                     |
| `src/openapi/spec.ts`                | Update 422 error examples to reflect Zod's error message style if messages change                                                                        |

### Coding Guidelines

1. **Follow the existing middleware pattern** — see
   `src/middleware/content-type-middleware.ts:1-9`. The validate middleware is a
   plain function factory (not an injectable class). Signature:

   ```typescript
   import type { Request, Response, NextFunction } from 'express';
   import type { ZodSchema } from 'zod';

   export function validate(schema: ZodSchema) {
       return (req: Request, res: Response, next: NextFunction): void => { ... };
   }
   ```

2. **Error response format must match existing `ValidationError` shape**:

   ```json
   {
     "message": "Validation failed",
     "errors": {
       "email": ["Email is required"],
       "password": ["Password is required"]
     }
   }
   ```

   This means transforming Zod's `ZodError.issues` array into a
   `Record<string, string[]>` grouped by field path. Use `issue.path.join('.')`
   as the key and `issue.message` as the value.

3. **Use `z.string().min(1, ...)` for required fields** — Zod's `z.string()`
   alone accepts empty strings. Always pair with `.min(1)` for required fields.

4. **Use `.strict()` or not**: Do NOT use `.strict()` — extra fields should be
   silently stripped (Zod's default behavior with `.parse()`), not rejected.
   This matches the current behavior.

5. **Schema naming convention**: `XxxRequestSchema` (PascalCase + "Schema"
   suffix). Export both the schema and the inferred type:

   ```typescript
   export const RegisterRequestSchema = z.object({ ... });
   export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
   ```

6. **Decorator chain order matters** in inversify-express-utils. Middleware
   executes left-to-right in the decorator:

   ```typescript
   @httpPost('/register', TYPES.JsonContentType, validate(RegisterRequestSchema))
   ```

   Content-type check first, then Zod validation, then rate limiter (if any).

7. **What stays in the service layer** (business rules, NOT input shape):
   - Password strength validation (`validatePasswordStrength`)
   - Email format validation (`EMAIL_REGEX`)
   - Email uniqueness check (DB query)
   - Refresh token existence check
   - "At least one field" check for updateProfile — this is borderline, but
     since Zod can enforce it with `.refine()`, move it to the schema

8. **What moves to the middleware** (input shape):
   - Required field presence checks (`if (!data.email)`, `if (!password)`, etc.)
   - The empty-object guard in `authenticate()`, `refreshAccessToken()`,
     `changePassword()`

### Zod Schemas

```typescript
// src/schemas/user-schemas.ts

import { z } from "zod";

export const RegisterRequestSchema = z.object({
  email: z
    .string({ required_error: "Email is required" })
    .min(1, "Email is required"),
  password: z
    .string({ required_error: "Password is required" })
    .min(1, "Password is required"),
  firstName: z
    .string({ required_error: "First name is required" })
    .min(1, "First name is required"),
  lastName: z
    .string({ required_error: "Last name is required" })
    .min(1, "Last name is required"),
});

export const LoginRequestSchema = z.object({
  email: z
    .string({ required_error: "Email is required" })
    .min(1, "Email is required"),
  password: z
    .string({ required_error: "Password is required" })
    .min(1, "Password is required"),
});

export const RefreshRequestSchema = z.object({
  refreshToken: z
    .string({ required_error: "Refresh token is required" })
    .min(1, "Refresh token is required"),
});

export const LogoutRequestSchema = z.object({
  refreshToken: z
    .string({ required_error: "Refresh token is required" })
    .min(1, "Refresh token is required"),
});

export const UpdateProfileRequestSchema = z
  .object({
    firstName: z.string().min(1, "First name cannot be empty").optional(),
    lastName: z.string().min(1, "Last name cannot be empty").optional(),
  })
  .refine(
    (data) => data.firstName !== undefined || data.lastName !== undefined,
    {
      message: "At least one field (firstName or lastName) is required",
      path: ["_"],
    },
  );

export const ChangePasswordRequestSchema = z.object({
  currentPassword: z
    .string({ required_error: "Current password is required" })
    .min(1, "Current password is required"),
  newPassword: z
    .string({ required_error: "New password is required" })
    .min(1, "New password is required"),
});
```

### Validate Middleware Implementation Notes

```typescript
// src/middleware/validate-middleware.ts

import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod";
import { ZodError } from "zod";

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.length > 0 ? issue.path.join(".") : "_";
        if (!errors[key]) errors[key] = [];
        errors[key].push(issue.message);
      }
      res.status(422).json({ message: "Validation failed", errors });
      return;
    }

    req.body = result.data;
    next();
  };
}
```

### Controller Changes

After adding the validate middleware, the controller methods simplify:

- **register**: Remove `?? {}` fallback on `req.body`. The middleware guarantees
  the shape. Service still validates email format, password strength,
  uniqueness.
- **login**: Remove `?? {}` fallback. Service still validates credentials.
- **refresh**: Remove `?? {}` fallback. Service still validates token validity.
- **logout**: Currently reads `refreshToken` from body but this endpoint uses
  `TYPES.AuthMiddleware` — check if it needs a body schema. Currently it reads
  `userId` from the JWT, not from the body. The body is not used — **no schema
  needed for logout**.
- **updateProfile**: Remove the manual `if (!firstName && !lastName)` check
  (moved to schema `.refine()`). **Note**: the error code for "at least one
  field" currently returns 400 from the controller. With Zod validation, this
  becomes 422. This is arguably more correct (it's a validation error). Update
  the OpenAPI spec accordingly.
- **changePassword**: Remove `?? {}` fallback. Service still validates password
  strength.

### Service Layer Changes

Remove these blocks from `UserServiceImpl`:

1. **`register()`** (lines 78–110): Remove the entire `errors` accumulation
   block for null/empty checks on email, password, firstName, lastName. Keep
   `EMAIL_REGEX` validation, `validatePasswordStrength()`, and the
   `EmailAlreadyExistsError` check.

2. **`authenticate()`** (lines 130–135): Remove the `errors` accumulation for
   null email/password check. The service receives guaranteed non-empty strings.

3. **`refreshAccessToken()`** (lines 151–153): Remove the `if (!token)` guard.
   The middleware guarantees a non-empty string.

4. **`updateProfile()`** (lines 187–199): Remove the entire `errors`
   accumulation block for empty firstName/lastName. The middleware handles this.

5. **`changePassword()`** (lines 211–228): Remove the `errors` accumulation for
   null currentPassword/newPassword. Keep `validatePasswordStrength()` for
   `newPassword`.

### OpenAPI Spec Changes

- Update the `PUT /users/profile` responses: the "at least one field" error
  moves from 400 to 422. Remove the 400 response entry and let the existing 422
  `ValidationErrorResponse` cover it. Update the 422 example to include the "at
  least one field" case.

### Edge Cases & Pitfalls

1. **`req.body` can be `undefined`**: When Express hasn't parsed the body (no
   `express.json()` middleware or wrong content-type). But since
   `requireJsonContentType` runs first and returns 415, and `express.json()` is
   applied globally, `req.body` will always be an object by the time
   `validate()` runs. Zod handles `undefined` gracefully anyway (it would fail
   validation).

2. **Empty strings vs missing fields**: `z.string().min(1)` catches both `""`
   and whitespace-only if you add `.trim()`. Consider whether to `.trim()`
   string fields. The current service checks
   `data.firstName.trim().length === 0` for register — so add `.trim().min(1)`
   for `firstName` and `lastName` in the register and updateProfile schemas to
   match existing behavior.

3. **UpdateProfile refine error path**: The `.refine()` on UpdateProfileRequest
   uses `path: ['_']` as a synthetic path. The controller currently returns a
   plain `{ message: ... }` for 400. With Zod, it becomes
   `{ message: 'Validation failed', errors: { '_': ['At least one field...'] } }`.
   This is a minor response shape change. Alternatively, use a custom path like
   `path: ['body']` or handle this case specially.

4. **Logout endpoint has no body**: The current `POST /logout` uses
   `TYPES.AuthMiddleware` and reads `userId` from the JWT. It does NOT read the
   body. No Zod schema needed.

5. **Type safety after validation**: After `req.body = result.data`, the
   controller can trust the shape. However, Express types `req.body` as `any`,
   so no compile-time benefit without casting. The schemas provide runtime
   safety, which is the primary goal.

6. **Acceptance test compatibility**: The existing acceptance tests assert on
   specific error messages and status codes. The Zod middleware must produce
   error messages that match or the tests need updating. Key assertions:
   - `registration.test.ts:34`: `{ message: 'Validation failed' }` ✓ (matches)
   - `registration.test.ts:36-37`: `errors.email`, `errors.password` ✓
   - Error messages like `"Email is required"` must match. Use explicit messages
     in Zod schemas to ensure this.

### Implementation Order

1. Create `src/middleware/validate-middleware.ts` — the generic middleware
2. Create `src/schemas/user-schemas.ts` — all 6 schemas (5 actually, no logout)
3. Wire schemas into `src/controllers/user-controller.ts` decorators
4. Remove redundant validation from `src/services/user-service.ts`
5. Remove the manual 400 check from `updateProfile` in the controller
6. Update `src/openapi/spec.ts` (400 → 422 for updateProfile)
7. Update/add tests at all levels

## Milestones

### Milestone 1: Validate Middleware + Schemas

- **Description**: Create the generic `validate()` middleware and all Zod
  request schemas. Unit tests for both.
- **Acceptance Criteria**:
  - [ ] `src/middleware/validate-middleware.ts` exists with `validate(schema)`
        factory
  - [ ] `src/schemas/user-schemas.ts` exists with all 5 schemas
  - [ ] Unit tests for validate middleware: success path (calls next, sets
        req.body), failure path (returns 422 with correct shape), multiple
        errors, nested path handling
  - [ ] Unit tests for each schema: valid input passes, missing required fields
        fail, empty strings fail, trim behavior for name fields, UpdateProfile
        refine logic
  - [ ] All existing tests still pass (`make test-unit`)
- **Status**: pending

### Milestone 2: Wire into Controllers + Remove Service Validation

- **Description**: Add `validate(...)` calls to controller decorator chains.
  Remove the now-redundant input-shape validation from the service layer. Update
  controller methods to remove `?? {}` fallbacks and the manual 400 check in
  `updateProfile`.
- **Acceptance Criteria**:
  - [ ] All 5 endpoints use `validate(XxxRequestSchema)` in their decorator
        chains
  - [ ] Service layer no longer checks for null/empty required fields (those
        blocks are removed)
  - [ ] Service layer still validates: email format, password strength, email
        uniqueness, token validity
  - [ ] `updateProfile` controller no longer has the manual
        `if (!firstName && !lastName)` check
  - [ ] Controller unit tests updated to reflect new validation flow
  - [ ] Service unit tests updated — remove tests for null/empty field
        validation that's now handled by middleware
  - [ ] All tests pass (`make test-unit`)
- **Status**: pending

### Milestone 3: OpenAPI Spec Update

- **Description**: Update the OpenAPI spec to reflect the 400 → 422 change for
  updateProfile's "at least one field" error. Verify spec consistency.
- **Acceptance Criteria**:
  - [ ] `PUT /users/profile` no longer lists a 400 response
  - [ ] 422 response example for `PUT /users/profile` updated to include "at
        least one field" case
  - [ ] OpenAPI unit tests updated and passing
  - [ ] Spec is consistent with actual API behavior
- **Status**: pending

### Milestone 4: Acceptance Tests

- **Description**: Update existing acceptance tests and add new ones to verify
  the Zod validation layer works end-to-end.
- **Acceptance Criteria**:
  - [ ] Existing acceptance tests pass without modification (or are updated for
        the 400→422 change)
  - [ ] New acceptance test cases for: extra fields are stripped, type coercion
        doesn't happen (number sent as email fails), empty-string fields
        rejected
  - [ ] `make test-acceptance` passes
  - [ ] `make test-unit` and `make test-integration` still pass
- **Status**: pending
