# Task: Development Environment and Testing Layers

## Status: done

## Context

With the boilerplate cleaned up, the project needed a fully containerized
development environment and a structured test layer system. All development
commands run through Docker — no local node/npm required.

## Technical Specification

- docker-compose with app (dev target) and postgres services
- Three test layers: unit, integration, acceptance — each with different
  dependency requirements
- Makefile as the single entry point for all Docker-based commands
- Health-check endpoint for app availability checks
- Volumes mount only `src/` and `tests/` (deps live in the image)

## Milestones

### Milestone 1: Docker Compose Setup

- **Description**: Create docker-compose.yml with app and postgres services
- **Acceptance Criteria**:
  - [x] App service builds from dev stage, mounts src/ and tests/
  - [x] Postgres service with healthcheck and tmpfs storage
  - [x] App depends on postgres healthy state
- **Status**: done

### Milestone 2: Test Layer Structure

- **Description**: Create unit/integration/acceptance test directories with
  examples and per-layer npm scripts
- **Acceptance Criteria**:
  - [x] tests/unit/example.test.ts — real passing tests, no external deps
  - [x] tests/integration/example.test.ts — todo test with DB pattern
  - [x] tests/acceptance/ — isolated Docker container with own package.json,
        Dockerfile, and Jest config; test files in specs/ mounted via volume
  - [x] npm scripts: test:unit, test:integration (acceptance runs via container)
  - [x] npm test runs unit + integration only (acceptance runs separately)
  - [x] passWithNoTests enabled in jest config
- **Status**: done

### Milestone 3: Makefile with Docker Targets

- **Description**: Makefile as the developer interface for all containerized
  commands
- **Acceptance Criteria**:
  - [x] `make build` — builds the app image
  - [x] `make up` / `make down` — start/stop compose in background
  - [x] `make wait-for-app` — polls health-check with 30s timeout
  - [x] `make test-unit` — runs in isolated container (no deps)
  - [x] `make test-integration` — runs with postgres via compose
  - [x] `make test-acceptance` — starts full stack, waits, runs acceptance
        container, tears down
- **Status**: done

### Milestone 4: Health-Check Endpoint

- **Description**: Concrete controller for the health-check route
- **Acceptance Criteria**:
  - [x] GET /partner-app/api/health-check returns 200
  - [x] Response body: `{"message":"Service is up and running"}`
  - [x] Registered in inversify DI container
- **Status**: done

### Milestone 5: Documentation

- **Description**: Testing strategy docs and common issues in README
- **Acceptance Criteria**:
  - [x] docs/testing.md with layer descriptions, run commands, conventions
  - [x] README common issues section (image rebuild, stale image)
- **Status**: done
