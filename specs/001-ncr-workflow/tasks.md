# Tasks: NCR Workflow Management

**Feature**: `001-ncr-workflow` | **Generated**: 2026-03-11
**Input**: Design documents from `/specs/001-ncr-workflow/`
**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅ | quickstart.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US1.5, US1.6, US2, US3, US4, US5, US6, US7)
- Exact file paths included in every description

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install the single new dependency, add environment configuration, and wire NCR routes into the existing Express app.

- [ ] T001 Install javascript-state-machine npm package (`npm install javascript-state-machine`) and verify it appears in package.json dependencies
- [ ] T002 Add NCR environment variables to `.env` file: `NCR_APPROVAL_TIMEOUT=5d` and `NCR_EMAIL_RETRY_COUNT=3`
- [ ] T003 Register NCR router in main Express app entry point (e.g., `app.js` or `routes/index.js`): `app.use('/api/ncr', require('./routes/ncr'))`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented — FSM factory, RBAC middleware, and database indexes.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T004 Implement `createNcrStateMachine(currentStatus)` factory function in `lib/ncr-state-machine.js` using `javascript-state-machine`: define all 7 transitions (submitDisposition, concurNoApprovers, concurWithApprovers, returnForComment, resubmitToApprovers, finalApprove, close) exactly as specified in `research.md`
- [ ] T005 [P] Create `lib/ncr-middleware.js` with `requireNcrRole(...roles)` Express middleware: extract user role from session/token, return 403 if role not in allowed list, attach `req.currentUser` with `{ id, name, role }` for downstream handlers
- [ ] T006 [P] Create `lib/ncr-db-init.js` with `initNcrIndexes()` function: create compound indexes for `audit_logs` (`ncr_id + timestamp`), `forwarding_logs` (`ncr_id + forwarding_type + forwarding_timestamp`), `preventive_actions` (`ncr_id + status`), and unique index on `ncrs.ncr_number`
- [ ] T007 Add `"db:init:ncr": "node lib/ncr-db-init.js"` npm script to `package.json`
- [ ] T008 [P] Create `test-unit/ncr-state-machine.test.js`: test all 7 FSM transitions succeed from correct source states, `fsm.can()` returns false for invalid transitions (e.g., cannot `close` from `Submitted`), and `fsm.state` reflects new state after each valid transition

**Checkpoint**: FSM, RBAC middleware, and DB indexes ready — user story implementation can begin in parallel.

---

## Phase 3: User Story 1 — Create and Submit NCR (Priority: P1) 🎯 MVP

**Goal**: NCR Originators can create a complete NCR with all required part/supplier/WBS information, the system auto-generates a unique NCR number, transitions status to "Submitted", and stores the record with a full audit trail.

**Independent Test**: Create an NCR via `POST /api/ncr` with all mandatory fields (Part Name, Number, Revision, Quantity, Supplier, WBS, CE/CS, Description ≥ 20 chars, Discovery Date ≤ today, Discovery Context); verify 201 response with `ncr_number` and `status: "Submitted"`; call `GET /api/ncr/:id` and confirm all fields persisted; attempt submit with missing field and verify 400 with field-level error details.

