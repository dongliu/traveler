# Tasks: NCR Workflow Management

**Input**: Design documents from `/specs/001-ncr-workflow/`
**Branch**: `001-ncr-workflow`
**Tech**: Node.js 18+, Express 4, Mongoose 5, Nodemailer 6, javascript-state-machine
**Storage**: 1 collection — `ncrs` (embedded `events[]` + `preventive_actions[]`)

## Format: `[ID] [P?] [Story] Description with file path`

- **[P]**: Can run in parallel with other [P] tasks in the same phase (different files, no shared dependencies)
- **[Story]**: User story this task delivers (maps to spec.md)
- Tests not included (not requested in spec)

---

## Phase 1: Setup

**Purpose**: Install the one new dependency, wire config, and register the NCR router.

- [ ] T001 Install javascript-state-machine: run `npm install javascript-state-machine` and verify it appears in package.json
- [ ] T002 [P] Add NCR env config to `.env` and `.env.example`: `NCR_APPROVAL_TIMEOUT=5d`, `NCR_EMAIL_RETRY_COUNT=3`
- [ ] T003 Register NCR router in the main app file (app.js or server.js): `app.use('/api/ncr', require('./routes/ncr'))`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before any user story begins.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T004 Create `model/ncr.js` with three schemas in this order: (1) `PreventiveActionSchema` — fields: `_id`, `action_description`, `owner_id`, `owner_name`, `owner_email`, `target_completion_date`, `actual_completion_date`, `status` enum `['Open','In Progress','Completed','Overdue']`, `comments:[String]`, `status_history:[{previous_status,new_status,changed_by,changed_timestamp}]`, `created_at`, `updated_at`; (2) `NcrEventSchema` — fields: `_id`, `event_type` enum (all 21 types from data-model.md), `actor_type` enum `['user','system']`, `actor_id`, `actor_name`, `actor_role`, `timestamp` (required), `previous_status`, `new_status`, `payload:Mixed`, `recipients:[{recipient_id,recipient_name,recipient_role,recipient_role_snapshot,recipient_email,delivery_status,delivery_timestamp,error_message}]`; (3) `NcrSchema` with all fields per data-model.md (origination, part info, reference info, status, traveler_link, ce_cs assignment, disposition subdoc, qa_staff fields, additional_approvers[], closure_record subdoc, attachments[], `events:[NcrEventSchema]`, `preventive_actions:[PreventiveActionSchema]`, `created_at`, `updated_at`); export `Ncr` model
- [ ] T005 [P] Create `lib/ncr-state-machine.js`: export `createNcrStateMachine(currentStatus)` factory that returns a `javascript-state-machine` instance initialized to `currentStatus` with 7 transitions: `submitDisposition` (Submitted→Dispositioned), `concurNoApprovers` (Dispositioned→Final Approval), `concurWithApprovers` (Dispositioned→Approved), `returnForComment` (Approved→Returned for Comment), `resubmitToApprovers` (Returned for Comment→Approved), `finalApprove` (Approved→Final Approval), `close` (Final Approval→Closed)
- [ ] T006 [P] Create `lib/ncr-email.js`: export 7 async functions using existing `lib/email.js` nodemailer config — `sendInitialNotification(ncr, recipients)`, `sendDispositionRequest(ncr, cescs)`, `sendQaNotification(ncr, qaStaff)`, `sendApprovalRequest(ncr, approvers)`, `sendIssuance(ncr, originator)`, `sendFinalDistribution(ncr, allRecipientGroups)`, `sendPaAssigned(ncr, pa, owner)`; each function returns an array of `{recipient_id, recipient_email, delivery_status, delivery_timestamp, error_message}` for event recording
- [ ] T007 Create `routes/ncr.js` router skeleton: initialize `express.Router()`, define all 10 route stubs with correct HTTP methods and paths (`POST /`, `GET /`, `GET /:id`, `GET /:id/events`, `PATCH /:id/disposition`, `PATCH /:id/concurrence`, `PATCH /:id/approve`, `PATCH /:id/close`, `PATCH /:id/preventive-actions/:pa_id/owner`, `PATCH /:id/preventive-actions/:pa_id/status`), apply authentication middleware and per-route role-check middleware to each stub; handler bodies are `res.status(501).json({error:'Not implemented'})` placeholders; export router

**Checkpoint**: Model, FSM, email module, and router skeleton all exist. User story implementation can now begin.

---

