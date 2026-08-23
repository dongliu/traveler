# Tasks: WBS Hierarchical Notification Lookup

**Input**: Design documents from `specs/006-wbs-hierarchical-notification-lookup/`

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[US1]**–**[US3]**: Map to spec.md's three user stories (Exact match / Nearest-ancestor match / No-match warning)

## Path Conventions

Single Express MVC project at repo root — extends the existing `lib/`, `routes/`, `views/`, `test-unit/`, `e2e/` from 001-ncr-workflow and 005-wbs-notification-registry. No new top-level directories.

---

## Phase 1: Setup

*No setup required — this feature adds one function to an existing module (`lib/wbs-notification-service.js`) and wires it into two existing functions (`createNcr`/`closeNcr` in `lib/ncr-service.js`). No new files, no new dependencies, no schema changes.*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The lookup function every user story depends on.

**⚠️ CRITICAL**: No user story can be implemented until this phase is complete.

- [ ] T001 Add `resolveWbsContact(wbsNumber)` to `lib/wbs-notification-service.js` per data-model.md: build the nearest-to-farthest ancestor candidate list by repeatedly trimming the last `.`-delimited segment, query `WbsNotification.find({ wbs_number: { $in: candidates } }).lean()` once, then return the first candidate (in nearest-to-farthest order) that has a match, or `null` if none do. Export it alongside the existing `listEntries`/`addEntry`/`updateEntry`/`removeEntry`/`isValidWbsNumber`/`isValidEmail` exports.

**Checkpoint**: `resolveWbsContact` exists and is independently testable — user story implementation can now begin.

---

## Phase 3: User Story 1 — Exact WBS Match Notifies the Registered Contact (Priority: P1) 🎯 MVP

**Goal**: An NCR filed against an exactly-registered WBS number gets that contact notified at both submission and closure.

**Independent Test**: Register a WBS number with an email, create an NCR against that exact WBS number, confirm the registered address receives the initial notification email and (after closing the NCR) the final distribution email, with delivery status recorded per-recipient in both events.

### Tests for User Story 1

- [ ] T002 [P] [US1] Unit test in `test-unit/lib/wbs-notification-service.test.js`: `resolveWbsContact('1.2')` returns the exact-match entry when `1.2` is registered
- [ ] T003 [P] [US1] Unit test in `test-unit/lib/ncr-service.test.js`: `createNcr()` appends the resolved contact's email to the `notification.initial` recipients when `data.wbs_number` has an exact registry match, and sets `ncr._wbsNotificationMatched = true`
- [ ] T004 [P] [US1] Unit test in `test-unit/lib/ncr-service.test.js`: `closeNcr()` appends the resolved contact's email to the `notification.final_distribution` recipients when `ncr.wbs_number` has an exact registry match

### Implementation for User Story 1

- [ ] T005 [US1] In `lib/ncr-service.js`'s `createNcr()`: import `resolveWbsContact` from `./wbs-notification-service`; after building `qaEmails` and before calling `sendInitialNotification`, call `resolveWbsContact(data.wbs_number)`, append `wbsMatch.notification_email` to the recipient list passed to `sendInitialNotification` when a match is found, and set `ncr._wbsNotificationMatched = !!wbsMatch` before `return ncr;` — per data-model.md's "Modified Function: createNcr" section
- [ ] T006 [US1] In `lib/ncr-service.js`'s `closeNcr()`: after building the existing `emails` array and before the `if (emails.length > 0)` block that calls `sendFinalDistribution`, call `resolveWbsContact(ncr.wbs_number)` and push `wbsMatch.notification_email` onto `emails` when a match is found — per data-model.md's "Modified Function: closeNcr" section
- [ ] T007 [US1] In `routes/ncr.js`'s `POST '/'` handler: add `wbs_notification_matched: !!ncr._wbsNotificationMatched` to the JSON response body, per contracts/create-ncr-response-addition.json

**Checkpoint**: Exact-match NCRs correctly notify the registered contact at both submission and closure, with delivery tracked. This alone is independently demonstrable — register one WBS number, create and close one NCR against it, and see the notification arrive.

---

## Phase 4: User Story 2 — Ancestor WBS Match Notifies the Nearest Registered Parent (Priority: P1)

**Goal**: An NCR filed against an unregistered WBS number still notifies the nearest registered ancestor, never a more distant one, and never a descendant.

