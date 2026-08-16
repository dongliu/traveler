# Tasks: NCR Originator Designate Assignment

**Input**: Design documents from `/specs/003-originator-designate/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Not explicitly requested as TDD, but this repo's constitution
requires unit tests for all `lib/` logic — task list includes unit test
tasks alongside implementation, matching the existing `test-unit/lib/ncr-service.test.js`
convention of testing behavior after it's written.

**Organization**: Tasks are grouped by user story (spec.md) to enable
independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2)
- Paths are relative to the repository root

## Path Conventions

Single project — this feature modifies existing files in place
(`model/`, `lib/`, `routes/`, `views/`, `test-unit/`, `e2e/`); no new
top-level directories, per plan.md's Project Structure.

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: The schema change both user stories depend on — US1 writes
these fields, US2 reads them in permission/visibility checks. No separate
"Setup" phase exists for this feature: there are no new dependencies,
directories, or tooling to initialize (plan.md's Technical Context —
"None new").

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T001 In `model/ncr.js`: add `originator_designate_id: String` and `originator_designate_name: String` to `NcrSchema` (both optional, no `required: true` — data-model.md); add `'delegate.removed'` to the `NCR_EVENT_TYPES` array, alongside the existing (currently unused) `'delegate.assigned'` entry

**Checkpoint**: `model/ncr.js` has both new fields and both event types. User story implementation can now begin.

---

## Phase 2: User Story 1 - Originator Assigns a Designate (Priority: P1) 🎯 MVP

**Goal**: The NCR's own Originator can assign, change, or remove exactly one Designate on that NCR — and only the Originator can do so.

**Independent Test**: As an NCR's Originator, assign a Designate via `PATCH /api/ncrs/:id/designate`; verify the NCR document reflects it, the Designate receives a notification email, and a `delegate.assigned` event is recorded. Verify a non-Originator (including the just-assigned Designate) cannot perform the same call. Verify removal and Closed-status lockout.

- [ ] T002 [P] [US1] In `lib/ncr-email.js`, add `sendDesignateAssigned(ncr, designate)`: a single-recipient notification email following the existing `sendPaAssigned()` pattern (subject referencing the NCR number, body informing the recipient they've been assigned as Designate on this NCR with a link to it), exported alongside the other `sendXxx` functions
- [ ] T003 [US1] In `lib/ncr-service.js`, implement `assignDesignate(ncrId, designateData, user)` (data-model.md): find the NCR (404 if missing); verify `ncr.originator_id === user.id` (403 otherwise, message "Only the NCR Originator can assign, change, or remove the Designate"); verify `designateData.designate_id !== user.id` (400 otherwise, message "Cannot assign the Originator as their own Designate" — a validation error, not a 403, since it's a malformed request rather than an authorization failure per contracts/ncr-designate.json); verify `ncr.status !== 'Closed'` (409 otherwise, message "Cannot assign, change, or remove the Designate on a Closed NCR"); set `ncr.originator_designate_id`/`ncr.originator_designate_name` from `designateData` (overwriting any existing value — this same function handles first assignment and replacement); push a `delegate.assigned` event (`actor_id`/`actor_name` = the Originator, `actor_role: 'originator'`, `payload: {designate_id, designate_name}`) per data-model.md's Event payload shape; call `sendDesignateAssigned()` from T002 and append a `notification.designate_assigned` system event via the existing `appendNotificationEvent()` helper; save; return the updated NCR
- [ ] T004 [US1] In `lib/ncr-service.js`, implement `removeDesignate(ncrId, user)`: same NCR-lookup, Originator-only, and not-`'Closed'` checks as T003 (no self-assignment check applies to removal); capture the outgoing `originator_designate_id`/`originator_designate_name` before clearing them; push a `delegate.removed` event (`payload: {previous_designate_id, previous_designate_name}`) — no notification email per data-model.md; save; return the updated NCR; export both `assignDesignate` and `removeDesignate` from the module's `module.exports`
- [ ] T005 [US1] In `routes/ncr.js`, add `router.patch('/:id/designate', auth.ensureAuthenticated, ...)`: validate `:id` via the existing `isValidId`/`badId` helpers; read `req.body.designate_id`/`req.body.designate_name`; if `designate_id` is present and non-empty call `assignDesignate()` (requiring `designate_name` too — 400 if missing), otherwise call `removeDesignate()`; build the `user` object the same way other handlers in this file do (`id`/`name` from `req.session.userid`/`res.locals.username`); map errors through the existing `mapServiceError()` helper (already handles 400/403/404/409 generically — no route-level special-casing needed); on success return `200` with `{success: true, ncr: {ncr_id, ncr_number, originator_designate_id, originator_designate_name}}` per contracts/ncr-designate.json
- [ ] T006 [P] [US1] In `views/ncr-detail.jade`, add an Originator-only Designate assignment control: visible only when the page is rendered for the NCR's own Originator (compare `ncr.originator_id` to the logged-in user id already available to the template, matching how other role-gated controls on this page are conditioned); a text input bound to the existing `travelerGlobal.usernames` Bloodhound typeahead (same pattern as `views/ncr-create.jade`'s `#ce_cs_name` field — research.md Decision 4) plus Assign/Change and Remove actions; on submit, `PATCH` to `/api/ncrs/:id/designate` via AJAX and refresh the displayed Designate on success, showing the server's error message on failure (same `resp.message || resp.error` pattern already used elsewhere in this app)
- [ ] T007 [US1] In `test-unit/lib/ncr-service.test.js`, add a `describe('lib/ncr-service — assignDesignate')` and `describe('lib/ncr-service — removeDesignate')` covering: successful first assignment (event + email sent, fields set); successful replacement of an existing Designate; successful removal (fields cleared, event recorded, no email); 403 when the caller is not the NCR's Originator (including when the caller is the *current* Designate); 400 when `designate_id` equals the caller's own id; 409 when the NCR's `status` is `'Closed'`; 404 when the NCR doesn't exist