- [ ] T009 [P] [US1] Create Mongoose NCR schema in `model/ncr.js`: define all fields from `data-model.md` (ncr_number unique index, originator fields, part info, reference info, status enum `["Submitted","Dispositioned","Approved","Returned for Comment","Final Approval","Closed"]`, traveler_link, ce_cs fields, disposition subdocument, additional_approvers array, closure_record subdocument, attachments array, created_at/updated_at); add validation rules from `data-model.md` (description ≥ 20 chars, quantity > 0, discovery_date ≤ today); add indexes on status, discovery_date, part_number, supplier_name
- [ ] T010 [P] [US1] Create Mongoose AuditLog schema in `model/audit-log.js`: fields `ncr_id` (ObjectId ref), `action_type` (String enum: "Created", "Disposition Submitted", "Concurrence", "Approved", "Returned for Comment", "Final Approval", "Closed"), `user_identity` (ObjectId), `user_name`, `user_role`, `timestamp`, `previous_state` (Object), `new_state` (Object), `changed_fields` ([String]), `comments`; compound index on `(ncr_id, timestamp)`
- [ ] T011 [P] [US1] Create Mongoose ForwardingLog schema in `model/forwarding-log.js`: fields `ncr_id` (ObjectId ref), `forwarding_type` (enum: "Initial Notification", "Engineering Disposition Request", "QA Concurrence", "Approval Request", "Issuance", "Final Distribution"), `recipients` array (recipient_id, name, role, email, notification_timestamp, delivery_status enum ["Pending","Delivered","Failed","Bounced"], delivery_timestamp, error_message, recipient_role_at_time), `forwarding_timestamp`, `attachments_sent`, `email_template_used`; compound index on `(ncr_id, forwarding_type)`
- [ ] T012 [US1] Implement `generateNcrNumber()` and `createNcr(data, user)` in `lib/ncr-service.js` (depends on T009, T010): `generateNcrNumber()` produces unique NCR number per org convention (e.g., `NCR-YYYY-MM-NNNN` with atomic counter); `createNcr` uses `createNcrStateMachine('Submitted')` to initialize state, saves NCR document to `ncrs` collection, creates AuditLog entry with action_type "Created", user identity, and full new_state snapshot
- [ ] T013 [US1] Implement NCR creation orchestration in `lib/ncr.js`: export `createNcr(requestData, user)` that calls `lib/ncr-service.js` `createNcr`, handles Traveler context capture (set `traveler_link.traveler_id`, `step_number`, `initiated_from_traveler: true` when `traveler_id` in request), and returns created NCR document; handle and propagate service errors
- [ ] T014 [US1] Implement `POST /api/ncr` route handler in `routes/ncr.js`: apply `requireNcrRole('Originator')` middleware, validate all required fields from `contracts/ncr-create.json` (return 400 with per-field error details on failure), call `lib/ncr.js createNcr`, return 201 with `{ success: true, ncr: { ncr_number, ncr_id, status, creation_timestamp, originator_id, part_name, part_number }, message }` as specified in contract
- [ ] T015 [US1] Implement `GET /api/ncr/:id` route handler in `routes/ncr.js`: apply authentication check, implement role-filtered view per `research.md` (Originator sees own NCRs, CE/CS sees assigned NCRs, QA Staff sees all dispositioned, Managers see all), populate and return full NCR document including embedded disposition, additional_approvers, closure_record; return 404 if not found
- [ ] T016 [P] [US1] Create NCR creation form view in `views/ncr-create.jade`: form with all mandatory fields (Part Name, Part Number, Part Revision, Quantity, Supplier Name, WBS Number, CE/CS Name, Specification/Drawing Reference, Description of Nonconformance ≥ 20 chars, Discovery Date, Discovery Context radio buttons for 3 options); optional Traveler fields (traveler_id, traveler_step_number) shown conditionally; client-side validation error display; form submits to `POST /api/ncr`
- [ ] T017 [P] [US1] Create NCR detail view in `views/ncr-detail.jade`: display all NCR fields with status badge, part/supplier/WBS info section, description section, CE/CS assignment display, disposition details (when present), QA/approver info (when present), closure record (when present), audit trail list; render action buttons based on current status and user role (e.g., "Submit Disposition" for CE/CS when Submitted)
- [ ] T018 [P] [US1] Create `test-unit/ncr-model.test.js`: test Mongoose schema validation for NCR model — required field enforcement, description minimum 20 chars, quantity must be > 0, discovery_date cannot be in future, status must match enum, ncr_number uniqueness constraint; test AuditLog and ForwardingLog schema creation

**Checkpoint**: US1 fully functional — can create, store, and retrieve NCRs independently.

---

## Phase 4: User Story 1.5 & 1.6 — Initial Notification & Engineering Disposition Request (Priority: P1)

**Goal**: Upon NCR submission, the system automatically sends two emails: (1) INITIAL NOTIFICATION to QA Staff, Group Leader, and Division Director; (2) ENGINEERING DISPOSITION REQUEST to the designated CE/CS with link to complete NCR. Both are logged in ForwardingLog.

**Independent Test**: Submit an NCR and verify: (1) `sendInitialNotification` is called with correct recipients (QA Staff, Group Leader, Division Director); (2) `sendDispositionRequest` is called with CE/CS email; (3) ForwardingLog documents created for all recipients with `delivery_status: "Pending"`.

