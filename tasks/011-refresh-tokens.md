# Task: Refresh Token Mechanism

## Status: pending

## Context

All 6 core tasks are complete. Refresh tokens are a high-value bonus feature
that adds secure token rotation to the existing JWT access token auth.

Design decisions:

- **Opaque tokens** (not JWT) — `crypto.randomBytes(32)`, no second secret
- **SHA-256 hash** before DB storage — DB leak doesn't expose usable tokens
- **Separate `refresh_tokens` table** — supports multiple devices, clean
  revocation
- **Token rotation** — old token deleted on refresh, prevents replay
- **ON DELETE CASCADE** — deleting a user auto-removes their tokens
- **Logout only** — password-change revocation deferred to a future task
- **No config/secrets changes** — `auth.refreshToken.expiresIn: '7d'` already
  exists in config schema

## Technical Specification

### Architecture

```
POST /login
  └─► authenticate() → accessToken (JWT, 15m) + refreshToken (opaque, 7d)
        └─► hash(refreshToken) → save to refresh_tokens table

POST /refresh  { refreshToken }     (no auth middleware)
  └─► refreshAccessToken()
        ├─► hash(token) → lookup in DB
        ├─► verify: exists? not expired? user exists?
        ├─► delete old hash, generate new pair
        └─► return { accessToken, refreshToken }

POST /logout                        (auth middleware required)
  └─► logout(userId) → DELETE FROM refresh_tokens WHERE user_id = ?
```

### Breaking Change

`AuthResponseDto` changes from `{ token }` to `{ accessToken, refreshToken }`.

### Key Files

| File                                         | Action | Role                                       |
| -------------------------------------------- | ------ | ------------------------------------------ |
| `src/entities/refresh-token.ts`              | NEW    | RefreshToken entity                        |
| `src/database/migrations/...-CreateRefresh…` | NEW    | Migration                                  |
| `src/repositories/refresh-token-repository`  | NEW    | CRUD for refresh tokens                    |
| `src/errors/invalid-refresh-token-error.ts`  | NEW    | 401 error class                            |
| `src/services/user-service.ts`               | MODIFY | authenticate + refreshAccessToken + logout |
| `src/controllers/user-controller.ts`         | MODIFY | /refresh + /logout endpoints               |
| `src/lib/types.ts`                           | MODIFY | TYPES.RefreshTokenRepository               |
| `src/inversify.config.ts`                    | MODIFY | Bind RefreshTokenRepository                |
| `src/database/data-source.ts`                | MODIFY | Register entity + migration                |

## Milestones

### Milestone 1: RefreshToken Entity + Migration

- **Description**: Create RefreshToken TypeORM entity and database migration
- **Acceptance Criteria**:
  - [ ] `refresh_tokens` table with id, token_hash, user_id, expires_at,
        created_at
  - [ ] FK to users(id) ON DELETE CASCADE
  - [ ] Indexes on token_hash and user_id
  - [ ] ManyToOne relation to User entity
  - [ ] Entity registered in data-source
- **Status**: pending

### Milestone 2: RefreshTokenRepository

- **Description**: CRUD repository for refresh token storage
- **Acceptance Criteria**:
  - [ ] save(tokenHash, userId, expiresAt)
  - [ ] findByTokenHash(hash)
  - [ ] deleteByTokenHash(hash)
  - [ ] deleteAllByUserId(userId)
  - [ ] TYPES.RefreshTokenRepository symbol added
  - [ ] Follows existing repository pattern
- **Status**: pending

### Milestone 3: AuthResponseDto + authenticate() change

- **Description**: Breaking change — authenticate returns both tokens
- **Acceptance Criteria**:
  - [ ] AuthResponseDto: { accessToken, refreshToken }
  - [ ] authenticate() generates opaque token, SHA-256 hashes, saves to DB
  - [ ] InvalidRefreshTokenError class (401)
  - [ ] RefreshTokenRepository injected as 5th constructor param
- **Status**: pending

### Milestone 4: refreshAccessToken service method

- **Description**: Token refresh with rotation
- **Acceptance Criteria**:
  - [ ] Hash incoming token, lookup in DB
  - [ ] Verify not expired, user still exists
  - [ ] Delete old token, generate + save new pair
  - [ ] Return new { accessToken, refreshToken }
  - [ ] Throws InvalidRefreshTokenError on any failure
- **Status**: pending

### Milestone 5: logout service method

- **Description**: Revoke all refresh tokens for a user
- **Acceptance Criteria**:
  - [ ] logout(userId) deletes all refresh tokens
  - [ ] Added to UserService interface
- **Status**: pending

### Milestone 6: Controller endpoints + login response

- **Description**: New /refresh and /logout endpoints, login response update
- **Acceptance Criteria**:
  - [ ] POST /refresh — 200 with new tokens, 400 missing body, 401 invalid
  - [ ] POST /logout — 204, requires auth middleware
  - [ ] Login response uses { accessToken, refreshToken }
  - [ ] InvalidRefreshTokenError mapped to 401
- **Status**: pending

### Milestone 7: DI wiring

- **Description**: Wire RefreshTokenRepository into DI container
- **Acceptance Criteria**:
  - [ ] TYPES.RefreshTokenRepository bound to RefreshTokenRepositoryImpl
  - [ ] DI integration tests pass
- **Status**: pending
