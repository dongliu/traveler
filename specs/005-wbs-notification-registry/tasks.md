# Tasks: WBS Notification Registry

**Input**: Design documents from `specs/005-wbs-notification-registry/`

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[US1]**–**[US4]**: Map to spec.md's four user stories (View / Add / Update email / Remove)

## Path Conventions

Single Express MVC project at repo root — `model/`, `lib/`, `routes/`, `views/`, `public/javascripts/`, `test-unit/`, `e2e/` (per plan.md Project Structure).

---

## Phase 1: Setup

**Purpose**: Register the new model and mount the new route so the rest of the app can see them.

- [ ] T001 Create `model/wbs-notification.js` — Mongoose schema for `WbsNotification` per data-model.md (fields: `wbs_number` unique/trim/required, `notification_email` required/trim, `created_by`, `created_by_name`, `updated_by`, `updated_by_name`, `created_at`/`updated_at` defaulting to `Date.now`); export `{ WbsNotification }` matching the `{ Ncr }` export style in `model/ncr.js`
- [ ] T002 In `app.js`: add `require('./model/wbs-notification');` alongside the existing `require('./model/ncr');`, and mount `app.use('/api/wbs-notifications', require('./routes/wbs-notification'));` alongside the existing `app.use('/api/ncrs', require('./routes/ncr'));`

**Checkpoint**: Model registered, route mount point wired (route file created in Phase 2).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core service-layer validation logic every user story's routes depend on.

**⚠️ CRITICAL**: No user story route can be implemented until this phase is complete.

- [ ] T003 Create `lib/wbs-notification-service.js` with the WBS-number format validator per research.md Decision 4 (`^[^.]+(\.[^.]+)*$` after trim) and the email-shape validator per research.md Decision 5 (pragmatic `local@domain` check, not full RFC 5322) as internal helper functions, both exported for direct unit testing
- [ ] T004 In `routes/wbs-notification.js`: scaffold the Express router, import `auth.ensureAuthenticated` and `reqUtils.requireAdmin()`, and register all four routes (`GET /`, `POST /`, `PATCH /:wbsNumber`, `DELETE /:wbsNumber`) each chained with both middlewares per data-model.md's REST Contract table and research.md Decision 1 — bodies implemented in the user-story phases below

**Checkpoint**: Validators and route skeleton exist — user story implementation can now begin.

---

## Phase 3: User Story 1 — Admin Views the WBS Notification Registry (Priority: P1) 🎯 MVP

**Goal**: An Admin can see every WBS number and its notification email.

**Independent Test**: With existing registry entries in the database, an Admin opens the "WBS Notifications" tab and sees each WBS number paired with its email; with zero entries, sees an empty-state message instead of an error.

### Tests for User Story 1

- [ ] T005 [P] [US1] Unit test in `test-unit/lib/wbs-notification-service.test.js`: `listEntries()` returns all entries sorted in a stable order, and returns `[]` (not an error) when the collection is empty

### Implementation for User Story 1

