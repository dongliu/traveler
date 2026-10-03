# Tasks: Traveler-Driven NCR Input Flow and Live Status

**Input**: Design documents from `specs/125-traveler-ncr-input-flow/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: REQUIRED. Constitution Principle I ("All new features and bug fixes MUST include corresponding tests") applies. Unit tests for `lib/` logic; Playwright end-to-end tests for each user story's page behaviour. Each story's test tasks come before its implementation tasks and must fail first.

**Organization**: Tasks are grouped by user story (spec.md priorities). Story phases are independent after Phase 2, except where a dependency is noted.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: different files, no dependency on an unfinished task
- **[Story]**: US1–US6 from spec.md; setup, foundational and polish tasks have no story label

## Path Notes

- Server rules: `lib/traveler-ncr.js`. Web routes: `lib/traveler.js` (status handler), `routes/traveler.js`, `routes/api.js`, `routes/ncr-view.js`. JSON NCR API: `routes/ncr.js`.
- Client: `public/javascripts/traveler.js` (page logic), `public/javascripts/lib/traveler.js` (rendering), `public/javascripts/lib/live-refresh.js` (new).
- Views: `views/traveler.jade`, `views/ncr-create.jade`, `views/ncr-detail.jade`, `views/ncr-detail-body.jade` (new).
- E2E: `e2e/` (see `e2e/README.md`). Fixtures in `e2e/fixtures/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm a clean baseline before changing anything.

- [ ] T001 Run `npm run unit` and `npx eslint .` on the current branch and record the pass/fail counts in `specs/125-traveler-ncr-input-flow/baseline.txt` so later regressions are attributable
- [ ] T002 Confirm the Docker stack is up (`docker compose up`) and `.env` has `E2E_USER`, `E2E_PASS`, `E2E_USER2`, `E2E_PASS2`; run `npm run e2e -- e2e/us-traveler-ncr-gating.spec.js` and record its result in `specs/125-traveler-ncr-input-flow/baseline.txt`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Server-side rules and the shared client timer, used by several stories. No user story can be completed without them.

**CRITICAL**: No user story work can begin until this phase is complete.

### Tests for Phase 2 (write first; must fail)

- [ ] T003 Add unit tests in `test-unit/lib/traveler-ncr.test.js` for `valueIsEmpty`: `null`, `undefined`, `''`, `[]` are empty; `'0'`, `0`, `false`, `['a']` are not
- [ ] T004 Add unit tests in `test-unit/lib/traveler-ncr.test.js` for `missingInputs(traveler)`: an input in `labels` with no `TravelerData` entry is missing; an entry with an empty value is missing; an entry with a non-empty value is not; a traveler with no labels returns `[]`
- [ ] T005 Add unit tests in `test-unit/lib/traveler-ncr.test.js` for `assertSubmittable(travelerId)`: passes with no open NCRs and no missing inputs; throws `OPEN_NCRS` (409) listing `open_ncrs` and `missing_inputs` when both exist; throws `INPUTS_MISSING` (409) with `open_ncrs: []` when only inputs are missing; throws `OPEN_NCRS` with `missing_inputs` present when NCRs are open and inputs are missing
- [ ] T006 Add unit tests in `test-unit/lib/traveler-ncr.test.js` for `buildLiveStatus(travelerId)`: the payload has no `value` field anywhere; `revision` changes when a `TravelerData.inputOn` changes; `options` is `[]` when the traveler is not active and omits `input` when `waiting_on_ncr`; `submit_ready` is `false` when either list is non-empty

### Implementation for Phase 2

