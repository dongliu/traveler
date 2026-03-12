# NCR Workflow Quick Start Guide

## Overview

This guide covers setting up the NCR Workflow feature in the existing eTraveler
application. The only **new dependency** is **javascript-state-machine** for state
machine management. All other packages (mongoose, express, jade, email.js,
nodemailer) are already configured in the project.

## Quick Setup

### 1. Install javascript-state-machine (Only New Package)

```bash
npm install javascript-state-machine
```

All other dependencies already exist in the project - no additional setup
needed.

### 2. Add NCR Environment Configuration

Add these NCR-specific settings to your existing `.env` file:

```env
# NCR Configuration
# NCR_NAMING_CONVENTION will be decided during implementation
NCR_APPROVAL_TIMEOUT=5d                        # Max time for approvals
NCR_EMAIL_RETRY_COUNT=3                        # Email delivery retries
```

### 3. Initialize NCR Database Indexes

```bash
npm run db:init:ncr
```

This creates MongoDB indexes for NCR-specific collections (audit_logs,
forwarding_logs, preventive_actions). Mongoose schemas auto-create collections
on first document write.

## Project Structure - NCR Files Only

New files to be created in existing directories:

```
lib/
├── ncr.js                # Core NCR business logic
├── ncr-state-machine.js  # javascript-state-machine FSM definition (NEW)
├── ncr-service.js        # NCR service layer (CRUD operations)
└── ncr-email.js          # Email notification templates

models/
├── ncr.js                # Mongoose NCR schema
├── disposition.js        # Disposition schema
├── approval.js           # Approval schema
├── audit-log.js          # Audit log schema
└── forwarding-log.js     # Forwarding log schema

routes/
└── ncr.js                # NCR API endpoints

views/
├── ncr-create.jade       # NCR creation form
├── ncr-detail.jade       # NCR detail view
└── ncr-dashboard.jade    # NCR status dashboard
```

## Running NCR Tests

```bash
# NCR unit tests (state machine, models)
npm run unit -- --grep "ncr"

# NCR integration tests (API endpoints, workflow transitions)
npm run test:integration -- test-integ/ncr-api.test.js

# All NCR tests with coverage
npm test -- --testPathPattern=ncr
```

## Workflow State Machine (javascript-state-machine)

The NCR workflow uses `javascript-state-machine` to define the 6-state workflow:

```javascript
// From lib/ncr-state-machine.js
const StateMachine = require('javascript-state-machine');

function createNcrStateMachine(currentStatus) {
  return new StateMachine({
    init: currentStatus,
    transitions: [
      { name: 'submitDisposition',   from: 'Submitted',            to: 'Dispositioned'       },
      { name: 'concurNoApprovers',   from: 'Dispositioned',        to: 'Final Approval'      },
      { name: 'concurWithApprovers', from: 'Dispositioned',        to: 'Approved'            },
      { name: 'returnForComment',    from: 'Approved',             to: 'Returned for Comment' },
      { name: 'resubmitToApprovers', from: 'Returned for Comment', to: 'Approved'            },
      { name: 'finalApprove',        from: 'Approved',             to: 'Final Approval'      },
      { name: 'close',               from: 'Final Approval',       to: 'Closed'              },
    ],
  });
}

module.exports = { createNcrStateMachine };
```

**Workflow transitions are managed by javascript-state-machine:**

- Each state validates allowed transitions via `fsm.can('transitionName')`
- Guard checks prevent invalid state changes before MongoDB update
- Service layer calls `fsm.can()` then persists `fsm.state` to the NCR document
- Audit log records all transitions with user identity and timestamp

## Email Notifications

NCR email notifications are sent at each workflow step. Templates are in
`lib/ncr-email.js`:

1. **Initial Notification** → QA Staff, Group Leader, Division Director
2. **Engineering Disposition Request** → CE/CS
3. **QA Concurrence** → QA Staff (indicates next step)
4. **Approval Request** → Designated Approvers
5. **NCR Issuance** → NCR Originator (with disposition details)
6. **Final Distribution** → All stakeholders upon closure

Existing email service (in `lib/email.js`) is extended with NCR templates.

## API Endpoints Summary

| Endpoint                   | Method | Purpose                           |
| -------------------------- | ------ | --------------------------------- |
| `/api/ncr`                 | POST   | Create new NCR                    |
| `/api/ncr/:id`             | GET    | Retrieve NCR details              |
| `/api/ncr`                 | GET    | List NCRs with filter/search      |
| `/api/ncr/:id/disposition` | PATCH  | Submit CE/CS disposition          |
| `/api/ncr/:id/concurrence` | PATCH  | QA Staff concurrence review       |
| `/api/ncr/:id/approve`     | PATCH  | Designated Approver authorization |
| `/api/ncr/:id/close`       | PATCH  | Originator closure and execution  |
| `/api/ncr/:id/audit-log`   | GET    | View complete audit trail         |

See [contracts/](contracts/) directory for detailed request/response schemas.

## Common Development Tasks

### Test NCR Workflow State Transitions

```bash
# Verify javascript-state-machine transitions are correct
npm run unit -- test-unit/ncr-state-machine.test.js --verbose
```

### Test NCR Email Delivery

```bash
# Test email templates with nodemailer mock (no actual email sent)
npm run test:unit -- test-unit/ncr-email.test.js
```

### Test API Endpoints

```bash
# Test NCR API against test database
npm run test:integration -- test-integ/ncr-api.test.js
```

### View Audit Trail for Debugging

```bash
GET /api/ncr/NCR-2026-03-0001/audit-log
Authorization: Bearer {token}
```

Returns all state transitions with user identity, timestamp, and changed fields.

### Search NCRs by Status or Supplier

```bash
GET /api/ncr?status=Dispositioned&supplier=Acme
Authorization: Bearer {token}
```

## Troubleshooting

### Workflow State Stuck or Invalid Transition Attempted

```bash
# Check current NCR state
GET /api/ncr/NCR-2026-03-0001
Authorization: Bearer {token}

# View audit log to see what transitions were attempted
GET /api/ncr/NCR-2026-03-0001/audit-log
Authorization: Bearer {token}
```

Valid state transitions are defined in `lib/ncr-state-machine.js` state machine.

### Email Delivery Issues

```bash
# Review email configuration
npm run config:show | grep EMAIL

# Test with mock (development only)
npm run test:unit -- test-unit/ncr-email.test.js --verbose
```

### MongoDB Schema Issues

```bash
# Verify indexes created
npm run db:verify:ncr

# Reset test database
npm run db:reset:test
```

## Documentation References

- [Full Specification](spec.md) - Complete NCR workflow requirements (771 lines,
  65 FRs)
- [Data Model](data-model.md) - MongoDB schema design with 7 entities
- [API Contracts](contracts/) - Detailed request/response schemas for each
  endpoint
- [Workflow Diagram](NCR-flow.md) - Visual 7-step workflow
- [Implementation Plan](plan.md) - Technical architecture and roadmap

## Useful Links

- [javascript-state-machine Documentation](https://www.npmjs.com/package/javascript-state-machine) - Lightweight FSM library
- [Mongoose Documentation](https://mongoosejs.com/) - MongoDB schema validation
- eTraveler existing patterns: `lib/email.js`, `lib/form.js`, `routes/`

## Next Steps

1. Install javascript-state-machine: `npm install javascript-state-machine`
2. Create NCR files in `lib/`, `model/`, `routes/`, `views/` following existing
   patterns
3. Run tests: `npm run unit -- --grep "ncr"`
4. See TODO section in [PHASE-1-SUMMARY.md](PHASE-1-SUMMARY.md) for
   implementation tasks