## Phase 3: User Story 1 + 1.5 + 1.6 — Create NCR and Send Notifications (Priority: P1) 🎯 MVP

**Goal**: NCR Originator submits NCR; system auto-assigns NCR number; initial notification sent to QA/Group Leader/Director; engineering disposition request sent to CE/CS. All 3 notification emails recorded as events.

**Independent Test**: Create an NCR with all required fields → verify: (1) NCR document saved with status Submitted, (2) ncr.events[] contains ncr.submitted + notification.initial + notification.disposition_request events, (3) NCR number assigned per convention, (4) mandatory field validation rejects missing/invalid fields with 400.

- [ ] T008 [US1] Implement `createNcr(data, user)` in `lib/ncr-service.js`: generate NCR number (e.g. `NCR-YYYY-NNNN` sequential counter), create and save NCR document with status `Submitted`, append `ncr.submitted` user event (actor=user, previous_status=null, new_status='Submitted', payload includes ncr_number and part summary), call `sendInitialNotification()` and append `notification.initial` system event with returned delivery results, call `sendDispositionRequest()` and append `notification.disposition_request` system event with CE/CS delivery result; return saved NCR
- [ ] T009 [US1] Implement `POST /` handler in `routes/ncr.js`: validate all mandatory fields from `contracts/ncr-create.json` (part_name, part_number, part_revision, quantity>0, supplier_name, wbs_number, ce_cs_name, specification_drawing_reference, description_of_nonconformance min 20 chars, discovery_date ≤ today, discovery_context enum); call `createNcr()`; return 201 with ncr_number, ncr_id, status, creation_timestamp, originator_id, part_name, part_number per contract
- [ ] T010 [P] [US1] Create `views/ncr-create.jade`: form with all mandatory fields — text inputs for part_name, part_number, part_revision, supplier_name, wbs_number, ce_cs_name, specification_drawing_reference; number input for quantity; textarea for description_of_nonconformance (min 20 chars client hint); date picker for discovery_date; radio group for discovery_context (incoming_inspection / in_house_assembly / in_house_inspection); optional traveler_id and traveler_step_number fields; client-side validation before submit; on success display assigned ncr_number prominently
- [ ] T011 [P] [US1] Create `views/ncr-detail.jade`: display all NCR fields organized by section (Part Info, Reference, Disposition if populated, Approval Status, Closure if populated, Preventive Actions if populated); render event timeline from `ncr.events[]` sorted by timestamp showing event_type badge, actor_name + actor_role, timestamp, and collapsed payload; show status badge with color per status value; action buttons appropriate to current user role and NCR status

**Checkpoint**: NCR creation end-to-end works. Status shows Submitted. Events timeline has 3 entries (ncr.submitted + 2 notifications).

---

## Phase 4: User Story 2 — CE/CS Engineering Disposition (Priority: P1)

**Goal**: CE/CS receives disposition request link, selects parts disposition, documents root cause and preventive actions; NCR transitions to Dispositioned; QA notified.

**Independent Test**: With a Submitted NCR, call PATCH /api/ncr/:id/disposition as CE/CS with valid disposition data → verify: (1) ncr.disposition populated, (2) ncr.preventive_actions[] has one subdoc per preventive action with status Open, (3) status=Dispositioned, (4) disposition.submitted event + notification.qa_notification event in ncr.events[].

- [ ] T012 [US2] Implement `submitDisposition(ncrId, data, user)` in `lib/ncr-service.js`: verify user is assigned CE/CS or delegate for this NCR; call `createNcrStateMachine(ncr.status)` and assert `fsm.can('submitDisposition')`; populate `ncr.disposition` (parts_disposition, root_cause_documentation, rework_repair_instructions if Rework/Repair, ce_cs_identity=user._id, ce_cs_timestamp=now); populate `ncr.preventive_actions[]` — create one `PreventiveAction` subdocument per entry in `data.preventive_actions` with `action_description` and `status='Open'` and `created_at=now`; call `fsm.submitDisposition()`, set `ncr.status = fsm.state`; append `disposition.submitted` user event (payload: parts_disposition, root_cause excerpt, preventive_action count); call `sendQaNotification()` and append `notification.qa_notification` system event; save NCR
- [ ] T013 [US2] Implement `PATCH /:id/disposition` handler in `routes/ncr.js`: validate per `contracts/ncr-disposition.json` — parts_disposition required and in enum, root_cause_documentation min 50 chars, preventive_actions array min 1 item each min 50 chars, rework_repair_instructions required and min 50 chars only when parts_disposition is Rework or Repair; call `submitDisposition()`; return 200 with updated ncr (status, disposition, previous_status) per contract
- [ ] T014 [P] [US2] Create `views/ncr-disposition.jade`: show read-only NCR header (part info, nonconformance description); disposition form with — radio buttons for parts_disposition (5 options); textarea for root_cause_documentation; dynamic add/remove list for preventive_actions (each a textarea); rework_repair_instructions textarea visible only when Rework or Repair selected; client-side validation; submit button labeled "Submit Disposition"
- [ ] T015 [P] [US2] Update `views/ncr-detail.jade` to render disposition section when `ncr.disposition` is populated (parts_disposition, root_cause, rework/repair instructions if present) and preventive actions list showing each subdocument's action_description and status badge

