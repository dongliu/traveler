# Phase 0 Research: NCR Workflow Management

**Date**: 2026-03-10 | **Branch**: `001-ncr-workflow`

## Decisions

### 1. State Machine Library

**Decision**: `javascript-state-machine` (npm: `javascript-state-machine`)

**Rationale**: Per explicit user direction, `workflow-es` is replaced with
`javascript-state-machine`. This library is a better fit for this use case:
- Simple, lightweight API — one file, minimal dependencies
- Direct method-call transitions (`fsm.submitDisposition()`)
- Built-in `can()` / `cannot()` guard checks before any transition
- Named lifecycle hooks (`onEnterState`, `onBeforeTransition`, per-transition hooks)
- Accessing current state via `fsm.state` — straightforward serialization
- Low learning curve, aligns with existing eTraveler code style (simple, no
  enterprise abstractions)

**Alternatives Considered**:
- `workflow-es` — Rejected (user direction). Over-engineered for a
  single-module FSM; designed for distributed/persistent enterprise workflows.
- `xstate` — Rejected. Introduces TypeScript-centric patterns and a statechart
  paradigm that is inconsistent with the existing codebase style.
- Custom FSM — Rejected. `javascript-state-machine` is well-tested, actively
  maintained, and avoids reinventing transition validation and lifecycle hooks.

**Install**: `npm install javascript-state-machine`

---

### 2. NCR Visibility / Access Control

**Decision**: Role-filtered view (Option C from spec Outstanding Clarifications)

**Rationale**: For a quality management system handling compliance data, a
role-filtered view is the appropriate default:
- NCR Originators see their submitted NCRs
- CE/CS sees NCRs awaiting their disposition
- QA Staff sees NCRs awaiting concurrence
- Managers/Directors see all NCRs (for reporting and oversight)
- This minimizes accidental disclosure of supplier/part quality issues

**Alternatives Considered**:
- Option B (all authenticated users see all NCRs) — Rejected. Violates least
  privilege; inappropriate for supplier-sensitive quality records.

---

### 3. NCR State Machine Design

**Decision**: Factory function returning a per-NCR `javascript-state-machine`
instance, initialized from the persisted `status` field.

**Rationale**: Each NCR has its own workflow state. Rather than a single global
FSM, `createNcrStateMachine(currentStatus)` creates an FSM initialized to the
NCR's current `status`. Transitions are validated via `fsm.can()` before
MongoDB update. State is persisted on the NCR document; the FSM is transient
(not stored).

```javascript
// lib/ncr-state-machine.js
const StateMachine = require('javascript-state-machine');

function createNcrStateMachine(currentStatus) {
  return new StateMachine({
    init: currentStatus,
    transitions: [
      { name: 'submitDisposition',   from: 'Submitted',           to: 'Dispositioned'      },
      { name: 'concurNoApprovers',   from: 'Dispositioned',       to: 'Final Approval'     },
      { name: 'concurWithApprovers', from: 'Dispositioned',       to: 'Approved'           },
      { name: 'returnForComment',    from: 'Approved',            to: 'Returned for Comment' },
      { name: 'resubmitToApprovers', from: 'Returned for Comment', to: 'Approved'          },
      { name: 'finalApprove',        from: 'Approved',            to: 'Final Approval'     },
      { name: 'close',               from: 'Final Approval',      to: 'Closed'             },
    ],
  });
}

module.exports = { createNcrStateMachine };
```

**Usage in service layer**:
```javascript
const fsm = createNcrStateMachine(ncr.status);
if (!fsm.can('submitDisposition')) {
  throw new Error(`Invalid transition from status: ${ncr.status}`);
}
fsm.submitDisposition();
ncr.status = fsm.state; // persist new state
```

---

### 4. Email Notification Strategy

**Decision**: Extend existing `lib/email.js` nodemailer configuration with NCR
templates in a new `lib/ncr-email.js`.

**Rationale**: The project already has nodemailer configured with SMTP. Adding
NCR-specific templates as a separate module avoids modifying working email
infrastructure while following the existing pattern.

**6 notification types**:
1. Initial Notification → QA Staff, Group Leader, Division Director
2. Engineering Disposition Request → CE/CS
3. QA Concurrence Complete → CE/CS (if rejected, back to CE/CS for revision)
4. Approval Request → Designated Additional Approvers
5. NCR Issuance → NCR Originator (final approval reached)
6. Final Distribution → All stakeholder groups (on closure)

---

### 5. Audit Trail Implementation

**Decision**: Separate `audit_logs` MongoDB collection, written on every state
transition and data modification.

**Rationale**: Audit trail must be immutable and complete for compliance. A
separate collection ensures audit records are never overwritten and can be
indexed independently for fast retrieval (`ncr_id + timestamp` index).

---

### 6. Concurrent Access Protection

**Decision**: Mongoose optimistic concurrency via `__v` (version key) + atomic
`findOneAndUpdate` operations for state transitions.

**Rationale**: Mongoose's built-in version key prevents concurrent writes
corrupting state. State transitions use `findOneAndUpdate` with the expected
current status as a filter condition, preventing race conditions.
