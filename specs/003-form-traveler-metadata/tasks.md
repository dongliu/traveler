# Tasks: Form & Traveler Metadata Fields

**Input**: Design documents from `specs/003-form-traveler-metadata/`

**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅

**Tests**: Not requested — no test tasks included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US4)

---

## Phase 1: Setup

**Purpose**: No new dependencies or project initialization needed. Confirm working branch and verify all design documents are in place.

- [ ] T001 Confirm working branch is `ernest-form-composition` (or create `003-form-traveler-metadata`) and all design docs under `specs/003-form-traveler-metadata/` are readable

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema changes that all four user stories depend on. No user story implementation can begin until both model files are updated.

**⚠️ CRITICAL**: Complete T002 and T003 before starting any Phase 3+ work.

- [ ] T002 [P] Add `subsystem`, `device`, `activity` string fields (default `''`) to the `releasedForm` schema and extend `fieldsToWatch` in the `addHistory` plugin call in `model/released-form.js`
- [ ] T003 [P] Add `subsystem`, `device`, `activity`, `machineArea`, `sector`, `windchillId` string fields (default `''`) to the `traveler` schema and extend `fieldsToWatch` in the Traveler's `addHistory` plugin call in `model/traveler.js`

**Checkpoint**: Both model files updated — user story work can now proceed.

---

## Phase 3: User Story 1 — Provide Metadata When Releasing a Form (Priority: P1) 🎯 MVP

**Goal**: A form owner releasing a draft form is prompted for Subsystem, Device, and Activity; the values are stored on the resulting released form.

**Independent Test**: Create a draft form, trigger the release flow, fill in all three fields, confirm the released form document stores the values and they appear on the detail page. (See `quickstart.md` Scenario 1.)

### Implementation

- [ ] T004 [US1] Update `releaseForm()` in `routes/form.js` (line ~1074) to assign `releasedForm.subsystem = req.body.subsystem || ''`, `releasedForm.device = req.body.device || ''`, `releasedForm.activity = req.body.activity || ''` from the request body before saving
- [ ] T005 [P] [US1] Add Subsystem, Device, and Activity input fields to the release dialog in `views/form-management.jade` (the release modal that already collects title/description)
- [ ] T006 [P] [US1] Update the release-modal submit handler in `public/javascripts/form-builder.js` (or the relevant management JS file) to include the three new fields in the POST body sent to `POST /forms/:id/released`
- [ ] T007 [P] [US1] Display `subsystem`, `device`, and `activity` as labeled read-only fields on the released form detail page in `views/released-form.jade` (shown to all users)

**Checkpoint**: US1 fully functional — releasing a form captures and displays the three classification fields.

---

## Phase 4: User Story 3 — Traveler Inherits Classification at Creation (Priority: P1)

**Goal**: When a traveler is created from a released form, Subsystem, Device, and Activity are automatically copied; Machine Area, Sector, and Windchill ID default to blank.

**Independent Test**: Create a traveler from a released form that has all three fields populated; verify the traveler's detail page shows the inherited values without any manual entry. (See `quickstart.md` Scenario 3.)

### Implementation

- [ ] T008 [US3] In `utilities/routes.js` function `createTraveler` (line ~354), add `subsystem: form.subsystem || ''`, `device: form.device || ''`, `activity: form.activity || ''` to the `new Traveler({...})` constructor call
- [ ] T009 [P] [US3] Add all six metadata fields (`subsystem`, `device`, `activity`, `machineArea`, `sector`, `windchillId`) as labeled display rows to the traveler detail page in `views/traveler.jade` (read-only display for all users at this stage)

**Checkpoint**: US3 fully functional — new travelers inherit classification from their source released form; all six fields are visible on the traveler detail page.

---

## Phase 5: User Story 2 — Edit Classification on an Already-Released Form (Priority: P2)

**Goal**: The form owner and admins can update Subsystem, Device, and Activity on a released form without triggering a re-release; other users see those fields as read-only.

**Independent Test**: Open a released form as owner, edit one field, save, confirm the new value persists and form state remains `released`. Log in as a non-owner and verify no edit controls appear. (See `quickstart.md` Scenario 2.)

### Implementation

- [ ] T010 [US2] Add `PUT /released-forms/:id/metadata` route to `routes/form-management.js` using `reqUtils.isOwnerOrAdminMw('id')` for authorization, `reqUtils.filter('body', ['subsystem', 'device', 'activity'])` to strip unknown fields, and `saveWithHistory(req.session.userid)` to persist; respond `200` with the saved values
- [ ] T011 [P] [US2] In `views/released-form.jade`, replace the read-only display of `subsystem`/`device`/`activity` (from T007) with conditionally-editable fields: show inline edit controls only when `locals.session.userid` is the owner or has admin role; non-owners continue to see read-only text
- [ ] T012 [US2] Add a save handler in `public/javascripts/released-form-management.js` that sends a `PUT` to `./metadata` with the updated field values when the user clicks save on any of the three classification fields (follow the existing inline-edit AJAX pattern already used in that file)

**Checkpoint**: US2 fully functional — owners/admins can correct or add classification data on already-released forms.

---

## Phase 6: User Story 4 — Update Traveler-Specific Metadata (Priority: P2)