- [ ] T019 [P] [US1.5] Implement `sendInitialNotification(ncr, recipients)` in `lib/ncr-email.js`: use existing `lib/email.js` nodemailer transport; compose email with NCR summary (Part Name, Number, Quantity, Supplier, WBS, Description of Nonconformance) and a direct link to `GET /api/ncr/:id`; send to Cognizant QA Staff, Group Leader, and Division Director/PM; return delivery results per recipient
- [ ] T020 [P] [US1.6] Implement `sendDispositionRequest(ncr, cecs)` in `lib/ncr-email.js`: compose engineering disposition request email with full NCR details and direct link; send to designated CE/CS (or delegate if set); return delivery result
- [ ] T021 [US1.5] [US1.6] Implement `createForwardingLogEntries(ncrId, forwardingType, recipients, deliveryResults)` in `lib/ncr-service.js`: create ForwardingLog document with all recipient entries, mapping delivery results to `delivery_status` ("Delivered" or "Failed"), `delivery_timestamp`, `recipient_role_at_time` captured at time of send
- [ ] T022 [US1.5] [US1.6] Integrate notifications into `lib/ncr.js createNcr` workflow: after NCR document is saved, call `sendInitialNotification` then `sendDispositionRequest`; call `createForwardingLogEntries` for both notification types; email failures are logged but do not fail the NCR creation response
- [ ] T023 [P] [US1.5] Extend `test-unit/ncr-email.test.js` with tests for `sendInitialNotification` and `sendDispositionRequest`: mock nodemailer transport, verify correct recipient lists, verify email subject/body contains NCR summary data, verify NCR link is present in body

**Checkpoint**: US1.5 and US1.6 fully functional — notifications fire on every NCR creation.

---

## Phase 5: User Story 2 — CE/CS Engineering Disposition (Priority: P1)

**Goal**: The assigned CE/CS can access the NCR and submit engineering disposition — selecting parts disposition option, documenting root cause (≥ 50 chars), specifying preventive actions (≥ 1 entry, each ≥ 50 chars), and (if Rework/Repair) providing rework instructions (≥ 50 chars). NCR transitions to "Dispositioned". QA Staff is notified.

**Independent Test**: Call `PATCH /api/ncr/:id/disposition` with valid CE/CS credentials and full disposition payload; verify 200 with `status: "Dispositioned"` and disposition data in response; attempt without `rework_repair_instructions` when disposition is "Rework" and verify 400; attempt from non-CE/CS user and verify 403; attempt on already-Dispositioned NCR and verify 409.

- [ ] T024 [US2] Implement `submitDisposition(ncrId, dispositionData, user)` in `lib/ncr-service.js`: load NCR, create FSM via `createNcrStateMachine(ncr.status)`, call `fsm.can('submitDisposition')` (throw 409 if false), validate `rework_repair_instructions` required when parts_disposition is "Rework" or "Repair", use `findOneAndUpdate` with `{ _id: ncrId, status: 'Submitted', __v: ncr.__v }` for optimistic concurrency, set `ncr.disposition` fields, set `ncr.status = 'Dispositioned'`, create AuditLog entry with "Disposition Submitted", changed_fields, previous/new state
- [ ] T025 [US2] Implement `PATCH /api/ncr/:id/disposition` route handler in `routes/ncr.js`: apply `requireNcrRole('CE/CS', 'Delegate')` middleware and verify `req.currentUser.id` matches `ncr.ce_cs_id` or `ncr.ce_cs_delegate_id` (403 otherwise); validate request body per `contracts/ncr-disposition.json`; call `lib/ncr-service.js submitDisposition`; return 200 with disposition response shape from contract; return 409 on FSM conflict, 404 on not found
- [ ] T026 [US2] Implement `sendQAConcurrenceNotification(ncr, qaStaff)` in `lib/ncr-email.js`: compose notification email informing QA Staff that CE/CS has completed disposition and NCR is ready for concurrence review; include NCR summary and link
- [ ] T027 [US2] Integrate QA concurrence notification into `lib/ncr.js`: add `submitDisposition(ncrId, data, user)` orchestration function that calls service `submitDisposition`, then calls `sendQAConcurrenceNotification`, then `createForwardingLogEntries` for QA Staff recipient
- [ ] T028 [US2] Create NCR disposition form view in `views/ncr-disposition.jade`: checkbox group for 5 parts disposition options (Rework, Repair, Return to Vendor, Scrap, Use-As-Is); textarea for Root Cause of Problem (min 50 chars counter); dynamic list for preventive actions (add/remove entries, each min 50 chars); conditional Rework/Repair Instructions textarea (shown and required when Rework or Repair selected); client-side validation before submit; form submits to `PATCH /api/ncr/:id/disposition`

