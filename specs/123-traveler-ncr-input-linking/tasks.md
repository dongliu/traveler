# Tasks: Traveler-Initiated NCRs Linked to a Specific Input

**Input**: Design documents from `specs/123-traveler-ncr-input-linking/`

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[US1]**–**[US3]**: Map to spec.md's three user stories (Initiate from a filled-in input / See link+status on the traveler / See traveler+input reference on the NCR)

## Path Conventions

Single Express MVC project at repo root — extends the existing `model/`, `lib/`, `routes/`, `views/`, `public/javascripts/`, `test-unit/`, `e2e/` from `001-ncr-workflow`. No new top-level directories, no new collection.

---

## Phase 1: Setup

*No setup required — this feature extends existing files in a running application; no new dependencies.*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The schema fields every user story reads or writes.

**⚠️ CRITICAL**: No user story can be implemented until this phase is complete.

- [ ] T001 In `model/ncr.js`: replace `traveler_link.step_number: Number` with `input_name: String` and `input_label: String` (per data-model.md); add `NcrSchema.index({ 'traveler_link.traveler_id': 1, 'traveler_link.input_name': 1 });` alongside the existing indexes at the bottom of the file

**Checkpoint**: The schema holds the right fields and is indexed — user story implementation can now begin.

---

## Phase 3: User Story 1 — Initiate an NCR from a Filled-In Traveler Input (Priority: P1) 🎯 MVP

**Goal**: A user viewing a traveler input that already has a submitted value can trigger "Initiate NCR" and end up with a new NCR linked to that exact traveler and input.

**Independent Test**: Fill in one traveler input, trigger "Initiate NCR" from it, complete NCR creation, and confirm the resulting NCR's `traveler_link` holds that traveler's id, that input's name, and that input's label — and that no such action is offered for an input with no value yet.

### Tests for User Story 1 ⚠️

> Write these tests first; confirm they fail against the not-yet-updated `createNcr`/`closeNcr` before implementing.

- [ ] T002 [P] [US1] Update the unit test in `test-unit/lib/ncr-service.test.js` (~line 226) that currently asserts `ncr.traveler_link.step_number.should.equal(3)` after calling `createNcr` with `{traveler_id: 'trav1', traveler_step_number: 3}` — change the input to `{traveler_id: 'trav1', traveler_input_name: 'part_qty', traveler_input_label: 'Part Quantity'}` and assert `ncr.traveler_link.input_name.should.equal('part_qty')` and `ncr.traveler_link.input_label.should.equal('Part Quantity')`
- [ ] T003 [P] [US1] Update the two `closeNcr` test fixtures in `test-unit/lib/ncr-service.test.js` (~lines 917, 948) that currently set `traveler_link: {traveler_id: 'trav1', step_number: 2, initiated_from_traveler: true}` to use `input_name: 'part_qty'` instead of `step_number: 2`; update whichever assertion (if any) reads the `traveler.signed_off` event's payload to expect `{traveler_id, input_name}` instead of `{traveler_id, step_number}`

### Implementation for User Story 1

