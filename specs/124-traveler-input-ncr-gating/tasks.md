# Tasks: Traveler Input NCR Gating and Closure Record

**Input**: Design documents from `specs/124-traveler-input-ncr-gating/`

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Tests**: Included. The constitution (I. Automated Testing) requires tests for every new feature, and plan.md commits to unit tests for both new `lib/` files plus one e2e spec covering all five stories. Write each story's tests first and confirm they fail before implementing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[US1]**–**[US5]**: Map to spec.md's five user stories (Link by reference / Active travelers only / Submission gate / Input not finished / Closure PDF)
- Paths are repo-root relative. Behavioural detail lives in the linked design docs; each task names the section to follow.

## Path Conventions

Single Express MVC project at repo root — extends the existing `model/`, `lib/`, `utilities/`, `routes/`, `views/`, `public/javascripts/`, `test-unit/`, `e2e/`. Two new source files (`lib/traveler-ncr.js`, `lib/ncr-pdf.js`), one new model (`TravelerNcrPdf`, inside `model/traveler.js`), no new top-level directory.

## Selectors and identifiers the tasks share

Tasks in different phases refer to these; use them exactly so the e2e tests and the UI agree.

| Where | Identifier |
|---|---|
| NCR form | `#traveler_input_ref` (field), `#traveler-ref-preview` (resolved title/label or message) |
| Traveler page | `.copy-ncr-ref` (copy button), `.initiate-ncr-link` (existing), `.ncr-link-badge` (existing), `.ncr-open-flag` ("Not finished — open NCR"), `.ncr-pdf-link` (PDF link), `#complete2` ("Submit for completion"), `#finished-input` (existing) |
| NCR close page | `#close-warning` (PDF failure warning) |
| Error codes | `BAD_REFERENCE` 400, `TRAVELER_NOT_FOUND` 404, `INPUT_NOT_FOUND` 404, `TRAVELER_NOT_ACTIVE` 409, `OPEN_NCRS` 409 |
| E2E personas | primary = `dong` (traveler owner **and** an admin), secondary = `bob` (non-admin, read-only via `publicAccess: 0`) |

---

## Phase 1: Setup

**Purpose**: The only new dependencies.

- [ ] T001 Run `npm install pdfkit@^0.20.2 dejavu-fonts-ttf@^2.37.3` at the repo root so both land under `dependencies` (not `devDependencies` — the Dockerfile installs with `--omit=dev`) in `package.json`, and `package-lock.json` updates. Verify with `node -e "require('pdfkit'); console.log(require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans.ttf'), require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf'))"`. `git diff package.json` must show only those two added lines. (research.md Decision 8)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared pieces every user story builds on — the rules module's shell, a shared label lookup, and the e2e fixture support.

**⚠️ CRITICAL**: No user story can begin until this phase is complete.

- [ ] T002 [P] In `utilities/routes.js`, extract the active-form label lookup out of `resetTouched()` (the block that picks `doc.forms[0]` when there is one form, otherwise `doc.forms.id(doc.activeForm)`, then falls back to `traveler.inputLabels(activeForm.html)` when `activeForm.labels` is empty) into a new function `activeFormLabels(doc)` on the same `traveler` helper object, returning the labels object (`{}` when the traveler has no forms). Keep the existing side effect of assigning `activeForm.labels` on the fallback. Change `resetTouched()` to call it. No behaviour change — this is a pure extraction so `lib/traveler-ncr.js` and `resetTouched()` share one definition of "the inputs of this form" (research.md Decision 1, Decision 2).
- [ ] T003 [P] Create `lib/traveler-ncr.js`, the single home of this feature's rules (plan.md "Files Added"). Start with the shell only: a JSDoc header stating that every rule of spec 124 lives here, that it depends on `utilities/routes.js` and never the reverse, and that models are `require`d **lazily inside functions** (so `lib/ncr-service.js` and its unit-test stubbing order are unaffected — research.md Decision 1). Export: `class TravelerNcrError extends Error` with `(code, status, message, extra = {})` storing `code`, `status`, `extra`; `errorBody(err)` returning `{ success: false, error: <'Validation Error' for 400 | 'Not Found' for 404 | 'Conflict' for 409>, code: err.code, message: err.message, ...err.extra }`; and `statusLabel(status)` returning `statusMap[String(status)]` from `model/traveler.js` (falling back to `String(status)`). Later phases add the remaining functions.
- [ ] T004 [P] In `e2e/fixtures/cli.js`: (a) extend `createFillableTraveler` to accept `status` (default `1`), `publicAccess` (default `0`; `-1` means no access for anyone but the owner) and `inputs` — an array of `{ name, label, kind }` where `kind` is `'text'` (default) or `'checkbox-in-set'`. A `checkbox-in-set` input renders inside `.control-group.checkbox-set > .controls > .checkbox-set-controls > .control-group > .controls > label.checkbox > input[type=checkbox][name=…]` (mirroring `inputview/checkbox_in_set.jade`); every input goes into `labels`/`mapping`, and `totalInput` equals the input count. When `inputs` is omitted keep today's single-input behaviour exactly, so existing specs are untouched. (b) Add commands `set-traveler-status` `{ travelerId, status }`, `get-traveler` `{ travelerId }` → `{ status, finishedInput, totalInput, touchedInputs }`, and `set-ncr-status` `{ ncrId, status }`, and register all three in the `COMMANDS` map. Keep the existing `require('../../model/user')`-before-`Traveler` ordering noted in that file.
- [ ] T005 Create `test-unit/lib/traveler-ncr.test.js` with the harness and the first tests: set `process.env.TRAVELER_CONFIG_REL_PATH = 'docker'`; register minimal stub `User`/`Group` schemas the way `test-unit/lib/ncr-service.test.js` does; helpers to build a fake traveler document (`_id`, `title`, `status`, `forms: [{ labels }]`, `activeForm`) and a fake `req` (`req.session = { userid, memberOf }`); tests for `TravelerNcrError`, `errorBody` (each of 400/404/409 maps to its label; `extra` is merged) and `statusLabel` (`1` → `active`, `1.5` → `submitted for completion`). Later phases append `describe` blocks to this file. (depends on T003)

**Checkpoint**: Shared shell, label lookup, and fixtures ready — user stories can begin.

---