**Checkpoint**: US2 fully functional — CE/CS can complete disposition, NCR transitions to Dispositioned.

---

## Phase 6: User Story 3 — QA Concurrence and Approver Coordination (Priority: P1)

**Goal**: QA Staff reviews the disposition, optionally designates additional approvers, and records concurrence. If no additional approvers: NCR transitions to "Final Approval". If additional approvers: NCR transitions to "Approved" and each approver receives notification. Designated approvers can approve (→ Final Approval when all done) or return for comment (→ Returned for Comment). QA Staff resolves comments and resubmits.

**Independent Test**: Call `PATCH /api/ncr/:id/concurrence` with QA Staff credentials and no additional approvers; verify NCR transitions to "Final Approval". Repeat with additional approvers; verify NCR transitions to "Approved". Call `PATCH /api/ncr/:id/approve` with return-for-comment; verify NCR transitions to "Returned for Comment". Resubmit; verify transitions back to "Approved". Final approver approves; verify "Final Approval".

- [ ] T029 [US3] Implement `submitConcurrence(ncrId, concurrenceData, user)` in `lib/ncr-service.js`: load NCR, FSM transition via `concurNoApprovers` (if `additional_approvers` empty → "Final Approval") or `concurWithApprovers` (if approvers provided → "Approved"), use optimistic `findOneAndUpdate`, set `qa_staff_identity`, `qa_staff_name`, `qa_concurrence_timestamp`, `additional_approvers` list with `approval_status: "Pending"`, create AuditLog entry
- [ ] T030 [US3] Implement `PATCH /api/ncr/:id/concurrence` route handler in `routes/ncr.js`: apply `requireNcrRole('QA Staff')` middleware; validate request body (optional `additional_approvers` array with `approver_id`, `approver_name`, `approver_role`); call `lib/ncr.js submitConcurrence` orchestration; return updated NCR status
- [ ] T031 [US3] Implement `submitApproval(ncrId, approverId, approvalData)` in `lib/ncr-service.js`: find approver entry in `ncr.additional_approvers` by `approverId`, set `approval_status: "Approved"`, `approval_timestamp`; if all approvers have `approval_status: "Approved"`, apply FSM `finalApprove` transition and update NCR status to "Final Approval"; create AuditLog entry
- [ ] T032 [US3] Implement `returnForComment(ncrId, approverId, comments)` in `lib/ncr-service.js`: find approver entry, set `approval_status: "Returned for Comment"`, `comments`; apply FSM `returnForComment` transition → "Returned for Comment"; create AuditLog entry with `comments` and returning approver identity
- [ ] T033 [US3] Implement `resubmitToApprovers(ncrId, user)` in `lib/ncr-service.js`: apply FSM `resubmitToApprovers` transition → "Approved", reset pending approvers `approval_status` back to "Pending" for those who returned for comment, create AuditLog entry
- [ ] T034 [US3] Implement `PATCH /api/ncr/:id/approve` route handler in `routes/ncr.js`: apply `requireNcrRole('Approver')` middleware and verify `req.currentUser.id` is in `ncr.additional_approvers`; accept body `{ action: "approve" | "return_for_comment", comments? }`; route to `submitApproval` or `returnForComment` in `lib/ncr.js`; return updated NCR
- [ ] T035 [US3] Implement `sendApprovalRequest(ncr, approvers)` in `lib/ncr-email.js`: compose approval request email to each designated approver with NCR summary, CE/CS disposition, QA concurrence details, and link to NCR; return per-approver delivery results
- [ ] T036 [US3] Integrate approval emails into `lib/ncr.js submitConcurrence` orchestration: when `concurWithApprovers`, call `sendApprovalRequest` for all designated approvers and `createForwardingLogEntries` with type "Approval Request"; when `concurNoApprovers`, no additional emails sent
- [ ] T037 [US3] Create NCR approval view in `views/ncr-approval.jade`: QA Staff section — full NCR + disposition display, optional additional approvers designation form (add by name/role), "Concurrence" submit button; Designated Approver section — full NCR/disposition/QA concurrence display, "Approve" button and "Return for Comment" button with required comments textarea; conditionally render correct section based on user role and NCR status

