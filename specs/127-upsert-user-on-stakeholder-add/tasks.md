# Tasks: Guarantee Stakeholder Notification Delivery via Directory-Backed User Records

**Input**: Design documents from `specs/127-upsert-user-on-stakeholder-add/`

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Tests**: Included. The constitution (I. Automated Testing) requires tests for every new feature and a regression test for every bug fix. Unit tests for the new `lib/user-directory.js` helper and every call site it's wired into; one new Playwright e2e spec for the one path (Form reviewer-add's client-side email capture) that has no unit-test equivalent in this codebase.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, or a clearly separable region of the same file, with no dependency on an incomplete task)
- **[US1]/[US2]/[US3]**: Map to spec.md's three user stories (NCR add-time guarantee / NCR closure reliability / Form reviewer-add guarantee)
- Paths are repo-root relative.

## Path Conventions

Single Express MVC project at repo root — extends the existing `lib/`, `routes/`, `public/javascripts/`, `test-unit/`, `e2e/`. No new top-level directory, no new router, no schema change, no new dependency.

## Identifiers the tasks share

| Where | Identifier |
|---|---|
| New helper | `lib/user-directory.js` exports `async ensureUserExists({ id, name, email })` |
| NCR call sites (`lib/ncr-service.js`) | `createNcr` (CE/CS), `submitConcurrence` (each entry of `additionalApprovers[]`), `addApprover` (one approver), `assignDesignate` (the Designate) |
| NCR closure fix (`lib/ncr-service.js`) | `closeNcr`'s final-distribution email list also includes each `preventive_actions[].owner_email` directly (research.md R5) |
| Review call site (`lib/review.js`) | `addReviewRequest` — replaces its hard `400` refusal with `ensureUserExists` |
| Review client fix (`public/javascripts/review.js`) | the `$('#add').on('click', ...)` handler gains `data.email = userSelected.mail` |
| Defensive fix (`routes/form.js`) | the Form-status-0.5 reviewer-notification block (~line 1094-1097) filters out an unresolved reviewer instead of throwing on `.email` |
| New e2e fixture (`e2e/fixtures/cli.js`) | `deleteUser({ userId })` → `User.findByIdAndDelete(userId)`, registered as `'delete-user'` |
| Reused e2e fixtures | `grant-role`, `reset-user-roles`, `get-user` (all already in `e2e/fixtures/cli.js`) |
| E2E personas | secondary = `bob` (`E2E_USER2`) — never used as the Admin/Originator persona elsewhere, lowest collateral risk for the delete/restore sequence below |
| New test-unit helper (`test-unit/lib/ncr-service.test.js`) | `stubUserFindById(doc)` → `sinon.stub(User, 'findById').resolves(doc)` (mirrors the existing `stubFindById` for `Ncr`) |

---

## Phase 1: Setup

**Purpose**: Confirm a clean baseline before changing anything. No new dependency to install.

- [ ] T001 Run `TRAVELER_CONFIG_REL_PATH=docker npm run unit` and `npx eslint .` on the current branch and record the pass/fail counts in `specs/127-upsert-user-on-stakeholder-add/baseline.txt`, so any later failure is attributable to this feature rather than pre-existing state. Note that no new npm dependency is introduced.
- [ ] T002 Confirm the Docker stack is up (`docker compose up`) and `.env` has `E2E_USER`, `E2E_PASS`, `E2E_USER2`, `E2E_PASS2`; run `npm run e2e -- e2e/us-originator-designate.spec.js` (the closest existing coverage: NCR Designate assignment/removal) and record its result in `specs/127-upsert-user-on-stakeholder-add/baseline.txt`. Note any pre-existing failure by name so it is not misattributed later.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The one shared piece every user story's implementation calls. No user story work can begin until this phase is complete.

### Tests for the foundational helper ⚠️

> Write first; confirm they fail before implementing.

