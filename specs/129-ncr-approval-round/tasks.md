# Tasks: NCR Approval Rounds

**Input**: Design documents from `specs/129-ncr-approval-round/`

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Tests**: Included. Constitution (I. Automated Testing) requires a regression test for every bug fix, and `test-unit/lib/ncr-service.test.js` already has direct, heavy coverage of every function this feature changes or removes (baseline.txt: 158 passing). Several of those existing tests assert the exact buggy behavior being fixed — they are rewritten, not just extended.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[US1]/[US2]/[US3]**: Map to spec.md's three user stories (Return-for-Comment → Dispositioned / Fresh decisions per round / Round history on the timeline)
- Paths are repo-root relative.

## Path Conventions

Single Express MVC project at repo root — extends the existing `model/`, `lib/`, `routes/`, `views/`, `test-unit/`, `e2e/`. No new directory, no new dependency.

## Identifiers the tasks share

| Where | Identifier |
|---|---|
| New schema field (US2) | `Ncr.current_approval_round` (Number) — set/incremented only in `submitConcurrence` when designating ≥1 approver |
| New schema field (US3) | `events[].round` (Number) — stamped on every approval-round-scoped event |
| Removed status (US1) | `'Returned for Comment'` dropped from `NCR_STATUSES` (`model/ncr.js`) and `POST_DISPOSITION_STATUSES` (`lib/ncr-service.js`); **kept** in `additional_approvers[].approval_status`'s enum — the approver's own decision value is unaffected |
| Deleted (US1) | `qaResubmit` (`lib/ncr-service.js`), `PATCH /:id/resubmit` (`routes/ncr.js`), `resubmitToApprovers`/`unblock` transitions (`lib/ncr-state-machine.js`), the `wasBlocking`/`fsm.unblock()` branch inside `removeApprover` |
| E2E personas (matching `e2e/us3-qa-concurrence-and-approver-coordination.spec.js`'s own convention) | `dong` = primary, QA staff; `bob` (`APPROVER_ID`) = secondary, designated approver and also a pre-existing `ncr-qa` member (temporarily removable via `remove-group-member`/`add-group-member`); `guobao` = AD identity used as Originator/CE/CS context |
| Reused e2e fixtures | `create-dispositioned-ncr` (this file's own helper), `create-traveler-linked-ncr`, `set-ncr-status`, `get-ncr`, `remove-group-member`, `add-group-member` (all already in `e2e/fixtures/`) |

---

## Phase 1: Setup

**Purpose**: Confirm the pre-change baseline is still current before touching anything.

- [X] T001 With the Docker stack up, re-run the four commands in `specs/129-ncr-approval-round/baseline.txt` (`TRAVELER_CONFIG_REL_PATH=docker npx mocha test-unit/lib/ncr-service.test.js`; the `ncr-pdf`/`ncr-email` unit pair; `npm run e2e -- e2e/us3-qa-concurrence-and-approver-coordination.spec.js`; `npm run e2e -- e2e/us-ncr-next-action-visibility.spec.js`). Confirm the same pass counts (158 / 75 / 24 / 6). If any count differs, update `baseline.txt` and note the discrepancy before proceeding, so it isn't later misattributed to this feature.

---

## Phase 2: User Story 1 — Return for Comment sends the NCR back to QA, not into limbo (Priority: P1) 🎯 MVP

**Goal**: A "Return for Comment" decision stops the round immediately and sends the NCR to `Dispositioned`; nothing can reach `Final Approval` out of a stopped round; the now-impossible "resubmit the same round" path is gone.

**Independent Test**: spec.md User Story 1's own Independent Test.

### Tests for User Story 1 ⚠️

> Write first; confirm they fail before implementing.

- [X] T002 [US1] In `test-unit/lib/ncr-service.test.js`'s `returnForComment` describe block (lines 636-674): rewrite `'transitions to Returned for Comment and notifies QA Staff'` to `'transitions to Dispositioned and notifies QA Staff'`, changing its assertion to `result.status.should.equal('Dispositioned')`. Add a new test, `'throws 409 when the approver already has a non-Pending decision for this round'`: stub an NCR `{ status: 'Approval Requested', additional_approvers: [{ approver_id: 'appr1', approval_status: 'Approved' }, { approver_id: 'appr2', approval_status: 'Pending' }] }` (appr1 already approved, appr2 still pending — so the NCR is still legitimately `Approval Requested`), then call `returnForComment('id1', 'changed my mind', approver)` as `appr1` and expect a 409.
- [X] T003 [US1] In the same file, delete the entire `describe('lib/ncr-service — qaResubmit', ...)` block (lines 676-749) — the function it tests is removed in this story.
- [X] T004 [US1] In the same file's `addApprover` describe block, delete `'is also allowed while the NCR is Returned for Comment (issuance has not happened)'` (lines 855-872). In the `removeApprover` describe block, delete `'removing a non-blocking approver while Returned for Comment leaves the NCR Returned for Comment'`, `'removing the blocking approver unblocks the NCR back to Approval Requested when other approvers are still Pending'`, and `'removing the blocking approver advances straight to Final Approval when everyone remaining has already approved'` (lines 954-1005 — this last one is the existing test that currently locks in today's actual bug: reaching `Final Approval` by removing the approver who was blocking a `Returned for Comment` NCR, with no new round ever happening). In their place, add `'throws 409 when the NCR is Dispositioned after a round was stopped'`: stub an NCR `{ status: 'Dispositioned', additional_approvers: [{ approver_id: 'appr2', approval_status: 'Pending' }] }` (the shape immediately after a stop — the entries from the stopped round are still sitting in `additional_approvers` until QA starts a new round) and confirm `removeApprover('id1', 'appr2', qaUser)` rejects with 409, proving there is no longer any way to manipulate your way to `Final Approval` out of a stopped round.
- [X] T005 [US1] In the same file's `getStatusCounts` describe block (around line 1449), remove the `'Returned for Comment': 0,` line from the expected `counts` object in `'covers every status, including Closed, with no page limit applied to the query'`.
- [X] T006 [P] [US1] In `e2e/us3-qa-concurrence-and-approver-coordination.spec.js`, rewrite `'AS7 - approver returns for comment, QA staff resubmits to approvers'` (lines 266-300) to `'AS7 - approver returns for comment, which stops the round and sends the NCR back to Dispositioned'`: keep the setup and the approver's return-for-comment action unchanged through the `approverPage.close()` call, but change the assertion after it to `expect(ncr.status).toBe('Dispositioned')` (not `'Returned for Comment'`). Replace the "QA staff resubmits" section (there is no more Resubmit button) with: assert `page.locator('button:has-text("Resubmit to Approvers")')` has count 0 on `/ncrs/${ncrId}/approve`; then have QA start a new round via `page.request.patch('/api/ncrs/${ncrId}/concurrence', { data: { additional_approvers: [{ approver_id: APPROVER_ID }] } })`; assert the response NCR's `status` is `'Approval Requested'`, `additional_approvers[0].approval_status` is `'Pending'` (not carried over), and `additional_approvers[0].approval_status` is **not** `'Approved'` or `'Returned for Comment'` from the prior round.
- [X] T007 [US1] In the same file, replace `'QA can manage approvers while Returned for Comment, and removing the blocking approver unblocks back to Approval Requested'` (lines 420-455) with `'QA cannot manage approvers or unblock anything once a round is stopped — QA must start a new round from Dispositioned'`: keep the setup and bob's return-for-comment action unchanged (through the `approverPage.close()` call), then assert via `get-ncr` that `ncr.status` is `'Dispositioned'`; assert `page.locator('fieldset:has(legend:text("Manage Approvers"))')` has count 0 on `/ncrs/${ncrId}/approve`; and assert a direct `page.request.delete('/api/ncrs/${ncrId}/approvers/guobao')` call now returns 409 (no approver can be added or removed once the round is over).
- [X] T008 [P] [US1] In `e2e/us-ncr-next-action-visibility.spec.js`, change `'a status with no next action (Returned for Comment) shows no button, even to a QA staff member'` (lines 138-145) to use `createNcrInStatus('Closed', ...)` instead of `'Returned for Comment'` (that status is no longer constructible), dropping the now-irrelevant `additional_approvers` override; keep the rest of the test (goto the detail page, `expectNoActionButton`) unchanged — `Closed` is still a real "no next action for anyone" status.

### Implementation for User Story 1

- [X] T009 [US1] In `model/ncr.js`, remove `'Returned for Comment'` from the `NCR_STATUSES` array (lines 93-100). Do **not** touch `additional_approvers[].approval_status`'s enum (line 163) — it keeps `'Returned for Comment'` as the approver's own decision value.
- [X] T010 [US1] In `lib/ncr-state-machine.js`, remove the `resubmitToApprovers` and `unblock` transitions entirely; change `returnForComment`'s `to` from `'Returned for Comment'` to `'Dispositioned'`; change `finalApprove`'s `from` from `['Approval Requested', 'Returned for Comment']` to `'Approval Requested'`. Resulting transition table matches research.md D7.
- [X] T011 [US1] In `lib/ncr-service.js`'s `returnForComment` (around line 486), immediately after resolving `approverEntry` and before mutating it, add: `if (approverEntry.approval_status !== 'Pending') { const err = new Error('You have already submitted a decision for this NCR'); err.status = 409; throw err; }`. (makes T002's new test pass; the FSM change from T010 makes the existing assertion rewritten in T002 pass.)
- [X] T012 [US1] In `lib/ncr-service.js`, delete the `qaResubmit` function (lines 548-612) and remove it from `module.exports`. (makes T003 pass — the deleted tests now have nothing to import)
- [X] T013 [US1] In `lib/ncr-service.js`, change `PRE_ISSUANCE_STATUSES` (line 64) from `['Approval Requested', 'Returned for Comment']` to `['Approval Requested']` (or inline the single comparison at both call sites — either way, `addApprover`/`removeApprover`'s guard must now require exactly `'Approval Requested'`). In `removeApprover`, delete the `wasBlocking` computation and the trailing `if (!finalized && wasBlocking) { const fsm = createNcrStateMachine(ncr.status); fsm.unblock(); ... }` block (lines 727-753), keeping the `maybeFinalApprove` call. (makes T004 pass)
- [X] T014 [US1] In `lib/ncr-service.js`, remove `'Returned for Comment'` from `POST_DISPOSITION_STATUSES` (lines 1003-1009).
- [X] T015 [US1] In `routes/ncr.js`, delete the `router.patch('/:id/resubmit', ...)` handler (lines 505-527) in its entirety.
- [X] T016 [US1] In `views/ncr-approval.jade`: remove the `isReturnedForComment` variable (line 12); change `canManageApprovers` (line 57) to `isQa && ncr.status === 'Approval Requested'`; remove the `if isQa && isReturnedForComment` fieldset (lines 123-129, the "QA Action / Resubmit to Approvers" block) and the `$('#resubmit-btn').on('click', ...)` handler in `block js` (lines 191-195).
- [X] T017 [P] [US1] In `views/ncr-detail-body.jade`, change `canManageApprovers` (line 1) to `isQa && ncr.status === 'Approval Requested'`.
- [X] T018 [P] [US1] In `views/ncr-dashboard.jade`, remove the `Returned for Comment` status-card `span` (line 46), its entry in the status→color map (line 144), and the `.count-Returned` counter line (line 204).
- [X] T019 [P] [US1] In `lib/ncr-email.js`'s `sendQaNotification`, reword the `returned_for_comment` body copy (line 90) from "...resubmit to approvers if appropriate." to "...designate approvers again if another round of approval is needed." (no test asserts this body text — only the subject line is asserted, and it is unchanged per spec.md's Assumptions).