**Checkpoint**: US3 fully functional — complete QA concurrence and approver coordination workflow operational.

---

## Phase 7: User Story 4 — Track and Report on Nonconformances (Priority: P2)

**Goal**: Quality Managers can view an NCR dashboard showing counts by status, aging NCRs, and filter/search NCRs by part number, supplier, date range, status, and disposition type. Closed NCRs are excluded from active views by default. Audit trail is accessible per NCR.

**Independent Test**: With multiple NCRs in various states, call `GET /api/ncr?status=Submitted` and verify only Submitted NCRs returned. Call `GET /api/ncr` without filter and verify Closed NCRs excluded. Call `GET /api/ncr?include_closed=true` and verify Closed NCRs included. Call `GET /api/ncr/:id/audit-log` and verify all state transitions returned ordered by timestamp. Dashboard view loads and shows correct counts.

- [ ] T038 [P] [US4] Implement `searchNcrs(filters, user)` in `lib/ncr-service.js`: build Mongoose query from filters (status, part_number, supplier_name, date range on discovery_date/created_at, parts_disposition, include_closed boolean); apply role-filtered view per `research.md` (Originator sees `originator_id == user.id`, CE/CS sees `ce_cs_id == user.id`, QA Staff sees Dispositioned+, Manager sees all); exclude Closed by default when `include_closed` not set; use lean() for performance; ensure <2s response on 10k+ NCR collection via existing indexes
- [ ] T039 [US4] Implement `GET /api/ncr` list route handler in `routes/ncr.js`: apply authentication middleware; parse query params (status, part_number, supplier_name, date_from, date_to, parts_disposition, include_closed, page, limit); call `searchNcrs`; return paginated NCR list with total count; include aging flag (>30 days since submission) on each NCR in response
- [ ] T040 [US4] Implement `GET /api/ncr/:id/audit-log` route handler in `routes/ncr.js`: apply authentication middleware; query `audit_logs` collection for all entries where `ncr_id` matches, ordered by `timestamp` ascending; return array of audit entries with user_name, action_type, timestamp, changed_fields, comments
- [ ] T041 [US4] Create NCR dashboard view in `views/ncr-dashboard.jade`: status count cards (Submitted, Dispositioned, Approved, Returned for Comment, Final Approval, Closed totals); aging alerts section for NCRs >30 days open (highlighted "Escalation Needed"); search/filter form with fields for Part Number, Supplier, Date Range, Status, Disposition Type; NCR list table with status badges and days-in-workflow column; "Include Closed" toggle; pagination controls

**Checkpoint**: US4 fully functional — dashboard and reporting operational.

---

## Phase 8: User Story 5 — NCR Issuance and Execution (Priority: P2)

**Goal**: When NCR reaches "Final Approval", the system sends an NCR ISSUANCE email to the Originator with link and full disposition details. The Originator marks the NCR as "Closed" with required closure notes. Traveler-initiated NCRs support electronic sign-off.

**Independent Test**: Advance NCR to "Final Approval" status; verify `sendIssuanceEmail` fires. Call `PATCH /api/ncr/:id/close` with valid closure notes; verify NCR transitions to "Closed" with closure_record. Attempt close without notes and verify 400. Attempt close on non-"Final Approval" NCR and verify 409.