**Goal**: Users can set or update Machine Area, Sector, and Product Windchill ID on a traveler while it is in an active state; non-admins are blocked from editing once the traveler is approved or beyond.

**Independent Test**: Open an in-progress traveler, update all three fields, save, confirm persistence. Then navigate to an approved traveler as a non-admin and verify the fields are read-only. (See `quickstart.md` Scenario 4.)

### Implementation

- [ ] T013 [US4] In `routes/traveler.js` at the `PUT /travelers/:id/config` route (line ~1031): extend the `reqUtils.filter` call to include `'machineArea'`, `'sector'`, `'windchillId'`; change `reqUtils.status('id', [0, 1])` to `reqUtils.status('id', [0, 1, 1.5])` to allow updates while submitted for review
- [ ] T014 [P] [US4] In `views/traveler.jade`, replace the read-only display of `machineArea`, `sector`, `windchillId` (from T009) with editable fields: show edit controls only when the traveler is in an active state (`status < 2`) or the user is an admin; non-admins on approved/frozen/archived travelers see read-only text
- [ ] T015 [US4] Extend the existing config-save AJAX call in `public/javascripts/traveler.js` (the handler for the `/config` endpoint) to include `machineArea`, `sector`, and `windchillId` when their edit controls are present on the page

**Checkpoint**: US4 fully functional — users can capture instance-specific deployment context on active travelers; state guard prevents unauthorized updates on completed travelers.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Finishing touches that span multiple user stories.

- [ ] T016 [P] In `views/released-forms.jade` (the list/table view), add `Subsystem`, `Device`, and `Activity` columns to the released forms table so the classification is visible at a glance without opening each form
- [ ] T017 Run through all validation scenarios in `specs/003-form-traveler-metadata/quickstart.md` end-to-end and confirm every checklist item passes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — **blocks all user stories**
- **US1 (Phase 3)**: Depends on Phase 2 (ReleasedForm schema must exist)
- **US3 (Phase 4)**: Depends on Phase 2 (Traveler schema must exist) — can be worked in parallel with US1 after Phase 2 completes
- **US2 (Phase 5)**: Depends on Phase 2 + Phase 3 (needs classification fields on released form + UI display from T007)
- **US4 (Phase 6)**: Depends on Phase 2 + Phase 4 (needs traveler fields + display from T009)
- **Polish (Phase 7)**: Depends on all story phases

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 — no dependency on other stories
- **US3 (P1)**: Can start after Phase 2 — independent of US1 (tests with seeded data)
- **US2 (P2)**: Starts after US1 is complete (reuses the display rows added by T007 as its base)
- **US4 (P2)**: Starts after US3 is complete (reuses the display rows added by T009 as its base)

### Within Each Phase

- T002 and T003 (Phase 2) are different files — **run in parallel**
- T005, T006, T007 (Phase 3) have no dependencies on each other — **run in parallel** after T004
- T009 (Phase 4) is independent of T008 — **run in parallel**
- T011, T012 (Phase 5) can begin once T010 route is written — T011 is independent of T012
- T014, T015 (Phase 6) can begin once T013 route is updated — T014 is independent of T015

---

## Parallel Example: Phase 2

```
After T001 (branch check):
  → T002: model/released-form.js   (parallel)
  → T003: model/traveler.js        (parallel)
Both complete → proceed to Phase 3
```

## Parallel Example: Phase 3 (US1)

```
Start T004 (routes/form.js):
  Completes → T005 (views/form-management.jade)  (parallel after T004)
            → T006 (public/javascripts/...)        (parallel after T004)
            → T007 (views/released-form.jade)      (parallel after T004)
```

## Parallel Example: Phase 3 + Phase 4 (both P1 after Foundational)

```
After Phase 2 completes:
  → Phase 3 tasks (US1): routes/form.js, views/form-management.jade, JS
  → T008 (US3): utilities/routes.js               (parallel with Phase 3)
  → T009 (US3): views/traveler.jade               (parallel with Phase 3)
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 3, both P1)

1. Complete Phase 1: Setup (quick — just branch verification)
2. Complete Phase 2: Foundational (T002, T003 in parallel)
3. Complete Phase 3: US1 (T004 → T005/T006/T007 in parallel)
4. Complete Phase 4: US3 (T008/T009 in parallel — can overlap Phase 3)
5. **STOP and VALIDATE**: Run Quickstart Scenarios 1 and 3 end-to-end
6. Deploy/demo if ready

### Incremental Delivery

1. Phase 2 → Foundation ready
2. Phase 3 → Classification captured at release; test Scenario 1
3. Phase 4 → Travelers inherit classification; test Scenario 3
4. Phase 5 → Backfill editing enabled; test Scenario 2
5. Phase 6 → Instance metadata editable; test Scenario 4
6. Phase 7 → Polish and full quickstart validation

---

## Notes

- [P] tasks touch different files and have no incomplete-task dependencies — safe to run in parallel
- Each user story is independently testable against the scenarios in `specs/003-form-traveler-metadata/quickstart.md`
- All metadata mutations must use `saveWithHistory(req.session.userid)` per the project constitution
- `reqUtils.filter` must be used on all new body parameters per the permission-layered access principle
- No new npm dependencies required