**Independent Test**: Register only a parent-level WBS number, create an NCR against a more specific (child) WBS number that has no exact match, and confirm the parent's contact is notified — and that when both a closer and a more distant ancestor are registered, only the closer one is used.

### Tests for User Story 2

- [ ] T008 [P] [US2] Unit test in `test-unit/lib/wbs-notification-service.test.js`: `resolveWbsContact('1.2.1')` returns `1.2`'s entry when `1.2` is registered and `1.2.1` is not
- [ ] T009 [P] [US2] Unit test in `test-unit/lib/wbs-notification-service.test.js`: `resolveWbsContact('1.2.1')` returns `1.2`'s entry (not `1`'s) when both `1` and `1.2` are registered — nearer ancestor wins
- [ ] T010 [P] [US2] Unit test in `test-unit/lib/wbs-notification-service.test.js`: `resolveWbsContact('1.2.1')` returns `null` when only `1.2.1.1` (a descendant) is registered — a descendant registration never satisfies an ancestor lookup
- [ ] T011 [P] [US2] Unit test in `test-unit/lib/wbs-notification-service.test.js`: `resolveWbsContact('9')` (single segment, no possible parent) returns `null` when `9` is not registered, without erroring

### Implementation for User Story 2

*No additional implementation — `resolveWbsContact` (T001) already implements the full nearest-ancestor algorithm; this phase is test coverage confirming the algorithm's correctness on the multi-level and descendant-exclusion cases the single-level tests in Phase 3 don't exercise.*

**Checkpoint**: Ancestor-match resolution is proven correct across multiple hierarchy depths, competing ancestor levels, and the descendant-exclusion rule.

---

## Phase 5: User Story 3 — No Match Warns the Originator Instead of Silently Notifying No One (Priority: P1)

**Goal**: When neither an exact nor an ancestor match exists, the Originator sees a clear, non-blocking warning suggesting an Admin register the WBS number.

**Independent Test**: Create an NCR against a WBS number with no exact match and no registered ancestor at any level, and confirm (a) the NCR is still created successfully, (b) a warning is shown suggesting an Admin add the WBS number, and (c) the initial notification email still succeeds for existing recipients.

### Tests for User Story 3

- [ ] T012 [P] [US3] Unit test in `test-unit/lib/wbs-notification-service.test.js`: `resolveWbsContact('9.9.9')` returns `null` when neither `9.9.9`, `9.9`, nor `9` is registered
- [ ] T013 [P] [US3] Unit test in `test-unit/lib/ncr-service.test.js`: `createNcr()` sets `ncr._wbsNotificationMatched = false` and does not throw or fail the notification send when no WBS match exists — existing QA Staff recipients still receive `notification.initial` successfully
- [ ] T014 [P] [US3] Unit test in `test-unit/lib/ncr-service.test.js`: `closeNcr()` completes `notification.final_distribution` successfully with existing recipients when no WBS match exists — no error, no recipient added

### Implementation for User Story 3

- [ ] T015 [US3] In `views/ncr-create.jade`'s success-handling JS: when the `POST /api/ncrs` response's `wbs_notification_matched` is `false`, show a non-blocking warning banner (separate from and in addition to the existing `#ncr-success` banner) stating that no WBS Notification Registry entry covers this NCR's WBS number and suggesting an Admin add one — per contracts/create-ncr-response-addition.json's `client_behavior` note. The warning must never replace or hide the success banner, and must never prevent the already-completed NCR creation from being reported as successful.

**Checkpoint**: All three user stories complete — the full spec.md scope is implemented and independently testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end verification across all three stories together, through the real UI.

