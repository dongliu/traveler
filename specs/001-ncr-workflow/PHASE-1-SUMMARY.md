# Phase 1 Planning Summary: NCR Workflow Management

**Date Completed**: March 10, 2026 **Branch**: `001-ncr-workflow`
**Specification**: Complete (771 lines, 65 FRs, 9 user stories, single-collection schema)
**Planning Status**: ✅ COMPLETE

---

## Artifacts Generated

### Specification & Validation

- ✅ **spec.md** (771 lines) - Complete functional specification with 9 user stories (US1/1.5/1.6/2/3/4/5/6/7), 65 FRs, 13 success criteria
- ✅ **requirements.md** - Quality checklist with all items validated
- ✅ **NCR-flow.md** - Visual flowchart describing 7-step workflow

### Planning Documents (Phase 1)

- ✅ **plan.md** - Implementation plan with technical context, constitution check, source structure, and key architectural decisions (event sourcing, PA subdocuments, FSM, RBAC)
- ✅ **data-model.md** - Single-collection schema: PreventiveActionSchema + NcrEventSchema + NcrSchema; event type enum (21 types); collection design with indexes
- ✅ **quickstart.md** - Development setup guide with API endpoints table (11 routes), event sourcing examples, PA tracking examples, and troubleshooting
- ✅ **research.md** - 7 design decisions: FSM library, RBAC, state machine design, email strategy, event sourcing, PA subdocuments, concurrent access

### API Contracts (Phase 1)

- ✅ **contracts/ncr-create.json** (218 lines) - POST /api/ncr contract with
  request/response schemas
- ✅ **contracts/ncr-disposition.json** (187 lines) - PATCH
  /api/ncr/:id/disposition contract

### Agent Context

- ✅ **CLAUDE.md** - Updated with javascript-state-machine, Mongoose 5, Express 4, Nodemailer 6; single-collection storage noted

---

## Technology Stack Finalized

### Core Technologies

- **Language**: Node.js 18+, JavaScript (ES6+)
- **Workflow Engine**: javascript-state-machine (lightweight FSM library)
- **Database**: MongoDB + Mongoose ODM (single `ncrs` collection with embedded events, PAs, disposition, approvals)
- **Email Notifications**: email.js (SMTP-based email delivery)
- **Web Framework**: Express (existing)
- **View Engine**: Jade/Pug (existing)
- **Testing**: Jest/Mocha with nodemailer mock

### Architecture

- **State Machine**: 6 states (Submitted → Dispositioned → Approved → Returned
  for Comment → Final Approval → Closed)
- **Workflow Steps**: 7 (Origination → Initial Notification → Eng Disposition
  Request → QA Concurrence → Approval → Issuance → Final Distribution)
- **Database Collections**: 1 (`ncrs` — all data embedded: `events[]`, `preventive_actions[]`, `disposition`, `additional_approvers[]`, `closure_record`)
- **API Endpoints**: 11 (POST create, GET list, GET detail, GET events, PATCH disposition, PATCH concurrence, PATCH approve, PATCH resubmit, PATCH close, PATCH PA owner, PATCH PA status)

---

## Constitution Check: PASSED ✅

All constitution principles are applicable and will be enforced:

| Principle                | Status        | Implementation                                                                                                          |
| ------------------------ | ------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **I. Automated Testing** | ✅ Required   | Unit tests (state machine, models), Integration tests (API, email), E2E tests (critical workflows). Target: 80%+ coverage |
| **II. Code Quality**     | ✅ Required   | ESLint/Prettier enforced, Separation of concerns (models → logic → routes → views), Async/await, Code review required   |
| **III. Security-First**  | ✅ Required   | Input validation, Role-based access control, Parameterized queries, No secrets in code, HTML sanitization               |
| **IV. Versioning**       | ✅ Applicable | Semantic versioning, Database schema migrations, API versioning                                                         |
| **V. Documentation**     | ✅ Required   | API docs, Data model, Workflow diagrams, Email templates, Deployment guide                                              |

---

## Scope & Deliverables

### In Scope (MVP - Iteration 1-5)

**Foundation (Iteration 1)**:

- [ ] Single `model/ncr.js` with PreventiveActionSchema + NcrEventSchema + NcrSchema
- [ ] `lib/ncr-state-machine.js` FSM factory (7 transitions)
- [ ] `lib/ncr-email.js` with 7 notification functions
- [ ] `routes/ncr.js` router skeleton (10 route stubs)

**Core Workflow (Iteration 2)**:

- [ ] 11 API endpoints across `routes/ncr.js`
- [ ] 7 email notification functions with event recording
- [ ] Event sourcing: all actions + notifications appended to `ncr.events[]`
- [ ] Preventive actions as embedded subdocuments in `ncr.preventive_actions[]`

**UI & Access Control (Iteration 3)**:

- [ ] 7 Jade views: ncr-create, ncr-detail (with event timeline), ncr-disposition, ncr-concurrence, ncr-approval, ncr-close, ncr-dashboard
- [ ] Role-based access control middleware per route
- [ ] Event timeline tab in ncr-detail (via GET /:id/events)

**Admin & Reporting (Iteration 4)**:

- [ ] NCR search and filtering (status, part_number, supplier, date range, disposition type)
- [ ] Management dashboard with status count badges and aging (30+ day escalation flag)
- [ ] Preventive action owner assignment, status tracking, and closure via PA subdocument routes
- [ ] `includeClosed` toggle for historical archive access

**eTraveler Integration (Iteration 5)**:

- [ ] NCR launch from Traveler
- [ ] Context capture and auto-population
- [ ] Electronic sign-off capability
- [ ] NCR copy attachment to Traveler

### Out of Scope (Post-MVP)

