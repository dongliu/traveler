# Implementation Plan: NCR Workflow Management

**Branch**: `001-ncr-workflow` | **Date**: 2026-03-11 | **Spec**: `specs/001-ncr-workflow/spec.md`
**Input**: Feature specification from `/specs/001-ncr-workflow/spec.md`

## Summary

Build a Nonconformance Report (NCR) workflow management module on top of the
existing Express/Mongoose/Jade stack. The module enables NCR creation,
engineering disposition (CE/CS), QA concurrence, designated approver
authorization, issuance, and closure. A `javascript-state-machine` FSM governs
state transitions. All state changes, user actions, and email notifications are
recorded as immutable events embedded in the NCR document (event sourcing
pattern), replacing separate audit-log and forwarding-log collections.

## Technical Context

**Language/Version**: Node.js 18+, JavaScript (ES6+)
**Primary Dependencies**: Express 4, Mongoose 5, Nodemailer 6, javascript-state-machine
**Storage**: MongoDB via Mongoose — 1 collection: `ncrs` (embedded `events[]` + `preventive_actions[]`)
**Testing**: Mocha — `test-unit/` (unit), `test-integ/` (integration)
**Target Platform**: Linux server (single-org Node.js web service)
**Project Type**: web-service
**Performance Goals**: <2s query for 10,000+ NCRs (SC-004); email distributed within 2min of closure (SC-012)
**Constraints**: 10+ concurrent users without corruption (SC-010); role-filtered NCR visibility
**Scale/Scope**: Single-org deployment, 10k+ NCRs, 15–40 events per NCR

## Constitution Check

### Gate Evaluation (pre-design)

| Principle | Status | Notes |
|---|---|---|
| I. Automated Testing | PASS | Unit tests for `lib/ncr*.js`; integration tests for `routes/ncr.js`. 80% coverage target. |
| II. Code Quality | PASS | FSM and service logic in `lib/`; routes are thin. Async/await throughout. |
| III. Security-First | PASS | RBAC enforced at route middleware; input validated at route boundary; no secrets in code. |
| IV. Versioning | PASS | Schema versioned. No breaking changes to existing routes. |
| V. Documentation | PASS | API contracts in `contracts/`. JSDoc on complex logic. |

No gate violations. No complexity tracking required.

### Post-Design Re-check

| Principle | Status | Notes |
|---|---|---|
| I. Automated Testing | PASS | Event appending logic is testable in unit tests; workflow transitions covered in integration tests. |
| II. Code Quality | PASS | `NcrEventSchema` is a shared subschema; no duplication across models. |
| III. Security-First | PASS | Events are append-only (no update/delete paths); actor snapshots prevent retrospective role manipulation. |
| IV. Versioning | PASS | Embedded events are additive; existing NCR fields unchanged. |
| V. Documentation | PASS | Event type enum documented in `data-model.md`; contracts updated with event side-effects. |

## Project Structure

### Documentation (this feature)

```text
specs/001-ncr-workflow/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (updated with event sourcing)
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── ncr-create.json
│   └── ncr-disposition.json
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
lib/
├── ncr-state-machine.js  # FSM factory (createNcrStateMachine)
├── ncr-service.js        # Business logic (create, disposition, concur, approve, close)
└── ncr-email.js          # NCR notification templates (6 email types)

model/
└── ncr.js                # Mongoose schema (PreventiveActionSchema + NcrEventSchema + NcrSchema)

routes/
└── ncr.js                # Express routes (thin, delegates to ncr-service)

views/
├── ncr-create.jade
├── ncr-detail.jade
├── ncr-disposition.jade
├── ncr-concurrence.jade
├── ncr-approval.jade
├── ncr-close.jade
└── ncr-dashboard.jade

test-unit/
├── ncr-state-machine.test.js
├── ncr-service.test.js
└── ncr-event.test.js

test-integ/
└── ncr.test.js
```

**Structure Decision**: Single project layout, extending existing repo structure.
New files follow the established `lib/`, `model/`, `routes/`, `views/` pattern.

## Key Architectural Decisions

### Preventive Actions as Subdocuments (user directive)

`ncr.preventive_actions[]` is an embedded array of `PreventiveActionSchema`
subdocuments inside the NCR document. No separate collection is used.

- CE/CS populates `action_description` for each action during disposition
- QA Staff later assigns `owner_*` and `target_completion_date` per subdocument
- PA owner updates `status` and `comments` directly on the subdocument
- PA lifecycle events (`pa.owner_assigned`, `pa.status_updated`, `pa.closed`)
  are recorded in the same NCR's `events[]` for unified history
- The `disposition.preventive_actions: [String]` field is **removed**; the
  subdocuments replace it, with `action_description` serving the same purpose

**Single collection**: all NCR data, events, and preventive actions live in
the `ncrs` collection.

### Event Sourcing (user directive)

`ncr.events[]` is the authoritative audit and notification history for each
NCR. Separate `audit_logs` and `forwarding_logs` collections are **not used**.

- **User input events** (`actor_type: "user"`): every authenticated action
  (create, disposition, concur, approve, close) is recorded with actor
  snapshot, timestamp, previous/new status, and action payload.
- **System output events** (`actor_type: "system"`): every email notification
  is recorded with per-recipient delivery status embedded in the event's
  `recipients[]` field.
- Events are append-only. The service layer never updates or deletes events.
- NCR fields like `status`, `disposition`, `closure_record` remain as
  denormalized projections for efficient querying. On any conflict, `events[]`
  is authoritative.

### State Machine

`createNcrStateMachine(currentStatus)` in `lib/ncr-state-machine.js` returns a
per-request FSM instance initialized from the persisted `ncr.status`. Service
layer calls `fsm.can(transition)` before any MongoDB write.

### Email Notifications

`lib/ncr-email.js` extends the existing nodemailer config with 7 NCR-specific
email functions. Each send call returns per-recipient delivery results; the
service layer appends the corresponding system output event to `ncr.events[]`.

### Access Control

Role-filtered visibility (Option C from spec). Route middleware checks
`req.user.role` against allowed roles per endpoint. NCR Originators see their
NCRs; CE/CS sees NCRs awaiting disposition; QA Staff sees NCRs awaiting
concurrence; Managers see all.

### Concurrent Access

Mongoose optimistic concurrency via `__v` (version key) + atomic
`findOneAndUpdate` for state transitions.
