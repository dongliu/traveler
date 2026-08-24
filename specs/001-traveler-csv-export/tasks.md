---

description: "Task list template for feature implementation"
---

# Tasks: Traveler CSV Export

**Input**: Design documents from `/specs/001-traveler-csv-export/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/csv-export.md](./contracts/csv-export.md),
[quickstart.md](./quickstart.md)

**Tests**: Included. The project constitution (Development Workflow) requires a smoke test for
every new route and a corresponding `test/lib/` test for every new `lib/` function. This codebase
has no HTTP/route-testing harness today (no `supertest`, no route ever exercised via mocha — only
`lib/` functions are unit-tested, e.g. `test/lib/req-utils-test.js`). Per research.md decisions
#1–#3 and #9, the feature's logic is therefore designed to live in pure, dependency-free
functions in `lib/csv.js` so it can be fully unit-tested that way; `routes/traveler.js` stays a
thin glue layer validated manually via quickstart.md, matching how every other route in that file
is validated today.

**Organization**: Tasks are grouped by user story (spec.md) to enable independent implementation
and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- File paths are relative to the repository root

## Phase 1: Setup

**Purpose**: Scaffold the two new files this feature adds, so later phases have somewhere to add
code.

- [X] T001 [P] Create `lib/csv.js` with a module scaffold (`module.exports = {};`) to hold the new
      CSV helper functions
- [X] T002 [P] Create `test/lib/csv-test.js` with a mocha/chai `describe('csv', ...)` scaffold,
      matching the style of `test/lib/req-utils-test.js` (`require('chai').should()`, `sinon`
      available if needed)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Generic CSV primitives and the traveler-field join logic that every user story's
output depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 Implement `escapeCsvValue(value)` in `lib/csv.js` — RFC 4180-style escaping for a
      single value: `null`/`undefined` → `''`; wrap in double quotes and double any embedded
      double quotes when the value contains a comma, double quote, or line break; otherwise
      return `String(value)` unchanged
- [X] T004 Implement `toCsvRow(values)` in `lib/csv.js` — maps an array of raw values through
      `escapeCsvValue` and joins them with commas into one CSV line (no trailing newline)
      (depends on T003; same file, sequential)
- [X] T005 Implement `resolveTravelerFields(labels, types, travelerDataDocs)` in `lib/csv.js` —
      for each key `name` in `labels` (iterated in object-insertion order), look up
      `label = labels[name]` and `type = types[name]`; find the matching record(s) in
      `travelerDataDocs` where `record.name === name`, taking the one with the latest `inputOn`
      when more than one exists; return an ordered array of
      `{ name, label, type, value, inputBy, inputOn }`, using `''` for `value`/`inputBy`/
      `inputOn` when no matching record exists (per data-model.md's row-building rule; depends on
      T003/T004 only via file ownership, not logic — sequential because it edits the same file)

**Checkpoint**: `lib/csv.js` now has all primitives needed by every user story below.

---

## Phase 3: User Story 1 - Export a traveler's data for sharing or record-keeping (Priority: P1) 🎯 MVP

**Goal**: A user with read access to a traveler can request `GET /travelers/:id/csv` and receive
a CSV containing the traveler's link/id/title/status followed by one row per defined data field
(including unanswered ones); a user without access gets `403`; a nonexistent id gets `404`.

**Independent Test**: `curl -b <session-cookie> http://localhost:<port>/travelers/<id>/csv` for
an accessible traveler with both filled and empty fields returns `200` and the full expected CSV
shape (quickstart.md Scenarios 1–4); the same request without access returns `403`; a bogus id
returns `404`. No UI interaction required.

### Implementation for User Story 1

- [X] T006 [US1] Implement `buildTravelerCsv({ link, id, title, statusLabel, fields })` in
      `lib/csv.js` — returns the full CSV string: 4 metadata rows built via `toCsvRow`
      (`['Traveler Link', link]`, `['Traveler Id', id]`, `['Traveler Title', title]`,
      `['Traveler Status', statusLabel]`), one blank line, one data header row
      (`toCsvRow(['Field Name', 'Label', 'Type', 'Value', 'Input By', 'Input On'])`), then one
      `toCsvRow([...])` line per entry in `fields`, all joined with `\n` (depends on T003, T004;
      same file as T003–T005, sequential)