**Checkpoint**: `PATCH /api/ncrs/:id/designate` is fully functional end-to-end and independently testable — assignment, replacement, removal, and every rejection path all work, with UI support on the NCR detail page.

---

## Phase 3: User Story 2 - Designate Exercises Originator Authority (Priority: P1)

**Goal**: A user assigned as Designate on a specific NCR gets the same authority the Originator has *on that NCR* — dashboard visibility, ISSUANCE and FINAL NCR DISTRIBUTION email recipiency, and the ability to close it with their own identity recorded — and nowhere else.

**Independent Test**: With a Designate already assigned (via Phase 2), verify: the Designate's dashboard lists that NCR; the Designate receives the ISSUANCE email when the NCR reaches Final Approval; the Designate can close the NCR and the closure record shows the Designate's own identity; the Designate receives the FINAL NCR DISTRIBUTION email; the Designate has no access to any NCR they weren't assigned Designate on.

- [ ] T008 [US2] In `lib/ncr-service.js`'s `closeNcr()`, widen the permission check from `if (ncr.originator_id !== user.id)` to `if (ncr.originator_id !== user.id && ncr.originator_designate_id !== user.id)` per data-model.md — no other change needed in this function, since `closure_record.closed_by`/`closed_by_name` and the `ncr.closed`/`traveler.signed_off` events already use `user.id`/`user.name` directly (research.md Decision 3 — the Designate's own identity is already what gets recorded once the permission check allows them through)
- [ ] T009 [US2] In `lib/ncr-service.js`, widen the issuance-recipient id list in both `submitConcurrence()` (the no-additional-approvers branch, `findUsers([ncr.originator_id])`) and `submitApproval()` (the all-approved branch, same call) to also include `ncr.originator_designate_id` when set — e.g. `findUsers([ncr.originator_id, ncr.originator_designate_id].filter(Boolean))`
- [ ] T010 [US2] In `lib/ncr-service.js`'s `closeNcr()`, widen the final-distribution `recipientIds` `Set` construction to also `recipientIds.add(ncr.originator_designate_id)` when set, alongside the existing `recipientIds.add(ncr.originator_id)`
- [ ] T011 [US2] In `lib/ncr-service.js`, widen `buildRoleScope()`'s `orClauses` to push a parallel `{ originator_designate_id: user.id }` clause alongside the existing `{ originator_id: user.id }` clause; widen `getNcrById()`'s manual scope-matching `switch`-like chain (the `if (k === 'originator_id') ...` block) with a matching `if (k === 'originator_designate_id') return ncr.originator_designate_id === v;` branch, so both the live-query path (`listNcrs`) and the `.lean()`-document path (`getNcrById`) agree
- [ ] T012 [P] [US2] In `views/ncr-detail.jade`'s Reference section `dl.dl-horizontal`, add a `dt`/`dd` pair displaying the current Designate's name (`ncr.originator_designate_name`) when set, alongside the existing Originator/CE/CS display — visible to any authorized viewer, not just the Originator (this is separate from T006's Originator-only *assignment control*, which lives in the same area but is conditionally shown)
- [ ] T013 [US2] In `test-unit/lib/ncr-service.test.js`, update/add tests covering: `closeNcr()` succeeds when called by the Designate (not just the Originator), and `closure_record.closed_by`/`closed_by_name` reflect the Designate's identity, not the Originator's; `submitConcurrence()`/`submitApproval()` include the Designate's email in the issuance send when one is assigned; `closeNcr()` includes the Designate's email in the final-distribution send; `buildRoleScope()` returns a scope that matches an NCR where the caller is the Designate (not the Originator); `getNcrById()` grants access when the caller is the Designate and denies it for an unrelated NCR where they are neither Originator nor Designate

**Checkpoint**: Both user stories are complete. A Designate can be assigned, and immediately exercises full Originator-equivalent authority on that specific NCR only — matching spec.md's Success Criteria SC-002 and SC-005.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end verification, lint, and closing the documentation gap this feature exists to fill.

- [ ] T014 [P] Create `e2e/us-originator-designate.spec.js` (Playwright), reusing `e2e/fixtures/{env,exec-cli,mailpit,auth-state,run-id}.js` from `specs/002-playwright-e2e-tests`: drive quickstart.md's manual verification steps — assign a Designate as the primary persona, verify the notification email and event via `get-ncr`; switch to the secondary persona (`SECONDARY_AUTH_STATE`) as the Designate and verify dashboard visibility; bring the NCR to Final Approval (reusing whatever fixture/flow US2's own approval-lifecycle e2e tests already establish for this, once those exist, or construct one directly — the existing `create-traveler-linked-ncr` fixture CLI command already accepts an arbitrary `status` override and can be reused, or extended with a small generic status-only variant, to place a test NCR directly at Final Approval without driving the full disposition/concurrence chain through the UI) and confirm the Designate receives the ISSUANCE email; close the NCR as the Designate and confirm the closure record identifies the Designate; confirm the FINAL NCR DISTRIBUTION email reaches both personas; confirm the Designate has no access to an unrelated NCR
- [ ] T015 [P] Run `npx eslint model/ncr.js lib/ncr-service.js lib/ncr-email.js routes/ncr.js views/ncr-detail.jade` and fix any reported issues
- [ ] T016 Run `npm run unit` (confirm all pass, including T007/T013's new tests) and `npx playwright test e2e/us-originator-designate.spec.js --config=e2e/playwright.config.js` against the running local Docker stack (confirm all pass); run the Playwright spec a second consecutive time to confirm repeat-run safety, consistent with how `specs/002-playwright-e2e-tests` validates its own suite
- [ ] T017 [P] Update `specs/001-ncr-workflow/spec.md`'s five existing "NCR Originator or designee" references (User Story 5 Acceptance Scenarios 1, 4, 5; User Story 6 Acceptance Scenario 1; FR-039, FR-040, FR-043, FR-044) to note the designee/Designate concept is now defined and implemented by `specs/003-originator-designate/spec.md`, closing the gap this feature's own Background section identifies

**Checkpoint**: Feature is lint-clean, fully tested (unit + e2e, verified against the live stack), and the base NCR workflow spec no longer has an undefined "designee" reference dangling in it.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — BLOCKS both user stories (both read/write the new schema fields)
- **US1 (Phase 2)**: Depends on Phase 1 only
- **US2 (Phase 3)**: Depends on Phase 1 only for the schema fields it reads — but is only *meaningfully verifiable* once Phase 2 exists to actually produce a Designate assignment to test against (T013's tests need a way to get `originator_designate_id` set on a test NCR, which either stubs the field directly or calls T003's `assignDesignate()`)
- **Polish (Phase 4)**: Depends on both Phase 2 and Phase 3 being complete

### User Story Dependencies

| Story | Can Start After | Depends On |
|---|---|---|
| US1 (Phase 2) | Phase 1 | None |
| US2 (Phase 3) | Phase 1 | Practically benefits from US1 existing first (needs a way to produce an assigned Designate to test against), but its own code changes (T008–T011) don't call US1's functions — they only read the schema fields US1 writes |

### Within Each Phase

- T003 and T004 are both in `lib/ncr-service.js` — sequential, not `[P]` against each other
- T008–T011 are all in `lib/ncr-service.js` — sequential, not `[P]` against each other
- T002 (`lib/ncr-email.js`) and T006 (`views/ncr-detail.jade`) are `[P]` against T003/T004 (different files) once T001 (schema) is done, but T003 itself depends on T002 existing (it calls `sendDesignateAssigned`)
- T012 (`views/ncr-detail.jade`) is `[P]` against T008–T011 (different file)

### Parallel Opportunities

- Phase 1 is a single task — nothing to parallelize
- Phase 2: T002 `[P]` alongside starting T006's markup (both independent of each other and of T003/T004 until T003 needs T002's function to exist)
- Phase 3: T012 `[P]` alongside T008–T011
- Phase 4: T014, T015, T017 are `[P]` (different files/concerns); T016 depends on T014/T015 having completed first

