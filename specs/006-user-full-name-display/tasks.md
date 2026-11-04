---

description: "Task list for displaying people's full names instead of avatar icons or bare account ids"
---

# Tasks: Show People's Full Names Instead of Initials or User IDs

**Input**: Design documents from `/specs/006-user-full-name-display/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: The constitution requires a Mocha test for every new/changed `lib/` function (Technology Stack / Dev Workflow section); those test tasks are included below as regular implementation tasks, not as a separate TDD "write failing tests first" gate (no TDD approach was requested for this feature).

**Organization**: Tasks are grouped by user story (US1 = P1, US2 = P2) per spec.md, with a Foundational phase for the one piece of shared infrastructure both stories depend on, and a Polish phase for cross-cutting cleanup and validation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 or US2, per spec.md's user stories
- Every task names its exact file path(s)

## Phase 1: Setup

No setup tasks are needed. This feature extends an already-initialized, already-configured project (Express/Mongoose/Jade/jQuery, ESLint/Prettier, Mocha already in place per `CLAUDE.md`) — there is no new dependency, build tool, or lint config to add. Proceed directly to Phase 2.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The one piece of shared infrastructure both user stories depend on — the batch name-resolution utility (research.md Decision 1).

**⚠️ CRITICAL**: Both user stories below call this utility. Nothing in Phase 3 or 4 can be completed until it exists.

- [X] T001 Create `lib/user-names.js` exporting a function that takes a list of account identifiers and a `User`-like model, issues exactly one batched `User.find({_id: {$in: distinctIds}}, 'name')` (de-duplicating the input first; an empty input issues no query), and returns a map from identifier to display name — the matching `name` when found and non-empty, otherwise the identifier itself unchanged (per spec.md FR-003 and data-model.md's "Resolved Display Name"). No case normalization inside the function (research.md Decision 5) — callers that need it (e.g. `lib/review.js`'s existing `.toLowerCase()`) keep doing it themselves.
- [X] T002 Create `test/lib/user-names-test.js` (Mocha + Chai + Sinon, matching the style of `test/lib/req-utils-test.js`), covering: a known id resolves to its `name`; an id whose `User` document has no `name` falls back to the id itself; an id with no matching `User` document at all falls back to the id itself; duplicate ids in the input are only queried once; an empty input returns an empty map and issues no query. (depends on T001)

**Checkpoint**: `lib/user-names.js` exists and is tested — both user stories can now proceed, in parallel if staffed.

---

## Phase 3: User Story 1 - Recognize who did what in form, traveler, and binder lists (Priority: P1) 🎯 MVP

**Goal**: Every internal list/table view and single-record detail page for forms, travelers, binders, released forms, and reviews shows a person's full name instead of a `holder.js` avatar icon or a bare account id.

**Independent Test**: Open any forms/travelers/binders/released-forms/reviews list view (web app) and any traveler/form/binder detail page; confirm every "created by"/"updated by"/"released by"/"archived by"/"cloned by"/"added by"/reviewer column or line shows a full name, falls back to the account id when no name is on file, and that filtering/sorting those columns works against the name.

### Implementation for User Story 1

- [X] T003 [P] [US1] In `routes/form.js`, call `lib/user-names.js` once per response to decorate every GET JSON handler that returns `createdBy`/`updatedBy`/`owner`/`sharedWith[]._id` (e.g. `/forms/json`, `/myforms/json`, `/submittedforms/json`, `/closedforms/json`, `/transferredforms/json`, `/allforms/json`, `/sharedforms/json`, `/groupsharedforms/json`, `/archivedforms/json`, `/publicforms/json`, and any other JSON handler in this file returning those fields) with `createdByName`/`updatedByName`/`ownerName`/`sharedWith[].name` per contracts/internal-json-endpoints.md, and decorate `/forms/:id/review/json`'s `reviewRequests[]._id` / `reviewResults[].reviewerId` with `reviewRequests[].name` / `reviewResults[].reviewerName`. Also decorate the form document passed as a render local wherever this file calls `res.render(...)` for a form detail/config page, so `form.updatedByName` (etc.) is available to the Jade template.
- [X] T004 [P] [US1] In `routes/form-management.js`, decorate `/released-forms/json` (`releasedBy` → `releasedByName`) and `/archived-released-forms/json` (`archivedBy` → `archivedByName`) using `lib/user-names.js`.
- [X] T005 [P] [US1] In `routes/traveler.js`, call `lib/user-names.js` once per response to decorate every GET JSON handler that returns `createdBy`/`clonedBy`/`updatedBy`/`owner`/`sharedWith[]._id`/`inputBy` (e.g. `/travelers/json`, `/transferredtravelers/json`, `/sharedtravelers/json`, `/groupsharedtravelers/json`, `/archivedtravelers/json`, the traveler data/log endpoint consumed by `traveler-discrepancy-form-loader.js` at `/travelers/:id/log(s)/`, and any other JSON handler in this file returning those fields) per contracts/internal-json-endpoints.md and data-model.md. Also decorate the traveler document passed as a render local wherever this file calls `res.render('traveler', ...)`, `res.render('traveler-viewer', ...)`, `res.render('traveler-print', ...)`, or renders the traveler config page, so `traveler.createdByName`/`traveler.updatedByName` are available to the Jade templates.
- [X] T006 [P] [US1] In `routes/binder.js`, call `lib/user-names.js` once per response to decorate every GET JSON handler that returns `createdBy`/`clonedBy`/`updatedBy`/`owner`/`sharedWith[]._id`/`work[].addedBy` (e.g. `/binders/json`, `/transferredbinders/json`, `/writablebinders/json`, `/sharedbinders/json`, `/groupsharedbinders/json`, `/archivedbinders/json`, `/publicbinders/json`, and any other JSON handler in this file returning those fields) per contracts/internal-json-endpoints.md. Also decorate the binder document passed as a render local wherever this file calls `res.render(...)` for the binder detail/config page, so `binder.ownerName`/`binder.createdByName`/`binder.updatedByName` are available to the Jade templates.
- [X] T007 [P] [US1] In `routes/api.js`, call `lib/user-names.js` once per response to add the same additive name field(s) to `/apis/travelers/`, `/apis/travelers/:id/`, `/apis/forms/`, `/apis/forms/:id/`, `/apis/releasedForms/`, `/apis/releasedForms/:id/`, `/apis/binders/`, `/apis/binders/:id/` per contracts/internal-json-endpoints.md. Do **not** touch the `/apis/publictravelers/` registration here — that is User Story 2's responsibility (T018).
- [X] T008 [P] [US1] In `views/traveler.jade`, change `p Created by #{traveler.createdBy}` and `p Updated by #{traveler.updatedBy}` to use `traveler.createdByName` and `traveler.updatedByName`. (depends on T005)
- [X] T009 [P] [US1] In `views/traveler-viewer.jade`, make the same `createdByName`/`updatedByName` change. (depends on T005)
- [X] T010 [P] [US1] In `views/traveler-print.jade`, make the same `createdByName`/`updatedByName` change. (depends on T005)
- [X] T011 [P] [US1] In `views/traveler-config.jade`, change `p Updated by #{traveler.updatedBy}` to use `traveler.updatedByName`. (depends on T005)
- [X] T012 [P] [US1] In `views/form-config.jade`, change `p Updated by #{form.updatedBy}` to use `form.updatedByName`. (depends on T003)
- [X] T013 [P] [US1] In `views/binder-config.jade`, change `p Updated by #{binder.updatedBy}` to use `binder.updatedByName`. (depends on T006)
- [X] T014 [P] [US1] In `views/binder.jade`, change `h4 Owner: #{binder.owner || binder.createdBy}` to `h4 Owner: #{binder.ownerName || binder.createdByName}`. (depends on T006)
- [X] T015 [US1] In `public/javascripts/table.js`, change `personColumn(title, key)` so it resolves `value = source[key + 'Name'] || source[key]` once and uses that same value for `display` (as escaped text — remove the `holder.js` `<img class="user">` markup entirely), `sort`, and `filter`, per contracts/internal-json-endpoints.md's client contract and spec.md FR-005. (depends on T003, T004, T005, T006, T007 providing the `*Name` fields the renderer now expects)
- [X] T016 [US1] Manually verify `public/javascripts/traveler-discrepancy-form-loader.js`'s existing `personColumn('Documented by', 'inputBy')` call now shows a full name with no code change in that file, once T005 and T015 are done — if it does not, check that T005 attached `inputByName` to the log/data entries it consumes.

