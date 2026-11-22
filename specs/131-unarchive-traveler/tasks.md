# Tasks: Admin Traveler Unarchive

**Input**: Design documents from `specs/131-unarchive-traveler/`

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Tests**: Included. Explicitly requested ("add tests for this") and required by Constitution I (Automated Testing) — every new/changed behavior gets a direct unit test, extending `tests/lib/traveler.test.js`'s existing sinon/chai patterns (no new test infrastructure), plus new e2e coverage of the end-to-end admin/non-admin flow.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[US1]**: Maps to spec.md's single user story (Admin restores an archived traveler to its prior status)
- Paths are repo-root relative.

## Path Conventions

Single Express MVC project at repo root — extends the existing `model/`, `lib/`, `routes/`, `views/`, `public/javascripts/`, `tests/lib/`, `e2e/`. No new directory, no new dependency.

## Identifiers the tasks share

| Where | Identifier |
|---|---|
| New field (Foundational) | `Traveler.statusBeforeArchive` — `Number`, no default, absent by default (`model/traveler.js`) |
| New function (US1) | `unarchiveTraveler(req, res)` in `lib/traveler.js` |
| New route (US1) | `PUT /travelers/:id/unarchive` in `routes/traveler.js` — `reqUtils.requireAdmin()`, no request body |
| New view control (US1) | `#unarchive` button in `views/traveler-viewer.jade` + its click handler in `public/javascripts/traveler-viewer.js` |
| Call sites that capture `statusBeforeArchive` when archiving (US1) | `lib/traveler.js#updateStatus`; `routes/api.js`'s `PUT /apis/travelers/:id/status/` — each a one-line addition to an existing branch; no change to either route's save mechanism, request/response shape, or any other behavior |
| Legacy fallback (US1) | `doc.statusBeforeArchive !== undefined ? doc.statusBeforeArchive : 1` (Active) |
| E2E fixture already available | `e2e/fixtures/cli.js#setTravelerStatus` (direct DB write, bypasses this feature's own capture — used to simulate a pre-existing archived traveler with no `statusBeforeArchive`) |
| Explicitly out of scope | No general status-change audit trail (`addHistory`/`History`) is added anywhere; `lib/review.js` is untouched (research.md D4) |

---

## Phase 1: Setup

**Purpose**: Confirm the pre-change baseline before touching anything.

- [X] T001 With the Docker stack up (`docker compose up`), run `TRAVELER_CONFIG_REL_PATH=docker npx mocha tests/lib/traveler.test.js` and `npm run e2e -- e2e/us-traveler-ncr-gating.spec.js`. Note the current pass counts so any regression introduced by later tasks is obvious.

---

## Phase 2: Foundational (Blocking Prerequisite)

**Purpose**: The one schema change the user story builds on. Trivial and low-risk; no business logic lives here.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 In `model/traveler.js`, add `statusBeforeArchive: { type: Number },` to the `traveler` schema, immediately after `archivedOn: Date,` (currently line 135) and before `owner: String,`. No default — absent means "no prior status recorded."

**Checkpoint**: Schema carries the new field. No behavior changes yet.

---

## Phase 3: User Story 1 — Admin restores an archived traveler to its prior status (Priority: P1) 🎯 MVP

**Goal**: An admin can reverse an archive action on any traveler, returning it to the status it held immediately before archiving (Initialized, Active, or Completed) — or to Active, if no prior status was ever recorded (a traveler archived before this feature shipped). Anyone who is not an admin, or any traveler that is not currently Archived, is refused.

**Independent Test**: spec.md's own Independent Test — archive a traveler from a known status, confirm Archived, have an admin unarchive it, confirm it reverts to that status and behaves normally.

### Tests for User Story 1 ⚠️

> Write first; confirm they fail before implementing (T006–T009 don't exist yet).

- [X] T003 [P] [US1] In `tests/lib/traveler.test.js`, add local `makeReq(overrides)` / `makeRes()` helpers mirroring `tests/lib/review.test.js`'s own (`makeReq` returns `{ params: { id: 'id1' }, session: { userid: 'admin1' }, ...overrides }`; `makeRes` returns `{ status: sinon.stub().returns(res), send: sinon.stub().returns(res) }`). Add a `makeTravelerDoc(overrides)` helper returning:
  ```js
  {
    _id: 'id1',
    status: 4,
    save: sinon.stub().callsFake(function(cb) {
      if (cb) {
        cb(null);
      }
      return Promise.resolve(this);
    }),
    ...overrides,
  }
  ```
  The `save` stub must handle *both* calling conventions used in this codebase: `unarchiveTraveler` (T007) calls `await doc.save()` (promise style), while the existing `updateStatus` (T006, unmodified by this feature) calls `doc.save(function(saveErr) { ... })` (callback style) — the fake above satisfies both, invoking any callback it's given synchronously with no error, and also returning a resolved promise. Before requiring `lib/traveler.js`, stub `require('../../utilities/mqtt').postTravelerStatusChangedMessage` as a no-op (`sinon.stub()`) — `lib/traveler.js` does `const mqttUtilities = require('../utilities/mqtt');` and calls `mqttUtilities.postTravelerStatusChangedMessage(doc)`, a plain property access (not destructured), so stubbing the module export directly is sufficient without a cache-delete/re-require.
- [X] T004 [P] [US1] In `tests/lib/traveler.test.js`, add `describe('lib/traveler — unarchiveTraveler', () => { afterEach(() => sinon.restore()); ... })` requiring `unarchiveTraveler` from `../../lib/traveler.js` (add it to the existing `const { attachFormOwners } = require(...)` line, or a second destructure). Cases, each building `req = makeReq()` with `req.id1 = doc` set (matching how `req[req.params.id]` is populated, the same convention `routes/traveler.js` uses via `reqUtils.exist`), `res = makeRes()`, `doc = makeTravelerDoc({...})`, calling `await unarchiveTraveler(req, res)`:
  - `'restores to the recorded prior status when archived from Active'`: `makeTravelerDoc({ status: 4, statusBeforeArchive: 1 })` → assert `doc.status === 1`, `doc.statusBeforeArchive === undefined`, `doc.save.calledOnce`, `res.status.calledWith(200)`.
  - `'restores to the recorded prior status when archived from Completed'`: same with `statusBeforeArchive: 2` → assert `doc.status === 2`.
  - `'restores to the recorded prior status when archived from Initialized'`: same with `statusBeforeArchive: 0` → assert `doc.status === 0` (not falsy-skipped — `0` is a valid recorded status, distinct from "absent").
  - `'falls back to Active when no prior status was recorded'`: `makeTravelerDoc({ status: 4, statusBeforeArchive: undefined })` → assert `doc.status === 1`.
  - `'refuses when the traveler is not currently archived'`: `makeTravelerDoc({ status: 1 })` → assert `res.status.calledWith(409)`, `doc.save.called === false`.
- [X] T005 [P] [US1] In `tests/lib/traveler.test.js`, add `describe('lib/traveler — updateStatus archiving', () => { ... })`. Before requiring `lib/traveler.js` in this file (with `delete require.cache[require.resolve('../../lib/traveler.js')]` beforehand per `tests/lib/review.test.js`'s own documented reason — Mocha loads every `tests/**/*.test.js` into one process), stub `require('../../utilities/routes').hasPermission` to return `true` and `require('../../lib/traveler-ncr').isSubmissionTransition` to return `false` (archiving is never a submission transition, so this keeps `assertSubmittable` out of the way without needing to stub it too), then re-require `lib/traveler.js` so its destructured locals pick up both stubs. Case: `'captures statusBeforeArchive when archiving'`: `req = makeReq({ body: { status: 4 } })` with `req.id1 = doc`, `doc = makeTravelerDoc({ status: 2, statusBeforeArchive: undefined })`, call `await updateStatus(req, res)` — the `save` stub from T003 invokes `updateStatus`'s callback synchronously, so `await` resolves once `res.status(200).send(...)` has already been called — then assert `doc.statusBeforeArchive === 2` (the status just left) and `doc.save.calledOnce`.

### Implementation for User Story 1

- [X] T006 [US1] In `lib/traveler.js#updateStatus`, on the branch that currently does (lines 91-94) `if (req.body.status === 4) { doc.archivedBy = req.session.userid; doc.archivedOn = Date.now(); }`, add `doc.statusBeforeArchive = oldStatus;` inside the same `if`. That is the entire change to this function — `oldStatus` is already captured on line 87 (`const oldStatus = doc.status;`), and nothing else about this route (its save mechanism, response text, or any other branch) changes.
- [X] T007 [US1] In `lib/traveler.js`, add a new exported function immediately after `updateStatus` (before `submitForApproval`, currently starting at line 133):
  ```js
  async function unarchiveTraveler(req, res) {
    try {
      const doc = req[req.params.id];
      if (doc.status !== 4) {
        return res.status(409).send('traveler is not archived');
      }
      const restoredStatus =
        doc.statusBeforeArchive !== undefined ? doc.statusBeforeArchive : 1;
      doc.status = restoredStatus;
      doc.statusBeforeArchive = undefined;
      doc.updatedBy = req.session.userid;
      doc.updatedOn = Date.now();
      mqttUtilities.postTravelerStatusChangedMessage(doc);
      await doc.save();
      return res.status(200).send(`status updated to ${restoredStatus}`);
    } catch (error) {
      logger.error(error);
      return res.status(500).send(error.message);
    }
  }
  ```
  Add `unarchiveTraveler,` to `module.exports` (currently lines 207-211), alongside `updateStatus`.
- [X] T008 [US1] In `routes/api.js`'s `PUT /apis/travelers/:id/status/` handler (lines 317-370), capture the traveler's status before it's overwritten and, when archiving, record it: add a local `var oldStatus = doc.status;` immediately before the existing `doc.status = req.body.status;` (line 357), then immediately after that line add:
  ```js
  if (req.body.status === 4) {
    doc.statusBeforeArchive = oldStatus;
  }
  ```
  No other change to this route — request body, response shape, status codes, and the existing `doc.save(callback)` call are all untouched.
- [X] T009 [US1] In `routes/traveler.js`, add a new route immediately after the existing `PUT /travelers/:id/status` route (after line 1025, before the `// add tag routines` comment):
  ```js
  app.put(
    '/travelers/:id/unarchive',
    auth.ensureAuthenticated,
    reqUtils.exist('id', Traveler),
    reqUtils.requireAdmin(),
    function unarchiveTraveler(req, res) {
      return travelerLib.unarchiveTraveler(req, res);
    }
  );
  ```
  Deliberately no `reqUtils.archived('id', false)` or `reqUtils.canWriteMw('id')` guard — the whole point of this route is to act on a document those guards would otherwise block.
- [X] T010 [P] [US1] In `views/traveler-viewer.jade`, immediately after the existing `if (locals.traveler.status !== undefined && (locals.traveler.status === 2 || locals.traveler.status === 4))` / "Create PDF" `.btn-group` block (lines 32-34), add:
  ```jade
  if (isAdmin && locals.traveler.status === 4)
    .btn-group
      button.btn.btn-warning#unarchive(data-toggle='tooltip', title='restore this traveler to its status before archiving') Unarchive
  ```
  `isAdmin` is already computed globally in `views/layout.jade` as a plain template-scoped variable (`- var isAdmin = ...`, derived from `locals.roles`) — reference it bare, **not** as `locals.isAdmin` (it is not a property of `locals`; every other view that uses it, e.g. `views/travelers.jade`, references it bare too). No route or render-object change needed to make it available here.
- [X] T011 [P] [US1] In `public/javascripts/traveler-viewer.js`, inside the existing `$(function() { ... })` block (after the `$('span.time').each(...)` section), add a click handler for the new button:
  ```js
  $('#unarchive').click(function() {
    $.ajax({
      url: 'unarchive',
      type: 'PUT',
    })
      .done(function() {
        window.location.href = './';
      })
      .fail(function(jqXHR) {
        alert(jqXHR.responseText);
      });
  });
  ```
  The relative `url: 'unarchive'` resolves against the current page (`/travelers/:id/view`) to `/travelers/:id/unarchive`, the same relative-path convention the existing `href='print'` "Create PDF" link already uses on this same page. On success, navigate to `./` (`/travelers/:id/`) rather than reloading `/view`, so the now-unarchived (and therefore editable) traveler renders through its normal detail route instead of staying on the view-only page.
- [X] T012 [US1] In `e2e/us-traveler-ncr-gating.spec.js` (or a new e2e file, if preferred), add scenarios: an admin unarchives a traveler archived from each of Initialized/Active/Completed and gets back that exact status; a non-admin's attempt to unarchive is refused (`403`) and the traveler remains Archived; an attempt to unarchive a non-Archived traveler is refused (`409`); a traveler seeded straight to `status: 4` via the existing `set-traveler-status` fixture (no `statusBeforeArchive`, simulating a pre-existing archived traveler) restores to Active when unarchived by an admin.

**Checkpoint**: User Story 1 — the entire feature — is fully functional and independently testable.

---

## Final Phase: Polish & Cross-Cutting Concerns

- [X] T013 [P] Add a `131-unarchive-traveler` entry to [CLAUDE.md](../../CLAUDE.md)'s "Recent Changes" section, following the existing `121`–`130` entries' format: what changed, the new field/endpoint, and an explicit note that the REST API deliberately gets no new unarchive endpoint (research.md D6) while its existing archive-in path (`PUT /apis/travelers/:id/status/`) still gains the `statusBeforeArchive` capture.
- [X] T014 Run through [quickstart.md](quickstart.md)'s manual walkthrough end to end (archive from each of the three source statuses, unarchive as admin, refuse as non-admin, refuse on a non-archived traveler, legacy-fallback case via the `set-traveler-status` fixture).
- [X] T015 Run `npm run unit` and `npx eslint .` in full; compare pass counts against the T001 baseline to confirm no regression, and confirm linting is clean on every changed file.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS the user story.
- **User Story 1 (Phase 3)**: Depends on Foundational only.
- **Polish (Final Phase)**: Depends on User Story 1 being complete.

### Within the User Story

- Tests (T003-T005) are written before the implementation tasks that make them pass, and should fail until those implementation tasks land.
- T006 and T007 both land in `lib/traveler.js` and are easiest done in the same pass (T007's `unarchiveTraveler` is a fresh function with no overlap with T006's one-line edit, but both need the Foundational `statusBeforeArchive` field in place first).
- T009 (route) depends on T007 (`travelerLib.unarchiveTraveler` must exist to be called).
- T010/T011 (view + its client script) can be done in parallel with T006-T009 (different files), but are only meaningfully testable once T009 exists.
- T012 (e2e) depends on T006, T007, T009, T010, T011 all being in place — it exercises the whole feature end to end.

### Parallel Opportunities

- Within Phase 3: T003, T004, T005 (different `describe` blocks, same file — safe to draft in parallel, sequence the actual file edits) and T010, T011 (different files from T006-T009) are parallelizable.
- T013 (documentation) can be drafted any time once the implementation's shape is settled.

---

## Parallel Example: User Story 1

```bash
# Once Phase 2 (Foundational) is complete, these can proceed together:
Task: "Write unarchiveTraveler unit tests in tests/lib/traveler.test.js (T004)"
Task: "Write updateStatus-archiving unit test in tests/lib/traveler.test.js (T005)"
Task: "Add admin-only Unarchive button to views/traveler-viewer.jade (T010)"
Task: "Add Unarchive click handler to public/javascripts/traveler-viewer.js (T011)"
```

---

## Implementation Strategy

### MVP First (and only) — User Story 1

1. Complete Phase 1 (Setup) and Phase 2 (Foundational — the one schema field).
2. Complete Phase 3 (User Story 1): admins can unarchive travelers correctly, end to end, with the web UI control.
3. **STOP and VALIDATE**: run [quickstart.md](quickstart.md)'s manual steps and the new unit/e2e tests.
4. Polish → documentation and a final regression pass.

This feature has a single user story — there is no incremental-delivery sequencing to plan beyond the phases above.