**Checkpoint**: Disposition submitted end-to-end. NCR in Dispositioned status. Events timeline has 5 entries total (3 from creation + 2 from disposition).

---

## Phase 5: User Story 3 — QA Concurrence and Approver Coordination (Priority: P1)

**Goal**: QA reviews disposition, optionally designates additional approvers, gives concurrence; if no approvers → Final Approval + Issuance email; if approvers → Approved + approval requests sent; approvers can Approve or Return for Comment; comment loops resolve back through QA resubmit.

**Independent Test**: (A) QA concurs with no extra approvers → status=Final Approval, notification.issuance event recorded. (B) QA concurs with 1 approver → status=Approved, notification.approval_request event; approver approves → Final Approval + issuance. (C) Approver returns for comment → status=Returned for Comment; QA resubmits → back to Approved.

- [ ] T016 [US3] Implement `submitConcurrence(ncrId, additionalApprovers, user)` in `lib/ncr-service.js`: verify user has QA Staff role; assert `ncr.status === 'Dispositioned'`; save `qa_staff_identity`, `qa_staff_name`, `qa_concurrence_timestamp`; if `additionalApprovers` is empty: call `fsm.concurNoApprovers()`, append `qa.concurred` event (new_status='Final Approval'), call `sendIssuance()`, append `notification.issuance` system event; if `additionalApprovers` non-empty: set `ncr.additional_approvers[]` with Pending status entries, call `fsm.concurWithApprovers()`, append `qa.concurred` event (new_status='Approved'), call `sendApprovalRequest()`, append `notification.approval_request` system event; save NCR
- [ ] T017 [US3] Implement `submitApproval(ncrId, approverId, user)` in `lib/ncr-service.js`: verify user is a designated approver for this NCR; mark that approver's `additional_approvers` entry as Approved with approval_timestamp; append `approval.approved` user event; if all additional_approvers are Approved: call `fsm.finalApprove()`, set `ncr.status = 'Final Approval'`, call `sendIssuance()`, append `notification.issuance` event; save NCR
- [ ] T018 [US3] Implement `returnForComment(ncrId, comments, user)` in `lib/ncr-service.js`: verify user is a designated approver; mark that approver's entry as Returned for Comment with comments; call `fsm.returnForComment()`, set `ncr.status = 'Returned for Comment'`; append `approval.returned_for_comment` user event (payload: comments, approver identity); call `sendQaNotification()` with returned-for-comment context; save NCR
- [ ] T019 [US3] Implement `qaResubmit(ncrId, user)` in `lib/ncr-service.js`: verify user has QA Staff role and NCR status is Returned for Comment; reset all Returned-for-Comment approvers back to Pending; call `fsm.resubmitToApprovers()`; append `qa.resubmitted` user event; call `sendApprovalRequest()` and append `notification.approval_request` event; save NCR
- [ ] T020 [US3] Implement route handlers in `routes/ncr.js`: `PATCH /:id/concurrence` — validate additionalApprovers is array (may be empty), call `submitConcurrence()`; `PATCH /:id/approve` — read `action` field ('approve' or 'return_for_comment') plus optional `comments`, route to `submitApproval()` or `returnForComment()`; add `PATCH /:id/resubmit` QA-only route calling `qaResubmit()`; return 200 with updated ncr status on each
- [ ] T021 [P] [US3] Create `views/ncr-concurrence.jade`: full read-only NCR with disposition and preventive actions sections; approver designation area — search/add users by name with role label, remove button per entry; already-designated approvers list; Concur button; text explaining direct Final Approval path vs. additional approver path
- [ ] T022 [P] [US3] Create `views/ncr-approval.jade`: read-only NCR with disposition and QA concurrence summary; Approve button; Return for Comment button with required comments textarea; show all approvers and their statuses; for Returned-for-Comment status (QA view) show Resubmit to Approvers button

