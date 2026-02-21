# Task: User Repository

## Status: pending

## Context

INSTRUCTIONS.md Task 3 requires implementing the UserRepository with methods for
finding and persisting User entities. The User entity (task 004) and database
layer are complete. The repository placeholder at
`src/repositories/user-repository.ts` currently contains only `// Fill here`.
The DI symbol `TYPES.UserRepository` is commented out in `src/lib/types.ts`, the
barrel export is commented out in `src/repositories/index.ts`, and the container
binding is commented out in `src/inversify.config.ts`.

The repository is the data access layer that the UserService (task 007, future)
will depend on for registration, authentication, profile retrieval, and profile
updates.

## Technical Specification

### Architecture Decisions

1. **Single file** — Both the `UserRepository` interface and
   `UserRepositoryImpl` class live in `src/repositories/user-repository.ts`,
   matching the project's interface-plus-impl convention (see
   `src/services/password-manager-service.ts` for the pattern).

2. **Inject DataSource, derive Repository** — The impl class injects
   `TYPES.DataSource` (a TypeORM `DataSource`) via constructor injection. In the
   constructor, it calls `dataSource.getRepository(User)` to obtain a TypeORM
   `Repository<User>` and stores it as a private field. This keeps the class
   testable: unit tests mock the DataSource to return a mock Repository.

3. **Thin wrapper** — The repository methods are thin wrappers around TypeORM
   `Repository<User>` methods. Business logic (validation, hashing, duplicate
   checks that throw domain errors) belongs in the UserService layer, not here.
   The repository simply returns `User | null` for queries and `User` for
   mutations, or lets TypeORM errors propagate.

4. **DTOs as plain objects** — `create` and `update` accept plain data objects
   (not class instances). Define `CreateUserData` and `UpdateUserData` types
   within the repository file. These are simple `Pick`/`Partial` types derived
   from the User entity fields — no class-validator decorators at this layer.

5. **No error swallowing** — The repository does NOT catch TypeORM errors (e.g.,
   unique constraint violations). It lets them propagate to the service layer,
   which will interpret them (e.g., duplicate email -> 409 Conflict).

### Interface Contract

```typescript
interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(data: CreateUserData): Promise<User>;
  update(id: string, data: UpdateUserData): Promise<User | null>;
}
```

#### Type definitions

```typescript
type CreateUserData = {
  email: string;
  password: string; // already hashed by the service layer
  firstName: string;
  lastName: string;
};

type UpdateUserData = {
  firstName?: string;
  lastName?: string;
};
```

#### Method semantics

- **findByEmail(email)**: Calls `repository.findOneBy({ email })`. Returns the
  User or `null` if not found.

- **findById(id)**: Calls `repository.findOneBy({ id })`. Returns the User or
  `null` if not found.

- **create(data)**: Calls `repository.create(data)` then
  `repository.save(entity)`. Returns the saved User (with id, createdAt,
  updatedAt populated). Does NOT check for duplicate email — lets the DB unique
  constraint throw.

- **update(id, data)**: First calls `repository.findOneBy({ id })`. If not
  found, returns `null`. Otherwise calls `Object.assign(user, data)` then
  `repository.save(user)`. Returns the updated User. The `updatedAt` column is
  auto-managed by TypeORM's `@UpdateDateColumn`.

### Files to Modify/Create

| File                                                     | Action | Purpose                                     |
| -------------------------------------------------------- | ------ | ------------------------------------------- |
| `src/repositories/user-repository.ts`                    | Modify | Replace placeholder with interface + impl   |
| `src/repositories/index.ts`                              | Modify | Uncomment the user-repository barrel export |
| `src/lib/types.ts`                                       | Modify | Uncomment `UserRepository` symbol           |
| `src/inversify.config.ts`                                | Modify | Uncomment import and container binding      |
| `tests/unit/repositories/user-repository.test.ts`        | Create | Unit tests with mocked TypeORM Repository   |
| `tests/integration/repositories/user-repository.test.ts` | Create | Integration tests with real DB              |
| `tests/unit/config/di-integration.test.ts`               | Modify | Add UserRepository binding assertions       |

### Coding Guidelines

- Follow the exact same style as `src/services/password-manager-service.ts`:
  named exports for interface and impl, `@injectable()` decorator, 4-space
  indentation, single quotes, trailing semicolons.