- [X] T007 [US1] Add `GET /travelers/:id/csv` to `routes/traveler.js`, placed next to the
      existing `/travelers/:id/json` route: middleware chain
      `auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.canReadMw('id')`;
      handler fetches
      `TravelerData.find({ _id: { $in: doc.data } }, 'name value inputOn inputBy inputType')`,
      computes `statusLabel = statusMap[doc.status]`, computes
      `` link = `${req.proxied ? authConfig.proxied_service : authConfig.service}/travelers/${doc._id}/view` ``,
      calls `csv.resolveTravelerFields(doc.labels, doc.types, travelerDataDocs)` then
      `csv.buildTravelerCsv({ link, id: doc._id, title: doc.title, statusLabel, fields })`, sets
      `res.set('Content-Type', 'text/csv; charset=utf-8')` and
      `` res.set('Content-Disposition', `attachment; filename="traveler-${doc._id}.csv"`) ``, and
      sends the CSV string (depends on T005, T006)
- [X] T008 [P] [US1] Add a "Download CSV" link (`<a href="#{prefix}/travelers/#{traveler._id}/csv">Download CSV</a>`)
      to `views/traveler.jade`, following the file's existing Jade conventions for action links
- [X] T009 [P] [US1] Add the same "Download CSV" link to `views/traveler-viewer.jade`
- [X] T010 [US1] In `test/lib/csv-test.js`, add unit tests for `buildTravelerCsv` covering: a
      traveler with two filled fields and one unanswered field (asserts full expected shape,
      metadata rows first, correct header, correct row content); a traveler with zero fields
      (asserts the data header row still appears with no data rows below it, per spec.md's Edge
      Cases) (depends on T006; same file as T002, sequential)
- [ ] T011 [US1] Follow quickstart.md Scenarios 1–4 against a running dev server
      (`npx nodemon`): happy-path export, unanswered-field export, `403` for a session without
      access, `404` for a nonexistent id — **BLOCKED in this environment**: no
      `../etc/traveler-config/` and no reachable MongoDB, so the app cannot start here; needs
      manual verification in a real dev environment before merge

**Checkpoint**: User Story 1 is fully functional and independently testable via direct HTTP
request or the new "Download CSV" link.

---

## Phase 4: User Story 2 - Identify the source traveler from the exported file alone (Priority: P2)

**Goal**: Every exported CSV's first four data lines are exactly the traveler's link, id, title,
and status, in that order, before the blank separator and the data table — so a recipient can
identify the file's origin without any other context.

**Independent Test**: A dedicated unit test asserts `buildTravelerCsv`'s output places those four
facts first, in order, ahead of everything else — verifiable without a database or running
server, independent of User Story 1's route-level test.

### Implementation for User Story 2

- [X] T012 [US2] In `test/lib/csv-test.js`, add a regression test asserting
      `buildTravelerCsv(...).split('\n')` has `Traveler Link,...` at index 0, `Traveler Id,...`
      at index 1, `Traveler Title,...` at index 2, `Traveler Status,...` at index 3, an empty
      string at index 4, and the data header row at index 5 — covers spec.md US2 Acceptance
      Scenario 1 / FR-003 (depends on T006, T010; same file, sequential)
- [ ] T013 [US2] Follow quickstart.md Scenario 5: hand an exported file to someone unfamiliar
      with the traveler and confirm they can state its link, id, title, and status from the file
      alone — **BLOCKED in this environment**, same reason as T011

**Checkpoint**: User Story 1 and User Story 2 are both independently verified.

---

## Phase 5: User Story 3 - Human-readable status and field labels (Priority: P3)

**Goal**: The Status cell always shows the human-readable name (never the raw numeric code), and
each row's Label cell matches the traveler's own field labels.

**Independent Test**: Dedicated unit tests feed already-resolved `statusLabel`/`labels` values
into the Phase 2/3 functions and assert the output text — independent of the database or a
running server.

### Implementation for User Story 3

- [X] T014 [US3] In `test/lib/csv-test.js`, add a regression test asserting
      `buildTravelerCsv({ ..., statusLabel: 'active', ... })`'s output contains
      `Traveler Status,active` and never a bare numeric status code — covers spec.md US3
      Acceptance Scenario 1 / FR-004 (depends on T006, T010; same file, sequential)
- [X] T015 [US3] In `test/lib/csv-test.js`, add a regression test asserting
      `resolveTravelerFields` returns, for a `labels` map with distinct label text per field, rows
      whose `label` exactly matches `labels[name]` for each field — covers spec.md US3
      Acceptance Scenario 2 / FR-005 (depends on T005, T010; same file, sequential)
