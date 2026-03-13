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

**7 notification functions** in `lib/ncr-email.js`:
1. `sendInitialNotification` → QA Staff, Group Leader, Division Director
2. `sendDispositionRequest` → CE/CS (engineering disposition request)
3. `sendQaNotification` → QA Staff (disposition complete or returned for comment)
4. `sendApprovalRequest` → Designated Additional Approvers
5. `sendIssuance` → NCR Originator (final approval reached)
6. `sendFinalDistribution` → All 5 stakeholder groups (on closure)
7. `sendPaAssigned` → Preventive Action owner (on PA assignment by QA)

---

### 5. Event Sourcing — Unified Event Stream

**Decision**: Embedded `events[]` array on the NCR document using the event
sourcing pattern. Replaces separate `audit_logs` and `forwarding_logs`
collections.

**Rationale**: Every user action (submit, approve, close), system state
transition, and system notification (email sent + per-recipient delivery
status) is recorded as an immutable, append-only event in `ncr.events[]`. This
eliminates two separate collections while making the full NCR lifecycle
self-contained in a single document. The `status` field on the NCR is a
denormalized read-model projection for efficient queries; `events[]` is the
authoritative history.

**Event categories**:
- **User input events** — actions taken by authenticated users (e.g.,
  `ncr.submitted`, `disposition.submitted`, `approval.approved`)
- **System output events** — email notifications sent to stakeholders (e.g.,
  `notification.initial`, `notification.issuance`), with per-recipient
  delivery status embedded in the event's `recipients[]` field
- Each event captures: `event_type`, `actor_type`, `actor_id`, `actor_name`,
  `actor_role` (snapshot at time of event), `timestamp`, `previous_status`,
  `new_status`, `payload`, and `recipients[]`

**Alternatives Considered**:
- Separate `audit_logs` collection — Rejected (user direction). Adds
  collection management overhead and splits history across multiple documents.
- Separate `forwarding_logs` collection — Rejected (user direction). Email
  delivery records belong in the same event stream as the actions that
  triggered them.
- Hybrid (events + separate forwarding log) — Rejected. Partial unification
  defeats the simplicity benefit of event sourcing.

---

### 6. Preventive Actions as NCR Subdocuments

**Decision**: `ncr.preventive_actions[]` — embedded array of `PreventiveActionSchema`
subdocuments inside the NCR document. No separate `preventive_actions` collection.

**Rationale**: Preventive actions are created by CE/CS during disposition and tracked
by QA thereafter. Embedding them keeps all quality data for an NCR in one document,
consistent with the event sourcing approach (PA lifecycle events also go into
`ncr.events[]`). The `disposition.preventive_actions: [String]` raw-text field is
replaced by the structured subdocuments, with `action_description` carrying the CE/CS
free-text. Owner assignment, status history, and comments are enriched in-place.
MongoDB array filters (`arrayFilters`) allow atomic updates to individual subdocs.

**Alternatives Considered**:
- Separate `preventive_actions` collection — Rejected (user direction). Adds a
  second collection and foreign-key lookups for data that is inherently owned by one NCR.

---

### 7. Concurrent Access Protection

**Decision**: Mongoose optimistic concurrency via `__v` (version key) + atomic
`findOneAndUpdate` operations for state transitions.

**Rationale**: Mongoose's built-in version key prevents concurrent writes
corrupting state. State transitions use `findOneAndUpdate` with the expected
current status as a filter condition, preventing race conditions.
