# Task: Password Manager Service

## Status: done

## Context

The application needs secure password hashing and comparison for user
authentication. INSTRUCTIONS.md Task 2 requires implementing the
PasswordManagerService using crypto.scrypt. This is a pure, stateless service
with no database or external dependencies — it only uses the Node.js built-in
crypto module. It must be production-quality security code: random salt per
hash, constant-time comparison via timingSafeEqual, and clear separation between
the interface and injectable implementation.

The placeholder already exists at src/services/password-manager-service.ts with
the interface and class commented out. The DI symbol
TYPES.PasswordManagerService is commented out in src/lib/types.ts, and the
container binding is commented out in src/inversify.config.ts.

## Technical Specification

### Architecture Decisions

1. **Single file** — Both the PasswordManagerService interface and
   PasswordManagerServiceImpl class live in
   src/services/password-manager-service.ts, matching the placeholder structure.

2. **Storage format** — The hashed password is stored as a single string:
   <hex-encoded-salt>.<hex-encoded-derived-key>. The dot is the delimiter. This
   is stored in the User entity password column (VARCHAR).

3. **Scrypt parameters** — Use Node.js defaults for crypto.scrypt (N=16384, r=8,
   p=1). Derived key length: 64 bytes. Salt length: 32 bytes (generated via
   crypto.randomBytes). These are secure defaults and match the Node.js
   documentation recommendations.

4. **Constant-time comparison** — Use crypto.timingSafeEqual to compare the
   derived key from the supplied password with the stored derived key. This
   prevents timing-based side-channel attacks.

5. **Promisified scrypt** — Use util.promisify(crypto.scrypt) to get an async
   version, matching the placeholder existing promisify import comment.

6. **No external dependencies** — Only Node.js built-in modules (crypto, util).
   No new npm packages needed.

7. **DI binding** — Bind using .to(PasswordManagerServiceImpl). The service is
   stateless so transient scope (Inversify default) is fine.

### Interface Contract

toHash(password: string): Promise<string>

- Takes a plaintext password, generates a random 32-byte salt, derives a 64-byte
  key via scrypt, returns "salt-hex.key-hex".

compare(storedPassword: string, suppliedPassword: string): Promise<boolean>

- Parses the stored password to extract the salt, re-derives the key from the
  supplied password using the same salt, then uses timingSafeEqual to compare
  the two derived keys. Returns true if they match, false otherwise.

### Files to Modify/Create

| File                                                 | Action | Purpose                                       |
| ---------------------------------------------------- | ------ | --------------------------------------------- |
| src/services/password-manager-service.ts             | Modify | Uncomment and implement interface + class     |
| src/services/index.ts                                | Modify | Uncomment the password-manager-service export |
| src/lib/types.ts                                     | Modify | Uncomment PasswordManagerService symbol       |
| src/inversify.config.ts                              | Modify | Uncomment import and container binding        |
| tests/unit/services/password-manager-service.test.ts | Create | Unit tests                                    |

### Coding Guidelines

- Follow the existing import style: named imports, single quotes, trailing
  semicolons (enforced by Prettier/ESLint).
- Use named imports from crypto: scrypt, randomBytes, timingSafeEqual.
- Use promisify from util.
- The @injectable() decorator requires reflect-metadata imported at the test
  entry point (already handled — see tests/unit/config/di-integration.test.ts
  which imports reflect-metadata at the top).
- Constants like SALT_LENGTH and KEY_LENGTH should be private module-level const
  values (not magic numbers in the methods).
- The interface must be exported as a named export (not default). The impl class
  must also be a named export.
- Match the 4-space indent style used throughout the codebase.

### Implementation Details

Imports needed:

- scrypt, randomBytes, timingSafeEqual from crypto
- injectable from inversify
- promisify from util

Module-level constants:

- const scryptAsync = promisify(scrypt)
- const SALT_LENGTH = 32 (bytes)
- const KEY_LENGTH = 64 (bytes)

toHash implementation:

1. Generate random salt: randomBytes(SALT_LENGTH)
2. Derive key: await scryptAsync(password, salt, KEY_LENGTH) — returns Buffer
3. Return: salt.toString('hex') + '.' + derivedKey.toString('hex')

compare implementation:

1. Split storedPassword on '.' to get [saltHex, storedKeyHex]
2. Wrap in try-catch — return false on any error (corrupted hash)
3. Validate format: must have exactly 2 parts
4. Convert saltHex back to Buffer via Buffer.from(saltHex, 'hex')
5. Derive key from suppliedPassword using the extracted salt
6. Convert storedKeyHex to Buffer
7. Check buffer lengths match before calling timingSafeEqual (it throws on
   length mismatch)
8. Return timingSafeEqual(derivedKey, storedKeyBuffer)

### DI Wiring Changes

src/lib/types.ts — Uncomment the PasswordManagerService symbol so TYPES
includes: PasswordManagerService: Symbol.for('PasswordManagerService')

src/inversify.config.ts — Uncomment the import of PasswordManagerService and
PasswordManagerServiceImpl from ./services, and uncomment the container binding:
container.bind<PasswordManagerService>(TYPES.PasswordManagerService)
.to(PasswordManagerServiceImpl)