- [ ] T003 [P] Create `test-unit/lib/user-directory.test.js` (register `User` the same way `test-unit/lib/ncr-service.test.js` does at the top of the file: `if (!mongoose.modelNames().includes('User')) { mongoose.model('User', new mongoose.Schema({ _id: String, name: String, email: String, roles: [String] })); }`, then `const User = mongoose.model('User');`). In a `beforeEach`, `sinon.stub(User.prototype, 'save').resolves();`; in `afterEach`, `sinon.restore();`. Add a `describe('lib/user-directory — ensureUserExists', ...)` block with cases: (a) `sinon.stub(User, 'findById').resolves(null)` + a valid `{id, name, email}` → returns a newly-constructed `User` whose `_id`/`name`/`email` match the input, and `User.prototype.save` was called once; (b) `User.findById` resolves an existing document → that exact document is returned, and `User.prototype.save` is **not** called (no overwrite — FR-009); (c) `User.findById` resolves `null` and `email` is missing/empty → the call rejects with an `Error` whose `status === 400`, and `User.prototype.save` is **not** called (FR-008); (d) `User.findById` resolves `null`, `email` present but `name` missing/empty → still creates the record (name is not required — only `id` and `email` are, since some callers may not always have a display name) with `name` left as given (undefined/empty), to document this case explicitly rather than leave it ambiguous.

### Implementation for the foundational helper

- [ ] T004 Create `lib/user-directory.js`: `const mongoose = require('mongoose');` then `async function ensureUserExists({ id, name, email }) { const User = mongoose.model('User'); const existing = await User.findById(id); if (existing) return existing; if (!email) { const err = new Error(\`Cannot add ${id} - no email address is available for them\`); err.status = 400; throw err; } const user = new User({ _id: id, name, email }); await user.save(); return user; }` — export `{ ensureUserExists }`. Follow `lib/ncr-service.js#findUsers`'s existing convention of resolving `User` lazily via `mongoose.model('User')` inside the function (not a top-level require), since this module, like that one, may load before `model/user.js` has registered it. (makes T003 pass)

**Checkpoint**: `ensureUserExists` exists, is tested, and is ready to be wired into every call site below.

---

## Phase 3: User Story 1 — NCR workflow notifications always reach a newly-added stakeholder (Priority: P1) 🎯 MVP

**Goal**: Adding a never-logged-in person as NCR CE/CS, an additional Approver, or the Originator Designate always succeeds and guarantees a `User` record exists for them, so every later NCR notification addressed to that role can find their email.

**Independent Test**: spec.md User Story 1's own Independent Test.

### Tests for User Story 1 ⚠️

> Write first; confirm they fail before implementing. All four touch `test-unit/lib/ncr-service.test.js`; per 126's own precedent, additions to different, non-overlapping `describe` blocks in the same file are fine in parallel.

- [ ] T005 [P] [US1] In `test-unit/lib/ncr-service.test.js`, add the `stubUserFindById(doc)` helper described above, next to the existing `stubUserFind`. In the `describe('lib/ncr-service — createNcr', ...)` block, add a test: given `data.ce_cs_id`/`ce_cs_name`/`ce_cs_email` on a valid create payload, `stubUserFindById(null)` (CE/CS has never logged in), create the NCR, and assert `User.prototype.save` was called once with a document whose `_id` is `data.ce_cs_id` — the add succeeds exactly as it does today (no new rejection), and a `User` record is now guaranteed to exist.
- [ ] T006 [P] [US1] In `test-unit/lib/ncr-service.test.js`, in `describe('lib/ncr-service — submitConcurrence', ...)`, add a test: call `submitConcurrence` with one additional approver whose `approver_id`/`approver_name`/`approver_email` resolve to `stubUserFindById(null)`, and assert `User.prototype.save` was called for that approver's id — the approver is still added and notified exactly as today, and a `User` record now exists for them.
- [ ] T007 [P] [US1] In `test-unit/lib/ncr-service.test.js`, in `describe('lib/ncr-service — addApprover', ...)`, add the same shape of test as T006 for the single-approver `addApprover` path.
- [ ] T008 [P] [US1] In `test-unit/lib/ncr-service.test.js`, in `describe('lib/ncr-service — assignDesignate', ...)`, add a test: call `assignDesignate` with `designateData` whose `designate_id` resolves to `stubUserFindById(null)`, and assert `User.prototype.save` was called for the designate's id — the assignment still succeeds and notifies the designate exactly as today, and a `User` record now exists for them.

### Implementation for User Story 1

