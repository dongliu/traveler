# NCR Workflow Quick Start Guide

## Overview

This guide covers setting up the NCR Workflow feature in the existing eTraveler
application. The only **new dependency** is **javascript-state-machine** for state
machine management. All other packages (mongoose, express, jade, nodemailer) are
already configured in the project.

The NCR module uses a **single MongoDB collection** (`ncrs`) with all data
embedded — events, preventive actions, disposition, approvals, and closure.
No separate audit-log or forwarding-log collections are needed.

## Quick Setup

### 1. Install javascript-state-machine (Only New Package)

```bash
npm install javascript-state-machine
```

All other dependencies already exist in the project.

### 2. Add NCR Environment Configuration

Add these NCR-specific settings to your existing `.env` file:

```env
# NCR Configuration
NCR_APPROVAL_TIMEOUT=5d       # Max time for approvals before escalation
NCR_EMAIL_RETRY_COUNT=3       # Email delivery retries on failure
```

### 3. Register NCR Router

Add one line to your main app file (app.js or server.js):

```javascript
app.use('/api/ncr', require('./routes/ncr'));
```

MongoDB indexes are created automatically when `model/ncr.js` is loaded by
Mongoose (defined via `.index()` calls on the schema). No separate DB init
script is needed.

## Project Structure — NCR Files

All NCR logic lives in 7 new files following existing repo conventions:

```text
lib/
├── ncr-state-machine.js   # FSM factory: createNcrStateMachine(status)
├── ncr-service.js         # Business logic: create, disposition, concur, approve, close, PA
└── ncr-email.js           # 7 email notification functions

model/
└── ncr.js                 # Single file: PreventiveActionSchema + NcrEventSchema + NcrSchema

routes/
└── ncr.js                 # Express router: 10 routes, thin handlers

views/
├── ncr-create.jade        # NCR creation form
├── ncr-detail.jade        # NCR detail + event timeline + PA tracking
├── ncr-disposition.jade   # CE/CS disposition form
├── ncr-concurrence.jade   # QA concurrence + approver designation
├── ncr-approval.jade      # Designated approver authorization
├── ncr-close.jade         # Originator closure form
└── ncr-dashboard.jade     # Status dashboard + search/filter
```

**Single collection**: the `ncrs` MongoDB collection holds everything:
- `events[]` — immutable event stream (all user actions + notification delivery records)
- `preventive_actions[]` — PA subdocuments (created at disposition, enriched by QA)
- `disposition` — CE/CS engineering analysis (embedded subdoc)
- `additional_approvers[]` — designated approver list with per-approver status
- `closure_record` — closure data (embedded subdoc)

## Running NCR Tests

```bash
# NCR unit tests (state machine, service logic)
npm run unit -- --grep "ncr"

# NCR integration tests (API workflow)
npm run test:integration -- test-integ/ncr.test.js

# All NCR tests
npm test -- --grep "ncr"
```

## Workflow State Machine (javascript-state-machine)

7 transitions govern the 6-status workflow:

```javascript
// lib/ncr-state-machine.js
const StateMachine = require('javascript-state-machine');

function createNcrStateMachine(currentStatus) {
  return new StateMachine({
    init: currentStatus,
    transitions: [
      { name: 'submitDisposition',   from: 'Submitted',             to: 'Dispositioned'        },
      { name: 'concurNoApprovers',   from: 'Dispositioned',         to: 'Final Approval'       },
      { name: 'concurWithApprovers', from: 'Dispositioned',         to: 'Approved'             },
      { name: 'returnForComment',    from: 'Approved',              to: 'Returned for Comment' },
      { name: 'resubmitToApprovers', from: 'Returned for Comment',  to: 'Approved'             },
      { name: 'finalApprove',        from: 'Approved',              to: 'Final Approval'       },
      { name: 'close',               from: 'Final Approval',        to: 'Closed'               },
    ],
  });
}

module.exports = { createNcrStateMachine };
```

**Usage pattern in service layer** (FSM is transient — never persisted):

```javascript
const fsm = createNcrStateMachine(ncr.status);
if (!fsm.can('submitDisposition')) {
  throw new Error(`Invalid transition from status: ${ncr.status}`);
}
fsm.submitDisposition();
ncr.status = fsm.state;  // persist new state to MongoDB, discard FSM
```

## Event Sourcing

Every user action and email notification is recorded as an immutable event in
`ncr.events[]`. Events are append-only — never updated or deleted.

```javascript
// Append a user event
ncr.events.push({
  event_type: 'disposition.submitted',
  actor_type: 'user',
  actor_id: user._id,
  actor_name: user.name,
  actor_role: user.role,
  timestamp: new Date(),
  previous_status: 'Submitted',
  new_status: 'Dispositioned',
  payload: { parts_disposition: 'Rework', preventive_action_count: 2 }
});

// Append a system notification event (with delivery results)
const results = await sendQaNotification(ncr, qaStaff);
ncr.events.push({
  event_type: 'notification.qa_notification',
  actor_type: 'system',
  actor_name: 'System',
  timestamp: new Date(),
  recipients: results  // [{recipient_email, delivery_status, delivery_timestamp, ...}]
});
```

Use `GET /api/ncr/:id/events` to retrieve the full event timeline for an NCR.

## Preventive Action Tracking

Preventive actions are subdocuments in `ncr.preventive_actions[]`:

