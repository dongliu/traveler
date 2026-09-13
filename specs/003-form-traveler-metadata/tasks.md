# Tasks: Form & Traveler Metadata Fields

**Input**: Design documents from `specs/003-form-traveler-metadata/`

**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅

**Tests**: Not requested — no test tasks included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

**Status**: All tasks complete. Several file-path assumptions from planning were corrected during implementation once the actual code was inspected — noted inline below.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US4)

---

## Phase 1: Setup

- [X] T001 Confirm working branch is `ernest-form-composition` and all design docs under `specs/003-form-traveler-metadata/` are readable

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T002 [P] Added `subsystem`, `device`, `activity` string fields (default `''`) to the `releasedForm` schema and extended `fieldsToWatch` in the `addHistory` plugin call in `model/released-form.js`
- [X] T003 [P] Added `subsystem`, `device`, `activity`, `machineArea`, `sector`, `windchillId` string fields (default `''`) to the `traveler` schema in `model/traveler.js`. **Correction**: `Traveler` has no `addHistory`/`saveWithHistory` plugin registered anywhere in the codebase (routes use plain `doc.save()`) — there was nothing to extend; fields were added to the schema only.

**Checkpoint**: Both model files updated.

---

## Phase 3: User Story 1 — Provide Metadata When Releasing a Form (Priority: P1) 🎯 MVP

- [X] T004 [US1] Updated `releaseForm()` in `routes/form.js` (`PUT /forms/:id/released`, ~line 1074) to assign `releasedForm.subsystem/device/activity` from `req.body`, sanitized via `reqUtils.sanitizeText`
- [X] T005 [P] [US1] Added Subsystem, Device, Activity inputs to the release dialog. **Correction**: the release modal is not in `views/form-management.jade` — it's built dynamically in `public/javascripts/form-builder.js` (`$('#release').click(...)`). Inputs added there as `#release-subsystem`, `#release-device`, `#release-activity`.
- [X] T006 [P] [US1] Updated the release-modal confirm handler in `public/javascripts/form-builder.js` to include `subsystem`, `device`, `activity` in the JSON body sent via `sendRequest(json, null, 'release')` → `PUT /forms/:id/released`
- [X] T007 [P] [US1] Displayed `subsystem`, `device`, `activity` on the released form detail page in `views/released-form.jade`; added the three fields to the render object in the `GET /released-forms/:id/` handler in `routes/form-management.js` (they were not being passed to the view before)

**Checkpoint**: US1 functional.

---

## Phase 4: User Story 3 — Traveler Inherits Classification at Creation (Priority: P1)

- [X] T008 [US3] In `utilities/routes.js` function `createTraveler`, added `subsystem: form.subsystem || ''`, `device: form.device || ''`, `activity: form.activity || ''` to the `new Traveler({...})` constructor call
- [X] T009 [P] [US3] Added all six metadata fields as read-only display rows to `views/traveler.jade` (classification fields shown conditionally when any is set; Machine Area / Sector / Windchill ID always shown). The full `traveler` document is already passed to this view, so no route change was needed here.

**Checkpoint**: US3 functional.

---

## Phase 5: User Story 2 — Edit Classification on an Already-Released Form (Priority: P2)

- [X] T010 [US2] Added `PUT /released-forms/:id/metadata` to `routes/form-management.js` using `reqUtils.isOwnerOrAdminMw('id')`, `reqUtils.filter('body', ['subsystem','device','activity'])`, `reqUtils.sanitize(...)`, and `saveWithHistory(req.session.userid)`; responds `200` with saved values
- [X] T011 [P] [US2] In `views/released-form.jade`, the three fields render as an inline `<form>` with text inputs + Save button when `locals.isOwner || isAdmin`, else as read-only text. Added `isOwner: reqUtils.isOwner(req, releasedForm)` to the `GET /released-forms/:id/` render object (was not previously computed for this view).
- [X] T012 [US2] Added a `#save-metadata` click handler in `public/javascripts/released-form-management.js`. **Correction**: the existing `sendRequest` helper had the `/status` suffix hardcoded; generalized it to accept a `suffix` parameter (defaults to `'status'` for backward compatibility) so the new handler can PUT to `./metadata`.

**Checkpoint**: US2 functional.

---

## Phase 6: User Story 4 — Update Traveler-Specific Metadata (Priority: P2)