> All four touch `lib/ncr-service.js`; keep these sequential (same file) even though they edit different functions.

- [ ] T009 [US1] In `lib/ncr-service.js`, add `const { ensureUserExists } = require('./user-directory');` to the top-of-file requires (alongside the existing `ncr-email` require). In `createNcr`, immediately after resolving `qaStaff`/before sending any notification, add: `if (data.ce_cs_id) { await ensureUserExists({ id: data.ce_cs_id, name: data.ce_cs_name, email: data.ce_cs_email }); }` — guards on `ce_cs_id` since CE/CS is optional on creation. Let a thrown validation error propagate exactly like every other validation error this function already throws before saving (no new try/catch — the existing route-level error handling in `routes/ncr.js` already maps a `status`-bearing error to the matching HTTP status). (makes T005 pass)
- [ ] T010 [US1] In `submitConcurrence`, in the branch that builds `ncr.additional_approvers` from the submitted `approvers` array (the `else` branch of `if (approvers.length === 0) {...} else {...}`, before `fsm.concurWithApprovers()`), add, for each entry, before `ncr.additional_approvers.push(...)`: `await ensureUserExists({ id: a.approver_id, name: a.approver_name || a.approver_id, email: a.approver_email || fallbackEmailById[a.approver_id] });` — reuse the same name/email fallback this function already computes for `ncr.additional_approvers.push(...)`, so provisioning uses the exact same resolved values that get stored and sent. (makes T006 pass)
- [ ] T011 [US1] In `addApprover`, immediately before `ncr.additional_approvers.push(...)`, add: `await ensureUserExists({ id: approverData.approver_id, name: approverData.approver_name || approverData.approver_id, email });` — reusing the `email` local this function already resolves (client-submitted `approverData.approver_email`, falling back to a `findUsers` lookup) a few lines above. (makes T007 pass)
- [ ] T012 [US1] In `assignDesignate`, immediately before `ncr.originator_designate_id = designateData.designate_id;`, add: `await ensureUserExists({ id: designateData.designate_id, name: designateData.designate_name, email: designateData.designate_email });` — `designate_id`/`_name`/`_email` are already required fields on this call (validated a few lines above), so no new validation branch is needed here. (makes T008 pass)

**Checkpoint**: User Story 1 is functional and independently testable — CE/CS, Approver, and Originator Designate adds all guarantee a `User` record exists, with no change to what gets validated, stored, or notified today.

---

## Phase 4: User Story 2 — NCR closure notifies every stakeholder, not just the ones who logged in (Priority: P2)

**Goal**: NCR closure's final-distribution notification reaches the Originator, Originator Designate, CE/CS, QA staff, every Approver, and every Preventive Action owner, even when one or more of them has never logged in — Approver/Designate/CE/CS via Story 1's provisioning (no new code needed for them), Preventive Action Owner via a narrower, independent fix.

**Independent Test**: spec.md User Story 2's own Independent Test.