1. **CE/CS disposition** → creates one subdoc per action with `action_description`, `status: 'Open'`
2. **QA assigns owner** → sets `owner_*` and `target_completion_date` on the subdoc
3. **PA owner updates** → sets `status`, pushes to `status_history`, adds comments
4. **QA closes PA** → sets `status: 'Completed'`, `actual_completion_date`

Update individual PA subdocuments with MongoDB array filters:

```javascript
await Ncr.findOneAndUpdate(
  { _id: ncrId, 'preventive_actions._id': paId },
  { $set: { 'preventive_actions.$.owner_name': ownerName, ... } },
  { new: true, runValidators: true }
);
```

## Email Notifications

7 functions in `lib/ncr-email.js` (extending existing `lib/email.js`):

| Function | Triggered By | Recipients |
|---|---|---|
| `sendInitialNotification` | NCR submitted | QA Staff, Group Leader, Director/PM |
| `sendDispositionRequest` | NCR submitted (after initial) | CE/CS |
| `sendQaNotification` | Disposition submitted or returned for comment | QA Staff |
| `sendApprovalRequest` | QA concurrence with additional approvers | Designated Approvers |
| `sendIssuance` | Final Approval reached | NCR Originator/Designee |
| `sendFinalDistribution` | NCR closed | All 5 stakeholder groups |
| `sendPaAssigned` | QA assigns PA owner | Preventive Action Owner |

Each function returns `[{recipient_id, recipient_email, delivery_status, delivery_timestamp, error_message}]`
for appending to `ncr.events[]`. Email failures do NOT block state transitions.

## API Endpoints

| Endpoint | Method | Role | Purpose |
|---|---|---|---|
| `/api/ncr` | POST | NCR Originator | Create new NCR |
| `/api/ncr` | GET | All | List NCRs (role-filtered) |
| `/api/ncr/:id` | GET | All | Retrieve full NCR with events and PAs |
| `/api/ncr/:id/events` | GET | All | Retrieve event timeline only |
| `/api/ncr/:id/disposition` | PATCH | CE/CS / Delegate | Submit engineering disposition |
| `/api/ncr/:id/concurrence` | PATCH | QA Staff | Give concurrence + designate approvers |
| `/api/ncr/:id/approve` | PATCH | Designated Approver | Approve or Return for Comment |
| `/api/ncr/:id/resubmit` | PATCH | QA Staff | Resubmit to approvers after comment resolution |
| `/api/ncr/:id/close` | PATCH | NCR Originator | Close NCR with execution notes |
| `/api/ncr/:id/preventive-actions/:pa_id/owner` | PATCH | QA Staff | Assign PA owner |
| `/api/ncr/:id/preventive-actions/:pa_id/status` | PATCH | PA Owner / QA Staff | Update or close PA |

See `contracts/` directory for detailed request/response schemas (create and disposition contracts).

## Common Development Tasks

### Test NCR State Machine Transitions

```bash
npm run unit -- test-unit/ncr-state-machine.test.js --verbose
```

### Test Email Functions

```bash
# Mock nodemailer — no actual email sent
npm run unit -- test-unit/ncr-email.test.js
```

### View NCR Event Timeline

```bash
GET /api/ncr/NCR-2026-0042/events
Authorization: Bearer {token}
```

Returns `ncr.events[]` sorted by timestamp — all user actions and notification
delivery records in chronological order.

### Search NCRs by Status or Part Number

```bash
GET /api/ncr?status=Dispositioned&part_number=BA-1234
GET /api/ncr?includeClosed=true&from_date=2026-01-01&to_date=2026-03-31
Authorization: Bearer {token}
```

Closed NCRs are excluded by default. Pass `includeClosed=true` for archive access.

## Troubleshooting

### Invalid State Transition Error

```bash
# Check current NCR status
GET /api/ncr/:id
# Check event timeline to see what transitions occurred
GET /api/ncr/:id/events
```

Valid transitions are defined in `lib/ncr-state-machine.js`. The service layer
calls `fsm.can(transitionName)` and throws 409 Conflict if not allowed.

### Email Delivery Failure

Email failures are recorded in the notification event's `recipients[]` with
`delivery_status: 'Failed'` and `error_message`. They do not block state
transitions. To review:

```bash
GET /api/ncr/:id/events
# Look for notification.* events with delivery_status: 'Failed'
```

Check SMTP config in `.env` and verify `lib/email.js` configuration.

### MongoDB Schema Issues

Indexes are created automatically by Mongoose on application startup via
`.index()` calls in `model/ncr.js`. No separate init script needed.

```bash
# Reset test database
npm run db:reset:test

# Check Mongoose connection
npm run unit -- --grep "ncr model"
```

## Documentation References

- [Full Specification](spec.md) — Complete NCR workflow requirements (65 FRs)
- [Data Model](data-model.md) — Single-collection schema with event sourcing and PA subdocuments
- [API Contracts](contracts/) — Request/response schemas for create and disposition endpoints
- [Implementation Plan](plan.md) — Technical architecture and key decisions
- [Research Decisions](research.md) — Library choices and design rationale
- [Tasks](tasks.md) — 36 implementation tasks in 9 phases

## Next Steps

1. `npm install javascript-state-machine`
2. Create the 7 source files in `lib/`, `model/`, `routes/`, `views/`
3. Register router in app.js
4. Run `npm run unit -- --grep "ncr"` after each phase
5. See [tasks.md](tasks.md) for phase-by-phase implementation plan (MVP = Phases 1–4)