---

## Parallel Example: Phase 2 (User Story 1)

```bash
# After T001 (schema) is done, launch together:
Task: "T002 [P] Add sendDesignateAssigned() to lib/ncr-email.js"
Task: "T006 [P] Add Designate assignment control to views/ncr-detail.jade"

# Then, once T002 exists:
Task: "T003 Implement assignDesignate() in lib/ncr-service.js (depends on T002)"
Task: "T004 Implement removeDesignate() in lib/ncr-service.js (depends on T003, same file)"
Task: "T005 Add PATCH /:id/designate route in routes/ncr.js (depends on T003, T004)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Foundational (schema)
2. Complete Phase 2: User Story 1 (assignment mechanism)
3. **STOP and VALIDATE**: `PATCH /api/ncrs/:id/designate` works end-to-end — assign, replace, remove, and every rejection path (403/400/409/404) — per T007's unit tests
4. This alone is a demoable increment (an Originator can record a Designate), even before User Story 2 wires up what that Designate can actually *do*

### Incremental Delivery

| Milestone | Phases | Deliverable |
|---|---|---|
| Foundation | 1 | Schema ready |
| MVP | +2 (US1) | Designate can be assigned/changed/removed, Originator-only, with notification and audit trail |
| Full feature | +3 (US2) | Designate actually holds Originator-equivalent authority: visibility, notifications, closure |
| Hardened | +4 | Lint-clean, e2e-verified against the live stack, base spec's dangling "designee" references resolved |

### Parallel Team Strategy

With two developers, once Phase 1 (Foundational) is done:

- Developer A: Phase 2 (US1 — assignment mechanism)
- Developer B: Phase 3 (US2 — authority widening) can start immediately on
  T008–T011 (they only *read* the schema fields, not call US1's functions),
  but T013's tests need Developer A's `assignDesignate()` (or a direct
  document stub) to actually produce a Designate to test against

---

## Notes

- `[P]` tasks touch different files with no dependency on an incomplete task
- `[Story]` label maps every user-story-phase task to its spec.md story for traceability
- This feature deliberately does not introduce a shared `isOriginatorOrDesignate()` helper (research.md Decision 5) — T008–T011 each inline the parallel check/clause directly, matching the codebase's own existing `ce_cs_delegate_id` precedent
- `actor_role` stays `'originator'` on every Designate-performed event (research.md Decision 3) — do not introduce a distinct role label; `actor_id`/`actor_name` (and, for closure, `closure_record.closed_by`) already fully capture the real identity
- Commit after each task or logical group
- Stop at either checkpoint to validate a story independently before continuing