**Checkpoint**: Full P1 approval workflow functional. Final Approval reachable via both paths. Issuance email sent and recorded. All events in timeline.

---

## Phase 6: User Story 5 + 6 — NCR Closure and Final Distribution (Priority: P2)

**Goal**: Originator executes disposition and marks NCR Closed; system sends final distribution to all 5 stakeholder groups; closed NCRs excluded from active dashboard by default.

**Independent Test**: With a Final Approval NCR, call PATCH /api/ncr/:id/close as Originator with closure_notes → verify: (1) status=Closed, (2) closure_record populated, (3) ncr.closed event recorded, (4) notification.final_distribution event recorded with recipients from all 5 groups.

- [ ] T023 [US5] Implement `closeNcr(ncrId, data, user)` in `lib/ncr-service.js`: verify user is NCR Originator or delegate; call `createNcrStateMachine(ncr.status)` and assert `fsm.can('close')`; validate closure_notes min 20 chars; for traveler-initiated NCRs verify `data.traveler_signed_off === true`; populate `ncr.closure_record` (closed_by, closed_by_name, closure_date, closure_notes, closure_timestamp, disposition_execution_verified, preventive_actions_verified); call `fsm.close()`, set `ncr.status = 'Closed'`; append `ncr.closed` user event; build all-recipient list from Originator + CE/CS + QA Staff + additional_approvers + PA owners + Group Leader + Director/PM + PPM (if supplier_name indicates supplier issue); call `sendFinalDistribution()` and append `notification.final_distribution` system event with full recipients array; save NCR
- [ ] T024 [US5] Implement `PATCH /:id/close` handler in `routes/ncr.js`: validate closure_notes required; for NCRs where `traveler_link.initiated_from_traveler=true` require `traveler_signed_off=true`; call `closeNcr()`; return 200 with updated ncr (status, closure_record, ncr_number)
- [ ] T025 [P] [US5] Create `views/ncr-close.jade`: read-only approved disposition details and corrective actions; closure_notes textarea with min-20-char hint; disposition_execution_verified and preventive_actions_verified checkboxes; for traveler-initiated NCRs show Traveler sign-off section with electronic confirmation; Close NCR submit button

**Checkpoint**: Full lifecycle (submit→disposition→concurrence→approval→close) works end-to-end. Final distribution sent to all stakeholders.

---

## Phase 7: User Story 4 + 6 — Dashboard, Reporting, and Archive (Priority: P2)

**Goal**: Quality Managers see open NCR counts by status, aging, can filter/search across all NCR fields; closed NCRs excluded by default but searchable via toggle.

**Independent Test**: GET /api/ncr → only non-Closed NCRs returned by default; GET /api/ncr?includeClosed=true → Closed NCRs included; GET /api/ncr?status=Dispositioned&part_number=BA-1234 → filtered results; each NCR includes days_elapsed; 30+-day NCRs flagged.