**Checkpoint**: User Story 1 is functional and independently testable — a return-for-comment decision now correctly stops the round and returns control to QA, with no path to `Final Approval` out of a stopped round.

---

## Phase 3: User Story 2 — Approvers must decide fresh in each new round (Priority: P2)

**Goal**: A round number exists and is tracked; a new round never inherits a decision from an earlier one (already true mechanically once `submitConcurrence` can be called again from `Dispositioned`, per User Story 1 — this story adds the explicit counter and locks the guarantee in with a regression test).

**Independent Test**: spec.md User Story 2's own Independent Test.

**Depends on**: User Story 1 (a second round is only reachable once `returnForComment` correctly returns the NCR to `Dispositioned`).

### Tests for User Story 2 ⚠️

> Write first; confirm they fail before implementing.

- [X] T020 [US2] In `test-unit/lib/ncr-service.test.js`'s `submitConcurrence` describe block (starts line 403), add: `'sets current_approval_round to 1 on the first round'` (concur with one approver on an NCR with no `current_approval_round` set; assert `result.current_approval_round === 1`); `'increments current_approval_round on a later round'` (stub an NCR with `current_approval_round: 1`, concur with approvers again; assert `result.current_approval_round === 2`); `'does not set current_approval_round when concurring with zero approvers'` (assert it stays `undefined`/unchanged).
- [X] T021 [US2] In the same describe block, add `'does not carry a prior round's decision into a new round'`: stub an NCR `{ status: 'Dispositioned', current_approval_round: 1, additional_approvers: [{ approver_id: 'appr1', approval_status: 'Approved' }] }` (the shape left behind after a round completed or was stopped), call `submitConcurrence('id1', [{ approver_id: 'appr1' }], qaUser)`, and assert the resulting `additional_approvers[0].approval_status` is `'Pending'` — appr1's round-1 `'Approved'` decision does not carry forward into round 2, even though it's the same person.

