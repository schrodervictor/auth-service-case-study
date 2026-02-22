# Task: Password Reset

## Status: pending

## Context

Add a password reset flow that allows unauthenticated users to reset their
password via a secure, time-limited reset key. The flow consists of three
endpoints: request a reset key, validate it, and use it to set a new password.

Security is critical: the API must never reveal whether an email address exists
in the system, reset keys must be hashed before storage (SHA-256, same pattern
as refresh tokens), and all endpoints must be rate limited to prevent abuse.

When a reset key is requested, the service publishes a
`PASSWORD_RESET_REQUESTED` domain event via the Producer so that downstream
consumers (e.g., an email service) can deliver the key to the user.

## Technical Specification

### Architecture Decisions

- **Entity + Repository pattern** — follow the `RefreshToken` entity and
  `RefreshTokenRepository` exactly. New entity `PasswordResetKey` in
  `src/entities/password-reset-key.ts`, new repository in
  `src/repositories/password-reset-key-repository.ts` (interface + `@injectable`
  impl).
- **Service layer** — add three new methods to `UserService` interface and
  `UserServiceImpl`: `requestPasswordReset`, `validateResetKey`, and
  `resetPassword`. These live alongside the existing methods (register,
  authenticate, changePassword, etc.).
- **Controller layer** — add three new route handlers to `UserController` (or a
  new dedicated controller if preferred, but staying in `UserController` matches
  the existing pattern since all `/users/*` routes live there).
- **No new service class** — the reset logic naturally belongs in `UserService`
  because it touches users, passwords, and refresh tokens.
- **Config** — add `resetKey.expiresIn` to the `auth` section in the config
  schema, and three new rate-limit entries.
- **Eventbus** — add `PASSWORD_RESET_REQUESTED` to `DomainEvents`, inject
  `TYPES.Producer` into `UserServiceImpl`.

### Database: `password_reset_keys` Table

New migration: `src/migrations/1740200000000-CreatePasswordResetKeysTable.ts`

```sql
CREATE TABLE "password_reset_keys" (
    "id"         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    "user_id"    UUID NOT NULL,
    "key_hash"   VARCHAR NOT NULL,
    "expires_at" TIMESTAMP NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT "fk_password_reset_keys_user"
        FOREIGN KEY ("user_id")
        REFERENCES "users" ("id")
        ON DELETE CASCADE
);

CREATE INDEX "idx_password_reset_keys_key_hash" ON "password_reset_keys" ("key_hash");
CREATE INDEX "idx_password_reset_keys_user_id" ON "password_reset_keys" ("user_id");
```

**Single key per user**: Before inserting a new row, delete all existing rows
for that user. This is enforced at the repository level, not via a unique
constraint, to allow lazy cleanup of expired keys.

**Lazy deletion of expired keys**: When creating a new key, delete any expired
keys for ALL users as a side effect. This keeps the table clean without a
scheduled job.

> **Note**: The lazy-deletion-on-create approach is sufficient for low-to-medium
> traffic. At scale (millions of users), this `DELETE WHERE expires_at < NOW()`
> on every create could become a performance bottleneck. A scheduled cleanup job
> or partitioning strategy would be needed instead. For this case study, lazy
> deletion is the pragmatic choice.

### Entity: `src/entities/password-reset-key.ts`

Follow the `RefreshToken` entity pattern exactly:

```
@Entity({ name: 'password_reset_keys' })
export class PasswordResetKey {
    id:        string   (UUID PK, @PrimaryGeneratedColumn('uuid'))
    keyHash:   string   (@Column 'key_hash')
    userId:    string   (@Column 'user_id')
    expiresAt: Date     (@Column 'expires_at')
    createdAt: Date     (@CreateDateColumn 'created_at')
    user:      User     (@ManyToOne, @JoinColumn 'user_id')
}
```

### Repository: `src/repositories/password-reset-key-repository.ts`