- [ ] T007 Implement `valueIsEmpty(value)` and `missingInputs(traveler)` in `lib/traveler-ncr.js`, reading `traveler.labels` and `TravelerData` through `traveler.data` (research R1); export them
- [ ] T008 Implement `assertInputsComplete(travelerId)` in `lib/traveler-ncr.js`, raising `TravelerNcrError` with code `INPUTS_MISSING` (409) and `missing_inputs`; export it
- [ ] T009 Implement `assertSubmittable(travelerId)` in `lib/traveler-ncr.js`: runs `assertNoOpenNcrs` then `assertInputsComplete`, returning the combined refusal per research R3; export it. Depends on T007, T008
- [ ] T010 Implement `buildLiveStatus(travelerId)` in `lib/traveler-ncr.js` returning the shape in `contracts/traveler-live-status.json` (per-input `revision` from `TravelerData.inputOn`; no values). Depends on T007
- [ ] T011 [P] Create `public/javascripts/lib/live-refresh.js` exporting `startLiveRefresh(callback, { intervalMs = 30000 } = {})`: runs `callback` every interval; skips a tick while the previous call is in flight; stops while `document.hidden` and runs once when visible again; returns a stop function (research R8)
- [ ] T012 [P] Record in `specs/125-traveler-ncr-input-flow/baseline.txt` that `startLiveRefresh` and the other client behaviour are tested only by the Playwright specs (T045 for the traveler page, T053 for the NCR page), using `page.clock` for 30-second timing. The mocha setup has no DOM, so no `live-refresh` unit test file is created

**Checkpoint**: Foundation ready. Server rules and the timer exist and are unit-tested.

---

## Phase 3: User Story 1 - Choose Input or Initiate NCR for Each Traveler Input (Priority: P1) 🎯 MVP

**Goal**: On an active traveler, every input shows **Input** and **Initiate NCR**. Inputs are read-only until **Input** is chosen. Choosing **Input** hides **Initiate NCR** for that input. Save and Reset return the input to showing both options.

**Independent Test**: Open an active traveler with a text, number, checkbox set, radio, file and rich-text input. Each shows exactly two options and cannot be edited. Choose **Input** on one, confirm **Initiate NCR** disappears for it, save a value, and confirm both options return with the new value.

### Tests for User Story 1 (write first; must fail)

- [ ] T013 [P] [US1] Create `e2e/us-traveler-input-flow.spec.js` with a `describe` for US1 and scenarios for spec US1 acceptance 1–7: options on every input type; read-only until **Input**; **Input** hides **Initiate NCR** and reveals Save/Reset; Save returns both options with the new value; Reset discards the change; one input in Input mode at a time; non-active traveler shows neither option. Use the fixture helpers in `e2e/fixtures/ncr-ui.js`
- [ ] T014 [P] [US1] Update `e2e/us-traveler-ncr-input-linking.spec.js`: the "Initiate NCR appears only after a value is saved" scenario is replaced by "Initiate NCR is offered on an empty input" (spec 125 FR-013)

### Implementation for User Story 1

