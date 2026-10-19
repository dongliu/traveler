# Tasks: Extend Traveler Print Output with NCR Details

**Input**: Design documents from `specs/126-ncr-details-print/`

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Tests**: Included. The constitution (I. Automated Testing) requires tests for every new feature. Unit tests for the new pure `lib/` functions; one new Playwright e2e spec for the two new endpoints and the client-rendered page content (the only meaningful way to verify client-side rendering in this codebase — research.md R8).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[US1]/[US2]**: Map to spec.md's two user stories (Every linked NCR's details, gathered at the end / Review records included automatically)
- Paths are repo-root relative.

## Path Conventions

Single Express MVC project at repo root — extends the existing `lib/`, `routes/`, `views/`, `public/javascripts/`, `test-unit/`, `e2e/`. No new top-level directory, no new router file, no new client-side module file, no schema change, no new dependency.

## Selectors and identifiers the tasks share

| Where | Identifier |
|---|---|
| New endpoints | `GET /travelers/:id/ncr-print-details/`, `GET /travelers/:id/review-records/` |
| New `lib/traveler-ncr.js` functions | `findAllLinkedNcrs(travelerId)`, `orderNcrsByFormPosition(ncrs, labels)`, `reviewRecordRows(traveler, reviewerNames)` |
| Newly exported from `lib/ncr-pdf.js` | `tableSection` (already existed internally; this feature is its first external caller) |
| New DOM (`views/traveler-print.jade`) | `#ncr-print-sections` (after the form), `#review-records` (with the traveler's own content); `#create-pdf` gains `disabled` by default |
| New client function (`public/javascripts/traveler-print.js`) | `renderSection(container, section)` |
| New fixture (`e2e/fixtures/cli.js`) | `set-traveler-review-results` (direct write to `traveler.__review.reviewResults`) |
| Reused fixtures | `create-fillable-traveler`, `create-traveler-linked-ncr`, `set-ncr-status`, `set-traveler-status` (all already in `e2e/fixtures/cli.js`) |
| E2E personas | primary = `dong` (traveler owner **and** an admin), secondary = `bob` |

---

## Phase 1: Setup

**Purpose**: Confirm a clean baseline before changing anything. No new dependency to install.

- [ ] T001 Run `TRAVELER_CONFIG_REL_PATH=docker npm run unit` and `npx eslint .` on the current branch and record the pass/fail counts in `specs/126-ncr-details-print/baseline.txt`, so any later failure is attributable to this feature rather than pre-existing state. Note in the same file that no new npm dependency is introduced.
- [ ] T002 Confirm the Docker stack is up (`docker compose up`) and `.env` has `E2E_USER`, `E2E_PASS`, `E2E_USER2`, `E2E_PASS2`; run `npm run e2e -- e2e/us-traveler-ncr-gating.spec.js` and record its result in `specs/126-ncr-details-print/baseline.txt` (the closest existing coverage: traveler/NCR linking and the NCR closure PDF this feature's own NCR content reuses). Note any pre-existing failure by name so it is not misattributed later.

---

## Phase 2: User Story 1 — Every linked NCR's details, gathered at the end of the printed record (Priority: P1) 🎯 MVP

**Goal**: The print page's "Nonconformance Reports" section, positioned after the traveler's own form content, lists every NCR linked to the traveler — any status — in the same top-to-bottom order as the inputs they were raised against appear on the form, with full substantive detail and no Event History, fetched and rendered client-side before the user prints.

**Independent Test**: spec.md User Story 1's own Independent Test.

### Tests for User Story 1 ⚠️

> Write first; confirm they fail before implementing.

- [ ] T003 [P] [US1] In `test-unit/lib/traveler-ncr.test.js`, add a `describe('findAllLinkedNcrs', ...)` block (stub `Ncr.find` the same way the existing `findOpenNcrs` tests do — `sandbox.stub(Ncr, 'find').returns({ lean: () => Promise.resolve(rows) })` then `.sort` chained, or adjust the stub shape to however the implementation calls it): asserts the filter is `{'traveler_link.traveler_id': travelerId, 'traveler_link.initiated_from_traveler': true}` with **no** `status` key (contrast with `openNcrFilter`'s own filter, which has one); asserts the query is sorted `{created_at: 1}`; asserts no field-projection argument narrows the result (full documents, since `buildNcrPdfModel` needs every field — unlike `findOpenNcrs`'s summary-only projection).
- [ ] T004 [P] [US1] In `test-unit/lib/traveler-ncr.test.js`, add a `describe('orderNcrsByFormPosition', ...)` block (pure function, plain fixture arrays, no stubs needed): given NCRs linked to inputs `b` then `a` (in that array order) and `labels = {a: 'A', b: 'B'}`, returns them reordered `a`-linked-first; an NCR whose `traveler_link.input_name` is not a key of `labels` sorts after every NCR whose input is recognized; two NCRs linked to the **same** input keep their given relative order (stability); the function does not mutate the array it was given (assert the original array's own order is unchanged after the call).
- [ ] T005 [P] [US1] Create `e2e/us-traveler-print-ncr-details.spec.js` (header comment in the style of `e2e/us-traveler-ncr-gating.spec.js`; import `runId`, `execFixtureCli`). Add `test.describe('US1 — every linked NCR, gathered at the end, in form order')`: build a traveler with two inputs, link one NCR to each (create the NCR linked to the **second** input first, then the one linked to the **first** input, via `create-traveler-linked-ncr`, so creation order and form order disagree), close both (`set-ncr-status` to `Closed`), then `page.goto` the print page and confirm (a) `GET .../ncr-print-details/` (via `page.request.get`) returns the two NCRs with the **first input's** NCR listed before the second input's, regardless of creation order; (b) neither NCR's rendered section contains an "Event History" heading anywhere on the page; (c) the rendered `#ncr-print-sections` content appears after `#form` in the page (not before or inside it); (d) `#create-pdf` starts `disabled` and becomes enabled once the `ncr-print-details/` response is observed (`page.waitForResponse`); (e) a traveler with no linked NCRs shows a "no NCRs" line instead of an empty section; (f) an NCR whose `description_of_nonconformance` contains `<b>`/`"`/`&` renders those characters literally in the page text (assert via `.textContent()`, not by searching the raw HTML).

### Implementation for User Story 1

- [ ] T006 [US1] In `lib/traveler-ncr.js`, implement and export `async findAllLinkedNcrs(travelerId)`: `Ncr.find({'traveler_link.traveler_id': travelerId, 'traveler_link.initiated_from_traveler': true}).sort({created_at: 1}).lean()` — no field projection (contrast with `findOpenNcrs`). (makes T003 pass)
- [ ] T007 [US1] In `lib/traveler-ncr.js`, implement and export `orderNcrsByFormPosition(ncrs, labels)` (pure): `const order = Object.keys(labels || {});` a `rank(ncr)` helper returning `order.indexOf(ncr.traveler_link && ncr.traveler_link.input_name)` with `-1` mapped to `order.length` (sorts last); `return ncrs.slice().sort((a, b) => rank(a) - rank(b));` — `.slice()` first so the input array is never mutated, and `Array.prototype.sort`'s stability (Node 18/ES2019+) keeps same-rank NCRs in their given relative order without a secondary comparator (research.md R3). (makes T004 pass)
- [ ] T008 [US1] In `routes/traveler.js`, add `GET /travelers/:id/ncr-print-details/` with the same middleware chain as `GET /travelers/:id/ncr-links/` (`auth.ensureAuthenticated`, `reqUtils.exist('id', Traveler)`, `reqUtils.canReadMw('id')`): `async function(req, res)` that calls `findAllLinkedNcrs(req.params.id)`, reorders via `orderNcrsByFormPosition(ncrs, routesUtilities.traveler.activeFormLabels(req[req.params.id]))`, then maps each through `const { buildNcrPdfModel } = require('../lib/ncr-pdf'); buildNcrPdfModel(ncr, { travelerTitle: req[req.params.id].title }).sections.filter(s => s.heading !== 'Event History')`, returning `res.status(200).json(ncrs.map(ncr => ({ncrTitle: ncr.ncr_number, sections})))`. Import `findAllLinkedNcrs`/`orderNcrsByFormPosition` alongside the existing `buildLiveStatus` destructure from `../lib/traveler-ncr`. (depends on T006, T007; makes part of T005 pass)
- [ ] T009 [US1] In `views/traveler-print.jade`: add `button.btn.btn-primary#create-pdf(disabled='disabled') Create PDF` (replacing the existing non-disabled button — same line, just the new attribute) inside the existing `if (locals.traveler.status !== undefined && locals.traveler.status === 2)` block; after the closing of `form.form-horizontal#form` and before the final `hr`, add a new block: `h3 Nonconformance Reports` + `#ncr-print-sections` (an empty container the client script fills). (depends on T008 existing conceptually, but can be written in parallel with it — different file; makes part of T005 pass)
- [ ] T010 [US1] In `public/javascripts/traveler-print.js`: add `renderSection(container, section)` — draws one `Section` (`{heading, rows}` as a definition list or two-column rows, `{heading, table}` as an HTML `<table>` with `thead`/`tbody`, `{heading, note}` as a single line) entirely via jQuery element construction and `.text()` for every value (never `.html()`, never a template string built from a value — research.md R5). In the existing `$(function() {...})` ready handler, add `$.getJSON('./ncr-print-details/')` alongside the existing discrepancy-log load: on success, if the array is empty render a "No NCRs linked to this traveler." line into `#ncr-print-sections`, else for each entry draw its `ncrTitle` as a sub-heading followed by `renderSection` for each of its `sections`; track this fetch's completion (e.g. a local flag or a shared "ready" counter — T018 extends this to also require the review-records fetch) and `$('#create-pdf').prop('disabled', false)` once it resolves. (depends on T008, T009; makes the rest of T005 pass)

**Checkpoint**: User Story 1 is functional and independently testable — every linked NCR's full detail, minus Event History, appears after the form, in the traveler's own top-to-bottom order, with no event-history listing, and `#create-pdf` is not usable until that content is actually present.

---

## Phase 3: User Story 2 — Review/approval records included automatically (Priority: P2)

**Goal**: The print page shows the traveler's complete review/approval history — every recorded outcome, including a voided one (marked as such) — automatically, with no toggle, positioned with the traveler's own content.

**Independent Test**: spec.md User Story 2's own Independent Test.

**Depends on**: User Story 1 (reuses `renderSection`, T010, and extends its `#create-pdf` readiness tracking, T018).

### Tests for User Story 2 ⚠️

- [ ] T011 [P] [US2] In `e2e/fixtures/cli.js`, add `setTravelerReviewResults({travelerId, reviewResults})`: `Traveler.updateOne({_id: travelerId}, {$set: {'__review.reviewResults': reviewResults}})` — a direct write (the same "provision a precondition, don't exercise business logic" convention the file's other fixtures already follow), so a spec can set up review history without driving the full review-request-and-submission flow (which is existing, already-tested behaviour this feature does not touch). Register it in `COMMANDS` as `'set-traveler-review-results'`.
- [ ] T012 [P] [US2] In `test-unit/lib/traveler-ncr.test.js`, add a `describe('reviewRecordRows', ...)` block (pure, plain fixtures, no stubs): given `traveler.__review.reviewResults` with a `result: '1'` and a `result: '2'` entry, maps them to `outcome: 'Approved'`/`'Rejected'`; a `voided: true` entry's row carries `voided: true` (not dropped, not silently treated as current); a `reviewerId` present in the given `reviewerNames` map resolves to that name, one **not** present falls back to the raw id; rows are returned in the same order `reviewResults` was given in (not re-sorted); a traveler with no `__review`/`reviewResults` returns `[]` without throwing.
- [ ] T013 [US2] In `e2e/us-traveler-print-ncr-details.spec.js`, add `test.describe('US2 — review records, automatically')`: using `set-traveler-review-results` to set two results (one `'1'`/approved, one `'2'`/rejected and `voided: true`) for a real user id (e.g. the secondary persona `bob`), confirm `GET .../review-records/` returns a single object shaped `{heading: 'Approvals', table: {head: [...], rows: [...]}}` (not an array) with the voided row's Outcome text marked e.g. `'Rejected (voided)'`; confirm the rendered page shows this content with no button/toggle needed to reveal it; confirm a traveler with no review results at all returns `{heading: 'Approvals', note: 'None recorded'}` and the page states so; confirm `#create-pdf` stays disabled if only the NCR fetch (not the review-records fetch) has resolved, and becomes enabled once both have (use `page.route` to delay one response, or two separate `page.waitForResponse` calls before asserting the button's disabled state).

### Implementation for User Story 2

- [ ] T014 [P] [US2] In `lib/ncr-pdf.js`, add `tableSection` to `module.exports` (it already exists and is already used internally by `buildNcrPdfModel`; this is a one-line export addition, no behaviour change — confirm `test-unit/lib/ncr-pdf.test.js` still passes unchanged).
- [ ] T015 [P] [US2] In `lib/traveler-ncr.js`, implement and export `reviewRecordRows(traveler, reviewerNames)` (pure): `(traveler.__review && traveler.__review.reviewResults || []).map(r => ({reviewerName: reviewerNames.get(r.reviewerId) || r.reviewerId, outcome: r.result === '1' ? 'Approved' : 'Rejected', date: r.submittedOn, comment: r.comment, voided: r.voided}))` — no filtering, no re-sorting. (depends on T014 only in the sense both touch review content; no file overlap — can run in parallel; makes T012 pass)
- [ ] T016 [US2] In `routes/traveler.js`, add `GET /travelers/:id/review-records/` with the same middleware chain as T008: `async function(req, res)` that collects the unique `reviewerId`s from `req[req.params.id].__review && req[req.params.id].__review.reviewResults || []`, resolves them via one `await User.find({_id: {$in: [...ids]}}, 'name').lean()` into a `Map`, calls `reviewRecordRows(traveler, map)`, and returns `res.status(200).json(require('../lib/ncr-pdf').tableSection('Approvals', ['Reviewer', 'Outcome', 'Date', 'Comments'], rows.map(r => [r.reviewerName, r.voided ? `${r.outcome} (voided)` : r.outcome, r.date, r.comment]), [3, 2, 2, 4]))`. (depends on T015, T014; makes part of T013 pass)
- [ ] T017 [US2] In `views/traveler-print.jade`, add `h3 Approvals` + `#review-records` (an empty container) after the Part Number line and before `#validation.well.hide` — with the traveler's own content, not at the end with the NCRs. (makes part of T013 pass)
- [ ] T018 [US2] In `public/javascripts/traveler-print.js` (same ready handler as T010): add `$.getJSON('./review-records/')`, and on success call `renderSection($('#review-records'), section)` with the single Section object returned. Extend the `#create-pdf` readiness tracking T010 added so it requires **both** the `ncr-print-details/` and `review-records/` fetches to have resolved before enabling the button. (depends on T010, T016, T017; makes the rest of T013 pass)

**Checkpoint**: Both user stories are functional and independently testable — the printed record shows the traveler's complete approval history automatically, and `#create-pdf` is not usable until every piece of this feature's content is actually present.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Verification and the checks the constitution requires.

- [ ] T019 Run `npx eslint .` and fix every new violation in files this feature touched.
- [ ] T020 Run `TRAVELER_CONFIG_REL_PATH=docker npm run unit` and confirm the whole suite (including the unchanged `test-unit/lib/ncr-pdf.test.js`) is green; measure coverage of the new/changed parts of `lib/traveler-ncr.js` with `TRAVELER_CONFIG_REL_PATH=docker npx c8 --include lib/traveler-ncr.js npx mocha test-unit/lib/traveler-ncr.test.js` and add tests until it is ≥ 80% (constitution I).
- [ ] T021 Run `npm audit --omit=dev` and confirm no new advisory appears (no new dependency was added by this feature); record the (unchanged) result in the PR description per constitution III.
- [ ] T022 With the stack running (`docker compose up`), run the full e2e suite `npm run e2e` and confirm `e2e/us-traveler-print-ncr-details.spec.js` passes and no other spec regressed.
- [ ] T023 Walk through `specs/126-ncr-details-print/quickstart.md` section 2 manually in a real browser and confirm the printed/saved-as-PDF output matches by eye — the one check neither unit nor e2e tests can make for the browser's own print rendering.
- [ ] T024 Add a `CLAUDE.md` "Recent Changes" entry for `126-ncr-details-print` recording: two new read-only endpoints (`GET /travelers/:id/ncr-print-details/`, `GET /travelers/:id/review-records/`); the traveler print page now shows every linked NCR's detail (minus Event History), in the traveler's own form order, and its full approval history, automatically, fetched client-side; `GET /travelers/:id/print` itself is unchanged. (constitution V)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none — start immediately.
- **User Story 1 (Phase 2)**: needs Setup only.
- **User Story 2 (Phase 3)**: needs User Story 1 (reuses `renderSection` from T010; extends the `#create-pdf` readiness tracking T010 adds, in T018).
- **Polish (Phase 4)**: after the stories you intend to ship.

### Shared-file ordering (this limits real parallelism)

| File | Order |
|---|---|
| `lib/traveler-ncr.js` | T006 → T007 → T015 |
| `routes/traveler.js` | T008 → T016 |
| `views/traveler-print.jade` | T009 → T017 |
| `public/javascripts/traveler-print.js` | T010 → T018 |
| `test-unit/lib/traveler-ncr.test.js` | T003/T004 → T012 |
| `e2e/us-traveler-print-ncr-details.spec.js` | T005 → T013 |

With more than one developer, split by story only after agreeing an owner for each shared file, or expect to rebase.

### Within Each User Story

- Tests are written first and must fail before implementation.
- `lib/traveler-ncr.js` (rules) → `routes/traveler.js` (endpoint) → `views/traveler-print.jade` (container) → `public/javascripts/traveler-print.js` (fetch + render) — the view and route tasks can run in parallel with each other (different files) once the `lib/` functions they both depend on exist.
- The story is complete, and its checkpoint verified, before the next priority begins.

### Parallel Opportunities

- Phase 1: T001 and T002 are sequential in practice (T002 needs the Docker stack up, which T001 does not require, but both are quick and typically run back-to-back).
- US1: T003 and T004 together (same file, different `describe` blocks — fine in parallel since they touch different, additive regions); T005 (different file) alongside both. T009 can be written alongside T008 (different files) once both know T006/T007 exist.
- US2: T011, T012 together (different files); T014 and T015 together (different files, both small). T017 can be written alongside T016 (different files).

## Parallel Example: User Story 1 tests

```bash
# Three different files, no dependency on each other:
Task: "T003 [P] [US1] findAllLinkedNcrs tests in test-unit/lib/traveler-ncr.test.js"
Task: "T004 [P] [US1] orderNcrsByFormPosition tests in test-unit/lib/traveler-ncr.test.js"
Task: "T005 [P] [US1] e2e NCR-details spec in e2e/us-traveler-print-ncr-details.spec.js"
```

---

## Implementation Strategy

### MVP First

1. Phase 1 (Setup).
2. **User Story 1** is the explicit, primary ask and is demoable on its own — every linked NCR's full detail, minus Event History, gathered after the form in the traveler's own order. **Ship US1 alone as the MVP.**
3. **Stop and validate** against quickstart section 2 (the review records just won't be there yet) before continuing.

### Incremental Delivery

1. Setup → foundation ready.
2. US1 → test → demo (**MVP**).
3. US2 (P2) → test → demo — review/approval history, automatically.
4. Polish (Phase 4) — lint, coverage ≥ 80%, audit, full e2e, quickstart walk-through, changelog.

### Notes

- [P] tasks touch different files (or clearly separable regions of the same file) and depend on no incomplete task.
- Confirm each story's tests fail before implementing it.
- Commit after each task or logical group; stop at any checkpoint to validate that story independently.
- `GET /travelers/:id/print` itself is never touched by any task in this list — if a task description ever seems to require changing it, that is a sign of drift from the plan, not a step to take.
