# Tasks: WBS YAML Config File

**Input**: Design documents from `specs/007-wbs-yaml-config/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/wbs-notification-api.md](contracts/wbs-notification-api.md)

**Updated**: 2026-08-24 — Clarification applied: admin page WBS management removed entirely; this feature is a replacement (not an addition).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to ([US1], [US2], [US3])

---

## Phase 1: Setup

**Purpose**: Add the one new dependency required by this feature.

- [X] T001 Add `js-yaml` to `package.json` dependencies and install (`npm install js-yaml`)

---

## Phase 2: Foundational — Core YAML Loader + Codebase Cleanup

**Purpose**: Implement the new YAML loader and remove the obsolete WBS admin CRUD infrastructure. Both must be complete before any user story phase begins — user story phases assume CRUD is gone and the loader exists.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 Implement `lib/wbs-yaml-loader.js` — export a `loadWbsYaml(configPath)` function that: reads `<configPath>/wbs.yaml` via `fs.readFileSync`; parses with `js-yaml.load(content, { schema: yaml.FAILSAFE_SCHEMA })`; validates each entry using the existing `WBS_NUMBER_PATTERN` and `EMAIL_PATTERN` from `lib/wbs-notification-service.js`; skips invalid entries with a per-entry warning log; returns a plain `{ [wbs_number]: email }` object; returns `{}` on missing file (debug log only); returns `{}` and logs an error on YAML parse failure
- [X] T003 [P] Write unit tests `test-unit/lib/wbs-yaml-loader.test.js` covering: valid file with multiple entries (correct map returned), missing file (returns `{}`, no error thrown), empty file (returns `{}`), invalid YAML syntax (error logged with file path, returns `{}`), entry with invalid WBS number (warning logged with key+value, entry skipped, valid entries returned), entry with invalid email (warning logged with key+value, entry skipped, valid entries returned), duplicate WBS key (last value wins)
- [X] T004 Remove `addEntry`, `updateEntry`, `removeEntry` from `lib/wbs-notification-service.js`; remove the `require('../model/wbs-notification')` import; keep only `isValidWbsNumber`, `isValidEmail`, `resolveWbsContact`, and a stub `listEntries` (to be updated in Phase 3)
- [X] T005 [P] Remove POST, PATCH, DELETE route handlers from `routes/wbs-notification.js`; keep only the GET handler stub (implementation updated in Phase 3)
- [X] T006 [P] Delete `model/wbs-notification.js` and remove its `require` line from `app.js`
- [X] T007 [P] Update `test-unit/lib/wbs-notification-service.test.js` — remove all tests for `addEntry`, `updateEntry`, `removeEntry`; remove stubs that reference `WbsNotification` model; keep `isValidWbsNumber` and `isValidEmail` tests; existing `resolveWbsContact` and `listEntries` tests will be updated in Phase 3

**Checkpoint**: Codebase compiles; `npm test` may have failures in service tests (expected — Phase 3 will fix them); CRUD routes return 404; loader module exists with tests passing.

---

## Phase 3: User Story 1 — Admin Configures WBS Mappings via File (Priority: P1) 🎯 MVP

**Goal**: A system admin places `wbs.yaml` in the config directory, restarts the application, and all valid WBS-to-email mappings are active. The admin page shows a read-only list of YAML entries. All unit tests pass.

**Independent Test**: Place `wbs.yaml` with two valid entries, restart, call `GET /wbs-notifications/` and verify both entries appear with `source: "config"`; trigger NCR for a mapped WBS number and confirm email resolves correctly.

- [X] T008 Wire YAML loader into `config/config.js` — at the end of `module.exports.load()`, call `require('./wbs-yaml-loader').loadWbsYaml(this.configPath)` and assign the result to `module.exports.wbsYaml`; log `[wbs-yaml] Loaded N WBS notification mapping(s) from wbs.yaml` when N > 0
- [X] T009 Rewrite `lib/wbs-notification-service.js → resolveWbsContact` — remove the MongoDB query; build the same candidate list (exact match first, then ancestor walk) and look up each candidate in `config.wbsYaml`; return `{ wbs_number, notification_email, source: 'config' }` for the first match found, or `null` if none
- [X] T010 Rewrite `lib/wbs-notification-service.js → listEntries` — return entries from `config.wbsYaml` as an array of `{ wbs_number, notification_email, source: 'config' }` objects sorted by `wbs_number` ascending; no DB call
- [X] T011 Update the GET handler in `routes/wbs-notification.js` — call the new `listEntries()` and return `{ success: true, entries }` (response shape matches contract in [contracts/wbs-notification-api.md](contracts/wbs-notification-api.md))
- [X] T012 [P] Update `test-unit/lib/wbs-notification-service.test.js` — add tests for the new `resolveWbsContact` (YAML map match, YAML ancestor match, no match returns null) and new `listEntries` (returns YAML entries sorted, empty array when config.wbsYaml is empty); stub `config.wbsYaml` directly (no Mongoose stubs needed)
- [X] T013 [P] Create example files `config/wbs.yaml` and `docker/wbs.yaml` — each with a comment header explaining the format, two sample commented-out entries, and a note that the file is optional
- [X] T014 Update the admin WBS page Jade view — locate the WBS notification section in `views/` or `builderview/`; remove the add-entry form and the edit/delete controls from the table; render a simple read-only table of `{ wbs_number, notification_email }` pairs populated from the GET endpoint; add a note "Mappings are loaded from `wbs.yaml` — edit the file and restart to change"
- [X] T015 Rewrite `public/javascripts/wbs-notifications.js` — remove all POST/PATCH/DELETE AJAX calls and button handlers; replace with a simple read-only fetch of `GET /wbs-notifications/` and render-to-table logic; no edit or delete buttons

**Checkpoint**: `npm test` fully passes. `GET /wbs-notifications/` returns YAML entries. Admin page shows read-only list. NCR resolution uses YAML email.

---

## Phase 4: User Story 2 — Application Starts Normally Without wbs.yaml (Priority: P2)

**Goal**: Deployments without a `wbs.yaml` start cleanly with no errors; WBS resolution returns no match; `GET /wbs-notifications/` returns an empty array.

**Independent Test**: Remove `docker/wbs.yaml`, restart the application, confirm clean startup logs, confirm `GET /wbs-notifications/` returns `{ "entries": [] }`.

- [X] T016 [US2] Confirm the debug-level "not found" log message is present in `lib/wbs-yaml-loader.js` when the file is absent (review T002 output; add if missing)
- [X] T017 [US2] Run `TRAVELER_CONFIG_REL_PATH=docker npm test` with no `wbs.yaml` in the `docker/` directory and confirm all tests pass — fix any regressions from Phase 3 changes

**Checkpoint**: Full test suite passes with no YAML file present.

---

## Phase 5: User Story 3 — Application Reports Config File Problems Clearly (Priority: P3)

**Goal**: When `wbs.yaml` is present but invalid, startup logs contain clear, actionable messages that include the file path and the nature of the problem.

**Independent Test**: Provide a syntactically invalid `wbs.yaml`; confirm startup log error contains the file path and error text. Provide a file with one bad email entry; confirm a warning names the entry.

- [X] T018 [US3] Review and finalize all log message wording in `lib/wbs-yaml-loader.js`: YAML parse-failure message must include full file path and underlying error text; per-entry warning must include the WBS key, the problematic value, and the rejection reason (e.g., `[wbs-yaml] Skipping entry "2.2": invalid email "not-an-email"`)
- [X] T019 [P] [US3] Extend `test-unit/lib/wbs-yaml-loader.test.js` — add logger spy assertions: YAML parse failure log contains file path substring; invalid WBS entry warning contains the key; invalid email entry warning contains the key and the bad value

**Checkpoint**: All three user stories independently functional and tested.

---

## Phase 6: e2e Test Updates

**Purpose**: Update e2e tests that exercised the now-removed admin CRUD flow to instead validate the YAML-based approach.

- [X] T020 Update `e2e/us-wbs-notification-registry.spec.js` — replace the CRUD fixture setup (API POST calls to create entries) with YAML file fixture setup (write `docker/wbs.yaml` in `beforeAll`, delete in `afterAll`); verify GET returns correct entries and POST returns 404
- [X] T021 [P] Update `e2e/us-wbs-hierarchical-notification-lookup.spec.js` — replace DB-seeded WBS entries with YAML file fixture entries; verify hierarchical resolution behavior (ancestor matching) still works end-to-end

**Checkpoint**: e2e test suite passes with the YAML-based setup.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, linting, and end-to-end validation.

- [X] T022 [P] Update `CLAUDE.md` — add `js-yaml` to dependencies section; document `config/wbs.yaml` and `docker/wbs.yaml` as optional config files; note that POST/PATCH/DELETE `/wbs-notifications/` are removed (breaking change)
- [X] T023 Run `npx eslint .` and fix any linting errors introduced by new or modified files
- [ ] T024 Run quickstart validation — execute Scenarios 1–7 from [quickstart.md](quickstart.md) against the running Docker environment and confirm all pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (T001 must complete before T002 can import `js-yaml`)
- **US1 (Phase 3)**: Depends on Phase 2 — all foundational tasks must be complete
- **US2 (Phase 4)**: Depends on Phase 3 — regression check after US1 wiring
- **US3 (Phase 5)**: Extends T002/T003 — can start after Phase 2 completes
- **e2e Updates (Phase 6)**: Depends on Phase 3 (routes and service finalized)
- **Polish (Phase 7)**: Depends on all prior phases complete

### Within Phase 2 (Foundational)

- T002 and T003 can start together (TDD approach — T003 tests will fail until T002 is complete)
- T004, T005, T006 are independent of each other (different files) — run in parallel
- T007 can start after T004 (needs to know what's been removed from the service)

### Within User Story 1 (Phase 3)

- T008 first (config.wbsYaml must exist before service can use it)
- T009 and T010 can run in parallel after T008 (different functions)
- T011 after T010 (listEntries must exist)
- T012 after T009 and T010
- T013 is fully independent
- T014 and T015 can run in parallel (Jade template vs. client JS); both depend on T011 being defined

---

## Parallel Example: Foundational Phase

```text
Track A: T002 (implement loader) → T008 (wire into config)
Track B: T003 (loader tests — TDD, fails until T002 done)
Track C: T004 + T005 + T006 (delete CRUD code, parallel)
Track D: T007 (update service tests — after T004)
Track E: T013 (example YAML files — fully independent)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002–T007)
3. Complete Phase 3: User Story 1 (T008–T015)
4. **STOP and VALIDATE**: Use quickstart.md Scenarios 1, 3, and 6 to verify US1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Phase 1 + Phase 2 → YAML loader ready; old CRUD removed
2. Phase 3 → Admin configures via YAML file (MVP)
3. Phase 4 → No-file startup confirmed (regression free)
4. Phase 5 → Error messages hardened
5. Phase 6 → e2e tests updated
6. Phase 7 → Docs and linting complete

---

## Notes

- [P] tasks can run in parallel across different files
- `config.wbsYaml` is the sole runtime source; it is never written to the database
- The `FAILSAFE_SCHEMA` in `js-yaml` is non-negotiable — without it, `1.2` parses as a float
- The `WBS_NUMBER_PATTERN` and `EMAIL_PATTERN` from `wbs-notification-service.js` are reused in the loader to avoid duplicating validation logic
- The `wbs_notifications` MongoDB collection is NOT dropped by this feature; data migration is the administrator's responsibility
- e2e tests that previously seeded via admin API must be updated to use YAML file fixtures
- Run `TRAVELER_CONFIG_REL_PATH=docker npm test` after any change to service or loader files
