# Tasks: Automated Playwright E2E Test Suite for the Local Docker Stack

**Input**: Design documents from `/specs/005-playwright-e2e-tests/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/fixture-routes.md, quickstart.md

**Tests**: This feature's deliverable *is* the test suite. Each user story's
`e2e/us<N>-*.spec.js` file is the implementation of that story's acceptance
scenarios, so no separate test-first tasks are generated. Each phase ends with
a checkpoint task that runs the story's spec file and verifies its results.

**Organization**: Tasks are grouped by user story (spec.md, P1 then P2) so each
story can be implemented, run, and validated on its own once Foundational is done.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: The user story this task serves (US1–US6); Setup, Foundational, and Polish tasks have no story label
- Every task names the exact file it changes

## Conventions used in every spec file

- Each `e2e/us<N>-*.spec.js` file starts with a comment naming which persona plays
  which role (primary = owner and admin, secondary = reviewer or ordinary user).
- Every artifact a scenario creates is recorded with `artifact-registry.js` at the
  moment its creating call succeeds (research.md Decision 8), so cleanup can find it.
- Every spec file's `test.afterEach` runs the undo functions returned by role and
  group fixtures, then `cleanOut` for artifacts the test registered (FR-013). Tasks
  that add a scenario do not repeat this hook; the hook is added once per file in
  that file's first task.
- Tasks in the same spec file are not marked [P], because they edit the same file.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencies, npm script, ignore rules, and documentation for the new variables.

- [ ] T001 Add `@playwright/test` as a devDependency in package.json (`npm install -D @playwright/test`) and add an `"e2e": "playwright test --config=e2e/playwright.config.js"` script to package.json
- [ ] T002 Add `playwright-report/`, `test-results/`, and `e2e/.auth/` to .gitignore
- [ ] T003 [P] Add an "End-to-end tests" section to docker.md documenting `E2E_USER`, `E2E_PASS`, `E2E_USER2`, `E2E_PASS2`, `E2E_USER_NAME`, `E2E_USER2_NAME`, `WEB_PORT`, `API_PORT`, and that the primary user must already hold the `admin` role

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Runtime, authentication, shared fixture helpers, cleanup, and teardown.
All user-story phases depend on this phase.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Create e2e/fixtures/env.js that parses the repo-root `.env` file with a small KEY=VALUE reader (no new dependency; shell variables override `.env`) and exports `WEB_PORT` (default 3001), `API_PORT` (default 3002), `baseURL`, and the primary and secondary personas (login id, password, AD display name)
- [ ] T005 Create e2e/playwright.config.js: `testDir` is `e2e`, `baseURL` comes from `fixtures/env.js`, `workers: 1` (see plan.md — role and group mutations on shared personas are unsafe across parallel files; relax only after proving isolation), `fullyParallel: false`, `globalSetup` and `globalTeardown` set, default `storageState` is `e2e/.auth/primary.json`, `trace`/`video`/`screenshot` set to retain-on-failure, reporters are HTML (`playwright-report/`) and JSON (`playwright-report/results.json`)
- [ ] T006 [P] Create e2e/fixtures/run-id.js exporting `runId()`, which returns a fresh unique tag per call (timestamp plus random suffix), used in every form, traveler, and binder title a scenario creates
- [ ] T007 [P] Create e2e/fixtures/auth-state.js exporting `PRIMARY_AUTH_STATE` and `SECONDARY_AUTH_STATE` (paths under `e2e/.auth/`)
- [ ] T008 Create e2e/fixtures/api-client.js: `clientFor(persona)` returns a Playwright `request` context built with that persona's saved storageState and the configured base URL; `call(persona, method, path, body)` throws an Error naming the method, path, HTTP status, and response body on any non-2xx response (depends on T004, T007)
- [ ] T009 [P] Create e2e/fixtures/artifact-registry.js: `record({kind, id, title, ownerPersona, scenarioName, dependsOn})`, `markArchived(id)`, `markFailed(id, error)`, `pending(runId)`, and `dependentsFirst(records)` (order: binder, traveler, form, releasedForm); persists to `e2e/.auth/runs/<runId>.json` with synchronous writes so a crash leaves a trail
- [ ] T010 Create e2e/global-setup.js: (1) check the web app answers at `baseURL` and fail with a message naming the web app if not; (2) log in as the primary and secondary persona through `POST /ldaplogin/` (form fields `username`, `password`) and fail with a message naming LDAP if either login fails; (3) fail if the primary persona lacks the `admin` role (`GET /users/<primary id>/json`); (4) save each session to `e2e/.auth/primary.json` and `e2e/.auth/secondary.json`; (5) generate a run id and set `process.env.E2E_RUN_ID` so workers and teardown share it (depends on T004, T005, T007, T008, T009)
- [ ] T011 [P] Create e2e/fixtures/roles.js exporting `getUserRoles(persona, userId)`, `grantRole(actingPersona, userId, role)`, and `removeRole(actingPersona, userId, role)`; each write reads the current roles first, then PUTs the full array to `PUT /users/:id` (the route replaces the array), and `grantRole`/`removeRole` return an `undo()` that restores the previous roles (depends on T008)
- [ ] T012 [P] Create e2e/fixtures/forms.js exporting `createForm(ownerPersona, {title, html})` (`POST /forms/`), `submitForReview` (`PUT /forms/:id/status` `{status: 0.5, version}`), `addReviewRequest` (`POST /forms/:id/review/requests` with `uid` and `name`), `removeReviewRequest` (`DELETE /forms/:id/review/requests/:requestId`), `submitReviewResult(reviewerPersona, formId, approve|requestChanges)` (`POST /forms/:id/review/results` with `result` `"1"` or `"2"`), `releaseForm(ownerPersona, formId)` (`PUT /forms/:id/released`), and `createReleasedForm(ownerPersona, reviewerPersona, opts)` chaining them; depends on T008
- [ ] T013 [P] Create e2e/fixtures/travelers.js exporting `createTravelerFromReleasedForm(persona, releasedFormId)` (`POST /travelers/` with `form`), `setTravelerStatus(persona, travelerId, status)` (`PUT /travelers/:id/status`), and `enterTravelerData(persona, travelerId, {name, value, type})` (`POST /travelers/:id/data/`; the route only accepts this while the traveler is active, status 1); depends on T008
- [ ] T014 [P] Create e2e/fixtures/sharing.js exporting `shareWithUser(ownerPersona, docType, docId, {displayName, access})`, `shareWithGroup(ownerPersona, docType, docId, {groupId, access})`, `setPublicAccess(ownerPersona, docType, docId, access)`, and `transferOwnership(persona, docType, docId, newOwnerDisplayName)`, where `docType` is `forms`, `travelers`, or `binders` and maps to the matching `/share/` and `/owner` routes in contracts/fixture-routes.md; depends on T008
- [ ] T015 [P] Create e2e/fixtures/groups.js exporting `createGroup(adminPersona, name)` (`POST /groups/`), `addGroupMember(adminPersona, groupId, displayName)` (`PUT /groups/:id/addmember/:displayName`, which resolves the name through LDAP), and `removeGroupMembers(adminPersona, groupId, [uid])` (`PUT /groups/:id/removeMembers` with `[{_id}]`); depends on T008
- [ ] T016 [P] Create e2e/fixtures/binders.js exporting `createBinder(persona, title)` (`POST /binders/`), `addTravelersToBinder(persona, binderId, travelerIds)` (`POST /binders/:id/` with `{ids, type: 'traveler'}`; the binder must be status 0 or 1), `listBinderWorks(persona, binderId)` (`GET /binders/:id/works/json`), and `removeBinderWork(persona, binderId, workId)` (`DELETE /binders/:id/works/:wid`); depends on T008
- [ ] T017 Create e2e/fixtures/cleanup.js exporting `cleanOut(record)` and `cleanOutAll(records)`; `cleanOut` archives by kind per contracts/fixture-routes.md (binder `PUT /binders/:id/status` `{status: 3}`, traveler `PUT /travelers/:id/archived` `{archived: true}`, form `PUT /forms/:id/archived` after removing review requests if status is `0.5`, released form `GET /released-forms/:id/json` for `ver` then `PUT /released-forms/:id/status` `{status: 2, version}`), runs as `record.ownerPersona`, marks the registry entry archived or failed; `cleanOutAll` processes records in `dependentsFirst` order and never stops at the first failure (depends on T008, T009)
- [ ] T018 Create e2e/global-teardown.js: run `cleanOutAll` on every `pending` registry entry for `process.env.E2E_RUN_ID`, then write the entries still marked `failed` to `playwright-report/cleanup-failures.json` (depends on T009, T010, T017)
- [ ] T019 Checkpoint: run `npm run e2e -- --list` and confirm the config loads with no errors; stop the web container and confirm `npm run e2e` fails within seconds naming the web app; set a wrong `E2E_PASS` and confirm the failure names LDAP (verify manually in e2e/global-setup.js flow; no file change)

**Checkpoint**: Foundation ready. Every user story below can start; they only share fixtures and not spec files, so separate people can take stories in parallel.

---

## Phase 3: User Story 1 - Form Authoring and Release Lifecycle (Priority: P1) 🎯 MVP

**Goal**: One command verifies that a form can be drafted, sent for review, approved by a designated reviewer, released into a snapshot, and archived.

**Independent Test**: `npm run e2e -- e2e/us1-form-lifecycle.spec.js` passes, and afterwards no form created by that run is in the active lists.

- [ ] T020 [US1] Create e2e/us1-form-lifecycle.spec.js with the persona comment, the shared `test.afterEach` cleanup hook (Conventions above), and Acceptance Scenario 1: owner creates a draft form titled with `runId()` and at least one input through the new-form page at `/forms/new`; assert status draft (0) and register the form with the registry
- [ ] T021 [US1] Add Acceptance Scenario 2 to e2e/us1-form-lifecycle.spec.js: grant the `reviewer` role to the secondary persona with `grantRole`; owner calls `submitForReview` then `addReviewRequest` with the secondary's login id and display name; assert status under review (0.5), and that the secondary sees the request in `GET /reviews/forms/json`
- [ ] T022 [US1] Add Acceptance Scenario 3 to e2e/us1-form-lifecycle.spec.js: secondary calls `submitReviewResult(…, approve)`; owner calls `releaseForm`; assert status released (1), that `GET /released-forms/:id/json` returns a snapshot whose `base.html` equals the draft's html at release time, and register the released form with `dependsOn` the draft form
- [ ] T023 [US1] Add Acceptance Scenario 4 to e2e/us1-form-lifecycle.spec.js: on a second draft, secondary calls `submitReviewResult(…, requestChanges)`; assert the form reverts to draft (0) and `GET /forms/:id/json` shows no review requests; assert `releaseForm` is rejected with 400 until the form is resubmitted and approved again
- [ ] T024 [US1] Add Acceptance Scenario 5 to e2e/us1-form-lifecycle.spec.js: for a released form, `PUT /forms/:id/` with an html change returns 400 (the route only allows status 0), and the released snapshot's html is unchanged afterwards
- [ ] T025 [US1] Add Acceptance Scenario 6 to e2e/us1-form-lifecycle.spec.js: `createForm` without a title returns 400; assert no new form with this run's tag appears in `GET /forms/json`
- [ ] T026 [US1] Add Acceptance Scenario 7 to e2e/us1-form-lifecycle.spec.js: owner archives the released form with `PUT /released-forms/:id/status` `{status: 2, version}`; assert it no longer appears in the active released-forms list (the data source of the `/releasedforms/` page, `routes/form.js:56`) and is still readable from the archive
- [ ] T027 [US1] Checkpoint: run `npm run e2e -- e2e/us1-form-lifecycle.spec.js`; all seven scenarios pass; afterwards `GET /forms/json` and the released-forms list filtered by this run's tag are empty

---

## Phase 4: User Story 2 - Traveler Data-Entry and Completion Lifecycle (Priority: P1)

**Goal**: Verify a traveler created from a released form can receive data, be submitted for completion, be approved or rejected by an admin or manager only, and be frozen and unfrozen.

**Independent Test**: `npm run e2e -- e2e/us2-traveler-lifecycle.spec.js` passes, and no traveler created by that run is in the active lists afterwards.

- [ ] T028 [US2] Create e2e/us2-traveler-lifecycle.spec.js with the persona comment, the `test.afterEach` cleanup hook, and Acceptance Scenario 1: `createReleasedForm` (T012) provides a released form, then `createTravelerFromReleasedForm` creates a traveler; assert it exists with the form's fields copied; register it with `dependsOn` the released form
- [ ] T029 [US2] Add Acceptance Scenario 2 to e2e/us2-traveler-lifecycle.spec.js: `enterTravelerData` on an active traveler; assert the value, `inputBy` as the primary persona, and `inputOn` are present in `GET /travelers/:id/keyvalue/json`
- [ ] T030 [US2] Add Acceptance Scenario 3 to e2e/us2-traveler-lifecycle.spec.js: primary calls `setTravelerStatus(…, 1.5)`; assert status is submitted for completion (1.5)
- [ ] T031 [US2] Add Acceptance Scenario 4 to e2e/us2-traveler-lifecycle.spec.js: primary (admin) calls `setTravelerStatus(…, 2)` and asserts status completed (2); on a second traveler, submitted and rejected with status 1 asserts active (1)
- [ ] T032 [US2] Add Acceptance Scenario 5 to e2e/us2-traveler-lifecycle.spec.js: secondary is given write access to a traveler submitted for completion using `shareWithUser` with `access: 'write'`, and holds neither `admin` nor `manager` (remove them with `removeRole` if present); its approve and reject calls both return 403 and the traveler stays at 1.5. Without the write share the request would fail for a different reason, so the share is required for this check to be meaningful
- [ ] T033 [US2] Add Acceptance Scenario 6 to e2e/us2-traveler-lifecycle.spec.js: on an active traveler, primary sets status frozen (3) and asserts `enterTravelerData` is rejected while frozen; unfreezing (3 → 1) succeeds; a direct completed-to-frozen attempt (2 → 3) returns 400
- [ ] T034 [US2] Checkpoint: run `npm run e2e -- e2e/us2-traveler-lifecycle.spec.js`; all six scenarios pass; afterwards the active traveler list filtered by this run's tag is empty

---

## Phase 5: User Story 3 - Fixture Provisioning and Cleanup (Priority: P1)

**Goal**: Verify each fixture helper produces the state it promises, and that cleanup archives run-created records after pass, after failure, in dependency order, and reports cleanup failures.

**Independent Test**: `npm run e2e -- e2e/us3-fixture-provisioning.spec.js` passes, and the run leaves no active run-created artifacts.

- [ ] T035 [US3] Create e2e/us3-fixture-provisioning.spec.js with the persona comment, the `test.afterEach` cleanup hook, and Acceptance Scenario 1: `grantRole(…, 'manager')` on the secondary persona, then assert via `getUserRoles` that the role is present and that a previously held role is still present (read-then-write preserves other roles); the undo restores the original roles
- [ ] T036 [US3] Add Acceptance Scenario 2 to e2e/us3-fixture-provisioning.spec.js: `createReleasedForm` returns a released form with status 1 and a snapshot in `GET /released-forms/:id/json`
- [ ] T037 [US3] Add Acceptance Scenario 3 to e2e/us3-fixture-provisioning.spec.js: on a draft form, `shareWithUser`, `shareWithGroup` (with a group from `createGroup` and `addGroupMember` for the secondary), and `setPublicAccess`; assert each shows up in `GET /forms/:id/share/users/json`, `…/groups/json`, and the form's `publicAccess`
- [ ] T038 [US3] Add Acceptance Scenario 4 to e2e/us3-fixture-provisioning.spec.js: a traveler is pre-positioned at submitted for completion (1.5) with `setTravelerStatus` in one call, with no UI data entry or submit step in the test
- [ ] T039 [US3] Add Acceptance Scenario 5 to e2e/us3-fixture-provisioning.spec.js: create two forms with two different `runId()` values; assert a `GET /forms/json` filter by one tag returns exactly one match and never the other run's form
- [ ] T040 [US3] Add Acceptance Scenario 6 to e2e/us3-fixture-provisioning.spec.js: a scenario-level step creates a form and a traveler, then the test finishes passing; after the test, `cleanOut` archives both (`GET /archivedforms/json` and `GET /archivedtravelers/json` contain them; the active lists do not)
- [ ] T041 [US3] Add Acceptance Scenario 7 to e2e/us3-fixture-provisioning.spec.js: a test that deliberately fails after creating a form is annotated with `test.fail()`; afterwards the form is archived by the cleanup hook, proving cleanup runs on the failure path
- [ ] T042 [US3] Add Acceptance Scenario 8 to e2e/us3-fixture-provisioning.spec.js: create a binder with `createBinder`, add a traveler with `addTravelersToBinder`, and call `cleanOutAll`; assert the cleanup order records the binder's archive before the traveler's (read the registry's `archivedAt` values from e2e/.auth/runs/<runId>.json)
- [ ] T043 [US3] Add Acceptance Scenario 9 to e2e/us3-fixture-provisioning.spec.js: a form created by the secondary persona is cleaned with an invalid session file; assert the registry entry is `failed` with an error message; then `cleanOut` with the valid secondary session archives it and the entry is `archived`
- [ ] T044 [US3] Add Acceptance Scenario 10 to e2e/us3-fixture-provisioning.spec.js: after cleanup, a run-tag filter returns zero active forms, travelers, and binders, and the same records appear in the archived lists `GET /archivedforms/json`, `/archivedtravelers/json`, `/archivedbinders/json`
- [ ] T045 [US3] Checkpoint: run `npm run e2e -- e2e/us3-fixture-provisioning.spec.js`; all ten scenarios pass; the active lists are empty for this run's tag

---

## Phase 6: User Story 4 - Access Control (Priority: P2)

**Goal**: Verify the layered permission model: no access by default, sharing with a user, sharing with a group, public access, and the admin or manager blanket role.

**Independent Test**: `npm run e2e -- e2e/us4-access-control.spec.js` passes, and the run leaves no active artifacts.

- [ ] T046 [US4] Create e2e/us4-access-control.spec.js with the persona comment (primary owns the form; secondary is the restricted user), the `test.afterEach` cleanup hook, and Acceptance Scenario 1: `GET /forms/:id/json` as the secondary returns 403 for a private form owned by the primary; register the form
- [ ] T047 [US4] Add Acceptance Scenario 2 to e2e/us4-access-control.spec.js: before sharing, secondary gets 403; `shareWithUser` with `access: 'read'`, then secondary gets 200; after revoking the share (`DELETE /forms/:id/share/users/:shareid`), secondary gets 403 again. Note in the test that exclusion of an unrelated third user is out of scope (spec Assumptions)
- [ ] T048 [US4] Add Acceptance Scenario 3 to e2e/us4-access-control.spec.js: `createGroup`, `addGroupMember` for the secondary's display name, `shareWithGroup` with `read`; secondary gets 200; `removeGroupMembers` for the secondary; secondary gets 403
- [ ] T049 [US4] Add Acceptance Scenario 4 to e2e/us4-access-control.spec.js: `setPublicAccess(…, 0)`; secondary gets 200 with no share; `setPublicAccess(…, -1)`; secondary gets 403
- [ ] T050 [US4] Add Acceptance Scenario 5 to e2e/us4-access-control.spec.js: `grantRole(…, 'manager')` on the secondary; the secondary reads the unshared private form (200); the undo removes the manager role; the form is no longer readable (403)
- [ ] T051 [US4] Checkpoint: run `npm run e2e -- e2e/us4-access-control.spec.js`; all five scenarios pass; the run's active artifacts are empty

---

## Phase 7: User Story 5 - Binder Management (Priority: P2)

**Goal**: Verify binder membership is exactly what was added and removed, and that binder sharing follows the same rules as forms and travelers.

**Independent Test**: `npm run e2e -- e2e/us5-binder-management.spec.js` passes, and the run leaves no active binders or travelers.

- [ ] T052 [US5] Create e2e/us5-binder-management.spec.js with the persona comment, the `test.afterEach` cleanup hook, and Acceptance Scenario 1: create two travelers from a released form, `createBinder`, `addTravelersToBinder` with both traveler ids, and assert `listBinderWorks` returns exactly those two; register the binder (`dependsOn` the travelers) and the travelers
- [ ] T053 [US5] Add Acceptance Scenario 2 to e2e/us5-binder-management.spec.js: `removeBinderWork` for one traveler's work id; assert `listBinderWorks` no longer includes it, and the traveler still exists (`GET /travelers/:id/json`)
- [ ] T054 [US5] Add Acceptance Scenario 3 to e2e/us5-binder-management.spec.js: `shareWithUser` on the binder (read) gives the secondary 200 on `GET /binders/:id/json`, `shareWithGroup` gives the same via a group, `setPublicAccess` 0 and -1 flip the result; mirror the expectations of us4 Scenario 2–4
- [ ] T055 [US5] Checkpoint: run `npm run e2e -- e2e/us5-binder-management.spec.js`; all three scenarios pass; active binder and traveler lists for this run's tag are empty

---

## Phase 8: User Story 6 - Failure Diagnostics and Run Report (Priority: P2)

**Goal**: A failing scenario produces enough evidence to diagnose it without a rerun, and the run output shows per-scenario results, a summary, and cleanup failures in separate sections.

**Independent Test**: With `E2E_FORCE_FAILURE=1`, the forced failure produces a trace, video, and screenshot referenced from the HTML report; cleanup failures appear in their own section.

- [ ] T056 [US6] Create e2e/us6-failure-diagnostics.spec.js with a scenario that fails on purpose only when `E2E_FORCE_FAILURE=1` (otherwise `test.skip`, so the default `npm run e2e` stays green); the failing `expect` carries a message naming the step and the expected versus actual values (Acceptance Scenario 1)
- [ ] T057 [US6] Update e2e/global-teardown.js to print a "Cleanup failures" section after the run summary, listing each failed artifact's kind, id, title, and error, separate from scenario results (Acceptance Scenario 2; FR-015)
- [ ] T058 [US6] Add to e2e/us6-failure-diagnostics.spec.js a check that the single-scenario command works: a `test` named with `AS3` can be selected with `-g AS3` (Acceptance Scenario 3); verify and record the exact command in quickstart.md if it differs
- [ ] T059 [US6] Checkpoint: run `E2E_FORCE_FAILURE=1 npm run e2e -- e2e/us6-failure-diagnostics.spec.js`; confirm trace, video, and screenshot exist under `test-results/`; open `playwright-report/index.html` and confirm per-scenario results; confirm the "Cleanup failures" section prints

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, formatting, and end-to-end validation of the success criteria.

- [ ] T060 [P] Add `npm run e2e` and the single-file form (`npm run e2e -- e2e/<file>.spec.js`) to the Commands section of CLAUDE.md
- [ ] T061 [P] Run `npx prettier --check e2e/` and fix formatting in every file under e2e/ (the repo's existing prettier version is 1.19; use its config)
- [ ] T062 Run `npm run e2e` twice in a row with no manual cleanup in between; confirm both runs have the same pass/fail results (SC-003) and that a run-tag query for active forms, travelers, and binders returns zero after each (SC-007)
- [ ] T063 Time one full `npm run e2e` run and confirm it finishes in under 15 minutes (SC-006); if it does not, record the slowest file and revisit the `workers: 1` decision in e2e/playwright.config.js
- [ ] T064 Walk through quickstart.md steps 1–8 and 7a against the running stack, and fix any step in quickstart.md that does not match what happens

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies. T001 and T002 are sequential edits to different files, so they can run together; T003 is independent.
- **Foundational (Phase 2)**: Depends on Setup. T004 → T005; T008 depends on T004 and T007; T010 depends on T004, T005, T007, T008, T009; T017 depends on T008 and T009; T018 depends on T009, T010, T017. T011–T016 depend only on T008.
- **User stories (Phases 3–8)**: Each depends on Foundational. US1 is the MVP. US2 reuses US1's released-form fixture only through Foundational `createReleasedForm`, so US2 can start as soon as Foundational is done.
- **Polish (Phase 9)**: Depends on every story phase being complete.

### User Story Dependencies

- **US1 (P1)**: Independent after Foundational.
- **US2 (P1)**: Independent after Foundational; does not depend on US1's spec file.
- **US3 (P1)**: Independent after Foundational; it exercises the helpers, so it is most useful alongside US1.
- **US4 (P2)**: Independent after Foundational.
- **US5 (P2)**: Independent after Foundational; uses sharing expectations established in US4 as reference only.
- **US6 (P2)**: Independent after Foundational; T057 edits `global-teardown.js`, which T018 also edits, so run T057 after T018.

### Within Each User Story

- Spec file scaffold and the cleanup hook come first (the first task in each phase).
- Scenarios are added to the same file in order, one per task.
- The checkpoint task comes last.

### Parallel Opportunities

- Phase 1: T003 alongside T001/T002.
- Phase 2: T006, T007, T009 can run together with T004; T011–T016 can run together once T008 is done.
- Across stories: different team members can take US1–US6 in parallel once Foundational is done, since each story owns a separate spec file.
- Phase 9: T060 and T061 in parallel.

---

## Parallel Example: Foundational fixtures

```bash
# After T008 (api-client.js) is complete:
Task: "T011 [P] Create e2e/fixtures/roles.js"
Task: "T012 [P] Create e2e/fixtures/forms.js"
Task: "T013 [P] Create e2e/fixtures/travelers.js"
Task: "T014 [P] Create e2e/fixtures/sharing.js"
Task: "T015 [P] Create e2e/fixtures/groups.js"
Task: "T016 [P] Create e2e/fixtures/binders.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1 (Setup).
2. Complete Phase 2 (Foundational). This is the largest block; it must pass the T019 checkpoint before any story starts.
3. Complete Phase 3 (US1) and stop: run `npm run e2e -- e2e/us1-form-lifecycle.spec.js`.
4. If the form lifecycle passes and cleanup leaves no active forms, the MVP is usable.

### Incremental Delivery

1. Setup + Foundational → infrastructure ready.
2. US1 → run it, validate, stop there if needed.
3. US2 and US3 (P1) → traveler lifecycle, fixture and cleanup verification.
4. US4 and US5 (P2) → access control and binders.
5. US6 (P2) → diagnostics and report sections.
6. Polish → docs, formatting, success-criteria validation.

---

## Notes

- Scenario task descriptions name the route each assertion uses; those routes are verified in contracts/fixture-routes.md.
- Only US6 AS1 uses a deliberate failure, and it is gated behind `E2E_FORCE_FAILURE`; US3 AS7 uses Playwright's `test.fail()`, so neither makes the default run red.
- The open question in spec.md (exclusion of a third, unrelated user) is handled by before-share and after-revoke checks in US4 AS2 and US5 AS3.
