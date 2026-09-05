# Tasks: Concurrence Multi-Approver (No Role)

**Input**: Design documents from `specs/121-concurrence-multi-approver/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-concurrence.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup

**Purpose**: Confirm baseline — no new dependencies or infrastructure required for this feature.

- [x] T001 Verify `docker compose up` starts cleanly and an NCR can be loaded in the browser before any changes

---

## Phase 2: Foundational

**Purpose**: There is no new schema, collection, or middleware. The Mongoose `approver_role` field is retained as-is (see research.md Decision 1). No foundational tasks are required; proceed directly to user story implementation.

---

## Phase 3: User Story 1 — Add Multiple Approvers, No Role Field (Priority: P1) 🎯 MVP

**Goal**: QA can submit concurrence with zero or more approvers identified by username only; no role field appears or is required anywhere in the flow.

**Independent Test**: Open a Dispositioned NCR as QA, confirm no role column/input on the concurrence screen, add two usernames, submit — both receive approval requests and NCR moves to Approved. See quickstart.md Scenarios 1–2.

### Implementation for User Story 1

- [x] T002 [US1] In `routes/ncr.js` (~line 306): remove `!a.approver_role` from the per-entry validation condition; update the error detail message to `'Each entry requires approver_id'`
- [x] T003 [P] [US1] In `lib/ncr-service.js` `submitConcurrence` (~line 278–286): remove `approver_role: a.approver_role` from the mapped `additional_approvers` object returned to the NCR document
- [x] T004 [P] [US1] In `lib/ncr-service.js` `submitConcurrence` (~line 301–305): remove `approver_role: a.approver_role` from the `qa.concurred` event payload's `additional_approvers` map
- [x] T005 [P] [US1] In `lib/ncr-service.js` `submitApproval` and `returnForComment` (~lines 363, 367, 431, 437): remove `actor_role: approverEntry.approver_role` and `approver_role: approverEntry.approver_role` from event fields and payload — leave the fields absent rather than undefined
- [x] T006 [US1] In `views/ncr-concurrence.jade`: remove the `th Role` column header; remove the `input#new-approver-role` table cell and input; update the empty-state `colspan="3"` to `colspan="2"`; remove the `$('<td></td>').text(a.approver_role)` append in `render()`; remove `var role = $('#new-approver-role').val().trim()` and the `!role` guard from the add-click handler; remove `$('#new-approver-role').val('')` from the post-add clear
- [x] T007 [US1] In `test-unit/lib/ncr-service.test.js`: add or update `submitConcurrence` test cases to cover (a) entries with only `approver_id` and no `approver_role` are accepted and persisted, and (b) empty approvers array advances NCR to Final Approval

**Checkpoint**: User Story 1 is fully functional. The concurrence form shows username-only input, route accepts `approver_id`-only entries, service persists without role. Validate with quickstart.md Scenarios 1–2.

---

## Phase 4: User Story 2 — Prevent Duplicate Approvers (Priority: P2)

**Goal**: QA cannot add the same username twice; the second attempt is silently ignored.

**Independent Test**: Add the same username twice on the concurrence screen; confirm the list contains only one entry for that user. See quickstart.md Scenario 3.

### Implementation for User Story 2

- [x] T008 [US2] In `views/ncr-concurrence.jade`: confirm the duplicate guard (`approvers.some(function (a) { return a.approver_id === id; })`) is preserved after T006 changes and requires no edit — if the guard was inadvertently removed, restore it

**Checkpoint**: Adding the same username twice leaves only one entry. Validate with quickstart.md Scenario 3.

---

## Phase 5: User Story 3 — Remove Approver Before Submission (Priority: P2)

**Goal**: QA can remove any approver from the list before clicking Concur; the removed user receives no approval request.

**Independent Test**: Add two approvers, remove one, submit — only the remaining approver receives a request. See quickstart.md Scenario 4.

### Implementation for User Story 3

- [x] T009 [US3] In `views/ncr-concurrence.jade`: confirm the Remove button click handler (`approvers.splice(i, 1); render()`) is intact after T006 changes — the splice logic is unrelated to role and should require no edit; verify visually after changes

**Checkpoint**: Remove button works correctly. Validate with quickstart.md Scenario 4.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T010 Run ESLint on modified files: `npx eslint routes/ncr.js lib/ncr-service.js`
- [x] T011 [P] Run full unit test suite: `TRAVELER_CONFIG_REL_PATH=docker npm test`
- [ ] T012 [P] Execute quickstart.md validation scenarios end-to-end in Docker dev environment

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: N/A — no foundational tasks
- **Phase 3 (US1)**: Depends on Phase 1 confirmation; T003, T004, T005 can run in parallel after T002 is started; T006 (view) is independent of T003–T005; T007 (tests) depends on T002–T005 being understandable
- **Phase 4 (US2)**: Depends on T006 (view changes) from Phase 3
- **Phase 5 (US3)**: Depends on T006 (view changes) from Phase 3
- **Phase 6 (Polish)**: Depends on all story phases complete

### User Story Dependencies

- **US1 (P1)**: Start after Phase 1 — no dependency on US2 or US3
- **US2 (P2)**: Depends on US1 view task (T006)
- **US3 (P2)**: Depends on US1 view task (T006); can run in parallel with US2

---

## Parallel Example: User Story 1

```bash
# After T002 (route fix) is started, launch in parallel:
Task T003: "Remove approver_role from submitConcurrence persistence in lib/ncr-service.js"
Task T004: "Remove approver_role from qa.concurred event payload in lib/ncr-service.js"
Task T005: "Remove approver_role from submitApproval/returnForComment in lib/ncr-service.js"
Task T006: "Remove role column and input from views/ncr-concurrence.jade"

# T007 (tests) after T002–T005 are understood
```

---

## Implementation Strategy

### MVP (User Story 1 Only)

1. Phase 1: Confirm baseline (T001)
2. Phase 3: Route → Service → View → Tests (T002–T007)
3. **Validate**: Quickstart Scenarios 1–2
4. **Deliver** — core feature is complete

### Full Delivery

1. MVP above
2. Phase 4: Duplicate check verification (T008) — Quickstart Scenario 3
3. Phase 5: Remove verification (T009) — Quickstart Scenario 4
4. Phase 6: Lint, tests, end-to-end validation (T010–T012)

---

## Notes

- T003, T004, T005 all touch `lib/ncr-service.js` — assign to the same developer to avoid merge conflicts; they are marked [P] only because they edit logically independent sections of the file
- US2 and US3 require no new logic — both are verification that existing JS guards survived the role-removal edits in T006
- `model/ncr.js` requires no edits (see research.md Decision 1)
- Commit after each phase checkpoint