- [ ] T004 [US1] In `lib/ncr-service.js`: `createNcr()` — build `ncr.traveler_link` from `data.traveler_id`/`data.traveler_input_name`/`data.traveler_input_label` (same `if (data.traveler_id) {...}` gate as today, just the two renamed source fields); `closeNcr()` — rename the `traveler.signed_off` event's payload key from `step_number: ncr.traveler_link.step_number` to `input_name: ncr.traveler_link.input_name` (depends on T001; makes T002/T003 pass)
- [ ] T005 [US1] In `routes/ncr.js`'s `POST '/'` handler: replace `traveler_step_number: req.body.traveler_step_number` with `traveler_input_name: sanitizeStr(req.body.traveler_input_name)` and `traveler_input_label: sanitizeStr(req.body.traveler_input_label)` in the body-parse block `b` — per `contracts/ncr-create-traveler-fields.json` (depends on T004)
- [ ] T006 [US1] In `views/ncr-create.jade`'s script block: on load, read `traveler_id`/`input_name`/`input_label` from `new URLSearchParams(location.search)`; if `traveler_id` is present, show a small info banner naming the input this NCR will be linked to (decoded `input_label`), and merge `traveler_id`/`traveler_input_name` (from `input_name`)/`traveler_input_label` (from `input_label`) into the existing `payload` object right before the `POST /api/ncrs` call (depends on T005)
- [ ] T007 [US1] In `public/javascripts/lib/traveler.js`: add `export function renderNcrLinks()` as a sibling of `renderNotes()` — iterate `#form .controls` exactly as `renderNotes()` does (skip checkbox-sets, take the first `input,textarea`); for each field whose `name` is in `window.traveler.touchedInputs`, append an "Initiate NCR" link into that `.controls` div, `href` built from `prefix + '/ncrs/new?traveler_id=' + window.traveler._id + '&input_name=' + encodeURIComponent(name) + '&input_label=' + encodeURIComponent(label)`, where `label` is looked up the same way `utilities/routes.js`'s `resetTouched()` picks the active form (`window.traveler.forms.length === 1 ? window.traveler.forms[0] : window.traveler.forms.find(f => f._id === window.traveler.activeForm)`, then `.labels[name]`); call `renderNcrLinks()` once at the end of `renderHistory()`, right next to the existing `renderNotes()` call (depends on T006 so the generated link's destination is meaningful end-to-end)
- [ ] T008 [US1] In `public/javascripts/traveler.js`'s `'#form'` `click` handler on `button[value="save"]` (the first-time-touched branch alongside the existing `incrementFinished()` call): push `input.name` into `window.traveler.touchedInputs` if not already present, then re-invoke the per-field "Initiate NCR" rendering for that one field so it appears immediately with no page reload (depends on T007)

**Checkpoint**: A user can fill in a traveler input, see "Initiate NCR" appear without reloading, click through to a pre-linked NCR creation, and the created NCR carries the right `traveler_link`. Independently testable and demoable now.

---

## Phase 4: User Story 2 — See the Linked NCR's Link and Status on the Traveler Input (Priority: P1)

**Goal**: Anyone viewing the traveler sees, at any input with one or more linked NCRs, a link to each and its live current status.

**Independent Test**: With an NCR already linked to an input (from User Story 1), reload the traveler and confirm a link + current status appears at that input; change the NCR's status and confirm the traveler reflects it on next view; initiate a second NCR from the same input and confirm both appear, distinguishable.

> No dedicated unit test is added for the new route below — it is a
> thin, direct Mongoose query with no branching logic (mirroring how its
> sibling `GET /travelers/:id/notes/` route also has no dedicated unit
> test), and is covered end-to-end by this story's e2e coverage (T014).

### Implementation for User Story 2

- [ ] T009 [US2] In `routes/traveler.js`: add `app.get('/travelers/:id/ncr-links/', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.canReadMw('id'), function(req, res) {...})` right after the existing `GET /travelers/:id/notes/` route, styled identically — query `Ncr.find({'traveler_link.traveler_id': req.params.id, 'traveler_link.initiated_from_traveler': true}, {ncr_number:1, status:1, 'traveler_link.input_name':1}).lean()`, reshape to the flat array `[{input_name, ncr_id, ncr_number, status}]` per `contracts/traveler-ncr-links.json`, `res.status(200).json(...)` (depends on T001; requires `const { Ncr } = require('../model/ncr');` added to this file's existing requires)
- [ ] T010 [US2] In `public/javascripts/lib/traveler.js`'s `renderNcrLinks()` (from T007): additionally fetch `GET ./ncr-links/` (mirroring `renderNotes()`'s `$.ajax` call to `./notes/`); for each `.controls` field, filter the fetched array by `e.input_name === element.name` and append one badge+link per match (e.g. `<a href="prefix + '/ncrs/' + ncr_id"><span class="badge">status</span> ncr_number</a>`), so an input with existing links shows all of them alongside (not instead of) the "Initiate NCR" action from T007 (depends on T009, T007)