Interface + `@injectable()` impl (same pattern as `RefreshTokenRepository`):

```typescript
interface PasswordResetKeyRepository {
  save(
    keyHash: string,
    userId: string,
    expiresAt: Date,
  ): Promise<PasswordResetKey>;
  findByKeyHash(keyHash: string): Promise<PasswordResetKey | null>;
  deleteByKeyHash(keyHash: string): Promise<void>;
  deleteAllByUserId(userId: string): Promise<void>;
  deleteExpired(): Promise<void>;
}
```

- `save` should call `deleteAllByUserId` first (single key per user), then call
  `deleteExpired` for lazy cleanup, then insert.
- `deleteExpired` does
  `DELETE FROM password_reset_keys WHERE expires_at < NOW()`.

### DI Symbols (`src/lib/types.ts`)

Add:

```
PasswordResetKeyRepository: Symbol.for('PasswordResetKeyRepository'),
ResetKeyRateLimiter: Symbol.for('ResetKeyRateLimiter'),
ValidateResetKeyRateLimiter: Symbol.for('ValidateResetKeyRateLimiter'),
ResetPasswordRateLimiter: Symbol.for('ResetPasswordRateLimiter'),
```

### Config Schema (`src/config/schema.ts`)

1. Add `resetKey` to `authSchema`:

   ```typescript
   const resetKeySchema = z.object({
     expiresIn: z.string().default("15m"),
   });
   ```

   Add to `authSchema`:
   `resetKey: resetKeySchema.default({ expiresIn: '15m' })`.

2. Add three entries to `rateLimitSchema`:

   ```typescript
   resetKey: rateLimitEndpointSchema.default({ maxAttempts: 3, windowSeconds: 900 }),
   validateResetKey: rateLimitEndpointSchema.default({ maxAttempts: 10, windowSeconds: 900 }),
   resetPassword: rateLimitEndpointSchema.default({ maxAttempts: 5, windowSeconds: 900 }),
   ```

3. Update `config/default.json` and `config/test.json` with the new sections.

### Zod Request Schemas (`src/schemas/user-schemas.ts`)

Add three schemas:

```typescript
export const ResetKeyRequestSchema = z.object({
  email: z.string({ error: "Email is required" }).min(1, "Email is required"),
});

export const ValidateResetKeyRequestSchema = z.object({
  resetKey: z
    .string({ error: "Reset key is required" })
    .min(1, "Reset key is required"),
});

export const ResetPasswordRequestSchema = z.object({
  resetKey: z
    .string({ error: "Reset key is required" })
    .min(1, "Reset key is required"),
  newPassword: z
    .string({ error: "New password is required" })
    .min(1, "New password is required"),
});
```

### Error Class: `src/errors/invalid-reset-key-error.ts`

Follow `InvalidRefreshTokenError` pattern:

```typescript
export class InvalidResetKeyError extends AppError {
  readonly statusCode = 400;
  constructor() {
    super("Invalid or expired reset key");
  }
}
```

Export from `src/errors/index.ts`.

### Domain Events (`src/eventbus/domain-events.ts`)

```typescript
export const DomainEvents = {
  TEST_EVENT: "TEST_EVENT",
  PASSWORD_RESET_REQUESTED: "PASSWORD_RESET_REQUESTED",
} as const;
```

### Service Layer (`src/services/user-service.ts`)

Add to `UserService` interface:

```typescript
requestPasswordReset(email: string): Promise<void>;
validateResetKey(resetKey: string): Promise<boolean>;
resetPassword(resetKey: string, newPassword: string): Promise<void>;
```

**`UserServiceImpl` changes**:

1. Inject `TYPES.PasswordResetKeyRepository` and `TYPES.Producer` in the
   constructor (add to existing constructor params).
2. Inject `TYPES.Config` is already there — use `config.auth.resetKey.expiresIn`
   for TTL computation (reuse the same `computeExpiresAt` logic as
   `computeRefreshExpiresAt`, refactored to a shared private method).