**Depends on**: User Story 1 (its provisioning is what makes `closeNcr`'s existing CE/CS/Approver/Designate lookups reliable; this phase adds no new provisioning call of its own).

### Tests for User Story 2 ⚠️

- [ ] T013 [P] [US2] In `test-unit/lib/ncr-service.test.js`, in `describe('lib/ncr-service — closeNcr', ...)`, add a test: an NCR in `'Final Approval'` status with one `preventive_actions` entry whose `owner_email` is set but whose `owner_id` does **not** resolve via `stubUserFind` (simulating a PA owner who has never logged in), call `closeNcr`, and assert `sendFinalDistributionStub`'s recipient list includes that `owner_email` — today, without the fix, it would be silently missing.
- [ ] T014 [US2] In the same `describe` block, add a characterization test proving Story 1 alone is sufficient for the other three roles: an NCR whose `ce_cs_id`, `originator_designate_id`, and one `additional_approvers[].approver_id` each resolve via `stubUserFind` (i.e., each already has a `User` record — standing in for "was provisioned when added, per Story 1"), call `closeNcr`, and assert all three emails appear in `sendFinalDistributionStub`'s recipient list — documents that this phase needs no `ensureUserExists` call of its own for these three.

### Implementation for User Story 2

- [ ] T015 [US2] In `lib/ncr-service.js#closeNcr`, after the existing `const emails = Object.values(byId).map(u => u.email).filter(Boolean);` line, add: `(ncr.preventive_actions || []).forEach(pa => { if (pa.owner_email) emails.push(pa.owner_email); });` then de-duplicate the final list before sending (e.g. wrap in `[...new Set(emails)]`) so a PA owner who *does* also resolve via the existing `recipientIds`/`findUsers` path isn't emailed twice. (makes T013 pass; T014 should already pass unmodified, confirming no regression)

**Checkpoint**: Both user stories are functional and independently testable — NCR closure's final distribution reaches every intended recipient, including a Preventive Action owner who has never logged in.

---

## Phase 5: User Story 3 — The same guarantee applies to reviewer notifications on Forms (Priority: P3)

**Goal**: Adding a never-logged-in person as a Form reviewer via the directory typeahead succeeds (or is refused only for lacking review permission, never for being unknown to the system) and guarantees a `User` record exists for them.

**Independent Test**: spec.md User Story 3's own Independent Test.

**Depends on**: Phase 2 (Foundational) only — independent of US1/US2.

### Tests for User Story 3 ⚠️

- [ ] T016 [P] [US3] In `test-unit/lib/review.test.js`, add `const { addReviewRequest } = require('../../lib/review.js');` to the existing destructured require, and a new `describe('lib/review — addReviewRequest', ...)` block (own `beforeEach`/`afterEach` with `sinon.restore()`). Test: `sinon.stub(User, 'findById').returns({ exec: () => Promise.resolve(null) })` (never logged in) + `req.body = { uid: 'newperson', name: 'New Person', email: 'new@test.com' }`, a `doc` stub with `requestReview: sinon.stub().resolves()`; under the real `TRAVELER_CONFIG_REL_PATH=docker` config (`config.auth.default_roles` includes `'user'`, and `docker/permission.json`'s `'user'` role already includes `review_forms`), assert the response is `201` (not the old `400`), `doc.requestReview` was called, and a `User.prototype.save` stub (added in this test's own setup) was called once for `'newperson'`.
- [ ] T017 [P] [US3] In the same new `describe` block, add: `User.findById` resolves `null` (never logged in) and `req.body` has **no** `email` (an older client that hasn't picked up the review.js change) → the response is `400`, and `User.prototype.save` is **not** called — refused, same outcome as today, just reached via `ensureUserExists` throwing instead of the old hard-coded check.
- [ ] T018 [P] [US3] In the same block, add: `User.findById` resolves an existing reviewer document (already has a record) → behavior is completely unchanged from before this feature (the existing roles/permission check still runs against that document, `User.prototype.save` is never called), proving FR-009 holds here too.

#### New e2e fixtures (no existing e2e spec drives the Form/review workflow yet, so these are needed before the spec itself)

- [ ] T019 [P] [US3] In `e2e/fixtures/cli.js`, add `async function deleteUser({ userId }) { require('../../model/user'); const { User } = require('../../model/user'); await User.findByIdAndDelete(userId); return { userId, deleted: true }; }` — idempotent, does not throw if the user doesn't exist (unlike `getUser`). Register it in `COMMANDS` as `'delete-user': deleteUser`.
- [ ] T020 [P] [US3] In `e2e/fixtures/cli.js`, add `async function createReviewForm({ createdBy, title, documentNumber }) { require('../../model/user'); const { Form } = require('../../model/form'); const form = new Form({ title: title || 'E2E Review Form', html: '<div></div>', documentNumber: documentNumber || \`E2E-FORM-${Date.now()}\`, createdBy, owner: createdBy, status: 0 }); await form.save(); return { formId: form._id.toString(), v: form._v }; }` — a minimal, directly-constructed Form (bypassing the builder UI entirely), the same "provision a precondition, don't exercise business logic" convention `createFillableTraveler` already follows for Travelers. `_v` defaults to `1` via the `addVersion` plugin (`model/history.js`) and is returned since the real `PUT /forms/:id/status` route requires it to match. Register it in `COMMANDS` as `'create-review-form'`.
- [ ] T021 [P] [US3] In `e2e/fixtures/cli.js`, add `async function setFormStatus({ formId, status, reviewRequests }) { require('../../model/user'); const { Form } = require('../../model/form'); const update = { status }; if (reviewRequests !== undefined) update['__review.reviewRequests'] = reviewRequests; const form = await Form.findByIdAndUpdate(formId, update, { new: true }); if (!form) throw new Error(\`Form not found: ${formId}\`); return { formId: form._id.toString(), status: form.status }; }` — moves a Form to any status directly and/or seeds `__review.reviewRequests`, bypassing the status route's transition rules and the add-request route's own checks, mirroring `setTravelerStatus`'s existing, explicitly-documented precedent ("bypassing the status route's transition and authorization rules — for arranging test preconditions"). Does **not** touch `_v` (`findByIdAndUpdate` skips the `addVersion` save-middleware), so the `v` a prior `createReviewForm`/`PUT .../status` call returned stays valid for a later real status-route call. Register it in `COMMANDS` as `'set-form-status'`.

#### The e2e spec itself

- [ ] T022 [US3] Create `e2e/us-review-request-new-user.spec.js` (header comment and `runId`/`execFixtureCli` imports in the style of `e2e/us-originator-designate.spec.js`). `test.describe('US3 — Form reviewer add provisions a User record')`: `create-review-form` with `createdBy` the primary persona's id (the Form owner, needed for `reqUtils.isOwnerMw('id')` on the add-request route); `set-form-status` to `0.5` (the add-request route's own required precondition — `reqUtils.status('id', [0.5])` — set directly rather than driving the real Draft→UnderReview transition, which isn't what this story is testing); as `bob` (`E2E_USER2`), capture `bob`'s current roles via `get-user` (to restore afterward), then `delete-user` for `bob`'s id. As the primary persona, open the Form's review-requests tab, use the reviewer typeahead to select `bob`, click Add; confirm via `page.request` (or a `page.waitForRequest` on the click) that the `POST .../review/requests` call's body now includes `email` (the fix from T024) and the response is `201`, **not** the old "please add user id..." `400`. Then `get-user` for `bob`'s id and confirm a record now exists with the expected email. Afterward, re-apply `bob`'s captured roles via `grant-role` for each (restoring pre-test state for later specs in the same run).
- [ ] T023 [US3] In the same spec file, add a second scenario reusing the Form from T022 (which now has `bob` as a resolvable reviewer, per `__review.reviewRequests`): `delete-user` for `bob` again (simulating a review request that predates a `User` record — the exact crash condition `routes/form.js`'s defensive fix, T026, targets); `set-form-status` the Form to `0` (back to Draft — a valid transition per `model/form.js`'s `stateTransition`, and a direct write, not the real route, so it needs no version check); then drive the **real** `PUT /forms/:id/status` route with `{ status: 0.5, version: 1 }` (the `v` `create-review-form` returned) via `page.request.put` — this is the one real transition that runs the vulnerable notification block (`routes/form.js`, around where it resolves `f.__review.reviewRequests` to emails) — and confirm the response is **not** a `500` (today's crash on the unresolved reviewer's `.email`). Restore `bob`'s roles again afterward via `grant-role`.

### Implementation for User Story 3

- [ ] T024 [P] [US3] In `public/javascripts/review.js`, in the `$('#add').on('click', ...)` handler, add `data.email = userSelected.mail;` alongside the existing `data.name = userSelected.displayName; data.uid = userSelected.uid;` lines — the Bloodhound AD cache entry already has `.mail` (per `docker/ad.json`'s `memberAttributes`); it was simply never sent.
- [ ] T025 [P] [US3] In `lib/review.js#addReviewRequest`, add `const { ensureUserExists } = require('./user-directory');` to the top-of-file requires. Change `const { uid, name } = req.body;` to `const { uid, name, email } = req.body;`. Rename the existing `const reviewer = await User.findById(uid.toLowerCase()).exec();` to `const existingReviewer = await User.findById(uid.toLowerCase()).exec();`, delete the `if (!reviewer) { return res.status(400).send(...) }` block entirely, and add `const reviewer = existingReviewer || await ensureUserExists({ id: uid.toLowerCase(), name, email });` in its place. Since `ensureUserExists` can throw a validation error (`status: 400`, no email available), add a dedicated `catch` for it — either a `try/catch` around just that line, re-throwing anything without a `status`, or a check in the function's existing generic `catch (error) { ... }` block (`if (error.status === 400) return res.status(400).send(error.message);` before its current `return res.status(500)...` line) — a validation error here must surface as `400`, not the generic `500`. Every line after reviewer resolution (`const roles = ...`, the `permissions.includes(Review_forms)` check, `doc.requestReview(...)`, the notification) is otherwise unchanged. (makes T016/T017/T018 pass)
- [ ] T026 [P] [US3] In `routes/form.js`, at the point building `users`/`emails` for the "New Review Request" notification (`f.__review.reviewRequests.map(user => User.findOne({ _id: user._id }))` then `users.map(user => user.email)`), change the second line to filter out unresolved reviewers first: `const emails = users.filter(Boolean).map(user => user.email);` — a review request whose reviewer has no local `User` document (predates this feature, or was added by other means) is skipped instead of throwing. (makes T023 pass)

**Checkpoint**: All three user stories are functional and independently testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verification and the checks the constitution requires.

- [ ] T027 Run `npx eslint .` and fix every new violation in files this feature touched.
- [ ] T028 Run `TRAVELER_CONFIG_REL_PATH=docker npm run unit` and confirm the whole suite is green; measure coverage of `lib/user-directory.js` with `TRAVELER_CONFIG_REL_PATH=docker npx c8 --include lib/user-directory.js npx mocha test-unit/lib/user-directory.test.js` and add tests until it is ≥ 80% (constitution I).
- [ ] T029 Run `npm audit --omit=dev` and confirm no new advisory appears (no new dependency was added by this feature); record the (unchanged) result in the PR description per constitution III.
- [ ] T030 With the stack running (`docker compose up`), run the full e2e suite `npm run e2e` and confirm `e2e/us-review-request-new-user.spec.js` passes and no other spec regressed (in particular, `e2e/us-originator-designate.spec.js` and anything exercising `bob`'s roles elsewhere in the suite — T022/T023's role-restore steps are what protect this).
- [ ] T031 Walk through `specs/127-upsert-user-on-stakeholder-add/quickstart.md` sections 2 and 3 manually against the running Docker stack, confirming both NCR and Form reviewer behavior match by eye.
- [ ] T032 Add a `CLAUDE.md` "Recent Changes" entry for `127-upsert-user-on-stakeholder-add` recording: NCR CE/CS, additional Approver, and Originator Designate adds now guarantee a local `User` record exists for the person added (created from the already-resolved AD-typeahead identity, never overwriting an existing record); NCR closure's final distribution now also reaches a Preventive Action owner who has never logged in via their already-stored `owner_email`; Form reviewer-add (`POST /forms/:id/review/requests`) gains an optional `email` body field and no longer refuses an unknown reviewer outright — it now provisions them and applies the existing review-permission check; a related `routes/form.js` crash (unresolved reviewer's `.email`) is fixed. New `lib/user-directory.js#ensureUserExists`. (constitution V)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none — start immediately.
- **Foundational (Phase 2)**: needs Setup only. **Blocks every user story** — `ensureUserExists` is called by all three.
- **User Story 1 (Phase 3)**: needs Foundational. No dependency on US2/US3.
- **User Story 2 (Phase 4)**: needs Foundational; its "no new code needed" characterization test (T014) needs US1's implementation (T009-T012) to be meaningful, though T013/T015 (the PA-owner fix itself) do not.
- **User Story 3 (Phase 5)**: needs Foundational only — independent of US1/US2.
- **Polish (Phase 6)**: after the stories you intend to ship.

### Shared-file ordering (this limits real parallelism)

| File | Order |
|---|---|
| `lib/user-directory.js` | T004 (created once, read by every later task) |
| `lib/ncr-service.js` | T009 → T010 → T011 → T012 → T015 |
| `test-unit/lib/ncr-service.test.js` | T005/T006/T007/T008 → T013/T014 |
| `lib/review.js` | T025 |
| `test-unit/lib/review.test.js` | T016/T017/T018 |
| `public/javascripts/review.js` | T024 |
| `routes/form.js` | T026 |
| `e2e/fixtures/cli.js` | T019 / T020 / T021 (three independent new functions) |
| `e2e/us-review-request-new-user.spec.js` | T022 → T023 |

With more than one developer, split by story only after agreeing an owner for each shared file, or expect to rebase. US1 and US3 touch entirely disjoint files and can proceed fully in parallel once Phase 2 is done.

### Within Each User Story

- Tests are written first and must fail before implementation.
- US1: all four `ensureUserExists` call sites are independent of each other (different functions); implement in any order.
- US2: depends on US1 having landed for its characterization test (T014) to mean anything; the PA-owner fix itself (T013/T015) does not.
- US3: the client fix (T024), the server fix (T025), and the defensive fix (T026) are independent of each other; the three new fixtures (T019-T021) are independent of each other and of the implementation fixes.
- The story is complete, and its checkpoint verified, before the next priority begins (if working sequentially).

### Parallel Opportunities

- Phase 1: T001 and T002 are typically run back-to-back.
- Phase 2: T003 (tests) before T004 (implementation) — not parallel with each other, but nothing else depends on timing within this pair beyond "tests fail first."
- US1: T005-T008 together (same file, four separate `describe` blocks). T009-T012 are sequential (same file, no file-level parallelism) but have no logical dependency on each other — any order works.
- US2: T013 and T014 together (same file, additive, independent assertions).
- US3: T016-T018 together (same file). T019, T020, T021 together (same file, three independent new functions — note: concurrent edits to the same file still need a merge, just no logical conflict). T024, T025, T026 together (three different files, no dependency on each other). T022 depends on T019+T020+T021+T024+T025; T023 additionally depends on T026 and on T022 having run first (reuses its Form).

## Parallel Example: User Story 1 tests

```bash
# Four independent describe-block additions to the same file:
Task: "T005 [P] [US1] createNcr CE/CS provisioning test in test-unit/lib/ncr-service.test.js"
Task: "T006 [P] [US1] submitConcurrence approver provisioning test in test-unit/lib/ncr-service.test.js"
Task: "T007 [P] [US1] addApprover provisioning test in test-unit/lib/ncr-service.test.js"
Task: "T008 [P] [US1] assignDesignate provisioning test in test-unit/lib/ncr-service.test.js"
```

## Parallel Example: User Story 3 implementation

```bash
# Three different files, no dependency on each other:
Task: "T024 [P] [US3] capture userSelected.mail in public/javascripts/review.js"
Task: "T025 [P] [US3] ensureUserExists wiring in lib/review.js#addReviewRequest"
Task: "T026 [P] [US3] defensive null-guard in routes/form.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (Setup).
2. Phase 2 (Foundational) — **CRITICAL**, blocks every story.
3. Phase 3 (User Story 1) — the explicit, primary ask: NCR CE/CS, Approver, and Designate adds all guarantee delivery. **Ship US1 alone as the MVP.**
4. **Stop and validate** against quickstart.md section 2, steps 1-3, before continuing.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. US1 (P1) → test → demo (**MVP**) — the exact failure mode reported.
3. US2 (P2) → test → demo — closure's final distribution, including the PA-owner-specific fix.
4. US3 (P3) → test → demo — the same guarantee for Form reviewers.
5. Polish (Phase 6) — lint, coverage ≥ 80%, audit, full e2e, quickstart walk-through, changelog.

### Notes

- [P] tasks touch different files (or clearly separable regions of the same file) and depend on no incomplete task.
- Confirm each story's tests fail before implementing it.
- Commit after each task or logical group; stop at any checkpoint to validate that story independently.
- No existing e2e spec drives the Form/review workflow at all today (unlike NCR and Traveler, which have extensive coverage) — T019-T021's three new fixtures are the minimum needed to reach it, each modeled directly on an existing, analogous Traveler fixture (`createFillableTraveler`, `setTravelerStatus`) rather than inventing a new testing convention.
- T022/T023's role-capture-and-restore steps exist because `bob` (`E2E_USER2`) is a shared persona across the whole e2e run (logged in once by `global-setup.js`, before any spec runs) — deleting their `User` record mid-spec without restoring it afterward would leak into every other spec that runs later in the same CI run.