- [ ] T016 [P] Create `e2e/us-wbs-hierarchical-notification-lookup.spec.js`: register a WBS number via the admin registry UI (reusing the pattern from `e2e/us-wbs-notification-registry.spec.js`), create an NCR against it via the real creation form, confirm no warning is shown and the resolved contact appears in the NCR's event log (via `execFixtureCli('get-ncr', { ncrId, fields: ['events'] })`); repeat for a child WBS number with only a registered parent (nearest-ancestor case); repeat for a WBS number with no match anywhere and confirm the warning banner appears while NCR creation still succeeds (per quickstart.md Scenarios 1–3)
- [ ] T017 Run `TRAVELER_CONFIG_REL_PATH=docker npx mocha test-unit/lib/wbs-notification-service.test.js test-unit/lib/ncr-service.test.js` and confirm all unit tests pass, including the pre-existing ones (no regressions from the `createNcr`/`closeNcr` changes)
- [ ] T018 Run `npx playwright test us-wbs-hierarchical-notification-lookup.spec.js` (from `e2e/`, Docker stack running) and confirm all e2e tests pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: None — skipped, no new files/dependencies
- **Foundational (Phase 2)**: No dependencies — BLOCKS all user stories (T005/T006 both call `resolveWbsContact`, which must exist first)
- **User Stories (Phase 3-5)**: All depend on Phase 2 completion
  - US1 (Phase 3) is the MVP — implements the actual wiring into `createNcr`/`closeNcr`/the route response
  - US2 (Phase 4) adds no new implementation — it is pure additional test coverage of the algorithm T001 already implements, so it can be done in parallel with or immediately after Phase 2, independent of Phase 3's wiring work
  - US3 (Phase 5) depends on US1's T005 (the `ncr._wbsNotificationMatched` property must exist before T015's client code can read it via the response)
- **Polish (Phase 6)**: Depends on all three user stories being complete

### Within Each User Story

- Tests before implementation (write T002-T004, T008-T011, T012-T014 first, confirm they fail against the not-yet-implemented behavior, then implement)
- Service layer (`resolveWbsContact`) before the `lib/ncr-service.js` call sites before the route response field before the view

### Parallel Opportunities

- All of Phase 4 (T008-T011) can run in parallel with Phase 3 (T002-T007) once Phase 2 is done, since US2 adds no implementation of its own — it only tests T001's existing algorithm
- T002, T003, T004 can be written in parallel (different `describe` blocks, independent of each other)
- T008, T009, T010, T011 can all be written in parallel (same function, independent test cases)
- T012, T013, T014 can be written in parallel
- T016 (e2e) and T017 (unit test run) touch different concerns and could be prepared in parallel, though T017 should run before T016 to catch regressions cheaply first

---

## Parallel Example: Phase 2 → Phase 3 + Phase 4 fan-out

```bash
# Phase 2 (sequential, must complete first):
Task T001: "Add resolveWbsContact() to lib/wbs-notification-service.js"

# Then Phase 3 and Phase 4 tests can be written in parallel:
Task T002: "resolveWbsContact exact-match unit test"
Task T003: "createNcr() exact-match unit test"
Task T004: "closeNcr() exact-match unit test"
Task T008: "resolveWbsContact nearest-ancestor unit test"
Task T009: "resolveWbsContact nearer-wins-over-farther unit test"
Task T010: "resolveWbsContact descendant-never-matches unit test"
Task T011: "resolveWbsContact single-segment-no-parent unit test"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (T001) — CRITICAL, blocks everything
2. Complete Phase 3: User Story 1 (T002-T007)
3. **STOP and VALIDATE**: Register one WBS number, create and close one NCR against it exactly, confirm the contact is notified at both points (quickstart.md Scenario 1)
4. Deploy/demo if ready — this alone resolves the core "Future Work: Group Leader and Director Notifications (Deferred)" gap for the common case

### Incremental Delivery

1. Foundational (T001) → the algorithm exists and is directly testable
2. Add US1 (exact match, T002-T007) → wiring is live → demo (MVP)
3. Add US2 (ancestor coverage, T008-T011) → confidence in the hierarchy edge cases → no new demo surface, same wiring
4. Add US3 (no-match warning, T012-T015) → the gap-visibility half of the feature → demo
5. Polish (T016-T018) → full automated coverage, including through the real UI

### Key Constraints (from research.md and data-model.md)

- `lib/ncr-email.js` MUST NOT change — the resolved contact is appended to existing flat recipient arrays, not threaded through as a new parameter
- `createNcr()`'s return type MUST stay a bare `Ncr` document — every existing caller (route, all of `test-unit/lib/ncr-service.test.js`) depends on this; use the non-schema `_wbsNotificationMatched` property, not a return-shape change
- The no-match warning MUST NOT block NCR submission (FR-007) — T015's client code shows it alongside, never instead of, the success banner
- `resolveWbsContact` MUST NOT let a descendant registry entry satisfy an ancestor lookup (FR-002) — covered explicitly by T010

---

## Notes

- [P] tasks touch different files or independent test cases with no unfinished dependency between them
- [Story] label maps each task to its user story for traceability back to spec.md
- Commit after each phase's checkpoint is reached and its tests pass
- Stop at any checkpoint to demo/validate that story in isolation
