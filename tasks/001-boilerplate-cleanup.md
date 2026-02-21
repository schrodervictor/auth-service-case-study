# Task: Initial Cleanup and Boilerplate Adjustments

## Status: done

## Context

The original case-study boilerplate had outdated dependencies, a yarn-based
setup, loose TypeScript config, and no test infrastructure. Before building
anything, the foundation needed to be modernized and cleaned up.

## Technical Specification

- Migrate from yarn to npm
- Update all dependencies to latest compatible versions
- Tighten tsconfig for a modern Node.js target
- Add Jest config and test infrastructure stubs
- Improve Dockerfile build caching and SSH defaults
- Reorganize source code under `src/`

## Milestones

### Milestone 1: Dependency and Tooling Modernization

- **Description**: Replace yarn with npm, update all deps, streamline scripts
- **Acceptance Criteria**:
  - [x] yarn.lock deleted, package-lock.json present
  - [x] All dependencies updated to latest compatible versions
  - [x] Dev scripts cleaned up in package.json
- **Status**: done

### Milestone 2: TypeScript Configuration

- **Description**: Tighten tsconfig for Node 18+ and strict mode
- **Acceptance Criteria**:
  - [x] Target set to es2020
  - [x] Strict mode enabled
  - [x] Types array correctly configured
- **Status**: done

### Milestone 3: Test Infrastructure Stubs

- **Description**: Add Jest config and placeholder test files
- **Acceptance Criteria**:
  - [x] jest.config.json with ts-jest preset
  - [x] tests/setup.ts, teardown.ts, helpers.ts stubs created
  - [x] .env.test support
- **Status**: done

### Milestone 4: Dockerfile Improvements

- **Description**: Improve Docker build caching and defaults
- **Acceptance Criteria**:
  - [x] Multi-stage Dockerfile with base, dev, builder, final stages
  - [x] package.json copied before source for better layer caching
  - [x] SSH mount defaults corrected
- **Status**: done