### Implementation for User Story 2

- [X] T022 [US2] In `model/ncr.js`'s `NcrSchema`, add `current_approval_round: Number`.
- [X] T023 [US2] In `lib/ncr-service.js`'s `submitConcurrence`, in the `else` branch (approvers.length > 0, around line 345), before building `ncr.additional_approvers`, add `ncr.current_approval_round = (ncr.current_approval_round || 0) + 1;`. Leave the `if (approvers.length === 0)` branch untouched — concurring with no approvers never starts a round.

**Checkpoint**: User Stories 1 AND 2 both work independently — rounds are now explicitly numbered, and fresh decisions are both guaranteed and tested.

---

## Phase 4: User Story 3 — The NCR's history shows which round each decision belongs to (Priority: P3)

**Goal**: Every approval-round-scoped event in the NCR's existing event/activity history is labeled with the round it belongs to, visible in the Event Timeline.

**Independent Test**: spec.md User Story 3's own Independent Test.

**Depends on**: User Story 2 (`current_approval_round` must exist to stamp onto events).

### Tests for User Story 3 ⚠️

> Write first; confirm they fail before implementing.

- [X] T024 [US3] In `test-unit/lib/ncr-service.test.js`, add round-tagging assertions alongside the existing event-type assertions in: `submitConcurrence` (the `qa.concurred`, `approvers.designated`, and `notification.approval_request` events all carry `round` equal to the just-set `current_approval_round`), `submitApproval` (the `approval.approved` event carries `round`), `returnForComment` (the `approval.returned_for_comment` event carries `round`), `addApprover` and `removeApprover` (their `approver.added`/`approver.removed` events, and `addApprover`'s `notification.approval_request` event, carry `round`).
- [X] T025 [US3] In `e2e/us3-qa-concurrence-and-approver-coordination.spec.js`, add a new test `'approval-round events are tagged with their round number across a stopped round and a new one'`: concur with `bob` (round 1), have `bob` return for comment (stops round 1), then concur again with `bob` (round 2) and have `bob` approve (completing round 2, since it's the only approver). Fetch `GET /api/ncrs/${ncrId}/events` and assert: the `approval.returned_for_comment` event has `round: 1`; the second `qa.concurred` and the `approval.approved` events have `round: 2`. Separately, `page.goto` the NCR detail page, expand the Event Timeline (`#timeline-toggle`), and assert its rendered text contains both `'Round 1'` and `'Round 2'`.

### Implementation for User Story 3

- [X] T026 [US3] In `model/ncr.js`'s `NcrEventSchema`, add `round: Number`.
- [X] T027 [US3] In `lib/ncr-service.js`: set `round: ncr.current_approval_round` on the `qa.concurred` and `approvers.designated` event objects pushed in `submitConcurrence`, the `approval.approved` event in `submitApproval`, the `approval.returned_for_comment` event in `returnForComment`, and the `approver.added`/`approver.removed` events in `addApprover`/`removeApprover`. Extend `appendNotificationEvent(ncr, eventType, results, cc)` (line 82) with an optional 5th parameter `round`, including it on the pushed event only when provided; pass `ncr.current_approval_round` at its two remaining `notification.approval_request` call sites (`submitConcurrence` line 408, `addApprover` line 682) — its third call site (`qaResubmit`, line 607) no longer exists after T012.
- [X] T028 [US3] In `views/ncr-detail-body.jade`'s Event Timeline partial, immediately after the existing `if event.previous_status && event.new_status` block (around line 284-286), add `if event.round` rendering `small Round #{event.round}` in the same `.muted` style, so it appears as a second small line under the existing status-transition line whenever present.

**Checkpoint**: All three user stories are independently functional — the defect is fixed, fresh-decision-per-round is guaranteed and numbered, and that numbering is visible in the NCR's own history.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Verification and the checks the constitution requires.

- [X] T029 Run `npx eslint .` and confirm no new errors.
- [X] T030 Run `TRAVELER_CONFIG_REL_PATH=docker npm run unit` and confirm the full suite passes (not just `ncr-service.test.js` in isolation) — in particular `test-unit/lib/ncr-pdf.test.js` and `test-unit/lib/ncr-email.test.js`, which should need no change (research.md D8).
- [X] T031 With the Docker stack running, run `npm run e2e -- e2e/us3-qa-concurrence-and-approver-coordination.spec.js` and `npm run e2e -- e2e/us-ncr-next-action-visibility.spec.js` and confirm both pass; spot-check `npm run e2e -- e2e/us-originator-designate.spec.js` and `npm run e2e -- e2e/us1-create-and-submit-ncr.spec.js` (or the full suite, `npm run e2e`, if time allows) for any unexpected regression touching NCR status handling.
- [X] T032 Walk through `specs/129-ncr-approval-round/quickstart.md`'s by-hand section manually against the running stack.
- [X] T033 Add a `CLAUDE.md` "Recent Changes" entry for `129-ncr-approval-round`, following the format of entries 121-128, explicitly calling out the breaking change (`PATCH /api/ncrs/:id/resubmit` removed; use `PATCH /api/ncrs/:id/concurrence` to start a new round instead).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none — start immediately.
- **User Story 1 (Phase 2)**: needs Setup only. **This is the MVP** — it alone fixes the reported defect.
- **User Story 2 (Phase 3)**: needs User Story 1 (a second round is unreachable until `returnForComment` correctly returns to `Dispositioned`).
- **User Story 3 (Phase 4)**: needs User Story 2 (`current_approval_round` must exist before it can be stamped onto events).
- **Polish (Phase 5)**: after all three stories.

### Shared-file ordering

| File | Order |
|---|---|
| `test-unit/lib/ncr-service.test.js` | T002 → T003 → T004 → T005 → T020 → T021 → T024 |
| `lib/ncr-service.js` | T011 → T012 → T013 → T014 → T023 → T027 |
| `lib/ncr-state-machine.js` | T010 (only task touching this file) |
| `model/ncr.js` | T009 → T022 → T026 |
| `e2e/us3-qa-concurrence-and-approver-coordination.spec.js` | T006 → T007 → T025 |
| `views/ncr-detail-body.jade` | T017 → T028 |
| `routes/ncr.js` | T015 (only task) |
| `views/ncr-approval.jade` | T016 (only task) |
| `views/ncr-dashboard.jade` | T018 (only task) |
| `lib/ncr-email.js` | T019 (only task) |
| `e2e/us-ncr-next-action-visibility.spec.js` | T008 (only task) |

This is a small, mostly single-file-per-concern feature — real parallelism is limited to tasks in genuinely different files with no shared ordering above.

### Parallel Opportunities

- T006 and T008 (different e2e files) can run together once each file's prerequisite tasks (none, for T006; none, for T008) are satisfied.
- T017, T018, T019 (three different view/lib files, all within User Story 1) can run together once T009-T015 land.
- Within User Story 3, T028 depends on T017 (same file, sequential) but not on T027 — the two can proceed in parallel once their own prerequisites are met.

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (Setup).
2. Phase 2 (User Story 1) — the defect is fixed: a return-for-comment decision correctly stops the round and returns the NCR to QA's control, with no bypass to Final Approval. **Ship alone as the MVP** if desired.
3. **Stop and validate** against quickstart.md's by-hand walkthrough steps 1-4 before continuing.

### Incremental Delivery

1. Setup → baseline confirmed.
2. US1 (P1) → test → demo — the fix itself, ready to ship alone.
3. US2 (P2) → test → demo — rounds are explicitly numbered and the fresh-decision guarantee is locked in by a regression test.
4. US3 (P3) → test → demo — round numbers are visible in the NCR's own history.
5. Polish (Phase 5) — lint, full unit + e2e suite, quickstart walk-through, changelog.

### Notes

- Confirm each story's tests fail before implementing it.
- Commit after each phase; stop at the Phase 2 checkpoint to validate User Story 1 independently if desired — it is the complete MVP.
- T004's new `removeApprover` test is the direct regression test for the bug reported in the original request (reaching `Final Approval` by removing a blocking approver without ever resolving the return-for-comment); do not skip it even if short on time.