- Import `injectable` and `inject` from `inversify`.
- Import `TYPES` from `../lib/types`.
- Import `DataSource`, `Repository` from `typeorm`.
- Import `User` from `../entities/user`.
- Use constructor injection:
  ```typescript
  constructor(@inject(TYPES.DataSource) dataSource: DataSource) {
      this.repository = dataSource.getRepository(User);
  }
  ```
- Private field: `private readonly repository: Repository<User>;`
- Export the types `CreateUserData` and `UpdateUserData` (they will be needed by
  the UserService in a future task).
- Do NOT import or use `QueryFailedError` — error interpretation belongs in the
  service layer.

### DI Wiring Changes

1. `src/lib/types.ts` — Uncomment the `UserRepository` symbol so TYPES includes:
   `UserRepository: Symbol.for('UserRepository')`

2. `src/inversify.config.ts` — Uncomment the import
   `import { UserRepository, UserRepositoryImpl } from './repositories';` and
   uncomment the container binding:
   `container.bind<UserRepository>(TYPES.UserRepository).to(UserRepositoryImpl);`

3. `src/repositories/index.ts` — Uncomment: `export * from './user-repository';`

### Test Strategy

#### Unit Tests (`tests/unit/repositories/user-repository.test.ts`)

Unit tests mock the TypeORM `Repository<User>` and the `DataSource`. The mock
DataSource returns a mock Repository from `getRepository(User)`. Tests verify
that the impl class calls the correct Repository methods with the correct
arguments.

**Setup pattern:**

```typescript
import "reflect-metadata";
// Create mock repository with jest.fn() for each method
const mockRepository = {
  findOneBy: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};
// Create mock DataSource that returns the mock repository
const mockDataSource = {
  getRepository: jest.fn().mockReturnValue(mockRepository),
} as unknown as DataSource;
// Instantiate the impl directly, passing mock DataSource
const repo = new UserRepositoryImpl(mockDataSource);
```

**Test cases — findByEmail:**

1. Calls `repository.findOneBy({ email })` with the given email
2. Returns the User when found
3. Returns `null` when not found

**Test cases — findById:**

4. Calls `repository.findOneBy({ id })` with the given id
5. Returns the User when found
6. Returns `null` when not found

**Test cases — create:**

7. Calls `repository.create(data)` with the correct fields
8. Calls `repository.save()` with the created entity
9. Returns the saved User (with id, timestamps)

**Test cases — update:**

10. Returns `null` when user not found by id
11. When user exists, calls `repository.save()` with merged data
12. Returns the updated User
13. Only merges provided fields (partial update — e.g., only firstName)

**Test cases — constructor:**

14. Calls `dataSource.getRepository(User)` in the constructor

#### DI Integration Tests (add to `tests/unit/config/di-integration.test.ts`)

15. `TYPES.UserRepository` is bound in the container
16. Resolving the service returns a `UserRepositoryImpl` instance

Note: The DI integration test already has a `MOCK_DATA_SOURCE`. The existing
mock (`{ options: {} }`) needs `getRepository` added to it, or a new mock must
be created for the UserRepository tests. Since `UserRepositoryImpl` calls
`dataSource.getRepository(User)` in its constructor, the mock must include this
method. Update `MOCK_DATA_SOURCE` to:

```typescript
const MOCK_DATA_SOURCE = {
  options: {},
  getRepository: jest.fn().mockReturnValue({
    findOneBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  }),
} as unknown as DataSource;
```

#### Integration Tests (`tests/integration/repositories/user-repository.test.ts`)

These tests run against a real PostgreSQL database via `make test-integration`.
Follow the pattern in `tests/integration/database/connection.test.ts`:

- Create a DataSource with test credentials (host: `postgres`, user: `postgres`,
  password: `postgres`, database: `case_study_db`)
- Apply migration SQL in `beforeAll`, clean up in `afterAll`
- Instantiate `UserRepositoryImpl` directly with the real DataSource

**Test cases:**

17. `create` — inserts a user and returns it with a UUID id and timestamps
18. `findByEmail` — finds a previously created user by email
19. `findByEmail` — returns `null` for a non-existent email
20. `findById` — finds a previously created user by id
21. `findById` — returns `null` for a non-existent id
22. `create` with duplicate email — throws a TypeORM error (unique constraint
    violation). Test with `expect(...).rejects.toThrow()`.
23. `update` — updates firstName/lastName and returns updated user with new
    `updatedAt`
24. `update` — returns `null` for a non-existent id
25. `update` — partial update (only firstName) preserves other fields