src/services/index.ts — Uncomment: export \* from './password-manager-service'

### Test Strategy

All tests are unit tests — this service has no external dependencies (no DB, no
network). Tests go in tests/unit/services/password-manager-service.test.ts.

Do NOT mock crypto — test real hashing behavior. The scrypt function is
deterministic given the same input and salt, and fast enough for unit tests
(default parameters complete in roughly 100ms).

#### Test Cases

toHash tests:

1. Returns a string containing exactly one dot delimiter
2. Both parts (salt and key) are valid hex strings
3. Salt part has correct length (32 bytes = 64 hex characters)
4. Key part has correct length (64 bytes = 128 hex characters)
5. Two calls with the same password produce different hashes (random salt)
6. Empty string password still produces a valid hash (scrypt handles empty input
   — input validation belongs in UserService, not here)

compare tests:

7. Returns true when the supplied password matches the stored hash
8. Returns false when the supplied password does not match
9. Returns false for an empty supplied password against a non-empty hash
10. Returns false for a corrupted/malformed stored password (missing dot)
11. Returns false for a stored password with wrong-length key hex
12. Returns false for a stored password with invalid hex characters
13. Returns false for a completely empty stored password string

Round-trip tests:

14. Hash then compare with correct password returns true
15. Hash then compare with incorrect password returns false
16. Hash then compare works for passwords with special characters (unicode,
    spaces, symbols)
17. Hash then compare works for very long passwords (1000+ characters)

DI integration test (add to tests/unit/config/di-integration.test.ts):

18. TYPES.PasswordManagerService is bound in the container
19. Resolving the service returns a PasswordManagerServiceImpl instance

#### Test File Structure

tests/unit/services/password-manager-service.test.ts

Use import 'reflect-metadata' at the top of the test file (needed for Inversify
decorators). Import the impl class directly for most tests — no need to go
through the DI container except for the DI integration tests.

### Edge Cases and Security Considerations

- **Empty password**: crypto.scrypt handles empty strings. The service should
  NOT throw — it should hash and compare normally. Input validation (minimum
  length, complexity) belongs in the UserService layer, not here.
- **Corrupted stored hash**: compare must return false (not throw) when the
  stored password format is invalid. This handles DB corruption gracefully. Wrap
  the parsing/comparison in a try-catch and return false on any error.
- **timingSafeEqual buffer length**: timingSafeEqual throws if the two buffers
  have different lengths. The compare method must check that the stored key hex
  decodes to the same length as the newly derived key before calling
  timingSafeEqual. If lengths differ, return false immediately.
- **Encoding**: All hex encoding/decoding uses Node.js Buffer built-in hex
  encoding. No base64, no custom encoding.
- **No password logging**: Never log the plaintext password or the derived key.
  No console.log calls in this service.

### Dependencies

No new npm packages. crypto and util are Node.js built-ins. inversify is already
installed.

### Implementation Order

1. Uncomment and implement src/services/password-manager-service.ts
2. Uncomment export in src/services/index.ts
3. Uncomment PasswordManagerService symbol in src/lib/types.ts
4. Uncomment import and binding in src/inversify.config.ts
5. Write unit tests in tests/unit/services/password-manager-service.test.ts
6. Update DI integration test to verify the new binding
7. Run make test-unit and make typecheck to verify

## Milestones

### Milestone 1: Service Implementation

- **Description**: Uncomment and implement the PasswordManagerService with
  scrypt hashing and timingSafeEqual comparison
- **Acceptance Criteria**:
  - [x] src/services/password-manager-service.ts exports PasswordManagerService
        interface and PasswordManagerServiceImpl class
  - [x] toHash generates a random 32-byte salt, derives a 64-byte key via
        scrypt, returns "salt-hex.key-hex"
  - [x] compare parses the stored hash, re-derives the key, uses timingSafeEqual
        for comparison
  - [x] compare returns false (not throws) for malformed stored passwords
  - [x] Constants SALT_LENGTH and KEY_LENGTH are used (no magic numbers)
  - [x] @injectable() decorator is applied to the impl class
  - [x] src/services/index.ts exports the service
- **Status**: done

### Milestone 2: DI Wiring

- **Description**: Wire the PasswordManagerService into the DI container
- **Acceptance Criteria**:
  - [x] TYPES.PasswordManagerService symbol is active in src/lib/types.ts
  - [x] createContainer binds PasswordManagerService to
        PasswordManagerServiceImpl
  - [x] Import in src/inversify.config.ts is uncommented and correct
  - [x] make typecheck passes
- **Status**: done

### Milestone 3: Unit Tests

- **Description**: Comprehensive unit tests for both toHash and compare, plus DI
  integration verification
- **Acceptance Criteria**:
  - [x] tests/unit/services/password-manager-service.test.ts exists with all
        test cases from the test strategy
  - [x] Tests cover: format validation, salt uniqueness, round-trip correctness,
        wrong password rejection, corrupted hash handling, special characters
  - [x] DI integration test verifies TYPES.PasswordManagerService is bound
  - [x] make test-unit passes with all tests green
  - [x] No tests mock the crypto module (real hashing is tested)
- **Status**: done