- [ ] T006 [US1] Implement `listEntries()` in `lib/wbs-notification-service.js` — `WbsNotification.find({}).lean()`, per data-model.md Service Layer Functions
- [ ] T007 [US1] Implement `GET /` handler body in `routes/wbs-notification.js` per contracts/list-entries.json: call `listEntries()`, return `200 { success: true, entries }`
- [ ] T008 [US1] Add "WBS Notifications" tab to `views/admin.jade` — third `li` in the existing `ul.nav.nav-tabs` (alongside `#users`/`#groups`), new `#wbs-notifications.tab-pane` with `table#wbs-notifications-table.table.table-bordered.table-hover`, and `append js` script tag for the new `wbs-notifications.js` client script (mirrors the existing `#groups` tab structure at lines ~68-79)
- [ ] T009 [US1] Create `public/javascripts/wbs-notifications.js` — on tab load, `fetch('/api/wbs-notifications')` (or `$.ajax`, matching `public/javascripts/groups.js`'s existing style) and populate `#wbs-notifications-table` via DataTables, one row per entry showing WBS number and email

**Checkpoint**: Registry is viewable end-to-end (empty and populated). Deployable/demoable as-is — no add/update/remove yet.

---

## Phase 4: User Story 2 — Admin Adds a WBS Number to the Registry (Priority: P1)

**Goal**: An Admin can add a new WBS-number/email pair, with format, uniqueness, and email validation enforced.

**Independent Test**: Submitting a well-formed, unused WBS number with a valid email creates a new row; a duplicate WBS number, a malformed WBS number, or an invalid email are each rejected with a clear error and no row is created.

### Tests for User Story 2

- [ ] T010 [P] [US2] Unit tests in `test-unit/lib/wbs-notification-service.test.js` for `addEntry()`: succeeds and sets `created_by`/`created_by_name`/timestamps for a valid, unused WBS number; throws 400 for a WBS number missing/failing the segment-format rule (cases: `''`, `'1..2'`, `'.1.2'`, `'1.2.'`); throws 400 for an invalid email; throws 409 for a WBS number that already exists (case-sensitive exact match, including a same-number-different-case case that should NOT collide)

### Implementation for User Story 2

- [ ] T011 [US2] Implement `addEntry(data, user)` in `lib/wbs-notification-service.js` per data-model.md: trim inputs, run the format/email validators from T003, check for an existing document with the same `wbs_number` (throw `err.status = 409` if found), otherwise create the document with `created_by`/`created_by_name` from `user`
- [ ] T012 [US2] Implement `POST /` handler body in `routes/wbs-notification.js` per contracts/add-entry.json: read `wbs_number`/`notification_email` from `req.body`, build `user` from `req.session.userid`/`res.locals.username` (matching the pattern in `routes/ncr.js`'s `POST /`), call `addEntry()`, map `err.status` to the correct response (400/409) the same way `routes/ncr.js`'s `mapServiceError` does, return `201 { success: true, entry }` on success
- [ ] T013 [US2] Add the inline add-entry form to the `#wbs-notifications` tab in `views/admin.jade` (`form.form-inline` with WBS number + email text inputs and a submit button, mirroring the `#groups` tab's `form.form-inline` add-group form)
- [ ] T014 [US2] Extend `public/javascripts/wbs-notifications.js`: wire the add-form submit to `POST /api/wbs-notifications`, on success refresh the table, on 400/409 error surface the server's `message`/`details` near the form (mirroring the error-display pattern in `views/ncr-create.jade`'s create-form JS)

**Checkpoint**: Registry is viewable AND addable-to, with all three rejection paths (format/duplicate/email) working end-to-end.

---

## Phase 5: User Story 3 — Admin Updates the Notification Email for a WBS Number (Priority: P1)

**Goal**: An Admin can change the notification email for an existing WBS number without touching the WBS number itself.

**Independent Test**: Submitting a new valid email for an existing WBS number updates that row only; submitting an invalid email leaves the previously saved email unchanged; updating a WBS number that no longer exists returns a clear "not found" error.

### Tests for User Story 3

- [ ] T015 [P] [US3] Unit tests in `test-unit/lib/wbs-notification-service.test.js` for `updateEntry()`: succeeds and sets `notification_email`/`updated_by`/`updated_by_name`/`updated_at` for an existing WBS number; throws 400 for an invalid email and leaves the stored email unchanged; throws 404 for a WBS number not in the registry

### Implementation for User Story 3

- [ ] T016 [US3] Implement `updateEntry(wbsNumber, data, user)` in `lib/wbs-notification-service.js` per data-model.md: look up the document by exact `wbs_number` (throw `err.status = 404` if not found), validate the new email via the T003 validator (throw 400, leaving the document untouched, if invalid), otherwise set `notification_email`/`updated_by`/`updated_by_name`/`updated_at` and save
- [ ] T017 [US3] Implement `PATCH /:wbsNumber` handler body in `routes/wbs-notification.js` per contracts/update-entry.json: decode `req.params.wbsNumber`, read `notification_email` from `req.body`, build `user` the same way as T012, call `updateEntry()`, map `err.status` to 400/404, return `200 { success: true, entry }` on success
- [ ] T018 [US3] Add an inline "Edit" affordance per row in the `#wbs-notifications-table` (edit icon/button that reveals an email input + save button for that row, mirroring the disposition/preventive-action inline-edit pattern already used in `views/ncr-detail.jade`)
- [ ] T019 [US3] Extend `public/javascripts/wbs-notifications.js`: wire the per-row edit-save action to `PATCH /api/wbs-notifications/:wbsNumber` (URL-encode the WBS number), on success update just that row, on 400/404 error surface the server's message inline near the row

**Checkpoint**: View, add, and update are all working end-to-end — this is the full P1 scope from spec.md.

---

## Phase 6: User Story 4 — Admin Removes a WBS Number from the Registry (Priority: P2)

**Goal**: An Admin can permanently remove a WBS number from the registry.

**Independent Test**: Removing an existing WBS number makes it disappear from the registry; attempting to remove a WBS number that doesn't exist returns a clear "not found" error rather than succeeding silently.

### Tests for User Story 4

- [ ] T020 [P] [US4] Unit tests in `test-unit/lib/wbs-notification-service.test.js` for `removeEntry()`: deletes an existing entry and it no longer appears in `listEntries()`; throws 404 for a WBS number not in the registry

### Implementation for User Story 4

- [ ] T021 [US4] Implement `removeEntry(wbsNumber, user)` in `lib/wbs-notification-service.js` per data-model.md: look up and delete the document by exact `wbs_number` (throw `err.status = 404` if not found)
- [ ] T022 [US4] Implement `DELETE /:wbsNumber` handler body in `routes/wbs-notification.js` per contracts/remove-entry.json: decode `req.params.wbsNumber`, build `user` the same way as T012 (audit context, even though `removeEntry` itself doesn't persist it), call `removeEntry()`, map `err.status` to 404, return `200 { success: true }` on success
- [ ] T023 [US4] Add a "Remove" button per row in the `#wbs-notifications-table` with a confirmation prompt (mirroring the "Delete Selected Group(s)" pattern already in the `#groups` tab)
- [ ] T024 [US4] Extend `public/javascripts/wbs-notifications.js`: wire the per-row remove action to `DELETE /api/wbs-notifications/:wbsNumber`, on success remove the row from the table, on 404 surface a clear message (defensive — should be rare via the UI itself, but exercised directly against the API per quickstart.md Scenario 4)

**Checkpoint**: All four user stories complete — full CRUD registry, matching spec.md end to end.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Authorization coverage and end-to-end verification across all four stories together.

- [ ] T025 [P] Unit tests in `test-unit/lib/wbs-notification-service.test.js`: confirm every service function is pure business logic with no implicit auth assumptions (auth is enforced at the route layer, not the service layer, per data-model.md — so these tests just confirm the functions work correctly given any caller)
- [ ] T026 [P] Create `e2e/us-wbs-notification-registry.spec.js`: full Admin CRUD flow through the real `/admin/` UI (view empty state → add → duplicate-add rejected → malformed-WBS rejected → invalid-email rejected → update email → update with invalid email leaves it unchanged → update nonexistent WBS returns 404 → remove → remove nonexistent WBS returns 404), plus a non-admin-user 403 check for each of the four API routes hit directly (per quickstart.md Scenario 5)
- [ ] T027 Run `TRAVELER_CONFIG_REL_PATH=docker npx mocha test-unit/lib/wbs-notification-service.test.js` and confirm all unit tests pass
- [ ] T028 Run `npx playwright test us-wbs-notification-registry.spec.js` (from `e2e/`, Docker stack running) and confirm all e2e tests pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (model must exist before the service/route reference it) — BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Phase 2 completion
  - US1 (Phase 3) has no dependency on US2-4 and is the MVP
  - US2 (Phase 4) depends on US1's route skeleton but not on US1's UI being finished — can start once Phase 2 is done
  - US3 (Phase 5) is independent of US2/US4 at the service/route layer, but its UI (T018-T019) naturally follows US2's table existing (T008-T009)
  - US4 (Phase 6) is independent of US2/US3 at the service/route layer, same UI-ordering note as US3
- **Polish (Phase 7)**: Depends on all four user stories being complete

### Within Each User Story

- Tests before implementation (write T005/T010/T015/T020 first, confirm they fail, then implement)
- Service function before route handler before UI (matches data-model.md's model → service → route layering)
- Table/list UI (US1) before per-row edit/remove affordances (US3/US4) — they attach to rows US1 renders

### Parallel Opportunities

- T001 and T002 are sequential (T002 requires the file T001 creates to exist), not parallel despite touching different files
- Within Phase 2, T003 and T004 touch different files and can run in parallel
- The four story test tasks (T005, T010, T015, T020) can all run in parallel — different `it()` blocks in the same eventual file, but written independently against the not-yet-implemented functions
- T025 and T026 (Phase 7) touch different files and can run in parallel

---

## Parallel Example: Phase 2 (Foundational)

```bash
Task T003: "Create lib/wbs-notification-service.js validators (format + email)"
Task T004: "Scaffold routes/wbs-notification.js router with auth middleware chained"
```

## Parallel Example: Writing all four stories' tests up front (TDD style)

```bash
Task T005: "listEntries() unit tests"
Task T010: "addEntry() unit tests"
Task T015: "updateEntry() unit tests"
Task T020: "removeEntry() unit tests"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T004) — CRITICAL, blocks all stories
3. Complete Phase 3: User Story 1 (T005-T009)
4. **STOP and VALIDATE**: Confirm the registry is viewable (quickstart.md Scenario 1) — no add/update/remove yet, but this is already useful for seeding entries directly in MongoDB and confirming they display correctly
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add US1 (view) → test independently → demo (MVP)
3. Add US2 (add) → test independently → demo — registry is now genuinely usable
4. Add US3 (update email) → test independently → demo — full P1 scope reached
5. Add US4 (remove) → test independently → demo — full spec.md scope reached
6. Polish (Phase 7) → full automated coverage in place

### Key Constraints (from research.md and data-model.md)

- Every route MUST chain `auth.ensureAuthenticated` + `reqUtils.requireAdmin()` — no route is exempt (FR-008)
- WBS-number uniqueness matching is case-sensitive and exact, after trimming — do not normalize case
- `updateEntry()` changes `notification_email` only — never the `wbs_number` key itself
- This feature does NOT send any actual NCR notification email and does NOT touch `model/ncr.js` or `lib/ncr-service.js` — stay within the files listed in plan.md's Project Structure

---

## Notes

- [P] tasks touch different files with no unfinished dependency between them
- [Story] label maps each task to its user story for traceability back to spec.md
- Commit after each phase's checkpoint is reached and its tests pass
- Stop at any checkpoint to demo/validate that story in isolation