- Mobile app (Phase 2+)
- Advanced analytics/ML-based root cause suggestions
- Multi-language support (Phase 2+)
- Third-party integrations (ERP, MES)
- API webhooks and plugins
- Custom workflow builder UI

---

## Performance & Quality Targets

| Metric                     | Target                  | Rationale                                       |
| -------------------------- | ----------------------- | ----------------------------------------------- |
| **Email Delivery Latency** | <2 seconds              | Users expect notifications within workflow step |
| **Dashboard Load Time**    | <1 second for 10k+ NCRs | Managers need rapid visibility                  |
| **Concurrent NCRs**        | 100+ active             | Support 50+ users with 2 NCRs/user concurrent   |
| **Code Coverage**          | 80%+ new code           | Constitution requirement for quality            |
| **User Satisfaction**      | 80%+ post-deployment    | Measure via survey                              |
| **Data Loss**              | 0% during transitions   | ACID compliance mandatory                       |
| **Approval Timeout**       | 5 business days         | Organization requirement for escalation         |

---

## Success Metrics (SC-001 to SC-013)

✅ All 13 success criteria from specification are testable and measurable:

1. NCR creation under 5 minutes
2. 100% uptime and data persistence
3. Workflow transitions with zero data loss
4. Sub-2-second search for 10k+ NCRs
5. Complete audit trail with timestamps
6. 95% dispositioning within 5 business days
7. Dashboard reports in <1 minute
8. Unauthorized access prevention
9. Returned/rejected NCR resubmission without data loss
10. Concurrent access by 10+ users without corruption
11. Real-time NCR dashboard updates
12. Auto-distribution within 2 minutes of closure
13. 80%+ UI satisfaction in post-deployment survey

---

## Known Clarifications & Decisions

| Item                        | Decision                              | Rationale                                                                       |
| --------------------------- | ------------------------------------- | ------------------------------------------------------------------------------- |
| **NCR Visibility**          | **Decided: Option C (role-filtered)** | Originators see own NCRs; CE/CS sees awaiting-disposition; QA sees all Dispositioned+; Managers see all |
| **Approver Loop Limit**     | Unlimited returns for comment in spec | Should implement max 3 returns before escalation to manager                     |
| **eTraveler Sign-off**      | Electronic sign-off closes NCR        | Need to define signature capture method (e-signature vs checkbox)               |
| **Email Retry Strategy**    | 3 retries on failure                  | Implement exponential backoff (1s, 2s, 4s) with dead letter queue               |
| **Preventive Action Aging** | Open >30 days highlighted             | Implement alert when overdue and notification to owner                          |

---

## Handoff to Implementation

### Next Steps (Development Phase - `/speckit.tasks`)

1. **Task breakdown generated** → See [tasks.md](tasks.md) — 36 tasks across 9 phases
2. **Implement Foundation (Phase 1+2)**:
   - Install `javascript-state-machine`; register router in app.js
   - Create `model/ncr.js` (3 schemas), `lib/ncr-state-machine.js`, `lib/ncr-email.js`, `routes/ncr.js` skeleton
3. **Implement Core Workflow (Phases 3–6)**:
   - Phase 3: NCR creation + 3 notification events (MVP start)
   - Phase 4: CE/CS disposition + PA subdoc creation
   - Phase 5: QA concurrence + approver loop
   - Phase 6: Closure + final distribution

### Prerequisites for Developers

- Read [spec.md](spec.md) for complete requirements
- Review [data-model.md](data-model.md) for schema design
- Test endpoints using [contracts/](contracts/) examples
- Follow [quickstart.md](quickstart.md) for setup
- Ensure 80%+ code coverage before PR

### Code Review Checklist

- [ ] All specification requirements implemented
- [ ] 80%+ code coverage on new code
- [ ] Unit tests passing for business logic
- [ ] Integration tests passing for workflows
- [ ] Email templates tested with nodemailer mock
- [ ] Role-based access control enforced
- [ ] No credentials/secrets in code
- [ ] ESLint/Prettier compliant
- [ ] Event sourcing: all transitions and notifications appended to `ncr.events[]`
- [ ] Complete documentation in code comments

---

## Reference Materials

| Document                       | Purpose                                              |
| ------------------------------ | ---------------------------------------------------- |
| [spec.md](spec.md)             | Complete feature specification (9 stories, 65 FRs)  |
| [plan.md](plan.md)             | Technical context, architecture, source structure    |
| [research.md](research.md)     | 7 design decisions (FSM, event sourcing, PA, RBAC…) |
| [data-model.md](data-model.md) | Single-collection schema, event types, indexes       |
| [quickstart.md](quickstart.md) | Setup guide, all 11 API routes, code examples        |
| [contracts/](contracts/)       | ncr-create.json + ncr-disposition.json               |
| [tasks.md](tasks.md)           | 36 implementation tasks across 9 phases              |

---

## Sign-Off

- **Specification Status**: ✅ APPROVED (65 FRs, 9 user stories, 13 success criteria)
- **Planning Status**: ✅ APPROVED (Technical context, data model, API
  contracts, roadmap)
- **Constitution Check**: ✅ PASSED (All 5 principles applicable)
- **Ready for Implementation**: ✅ YES

**Branch**: `001-ncr-workflow` **Date**: March 11, 2026 **Next Phase**:
Development — see [tasks.md](tasks.md) (36 tasks, MVP = Phases 1–4)

---

## Questions or Clarifications?

Before starting implementation:

1. Verify email service credentials and SMTP configuration in `.env`
2. Confirm approver loop limit behavior (spec allows unlimited returns; tasks.md implements as-is)
3. Confirm eTraveler electronic sign-off UX (checkbox vs e-signature) before implementing T025

**Task breakdown is complete — start with T001 in [tasks.md](tasks.md).**
