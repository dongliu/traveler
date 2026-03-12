# Implementation Plan: NCR Workflow Management

**Branch**: `001-ncr-workflow` | **Date**: 2026-03-10 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-ncr-workflow/spec.md`

## Summary

Implement a Nonconformance Workflow Management (NCR) system as a new feature module
within the existing eTraveler Express/Node.js application. The system enables
organizations to initiate, disposition, and approve NCRs through a 6-state workflow
engine built with `javascript-state-machine`. The implementation adds MongoDB
collections for NCR data, 8 REST API endpoints, email notification pipelines, Jade
views, and RBAC middleware — all following existing eTraveler patterns.

## Technical Context

**Language/Version**: Node.js 18+, JavaScript (ES6+)
**Primary Dependencies**: Express 4 (existing), Mongoose 5 (existing), Nodemailer 6
(existing), `javascript-state-machine` (new — lightweight FSM library replacing
workflow-es), jade 1.10 (existing)
**Storage**: MongoDB + Mongoose ODM — new collections: `ncrs`, `audit_logs`,
`forwarding_logs`, `preventive_actions`
**Testing**: Mocha + Chai + Sinon (existing); unit tests for state machine and model
validation; integration tests for API endpoints and workflow transitions
**Target Platform**: Linux server (existing Express deployment)
**Project Type**: Web application module (feature added to existing web service)
**Performance Goals**: <2s search response for 10k+ NCRs; email delivery
initiation <2s; dashboard load <1s
**Constraints**: <200ms p95 API response; zero data loss on state transitions;
10+ concurrent users without corruption
**Scale/Scope**: 10k+ NCRs in archive; 50+ concurrent users; 8 API endpoints;
5 Jade views; 6 email notification types

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Implementation |
|-----------|--------|----------------|
| **I. Automated Testing** | ✅ Pass | Unit tests (state machine transitions, model validation) targeting 80%+ coverage; integration tests (API endpoints, email); E2E for critical P1 workflows |
| **II. Code Quality** | ✅ Pass | ESLint/Prettier via existing pre-commit hooks; separation of concerns (model → lib → routes → views); async/await throughout; no deeply nested callbacks |
| **III. Security-First** | ✅ Pass | Input validation on all API routes; RBAC middleware per role (Originator/CE-CS/QA/Approver/Manager); parameterized Mongoose queries; HTML sanitization; no secrets in code |
| **IV. Versioning** | ✅ Pass | Bump 3.2.0 → 3.3.0 for this feature; MongoDB schema migrations tracked in version control |
| **V. Documentation** | ✅ Pass | API contracts in `contracts/`; data model in `data-model.md`; JSDoc for complex state machine and email logic |

**Constitution Check: PASSED** — No violations.

## Project Structure

### Documentation (this feature)

```text
specs/001-ncr-workflow/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── ncr-create.json
│   └── ncr-disposition.json
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
lib/
├── ncr.js                # Core NCR business logic and workflow orchestration
├── ncr-state-machine.js  # javascript-state-machine FSM definition (6 states)
├── ncr-service.js        # NCR CRUD service layer
└── ncr-email.js          # Email notification templates (6 notification types)

model/
├── ncr.js                # Mongoose NCR schema (primary entity)
├── audit-log.js          # Audit log schema (separate collection)
├── forwarding-log.js     # Forwarding log schema (separate collection)
└── preventive-action.js  # Preventive action schema (separate collection)

routes/
└── ncr.js                # NCR API endpoints (8 routes)

views/
├── ncr-create.jade       # NCR creation form
├── ncr-detail.jade       # NCR detail view with audit trail
├── ncr-disposition.jade  # CE/CS disposition form
├── ncr-approval.jade     # QA concurrence and approver form
└── ncr-dashboard.jade    # NCR status dashboard

test-unit/
├── ncr-state-machine.test.js  # FSM transitions, guards, invalid transition handling
├── ncr-model.test.js          # Mongoose schema validation rules
└── ncr-email.test.js          # Email template rendering (nodemailer mocked)

test-integ/
├── ncr-api.test.js            # API endpoint integration tests
└── ncr-workflow.test.js       # End-to-end workflow transition tests
```

**Structure Decision**: Single project using existing eTraveler directory layout.
NCR files slot into existing `lib/`, `model/`, `routes/`, and `views/` directories
alongside current patterns. No new top-level directories needed.

## Complexity Tracking

> No constitution violations. No complexity justification required.
