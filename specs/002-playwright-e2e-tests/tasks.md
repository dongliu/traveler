# Tasks: Automated Playwright E2E Test Suite for NCR Workflow

**Input**: Design documents from `/specs/002-playwright-e2e-tests/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: This feature's deliverable *is* a test suite — there is no separate
"write tests, then implement" split. Each acceptance-scenario task below
directly produces the Playwright spec that both defines and verifies that
behavior against the running app.

**Organization**: Tasks are grouped by user story (spec.md) to enable
independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US6)
- Paths are relative to the repository root

## Path Conventions

Single project — new top-level `e2e/` directory (Playwright suite, separate
from the existing `test-e2e/` manual scripts and `test-unit/` mocha suite),
per plan.md's Project Structure.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Repo-level scaffolding so Playwright can be installed and run.

- [x] T001 Create the `e2e/` and `e2e/fixtures/` directories per plan.md's Project Structure
- [x] T002 Add `@playwright/test` as a devDependency in `package.json`, run `npm install`, then run `npx playwright install chromium`
- [x] T003 [P] Add an `"e2e": "playwright test --config=e2e/playwright.config.js"` script to `package.json`'s `scripts` block
- [x] T004 [P] Add `MAIL_PORT`, `E2E_USER2`, `E2E_PASS2` to `.env.example` with comments explaining `E2E_USER2`/`E2E_PASS2` must be a second, distinct real login (per quickstart.md), consistent with the existing `E2E_USER`/`E2E_PASS` documentation style already there
- [x] T005 [P] Add `playwright-report/` and `test-results/` to `.gitignore`

**Checkpoint**: `npm install` succeeds, Playwright's browser is installed, repo scaffolding exists.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared infrastructure every user story's spec file depends on — the fixture CLI, environment/config resolution, Mailpit helper, auth setup, and Playwright config itself.

**⚠️ CRITICAL**: No user story spec file can be written until this phase is complete.

- [x] T006 [P] Create `e2e/fixtures/env.js`: resolves `WEB_PORT` (default `3001`), `API_PORT` (default `3002`), `MONGO_EXPRESS_PORT` (default `8081`), `MAIL_PORT` (default `8025`), `E2E_USER`/`E2E_PASS`, `E2E_USER2`/`E2E_PASS2` from the repo-root `.env` at run time (same convention as `test-e2e/README.md`); throws a clear, specific error identifying which variable is missing rather than proceeding with `undefined`
- [x] T007 [P] Create `e2e/fixtures/run-id.js`: exports a function generating a short, unique per-run suffix (timestamp + random chars) used to scope every piece of data a scenario creates (data-model.md's Test Scenario `runId` rule), so repeat runs against the same persistent database never collide (FR-009, research.md Decision 5)
- [x] T008 [P] Create `e2e/fixtures/mailpit.js` implementing `contracts/mailpit-api.md`: a `clearAll()` wrapping `DELETE /api/v1/messages`, a `search(query)` wrapping `GET /api/v1/search`, a `getMessage(id)` wrapping `GET /api/v1/message/{ID}`, and a `waitForMessage(query, { timeoutMs = 10000, intervalMs = 500 })` that polls `search` on a bounded interval instead of a single check or fixed sleep, using `e2e/fixtures/env.js` for the base URL
- [x] T009 Create `e2e/fixtures/cli.js` implementing every command in `contracts/fixture-cli.md` (`grant-role`, `reset-user-roles`, `add-group-member`, `remove-group-member`, `set-ce-cs`, `backdate-ncr`, `create-traveler-linked-ncr`, `get-ncr`, `get-user`, `get-group`): connects to MongoDB using the exact same bootstrap `app.js` uses (`config.mongo.server_address`/`server_port`/`traveler_db` + `user`/`pass`/`auth.authdb` from `docker/mongo.json`, loaded via `TRAVELER_CONFIG_REL_PATH=docker`), requires the existing `model/*.js` schemas directly (no duplicated schema definitions), reads `argv[2]` (command) and `argv[3]` (JSON args), prints exactly one JSON line to stdout on success or stderr + exit 1 on failure, and closes its Mongoose connection before exiting; every command is idempotent per the contract (e.g. `grant-role` on an already-granted role is a no-op success)
- [x] T010 [P] Create `e2e/fixtures/exec-cli.js`: a thin host-side helper Playwright test code imports, wrapping `docker compose exec -T web node e2e/fixtures/cli.js <command> '<json>'` (child process spawn), parsing the single JSON line from stdout/stderr per the CLI's output contract, and throwing a descriptive error (including the raw command and stderr) on any non-zero exit — this is the only way test code invokes T009's CLI
- [x] T011 Create `e2e/global-setup.js`: for each of `E2E_USER`/`E2E_PASS` (primary persona) and `E2E_USER2`/`E2E_PASS2` (secondary persona), launches a browser, performs the real UI login (same `/ldaplogin/` form flow the existing manual tests use, per `test-e2e/README.md`), saves Playwright `storageState` to `e2e/.auth/primary.json` and `e2e/.auth/secondary.json` respectively (add `e2e/.auth/` to `.gitignore` in this task too)
- [x] T012 Create `e2e/playwright.config.js`: sets `baseURL` from `e2e/fixtures/env.js`'s resolved `WEB_PORT`, `globalSetup: './global-setup.js'`, two `projects` (`primary` using `storageState: '.auth/primary.json'`, `secondary` using `storageState: '.auth/secondary.json'`), `trace: 'retain-on-failure'`, `video: 'retain-on-failure'`, `screenshot: 'only-on-failure'`, and both the HTML reporter (default) and JSON reporter (output to `playwright-report/results.json`) per research.md Decision 6; fails fast with a clear message if `baseURL` or the Mailpit URL is unreachable (a `globalSetup` connectivity check satisfying FR-012)

**Checkpoint**: `npx playwright test --list` (from `e2e/`) runs without error against an empty test set; the fixture CLI is independently callable via `docker compose exec`. User story spec files can now be written.

---

## Phase 3: User Story 1 - NCR Creation and Submission Notifications (Priority: P1) 🎯 MVP

**Goal**: Automated coverage of NCR creation, field validation, and both submission notification emails (CE/CS disposition request with Originator CC, QA Admin initial notification with Originator CC), including the ncr-qa-misconfigured failure path.

**Independent Test**: `npx playwright test e2e/us1-create-and-submit-ncr.spec.js` — creates its own NCR via the UI and does not depend on any other spec file having run first.

- [ ] T013 [US1] In `e2e/us1-create-and-submit-ncr.spec.js`, write the NCR creation and field-validation tests (spec Acceptance Scenarios 1–2): submit the creation form with all mandatory fields (using `run-id.js` to scope `part_number`/`wbs_number` uniquely) and assert the resulting NCR number and "Submitted" status; separately submit with missing/invalid mandatory fields and assert field-level validation messages appear and no NCR is created
- [ ] T014 [US1] In the same file, write the CE/CS disposition-request email test (Acceptance Scenario 3): after creating an NCR with a designated CE/CS, use `e2e/fixtures/mailpit.js`'s `waitForMessage` to find the email, and assert its `To` contains the CE/CS address, its `Cc` contains the Originator's address, and its body (via `getMessage`) contains the NCR number, part name, supplier, and originator name
- [ ] T015 [US1] In the same file, write the QA Admin initial-notification email test (Acceptance Scenario 4): find the email via `mailpit.js`, assert `To` contains each `ncr-qa` group member's address (read via `exec-cli.js`'s `get-group`), `Cc` contains the Originator's address, and the body contains the NCR number, part name, supplier, originator name, CE/CS name, and problem description
- [ ] T016 [US1] In the same file, write the event-log delivery-tracking test (Acceptance Scenario 5): use `exec-cli.js`'s `get-ncr` (requesting the `events` field) to assert both the `notification.disposition_request` and `notification.initial` events have a TO entry with `delivery_status`/`delivery_timestamp` populated and a separate CC entry (the Originator) with its own `delivery_status`/`delivery_timestamp`
- [ ] T017 [US1] In the same file, write the ncr-qa-misconfigured failure-path test (Acceptance Scenario 6): use `exec-cli.js`'s `remove-group-member` to empty the `ncr-qa` group, attempt NCR creation, assert the submission fails with the configured error message, then restore the group's prior membership via `add-group-member` in a `finally`/cleanup block so this test never leaves the group empty for other scenarios

**Checkpoint**: User Story 1 is fully functional and independently testable — `npx playwright test e2e/us1-create-and-submit-ncr.spec.js` passes end-to-end against the running stack.

---

## Phase 4: User Story 2 - Full Approval Lifecycle (Priority: P1)

**Goal**: Automated, single-run coverage of disposition → QA concurrence (both paths) → approver return-for-comment/resubmit → closure → final distribution, plus the Traveler sign-off closure block.

**Independent Test**: `npx playwright test e2e/us2-approval-lifecycle.spec.js` — creates and drives its own NCR(s) through every transition, independent of other spec files.

- [ ] T018 [US2] In `e2e/us2-approval-lifecycle.spec.js`, write the disposition-submission test (Acceptance Scenario 1): create an NCR, use `exec-cli.js`'s `set-ce-cs` to assign the primary persona as CE/CS (the creation form has no real CE/CS lookup, per research.md Decision 2), submit a disposition (parts disposition, root cause, preventive actions, and rework/repair instructions when the disposition requires them) through the UI, and assert the NCR reaches "Dispositioned" status with a QA notification recorded
- [ ] T019 [US2] In the same file, write the QA-concurrence-no-approvers test (Acceptance Scenario 2): use `exec-cli.js`'s `grant-role`/`add-group-member` to make the primary persona QA staff, record concurrence with no additional approvers on a Dispositioned NCR, and assert the NCR reaches "Final Approval" with an issuance notification recorded
- [ ] T020 [US2] In the same file, write the QA-concurrence-with-approver test (Acceptance Scenario 3): record concurrence designating the **secondary** persona's user id as an additional approver, and assert the NCR reaches "Approved" with an approval-request notification recorded for that approver
- [ ] T021 [US2] In the same file, write the return-for-comment / resubmit round-trip test (Acceptance Scenario 4): using the `secondary` Playwright project (the approver's own `storageState`), return an Approved NCR for comment and assert it reaches "Returned for Comment"; then, back on the `primary` project as QA, resubmit and assert it returns to "Approved"
- [ ] T022 [US2] In the same file, write the closure and final-distribution test (Acceptance Scenario 5): bring an NCR to "Final Approval" (reusing the T019 no-approvers path), submit closure with notes through the UI, and assert the NCR reaches "Closed" with a closure record persisted and a final-distribution notification recorded for the required recipient groups
- [ ] T023 [US2] In the same file, write the Traveler-linked sign-off-blocks-closure test (Acceptance Scenario 6): use `exec-cli.js`'s `create-traveler-linked-ncr` to create an NCR with `traveler_link.initiated_from_traveler = true` already in Final Approval (bypassing the earlier lifecycle steps directly via the fixture, consistent with `test-e2e/us5-ncr-issuance-and-execution.md`'s existing approach for this same precondition), attempt closure without the Traveler sign-off confirmation and assert it is blocked, then supply the confirmation and assert closure succeeds

**Checkpoint**: User Story 2 is fully functional and independently testable — the full disposition-through-closure lifecycle passes in one run.

---

## Phase 5: User Story 3 - Programmatic Test Fixture Provisioning (Priority: P1)

**Goal**: Direct verification that every fixture CLI command (built in Phase 2) produces the exact database state the other stories rely on, plus verification of the cross-run isolation strategy itself.

**Independent Test**: `npx playwright test e2e/us3-fixture-provisioning.spec.js` — provisions and immediately reads back each fixture type in isolation, independent of any NCR lifecycle state from other files.

- [ ] T024 [US3] In `e2e/us3-fixture-provisioning.spec.js`, write the role/group fixture test (Acceptance Scenario 1): call `grant-role` and `add-group-member` via `exec-cli.js`, then call `get-user`/`get-group` and assert the returned `roles`/`members` reflect the grant; repeat for `reset-user-roles`/`remove-group-member` and assert the reverse
- [ ] T025 [US3] In the same file, write the CE/CS-assignment fixture test (Acceptance Scenario 2): create an NCR, call `set-ce-cs`, then call `get-ncr` and assert `ce_cs_id` matches before any disposition is attempted
- [ ] T026 [US3] In the same file, write the backdating fixture test (Acceptance Scenario 3): create an NCR, call `backdate-ncr` with a `daysAgo` value, then call `get-ncr` and assert `created_at` (the field the dashboard's escalation logic actually reads, per `contracts/fixture-cli.md`) reflects the requested offset
- [ ] T027 [US3] In the same file, write the Traveler-linked-NCR fixture test (Acceptance Scenario 4): call `create-traveler-linked-ncr`, then call `get-ncr` and assert `traveler_link.initiated_from_traveler === true` and the supplied `traveler_id`/`step_number` are persisted
- [ ] T028 [US3] In the same file, write the cross-run isolation test (Acceptance Scenario 5): create two NCRs tagged with two different `run-id.js`-generated suffixes (simulating two separate runs' data coexisting in the same database), then assert a dashboard/API query scoped to one run's suffix returns exactly that run's NCR and not the other's — proving the isolation strategy from research.md Decision 5 actually holds against real leftover data

**Checkpoint**: User Story 3 is fully functional and independently testable — every fixture command Stories 1, 2, and 4 depend on is verified correct in isolation.

---

## Phase 6: User Story 4 - Reporting, Dashboard, and Preventive Action Tracking (Priority: P2)

**Goal**: Automated coverage of dashboard status counts, filters, the 30-day escalation flag, and the preventive-action lifecycle (owner assignment, status updates, closure).

**Independent Test**: `npx playwright test e2e/us4-reporting-and-preventive-actions.spec.js` — provisions and creates its own NCRs/preventive actions, independent of other spec files.

- [ ] T029 [US4] In `e2e/us4-reporting-and-preventive-actions.spec.js`, write the dashboard status-count test (Acceptance Scenario 1): create NCRs (or drive them, reusing patterns from US2) across at least two distinct statuses tagged with this scenario's `runId`, load the dashboard, and assert the status counts reflect them (scoping any count comparison to `runId`-tagged data per Decision 5, not global counts)
- [ ] T030 [US4] In the same file, write the dashboard filter test (Acceptance Scenario 2): create NCRs with distinct part numbers, suppliers, dates, and disposition types (all `runId`-scoped), apply each dashboard filter, and assert only the matching NCR(s) are returned
- [ ] T031 [US4] In the same file, write the escalation-flag test (Acceptance Scenario 3): use `exec-cli.js`'s `backdate-ncr` with `daysAgo: 31`, load the dashboard, and assert that NCR is flagged for escalation
- [ ] T032 [US4] In the same file, write the preventive-action owner-assignment test (Acceptance Scenario 4): on a Dispositioned NCR with preventive actions (reusing the T018 disposition flow), assign an owner and target date through the UI, and assert the owner-assignment notification is sent (via `mailpit.js`) and recorded (via `get-ncr`)
- [ ] T033 [US4] In the same file, write the preventive-action status-update-and-close test (Acceptance Scenario 5): update a preventive action's status, then close it, and assert each transition is recorded with a status-history entry and the action reaches "Completed"

**Checkpoint**: User Story 4 is fully functional and independently testable.

---

## Phase 7: User Story 5 - Access Control and Input Validation (Priority: P2)

**Goal**: Automated coverage confirming role-gated NCR actions and input validation are enforced.

**Independent Test**: `npx playwright test e2e/us5-access-control-and-validation.spec.js` — attempts restricted actions/invalid input independent of other spec files' NCR state.

- [ ] T034 [US5] In `e2e/us5-access-control-and-validation.spec.js`, write the unauthorized-action-rejected test (Acceptance Scenario 1): using `exec-cli.js`'s `reset-user-roles` to ensure the primary persona lacks the required role/assignment, attempt at least submitting disposition, recording QA concurrence, and approving on NCRs where that persona is not the assigned actor, and assert each is rejected with an authorization error and no state change (verified via `get-ncr`)
- [ ] T035 [US5] In the same file, write the not-found test (Acceptance Scenario 2): request a non-existent NCR id and assert a not-found response
- [ ] T036 [US5] In the same file, write the invalid-input-validation test (Acceptance Scenario 3): submit NCR creation with a non-positive quantity, a future discovery date, and a missing required field (as separate cases), and assert each is rejected with a validation error identifying the offending field

**Checkpoint**: User Story 5 is fully functional and independently testable.

---

## Phase 8: User Story 6 - Failure Diagnostics and Consolidated Run Report (Priority: P2)

**Goal**: Verification that a failing scenario actually produces usable diagnostics, and that the suite's reporting/single-scenario-invocation guarantees (FR-007, FR-008, FR-011) hold.

**Independent Test**: `npx playwright test e2e/us6-failure-diagnostics.spec.js` — deliberately forces a failure and inspects the produced artifacts, independent of other spec files.

- [ ] T037 [US6] In `e2e/us6-failure-diagnostics.spec.js`, write a deliberately-failing test (Acceptance Scenario 1) — e.g. asserting on a non-existent page element — then, in a separate assertion step (or a small Node script this test shells out to), confirm Playwright wrote a trace file, a video, and a screenshot for that failing test under `test-results/`
- [ ] T038 [US6] In the same file, write a test that runs a small, known-passing subset of the suite as a child process (`npx playwright test <one file>`) and asserts the resulting `playwright-report/results.json` contains a per-scenario pass/fail entry and an overall summary (Acceptance Scenario 2)
- [ ] T039 [US6] In the same file, write a test that runs a single named scenario via `npx playwright test <file> -g "<name>"` as a child process and asserts only that scenario appears in the resulting report, not the whole file's scenario set (Acceptance Scenario 3)

**Checkpoint**: All 6 user stories are independently functional. Full suite (`npm run e2e`) covers every scenario in the spec's Coverage Mapping table.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Consistency, documentation, and a real end-to-end validation run.

- [ ] T040 [P] Run `npx eslint e2e/` and fix any reported issues; confirm `e2e/**/*.js` conforms to the repo's existing Prettier configuration
- [ ] T041 [P] Add a short `e2e/README.md` (or extend `test-e2e/README.md`) cross-linking to `specs/002-playwright-e2e-tests/quickstart.md` and clarifying the manual suite (`test-e2e/`) and this automated suite (`e2e/`) are both maintained, per spec.md's Assumptions
- [ ] T042 Run `npm run e2e` end-to-end against the running local Docker stack per quickstart.md, confirm all 6 spec files pass, and record the actual wall-clock duration against SC-006's ~15-minute target
- [ ] T043 Run `npm run e2e` a second consecutive time (no manual cleanup in between) and confirm the result matches the first run, validating SC-003 (repeat-run consistency) and FR-009 (no cross-run interference) against the real shared database
- [ ] T044 [P] Reconcile spec.md's Coverage Mapping table against the final `e2e/*.spec.js` file names if any diverged during implementation

**Checkpoint**: Suite is lint-clean, documented, and empirically validated twice in a row against the real local stack.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories (every story's spec file imports `e2e/fixtures/env.js`, `exec-cli.js`, and/or `mailpit.js`, and runs under `e2e/playwright.config.js`)
- **US1 (Phase 3)**: Depends on Foundational only
- **US2 (Phase 4)**: Depends on Foundational; T023 additionally depends on the `create-traveler-linked-ncr` fixture command (built in T009, verified in T027) — no dependency on US1's spec file itself
- **US3 (Phase 5)**: Depends on Foundational only — verifies the fixture CLI built in Phase 2, not anything from US1/US2
- **US4 (Phase 6)**: Depends on Foundational; T032 reuses the disposition pattern established in T018 (US2) for convenience but could construct its own Dispositioned NCR independently if built first
- **US5 (Phase 7)**: Depends on Foundational only
- **US6 (Phase 8)**: Depends on Foundational (needs `playwright.config.js`'s trace/video/screenshot settings from T012) and benefits from at least one other story's spec file existing to use as the "known-passing subset" in T038, but does not require any specific story
- **Polish (Phase 9)**: Depends on all six user story phases

### User Story Dependencies

| Story | Can Start After | Depends On |
|---|---|---|
| US1 (Phase 3) | Phase 2 | None |
| US2 (Phase 4) | Phase 2 | None (T023 uses a Phase 2 fixture command, not US1/US3's spec files) |
| US3 (Phase 5) | Phase 2 | None |
| US4 (Phase 6) | Phase 2 | None (T032 conveniently reuses US2's disposition pattern but is not blocked by it) |
| US5 (Phase 7) | Phase 2 | None |
| US6 (Phase 8) | Phase 2 | None (T038 is easiest once at least one other story's file exists, but not required) |

All six user-story phases are independent of one another once Phase 2 is
complete — consistent with each story's "Independent Test" clause in spec.md.
They may be implemented in any order or in parallel by different people; the
phase numbering above simply follows spec.md's stated priority order
(US1, US2, US3 = P1; US4, US5, US6 = P2).

### Within Each User Story

- All tasks within one story's `.spec.js` file are sequential (same file) — not marked `[P]` against each other
- A story's tasks are marked `[P]` against tasks in a *different* story's file once Phase 2 is complete

### Parallel Opportunities

- Setup: T003, T004, T005 are `[P]` (distinct files, no dependency on each other)
- Foundational: T006, T007, T008 are `[P]` (distinct files); T009 depends on none of them but touches its own file; T010 depends on T009 existing (wraps it) so is not marked `[P]`; T011 depends on T006 (env resolution); T012 depends on T006 and T011
- Once Phase 2 is complete, the first task of each user story (T013, T018, T024, T029, T034, T037) can be treated as `[P]` relative to each other — different files, no shared dependency — enabling up to six people/agents to work Phases 3–8 simultaneously
- Polish: T040, T041, T044 are `[P]`; T042 and T043 are sequential (T043 depends on T042 having run first) and depend on all story phases being complete

---

## Parallel Example: Foundational Phase

```bash
# After T001/T002 (directories + install), launch these together:
Task: "Create e2e/fixtures/env.js"
Task: "Create e2e/fixtures/run-id.js"
Task: "Create e2e/fixtures/mailpit.js"

# Then, once T009 (fixture CLI) and T006 (env.js) exist:
Task: "Create e2e/fixtures/exec-cli.js (depends on T009)"
Task: "Create e2e/global-setup.js (depends on T006)"
```

## Parallel Example: User Story Phases (post-Foundational)

```bash
# Six independent agents/developers, each starting a different story's first task:
Task: "T013 [US1] NCR creation and validation tests in e2e/us1-create-and-submit-ncr.spec.js"
Task: "T018 [US2] Disposition-submission test in e2e/us2-approval-lifecycle.spec.js"
Task: "T024 [US3] Role/group fixture test in e2e/us3-fixture-provisioning.spec.js"
Task: "T029 [US4] Dashboard status-count test in e2e/us4-reporting-and-preventive-actions.spec.js"
Task: "T034 [US5] Unauthorized-action-rejected test in e2e/us5-access-control-and-validation.spec.js"
Task: "T037 [US6] Deliberately-failing test in e2e/us6-failure-diagnostics.spec.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks every story)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: `npx playwright test e2e/us1-create-and-submit-ncr.spec.js` passes against the running local stack; open `playwright-report/index.html` and confirm all 6 scenarios (T013–T017) are green
5. This alone already replaces the most tedious/error-prone part of the manual suite (`test-e2e/us1*.md`, `us1.5*.md`, `us1.6*.md`)

### Incremental Delivery

| Milestone | Phases | Deliverable |
|---|---|---|
| Foundation | 1 + 2 | Fixture CLI, Mailpit helper, auth, Playwright config all working |
| MVP | + 3 (US1) | Creation + notification emails automated (replaces 3 manual files) |
| Core lifecycle | + 4 (US2) | Full disposition→closure chain automated (replaces 4 manual files) |
| Self-verifying fixtures | + 5 (US3) | Fixture CLI's own correctness independently proven |
| Reporting | + 6 (US4) | Dashboard/filters/PA tracking automated (replaces 2 manual files) |
| Access control | + 7 (US5) | Security/validation regressions automated (replaces 1 manual file) |
| Diagnosability | + 8 (US6) | Failure artifacts and reporting guarantees proven |
| Hardened | + 9 | Lint-clean, documented, validated twice against the live stack |

### Parallel Team Strategy

With multiple developers, once Phase 2 (Foundational) is done:

- Developer A: US1 (Phase 3)
- Developer B: US2 (Phase 4)
- Developer C: US3 (Phase 5)
- Developer D: US4 (Phase 6)
- Developer E: US5 (Phase 7)
- Developer F: US6 (Phase 8)

All six integrate independently — none of them edit the same file, and per
spec.md's Independent Test clauses, none depends on another's NCR/data state.

---

## Notes

- `[P]` tasks touch different files with no dependency on an incomplete task
- `[Story]` label maps every user-story-phase task to its spec.md story for traceability
- Every scenario that creates an NCR (or other document) MUST tag it with `run-id.js`'s per-run suffix (data-model.md's Test Scenario rule) — this is what makes T043's repeat-run validation meaningful
- The fixture CLI (T009) bypasses the app's own service-layer validation by design — it provisions preconditions, it does not exercise business logic (research.md Decision 2; plan.md's Constitution Check Security-First note)
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently before continuing
