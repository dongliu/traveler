---

description: "Task list for ACL Form Composition on Release"
---

# Tasks: ACL Form Composition on Release

**Input**: Design documents from `/specs/002-acl-form-composition/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/compose-released-form.md, quickstart.md (all present)

**Tests**: Not explicitly requested for user-facing behavior (the repo has no route/UI test harness — see plan.md "Testing"; validated manually via quickstart.md instead). Unit tests ARE included for the new `lib/` helper module, per the project constitution's Development Workflow rule: "all new `lib/` functions MUST have corresponding tests in `test/lib/`."

**Organization**: Tasks are grouped by user story (spec.md priorities P1–P4) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US4)
- File paths are exact, relative to the repository root

---

## Phase 1: Setup

**Purpose**: Confirm the local environment is ready; no new dependencies or build config are needed (research.md confirms zero new npm packages).

- [ ] T001 Confirm local dev server boots against a reachable MongoDB per `config/config.js` / `../etc/traveler-config/` (`npx nodemon`), matching quickstart.md's Prerequisites section

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema and shared-helper changes every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T002 [P] Add `'ACL'` to the `formType` enum in `model/form.js`
- [ ] T003 [P] Add `'ACL'` to the `formContent.formType` enum and add `'ACL'`, `'normal_acl'` to the `releasedForm.formType` enum in `model/released-form.js`
- [ ] T004 Add `aclForms: [formContent]` (default `[]`) to the `releasedForm` schema in `model/released-form.js`, and add `'aclForms'` to both the `addVersion` (`fieldsToVersion`) and `addHistory` (`fieldsToWatch`) plugin configs in the same file (depends on T003, same file)
- [ ] T005 [P] Add `aclForms: [form]` (default `[]`) to the `traveler` schema in `model/traveler.js`
- [ ] T006 [P] Create `lib/composed-released-form.js` exporting `computeVer(baseId, aclIds)` (returns `"<baseId>"` when `aclIds` is empty, else `"<baseId>:<sortedAclId1>,<sortedAclId2>,..."` per research.md §1) and `findInputNameCollisions(entries)` (accepts `[{ label, html }, ...]`, parses each with `cheerio` the same way `model/form.js`'s pre-save hook does, and returns the list of input `name`s that appear in more than one entry, per research.md §5)
- [ ] T007 Unit tests for `lib/composed-released-form.js` in `test/lib/composed-released-form-test.js`: `computeVer` with zero ACL ids, one, multiple (including that reordered input ACL ids produce the identical string); `findInputNameCollisions` with no collision and with a colliding input name across two entries (depends on T006)

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Compose a released form from existing released forms (Priority: P1) 🎯 MVP

**Goal**: An authorized (Manager/Admin) user selects one already-released base form and zero, one, or multiple already-released ACL forms and publishes them together as one new released form.

**Independent Test**: Compose one released base form with two released ACL forms; confirm the resulting released form references the base and both ACL forms with their snapshotted content (spec.md User Story 1, Acceptance Scenarios 1–3).

### Implementation for User Story 1

- [ ] T008 [US1] Add `GET /released-forms/acl/json` to `routes/form-management.js`, mirroring the existing `GET /released-forms/discrepancy/json` (same file, lines ~207-220), filtered to `{ status: 1, formType: 'ACL' }`, projecting `title formType status tags _v releasedOn releasedBy`
- [ ] T009 [US1] Add the `POST /released-forms/:id/compose` route registration and validation middleware chain in `routes/form-management.js`: `auth.ensureAuthenticated`, `auth.requireRoles` gated to Manager/Admin (mirrors the pattern at `routes/form.js:848`), `reqUtils.exist('id', ReleasedForm)`, a check that the base has `formType === 'normal'` and `status === 1` (400 otherwise), a check that every id in `req.body.aclFormIds` resolves to a `ReleasedForm` with `formType === 'ACL'` and `status === 1` (400 naming the offending id, mirrors `routes/form.js:1050-1072`), and rejection (400) when `aclFormIds` contains the base's own id or contains duplicates (FR-005)
- [ ] T010 [US1] Implement the `POST /released-forms/:id/compose` handler body in `routes/form-management.js` (same route as T009): call `findInputNameCollisions` from `lib/composed-released-form.js` across the base's and each selected ACL form's `html` and reject (400, naming the colliding input name) on any collision; otherwise copy the base's own `base` field and each selected ACL's own `base` field into a new `ReleasedForm` (`formType: 'normal_acl'`, `title: req.body.title || base.title`), compute `ver` via `computeVer(baseId, sortedAclIds)`, save via `saveWithHistory(req.session.userid)`, and respond `201` with `{ location }` (mirrors `routes/form.js:1112-1129`)
- [ ] T011 [US1] Create `views/released-form-compose.jade`: a base-form single-select DataTable (`sAjaxSource: '/released-forms/normal/json'`) and an ACL-forms multi-select DataTable (`sAjaxSource: '/released-forms/acl/json'`), a title-override input, and Confirm/Cancel actions — mirrors the prior-versions/discrepancy picker markup pattern already in `public/javascripts/form-builder.js`'s `#release` click handler
- [ ] T012 [US1] Add a "Compose" button/link to `views/released-form.jade`, visible only when `formType === 'normal'`, `status === 1`, and the viewer is Manager/Admin, linking to `released-form-compose` for that released form's id (depends on T011)
- [ ] T013 [US1] Add client-side wiring for the compose picker in `public/javascripts/released-form-management.js`: initialize both DataTables, reuse the `selectOneEvent`/`selectMultiEvent`/`fnGetSelectedInPage` helpers already used in `form-builder.js` for single/multi row selection, and on submit `POST` `{ title, aclFormIds }` to `/released-forms/:id/compose`, redirecting to the new released form's URL on success (depends on T008, T009, T010, T011)