## Phase 3: User Story 1 — Link a Directly-Initiated NCR to a Traveler Input by Reference (Priority: P1) 🎯 MVP

**Goal**: A user copies `traveler_id::input_name` from any input on a traveler, pastes it into the NCR form, sees the resolved traveler title and input label, and submits an NCR linked to that exact input — identical in effect to "Initiate NCR" from the traveler.

**Independent Test**: Copy a reference from an input, paste it into `/ncrs/new`, confirm the preview, submit, and confirm the NCR's `traveler_link` holds that traveler, input name and the traveler's own label; confirm a malformed or unresolvable reference is refused with a specific message and creates no NCR; confirm a blank field still creates a standalone NCR.

### Tests for User Story 1 ⚠️

> Write first; confirm they fail before implementing.

- [ ] T006 [P] [US1] In `test-unit/lib/traveler-ncr.test.js` add tests for `formatInputRef` and `parseInputRef` (whitespace trimmed; split at the **first** `::` so an input name may itself contain `::`; each of: not a string, no `::`, empty traveler id, empty input name, traveler id that is not exactly 24 hex characters, and length > 256 → `TravelerNcrError` `BAD_REFERENCE` 400 with message "Enter the reference as traveler_id::input_name.") and for `resolveInputRef(req, ref)` with `Traveler.findById` and `reqUtils.canRead` stubbed with sinon: no such traveler → `TRAVELER_NOT_FOUND` 404 "No traveler matches this reference."; traveler exists but `canRead` is false → the **same code and message** (assert deep equality of the two errors); traveler readable but input name not in labels → `INPUT_NOT_FOUND` 404 naming the traveler's title; success returns `{ traveler, travelerId, inputName, inputLabel }` with `inputLabel` taken from the labels map. (data-model.md "Traveler input reference")
- [ ] T007 [P] [US1] Create `e2e/us-traveler-ncr-gating.spec.js` (header comment in the style of `e2e/us-traveler-ncr-input-linking.spec.js`; import `runId`, `execFixtureCli`, `SECONDARY_AUTH_STATE`) and a shared helper module `e2e/fixtures/ncr-ui.js` exporting `todayIsoDate()`, `fillAndSaveInput(page, name, value)` and `completeNcrCreation(page, partNumber)` (copy the working versions from the 123 spec; the 123 spec keeps its own copies — consolidating them is out of scope). Add a `test.describe('US1 — link by reference')` with `test.use({ permissions: ['clipboard-read', 'clipboard-write'] })` covering: (1) a traveler built with inputs A (filled through the UI), B and C (unfilled) and D (`checkbox-in-set`) shows a `.copy-ncr-ref` control at **all four**; (2) clicking A's control puts exactly `${travelerId}::${nameA}` on the clipboard and the button confirms "Copied"; (3) pasting it into `#traveler_input_ref` on `/ncrs/new` shows the traveler's title and A's label in `#traveler-ref-preview`; (4) completing and submitting creates an NCR whose `get-ncr` fields show `traveler_link` `{ traveler_id, input_name, input_label, initiated_from_traveler: true }` and the traveler page then shows an `.ncr-link-badge` at A; (5) A's **Initiate NCR** link opens `/ncrs/new?traveler_input_ref=…` with `#traveler_input_ref` already filled and the preview shown; (6) a blank field yields an NCR with no `traveler_link`; (7) for each of `abc`, `::x`, `<id>::`, `<id>::nope`, and a valid-looking ObjectId that is not a traveler, submitting shows a specific message in `#ncr-error-msg` and `#ncr-success` stays hidden; (8) the same valid reference wrapped in spaces **succeeds**.
- [ ] T008 [US1] In `e2e/us-traveler-ncr-gating.spec.js` add API-level tests using `page.request.post('/api/ncrs', …)` (same file as T007, so after it): the deprecated alias — `traveler_id` + `traveler_input_name` still links; `traveler_id` **without** an input name → 400 `BAD_REFERENCE`; a forged `traveler_input_label: 'FORGED'` is ignored and the stored label is the traveler's real label; **no leak**: a traveler created with `publicAccess: -1` referenced by the secondary persona (`test.use({ storageState: SECONDARY_AUTH_STATE })` in a nested describe) returns a 404 whose `code` and `message` are identical to those for a random unknown ObjectId; and the lookup endpoint `GET /api/ncrs/traveler-input?ref=…` returns 200 with `{ traveler: { id, title, status, status_label }, input: { name, label } }` for a valid reference and 400/404 codes for the bad ones (contracts/traveler-input-lookup.json). Existing required-field validation still wins first: a body with an invalid required field and a bad reference returns the field errors.
- [ ] T009 [P] [US1] In `e2e/us-traveler-ncr-input-linking.spec.js` (~lines 75–78, test AS2) replace the assertions on `#traveler-link-banner` with: `#traveler_input_ref` has a value matching `^<travelerId>::field_1$` and `#traveler-ref-preview` contains `inputLabel`. Nothing else in that spec changes.

### Implementation for User Story 1