**Checkpoint**: Both User Stories 1 and 2 work together — initiating an NCR from an input and then seeing it (and its live status) reflected back on that same input, including a second one added later.

---

## Phase 5: User Story 3 — See the Source Traveler and Input on the NCR (Priority: P2)

**Goal**: Anyone viewing a traveler-initiated NCR's detail page sees a link back to the traveler and the originating input's label.

**Independent Test**: Open a traveler-initiated NCR's detail page and confirm the traveler link + input label are shown; open a standalone (non-traveler) NCR's detail page and confirm neither appears.

### Implementation for User Story 3

- [ ] T011 [US3] In `views/ncr-detail.jade`: add, near the top of the page (e.g. after the status badge, before "Part Information"), `if ncr.traveler_link && ncr.traveler_link.initiated_from_traveler` → a `fieldset` titled "Originating Traveler" with `dt Traveler` / `dd` containing `a(href='#{prefix}/travelers/#{ncr.traveler_link.traveler_id}/') View Traveler` and `dt Input` / `dd= ncr.traveler_link.input_label` — omitted entirely (no empty fieldset) when the condition is false (depends on T001; needs T004 to have actually populated `input_label` on real data to demo end-to-end)

**Checkpoint**: All three user stories complete — the full two-way link (traveler ⇄ NCR) and its display on both sides is implemented and independently testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Keep existing test fixtures consistent with the renamed field, and verify the complete change end-to-end.

