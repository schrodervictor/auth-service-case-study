# Task: Emulated Eventbus for Development

## Status: done

## Context

The codebase references `@marta/eventbus` — a private Kafka-based event library
we don't have access to. The commented-out code in `src/index.ts` and
`src/services/example-service.ts` reveals the API surface. This task implements
an emulated eventbus in `src/eventbus/` that matches the same interface, so the
application can run with event infrastructure in development without requiring
Kafka.

The eventbus mode is controlled via the `eventbus.mode` config field. Currently
only `emulated` is available. The emulated producer logs published messages as
JSON via `console.log`. The emulated consumer accepts subscriptions but is a
no-op (logs topic names only).

## Technical Specification

### API Surface (matching `@marta/eventbus`)

- `createKafkaClient()` — async factory returning a `KafkaClient`
- `Producer` class — `publish({ topic, events })` logs JSON
- `Consumer` class — `subscribe([{ topic, eventHandler }])` logs topic names
- `DomainEvents` — const object with event type strings

### New Files

| File                            | Purpose                                                              |
| ------------------------------- | -------------------------------------------------------------------- |
| `src/eventbus/index.ts`         | Barrel re-export                                                     |
| `src/eventbus/types.ts`         | `KafkaClient`, `EventMessage`, `PublishPayload`, `TopicSubscription` |
| `src/eventbus/client.ts`        | `createKafkaClient()` factory                                        |
| `src/eventbus/producer.ts`      | `Producer` class (logs JSON)                                         |
| `src/eventbus/consumer.ts`      | `Consumer` class (no-op)                                             |
| `src/eventbus/domain-events.ts` | `DomainEvents` const object                                          |

### Modified Files

| File                   | Change                                                                   |
| ---------------------- | ------------------------------------------------------------------------ |
| `src/config/schema.ts` | Added `eventbus: { mode: 'emulated' }` section                           |
| `src/lib/types.ts`     | Added `Producer` DI symbol                                               |
| `src/index.ts`         | Replaced commented-out `@marta/eventbus` block with `./eventbus` imports |
| `config/default.json`  | Added `eventbus` section                                                 |
| `config/test.json`     | Added `eventbus` section                                                 |

### Tests

| File                                        | Tests                                        |
| ------------------------------------------- | -------------------------------------------- |
| `tests/unit/eventbus/client.test.ts`        | Factory returns correct shape, logs creation |
| `tests/unit/eventbus/producer.test.ts`      | Logs correct JSON with topic/events/mode     |
| `tests/unit/eventbus/consumer.test.ts`      | Logs topic names, handles empty list         |
| `tests/unit/eventbus/domain-events.test.ts` | Has expected keys                            |
| `tests/unit/config/config-schema.test.ts`   | Eventbus section defaults and validation     |

## Milestones

### Milestone 1: Emulated Eventbus Module

- **Description**: Create the eventbus module with all classes/interfaces, wire
  into app bootstrap, add config schema support.
- **Acceptance Criteria**:
  - [x] `src/eventbus/` module with Producer, Consumer, createKafkaClient,
        DomainEvents, types
  - [x] Producer logs published messages as JSON via `console.log`
  - [x] Consumer logs subscribed topic names, no-op otherwise
  - [x] `eventbus.mode` config field with Zod validation
  - [x] `src/index.ts` uses `./eventbus` imports instead of `@marta/eventbus`
  - [x] `TYPES.Producer` DI symbol added
  - [x] Producer bound to DI container at startup
  - [x] Unit tests for all eventbus components
  - [x] Config schema tests updated
  - [x] All existing tests updated for new `AppConfig` shape
  - [x] `make test-unit` passes (488 tests)
  - [x] `make typecheck` clean
- **Status**: done