- [ ] T042 [US5] Implement `sendIssuanceEmail(ncr, originator)` in `lib/ncr-email.js`: compose NCR ISSUANCE email to NCR Originator (or designee if `ce_cs_delegate_id`) requesting execution of authorized disposition; include complete approved disposition details (parts_disposition, root_cause, preventive_actions, rework_repair_instructions), QA concurrence, approver identities, and link to NCR; return delivery result
- [ ] T043 [US5] Integrate issuance email into `lib/ncr.js`: add `finalizeApproval(ncrId, user)` orchestration that is called when `submitApproval` transitions NCR to "Final Approval" — call `sendIssuanceEmail` and `createForwardingLogEntries` with type "Issuance"
- [ ] T044 [US5] Implement `closeNcr(ncrId, closureData, user)` in `lib/ncr-service.js`: load NCR, verify `status == "Final Approval"` (throw 409 otherwise), validate `closure_notes` ≥ 20 chars, create FSM via `createNcrStateMachine('Final Approval')`, apply `close` transition, use `findOneAndUpdate` with optimistic concurrency to set `closure_record` (closed_by, closed_by_name, closure_date, closure_notes, closure_timestamp, disposition_execution_verified: true), update `status` to "Closed"; handle Traveler sign-off path (when `ncr.traveler_link.initiated_from_traveler`, validate Traveler sign-off flag in request); create AuditLog entry
- [ ] T045 [US5] Implement `PATCH /api/ncr/:id/close` route handler in `routes/ncr.js`: apply `requireNcrRole('Originator', 'Delegate')` middleware and verify requester is NCR originator or delegate; validate `{ closure_notes, traveler_signoff? }` body; call `lib/ncr.js closeNcr` orchestration; return updated NCR with closure_record

**Checkpoint**: US5 fully functional — issuance and closure workflow operational.

---

## Phase 9: User Story 6 — Final NCR Distribution and Closure Archive (Priority: P2)

**Goal**: When NCR closes, the system automatically sends FINAL NCR DISTRIBUTION email to all 5 stakeholder groups. Closed NCRs are removed from active dashboard but remain fully searchable in archive with complete history.

**Independent Test**: Close an NCR; verify `sendFinalDistribution` fires to all 5 recipient groups. Verify `GET /api/ncr` (no filter) does not include the closed NCR. Verify `GET /api/ncr?include_closed=true` does include it with full history. Verify ForwardingLog entry created for "Final Distribution".

- [ ] T046 [US6] Implement `sendFinalDistribution(ncr)` in `lib/ncr-email.js`: compose FINAL NCR DISTRIBUTION email with complete closed NCR history and link; send to all 5 groups — (1) Originator/Designee + CE/CS + QA Staff, (2) Preventive Action Owner (if any PreventiveAction docs exist for this NCR), (3) Additional Approvers (if `ncr.additional_approvers` non-empty), (4) Cognizant Group Leader and Division Director, (5) PPM/Supply Management only when `ncr.supplier_name` indicates supplier issue; return per-recipient delivery results
- [ ] T047 [US6] Integrate final distribution into `lib/ncr.js closeNcr` orchestration: after NCR `status` transitions to "Closed", call `sendFinalDistribution`, call `createForwardingLogEntries` with type "Final Distribution", update `ncr.closure_record.distribution_notification_timestamp`
- [ ] T048 [US6] Update `searchNcrs` in `lib/ncr-service.js` to enforce closed NCR exclusion by default: add `status: { $ne: 'Closed' }` filter when `include_closed` is not `true`; verify `GET /api/ncr?include_closed=true` returns complete NCR history with closure_record and all embedded data for archive queries

**Checkpoint**: US6 fully functional — final distribution and archive operational.

---

## Phase 10: User Story 7 — Preventive Action Tracking and Management (Priority: P2)

**Goal**: When CE/CS specifies preventive actions during disposition, the system creates PreventiveAction records. QA Staff designates an owner and target completion date. Owners receive notification and can update status through completion. QA Staff tracks all open preventive actions.

**Independent Test**: Submit disposition with 2 preventive actions; verify 2 PreventiveAction documents created linked to NCR. Assign an owner; verify `sendPreventiveActionNotification` fires. Update status to "In Progress"; verify status_history entry created. Mark "Completed"; verify QA Staff receives completion notification.