- [ ] T015 [US1] In `public/javascripts/lib/traveler.js`, change `renderNcrLinks` so `appendInitiateNcrLink` is called for every counted input, not only for names in `traveler.touchedInputs` (spec FR-013). Keep the existing `traveler.status === 1` guard in `appendInitiateNcrLink`
- [ ] T016 [US1] In `public/javascripts/lib/traveler.js`, add `appendInputLink(element)` that renders an **Input** button in the same `.ncr-links` container as the Initiate link, with class `input-value-link`. Render it on load, for every counted input on an active traveler
- [ ] T017 [US1] In `public/javascripts/lib/traveler.js` around the `traveler.status === 1` block near line 573, stop enabling every `#form input,textarea` on load. Leave all controls disabled until **Input** is chosen (FR-008)
- [ ] T018 [US1] In `public/javascripts/traveler.js`, add a click handler for `.input-value-link` that: enables that input's controls only (`.controls` of the element); hides the sibling `.initiate-ncr-link`; disables every other input's `input-value-link` and `initiate-ncr-link` (one at a time, FR-012); shows the existing Save and Reset buttons. Cover file inputs (`input:file`) and rich-text inputs (TinyMCE, `views/inputview/rich.jade`) by re-enabling their wrapper, not just the native element
- [ ] T019 [US1] In `public/javascripts/traveler.js`, update the Save handler (around lines 637–707) and the upload handler (around lines 842–900): after success, restore the input to default state (controls disabled, both options shown, the input's **Input** link re-rendered). Do not re-add the Initiate link if one already exists (`appendInitiateNcrLink` already guards this)
- [ ] T020 [US1] In `public/javascripts/traveler.js`, update the Reset handler (around lines 725–751) the same way as T019
- [ ] T021 [P] [US1] Add styles for `.input-value-link` and the option group in `public/stylesheets/style.css`, matching the existing `.initiate-ncr-link` button

**Checkpoint**: US1 is independently testable. Run `npm run e2e -- e2e/us-traveler-input-flow.spec.js -g "US1"`.

---

## Phase 4: User Story 2 - An Input With an Open NCR Waits Until the NCR Is Closed (Priority: P1)

**Goal**: While an input has a linked NCR that is not Closed, **Input** is not offered for it. It returns when every linked NCR is Closed or removed. **Initiate NCR** stays available.

**Independent Test**: Initiate an NCR on an input and create it. Confirm **Input** is gone for that input and **Initiate NCR** remains. Close the NCR and confirm **Input** returns after the next refresh (or a reload, before US5 lands).

### Tests for User Story 2 (write first; must fail)

- [ ] T022 [P] [US2] Add to `e2e/us-traveler-input-flow.spec.js` a `describe` for US2 covering spec US2 acceptance 1–5: **Input** absent while an NCR is open; still absent with two NCRs where one is closed; returns when all are closed; **Initiate NCR** still present; removing the only open NCR (admin delete, `e2e/us-admin-ncr-deletion.spec.js` fixture) releases the hold

### Implementation for User Story 2

- [ ] T023 [US2] In `public/javascripts/lib/traveler.js`, in the `linksRequest.done` handler (around lines 452–460), keep the existing `openNcrInputNames` population (any status other than `Closed`) and, after it, re-run the Input-option rendering so an input whose NCR is open does not show **Input**
- [ ] T024 [US2] In `public/javascripts/lib/traveler.js`, in `appendInputLink` (from T016), return early when `isInputBlockedByOpenNcr(element.name)` is true. Re-check on each `renderNcrLinks` run
- [ ] T025 [US2] In `public/javascripts/lib/traveler.js`, render the waiting marker on an input with an open NCR (the existing `.ncr-links-existing` box) with the words "waiting on an open NCR" so it is visible without the badge colour (spec User Story 4 scenario 2, carried over from spec 124)

**Checkpoint**: US1 and US2 both work. The hold is visible on load.

---

## Phase 5: User Story 3 - NCRs Are Started From Inside a Traveler Only (Priority: P1)

**Goal**: Remove the copy-reference control on travelers and the "Traveler Input" field on the standalone NCR form. The **Initiate NCR** action remains the only way to link an NCR to an input, and the form it opens shows the traveler and input as fixed context.

**Independent Test**: Open `/ncrs/new`; no traveler field. Open an active traveler; no copy-reference control on any input. Click **Initiate NCR** on an input; the form shows a read-only line naming the traveler and input; submit; the NCR is linked to that input.

### Tests for User Story 3 (write first; must fail)

- [ ] T026 [P] [US3] In `e2e/us-traveler-ncr-gating.spec.js`, replace the scenario "a Copy NCR reference control is offered at every input" with "no Copy NCR reference control appears on any traveler input" (spec 125 FR-002); retire the copy-popover, paste-and-validate, and "typed reference" scenarios (spec 124 US1). Keep the Initiate-NCR scenarios
- [ ] T027 [P] [US3] Add to `e2e/us-traveler-input-flow.spec.js` a `describe` for US3: `/ncrs/new` has no `#traveler_input_ref` input (spec FR-001); "Initiate NCR" opens the form with a read-only "Linked to" line and no editable field (FR-004); a standalone NCR has no traveler link (FR-005)
- [ ] T028 [P] [US3] In `e2e/us-traveler-ncr-input-linking.spec.js`, keep the AS2 assertion that `#traveler_input_ref` carries the reference, but change the selector to the hidden field (`input[type=hidden][name=traveler_input_ref]`). Add an assertion that no visible text input for it exists

### Implementation for User Story 3

- [ ] T029 [US3] In `public/javascripts/lib/traveler.js`, delete `appendCopyRefControl`, `buildRefPopupContent`, `copyToClipboard`, `refButtonAnchor`, `closeRefPopup`, `bindRefPopupDismiss`, the `$openRefButton` state, and the call to `appendCopyRefControl` in `renderNcrLinks`. Remove any now-unused imports or exports that reference them
- [ ] T030 [P] [US3] In `public/stylesheets/style.css`, remove the `.copy-ncr-ref`, `.ncr-ref-popover`, `.ncr-ref-popup`, `.ncr-ref-value`, `.ncr-ref-copy`, `.ncr-ref-status`, `.ncr-ref-row` rules
- [ ] T031 [US3] In `views/ncr-create.jade`, delete the "Traveler Input" control group (the `label(for='traveler_input_ref')` block, its `input#traveler_input_ref`, its help text, and `#traveler-ref-preview`) around lines 69–75
- [ ] T032 [US3] In `views/ncr-create.jade` script, delete the handlers that read, validate and preview `#traveler_input_ref` on input and blur (around lines 130–180) and the `payload.traveler_input_ref` assignment from the field (around lines 257–260). Keep the `traveler_input_ref` URL-parameter read (`initialRef`)
- [ ] T033 [US3] In `views/ncr-create.jade`, when `initialRef` is present: call `$.getJSON(prefix + '/api/ncrs/traveler-input', { ref: initialRef })` (the existing route in `routes/ncr.js`, mounted at `/api/ncrs` in `app.js`, the same URL the form already uses at line ~153); on success render a read-only line "Linked to: <traveler title> — <input label>" and add `<input type="hidden" id="traveler_input_ref" name="traveler_input_ref">` with the reference; on failure show the server's message and disable the submit button. Submit sends the hidden value
- [ ] T034 [US3] Confirm `routes/ncr.js` POST `/` still accepts `traveler_input_ref` and the deprecated `traveler_id`/`traveler_input_name` alias unchanged (spec Assumptions: REST keeps its link). Add a comment to `requestedTravelerRef` noting the web form no longer sends the field except through "Initiate NCR"

**Checkpoint**: US3 complete. No traveler reference can be typed in the web UI.

---

## Phase 6: User Story 4 - A Traveler Can Be Submitted Only When Its NCRs Are Closed and Every Input Has a Value (Priority: P1)

**Goal**: **Submit for completion** is enabled only when every linked NCR is Closed and every counted input has a saved, non-empty value, and no input is in Input mode with unsaved changes. The server refuses otherwise on every route, including the REST API. The existing "submit anyway" prompt is replaced.

**Independent Test**: On an active traveler with one empty input and one input with an open NCR, **Submit for completion** is disabled and lists both. Fill the input and close the NCR; within 30 seconds (or on reload) the button is enabled and submission proceeds.

### Tests for User Story 4 (write first; must fail)

- [ ] T035 [P] [US4] Add to `e2e/us-traveler-input-flow.spec.js` a `describe` for US4 covering spec US4 acceptance 1–7: button disabled and listing reasons for an empty input; listing open NCRs with links; disabled while an input has unsaved changes; enabled when all satisfied; administrator refused the same way
- [ ] T036 [P] [US4] Add to `e2e/us-traveler-input-flow.spec.js` an API-level test: `PUT /apis/travelers/:id/status/` (Basic auth, port 3002) with `status: 1.5` on a traveler that has an empty input and no NCRs returns `409` with `code: "INPUTS_MISSING"`, `missing_inputs` naming that input, and `open_ncrs: []` (contracts/traveler-completion-refusal.json). The same call succeeds after the input is filled
- [ ] T037 [P] [US4] In `e2e/us-traveler-ncr-gating.spec.js`, update any assertion that expects the "submit anyway" confirmation dialog to expect the disabled button instead (spec FR-024)

### Implementation for User Story 4

- [ ] T038 [US4] In `lib/traveler.js` (the status handler, around lines 62–75), replace `assertNoOpenNcrs(doc._id)` with `assertSubmittable(doc._id)` and keep the existing `TravelerNcrError` response path
- [ ] T039 [US4] In `routes/api.js` around lines 343–356 (`PUT /apis/travelers/:id/status/`), replace `assertNoOpenNcrs` with `assertSubmittable`
- [ ] T040 [US4] In `routes/api.js` around lines 737–752 (`POST /apis/update/traveler/:id/`), replace `assertNoOpenNcrs` with `assertSubmittable`, preserving the `!isSubmissionTransition` short-circuit
- [ ] T041 [US4] In `views/traveler.jade` near line 179, add an empty `ul#submit-blockers.help-block` above the **Submit for completion** button (`#complete2`), and set the button to `disabled` by default in the markup
- [ ] T042 [US4] In `public/javascripts/traveler.js`, add `updateSubmitState(liveStatus)` that sets `#complete2` and `#complete` disabled unless `submit_ready` is true and no input is in Input mode with unsaved changes; renders reasons into `#submit-blockers` (each open NCR as a link with number, status, input label; each missing input by label). Call it on page load and after each Save, Reset and status change
- [ ] T043 [US4] In `public/javascripts/traveler.js`, replace the `completeClick` confirmation (around lines 402–411, `showConfirmation(complete)` for incomplete inputs) so the handler only calls `complete()` when the button is enabled (spec FR-024)
- [ ] T044 [US4] In `public/javascripts/traveler.js`, extend `showOpenNcrs(response)` (around line 84) to render `response.missing_inputs` as a second list, and extend `setStatus` error handling (around line 125) so `code === 'INPUTS_MISSING'` shows the missing-input list under the same alert

**Checkpoint**: US4 complete. Submission refused on every route when a condition is unmet.

---

## Phase 7: User Story 5 - Traveler Page Live Status Every 30 Seconds (Priority: P2)

**Goal**: An open, active traveler page polls every 30 seconds and updates inputs, NCR badges, finished count and submit state without reload. An input being edited is not overwritten. Failed refreshes keep the last state. Polling pauses while the tab is hidden.

**Independent Test**: Open an active traveler in one browser. In another, close one of its NCRs and save a value on one of its inputs. Without reloading the first browser, within 30 seconds the NCR status, the input state and the **Submit for completion** availability update.

### Tests for User Story 5 (write first; must fail)

- [ ] T045 [P] [US5] Create `e2e/us-traveler-live-status.spec.js` with scenarios for spec US5 acceptance 1–7. Use Playwright `page.clock` to advance 30 seconds without waiting. Assert: a poll request to `/travelers/:id/live-status/` fires per 30 s; an NCR status change applied; another user's saved value shown; an input in Input mode with typed text keeps its text; a traveler moved away from active removes the options and disables submit; a 500 response keeps the last state and shows no error alert; `document.hidden` pauses polling (use `page.evaluate` to stub `document.hidden`)
- [ ] T046 [P] [US5] Add a scenario to `e2e/us-traveler-live-status.spec.js`: opening a traveler that is not active (for example one in status 1.5) issues no `live-status` requests over 60 seconds on `page.clock` (spec FR-031)

### Implementation for User Story 5

- [ ] T047 [US5] In `routes/traveler.js`, add `app.get('/travelers/:id/live-status/', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.canReadMw('id'), handler)` where the handler calls `buildLiveStatus` from `lib/traveler-ncr.js` and returns 200 JSON, logging and returning 500 on error. Place it beside `GET /travelers/:id/ncr-links/` (around line 1221)
- [ ] T048 [US5] In `public/javascripts/traveler.js`, add `applyLiveStatus(payload)`: updates `#finished-input` and the total; updates each input's options and waiting marker using `payload.inputs`; updates NCR badges by re-running the link rendering; calls `updateSubmitState` (T042); when the traveler's `status` is no longer 1, stops the timer and removes the input options and `#complete2`
- [ ] T049 [US5] In `public/javascripts/traveler.js`, track each input's last seen `revision` in a map. When `applyLiveStatus` sees a changed revision for an input that is not in Input mode, fetch `GET ./data/` once and update that input's value and its history line. Skip the fetch and the update for an input in Input mode; apply it after Save or Reset (FR-027)
- [ ] T050 [US5] In `public/javascripts/traveler.js`, start the timer on page load with `startLiveRefresh(pollLiveStatus)` from `public/javascripts/lib/live-refresh.js` only when `traveler.status === 1`. `pollLiveStatus` calls `GET ./live-status/`; on failure, it does nothing except leave the last state in place (FR-029)
- [ ] T051 [P] [US5] In `views/traveler.jade`, add `span#live-status-updated.help-block` beside the status line; `applyLiveStatus` writes "Updated HH:MM:SS" on each successful poll (FR-029)
- [ ] T052 [US5] Add `public/javascripts/lib/live-refresh.js` to the traveler page's script list in `views/traveler.jade` `block js`, before `traveler.js`

**Checkpoint**: US5 complete. The active traveler page stays current without reload.

---

## Phase 8: User Story 6 - NCR Page Refreshes Every 30 Seconds (Priority: P2)

**Goal**: An open NCR page refreshes its status and details every 30 s without reload. Unsaved text and open dialogs are never discarded; the body refresh waits until they are dealt with.

**Independent Test**: Open an NCR in one browser. Advance it in another. Within 30 s the first page shows the new status and history. Type a comment on the first page, advance again, and confirm the typed text is still present.

### Tests for User Story 6 (write first; must fail)

- [ ] T053 [P] [US6] Create `e2e/us-ncr-live-refresh.spec.js` with scenarios for spec US6 acceptance 1–5: status and history update within 30 s via `page.clock`; typed comment preserved across a refresh; an open modal defers the body swap until closed; a failed `live-status` keeps the page and shows no error; a closed NCR is still polled (and a PDF added later appears)

### Implementation for User Story 6

- [ ] T054 [US6] In `routes/ncr-view.js`, add `app.get('/ncrs/:id/live-status', auth.ensureAuthenticated, …)` returning `{ncr_id, status, updated_at, event_count}` from `Ncr.findById(id, {status, updated_at, 'events': 1}).lean()`; 404 when the NCR is missing. Same authorization as `GET /ncrs/:id` on this route (the web route checks sign-in only — do not widen it; see the Notes)
- [ ] T055 [US6] Move the body of `views/ncr-detail.jade` (everything inside the page's main content container, excluding the layout `block js`) into `views/ncr-detail-body.jade`, and have `ncr-detail.jade` include it. Render output must be unchanged: check with `e2e/us1-create-and-submit-ncr.spec.js`
- [ ] T056 [US6] In `routes/ncr-view.js`, extract the locals built for `GET /ncrs/:id` (`ncr`, `isQa`, and `getRenderObject`) into a helper and add `app.get('/ncrs/:id/fragment', …)` that renders `ncr-detail-body` with the same locals, without the layout (`res.render('ncr-detail-body', …)` is a partial when the layout is set per-view; confirm by checking `routesUtilities.getRenderObject`)
- [ ] T057 [US6] In `views/ncr-detail.jade` `block js`, move the page's inline handlers into a function `bindNcrPage($scope)` that binds within `$scope` (default `document`), so the body can be re-bound after a swap. Use event delegation where a handler is bound per element
- [ ] T058 [US6] In `views/ncr-detail.jade` `block js`, start `startLiveRefresh(pollNcr)` (from `lib/live-refresh.js`). `pollNcr` calls `./live-status`; when `updated_at` or `event_count` changed since the last poll, and the page has no dirty form control (value differs from its loaded value) and no visible `.modal`, it fetches `./fragment` and replaces `#ncr-body` (or the container used in T055), then calls `bindNcrPage(#ncr-body)`. If dirty or a modal is open, it leaves the swap pending and retries on the next tick (FR-033)
- [ ] T059 [P] [US6] Confirm no other script on `views/ncr-detail.jade` (for example the `location.reload()` calls at lines 407–602 after actions) conflicts with the poll. Those reloads remain; they run after explicit user actions

**Checkpoint**: US6 complete. NCR page updates without losing typed text.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, API contract, lint and the full verification pass.

- [ ] T060 [P] Update `tools/openapi/openapi.yaml`: add `GET /travelers/{id}/live-status/`, `GET /ncrs/{id}/live-status` and `GET /ncrs/{id}/fragment` (web routes, documented for completeness); add the `INPUTS_MISSING` 409 body and the `missing_inputs` field on `OPEN_NCRS` (contracts/traveler-completion-refusal.json)
- [ ] T061 [P] Update the spec 124 entry in `CLAUDE.md`: the traveler-input reference is typed on the NCR form only through "Initiate NCR"; a submission is also refused when an input has no value (`INPUTS_MISSING`); the REST behaviour change for blank inputs
- [ ] T062 [P] Update `e2e/README.md` if it lists the scenario files or the copy-reference helper; remove references to retired scenarios
- [ ] T063 Remove dead code left by the change: any helper in `public/javascripts/lib/traveler.js` or `e2e/fixtures/ncr-ui.js` that only served the copy-reference popover; any unused export in `lib/traveler-ncr.js`
- [ ] T064 Run `npx eslint .` and fix any new findings (constitution II)
- [ ] T065 Run `npm run unit` and confirm all `lib/traveler-ncr.test.js` cases (new and existing) pass
- [ ] T066 Run `npm run e2e -- e2e/us-traveler-input-flow.spec.js e2e/us-traveler-live-status.spec.js e2e/us-ncr-live-refresh.spec.js e2e/us-traveler-ncr-gating.spec.js e2e/us-traveler-ncr-input-linking.spec.js` and record the result in `specs/125-traveler-ncr-input-flow/baseline.txt` under "After"
- [ ] T067 Walk through `specs/125-traveler-ncr-input-flow/quickstart.md` sections 2–4 by hand and record any deviation in the same file

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup. BLOCKS all stories. T007 → T008 → T009 and T007 → T010; T011 is independent
- **US1 (Phase 3)**: Depends on Foundational (T011 for the timer is not needed by US1; US1 needs no server change)
- **US2 (Phase 4)**: Depends on US1 (uses `appendInputLink`, T016)
- **US3 (Phase 5)**: Depends on Foundational only; can run in parallel with US1
- **US4 (Phase 6)**: Depends on Foundational (T009). Its client part (T042–T044) depends on US1's option rendering being in place (T016) for the Save/Reset hooks
- **US5 (Phase 7)**: Depends on Foundational (T010, T011) and on US4's `updateSubmitState` (T042)
- **US6 (Phase 8)**: Depends on Foundational (T011). Independent of US1–US5 on the server; the client is separate (NCR page)
- **Polish (Phase 9)**: Depends on all stories

### User Story Dependencies

- US1: after Foundational. No story dependencies.
- US2: after US1 (shares `appendInputLink`)
- US3: after Foundational. Independent of US1/US2 (different files)
- US4: after Foundational; client part after US1
- US5: after US4 (`updateSubmitState`) and Foundational
- US6: after Foundational. Independent of US1–US5

### Within Each Story

- Tests written first and seen to fail
- Server rules before routes that call them
- Client rendering before client event handlers that use it

### Parallel Opportunities

- T013 and T014 (US1 tests) — different files
- T022, T026, T027, T028 (story tests) — different files
- T021, T030 (styles) — `style.css` only; T030 and T021 must not run together (same file) — run one then the other
- T051 and T052 — different files
- US3 and US6 can run in parallel with US1 by different developers (no shared files except `public/javascripts/lib/traveler.js`, which US1 and US3 both edit: coordinate or run US3 first)
- T060, T061, T062 — different files

---

## Parallel Example: User Story 1

```bash
# Tests for US1 together:
Task: "T013 Create e2e/us-traveler-input-flow.spec.js with US1 scenarios"
Task: "T014 Update e2e/us-traveler-ncr-input-linking.spec.js"

# After tests fail, implementation in order:
Task: "T015 renderNcrLinks offers Initiate NCR on every input"  (public/javascripts/lib/traveler.js)
Task: "T016 appendInputLink" (public/javascripts/lib/traveler.js)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (Setup), Phase 2 (Foundational)
2. Phase 3 (US1): options per input, read-only until **Input**
3. **STOP and VALIDATE** with `e2e/us-traveler-input-flow.spec.js -g US1`

### Incremental Delivery

1. Foundation → US1 (MVP)
2. US2 (hold) → US3 (remove reference path)
3. US4 (submission gate) — the most important control; ship with US2 and US3 if possible
4. US5 (traveler polling) → US6 (NCR polling)
5. Polish

---

## Notes

- Each phase's test tasks must fail before the implementation tasks in that phase run. Record the failing run once in `baseline.txt`.
- `public/javascripts/lib/traveler.js` is shared by US1, US2, US3 and US5. Keep edits to it in the order given, and rebase between stories rather than merging by hand.
- `routes/ncr-view.js` `GET /ncrs/:id` checks sign-in only, not NCR read access. This is existing behaviour, not introduced here. The new `live-status` and `fragment` routes must match it, not widen or narrow it. Raise it as a separate follow-up.
- Only the web routes and the NCR detail page change for US6; the JSON NCR API in `routes/ncr.js` is unchanged except the comment in T034.
- Commit after each phase, using the repository's message style and the Co-Authored-By line.