- [ ] T012 [P] In `e2e/fixtures/cli.js`'s `createTravelerLinkedNcr({ncrData, status, travelerId, stepNumber})`: rename the `stepNumber` parameter to `inputName` and the `ncrData` field it sets from `step_number: stepNumber` to `input_name: inputName`
- [ ] T013 [P] Update the 6 existing callers that pass `stepNumber: 1` to `create-traveler-linked-ncr` — `e2e/us1-create-and-submit-ncr.spec.js`, `e2e/us-admin-ncr-deletion.spec.js`, `e2e/us-originator-designate.spec.js`, `e2e/us2-ce-cs-disposition.spec.js`, `e2e/us3-qa-concurrence-and-approver-coordination.spec.js`, `e2e/us-ncr-attachments.spec.js` — change each to `inputName: 'field_1'` (a placeholder; none of these tests assert on its value, only on `initiated_from_traveler`) (depends on T012)
- [ ] T014 [P] Create `e2e/us-traveler-ncr-input-linking.spec.js` covering quickstart.md's scenarios: no "Initiate NCR" action on an untouched input; the action appears immediately after a save with no reload; clicking it opens NCR creation pre-linked (banner shows the input label); completing creation still enforces every normal mandatory field; the traveler then shows a link + current status at that input; the status updates after a disposition change; a second NCR from the same input is never blocked and both show distinctly; the created NCR's detail page shows the traveler link + input label; a standalone NCR shows neither; two travelers sharing an input name never cross-link (depends on T004, T005, T006, T007, T008, T009, T010, T011)
- [ ] T015 Run `TRAVELER_CONFIG_REL_PATH=docker npx mocha test-unit/lib/ncr-service.test.js` and confirm all tests pass, including the updated `traveler_link` fixtures/assertions and no regressions elsewhere in the file
- [ ] T016 Run `npx playwright test us-traveler-ncr-input-linking.spec.js` (from `e2e/`, Docker stack running) and confirm all tests pass, then run the full `npx playwright test` suite and confirm no new regressions (a same-file rerun in isolation, per this project's own established practice, is the way to distinguish a real regression from unrelated cross-file worker contention)
- [ ] T017 [P] Manually walk through `specs/123-traveler-ncr-input-linking/quickstart.md` steps 1–11 to confirm the UI behavior (banner wording, badge placement, no-reload reveal) matches what the automated tests assert

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: None — skipped, no new dependencies
- **Foundational (Phase 2)**: T001 — BLOCKS all user stories (every story reads or writes `traveler_link.input_name`/`input_label`)
- **User Stories (Phase 3-5)**: All depend on Phase 2 completion
  - US1 (Phase 3) is the MVP — without it, no NCR is ever actually linked to an input for US2/US3 to display
  - US2 (Phase 4) depends on US1's T007 (both extend the same `renderNcrLinks()` function) and on data US1 produces to have anything to display, but its own new route (T009) could be written any time after T001
  - US3 (Phase 5) only needs T001 for the schema, plus T004 to have real `input_label` data to demo against — its own template change (T011) is otherwise independent of US2
- **Polish (Phase 6)**: Depends on all three user stories being complete

### Within Each User Story

- Tests before implementation (T002/T003 before T004) — TDD per the constitution's "Automated Testing" principle
- Service layer (`lib/ncr-service.js`, T004) before route (`routes/ncr.js`, T005) before the page that calls it (`views/ncr-create.jade`, T006) before the traveler-side link generator that points at it (T007) before the live-update-after-save patch (T008)
- New route (T009) before the client code that fetches it (T010)

### Parallel Opportunities

- T002 and T003 can be written in parallel (independent test edits in the same file, different describe blocks)
- T009 (new traveler route) has no dependency on T005/T006/T007/T008 beyond T001, and could be implemented in parallel with all of US1 once T001 lands
- T012 and T013 can proceed in parallel with any of Phases 3-5 (they only touch test fixtures, not application code) but T013 depends on T012 (the renamed parameter must exist first)
- T017 can be prepared in parallel with T015/T016, though running T015 first catches a cheap regression before the more expensive e2e run

---

## Parallel Example: Phase 2 → Phase 3 tests, plus Phase 4's independent route

```bash
# Phase 2 (sequential, must complete first):
Task T001: "model/ncr.js traveler_link field rename + index"

# Then, in parallel:
Task T002: "createNcr traveler_link input_name/input_label unit test"
Task T003: "closeNcr traveler.signed_off payload rename unit test"
Task T009: "GET /travelers/:id/ncr-links/ route" (only needs T001)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (T001) — CRITICAL, blocks everything
2. Complete Phase 3: User Story 1 (T002-T008)
3. **STOP and VALIDATE**: quickstart.md steps 1-4 — fill in an input, initiate an NCR from it, confirm the created NCR's `traveler_link` is correct
4. Deploy/demo if ready — this alone resolves the "Initiate NCR" half of the original deferred Future Work item

### Incremental Delivery

1. Foundational (T001) → the schema is ready
2. Add US1 (T002-T008) → NCRs can be created linked to a specific input → demo (MVP)
3. Add US2 (T009-T010) → the traveler shows those links back, live → demo
4. Add US3 (T011) → the NCR shows the reverse link too → demo (the full two-way link is now complete)
5. Polish (T012-T017) → existing fixtures stay consistent, full automated + manual coverage

### Key Constraints (from research.md and data-model.md)

- `POST /travelers/:id/data/`'s response contract MUST stay `204` (T008 patches `touchedInputs` client-side only, never by changing that route)
- `POST /api/ncrs`'s existing required-field validation MUST NOT change (T005/T006 add purely additive, optional fields)
- The new traveler-side route (T009) MUST NOT add any NCR-specific authorization beyond the traveler's own existing `canReadMw` gate, per the resolved clarification that traveler access alone governs visibility
- Initiating a second NCR from an already-linked input MUST NOT be blocked anywhere (T004, T007, T010 all leave this ungated) — no task introduces a check for "does this input already have a linked NCR"

---

## Notes

- [P] tasks touch different files (or independent test cases/fixtures) with no unfinished dependency between them
- [US1]/[US2]/[US3] labels map each Phase 3-5 task to its user story for traceability back to spec.md
- Commit after each phase's checkpoint is reached and its tests pass
- Six of Phase 6's files (T013's list) are touched only because they pass a now-renamed, always-dead `stepNumber` value to a test fixture — none of their own assertions depend on that value, so this is pure consistency cleanup, not a functional change to those tests