- [ ] T026 [US4] Implement `listNcrs(filters, user)` in `lib/ncr-service.js`: build role-filtered base query (Originators see own NCRs, CE/CS sees NCRs where ce_cs_id matches, QA sees all Dispositioned+, Managers see all); apply optional filters: status, part_number, supplier_name, from_date/to_date on discovery_date, parts_disposition (query ncr.disposition.parts_disposition), root_cause keyword ($regex on ncr.disposition.root_cause_documentation); exclude Closed by default unless `filters.includeClosed === true`; project with calculated `days_elapsed = Math.floor((Date.now() - ncr.created_at) / 86400000)`; return paginated results with total count
- [ ] T027 [US4] Implement `GET /` and `GET /:id` handlers in `routes/ncr.js`: GET / — accept query params (status, part_number, supplier_name, from_date, to_date, parts_disposition, root_cause, includeClosed, page=1, limit=50), call `listNcrs()`, return `{ncrs:[], total, page, limit}`; GET /:id — return full NCR document including events[] and preventive_actions[]
- [ ] T028 [P] [US4] Create `views/ncr-dashboard.jade`: status count summary row — one badge per status (Submitted / Dispositioned / Approved / Returned for Comment / Final Approval / Closed) with clickable filter; NCR list table with columns (NCR#, Part#, Supplier, Status badge, Days Elapsed, CE/CS, Originator, actions); highlight rows where days_elapsed ≥ 30 with "Escalation Needed" label in red; filter bar (status dropdown, part_number input, supplier_name input, from/to date pickers, parts_disposition dropdown); Include Closed toggle (off by default); pagination controls; each row links to ncr-detail

**Checkpoint**: Dashboard shows live NCR status counts. Filtering, search, and aging report functional. Closed NCRs hidden by default, accessible via toggle.

---

## Phase 8: User Story 7 — Preventive Action Tracking (Priority: P2)

**Goal**: QA Staff designates owners for preventive action subdocuments with target dates; PA owners update status and add comments; QA closes PAs; assignment notifications sent.

**Independent Test**: With a Dispositioned NCR containing preventive_actions[], PATCH owner assignment → pa.owner_assigned event + notification.pa_assigned recorded; PATCH status update → pa.status_updated event; PATCH close → pa.closed event; all reflected in ncr-detail view.

- [ ] T029 [US7] Implement `assignPaOwner(ncrId, paId, ownerData, user)` in `lib/ncr-service.js`: find preventive_action subdocument by `_id` matching paId; update `owner_id`, `owner_name`, `owner_email`, `target_completion_date`, `updated_at`; append `pa.owner_assigned` user event (payload: paId, owner_name, target_completion_date); call `sendPaAssigned(ncr, pa, owner)` from `lib/ncr-email.js`; append `notification.pa_assigned` system event; save NCR using `findOneAndUpdate` with array filter `{'preventive_actions._id': paId}`
- [ ] T030 [US7] Implement `updatePaStatus(ncrId, paId, data, user)` and `closePa(ncrId, paId, user)` in `lib/ncr-service.js`: updatePaStatus — validate `data.status` is valid enum value; push `{previous_status, new_status, changed_by:user._id, changed_timestamp:now}` to `status_history`; update `status`, optionally push to `comments`; append `pa.status_updated` event; closePa — set `status='Completed'`, `actual_completion_date=now`, push to status_history; append `pa.closed` event; save NCR using array filter on pa._id for each
- [ ] T031 [US7] Implement `PATCH /:id/preventive-actions/:pa_id/owner` and `PATCH /:id/preventive-actions/:pa_id/status` handlers in `routes/ncr.js`: owner route — validate owner_id, owner_name, owner_email, target_completion_date all required; status route — validate `action` field ('update'|'close'), new_status required for 'update'; update `views/ncr-detail.jade` preventive actions section to show per-PA: action_description, current status badge, owner name + target date (or "Unassigned"), comments list, "Assign Owner" button (QA Staff only), status update form (PA owner only), "Close PA" button (QA Staff only)

**Checkpoint**: All 7 user stories fully functional. Complete NCR lifecycle testable end-to-end including PA tracking.

---

## Phase 9: Polish and Cross-Cutting Concerns

**Purpose**: Indexes, audit trail endpoint, input hardening, lint/test pass, quickstart update.

- [ ] T032 Add MongoDB indexes to `model/ncr.js` using Mongoose schema `.index()` calls on `NcrSchema`: `{ncr_number: 1}` unique, `{status: 1}`, `{discovery_date: 1}`, `{part_number: 1}`, `{supplier_name: 1}`, `{created_at: 1}`, `{'disposition.parts_disposition': 1}`, `{'events.event_type': 1}`, `{'events.timestamp': 1}`, `{'preventive_actions.status': 1}`, `{'preventive_actions.owner_id': 1}`
- [ ] T033 [P] Implement `GET /:id/events` handler in `routes/ncr.js`: return `ncr.events[]` sorted by timestamp ascending; update `views/ncr-detail.jade` to add a collapsible Events Timeline tab rendering each event with: event_type label, actor_name (role), timestamp, and expandable raw payload block
- [ ] T034 [P] Harden input validation across all handlers in `routes/ncr.js`: trim all string inputs, strip HTML tags (use a simple regex or sanitizer), validate MongoDB ObjectId format for `:id` and `:pa_id` path params before querying, reject request bodies with unrecognized fields, ensure all error responses follow `{success:false, error:string, message:string}` contract shape
- [ ] T035 Run `npm test && npm run lint`; fix all reported test failures and lint errors across `lib/ncr*.js`, `model/ncr.js`, `routes/ncr.js`, `views/ncr-*.jade`
- [ ] T036 [P] Update `specs/001-ncr-workflow/quickstart.md`: correct project structure section (single `model/ncr.js` file, remove audit-log.js / forwarding-log.js / disposition.js / approval.js); correct DB setup section (no separate collections to initialize; indexes created by Mongoose on startup); add all new API endpoints to endpoints table (concurrence, approve, close, PA owner/status, events); update audit trail example to use `GET /api/ncr/:id/events` endpoint

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US1+1.5+1.6 (Phase 3)**: Depends on Phase 2
- **US2 (Phase 4)**: Depends on Phase 3 (NCR must exist in Submitted status)
- **US3 (Phase 5)**: Depends on Phase 4 (NCR must be in Dispositioned status)
- **US5+6 (Phase 6)**: Depends on Phase 5 (NCR must reach Final Approval)
- **US4+6 archive (Phase 7)**: Depends on Phase 2; can start in parallel with Phases 3–6 if seeded test data is used
- **US7 (Phase 8)**: Depends on Phase 4 (preventive_actions[] populated by disposition)
- **Polish (Phase 9)**: Depends on all user story phases

### User Story Dependencies

| Story | Can Start After | Depends On |
|---|---|---|
| US1/1.5/1.6 (Phase 3) | Phase 2 | None |
| US2 (Phase 4) | Phase 3 | US1 creates the NCR |
| US3 (Phase 5) | Phase 4 | US2 transitions to Dispositioned |
| US5+6 (Phase 6) | Phase 5 | US3 reaches Final Approval |
| US4 (Phase 7) | Phase 2 | None (use seeded data) |
| US7 (Phase 8) | Phase 4 | US2 populates preventive_actions[] |

### Within Each Phase

- Models (T004) → FSM (T005) + Email (T006) in parallel → Router skeleton (T007)
- Service functions before route handlers (routes import services)
- Route handlers and views are independent (can parallelize within a story)
- [P] tasks within the same phase target different files and can run simultaneously

---

## Parallel Opportunities Per Phase

```
Phase 2:  T005 ║ T006  (after T004)  →  T007
Phase 3:  T008+T009  ║  T010 ║ T011
Phase 4:  T012+T013  ║  T014 ║ T015
Phase 5:  T016→T017→T018→T019→T020  ║  T021 ║ T022
Phase 6:  T023+T024  ║  T025
Phase 7:  T026+T027  ║  T028
Phase 8:  T029+T030+T031 (sequential — same service file)
Phase 9:  T033 ║ T034 ║ T036  (after T032)  →  T035
```

---

## Implementation Strategy

### MVP (Phase 1 + 2 + 3 + 4 only — US1 through US2)

1. Phase 1: Setup
2. Phase 2: Foundational ⚠️ required before everything
3. Phase 3: Create NCR + notifications
4. Phase 4: CE/CS disposition
5. **STOP and VALIDATE**: Create NCR → submit disposition → verify Dispositioned status, all 5 events in timeline, preventive_actions[] populated
6. Deploy/demo MVP

### Incremental Delivery

| Milestone | Phases | Deliverable |
|---|---|---|
| Foundation | 1+2 | Infrastructure ready |
| P1-Core | +3 | NCR creation + notifications |
| P1-Disposition | +4 | CE/CS disposition cycle |
| P1-Complete | +5 | Full QA/approver workflow |
| P2-Closure | +6 | Issuance, execution, archive |
| P2-Reports | +7 | Dashboard and reporting |
| P2-PA | +8 | Preventive action tracking |
| Hardened | +9 | Production-ready |

---

## Notes

- All `lib/ncr-service.js` functions must use `findOneAndUpdate` with `{new:true, runValidators:true}` for atomic state transitions
- Never `delete` or `findByIdAndUpdate` on events — only `$push` to `ncr.events`
- FSM instances are transient: create with `createNcrStateMachine(ncr.status)`, call transition, persist `fsm.state` to `ncr.status`, discard FSM
- Email send failures must NOT block NCR state transitions — catch errors, log them, and record `delivery_status:'Failed'` in the notification event's `recipients[]`
- Role checks: verify `req.user.role` in route middleware; additionally verify identity-specific authorization (e.g., is this user the assigned ce_cs_id?) in service layer, not routes
- Preventive action subdocument updates must use MongoDB array filters (`arrayFilters: [{'pa._id': paId}]`) to avoid overwriting other PAs