- [ ] T049 [P] [US7] Create Mongoose PreventiveAction schema in `model/preventive-action.js`: fields `ncr_id` (ObjectId ref ncrs), `disposition_id` (ObjectId), `action_description` (String, required), `owner_id` (ObjectId), `owner_name` (String), `owner_email` (String), `target_completion_date` (Date), `actual_completion_date` (Date), `status` (enum: "Open", "In Progress", "Completed", "Overdue"), `status_history` ([{previous_status, new_status, changed_by ObjectId, changed_timestamp}]), `comments` ([String]), `created_at`, `updated_at`; compound index on `(ncr_id, status)`, index on `owner_id`
- [ ] T050 [US7] Implement `createPreventiveActions(ncrId, dispositionId, preventiveActionsArray)` in `lib/ncr-service.js`: create one PreventiveAction document per entry in `preventive_actions` array from disposition submission, set `status: "Open"`, link `ncr_id` and `disposition_id`; return created documents
- [ ] T051 [US7] Implement `assignPreventiveActionOwner(actionId, ownerData, user)` in `lib/ncr-service.js`: verify caller has QA Staff role, update `owner_id`, `owner_name`, `owner_email`, `target_completion_date`; add status_history entry; return updated PreventiveAction
- [ ] T052 [US7] Implement `updatePreventiveActionStatus(actionId, newStatus, user)` in `lib/ncr-service.js`: validate status transition (Open → In Progress → Completed), set `actual_completion_date` when Completed, add status_history entry with `changed_by` and `changed_timestamp`; if Completed, trigger notification to QA Staff; return updated PreventiveAction
- [ ] T053 [US7] Implement `sendPreventiveActionNotification(action, ncr)` in `lib/ncr-email.js`: compose assignment notification email to designated owner with action description, target completion date, and link to NCR; return delivery result
- [ ] T054 [US7] Integrate preventive action creation into `lib/ncr.js submitDisposition` orchestration: after NCR transitions to "Dispositioned", call `createPreventiveActions` for each entry in `dispositionData.preventive_actions`; these records are available for QA Staff to assign owners when they access the disposition review

**Checkpoint**: US7 fully functional — preventive action lifecycle tracking operational.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Finalize integration tests, version bump, JSDoc, and validation against quickstart.md.

