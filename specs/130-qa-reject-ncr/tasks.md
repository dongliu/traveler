# Tasks: QA Reject with Comments

**Input**: Design documents from `specs/130-qa-reject-ncr/`

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Tests**: Included. Constitution (I. Automated Testing) requires a regression test for every new capability, and `test-unit/lib/ncr-service.test.js` already has direct, heavy coverage of the functions this feature extends alongside (`submitConcurrence`, `closeNcr`, `createNcr` — baseline.txt: 156 passing). `e2e/us3-qa-concurrence-and-approver-coordination.spec.js`'s existing `AS9` scenario asserts today that rejection is *impossible* — it is rewritten, not just extended, since this feature makes that assertion false.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[US1]/[US2]/[US3]**: Map to spec.md's three user stories (QA rejects with comments / Originator-or-Designate updates and resubmits / Everyone affected is notified)
- Paths are repo-root relative.

## Path Conventions

Single Express MVC project at repo root — extends the existing `model/`, `lib/`, `routes/`, `views/`, `test-unit/`, `e2e/`. One new view file (`views/ncr-resubmit.jade`); no new directory, no new dependency.

## Identifiers the tasks share

| Where | Identifier |
|---|---|
| New status (US1) | `'Rejected'` — added to `NCR_STATUSES` (`model/ncr.js`), reachable only from `Dispositioned` |
| New field (US1) | `Ncr.qa_rejection_comments` (String) — the most recent rejection's comment |
| Reused field (US1) | `qa_staff_identity`/`qa_staff_name`/`qa_concurrence_timestamp` — already exist, set by `submitConcurrence`; `rejectConcurrence` sets them too |
| Reused event type (US1) | `'qa.rejected'` — already present in `NCR_EVENT_TYPES` (unused until this feature) |
| New event type (US2) | `'ncr.resubmitted'` — **not** the legacy `'qa.resubmitted'` (research.md D2 — different actor, different status, different meaning) |
| New event type (US3) | `'notification.qa_rejection'` |
| New transitions (`lib/ncr-state-machine.js`) | `reject`: `Dispositioned` → `Rejected` (US1); `resubmit`: `Rejected` → `Submitted` (US2) |
| New service functions (`lib/ncr-service.js`) | `rejectConcurrence(ncrId, comments, user, webBaseUrl)` (US1, notification wired in US3); `resubmitNcr(ncrId, data, user, webBaseUrl)` (US2) |
| New email function (`lib/ncr-email.js`) | `sendQaRejection(ncr, recipients, comments, ncrUrl)` (US3) |
| New endpoints | `PATCH /api/ncrs/:id/concurrence` gains `action: "reject"` (US1); `PATCH /api/ncrs/:id/resubmit` is new (US2) |
| New page route | `GET /ncrs/:id/resubmit` (`routes/ncr-view.js`, US2) → `views/ncr-resubmit.jade` |
| E2E personas (matching `e2e/us3-qa-concurrence-and-approver-coordination.spec.js`'s own convention) | `dong` = primary, QA staff; `bob` (`APPROVER_ID`) = secondary, doubles as Originator Designate in this feature's scenarios (already a real, already-authenticatable identity per `003-originator-designate` research.md Decision 4); `guobao` = Originator/CE-CS context |
| Reused e2e fixtures | `createDispositionedNcr` (this file's own helper), `create-traveler-linked-ncr`, `get-ncr`, `remove-group-member`/`add-group-member` (all already in `e2e/fixtures/` or the spec file itself) |

---

## Phase 1: Setup

**Purpose**: Confirm the pre-change baseline is still current before touching anything.

- [X] T001 With the Docker stack up, re-run the four commands in `specs/130-qa-reject-ncr/baseline.txt` (`TRAVELER_CONFIG_REL_PATH=docker npx mocha test-unit/lib/ncr-service.test.js`; the `ncr-email` unit file; `npm run e2e -- e2e/us3-qa-concurrence-and-approver-coordination.spec.js`; `npm run e2e -- e2e/us-ncr-next-action-visibility.spec.js`). Confirm the same pass counts (156 / 53 / 25 / 6). If any count differs, update `baseline.txt` and note the discrepancy before proceeding.

---

## Phase 2: User Story 1 — QA rejects an NCR with comments instead of concurring (Priority: P1) 🎯 MVP

**Goal**: QA has a third option at the Concurrence decision point — reject with a required comment — which moves the NCR to a new `Rejected` status, visible on the NCR detail page and dashboard, with QA's identity, comment, and timestamp recorded. (Notifying anyone about it is User Story 3; resubmitting out of it is User Story 2 — this story's scope is the decision and the state change alone, matching spec.md's own Acceptance Scenarios.)

**Independent Test**: spec.md User Story 1's own Independent Test.

### Tests for User Story 1 ⚠️

> Write first; confirm they fail before implementing.

- [X] T002 [US1] In `test-unit/lib/ncr-service.test.js`, add a new `describe('lib/ncr-service — rejectConcurrence', () => { ... })` block immediately after the `submitConcurrence` describe block (after line 629, before `submitApproval` at line 631). Reuse the `qaUser`/`stubGroupFindOne`/`stubFindById`/`newNcr`/`expectRejection` helpers already defined above it, exactly as `submitConcurrence`'s own block does. Add: `'throws 403 when user is not QA Staff'` (`expectRejection(rejectConcurrence('id1', 'needs rework', makeUser({ roles: [] })), 403)`); `'throws 404 when NCR not found'`; `'throws 409 when NCR is not Dispositioned'` (stub `newNcr({ status: 'Submitted' })`).
- [X] T003 [US1] In the same new describe block, add `'throws 400 when comments is blank or missing'`: stub `newNcr({ status: 'Dispositioned' })` and `stubGroupFindOne(...)`, then assert `rejectConcurrence('id1', '', qaUser)` and `rejectConcurrence('id1', undefined, qaUser)` both reject with `err.status === 400`.
- [X] T004 [US1] In the same block, add `'transitions to Rejected and records QA's identity, comment, and timestamp'`: stub `newNcr({ status: 'Dispositioned', originator_id: 'orig1' })` and `stubGroupFindOne({ _id: 'ncr-qa', members: [{ _id: 'qa1', name: 'QA Person', email: 'qa@test.com' }] })` (needed once US3's notification lands in T039 — harmless no-op stub until then), call `await rejectConcurrence('id1', 'Description is missing the lot number.', qaUser)`, and assert: `result.status === 'Rejected'`; `result.qa_rejection_comments === 'Description is missing the lot number.'`; `result.qa_staff_identity === 'qa1'`; `result.qa_staff_name === 'QA Person'`; `result.qa_concurrence_timestamp` is set; `result.events.find(e => e.event_type === 'qa.rejected').payload.comments === 'Description is missing the lot number.'`; that same event's `previous_status === 'Dispositioned'` and `new_status === 'Rejected'`.
- [X] T005 [US1] In `test-unit/lib/ncr-service.test.js`'s `getStatusCounts` describe block (line 1435), in the test `'covers every status, including Closed, with no page limit applied to the query'` (line 1436), add `Rejected: 0,` to the expected `result.counts` object (line 1444-1450), between `Dispositioned: 0,` and `'Approval Requested': 0,` — matching `NCR_STATUSES`'s new enum order (data-model.md).
- [X] T006 [US1] In `test-unit/lib/ncr-service.test.js`'s require block (lines 31-51), add `rejectConcurrence` to the destructured imports from `../../lib/ncr-service.js`.
- [X] T007 [P] [US1] In `e2e/us3-qa-concurrence-and-approver-coordination.spec.js`, replace the entire `'// ── AS9: no rejection path (spec/implementation gap) ──'` section (lines 306-322) with real coverage: `'QA rejects a Dispositioned NCR with a required comment, moving it to Rejected status'` (drive the UI: `page.goto('/ncrs/${ncrId}/concurrence')`, fill the new reject-comment field, click the new "Reject with Comments" button; assert the page shows success and, via `get-ncr`, that `ncr.status === 'Rejected'`, `ncr.qa_rejection_comments` matches, and an event with `event_type: 'qa.rejected'` exists); `'rejecting with a blank comment is refused'` (attempt the reject click with the comment field empty; assert the button is disabled or an inline error appears, and via `get-ncr` that `ncr.status` is still `'Dispositioned'`); `'API rejects a reject action from a non-QA user'` (direct `page.request.patch` as a non-QA caller — reuse this file's existing non-QA pattern — asserting `403`); `'API rejects a reject action when the NCR is not Dispositioned'` (construct an `Approval Requested` NCR via the existing fixtures and assert `409`).

### Implementation for User Story 1

- [X] T008 [US1] In `model/ncr.js`'s `NCR_STATUSES` array (lines 98-104), add `'Rejected',` immediately after `'Dispositioned',` (line 100).
- [X] T009 [US1] In `model/ncr.js`'s `NcrSchema` (around line 156), add `qa_rejection_comments: String,` immediately after `qa_concurrence_timestamp: Date,` (line 156), before the `current_approval_round` comment block.
- [X] T010 [US1] In `lib/ncr-state-machine.js`, add `{ name: 'reject', from: 'Dispositioned', to: 'Rejected' },` immediately after the `concurWithApprovers` transition (line 9), before the existing comment about `returnForComment`.
- [X] T011 [US1] In `lib/ncr-service.js`, add a new `rejectConcurrence(ncrId, comments, user, webBaseUrl)` function immediately after `submitConcurrence` (after line 416, before `submitApproval`). Mirror `submitConcurrence`'s structure: `isQaStaffMember` check (403), `Ncr.findById` (404), `fsm.can('reject')` guard — `409` with message `` `NCR must be in 'Dispositioned' status. Current status: ${ncr.status}` `` when not — and a `400` (`err.status = 400`) when `!comments || !comments.trim()`. On success: set `ncr.qa_staff_identity = user.id`, `ncr.qa_staff_name = user.name`, `ncr.qa_concurrence_timestamp = now`, `ncr.qa_rejection_comments = comments`; `fsm.reject(); ncr.status = fsm.state;`; push a `qa.rejected` event (`actor_role: 'qa_staff'`, `previous_status`, `new_status`, `payload: { comments }`); `await ncr.save(); return ncr;`. Do **not** send any notification yet — that is wired in during User Story 3 (T039), to keep this task's test (T004) independent of email stubbing.
- [X] T012 [US1] In `lib/ncr-service.js`'s `module.exports` (lines 1358-1379), add `rejectConcurrence,` immediately after `submitConcurrence,`.
- [X] T013 [US1] In `routes/ncr.js`'s `PATCH /:id/concurrence` handler (lines 412-457), before the existing `additionalApprovers` validation, branch on `req.body.action === 'reject'`: validate `comments = sanitizeStr(req.body.comments)` is non-blank (`400 Validation Error`, `details: { comments: ['Required when action is reject'] }` — same shape `PATCH /:id/approve` already uses for `return_for_comment`, line 471-478), then call `rejectConcurrence(req.params.id, comments, user, webBaseUrl)` and respond `{ success: true, ncr: { ncr_id, ncr_number, status, qa_rejection_comments } }` through the existing `mapServiceError` catch. Leave the existing `additionalApprovers`-based dispatch completely unchanged for requests with no `action` field.
- [X] T014 [US1] In `routes/ncr.js`'s import block (lines 9-29), add `rejectConcurrence,` to the destructured imports from `../lib/ncr-service`.
- [X] T015 [P] [US1] In `views/ncr-concurrence.jade`: add a comment textarea (`#reject-comments`) and a `button#reject-btn.btn.btn-danger` ("Reject with Comments") in the `.form-actions` block (lines 91-93), alongside the existing `#concur-btn`. In `block js` (after the existing `$('#concur-btn').on('click', ...)` handler, lines 162-186), add a `$('#reject-btn').on('click', ...)` handler that `PATCH`es `/api/ncrs/${ncrId}/concurrence` with `{ action: 'reject', comments: $('#reject-comments').val().trim() }`, disabling the button and showing `#conc-error`/`#conc-success` the same way the existing handler does; disable `#reject-btn` whenever `#reject-comments` is blank (mirrors T003's required-comment rule client-side, in addition to the server's own 400).
- [X] T016 [P] [US1] In `views/ncr-detail-body.jade`, immediately after the `Disposition` fieldset (after line 105, before line 107's `if (ncr.additional_approvers...)`), add a new conditional fieldset: `if ncr.status === 'Rejected' && ncr.qa_rejection_comments`, legend "QA Rejection", showing `ncr.qa_rejection_comments`, `ncr.qa_staff_name`, and `ncr.qa_concurrence_timestamp` (formatted like the Disposition fieldset's own timestamp at line 101-102) in a `dl.dl-horizontal`.
- [X] T017 [P] [US1] In `views/ncr-dashboard.jade`: add a `Rejected` status-card `span` (data-status='Rejected', a distinct color such as `#d9534f`) after the `Dispositioned` card (after line 43); add `'Rejected':'#d9534f'` to the `statusBadge` color map (line 142); add `$('.count-Rejected').text(counts['Rejected'] || 0);` to `loadCounts` (after line 200).

**Checkpoint**: User Story 1 is functional and independently testable — QA can reject a `Dispositioned` NCR with a required comment, the NCR visibly becomes `Rejected`, and the comment/identity/timestamp are recorded and displayed. (No one is notified yet — that's Phase 4. The NCR cannot yet be acted on out of `Rejected` — that's Phase 3.)

---

## Phase 3: User Story 2 — The Originator and Originator Designate update and resubmit a rejected NCR (Priority: P2)

**Goal**: From `Rejected` status, the Originator or Originator Designate can edit the NCR's submitted information and resubmit it, returning it to `Submitted` and re-triggering the CE/CS disposition-request email — restarting the review cycle exactly as if the NCR were new.

**Independent Test**: spec.md User Story 2's own Independent Test.

**Depends on**: User Story 1 (an NCR must be able to reach `Rejected` before this story has anything to act on).

### Tests for User Story 2 ⚠️

> Write first; confirm they fail before implementing.

- [X] T018 [US2] In `test-unit/lib/ncr-service.test.js`, add a new `describe('lib/ncr-service — resubmitNcr', () => { ... })` block immediately after the `closeNcr` describe block (after line 1202-ish, before `assignDesignate` at line 1204). Mirror `closeNcr`'s structure: `const originator = makeUser({ id: 'orig1' });`. Add: `'throws 404 when NCR not found'`; `'throws 403 when user is neither the Originator nor the Designate'` (stub `newNcr({ status: 'Rejected', originator_id: 'someoneElse', originator_designate_id: 'someoneElseToo' })`); `'throws 409 when NCR is not Rejected'` (stub `newNcr({ status: 'Dispositioned', originator_id: 'orig1' })`).
- [X] T019 [US2] **Revised during implementation**: `createNcr`'s own describe block has no service-level field-validation tests at all — that validation lives entirely in `routes/ncr.js`'s `POST /` handler (lines 108-144), not in the service function, which trusts its caller. `resubmitNcr` follows the same division of responsibility (route validates shape, service trusts it) rather than duplicating `POST /`'s rules a second time at the service layer — only a genuine business invariant (the 403/409 checks in T018) belongs in the service itself, same distinction `rejectConcurrence`/`returnForComment` already draw between "required comment" (a business rule, validated in both route and service) and pure input-shape rules (route only). This task becomes a no-op at the unit level; the route's reused validation block is covered by T023's e2e success path and the e2e suite's existing creation-validation coverage of the identical rules.
- [X] T020 [US2] In the same block, add `'overwrites the editable fields, transitions to Submitted, and records the resubmission event'`: stub `newNcr({ status: 'Rejected', originator_id: 'orig1', part_name: 'Old Name', ce_cs_id: 'ces1', ce_cs_email: 'ces@test.com' })`, call `await resubmitNcr('id1', minimalNcrData({ part_name: 'Corrected Name' }), originator)`, and assert: `result.status === 'Submitted'`; `result.part_name === 'Corrected Name'`; `result.events.find(e => e.event_type === 'ncr.resubmitted')` exists with `previous_status: 'Rejected'`, `new_status: 'Submitted'`, `actor_role: 'originator'`; `result.ce_cs_id === 'ces1'` (unchanged — CE/CS is not editable here, research.md D6); the disposition-request email was sent (`sendDispositionRequestStub.calledOnce` should be true, mirroring how `createNcr`'s own tests assert this) and `result.events.some(e => e.event_type === 'notification.disposition_request')` is true.
- [X] T021 [US2] In the same block, add `'allows the Designate (not just the Originator) to resubmit'`, mirroring `closeNcr`'s own `'allows the Designate (not just the Originator) to close the NCR'` test (lines 1068-1076) exactly, but calling `resubmitNcr` on a `newNcr({ status: 'Rejected', originator_id: 'orig1', originator_designate_id: 'des1' })` as `makeUser({ id: 'des1' })`.
- [X] T022 [US2] In `test-unit/lib/ncr-service.test.js`'s require block (lines 31-51), add `resubmitNcr` to the destructured imports from `../../lib/ncr-service.js`.
- [X] T023 [P] [US2] In `e2e/us3-qa-concurrence-and-approver-coordination.spec.js`, add a new test (near the rewritten reject scenarios from T007): `'Originator resubmits a Rejected NCR, which returns to Submitted and re-notifies CE/CS'` — create a Dispositioned NCR, reject it via the API (`action: 'reject'`), then drive `/ncrs/${ncrId}/resubmit` as the Originator (`guobao`'s session, or via `page.request.patch` with a corrected field), and assert via `get-ncr` that `status === 'Submitted'` and an event with `event_type: 'notification.disposition_request'` exists dated after the resubmission. Add a second test, `'a user who is neither Originator nor Designate cannot resubmit'`, asserting `403` from a direct `page.request.patch('/api/ncrs/${ncrId}/resubmit', ...)` call as `bob` (not Originator/Designate on that NCR).
- [X] T024 [P] [US2] In `e2e/us-ncr-next-action-visibility.spec.js`: add `await expect(pageHandle.locator('a:has-text("Resubmit")')).toHaveCount(0);` to `expectNoActionButton` (line 43-48); add a new test in the `US2 — button permission-gated` describe block, `'Rejected: only the Originator or their Designate sees Resubmit'`, mirroring `'Final Approval: only the Originator or their Designate sees Close NCR'` (lines 125-136) exactly, but with `createNcrInStatus('Rejected', { originator_id: QA_STAFF_ID, originator_name: 'Dong Liu' })` and asserting `a:has-text("Resubmit")` instead of `"Close NCR"`.

### Implementation for User Story 2

- [X] T025 [US2] In `model/ncr.js`'s `NCR_EVENT_TYPES` array (lines 30-60), add `'ncr.resubmitted',` immediately after `'ncr.submitted',` (line 31) — grouped with the other `ncr.*` lifecycle events, and deliberately not reusing `'qa.resubmitted'` (research.md D2).
- [X] T026 [US2] In `lib/ncr-state-machine.js`, add `{ name: 'resubmit', from: 'Rejected', to: 'Submitted' },` immediately after the new `reject` transition (T010).
- [X] T027 [US2] In `lib/ncr-service.js`, add a new `resubmitNcr(ncrId, data, user, webBaseUrl)` function immediately after `rejectConcurrence` (T011). Mirror `closeNcr`'s permission check (`ncr.originator_id !== user.id && ncr.originator_designate_id !== user.id` → 403) and `createNcr`'s field-overwrite shape (`part_name`, `part_number`, `part_revision`, `quantity`, `supplier_name`, `wbs_number`, `specification_drawing_reference`, `po_reference`, `description_of_nonconformance`, `discovery_date`, `discovery_context` — research.md D6; do **not** touch `ce_cs_*`/`originator_*`/`originator_designate_*`). Guard with `fsm.can('resubmit')` (409 otherwise). On success: overwrite the editable fields from `data`; `fsm.resubmit(); ncr.status = fsm.state;`; push an `ncr.resubmitted` event (`actor_role: 'originator'`, `previous_status: 'Rejected'`, `new_status: 'Submitted'`, `payload: { part_name: ncr.part_name, part_number: ncr.part_number }` — same payload shape `ncr.submitted` already uses); if `ncr.ce_cs_email`, call the existing `sendDispositionRequest(ncr, ncr.ce_cs_email, dispositionUrl, user.email)` (same call `createNcr` already makes) and `appendNotificationEvent(ncr, 'notification.disposition_request', results, cc)`; `await ncr.save(); return ncr;`.
- [X] T028 [US2] In `lib/ncr-service.js`'s `module.exports` (lines 1358-1379), add `resubmitNcr,` immediately after `closeNcr,`.
- [X] T029 [US2] In `routes/ncr.js`, add a new `router.patch('/:id/resubmit', auth.ensureAuthenticated, async (req, res) => { ... })` handler immediately after the `PATCH /:id/concurrence` handler (after T013's change). Validate the request body with the exact same rules `POST /` already uses (lines 108-144 — required `part_name`/`part_number`/`part_revision`/`quantity`/`supplier_name`/`wbs_number`/`description_of_nonconformance`/`discovery_date`/`discovery_context`, plus the `discovery_date` not-in-the-future and `discovery_context` enum checks), reusing the existing `DISCOVERY_CONTEXTS` constant (line 101). On success, call `resubmitNcr` and respond `{ success: true, ncr: { ncr_id, ncr_number, status, previous_status: 'Rejected' }, message: 'NCR resubmitted successfully. CE/CS notified for engineering disposition.' }`; route errors through `mapServiceError`.
- [X] T030 [US2] In `routes/ncr.js`'s import block, add `resubmitNcr,` to the destructured imports from `../lib/ncr-service`.
- [X] T031 [P] [US2] In `routes/ncr-view.js`, add a new `app.get('/ncrs/:id/resubmit', auth.ensureAuthenticated, async function(req, res) { ... })` route (alongside the existing `/ncrs/:id/close`, `/ncrs/:id/disposition` routes). Fetch the NCR; compute `isOriginatorOrDesignate = ncr.originator_id === req.session.userid || ncr.originator_designate_id === req.session.userid` inline (same style as the disposition route's `isAssignedCeCs`, lines 55-67) — do **not** redirect non-authorized users (same convention as the disposition page: render a read-only view for them); render `ncr-resubmit` with `{ ncr, isOriginatorOrDesignate }`.
- [X] T032 [P] [US2] Create `views/ncr-resubmit.jade`, adapted from `views/ncr-create.jade`: same Part Information / Reference Information (minus the CE/CS field and the traveler-link-context block — neither is editable here, research.md D6) / Nonconformance Details fieldsets, pre-filled from `ncr`'s current values; an `if !isOriginatorOrDesignate` warning banner matching `ncr-disposition.jade`'s own (lines 18-24), with the form only rendered `if isOriginatorOrDesignate`; display `ncr.qa_rejection_comments` prominently above the form so the Originator/Designate can see why before editing. Submit via `PATCH /api/ncrs/:id/resubmit` instead of `POST /api/ncrs` (no attachments step, no traveler-ref handling — neither applies here).
- [X] T033 [P] [US2] In `views/ncr-detail-body.jade`: add `var canResubmit = ncr.status === 'Rejected' && (locals.userid === ncr.originator_id || locals.userid === ncr.originator_designate_id)` alongside the existing `canClose` (line 5); add it to the `#ncr-next-action` row's condition (line 256) and add `if canResubmit` rendering `a.btn.btn-warning(href='#{prefix}/ncrs/#{ncr._id}/resubmit') Resubmit` (alongside the existing buttons, lines 259-266).

**Checkpoint**: User Stories 1 AND 2 both work independently — a rejected NCR can be corrected and resubmitted by the right people, restarting the full disposition/concurrence cycle with no manual workaround.

---

## Phase 4: User Story 3 — Everyone affected is notified the moment QA rejects (Priority: P3)

**Goal**: The moment QA rejects, QA staff, the Originator, and the Originator Designate (if assigned) each receive one email containing QA's comment and a link to the NCR.

**Independent Test**: spec.md User Story 3's own Independent Test.

**Depends on**: User Story 1 (`rejectConcurrence` must exist to wire a notification into).

### Tests for User Story 3 ⚠️

> Write first; confirm they fail before implementing.

- [ ] T034 [US3] In `test-unit/lib/ncr-email.test.js`, add a new `describe('lib/ncr-email — sendQaRejection format', () => { ... })` block immediately after the `sendDesignateRemoved format` block (after line 456), mirroring its structure exactly: `'uses the correct subject line'`; `'sends a single email to every recipient on one to: line'` (call with `['qa@test.com', 'orig@test.com', 'des@test.com']` and assert `sendNotificationStub.firstCall.args[0].recipients` equals the comma-joined string); `'body includes the comment and names the part/supplier'`; `'includes an NCR link when ncrUrl is provided'`; `'omits the link when ncrUrl is absent'`.
- [ ] T035 [US3] In `test-unit/lib/ncr-email.test.js`'s require block (lines 18-28), add `sendQaRejection` to the destructured imports from `../../lib/ncr-email.js`.
- [ ] T036 [US3] In `test-unit/lib/ncr-service.test.js`'s `rejectConcurrence` describe block (T002-T004), add: `'sends the rejection notification to QA staff, the Originator, and the Designate when one is assigned'` (stub `newNcr({ status: 'Dispositioned', originator_id: 'orig1', originator_designate_id: 'des1' })`, `stubGroupFindOne(...)`, `stubUserFind([{ _id: 'orig1', ... }, { _id: 'des1', ... }])`; assert `sendQaRejectionStub`'s recipients argument includes the QA, Originator, and Designate emails, and that `result.events.some(e => e.event_type === 'notification.qa_rejection')` is true); `'omits the Designate from the rejection notification when none is assigned'` (same but no `originator_designate_id`; assert the Designate's email is simply absent, not an empty-string entry).
- [ ] T037 [US3] In `test-unit/lib/ncr-service.test.js`'s top-of-file email-module stubs (lines 20-28), add `const sendQaRejectionStub = sinon.stub(ncrEmailModule, 'sendQaRejection').resolves([]);`.
- [ ] T038 [P] [US3] In `e2e/us3-qa-concurrence-and-approver-coordination.spec.js`, add `'rejecting notifies QA staff, the Originator, and the Designate'`: create a Dispositioned NCR whose Originator has a Designate assigned (reuse `bob` as Designate, per this file's own convention of `bob` already being a real, resolvable identity), reject it via the API, and assert via `get-ncr`'s `events` that the `notification.qa_rejection` event's `recipients` includes entries for the QA group member, the Originator, and `bob`, each with `delivery_status: 'Delivered'`. Add a second assertion/test for the no-Designate case, confirming the recipient count is exactly two (QA + Originator).

### Implementation for User Story 3

- [ ] T039 [US3] In `model/ncr.js`'s `NCR_EVENT_TYPES` array, add `'notification.qa_rejection',` immediately after `'notification.qa_notification',` (line 52).
- [ ] T040 [US3] In `lib/ncr-email.js`, add a new `sendQaRejection(ncr, recipients, comments, ncrUrl)` function immediately after `sendDesignateRemoved` (before `module.exports`), mirroring `sendInitialNotification`'s "everyone on one `to:` line" shape (`sendToRecipients`, no separate CC). Subject: `` `Action Required — NCR ${ncr.ncr_number} Rejected by QA` ``. Body includes `comments` verbatim and names the part/supplier, plus the existing `ncrUrl`-conditional link pattern every other `send*` function already uses. Add `sendQaRejection,` to `module.exports`.
- [ ] T041 [US3] In `lib/ncr-service.js`'s import from `./ncr-email` (lines 7-17), add `sendQaRejection,`. In `rejectConcurrence` (T011), after setting `ncr.qa_rejection_comments` and before `await ncr.save()`: resolve recipients via `findQaStaffSafe()` (not `findQaStaff()` — a missing QA-group configuration must not block the rejection itself, matching `closeNcr`'s defensive convention rather than `createNcr`'s up-front one, research.md D3) plus `findUsers([ncr.originator_id, ncr.originator_designate_id].filter(Boolean))`, combine and de-duplicate their emails, call `sendQaRejection(ncr, emails, comments, ncrUrl)`, and `appendNotificationEvent(ncr, 'notification.qa_rejection', results)`.

**Checkpoint**: All three user stories are independently functional — rejection, resubmission, and notification each work and are each regression-tested on their own.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Verification and the checks the constitution requires.

- [ ] T042 Run `npx eslint .` and confirm no new errors.
- [ ] T043 Run `TRAVELER_CONFIG_REL_PATH=docker npm run unit` and confirm the full suite passes (not just `ncr-service.test.js`/`ncr-email.test.js` in isolation).
- [ ] T044 With the Docker stack running, run `npm run e2e -- e2e/us3-qa-concurrence-and-approver-coordination.spec.js` and `npm run e2e -- e2e/us-ncr-next-action-visibility.spec.js` and confirm both pass; spot-check `npm run e2e -- e2e/us-originator-designate.spec.js` and `npm run e2e -- e2e/us1-create-and-submit-ncr.spec.js` for any unexpected regression touching NCR status handling.
- [ ] T045 Walk through `specs/130-qa-reject-ncr/quickstart.md`'s by-hand section manually against the running stack.
- [ ] T046 Add a `CLAUDE.md` "Recent Changes" entry for `130-qa-reject-ncr`, following the format of entries 124-129, explicitly calling out the `PATCH /api/ncrs/:id/resubmit` path reuse (research.md D5 — a different action than the one spec 129 removed, not a revert of that removal).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none — start immediately.
- **User Story 1 (Phase 2)**: needs Setup only. **This is the MVP** — QA can reject, visibly, even before anyone can act on it or is notified.
- **User Story 2 (Phase 3)**: needs User Story 1 (`Rejected` status and the `reject` transition must exist before anything can resubmit out of it).
- **User Story 3 (Phase 4)**: needs User Story 1 (`rejectConcurrence` must exist to wire a notification into); independent of User Story 2.
- **Polish (Phase 5)**: after all three stories.

### Shared-file ordering

| File | Order |
|---|---|
| `model/ncr.js` | T008 → T009 → T025 → T039 |
| `lib/ncr-state-machine.js` | T010 → T026 |
| `lib/ncr-service.js` | T011 → T012 → T027 → T028 → T041 |
| `routes/ncr.js` | T013 → T014 → T029 → T030 |
| `test-unit/lib/ncr-service.test.js` | T002 → T003 → T004 → T005 → T006 → T018 → T019 → T020 → T021 → T022 → T036 → T037 |
| `test-unit/lib/ncr-email.test.js` | T034 → T035 |
| `e2e/us3-qa-concurrence-and-approver-coordination.spec.js` | T007 → T023 → T038 |
| `e2e/us-ncr-next-action-visibility.spec.js` | T024 (only task) |
| `views/ncr-detail-body.jade` | T016 → T033 |
| `views/ncr-concurrence.jade` | T015 (only task) |
| `views/ncr-dashboard.jade` | T017 (only task) |
| `routes/ncr-view.js` | T031 (only task) |
| `views/ncr-resubmit.jade` | T032 (only task — new file) |
| `lib/ncr-email.js` | T040 (only task) |

### Parallel Opportunities

- T015, T016, T017 (three different view files, all within User Story 1) can run together once T008-T014 land.
- T023 and T024 (different e2e files) can run together once their own prerequisites are met.
- T031, T032, T033 (different route/view files, all within User Story 2) can run together once T025-T030 land.
- T038 (e2e) can proceed in parallel with T039-T041 (implementation) being written, though it won't pass until T041 lands — same "write first, confirm it fails" discipline as every other test task here.

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (Setup).
2. Phase 2 (User Story 1) — QA can reject a flawed NCR with a required comment; it becomes visibly `Rejected`. **This alone is a demonstrable, if incomplete, MVP**: the defect (no way to kick a flawed NCR back) is fixed, even though nothing can yet be done with a `Rejected` NCR and no one is yet notified.
3. **Stop and validate** against quickstart.md's by-hand walkthrough steps 1-4 before continuing.

### Incremental Delivery

1. Setup → baseline confirmed.
2. US1 (P1) → test → demo — QA can reject; the NCR visibly changes state.
3. US2 (P2) → test → demo — the loop closes: a rejected NCR can be corrected and sent forward again.
4. US3 (P3) → test → demo — the right people are notified automatically, closing the gap between "visible on the NCR" and "someone actually finds out."
5. Polish (Phase 5) — lint, full unit + e2e suite, quickstart walk-through, changelog.

### Notes

- Confirm each story's tests fail before implementing it.
- Commit after each phase; stop at the Phase 2 checkpoint to validate User Story 1 independently if desired.
- T011 deliberately does not send any notification — T041 (User Story 3) is what wires `sendQaRejection` into `rejectConcurrence`. Do not jump ahead and add the notification call during Phase 2; the phases are split exactly so each story's tests can fail for the right reason before its own implementation lands.