**`requestPasswordReset(email)`**:

- Look up user by email via `userRepository.findByEmail`.
- If user not found: return silently (no error — prevents email enumeration).
- If user found:
  - Generate a URL-safe random key:
    `crypto.randomBytes(32).toString('base64url')`.
  - Hash with SHA-256: `crypto.createHash('sha256').update(key).digest('hex')`.
  - Compute `expiresAt` from `config.auth.resetKey.expiresIn`.
  - Save via `passwordResetKeyRepository.save(keyHash, userId, expiresAt)`.
  - Publish event via
    `producer.publish({ topic: 'user-events', events: [{ type: DomainEvents.PASSWORD_RESET_REQUESTED, data: { email, resetKey: plainKey } }] })`.

**`validateResetKey(resetKey)`**:

- Hash the incoming key with SHA-256.
- Look up via `passwordResetKeyRepository.findByKeyHash(hash)`.
- Return `true` if found and `expiresAt > now`, otherwise `false`.

**`resetPassword(resetKey, newPassword)`**:

- Validate password strength (reuse `validatePasswordStrength`).
- Hash incoming key with SHA-256.
- Look up via `passwordResetKeyRepository.findByKeyHash(hash)`.
- If not found or expired: throw `InvalidResetKeyError`.
- Look up user via `userRepository.findById(stored.userId)`.
- If not found: throw `InvalidResetKeyError` (don't leak info).
- Hash new password via `passwordManager.toHash`.
- Update via `userRepository.updatePasswordHash`.
- Delete the reset key: `passwordResetKeyRepository.deleteByKeyHash(hash)`.
- Revoke all refresh tokens: `refreshTokenRepository.deleteAllByUserId(userId)`.

### Controller Layer (`src/controllers/user-controller.ts`)

Add three new route handlers with the middleware chain pattern:

```
@httpPost('/reset-key', TYPES.JsonContentType, validate(ResetKeyRequestSchema), TYPES.ResetKeyRateLimiter)
async requestResetKey(req, res) → 200 { message: 'If the email exists...' }

@httpPost('/validate-reset-key', TYPES.JsonContentType, validate(ValidateResetKeyRequestSchema), TYPES.ValidateResetKeyRateLimiter)
async validateResetKey(req, res) → 200 { valid: boolean }

@httpPost('/password/reset', TYPES.JsonContentType, validate(ResetPasswordRequestSchema), TYPES.ResetPasswordRateLimiter)
async resetPassword(req, res) → 200 { message: 'Password has been reset' }
```

**Endpoint details**:

1. **POST /users/reset-key**
   - Request: `{ email: string }`
   - Response: always
     `200 { message: "If an account with that email exists, a reset key has been generated." }`
   - Rate limited. No auth required.

2. **POST /users/validate-reset-key**
   - Request: `{ resetKey: string }`
   - Response: `200 { valid: true }` or `200 { valid: false }`
   - Rate limited. No auth required.

3. **POST /users/password/reset**
   - Request: `{ resetKey: string, newPassword: string }`
   - Response: `200 { message: "Password has been reset successfully." }` on
     success.
   - Errors: `400` (invalid/expired key), `422` (weak password).
   - Rate limited. No auth required.

### DI Container (`src/inversify.config.ts`)

1. Import `PasswordResetKeyRepository` and `PasswordResetKeyRepositoryImpl`.
2. Import `Producer` from `./eventbus`.
3. Bind `TYPES.PasswordResetKeyRepository` → `PasswordResetKeyRepositoryImpl`.
4. Bind three new rate-limit middlewares:
   - `TYPES.ResetKeyRateLimiter` →
     `createRateLimitMiddleware(redisClient, 'resetKey', config.rateLimit.resetKey)`
   - `TYPES.ValidateResetKeyRateLimiter` →
     `createRateLimitMiddleware(redisClient, 'validateResetKey', config.rateLimit.validateResetKey)`
   - `TYPES.ResetPasswordRateLimiter` →
     `createRateLimitMiddleware(redisClient, 'resetPassword', config.rateLimit.resetPassword)`
5. Note: `TYPES.Producer` is already bound in `src/index.ts` (line 47).

### DataSource Registration (`src/database/data-source.ts`)

- Import `PasswordResetKey` entity.
- Import new migration.
- Add both to the `entities` and `migrations` arrays.

### Repository Barrel (`src/repositories/index.ts`)

Add: `export * from './password-reset-key-repository';`

### Entity Barrel (if exists)

Check for `src/entities/index.ts` and add the new entity export.

### OpenAPI Spec (`src/openapi/spec.ts`)

Add three new paths under `/partner-app/api/users/`:

- `POST /users/reset-key`
- `POST /users/validate-reset-key`
- `POST /users/password/reset`

Add three new component schemas:

- `ResetKeyRequest` (`{ email }`)
- `ValidateResetKeyRequest` (`{ resetKey }`)
- `ValidateResetKeyResponse` (`{ valid }`)
- `ResetPasswordRequest` (`{ resetKey, newPassword }`)

Document rate-limit 429 responses for all three endpoints.

### Files to Create

| File                                                            | Description                               |
| --------------------------------------------------------------- | ----------------------------------------- |
| `src/entities/password-reset-key.ts`                            | TypeORM entity                            |
| `src/repositories/password-reset-key-repository.ts`             | Interface + impl                          |
| `src/errors/invalid-reset-key-error.ts`                         | Error class                               |
| `src/migrations/1740200000000-CreatePasswordResetKeysTable.ts`  | DB migration                              |
| `tests/unit/entities/password-reset-key.test.ts`                | Entity unit tests                         |
| `tests/unit/repositories/password-reset-key-repository.test.ts` | Repository unit tests                     |
| `tests/unit/services/user-service-password-reset.test.ts`       | Service unit tests (reset methods only)   |
| `tests/unit/controllers/user-controller-password-reset.test.ts` | Controller unit tests (reset routes only) |
| `tests/acceptance/specs/password-reset.test.ts`                 | Acceptance tests                          |

### Files to Modify

| File                                 | Change                                               |
| ------------------------------------ | ---------------------------------------------------- |
| `src/lib/types.ts`                   | Add 4 DI symbols                                     |
| `src/config/schema.ts`               | Add `resetKey` to auth, 3 rate-limit entries         |
| `src/schemas/user-schemas.ts`        | Add 3 Zod schemas                                    |
| `src/errors/index.ts`                | Export `InvalidResetKeyError`                        |
| `src/eventbus/domain-events.ts`      | Add `PASSWORD_RESET_REQUESTED`                       |
| `src/services/user-service.ts`       | Add 3 methods to interface + impl, inject 2 new deps |
| `src/controllers/user-controller.ts` | Add 3 route handlers                                 |
| `src/inversify.config.ts`            | Bind repository + 3 rate limiters                    |
| `src/database/data-source.ts`        | Register entity + migration                          |
| `src/repositories/index.ts`          | Export new repository                                |
| `src/openapi/spec.ts`                | Add 3 paths + schemas                                |
| `config/default.json`                | Add resetKey + rate limit config                     |
| `config/test.json`                   | Add resetKey + rate limit config                     |

### Testing Strategy

**Unit tests** (high priority):

- **Entity**: Verify `PasswordResetKey` has correct column decorators and
  metadata (follow `tests/unit/entities/refresh-token.test.ts` pattern).
- **Repository**: Mock `DataSource.getRepository` and verify all 5 methods
  (save, findByKeyHash, deleteByKeyHash, deleteAllByUserId, deleteExpired).
  Verify that `save` calls `deleteAllByUserId` then `deleteExpired` before
  inserting.
- **Service — `requestPasswordReset`**:
  - User found → generates key, hashes, saves, publishes event. Verify
    `producer.publish` is called with correct payload including plain key.
  - User not found → returns silently, no error thrown, no event published.
- **Service — `validateResetKey`**:
  - Valid key → returns `true`.
  - Non-existent key → returns `false`.
  - Expired key → returns `false`.
- **Service — `resetPassword`**:
  - Valid key + strong password → updates password hash, deletes key, revokes
    all refresh tokens.
  - Invalid/expired key → throws `InvalidResetKeyError`.
  - Weak password → throws `ValidationError` (before checking key).
- **Controller**: Verify HTTP status codes and response bodies for all three
  endpoints, including error paths.

**Acceptance tests** (end-to-end through Docker):

- Request reset key for existing email → 200 generic response.
- Request reset key for non-existent email → 200 same generic response.
- Validate a valid reset key → `{ valid: true }`.
- Validate an invalid/random key → `{ valid: false }`.
- Reset password with valid key → 200, can login with new password, old password
  fails.
- Reset password with invalid key → 400.
- Reset password with weak password → 422.
- Reset password revokes all refresh tokens (old refresh tokens fail after
  reset).
- Using a reset key twice → second attempt returns 400 (key deleted after use).
- Rate limiting on all three endpoints → 429 after exceeding max attempts.

**Integration tests** (if time permits):

- Repository against real PostgreSQL (follow
  `tests/integration/repositories/refresh-token-repository.test.ts` pattern).

### Security Considerations

- **Email enumeration prevention**: `POST /users/reset-key` always returns the
  same 200 response regardless of whether the email exists.
- **Key hashing**: Plain keys are never stored in the database. SHA-256 hash is
  stored, plain key is only in the event payload (for the email service).
- **Single-use**: The key is deleted from DB immediately after successful
  password reset.
- **Expiration**: Keys expire after `config.auth.resetKey.expiresIn` (default 15
  minutes). Expired keys are rejected on validate and reset.
- **Rate limiting**: All three endpoints are rate limited to prevent brute-force
  attacks on key guessing and email enumeration via timing.
- **Token revocation**: On successful password reset, ALL refresh tokens for
  that user are revoked (same security posture as `changePassword`).

### Implementation Order

1. Migration + Entity + Repository (data layer)
2. Config schema + DI symbols + Error class
3. Zod request schemas
4. Domain event constant
5. Service methods (inject Producer + PasswordResetKeyRepository)
6. Controller routes + DI wiring
7. OpenAPI spec update
8. Config files update (default.json, test.json)

## Milestones

### Milestone 1: Data Layer

- **Description**: Create the `password_reset_keys` table, TypeORM entity,
  repository (interface + impl), error class, and DI symbols.
- **Acceptance Criteria**:
  - [ ] Migration `1740200000000-CreatePasswordResetKeysTable` creates the table
        with correct schema, FK, and indexes
  - [ ] `PasswordResetKey` entity matches the table schema exactly
  - [ ] `PasswordResetKeyRepository` interface has 5 methods: `save`,
        `findByKeyHash`, `deleteByKeyHash`, `deleteAllByUserId`, `deleteExpired`
  - [ ] `PasswordResetKeyRepositoryImpl` is `@injectable()` and injects
        `TYPES.DataSource`
  - [ ] `save` enforces single-key-per-user (deletes old keys first) and runs
        lazy expired-key cleanup
  - [ ] `InvalidResetKeyError` extends `AppError` with `statusCode: 400`
  - [ ] 4 new DI symbols added to `TYPES`
  - [ ] Entity and migration registered in `src/database/data-source.ts`
  - [ ] Repository exported from `src/repositories/index.ts`
  - [ ] Unit tests for entity, repository, and error class all pass
- **Status**: pending

### Milestone 2: Config, Schemas, and Event

- **Description**: Add config schema entries, Zod request schemas, and the
  domain event constant.
- **Acceptance Criteria**:
  - [ ] `auth.resetKey.expiresIn` added to config schema with default `'15m'`
  - [ ] Three rate-limit entries added: `resetKey`, `validateResetKey`,
        `resetPassword`
  - [ ] `config/default.json` and `config/test.json` updated with new sections
  - [ ] `ResetKeyRequestSchema`, `ValidateResetKeyRequestSchema`,
        `ResetPasswordRequestSchema` added to `src/schemas/user-schemas.ts`
  - [ ] `PASSWORD_RESET_REQUESTED` added to `DomainEvents`
  - [ ] Config Zod validation still passes for existing configs
  - [ ] All existing tests still pass (no regressions)
- **Status**: pending

### Milestone 3: Service Layer

- **Description**: Implement `requestPasswordReset`, `validateResetKey`, and
  `resetPassword` in `UserService`.
- **Acceptance Criteria**:
  - [ ] Three new methods added to `UserService` interface
  - [ ] `UserServiceImpl` injects `TYPES.PasswordResetKeyRepository` and
        `TYPES.Producer`
  - [ ] `requestPasswordReset` returns silently for non-existent email (no
        error, no event)
  - [ ] `requestPasswordReset` generates URL-safe key, hashes with SHA-256,
        stores, and publishes `PASSWORD_RESET_REQUESTED` event with plain key
  - [ ] `validateResetKey` returns `true` for valid non-expired keys, `false`
        otherwise
  - [ ] `resetPassword` validates password strength, verifies key, updates
        password, deletes key, revokes all refresh tokens
  - [ ] `resetPassword` throws `InvalidResetKeyError` for bad/expired keys
  - [ ] `resetPassword` throws `ValidationError` for weak passwords
  - [ ] Expiration TTL computed from `config.auth.resetKey.expiresIn` (reuse
        existing parsing logic)
  - [ ] Unit tests cover all happy paths and error paths
  - [ ] All existing tests still pass
- **Status**: pending

### Milestone 4: Controller + DI Wiring

- **Description**: Add three route handlers to `UserController`, wire up DI
  bindings (repository + rate limiters), and update the OpenAPI spec.
- **Acceptance Criteria**:
  - [ ] `POST /users/reset-key` returns 200 with generic message regardless of
        email existence
  - [ ] `POST /users/validate-reset-key` returns 200 with `{ valid: boolean }`
  - [ ] `POST /users/password/reset` returns 200 on success, 400 on invalid key,
        422 on weak password
  - [ ] All three endpoints are rate limited (429 after threshold)
  - [ ] All three endpoints validate request body via Zod (422 on invalid input)
  - [ ] All three endpoints require JSON Content-Type (415 on wrong type)
  - [ ] `PasswordResetKeyRepository` bound in DI container
  - [ ] Three rate-limit middlewares bound in DI container
  - [ ] OpenAPI spec updated with 3 new paths and component schemas
  - [ ] Controller unit tests pass
  - [ ] All existing tests still pass
- **Status**: pending

### Milestone 5: Acceptance Tests

- **Description**: End-to-end acceptance tests validating the full password
  reset flow through the Docker stack.
- **Acceptance Criteria**:
  - [ ] Reset key request for existing email returns 200
  - [ ] Reset key request for non-existent email returns 200 (same response)
  - [ ] Valid reset key validates as `{ valid: true }`
  - [ ] Invalid/random reset key validates as `{ valid: false }`
  - [ ] Password reset with valid key succeeds, new password works for login
  - [ ] Old password fails after reset
  - [ ] Password reset with invalid key returns 400
  - [ ] Password reset with weak password returns 422
  - [ ] Reset key is single-use (second reset attempt returns 400)
  - [ ] Refresh tokens are revoked after password reset
  - [ ] Rate limiting returns 429 on all three endpoints
  - [ ] All acceptance tests pass via `make test-acceptance`
- **Status**: pending