- [ ] T055 [P] Bump app version `3.2.0` → `3.3.0` in `package.json`
- [ ] T056 [P] Add JSDoc comments to `lib/ncr-state-machine.js` (document each transition name, from/to states, and guard usage) and `lib/ncr-email.js` (document each notification function's recipient logic and template variables)
- [ ] T057 [P] Create `test-integ/ncr-api.test.js`: integration tests for all 8 API endpoints against test MongoDB — `POST /api/ncr` (201 + audit log created), `GET /api/ncr/:id` (200 + role-filtered access), `PATCH /api/ncr/:id/disposition` (200 + status transition), `PATCH /api/ncr/:id/concurrence` (200 + FSM branches), `PATCH /api/ncr/:id/approve` (200 + final approval logic), `PATCH /api/ncr/:id/close` (200 + closure record), `GET /api/ncr` (200 + filters), `GET /api/ncr/:id/audit-log` (200 + ordered entries)
- [ ] T058 [P] Create `test-integ/ncr-workflow.test.js`: end-to-end workflow test that walks through complete NCR lifecycle — create (Submitted) → disposition (Dispositioned) → concurrence with approvers (Approved) → return for comment (Returned for Comment) → resubmit (Approved) → approve (Final Approval) → close (Closed); verify status at each step, audit log entries count, and ForwardingLog entries created
- [ ] T059 Run `npm test && npm run lint` to confirm all 5 test files pass and no ESLint violations; fix any lint or test failures

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — **BLOCKS all user stories**
- **US1 (Phase 3)**: Depends on Phase 2 completion — no dependency on other user stories
- **US1.5 + US1.6 (Phase 4)**: Depends on Phase 3 (US1) completion — extends NCR creation
- **US2 (Phase 5)**: Depends on Phase 2 + Phase 3 models — can start once T009-T011 complete
- **US3 (Phase 6)**: Depends on Phase 5 (US2) completion
- **US4 (Phase 7)**: Depends on Phase 2 + Phase 3 — can run parallel to US2/US3
- **US5 (Phase 8)**: Depends on Phase 6 (US3) — requires Final Approval state
- **US6 (Phase 9)**: Depends on Phase 8 (US5) — triggered by NCR closure
- **US7 (Phase 10)**: Depends on Phase 5 (US2) — preventive actions created during disposition
- **Polish (Phase 11)**: Depends on all user story phases complete

### User Story Dependencies

```
Phase 2 (Foundational)
  ├── Phase 3: US1 (NCR Create & Submit)
  │     └── Phase 4: US1.5 + US1.6 (Notifications) → extends Phase 3
  ├── Phase 5: US2 (Disposition)       → depends on Phase 3 models T009-T011
  │     └── Phase 6: US3 (QA/Approvers) → depends on Phase 5
  │           └── Phase 8: US5 (Issuance/Closure) → depends on Phase 6
  │                 └── Phase 9: US6 (Final Distribution) → depends on Phase 8
  ├── Phase 7: US4 (Reporting)         → depends on Phase 3 only; parallel with US2/US3
  └── Phase 10: US7 (Preventive Actions) → depends on Phase 5
```

### Parallel Opportunities Within Each Story

- **Phase 2**: T005, T006, T008 can run in parallel after T004
- **Phase 3**: T009, T010, T011, T016, T017, T018 can run in parallel; T012 depends on T009-T011
- **Phase 4**: T019, T020, T023 can run in parallel; T022 depends on T019-T021
- **Phase 7**: T038 can run in parallel with T040 (different files)
- **Phase 11**: T055, T056, T057, T058 all run in parallel

---

## Parallel Execution Examples

```bash
# Phase 2 — after T004 completes:
Task: "T005 — Create requireNcrRole middleware in lib/ncr-middleware.js"
Task: "T006 — Create ncr-db-init.js with MongoDB index setup"
Task: "T008 — Create test-unit/ncr-state-machine.test.js"

# Phase 3 — all models and views launch together:
Task: "T009 — Create NCR Mongoose schema in model/ncr.js"
Task: "T010 — Create AuditLog schema in model/audit-log.js"
Task: "T011 — Create ForwardingLog schema in model/forwarding-log.js"
Task: "T016 — Create views/ncr-create.jade"
Task: "T017 — Create views/ncr-detail.jade"
Task: "T018 — Create test-unit/ncr-model.test.js"

# Phase 4 — email templates launch together:
Task: "T019 — Implement sendInitialNotification in lib/ncr-email.js"
Task: "T020 — Implement sendDispositionRequest in lib/ncr-email.js"
Task: "T023 — Create test-unit/ncr-email.test.js"

# Phase 11 — all polish tasks together:
Task: "T055 — Bump version in package.json"
Task: "T056 — Add JSDoc to state machine and email"
Task: "T057 — Create test-integ/ncr-api.test.js"
Task: "T058 — Create test-integ/ncr-workflow.test.js"
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: US1 (Create & Submit NCR)
4. **STOP and VALIDATE**: Create NCR, retrieve it, verify audit trail
5. Deploy/demo US1 independently

### Incremental Delivery

1. Phases 1–2 → Foundation ready
2. Phase 3 (US1) → NCR creation works → Demo/Deploy
3. Phase 4 (US1.5+US1.6) → Notifications fire → Demo
4. Phase 5 (US2) → CE/CS disposition works → Demo
5. Phase 6 (US3) → QA approval workflow works → Demo
6. Phase 7 (US4) → Dashboard and reporting → Demo
7. Phases 8–9 (US5+US6) → Issuance, closure, final distribution → Demo
8. Phase 10 (US7) → Preventive action tracking → Demo
9. Phase 11 → Polish, integration tests, version bump → Production ready

### Parallel Team Strategy

With multiple developers after Phase 2 completes:
- Developer A: Phase 3 (US1 models + service) → Phase 4 (notifications)
- Developer B: Phase 5 (US2 disposition) → Phase 6 (US3 QA/approvers)
- Developer C: Phase 7 (US4 reporting/dashboard) → Phase 10 (US7 preventive actions)

---

## Notes

- **[P]** tasks operate on different files — no write conflicts
- **[US#]** label maps each task to its user story for traceability
- No test tasks use TDD style; test files listed in `plan.md` project structure are created alongside implementation
- Closed NCRs are never deleted — archive with `include_closed=true` filter
- Optimistic concurrency (`__v` + `findOneAndUpdate` with status filter) applied to all state transitions
- Email failures log to ForwardingLog with `delivery_status: "Failed"` but do NOT block workflow transitions
- Role-filtered view enforced at service layer per `research.md` decision (Option C)
- Stop at any checkpoint to validate user story independently before proceeding to next