**Checkpoint**: User Story 1 is fully functional — a base form can be composed with any number of ACL forms end-to-end through the UI.

---

## Phase 4: User Story 2 - ACL sections are fillable in the resulting traveler (Priority: P2)

**Goal**: A traveler created from a composed released form renders every attached ACL form's fields at the top, ahead of the base form, and captures entered values the same way base fields are captured.

**Independent Test**: Create a traveler from a released form composed with two ACL forms; confirm both ACL sections render at the top and that values entered into them save and count toward progress (spec.md User Story 2, Acceptance Scenarios 1–3).

### Implementation for User Story 2

- [ ] T014 [US2] Extend the `formType` allow-list check in `createTraveler` (`utilities/routes.js:307-317`) to also accept `'normal_acl'`
- [ ] T015 [US2] Add an `addAclForms(form, traveler)` function to `utilities/routes.js`, mirroring `addBase`/`addDiscrepancy`: push every entry of `form.aclForms` into `traveler.aclForms`, and merge each entry's `mapping`/`labels`/`types` together with the base's into `traveler.mapping`/`traveler.labels`/`traveler.types`, setting `traveler.totalInput` to the size of the merged `labels` (data-model.md, Traveler section)
- [ ] T016 [US2] Call `addAclForms` from `createTraveler` in `utilities/routes.js` after `addBase`, when `form.aclForms` is non-empty (depends on T014, T015)
- [ ] T017 [US2] Extend `resetTouched` in `utilities/routes.js` (currently `utilities/routes.js:466-505`) to check each submitted `TravelerData` name against the merged label set — the active form's labels plus every `doc.aclForms` entry's labels — instead of only `activeForm.labels`
- [ ] T018 [US2] In `views/traveler.jade`, render each `traveler.aclForms` entry's `html` inside its own labeled `.control-group` section (titled with the ACL form's identity), inserted above the existing base-form section (`views/traveler.jade:109-117`) but inside the same `#form` element, so the existing `#form`-scoped input listeners in `public/javascripts/traveler.js` cover them with no JS changes (depends on T005, T016)

**Checkpoint**: User Stories 1 AND 2 both work — composed releases are usable for real data entry, with correct progress tracking.

---

## Phase 5: User Story 3 - Duplicate compositions are blocked, distinct ones are not (Priority: P3)

**Goal**: Composing the exact same base + ACL-form combination as an existing active composition is blocked; any genuinely different combination succeeds; selection order never matters.

**Independent Test**: Compose the same base+ACL combination twice (second attempt blocked), then in reversed ACL-selection order (still blocked), then with a different ACL set (succeeds) — spec.md User Story 3, Acceptance Scenarios 1–3.

### Implementation for User Story 3

- [ ] T019 [US3] In the `POST /released-forms/:id/compose` handler (`routes/form-management.js`, added in T010), after computing `ver`, query `ReleasedForm.findOne({ title, formType: 'normal_acl', ver, status: 1 })` and, if found, respond `400` with a message naming the existing duplicate's id — mirrors the existing duplicate check at `routes/form.js:1096-1111` (depends on T010)