- [X] T013 [US4] In `routes/traveler.js`, extended `PUT /travelers/:id/config`'s `reqUtils.filter`/`reqUtils.sanitize` lists with `machineArea`, `sector`, `windchillId`. **Correction**: the plan's approach of just widening `reqUtils.status('id', [0,1])` to `[0,1,1.5]` was wrong — that middleware runs unconditionally for every caller including admins, but FR-009 requires admins to bypass the state restriction entirely. Removed the `reqUtils.status` middleware and moved the check into the handler body: `if (!isAdmin && [0,1,1.5].indexOf(doc.status) === -1) return res.status(400)...`, computed before the existing `isOwner || isAdmin` authorization check.
- [X] T014 [P] [US4] Added editable fields for Machine Area, Sector, Product Windchill ID. **Correction**: not in `views/traveler.jade` (read-only detail page) — added to `views/traveler-config.jade` (the dedicated "Configuration" page, reached via the existing Configuration button), reusing the same `span.editable` + Edit-button markup pattern already used there for title/description. Edit controls are gated by `isAdmin || traveler.status < 2`; read-only text shown otherwise.
- [X] T015 [US4] **Correction**: no new AJAX call was needed. `traveler-config.jade` already uses a generic `Editable.binding($, initValue)` helper (`public/javascripts/lib/editable.js`) that wires up *every* `span.editable` element to PUT its field name/value to the current path. Registering `machineArea`, `sector`, `windchillId` in the `initValue` map in `public/javascripts/traveler-config.js` was sufficient — the existing binding call covers the new fields automatically.

**Checkpoint**: US4 functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T016 [P] Added `Subsystem`/`Device`/`Activity` columns to the released forms table. **Correction**: no Jade header changes needed — the table has no static `<thead>`; DataTables generates headers from `aoColumns[].sTitle`. Added `formSubsystemColumn`, `formDeviceColumn`, `formActivityColumn` to `public/javascripts/table.js` (named with a `form` prefix to avoid colliding with the pre-existing `deviceColumn` used across traveler list views — a plain `deviceColumn` would have been a duplicate `const` and broken the whole script). Wired them into `releasedFormAoColumns` in `public/javascripts/form-management.js` and fixed the `aaSorting` index shift. Extended the `/released-forms/json` field projection in `routes/form-management.js` to include `subsystem device activity`.
- [X] T017 Validated statically: all modified `.js` files pass `node --check` (and `--input-type=module` for the one ESM file); all three modified `.jade` files compile via `jade.compileFile`; the pre-existing `test/lib/req-utils-test.js`, `composed-released-form-test.js`, and `csv-test.js` suites (31 tests) pass unchanged. **Could not run the live browser scenarios in `quickstart.md`**: this worktree has no `../etc/traveler-config/` directory, so `node app.js` cannot boot at all (confirmed — fails on `config/config.js` requiring `../config/ad.json`). This is a pre-existing environment gap, not something introduced by this feature. Live quickstart validation should be run in an environment with the config directory and MongoDB available.

---

## Notes

- All six fields default to `''` — no data migration required; existing documents remain valid.
- `reqUtils.filter` is used on every new body parameter per the permission-layered access principle.
- `ReleasedForm` metadata edits go through `saveWithHistory`; `Traveler` metadata edits go through plain `doc.save()`, matching each model's existing pattern (Traveler has no history plugin).
- No new npm dependencies were introduced.

## Follow-up: T014-scope change (2026-09-13)

After initial implementation, the requirement changed: `subsystem`, `device`, `activity` on a **traveler** are no longer read-only after creation — users can edit them the same way as `machineArea`/`sector`/`windchillId` (same active-state + admin-bypass rule). Updated:

- `routes/traveler.js`: added `subsystem`, `device`, `activity` to the `PUT /travelers/:id/config` filter/sanitize lists (alongside the existing three)
- `views/traveler-config.jade`: Subsystem/Device/Activity now render as editable `span.editable` + Edit button (same pattern as the other three), gated by the same `isAdmin || traveler.status < 2` condition
- `public/javascripts/traveler-config.js`: added `subsystem`, `device`, `activity` to the `initValue` map so the existing generic `Editable.binding` call covers them
- `specs/003-form-traveler-metadata/spec.md` (FR-007, FR-008, FR-009, User Story 4), `data-model.md`, and `contracts/api-endpoints.md` updated to reflect all six fields sharing one edit rule

`views/traveler.jade` (the read-only detail page) is unchanged — it already displayed all six fields as plain text, consistent with title/description also being edit-only-via-config.