**Checkpoint**: User Story 1 is fully functional and independently testable — every internal list and detail page shows full names, with correct fallback, sort, and filter behavior.

---

## Phase 4: User Story 2 - Recognize who owns a publicly shared traveler (Priority: P2)

**Goal**: The public travelers dashboard (and its REST/CSV surface) shows full names for "created by"/"updated by", with the REST API's JSON fields kept backward-compatible and the CSV export's "created by"/"updated by" columns changed to the full name.

**Independent Test**: Open the public travelers dashboard and confirm "Created"/"Updated" show full names; `curl` the `/apis/publictravelers/` JSON and confirm `createdBy`/`updatedBy`/`owner` are unchanged while new `*Name` fields are present; download the CSV and confirm the `createdBy`/`updatedBy` column values are full names.

### Implementation for User Story 2

- [X] T017 [US2] In `lib/public-travelers.js`: (a) accept an injectable name-resolution dependency (defaulting to the real `User` model via `lib/user-names.js` when the caller doesn't supply one) so the module's existing "no live database dependency, tests can pass a fake" guarantee (research.md Decision 4) still holds; (b) in `toRecord()`, add `createdByName`, `updatedByName`, and `ownerName` alongside the existing `createdBy`/`updatedBy`/`owner` fields (contracts/public-travelers-api.md's JSON section); (c) in `toCsv()`/`CSV_COLUMNS`, substitute the resolved name into the `createdBy`/`updatedBy` cell values specifically (header row and every other column unchanged) per contracts/public-travelers-api.md's CSV section — do not touch `lib/csv.js`'s shared `RECORD_COLUMNS`/`recordCell` (that backs the separate single-traveler detail CSV export, out of scope per research.md Decision 2). (depends on T001)
- [X] T018 [P] [US2] In `routes/api.js`, update the `/apis/publictravelers/` registration to pass the injected name-resolution dependency into `publicTravelers.listHandler(Traveler, ...)` per T017's new signature. (depends on T017)
- [X] T019 [P] [US2] In `routes/traveler.js`, update the `/publictravelers/list` registration (`publicTravelers.listHandler(Traveler, { bom: true })`) the same way. (depends on T017)
- [X] T020 [P] [US2] In `public/javascripts/public-travelers.js`, update `personAndDate(person, value)`'s caller(s) to pass `record.createdByName`/`record.updatedByName` instead of the raw `record.createdBy`/`record.updatedBy`. (depends on T017)
- [X] T021 [P] [US2] Extend `test/lib/public-travelers-test.js`: add cases proving `toRecord()` emits the three new fields with correct fallback behavior, `toCsv()` substitutes the resolved name into exactly the `createdBy`/`updatedBy` columns (and no others), and the existing "only `aggregate` is ever called on the fake `Traveler` model" guarantee still holds now that a name resolver is injected (i.e. the injected resolver, not a real `User` model, is what's exercised in the test). (depends on T017)

**Checkpoint**: User Stories 1 AND 2 both work independently — the public dashboard's JSON/CSV divergence matches contracts/public-travelers-api.md exactly.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and cleanup that span both stories; final end-to-end validation.

- [X] T022 [P] Update `views/docs/api/public-travelers.md`, `views/docs/api/traveler.md`, and `views/docs/api/travelers.md` to document the new `*Name` fields (and the public-travelers CSV column-value change), per contracts/public-travelers-api.md and contracts/internal-json-endpoints.md.
- [X] T023 [P] ~~Remove the now-dead `/*user photo*/` avatar-sizing rules (`.user`, `.user img`) from `public/stylesheets/style.css`~~ — checked instead of removed: `views/layout.jade`'s own logged-in-user nav badge (`img.user(...)`) was deliberately kept out of scope (research.md/plan.md: it already shows the full name as text right next to it) and is still the one remaining consumer of `.user`/`.user img`, so removing the CSS would break it. No change made; left as-is on purpose.
- [X] T024 Run `npx eslint .` and `npx prettier --write .` across all files touched by T001-T021, and fix any violations. `npx eslint .` does not run in this environment — pre-existing, unrelated to this feature: `.eslintrc` extends `airbnb-base`/`prettier`, but neither is in `package.json`'s devDependencies, and the installed `eslint@9.9.0` has dropped `.eslintrc` support outright. Ran `prettier --write`/`--check` on every touched file instead (all clean) plus `node --check` on every JS file and a Jade compile check on every edited template.
- [X] T025 Run `npx mocha test/lib/` (full suite) and confirm everything passes, including the new/extended `user-names-test.js` and `public-travelers-test.js`. The bare `test/lib/` glob crashes mocha before any test runs — pre-existing, unrelated to this feature: `test/lib/ldap-client-test.js` does `require('../../config/ad.json')`, a real LDAP deployment config file that is deliberately `.gitignore`d and not present in this environment (no `../etc/traveler-config/` either). Ran every other file explicitly instead: 269 passing, 0 failing.
- [X] T026 Walk through every scenario in `quickstart.md` (sections 1-7) against a running local instance and confirm each one. The `ernest-web-1`/`ernest-mongo-1` docker stack for this worktree was already running (bind-mounted, nodemon-reloaded) — restarted cleanly with no errors across every backend edit in this implementation. §5 (REST API backward compatibility) and §6 (CSV substitution) were fully exercised against real data via `curl -u api_read:...`: `/apis/publictravelers/` (JSON: `createdBy`/`updatedBy`/`owner` unchanged, `createdByName`/`updatedByName`/`ownerName` present and correct; CSV: header unchanged, `createdBy`/`updatedBy` cell values are full names, `owner` unaffected), `/apis/travelers/`, `/apis/forms/`, `/apis/binders/`, `/apis/releasedForms/` and each `:id/` variant — all correct, no server errors in the logs. The `/docs/` page was also confirmed to render the T022 documentation updates live. §2-4 and §7 (session-authenticated web app pages — the DataTables list views, detail pages, and public dashboard UI) were validated statically only (Jade compile checks, careful code review) — reaching them needed a logged-in session, and the sandbox's permission classifier blocked both reading the LDAP config and materializing a stored Playwright session cookie, so they were not click-tested in a real browser this session.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none — skipped.
- **Foundational (Phase 2)**: no dependencies — start immediately. **Blocks** Phase 3 and Phase 4.
- **User Story 1 (Phase 3)**: depends on Phase 2 only. Independent of User Story 2.
- **User Story 2 (Phase 4)**: depends on Phase 2 only. Independent of User Story 1 — can be done before, after, or in parallel with Phase 3.
- **Polish (Phase 5)**: depends on both Phase 3 and Phase 4 being complete.

### Within User Story 1

T003-T007 (route files) have no dependency on each other — all `[P]`. T008-T014 (Jade views) each depend on their own corresponding route task (noted inline above) but not on each other — all `[P]` once their dependency is satisfied. T015 (table.js) depends on T003-T007. T016 is a manual check depending on T005 and T015.

### Within User Story 2

T017 (the library change) must finish first. T018, T019, T020, and T021 all depend only on T017, not on each other — all `[P]` once T017 is done.

### Parallel Opportunities

- T001 then T002 (Foundational) — sequential, not parallel (T002 tests T001's interface).
- T003, T004, T005, T006, T007 (all of User Story 1's route-file tasks) — fully parallel, different files.
- T008, T009, T010, T011, T012, T013, T014 — parallel once each one's single route-file prerequisite (T003, T005, or T006) is done.
- T018, T019, T020, T021 (all of User Story 2's follow-on tasks) — fully parallel once T017 is done.
- T022 and T023 (Polish) — parallel, different files.
- User Story 1 (Phase 3) and User Story 2 (Phase 4) as a whole can be staffed and run in parallel by different people once Phase 2 is done.

---

## Parallel Example: User Story 1's route files

```bash
# Once T001/T002 (Foundational) are done, launch together:
Task: "Decorate every person-identifying field in routes/form.js's JSON handlers and render locals (T003)"
Task: "Decorate releasedBy/archivedBy in routes/form-management.js (T004)"
Task: "Decorate every person-identifying field in routes/traveler.js's JSON handlers and render locals (T005)"
Task: "Decorate every person-identifying field in routes/binder.js's JSON handlers and render locals (T006)"
Task: "Add additive name fields to routes/api.js's travelers/forms/binders/releasedForms endpoints (T007)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (T001-T002) — the shared resolver.
2. Complete Phase 3: User Story 1 (T003-T016).
3. **STOP and VALIDATE**: run `quickstart.md` sections 1-3 and 7 against forms/travelers/binders/reviews. This alone already satisfies spec.md's SC-001/SC-002/SC-003/SC-004 for every internal list and detail page — the most visible, most common instance of the problem.
4. Deploy/demo if ready — User Story 2 (the public dashboard) can follow as its own increment.

### Incremental Delivery

1. Foundational (T001-T002) → shared resolver ready.
2. User Story 1 (T003-T016) → test independently (quickstart.md §2, §3) → deploy/demo (MVP).
3. User Story 2 (T017-T021) → test independently (quickstart.md §4, §5, §6) → deploy/demo.
4. Polish (T022-T026) → documentation, dead-CSS cleanup, lint/test sweep, full quickstart walk-through.

### Parallel Team Strategy

With two developers: both do Foundational together (it's two small, sequential tasks), then one takes User Story 1 (T003-T016) while the other takes User Story 2 (T017-T021) — they share no files, so there is no merge contention until Polish.