- [ ] T010 [US1] In `lib/traveler-ncr.js` implement and export `formatInputRef(travelerId, inputName)` (`` `${travelerId}::${inputName}` ``) and `parseInputRef(ref)` per data-model.md: reject non-strings; trim; reject length > 256; find the first `::`; reject when either side is empty; require the traveler id to match `/^[0-9a-fA-F]{24}$/` — do **not** use `mongoose.isValidObjectId`, which also accepts any 12-character string. All rejections throw `new TravelerNcrError('BAD_REFERENCE', 400, 'Enter the reference as traveler_id::input_name.')`. Returns `{ travelerId, inputName }`. (depends on T003; makes the parse tests in T006 pass)
- [ ] T011 [US1] In `lib/traveler-ncr.js` implement and export `async resolveInputRef(req, ref)` following the fixed order in data-model.md: `parseInputRef` → `Traveler.findById(travelerId)` (lazy `mongoose.model('Traveler')`) → if no document **or** `!reqUtils.canRead(req, doc)` throw `TRAVELER_NOT_FOUND` 404 "No traveler matches this reference." (identical for both — spec FR-008) → `labels = routesUtilities.traveler.activeFormLabels(doc)` (T002); if `!Object.hasOwn(labels, inputName)` throw `INPUT_NOT_FOUND` 404 `Traveler "<title>" has no input named "<inputName>".` → return `{ traveler: doc, travelerId: String(doc._id), inputName, inputLabel: labels[inputName] }`. Leave a marked comment where the active-status step goes (added in T018). Add JSDoc explaining the order and why the read check must precede any message that names the traveler. (depends on T002, T010; makes the resolve tests in T006 pass)
- [ ] T012 [US1] In `routes/ncr.js`, `router.post('/')`: after the existing required-field validation returns its 400 (unchanged) and before `createNcr`, build `ref = sanitizeStr(req.body.traveler_input_ref) || (req.body.traveler_id ? formatInputRef(String(req.body.traveler_id), sanitizeStr(req.body.traveler_input_name) || '') : undefined)` (the deprecated alias — contracts/ncr-create-traveler-input-ref.json). If `ref`, call `resolveInputRef(req, ref)` inside the existing `try`; on success set `b.traveler_id`, `b.traveler_input_name`, `b.traveler_input_label` from the result; when no `ref`, leave all three unset. Remove the old direct assignments of `traveler_id`/`traveler_input_name`/`traveler_input_label` from `b`, so the client-supplied label is never used. On `TravelerNcrError` respond `err.status` with `{ ...errorBody(err), details: { traveler_input_ref: [err.message] } }`; any other error falls through to the existing 500. `createNcr()` is not touched. (depends on T011)
- [ ] T013 [US1] In `routes/ncr.js` add `router.get('/traveler-input', auth.ensureAuthenticated, …)` **above** `router.get('/:id', …)` so `traveler-input` is not treated as an NCR id. Read `req.query.ref`, call `resolveInputRef(req, ref)`, and return 200 `{ success: true, traveler: { id, title, status, status_label: statusLabel(status) }, input: { name, label } }`; map `TravelerNcrError` exactly as in T012 (contracts/traveler-input-lookup.json). (depends on T012 — same file)
- [ ] T014 [P] [US1] In `views/ncr-create.jade`: remove `#traveler-link-banner` and the script that reads `traveler_id`/`input_name`/`input_label` from `location.search` and adds them to the payload. In the **Reference Information** fieldset, after the `#po_reference` group, add a `.control-group` "Traveler input (optional)" with `input#traveler_input_ref(type='text', name='traveler_input_ref', maxlength='256', placeholder='traveler_id::input_name')`, a help line ("Optional. Use **Copy NCR reference** on an input in a traveler, then paste it here."), and `#traveler-ref-preview.help-block`. Script: on load fill the field from the `traveler_input_ref` query parameter and run a lookup; on `input` (debounced ~300 ms) and `blur` call `$.getJSON(prefix + '/api/ncrs/traveler-input', { ref })` and show `Traveler "<title>" — Input "<label>"` on success or `xhr.responseJSON.message` on failure, writing with `.text()` (never `.html()`); clear the preview when the field is empty. On submit add `payload.traveler_input_ref = <trimmed value>` only when non-empty. In the existing `error:` handler, when `resp.details && resp.details.traveler_input_ref` set the message to `resp.message` alone (the generic "— field: …" suffix would repeat it). Never block submit client-side — the server is authoritative. (research.md Decision 7)
- [ ] T015 [P] [US1] In `public/javascripts/lib/traveler.js`: (a) change `appendInitiateNcrLink`'s `href` to `` `${prefix}/ncrs/new?traveler_input_ref=${encodeURIComponent(`${traveler._id}::${element.name}`)}` `` and delete `findLabelForInput` (now unused — ESLint). (b) Add exported `appendCopyRefControl(element)`: into the same container `getOrCreateNcrLinksContainer($(element).closest('.controls'))`, append `<button type="button" class="copy-ncr-ref btn btn-mini"><i class="fa fa-clipboard"></i> Copy NCR reference</button>` (skip if one already exists). On click copy `` `${traveler._id}::${element.name}` `` with `navigator.clipboard.writeText` when `window.isSecureContext && navigator.clipboard`, otherwise a hidden `<textarea>` + `document.execCommand('copy')`; on success change the button text to "Copied" for ~1.5 s; if both fail, show a read-only `input.ncr-ref-fallback` containing the reference, selected, so it can be copied by hand. Build with jQuery element creation / `.text()` / `.attr()` rather than concatenated HTML. (c) In `renderNcrLinks()`'s first loop call `appendCopyRefControl(element)` for **every** matched input (filled or not, including inputs inside a checkbox set) while `appendInitiateNcrLink` stays limited to `traveler.touchedInputs`. (research.md Decision 6)

**Checkpoint**: User Story 1 is functional and independently testable — a reference copied from any input links a new NCR to that input.

---

## Phase 4: User Story 2 — Only Active Travelers Can Have NCRs Initiated Against Them (Priority: P1)

**Goal**: NCR initiation against a traveler that is not active is refused on both entry paths, with the status named; the "Initiate NCR" action is not offered on such a traveler.