**Integration test setup/teardown pattern:**

```typescript
beforeAll: initialize DataSource, run migration SQL
beforeEach: TRUNCATE "users" to ensure test isolation
afterAll: drop users table, destroy DataSource
```

Use the same `MIGRATION_UP` and `MIGRATION_DOWN` SQL strings as in
`tests/integration/database/connection.test.ts`.

### Edge Cases

- **Duplicate email on create**: The `email` column has a UNIQUE constraint. The
  repository does NOT catch this — the TypeORM `QueryFailedError` propagates.
  The integration test verifies this behavior.
- **Non-existent user on update**: Returns `null`, not an error. The service
  layer decides what HTTP status this maps to.
- **Empty update data**: `Object.assign(user, {})` is a no-op. TypeORM save
  still updates `updatedAt`. This is acceptable — the service layer should
  validate that at least one field is provided.
- **UUID format for findById**: TypeORM will throw if the id is not a valid UUID
  (PostgreSQL rejects non-UUID strings in UUID columns). The repository does not
  pre-validate — this is a service/controller concern.

### Dependencies

No new npm packages. `typeorm`, `inversify`, and `reflect-metadata` are already
installed.

### Implementation Order

1. Implement `src/repositories/user-repository.ts` (interface, types, impl)
2. Uncomment export in `src/repositories/index.ts`
3. Uncomment `UserRepository` symbol in `src/lib/types.ts`
4. Uncomment import and binding in `src/inversify.config.ts`
5. Write unit tests in `tests/unit/repositories/user-repository.test.ts`
6. Update DI integration tests in `tests/unit/config/di-integration.test.ts`
7. Write integration tests in
   `tests/integration/repositories/user-repository.test.ts`
8. Run `make test-unit` and `make test-integration` to verify

## Milestones

### Milestone 1: Repository Implementation

- **Description**: Replace the placeholder with the UserRepository interface and
  UserRepositoryImpl class
- **Acceptance Criteria**:
  - [ ] `src/repositories/user-repository.ts` exports `UserRepository`
        interface, `UserRepositoryImpl` class, `CreateUserData` type, and
        `UpdateUserData` type
  - [ ] `UserRepositoryImpl` has `@injectable()` decorator
  - [ ] Constructor injects `DataSource` via `@inject(TYPES.DataSource)` and
        derives `Repository<User>` from it
  - [ ] `findByEmail(email)` returns `User | null`
  - [ ] `findById(id)` returns `User | null`
  - [ ] `create(data)` creates and saves, returns `User` with id and timestamps
  - [ ] `update(id, data)` returns updated `User` or `null` if not found
  - [ ] `src/repositories/index.ts` exports the repository
- **Status**: pending

### Milestone 2: DI Wiring

- **Description**: Wire the UserRepository into the DI container
- **Acceptance Criteria**:
  - [ ] `TYPES.UserRepository` symbol is active in `src/lib/types.ts`
  - [ ] `createContainer` binds `UserRepository` to `UserRepositoryImpl`
  - [ ] Import in `src/inversify.config.ts` is uncommented and correct
  - [ ] `make typecheck` passes
- **Status**: pending

### Milestone 3: Unit Tests

- **Description**: Unit tests with mocked TypeORM Repository covering all
  repository methods, plus DI integration assertions
- **Acceptance Criteria**:
  - [ ] `tests/unit/repositories/user-repository.test.ts` exists with all test
        cases from the test strategy (cases 1-14)
  - [ ] Tests mock the DataSource and Repository — no real DB needed
  - [ ] DI integration test updated with UserRepository binding assertions
        (cases 15-16)
  - [ ] `MOCK_DATA_SOURCE` in DI integration test includes `getRepository` mock
  - [ ] `make test-unit` passes with all tests green
- **Status**: pending

### Milestone 4: Integration Tests

- **Description**: Integration tests running against real PostgreSQL verifying
  actual CRUD operations and constraint enforcement
- **Acceptance Criteria**:
  - [ ] `tests/integration/repositories/user-repository.test.ts` exists with all
        test cases from the test strategy (cases 17-25)
  - [ ] Tests use real DataSource with test credentials
  - [ ] Test isolation via TRUNCATE between tests
  - [ ] Duplicate email test verifies unique constraint throws
  - [ ] Partial update test verifies only specified fields change
  - [ ] `make test-integration` passes with all tests green
- **Status**: pending