- [ ] T016 [US3] Follow quickstart.md Scenario 6: export travelers in a few different lifecycle
      statuses and confirm the Status column always shows the human-readable name and each Label
      cell matches the traveler's own UI — **BLOCKED in this environment**, same reason as T011

**Checkpoint**: All three user stories are independently functional and verified.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final consistency and regression checks across the whole feature.

- [~] T017 Run `npx eslint .` and `npx prettier --write .`; fix any violations in `lib/csv.js`,
      `routes/traveler.js`, `views/traveler.jade`, `views/traveler-viewer.jade`, and
      `test/lib/csv-test.js` — Prettier: done, all changed JS files clean. ESLint: **BLOCKED**,
      pre-existing to this repo/environment — `.eslintrc` requires `eslint-config-airbnb-base`,
      which isn't resolvable under the installed ESLint 9.39.4 (flat-config-only); reproduces
      identically on an untouched file (`routes/form.js`) with zero feature changes, so it is not
      something this feature introduced or can fix within scope
- [~] T018 Run `npx mocha test/lib/` and confirm the full suite passes with no regressions — the
      full suite fails to even load: `test/lib/ldap-client-test.js` requires
      `../../config/ad.json`, which only exists in the external `../etc/traveler-config/`
      directory (not present in this sandbox). Ran the subset that *can* load here
      (`req-utils-test.js` + the new `csv-test.js`): 13/13 passing, no regressions
- [ ] T019 Follow quickstart.md Scenario 7: enter a value containing a comma, a double quote, and
      a line break, export the traveler, and confirm the value opens correctly as a single cell
      in a spreadsheet application — **BLOCKED in this environment**, same reason as T011

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup (T001) — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational completion
- **User Story 2 (Phase 4)**: Depends on Foundational completion and on T006/T010 from User
  Story 1 (it adds a regression test over `buildTravelerCsv`, so that function and its initial
  test coverage must exist first)
- **User Story 3 (Phase 5)**: Depends on Foundational completion and on T005/T006/T010 from User
  Story 1, for the same reason as User Story 2
- **Polish (Phase 6)**: Depends on all three user stories being complete

### Within Each Phase

- Tasks touching `lib/csv.js` are sequential (same file): T003 → T004 → T005 → T006
- Tasks touching `test/lib/csv-test.js` are sequential (same file): T002 → T010 → T012 → T014 →
  T015
- T007 (route) depends on T005 and T006 being complete
- T008/T009 (view links) have no code dependency on T007 and can proceed in parallel with it

### Parallel Opportunities

- T001 and T002 (Setup) — different files
- T008 and T009 (Phase 3 view links) — different files, and independent of T007's route logic

---

## Parallel Example: User Story 1

```bash
# After T005 and T006 are complete, these can proceed together:
Task: "Add GET /travelers/:id/csv to routes/traveler.js"
Task: "Add a Download CSV link to views/traveler.jade"
Task: "Add a Download CSV link to views/traveler-viewer.jade"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 2: Foundational (T003–T005) — CRITICAL, blocks all stories
3. Complete Phase 3: User Story 1 (T006–T011)
4. **STOP and VALIDATE**: Run quickstart.md Scenarios 1–4 against a real traveler
5. This is already a complete, shippable feature — User Story 1's acceptance scenarios already
   require the full metadata block, so US2 and US3 largely add regression-test coverage over the
   same implementation rather than new production code

### Incremental Delivery

1. Setup + Foundational → CSV primitives and field-join logic ready
2. User Story 1 → route, view links, and core tests → **MVP**, demo-able
3. User Story 2 → regression test locking in metadata-block ordering
4. User Story 3 → regression tests locking in human-readable status/labels
5. Polish → lint/format, full regression run, special-character manual check

---

## Notes

- [P] tasks touch different files and have no unmet dependency on an incomplete task
- [Story] label maps each task to its user story for traceability back to spec.md
- Because this feature's core logic is one small, cohesive module (`lib/csv.js`) plus one thin
  route, User Story 2 and User Story 3 are implemented by User Story 1's code; their own task
  phases add the regression tests and manual checks that specifically lock in *their* acceptance
  scenarios, so each story remains independently verifiable per the Task Generation Rules
- Commit after each task or logical group
- Avoid: adding a new test/HTTP framework (e.g. `supertest`) — out of scope for this feature and
  inconsistent with every other route in `routes/traveler.js`, none of which have automated
  coverage today