**Checkpoint**: All three of US1–US3 work together — composing is safe against accidental duplicates while remaining unrestricted for genuinely different combinations.

---

## Phase 6: User Story 4 - Audit the composition from the released form detail view (Priority: P4)

**Goal**: A composed released form's detail page shows the base form and every attached ACL form's title and version.

**Independent Test**: Compose a released form with two ACL forms, open its detail page, confirm both ACL forms' titles/versions are listed alongside the base (spec.md User Story 4, Acceptance Scenario 1).

### Implementation for User Story 4

- [ ] T020 [US4] Extend the render object passed to the `released-form` view in `GET /released-forms/:id/` (`routes/form-management.js:80-100`) to include `aclForms: releasedForm.aclForms`
- [ ] T021 [US4] Update `views/released-form.jade` to render each `aclForms` entry (title/version derived from its snapshot, plus its `html`) alongside the existing `base`/`discrepancy` sections, only when `aclForms` is non-empty (depends on T020)

**Checkpoint**: All four user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verification and cleanup spanning all stories.

- [ ] T022 [P] Walk through every section of `specs/002-acl-form-composition/quickstart.md` against a running dev server and confirm each "Expected" outcome, including the regression check (§9) that the existing discrepancy-attachment release path is unaffected
- [ ] T023 [P] Run `npx eslint .` and `npx prettier --write .` across all files touched by this feature
- [ ] T024 [P] Run `npx mocha test/lib/` and confirm the new `composed-released-form-test.js` suite passes alongside the existing suite

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **User Stories (Phase 3–6)**: All depend on Foundational completion.
  - US1 (Phase 3) has no dependency on US2–US4 and is the MVP slice.
  - US2 (Phase 4) depends on US1 only insofar as it needs `'normal_acl'` released forms to exist to create travelers from — functionally builds on US1's output but touches entirely different files (`utilities/routes.js`, `views/traveler.jade`).
  - US3 (Phase 5) is additive validation on top of the exact route US1 built (T010) — must follow US1.
  - US4 (Phase 6) reads the same `aclForms` field US1 populates — can proceed independently of US2/US3 once US1 exists.
- **Polish (Phase 7)**: Depends on all desired user stories being complete.

### Parallel Opportunities

- Within Foundational: T002, T003, T005, T006 touch different files and can run in parallel; T004 follows T003 (same file); T007 follows T006 (tests the module it creates).
- Once Foundational is done, US1 must land first (it's the only story that produces `'normal_acl'` released forms), but US2 and US4 can then be developed in parallel by different people, since one touches `utilities/routes.js`/`views/traveler.jade` and the other touches `routes/form-management.js`/`views/released-form.jade`. US3 is a small, additive change to US1's own route and is easiest done immediately after US1.
- Within Phase 7, T022–T024 are independent and can run in parallel.

---

## Parallel Example: Foundational Phase

```bash
# Launch independent foundational tasks together:
Task: "Add 'ACL' to the formType enum in model/form.js"
Task: "Add 'ACL' to formContent.formType and 'ACL'/'normal_acl' to releasedForm.formType in model/released-form.js"
Task: "Add aclForms: [form] to the traveler schema in model/traveler.js"
Task: "Create lib/composed-released-form.js with computeVer and findInputNameCollisions"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (schema + shared lib helper — blocks everything else)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Run quickstart.md §§1–4 (author/release ACL forms, compose, base-only compose) independently
5. Demo: a Manager/Admin can bundle a base form with several ACL forms into one published released form

### Incremental Delivery

1. Setup + Foundational → schema ready for the whole feature
2. Add US1 → validate via quickstart §§1–4 → MVP demoable (composition exists and is auditable via raw data, even before the traveler UI or duplicate guard land)
3. Add US2 → validate via quickstart §8 → composed releases are now usable for real work, not just records
4. Add US3 → validate via quickstart §5 → duplicate protection active
5. Add US4 → validate via quickstart §3's detail-page check → full audit visibility
6. Polish → full quickstart pass + lint + unit tests

### Parallel Team Strategy

With multiple developers, after Foundational:

- Developer A: US1 (must land first — everything else depends on `'normal_acl'` releases existing)
- Once US1 lands: Developer B takes US2 (traveler rendering), Developer C takes US3 (duplicate guard, small) then US4 (audit view)