**Independent Test**: Attempt to initiate an NCR (by reference and via the traveler's action) against travelers in each non-active status and confirm every attempt is refused naming the status; repeat against an active traveler and confirm success.

**Depends on**: User Story 1 (it adds one step to the resolver US1 creates).

### Tests for User Story 2 ⚠️

- [ ] T016 [P] [US2] In `test-unit/lib/traveler-ncr.test.js` add `resolveInputRef` tests: statuses `0`, `1.5`, `2`, `3`, `4` each throw `TRAVELER_NOT_ACTIVE` 409 whose message contains `statusLabel(status)` (e.g. "submitted for completion"); status `1` resolves; **order**: a non-active traveler the caller cannot read still returns `TRAVELER_NOT_FOUND` (nothing about its status leaks), and a non-active traveler with a missing input returns `INPUT_NOT_FOUND`, not `TRAVELER_NOT_ACTIVE`.
- [ ] T017 [P] [US2] In `e2e/us-traveler-ncr-gating.spec.js` add `test.describe('US2 — active only')`: for travelers created with `status` 0, 1.5, 2, 3 and 4 the page shows **no** `.initiate-ncr-link` (but still shows `.copy-ncr-ref`), and pasting a reference into `#traveler_input_ref` shows the status in `#traveler-ref-preview` and submitting is refused with that status named and no `#ncr-success`; a race case — open `/ncrs/new` with an active traveler's reference, call the `set-traveler-status` fixture to move it to `1.5`, then submit → refused (the status at submission decides); an active traveler succeeds by both paths.

### Implementation for User Story 2

- [ ] T018 [US2] In `lib/traveler-ncr.js`, at the marked position at the end of `resolveInputRef` (after the input-exists check), add: if `traveler.status !== 1` throw `new TravelerNcrError('TRAVELER_NOT_ACTIVE', 409, `Traveler "${traveler.title}" is ${statusLabel(traveler.status)}; an NCR can only be initiated against an active traveler.`)`. Because the lookup endpoint (T013) and `POST /api/ncrs` (T012) both call the resolver, both refuse. (depends on T011; makes T016 pass)
- [ ] T019 [US2] In `public/javascripts/lib/traveler.js` (after T015 — same file) make the "Initiate NCR" action render only when the page's `traveler.status === 1`: guard both `appendInitiateNcrLink` and its call in `renderNcrLinks()`. Leave `appendCopyRefControl` unconditional (the reference can be copied from any traveler). Spec FR-010 allows "not offered", which matches how 123 hides it for unfilled inputs.

**Checkpoint**: User Stories 1 and 2 work together — references resolve only against active travelers.

---

## Phase 5: User Story 3 — A Traveler Cannot Be Submitted for Completion Approval While Any Linked NCR Is Open (Priority: P1)

**Goal**: Submitting a traveler for completion approval is refused while any NCR linked to any of its inputs is not Closed; the refusal lists every open NCR; there is no override.

**Independent Test**: Link an NCR to an active traveler and click **Submit for completion** → refused with the NCR listed, traveler still active, inputs still editable; close the NCR (or delete it) → submission proceeds.

**Depends on**: Foundational only — a linked NCR can be created directly with the `create-traveler-linked-ncr` fixture, so this story does not need US1/US2.

### Tests for User Story 3 ⚠️

- [ ] T020 [P] [US3] In `test-unit/lib/traveler-ncr.test.js` add tests: `isSubmissionTransition(current, target)` is true for `(1, 1.5)` and `(1, 2)` and false for `(1.5, 2)`, `(1.5, 1)`, `(1, 3)`, `(1, 4)`, `(2, 4)`, and `NaN`/`undefined` targets; `findOpenNcrs` queries `Ncr.find` with `{ 'traveler_link.traveler_id': id, 'traveler_link.initiated_from_traveler': true, status: { $ne: 'Closed' } }` (assert the filter); `assertNoOpenNcrs` resolves when the result is empty and otherwise throws `OPEN_NCRS` 409 with `extra.open_ncrs` shaped `[{ ncr_id, ncr_number, status, input_name, input_label }]` and the message "This traveler cannot be submitted for completion approval while N linked NCR(s) is/are not Closed." (singular for 1, plural otherwise). (contracts/traveler-completion-refusal.json)
- [ ] T021 [P] [US3] In `e2e/us-traveler-ncr-gating.spec.js` add `test.describe('US3 — submission gate')` using `create-traveler-linked-ncr` (status `Submitted`, `travelerId`, `inputName`, `inputLabel`) on an active fixture traveler: clicking `#complete2` shows an alert listing the NCR as a link (`/ncrs/<id>`) with its status and input label, `get-traveler` still reports `status: 1`, and `input[name=…]` is **enabled** (regression test for the disabled-inputs defect — research.md Decision 4); the primary persona is an admin and is refused identically; with two linked NCRs, moving one to `Closed` with `set-ncr-status` still refuses, moving both lets `#complete2` succeed and `get-traveler` reports `1.5`; **resubmission** — with no open NCR submit, set status back to `1` with `set-traveler-status`, add a new open NCR, submit again → refused. Note in a comment that the two REST API routes (Basic auth as `WRITE_API_USER`) are not reachable by the e2e personas and are covered by T020 plus quickstart step 3.6.

### Implementation for User Story 3

- [ ] T022 [US3] In `lib/traveler-ncr.js` implement and export `isSubmissionTransition(current, target)` (true when `target === 1.5`, or `target === 2 && current === 1`), `async findOpenNcrs(travelerId)` (the `Ncr.find(...).lean()` query in data-model.md, projecting `ncr_number status traveler_link.input_name traveler_link.input_label`) and `async assertNoOpenNcrs(travelerId)` (throws `TravelerNcrError('OPEN_NCRS', 409, message, { open_ncrs })` per T020; returns normally when none). JSDoc: rule applies to every role and is deliberately **not** checked at approval (spec Assumptions; research.md Decision 4). (makes T020 pass)
- [ ] T023 [P] [US3] In `lib/traveler.js` `updateStatus`, after the two existing authorization checks and before `const oldStatus = doc.status;`, add: `if (isSubmissionTransition(doc.status, req.body.status)) { try { await assertNoOpenNcrs(doc._id); } catch (err) { if (err instanceof TravelerNcrError) return res.status(err.status).json(errorBody(err)); throw err; } }` (the surrounding `try/catch` turns anything else into the existing 500). Import the helpers at the top. (depends on T022)
- [ ] T024 [P] [US3] In `routes/api.js`: (a) `PUT /apis/travelers/:id/status/` — after the `target.to.indexOf(...)` check and before `doc.status = req.body.status`, apply the same `isSubmissionTransition` / `assertNoOpenNcrs` gate (convert the handler to `async` or use `.then`/`.catch`), returning `res.status(err.status).json(errorBody(err))`. (b) `POST /apis/update/traveler/:id/` — inside the `performMongoResponse` callback, wrap the existing `updateTravelerStatus(...)` call in a `run` function; if `isSubmissionTransition(traveler.status, status)` (note `status` is a `parseFloat` result and may be `NaN`, which yields false) call `assertNoOpenNcrs(traveler._id).then(run, err => …409 JSON…)`, else `run()`. This covers the helper's direct 1 → 2 route, which would otherwise skip submission. (depends on T022; contracts/traveler-completion-refusal.json)
- [ ] T025 [P] [US3] In `public/javascripts/traveler.js`: `setStatus(s)` — return the jqXHR so callers can chain, and in its failure handler, when `jqXHR.status === 409 && jqXHR.responseJSON && jqXHR.responseJSON.code === 'OPEN_NCRS'` build the alert with jQuery element creation: a `div.alert.alert-error` with the close button, the response `message` set with `.text()`, and a `<ul>` of `<li><a href="{prefix}/ncrs/{id}">{ncr_number}</a> — {status}{ — input_label}</li>` where every dynamic value is set with `.text()` / `.attr()` (never concatenated HTML); other failures keep the existing "Cannot change the status: …" text. `complete()` — chain `.fail(function () { $('#form input,textarea').prop('disabled', false); })` on `setStatus(1.5)` so a refusal (or any failure) leaves the form editable. (contracts/traveler-completion-refusal.json "client_behaviour")

**Checkpoint**: User Story 3 is functional and independently testable — no route puts a traveler forward for completion approval while an NCR is open.

---

## Phase 6: User Story 4 — An Input With an Open NCR Does Not Count as Finished (Priority: P2)

**Goal**: An input with at least one non-Closed linked NCR does not count as finished — on the traveler, in traveler lists, and in binder rollups — and counts again once every linked NCR is Closed or removed.

**Independent Test**: Fill an input (progress counts it), raise an NCR against it (progress drops and the input is flagged), close the NCR (progress returns), and delete another open NCR as an admin (progress updates) — checking the stored figure each time.

**Depends on**: Foundational only.

### Tests for User Story 4 ⚠️

- [ ] T026 [P] [US4] In `test-unit/lib/traveler-ncr.test.js` add tests: `openNcrInputNames` returns the distinct non-empty `traveler_link.input_name` values (stub `Ncr.distinct`, assert its filter) and drops empty/undefined; `refreshTravelerProgress(travelerId)` with a fake traveler (`touchedInputs`, `finishedInput`, `save` spy) sets **only** `finishedInput` to `|touched \ open|` and calls `save` once, does **not** call `save` when the value is unchanged, resolves quietly when the traveler does not exist, and does not modify `updatedBy`/`updatedOn`. Add a test for `routesUtilities.traveler.finishedCount` reproducing every row of the worked example in data-model.md "Progress figure". (depends on T005)
- [ ] T027 [P] [US4] In `test-unit/lib/ncr-service.test.js` add tests, stubbing `require('../../lib/traveler-ncr').refreshTravelerProgress` with sinon: `createNcr` with a traveler link calls it once with the traveler id after saving, and a standalone NCR does not; `closeNcr` on a traveler-linked NCR calls it after the save; `deleteNcr` reads `traveler_link` **before** deleting and calls it after; a rejection from the stub is swallowed and logged (the operation still resolves).
- [ ] T028 [P] [US4] In `e2e/us-traveler-ncr-gating.spec.js` add `test.describe('US4 — input progress')` checking `#finished-input` on the page and `get-traveler` `finishedInput` (the stored figure lists and binders read): fill A and B → `2`; create an NCR against A through the UI (**Initiate NCR**) → reload → `1` and A shows `.ncr-open-flag`; A's value can still be edited and saved; create an NCR against **unfilled** C by reference, fill C → the figure stays `1` (client does not increment, server figure agrees); close A's NCR (fixture NCR at `Final Approval` with `originator_id: 'dong'`, closed with `page.request.patch('/api/ncrs/<id>/close', { data: { disposition_execution_verified: true, traveler_signed_off: true } })`) → figure returns to `2`; delete C's NCR with `page.request.delete('/api/ncrs/<id>')` as admin → figure updates. Finish with a check that a later data save on another input does not silently un-block an input that still has an open NCR.

### Implementation for User Story 4

- [ ] T029 [P] [US4] In `utilities/routes.js`: add pure `finishedCount(touchedInputs, openInputNames)` to the `traveler` helper object (`touchedInputs.filter(n => !new Set(openInputNames).has(n)).length`). In `resetTouched(doc, cb)`, fetch `Ncr.distinct('traveler_link.input_name', { 'traveler_link.traveler_id': doc._id, 'traveler_link.initiated_from_traveler': true, status: { $ne: 'Closed' } })` (`require('../model/ncr')` — no cycle) **before** any assignment to `doc`, mirroring the existing `dataErr` handling (`return cb(err)` on failure with nothing modified), and set `doc.finishedInput = finishedCount(doc.touchedInputs, open)` instead of `doc.touchedInputs.length`. `touchedInputs` itself is unchanged. This covers both data-save call sites (`routes/traveler.js`, `routes/api.js`). (research.md Decision 5)
- [ ] T030 [US4] In `lib/traveler-ncr.js` implement and export `async openNcrInputNames(travelerId)` (same `Ncr.distinct` filter as T029, dropping falsy names) and `async refreshTravelerProgress(travelerId)`: load the Traveler (lazy model), return if missing, compute `n = routesUtilities.traveler.finishedCount(doc.touchedInputs || [], await openNcrInputNames(travelerId))`, and **only if it differs** set `doc.finishedInput = n` and `await doc.save()`. Do not touch `updatedBy`/`updatedOn`. JSDoc must record why this uses `doc.save()` and modifies only a scalar: the Traveler post-save hook re-rolls binder progress only for a `save()` that modified `finishedInput` (`updateOne` would skip it), and a scalar-only change sends a plain `$set` without bumping the array version, so it cannot collide with a concurrent per-field save (research.md Decision 5). (depends on T029; makes T026 pass)
- [ ] T031 [US4] In `lib/ncr-service.js` add a small local `refreshTravelerProgressSafe(travelerId)` that lazily `require('./traveler-ncr')`, calls `travelerNcr.refreshTravelerProgress(travelerId)` **through the module object** (so tests can stub it), and catches/logs any error via the existing `logger`. Call it: in `createNcr` after the final `await ncr.save()` when `ncr.traveler_link && ncr.traveler_link.initiated_from_traveler`; in `closeNcr` after the final `await ncr.save()`, immediately before `return ncr` (US5's T042 inserts the PDF step just before it); in `deleteNcr` — capture `const link = ncr.traveler_link;` before `await ncr.deleteOne()` and refresh after it when `link && link.initiated_from_traveler`. (depends on T030; makes T027 pass)
- [ ] T032 [P] [US4] In `public/javascripts/lib/traveler.js` (after T019 — same file): in `renderNcrLinks()`'s `./ncr-links/` `.done` handler compute a module-level `Set` of input names having any entry with `status !== 'Closed'`; export `isInputBlockedByOpenNcr(name)` and `refreshOpenNcrFlag(element)`. `refreshOpenNcrFlag` appends `<span class="label label-warning ncr-open-flag">Not finished — open NCR</span>` to that input's `.ncr-links` container when the name is blocked **and** in `traveler.touchedInputs`, and does nothing if the flag already exists. Call it for every input during the initial render.
- [ ] T033 [US4] In `public/javascripts/traveler.js` (after T025 — same file): extend the `import` from `./lib/traveler.js` with `isInputBlockedByOpenNcr, refreshOpenNcrFlag`. At **both** first-save sites — the text/textarea save handler (~line 642) and the file-upload `.done` (~line 828) — replace `incrementFinished();` with `if (!isInputBlockedByOpenNcr(input.name)) { incrementFinished(); }` and call `refreshOpenNcrFlag(input)` right after the existing `appendInitiateNcrLink(input)`. Editing behaviour is unchanged (spec FR-021). (depends on T032)

**Checkpoint**: User Story 4 is functional and independently testable — the stored progress figure follows the formula everywhere it is read.

---

## Phase 7: User Story 5 — A Closed NCR's PDF Record Is Attached to the Traveler Input (Priority: P2)

**Goal**: Closing a traveler-linked NCR produces a PDF of the NCR, attaches it to the traveler input (visible to anyone who can view the traveler), never blocks closure, and survives later deletion of the NCR.

**Independent Test**: Take a traveler-linked NCR to closure and confirm the input shows a PDF link whose download is a valid PDF named for the NCR; confirm a standalone NCR produces nothing; confirm a forced failure still closes the NCR and records a warning and event.

**Depends on**: Foundational only for its own files; sequence after User Story 4 where it edits the same files (`lib/ncr-service.js`, `public/javascripts/lib/traveler.js`, `routes/ncr.js`).

### Tests for User Story 5 ⚠️

- [ ] T034 [P] [US5] Create `test-unit/lib/ncr-pdf.test.js`: build a full fixture NCR (all sections populated, including a preventive action, two approvers, an attachment, and events) and assert `buildNcrPdfModel(ncr, { travelerTitle })` yields the sections of contracts/traveler-ncr-pdfs.json `pdf_content.sections_in_order` **in that order**, with the values of FR-023 present; assert optional sections (no disposition, no preventive actions, no attachments, no designate) render a "None"/dash rather than throwing; assert `renderNcrPdf(model)` resolves a `Buffer` starting `%PDF-`, does not throw with `Ω ≥ Δ µ é` in the description, paginates (the buffer contains more than one `/Type /Page` object) for a 2000-character description plus 500 events, and lists attachment **file names** only. (Text inside a compressed subset-font PDF cannot be asserted, which is why content is asserted on the model — research.md Decision 12.)
- [ ] T035 [P] [US5] In `test-unit/lib/traveler-ncr.test.js` add tests for `attachClosurePdf(ncr, user, { uploadDir })` with an OS temp dir, stubbed `Traveler.findById`, `TravelerNcrPdf` and `lib/ncr-pdf`: a non-traveler-linked NCR returns `{ status: 'not_applicable' }` and writes nothing; success writes one file, inserts one record, appends a `traveler.pdf_attached` event and returns `{ status: 'attached', pdfId }`; missing traveler, and input missing from the labels, each return `{ status: 'failed', message }` and append `traveler.pdf_failed` with a payload `reason` that contains **no path or stack**; a render failure removes any partial file; a duplicate-key error (`err.code === 11000`) is treated as already attached (no second file left behind); the attach succeeds regardless of the traveler's status (a frozen, status-3 traveler still gets its PDF — spec FR-029); and no failure ever makes the function throw.
- [ ] T036 [P] [US5] In `test-unit/lib/ncr-service.test.js` add `closeNcr` cases (stub `lib/traveler-ncr.attachClosurePdf` and `refreshTravelerProgress`): traveler-linked → `ncr._closurePdf` equals the stub's result and the stub was called **after** the NCR was saved; attach returning `failed` → the NCR is still `Closed` and the call resolves; standalone → `_closurePdf.status === 'not_applicable'`; the order is save → attach → refresh.
- [ ] T037 [P] [US5] In `e2e/us-traveler-ncr-gating.spec.js` add `test.describe('US5 — closure PDF')` (NCRs built with `create-traveler-linked-ncr`, `status: 'Final Approval'`, `originator_id: 'dong'`, closed via `page.request.patch('/api/ncrs/<id>/close', …)`): after closing, reload the traveler and expect an `.ncr-pdf-link` at the input named for the NCR number; `GET /travelers/<id>/ncr-pdfs/` lists it and `GET /travelers/<id>/ncr-pdfs/<pdfId>` returns 200, `content-type` `application/pdf`, an inline `content-disposition` containing the NCR number, and a body starting `%PDF-`; the secondary (view-only) persona sees and can fetch it; two closed NCRs on one input → two links, neither replaces the other; a standalone NCR closes with `closure_pdf.status === 'not_applicable'` and no new list entry; **failure** — an NCR linked to a nonexistent traveler id (e.g. `507f1f77bcf86cd799439000`) closes with `closure_pdf.status === 'failed'`, the NCR is `Closed`, `get-ncr` events include `traveler.pdf_failed`, and driving the real `/ncrs/<id>/close` page (tick `#traveler_signed_off` and the verification boxes) shows `#close-warning`; **survives deletion** — the admin deletes a closed NCR and the PDF is still listed and downloadable; **no cross-traveler fetch** — requesting traveler B's `pdfId` under traveler A's URL returns 404.

### Implementation for User Story 5

- [ ] T038 [P] [US5] In `model/ncr.js` append `'traveler.pdf_attached'` and `'traveler.pdf_failed'` to `NCR_EVENT_TYPES` (data-model.md "New NCR_EVENT_TYPES"). `views/ncr-detail.jade` already renders `event.event_type` as a badge, so no view change is needed.
- [ ] T039 [P] [US5] In `model/traveler.js` add the `travelerNcrPdf` schema exactly as in data-model.md (`traveler` ObjectId required + indexed, `input_name`, `ncr_id` ObjectId required, `ncr_number`, `file_name`, `file: { path, mimetype (default 'application/pdf'), size }`, `generatedOn`, `generatedBy`), a **unique** index `{ traveler: 1, ncr_id: 1 }`, register `TravelerNcrPdf = mongoose.model('TravelerNcrPdf', travelerNcrPdf)` beside `TravelerNote`, and add it to `module.exports`.
- [ ] T040 [P] [US5] Create `lib/ncr-pdf.js` exporting `buildNcrPdfModel(ncr, { travelerTitle } = {})` and `renderNcrPdf(model)`. The builder is **pure** and returns `{ title: ncr.ncr_number, sections }` where a section is `{ heading, rows: [[label, value], …] }` or `{ heading, table: { head: [...], rows: [[...], …] } }`, in the order of contracts/traveler-ncr-pdfs.json `pdf_content.sections_in_order` (read `model/ncr.js` for the exact field names: identification, `traveler_link`, part/supplier/PO/WBS/spec fields, `description_of_nonconformance`/`discovery_*`, `originator_*`/`originator_designate_*`/`ce_cs_name`, `disposition`, `qa_staff_name`/`qa_concurrence_timestamp` and `additional_approvers`, `preventive_actions`, `closure_record`, `attachments[].file_name` only, `events`). Missing values render as `—`; dates as `YYYY-MM-DD HH:mm UTC`. The renderer uses `pdfkit` (`size: 'LETTER'`, margin 54, `bufferPages: true`, `info.Title` = NCR number), registers `Body`/`Bold` from `require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans.ttf')` and `…/DejaVuSans-Bold.ttf`, draws `table` sections with `doc.table({ data })`, writes a footer "NCR-… — page x of y" on every page via `switchToPage`, and resolves a `Buffer` from the stream. Text only — no HTML, links, or images. (research.md Decision 8; makes T034 pass)
- [ ] T041 [US5] In `lib/traveler-ncr.js` implement and export `async attachClosurePdf(ncr, user, { uploadDir = config.uploadPath } = {})` per research.md Decision 10: return `{ status: 'not_applicable' }` unless `ncr.traveler_link && ncr.traveler_link.initiated_from_traveler`; load the Traveler (non-lean, so `activeFormLabels` works) and fail with "The traveler this NCR was linked to no longer exists." or "That input is no longer on the traveler's form." if missing; `buildNcrPdfModel` → `renderNcrPdf`; write `path.join(uploadDir, `ncr-closure-${crypto.randomUUID()}.pdf`)` with `{ flag: 'wx' }`; insert the `TravelerNcrPdf` record (`file_name: `${ncr.ncr_number}.pdf``, `generatedBy: user.id`); on duplicate key (`code 11000`) delete the new file and return the existing record as `attached`; on any other failure delete the partial file. Append `traveler.pdf_attached` `{ traveler_id, input_name, pdf_id, file_name }` or `traveler.pdf_failed` `{ traveler_id, input_name, reason }` (`actor_type: 'system'`, `timestamp: new Date()`) and `await ncr.save()`. `reason` strings are fixed short sentences — never `err.message`, a path, or a stack. The whole function is wrapped so it **cannot throw**; it returns `{ status: 'attached', pdfId }` or `{ status: 'failed', message }`. (depends on T038, T039, T040; makes T035 pass)
- [ ] T042 [US5] In `lib/ncr-service.js` `closeNcr`, after the final `await ncr.save()` and **before** the `refreshTravelerProgressSafe` call added in T031, set `ncr._closurePdf = await travelerNcr.attachClosurePdf(ncr, user)` (through the module object; keep an outer `try/catch` that maps an unexpected throw to `{ status: 'failed', message: 'The PDF could not be attached.' }` so closure can never fail here). `attachClosurePdf` handles the not-applicable case itself. (depends on T041, T031; makes T036 pass)
- [ ] T043 [US5] In `routes/ncr.js` `PATCH /:id/close` add `closure_pdf: ncr._closurePdf || { status: 'not_applicable' }` to the success JSON, next to `ncr` and `message` (contracts/ncr-close-response.json). (depends on T042 and T013 — same file)
- [ ] T044 [P] [US5] In `views/ncr-close.jade` add `#close-warning.alert.alert-block(style='display:none')` beside `#close-success`, and give the AJAX `success` handler a `data` parameter: when `data.closure_pdf && data.closure_pdf.status === 'failed'`, set the warning's text (via `.text()`) to "The NCR was closed, but its PDF could not be attached to the traveler: " + the message, and show it. No extra UI for `attached` / `not_applicable`.
- [ ] T045 [P] [US5] In `routes/traveler.js` add `const TravelerNcrPdf = mongoose.model('TravelerNcrPdf');` beside `TravelerNote`, and, next to the existing `GET /travelers/:id/ncr-links/` route, add `GET /travelers/:id/ncr-pdfs/` (`auth.ensureAuthenticated`, `reqUtils.exist('id', Traveler)`, `reqUtils.canReadMw('id')`; returns `TravelerNcrPdf.find({ traveler: id }).sort({ generatedOn: 1 }).lean()` reshaped to `[{ pdf_id, input_name, ncr_id, ncr_number, file_name, generated_on }]`) and `GET /travelers/:id/ncr-pdfs/:pdfId` (same middleware; 404 unless `pdfId` matches `/^[0-9a-fA-F]{24}$/`; query `{ _id: pdfId, traveler: req.params.id }` so an id cannot be fetched through another traveler's URL; 404 if not found; 410 `gone` if the file is missing on disk; otherwise set `Content-Type: application/pdf` and `Content-Disposition: inline; filename="<file_name>"` and `res.sendFile(path.resolve(record.file.path))`, the idiom this file already uses). (contracts/traveler-ncr-pdfs.json; depends on T039)
- [ ] T046 [US5] In `public/javascripts/lib/traveler.js` (after T032 — same file) have `renderNcrLinks()` also fetch `./ncr-pdfs/` (failure alert like the other two fetches, ignoring 401) and, for each entry, append `<a class="ncr-pdf-link" target="{linkTarget}"><i class="fa fa-file-pdf-o"></i> {file_name}</a>` into that input's `.ncr-links` container via `getOrCreateNcrLinksContainer`, setting `href` (`./ncr-pdfs/<pdf_id>`) and the text with `.attr()` / `.text()`. (Font Awesome 4.3.0, which the traveler page loads, has `fa-file-pdf-o`.)

**Checkpoint**: All five user stories are functional and independently testable.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Verification and the checks the constitution requires.

- [ ] T047 Run `npx eslint .` and fix every new violation in files this feature touched (in particular unused imports/variables left by removing `findLabelForInput` and the banner script).
- [ ] T048 Run `TRAVELER_CONFIG_REL_PATH=docker npm run unit` and confirm the whole suite is green; then measure coverage of the two new lib files with `TRAVELER_CONFIG_REL_PATH=docker npx c8 --include lib/traveler-ncr.js --include lib/ncr-pdf.js npx mocha test-unit/lib/traveler-ncr.test.js test-unit/lib/ncr-pdf.test.js` and add tests until each is ≥ 80% (constitution I).
- [ ] T049 [P] Run `npm audit --omit=dev` and record any advisory touching `pdfkit`, `dejavu-fonts-ttf` or their dependencies in the PR description (constitution III).
- [ ] T050 Rebuild the stack (`docker compose up --build`) and confirm the new dependencies and fonts work in the `node:20-alpine` image: `docker compose exec web node -e "const {buildNcrPdfModel,renderNcrPdf}=require('./lib/ncr-pdf'); renderNcrPdf(buildNcrPdfModel({ncr_number:'NCR-T',description_of_nonconformance:'4.7 Ω ≥ 5 Ω'})).then(b=>console.log(b.slice(0,5).toString(), b.length))"` prints `%PDF-` and a nonzero length.
- [ ] T051 With the stack running, run the full e2e suite `npm run e2e` and confirm `e2e/us-traveler-ncr-gating.spec.js` and `e2e/us-traveler-ncr-input-linking.spec.js` pass and no other NCR spec regressed.
- [ ] T052 Walk through every step of `specs/124-traveler-input-ncr-gating/quickstart.md` manually, including step 3.6 (the two REST API routes — set a traveler's status to 1.5, and to 2 while active, with an open NCR, using the Basic-auth API user) and step 5.6 (PDF failure path).
- [ ] T053 Add a `CLAUDE.md` "Recent Changes" entry for `124-traveler-input-ncr-gating` recording: the new dependencies (`pdfkit`, `dejavu-fonts-ttf`); the new collection `TravelerNcrPdf`; the `409 OPEN_NCRS` behaviour on `PUT /travelers/:id/status`, `PUT /apis/travelers/:id/status/` and `POST /apis/update/traveler/:id/`; and the deprecated `traveler_id`/`traveler_input_name`/`traveler_input_label` body fields on `POST /api/ncrs` (client label ignored, `traveler_id` without an input name now 400). (constitution IV)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none — start immediately.
- **Foundational (Phase 2)**: needs Setup — blocks every user story.
- **User Stories (Phases 3–7)**: all need Foundational.
  - **US2 depends on US1** (it extends the resolver US1 creates).
  - **US3, US4 and US5 are independent** of US1/US2 and of each other in *behaviour* — each can be tested with the `create-traveler-linked-ncr` fixture.
- **Polish (Phase 8)**: after the stories you intend to ship.

### Shared-file ordering (this limits real parallelism)

Even where stories are independent, these tasks edit the same file and must run in this order:

| File | Order |
|---|---|
| `lib/traveler-ncr.js` | T003 → T010 → T011 → T018 → T022 → T030 → T041 |
| `test-unit/lib/traveler-ncr.test.js` | T005 → T006 → T016 → T020 → T026 → T035 |
| `e2e/us-traveler-ncr-gating.spec.js` | T007 → T008 → T017 → T021 → T028 → T037 |
| `public/javascripts/lib/traveler.js` | T015 → T019 → T032 → T046 |
| `public/javascripts/traveler.js` | T025 → T033 |
| `routes/ncr.js` | T012 → T013 → T043 |
| `lib/ncr-service.js` | T031 → T042 |
| `test-unit/lib/ncr-service.test.js` | T027 → T036 |
| `utilities/routes.js` | T002 → T029 |

With more than one developer, split by story only after agreeing an owner for each shared file, or expect to rebase.

### Within Each User Story

- Tests are written first and must fail before implementation.
- Rules module (`lib/`) → routes/handlers → views/client scripts.
- The story is complete, and its checkpoint verified, before the next priority begins.

### Parallel Opportunities

- Phase 2: T002, T003, T004 together (three different files); T005 after T003.
- US1: T006, T007, T009 together (three different files); then T014 and T015 together once T013 exists.
- US3: T023, T024, T025 together (three different files) once T022 exists.
- US5: T034, T036, T037 together; T038, T039, T040 together; T044 and T045 together.

## Parallel Example: User Story 3

```bash
# Once T022 (lib/traveler-ncr.js gate functions) is done, three different files:
Task: "T023 [P] [US3] Gate lib/traveler.js updateStatus with assertNoOpenNcrs"
Task: "T024 [P] [US3] Gate the two routes/api.js status paths"
Task: "T025 [P] [US3] Render the OPEN_NCRS list and re-enable inputs in public/javascripts/traveler.js"
```

---

## Implementation Strategy

### MVP First

1. Phase 1 (Setup) and Phase 2 (Foundational).
2. **US1** — the reference entry path — is demoable on its own.
3. **US2** and **US3** complete the three P1 stories. **Ship the P1 set (US1 + US2 + US3) as the MVP**: US2 is the guard that makes US3's rule hold, so US1 alone would let an NCR be raised against a traveler that has already passed the submission check.
4. **Stop and validate** against quickstart sections 1–3 before continuing.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. US1 → test → demo. US2 → test → demo. US3 → test → demo (**MVP**).
3. US4 (P2) → test → demo — progress figures.
4. US5 (P2) → test → demo — closure PDF; adds the two dependencies' first real use.
5. Polish (Phase 8) — lint, coverage ≥ 80%, audit, container check, full e2e, quickstart walk-through.

### Notes

- [P] tasks touch different files and depend on no incomplete task.
- Confirm each story's tests fail before implementing it.
- Commit after each task or logical group; stop at any checkpoint to validate that story independently.
- The REST API status routes (`/apis/...`, Basic auth as `WRITE_API_USER`) cannot be driven by the e2e personas; they are covered by the `isSubmissionTransition` unit test (T020), the code path being thin, and quickstart step 3.6.
- Approval is deliberately **not** gated (spec Assumptions): do not add a check to `lib/review.js` or to 1.5 → 2.
