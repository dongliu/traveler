---

description: "Task list for Backfill Traveler Classification Metadata"
---

# Tasks: Backfill Traveler Classification Metadata

**Input**: Design documents from `specs/008-backfill-traveler-metadata/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/api-endpoints.md](contracts/api-endpoints.md), [quickstart.md](quickstart.md)

**Tests**: Included. The feature spec doesn't itself demand TDD, but the project constitution's Development Workflow requires every new `lib/` function to have corresponding tests in `test/lib/` and every modified route to keep smoke coverage of its happy path — both apply here.

**Organization**: Tasks are grouped by user story (both P1) to enable independent implementation and testing of each.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)
- Exact file paths are included in every task description

## Path Conventions

Single project at repository root — this is the existing Express/Mongoose/Jade app described in `CLAUDE.md`. No new top-level directories.

---

## Phase 1: Setup

**Purpose**: Orient on the exact touchpoints before changing anything

- [X] T001 Confirm the current branch and read `specs/008-backfill-traveler-metadata/spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/api-endpoints.md`, and `quickstart.md`; confirm the three existing touchpoints they describe still match the code as-is: `model/traveler.js` (`subsystem`/`device`/`activity`/`referenceReleasedForm`/`referenceReleasedFormVer` fields), `model/released-form.js` (`subsystem`/`device`/`activity`/`ver` fields), and the `updateMetadata` handler for `PUT /released-forms/:id/metadata` in `routes/form-management.js`. All three confirmed unchanged from the plan.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The one piece of shared infrastructure both user stories need before either can be implemented

**⚠️ CRITICAL**: Complete this before starting either user story

- [X] T002 In `routes/form-management.js`, add `const Traveler = mongoose.model('Traveler');` alongside the existing `const Form = mongoose.model('Form');` / `const ReleasedForm = mongoose.model('ReleasedForm');` / `const User = mongoose.model('User');` lines near the top of the file, so the route file can look up travelers. **Correction**: not added — `lib/traveler-metadata.js` (T004) does its own `mongoose.model('Traveler')` lookup internally, the same way `lib/review.js` already does `const User = mongoose.model('User');` at its own top level. `routes/form-management.js` never touches `Traveler` directly (it only calls `travelerMetadata.backfillFromReleasedForm(f)`), so adding an unused `Traveler` binding there would just be dead code / an eslint `no-unused-vars` hit. The actual blocking prerequisite both stories needed was simply that `model/traveler.js` registers the `Traveler` model at app boot (`app.js` already requires it) — already true, nothing to add.

**Checkpoint**: `routes/form-management.js` can now reference the `Traveler` model; both user stories can proceed

---

## Phase 3: User Story 1 - Correcting Old Travelers When Form Metadata Is Fixed (Priority: P1) 🎯 MVP

**Goal**: When an owner or admin fills in a previously-blank classification value on a released form, every existing traveler created from that exact released form that was missing that value gets it automatically.

**Independent Test**: Release a form, create a traveler from it (so its `subsystem`/`device`/`activity` are blank), set the released form's `subsystem`/`device`/`activity`, and verify the traveler's matching blank fields are now filled in.

### Tests for User Story 1 ⚠️

> Write these tests FIRST; confirm they fail before doing T004/T005.

- [X] T003 [P] [US1] In `test/lib/traveler-metadata-test.js` (new file), write unit tests for a `backfillFromReleasedForm(releasedForm)` function exported from `lib/traveler-metadata.js`, following the `sinon`-stubbed-Mongoose pattern already used in `test/lib/review-test.js` (construct real `new Traveler({...})` / `new ReleasedForm({...})` documents, `sinon.stub(Traveler, 'find')` to return fixture documents, `sinon.stub(doc, 'save').resolves(doc)` per document — no real database). Covers:
  - A traveler with `subsystem`/`device`/`activity` all `''` gets all three set to the released form's values when the released form has all three non-blank.
  - A released form with zero matching travelers (`Traveler.find` stub resolves `[]`) resolves cleanly with no error and no `.save()` calls.
  - A released form field that is itself blank (`''`) does not get written onto a traveler even when the traveler's corresponding field is also blank.
  - (Added one beyond the plan) an explicit assertion that `Traveler.find` is called with exactly `{ referenceReleasedForm, referenceReleasedFormVer }` — the clearest unit-level proof of the matching key, reused by T007's reasoning too.

### Implementation for User Story 1

- [X] T004 [US1] Create `lib/traveler-metadata.js` exporting `backfillFromReleasedForm(releasedForm)`: query `Traveler.find({ referenceReleasedForm: releasedForm._id, referenceReleasedFormVer: releasedForm.ver })`; for each traveler returned, for each of `subsystem`, `device`, `activity` independently, if the traveler's current value is blank (`''`, `null`, or `undefined`) **and** `releasedForm`'s value for that field is non-blank, set the traveler's field to the released form's value; call `traveler.save()` only on travelers where at least one field actually changed; the function resolves once every affected traveler has been saved
- [X] T005 [US1] In `routes/form-management.js`, require the new module and, inside `updateMetadata` (the `PUT /released-forms/:id/metadata` handler, line ~187), call `await travelerMetadata.backfillFromReleasedForm(f)` immediately after `await f.saveWithHistory(req.session.userid)` succeeds and before building/sending the `res.status(200).json(out)` response; any error thrown from it propagates to the handler's existing `catch` block (unchanged `500` response). **Correction**: required as the namespace object (`const travelerMetadata = require('../lib/traveler-metadata');`, called as `travelerMetadata.backfillFromReleasedForm(f)`) rather than destructured at require time — this keeps the call a live property lookup, which is what let T010's smoke test stub the function with `sinon.stub(travelerMetadata, 'backfillFromReleasedForm')` regardless of module require order/caching. Same behavior and placement otherwise.
- [X] T006 [US1] Run `npx mocha test/lib/traveler-metadata-test.js` and confirm the tests from T003 now pass against T004/T005. All 6 pass.

**Checkpoint**: User Story 1 is independently functional — manually walking through `quickstart.md` Scenario 1 against a dev instance shows a traveler's previously-blank field populated after editing the released form.

---

## Phase 4: User Story 2 - Existing Traveler Data Is Never Disturbed (Priority: P1)

**Goal**: A traveler's already-set classification values, and travelers belonging to any other released form or version, are never touched by a released form's metadata update.

**Independent Test**: Set a traveler's `subsystem` to a non-blank value, update the released form's `subsystem` to something else, and confirm the traveler's value is unchanged; separately, create travelers from two different released forms/versions and confirm updating one never changes the other's travelers.

### Tests for User Story 2 ⚠️

> Write these tests FIRST; confirm they fail before T008 (if T008 turns out to require any change).

- [X] T007 [P] [US2] In `test/lib/traveler-metadata-test.js`, add unit tests for `backfillFromReleasedForm` covering:
  - A traveler whose `subsystem` is already non-blank is left unchanged — and `.save()` is **not** called on it — even when the released form's `subsystem` is set to a different, non-blank value.
  - A traveler with one non-blank field (e.g. `device`) and two blank fields (`subsystem`, `activity`) ends up with only the two blank fields updated; the non-blank `device` value is untouched.
  - The `Traveler.find` stub's call arguments are asserted to include both `referenceReleasedForm: releasedForm._id` and `referenceReleasedFormVer: releasedForm.ver` — i.e. a traveler whose `referenceReleasedFormVer` doesn't match the released form being updated would never even be included in the query result, so it cannot be modified. (This assertion is the one added under T003, shared by both stories.)

### Implementation for User Story 2

- [X] T008 [US2] Review `lib/traveler-metadata.js` against the T007 tests and the guarantees in `data-model.md`: (a) a field is only ever assigned when it was confirmed blank beforehand, (b) the `Traveler.find` query always filters on both `referenceReleasedForm` and `referenceReleasedFormVer` together. Both guarantees already held from T004 — no code changes were needed; this was a verification pass only, confirmed by T007's tests passing on the first run.
- [X] T009 [US2] Run `npx mocha test/lib/traveler-metadata-test.js` and confirm all tests from both T003 and T007 pass together. All 6 tests in the file pass together.

**Checkpoint**: User Stories 1 and 2 both hold — manually walking through `quickstart.md` Scenarios 2 and 3 confirms an already-set traveler field survives a released form update, and a traveler from a different released form/version is untouched.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Regression safety and final validation across both stories

- [X] T010 [P] Add a route-level smoke check for `PUT /released-forms/:id/metadata` in `test/lib/` (new file `test/lib/released-form-metadata-test.js`), using the "capture the middleware chain and invoke the final handler directly" pattern already established in `test/lib/traveler-approval-test.js` (no supertest in this project), confirming: the response body shape (`{ subsystem, device, activity }`) is unchanged from before this feature, and `backfillFromReleasedForm` (stubbed out) is invoked exactly once after the released form saves. Also added a second case: when `saveWithHistory` itself rejects, `backfillFromReleasedForm` is never called and the handler still responds `500`. Both pass.
- [X] T011 Run `npx eslint .` and `npx prettier --write .` and resolve any issues across `lib/traveler-metadata.js`, `routes/form-management.js`, and the new/modified files under `test/lib/`. **Correction**: `npx eslint .` cannot run in this environment — it fails identically on files this feature never touched (verified against `lib/review.js`). The repo's `.eslintrc` predates ESLint's flat-config switch, but `package.json` pins `"eslint": "^9.9.0"`, which resolved here to `9.39.4` — a version that dropped `.eslintrc` support entirely and requires an `eslint.config.js` the repo doesn't have. This is a pre-existing tooling/environment gap, not something this feature introduced. Ran `npx prettier --write` on the four new/modified files instead (reformatted the two new test files to match the project's Prettier config), then confirmed `npx prettier --check` is clean on all four.
- [X] T012 Run the full `npx mocha test/lib/` suite and confirm no regressions in previously-passing test files. **Correction**: `npx mocha test/lib/` (unqualified) crashes the whole process before any test runs, because `test/lib/ldap-client-test.js` does a top-level `require('../../config/ad.json')`, a file that (per `CLAUDE.md`) lives outside the repo at `../etc/traveler-config/` and isn't present in this worktree — the same pre-existing environment gap `specs/003-form-traveler-metadata/tasks.md`'s T017 already documented, unrelated to this feature. Ran `npx mocha $(ls test/lib/*.js | grep -v ldap-client-test.js)` instead: **310 passing**, 0 failing, including all 6 `traveler-metadata-test.js` cases and both `released-form-metadata-test.js` cases.
- [X] T013 Walk through `quickstart.md` Scenarios 1-5 end-to-end against a running dev instance; check off its Validation Checklist, or document any environment limitation that prevented a live run (as `specs/003-form-traveler-metadata/tasks.md`'s T017 did when `../etc/traveler-config/` wasn't available). **Correction**: same `../etc/traveler-config/` gap as T012 — `node app.js` cannot boot here, so a live walkthrough wasn't possible. Scenarios 1, 2, 3, and 5 are exercised at the unit level by T003/T007's tests (blank-fill, non-overwrite, cross-form/version isolation via the exact-query-args assertion, and the two no-op cases) and by T010's route-level smoke test (end-to-end wiring without a live DB). Scenario 4 (lifecycle-status independence) is true by construction, not just by test: `backfillFromReleasedForm` never reads or writes a traveler's `status` field at all, so its behavior cannot vary by lifecycle state — there is no code path to test. Live quickstart validation should still be run in an environment with the config directory and MongoDB available before this ships.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS both user stories
- **User Story 1 (Phase 3)**: Depends on Foundational completion only
- **User Story 2 (Phase 4)**: Depends on Foundational completion; in practice also depends on T004/T005 existing (US2's tests exercise the same `backfillFromReleasedForm` function US1 builds — see Implementation Strategy below for why these two P1 stories are sequenced rather than parallelized)
- **Polish (Phase 5)**: Depends on both user stories being complete

### Within Each User Story

- Tests (T003, T007) are written before/alongside their story's implementation/verification tasks and must fail first where new behavior is being added
- T004 (the function) before T005 (wiring it into the route)
- Each story's checkpoint is reached only once its own tests pass

### Parallel Opportunities

- T003 and T007 are both `[P]` relative to tasks in *other* phases, but since they edit the same new file (`test/lib/traveler-metadata-test.js`), do not run them concurrently with each other — write T003 fully, then T007
- T010 is `[P]` and touches a different file than T011-T013, so it can run alongside final polish work

---

## Implementation Strategy

### Why US1 and US2 are sequenced, not parallelized, despite both being P1

Both user stories are facets of the same single function (`backfillFromReleasedForm`): "fill a field only if it's blank" and "never touch a field that's already set" are the same conditional viewed from two angles, and "match by id + version" is the one query both stories rely on. Building the function (US1) inherently also implements US2's safety guarantees; US2's own tasks are mostly the tests that pin those guarantees down explicitly so a future change can't regress them. Implementing them in spec order (US1 then US2) avoids two people writing the same function twice.

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: `quickstart.md` Scenario 1 passes
5. This alone already delivers the feature's primary value; Phase 4 hardens it

### Incremental Delivery

1. Setup + Foundational → ready to implement
2. User Story 1 → blank fields get backfilled (MVP)
3. User Story 2 → explicit regression tests confirm nothing else is disturbed
4. Polish → smoke test, lint/format, full suite, manual quickstart pass
