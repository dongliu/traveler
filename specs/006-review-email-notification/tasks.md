---

description: "Task list template for feature implementation"
---

# Tasks: Form Review Request Email Notification

**Input**: Design documents from `/specs/006-review-email-notification/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present)

**Tests**: Included — the project constitution requires "all new `lib/` functions MUST have corresponding tests in `test/lib/`", and `lib/review.js` has no prior test coverage.

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1, US2, US3) — omitted for Setup/Foundational/Polish
- Every task includes exact file path(s)

---

## Phase 1: Setup (Dedicated Email Config Scaffolding)

**Purpose**: Create the new config file and remove the settings it replaces, before any code references either. Per `contracts/email-config.md` and `data-model.md`.

- [X] T001 [P] Create `config/email_change.json` with the six required fields (`smtp_host`, `smtp_port`, `smtp_ssl`, `smtp_tls`, `notification_email_address`, `disclaimer`), following the same template style as `config/app_change.json`
- [X] T002 [P] Create `docker/email.json`, populated with the `smtp_host`/`smtp_port`/`smtp_ssl`/`smtp_tls`/`notification_email_address` values currently in `docker/app.json`, plus a `disclaimer` value
- [X] T003 [P] Remove `smtp_host`, `smtp_port`, `smtp_ssl`, `smtp_tls`, `notification_email_address` from `config/app_change.json`
- [X] T004 [P] Remove `smtp_host`, `smtp_port`, `smtp_ssl`, `smtp_tls`, `notification_email_address` from `docker/app.json`

**Checkpoint**: The new config file exists (template + deployed example) and the old keys are gone from `app.json`'s example/deployed copies. No code reads either file yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure every user story depends on — the config loader, the mail-sending `cc` capability, and the review-schema audit trail. **No user story work can begin until this phase is complete.**

- [X] T005 [P] Add a required `module.exports.email = require('../' + configPath + '/email.json');` line to `load()` in `config/config.js`, alongside the other required `require(...)` calls (`ad`, `api`, `app`, `auth`, `mongo`, `service`, `ui`) — **not** wrapped in `optionalRequire` (that stays reserved for `mqtt.json`), per the clarification that this file is required at startup (FR-007)
- [X] T006 Update `lib/email.js`: change the five reads in `initTransport()`/`sendNotification()` from `config.app.smtp_host` / `smtp_port` / `smtp_ssl` / `smtp_tls` / `notification_email_address` to `config.email.*`; add an optional `cc` parameter to `sendNotification({ subject, recipients, from, cc, text, html })` that, when present, is forwarded to `nodemailer`'s `sendMail` call as `cc` (same pass-through treatment as `to`) *(depends on T005)*
- [X] T007 Update `test/lib/email-test.js`: change the `beforeEach` config seeding from `config.app = {...}` to `config.email = {...}` for the five smtp/notification fields; add a test asserting `sendNotification` forwards a provided `cc` to the stubbed transport's `sendMail` call, and a test asserting `cc` is omitted from the call when not provided *(depends on T006)*
- [X] T008 [P] In `model/review.js`: add a `reviewNotification` sub-schema (`recipient: { type: String, required: true }`, `sentOn: { type: Date, required: true, default: Date.now }`, `success: { type: Boolean, required: true }`, `type: { type: String, default: 'request' }`), add `reviewNotifications: [reviewNotification]` to the `review` schema, and add `schema.methods.addReviewNotification = async function(recipient, success) { ... }` (pushes `{ recipient, success }` onto `doc.__review.reviewNotifications` and calls `doc.save()`) to the `addReview(schema)` mixin, parallel to the existing `addReviewResult` method

**Checkpoint**: `config.email` is wired and required at startup; `sendNotification` supports `cc`; any document using `addReview` has a `reviewNotifications` array and an `addReviewNotification()` method. User story implementation can now begin.

---

## Phase 3: User Story 1 - Reviewer is notified by email when assigned (Priority: P1) 🎯 MVP

**Goal**: An already-provisioned reviewer (existing account, already holds the Reviewer role) receives the review-request email when assigned, and the attempt is recorded on the form — whether or not the send itself succeeds.

**Independent Test**: Assign such a reviewer via `POST /forms/:id/review/requests`; confirm `201 Created` and the review-list addition happen either way, confirm an email matching `specs/email.md`'s "review request" template (to the reviewer, cc the owner, disclaimer appended) is sent when the mail relay is up, and confirm `form.__review.reviewNotifications` records the outcome (`success: true` or `false`) in both the up and down cases.

### Tests for User Story 1

- [X] T009 [US1] Create `test/lib/review-test.js` (new file) with unit tests for `lib/review.js`'s `addReviewRequest`, stubbing `User.findById`, `doc.requestReview`, and `lib/email.js`'s `sendNotification` (sinon, following the stubbing style in `test/lib/email-test.js`): (a) when the reviewer already exists with the Reviewer role, assert `sendNotification` is called once with `subject`/`recipients`(reviewer email)/`cc`(owner email)/`from`(`config.email.notification_email_address`)/`text` matching the "review request" layout in `specs/email.md` and ending with `config.email.disclaimer`, and assert `doc.addReviewNotification` is called with `(reviewerEmail, true)`; (b) same setup but the stubbed `sendNotification` resolves `false` — assert the function still resolves the `201` success path and `doc.addReviewNotification` is called with `(reviewerEmail, false)`

### Implementation for User Story 1

- [X] T010 [US1] In `lib/review.js`'s `addReviewRequest`, after `await doc.requestReview(req.session.userid, reviewer)` resolves and before the `201` response: look up the form owner via `User.findById(doc.owner)`; build the subject/body per `specs/email.md`'s "review request" template using `doc.title`, the owner's name (for the greeting addressed to the reviewer, the assigner context, and the cc), the reviewer's name, and the form URL `` `${req.proxied ? authConfig.proxied_service : authConfig.service}/forms/${doc._id}/` `` (import `authConfig` the same way `routes/user.js` does); append `config.email.disclaimer`; call `require('./email').sendNotification({ subject, recipients: reviewer.email, cc: owner && owner.email, from: config.email.notification_email_address, text })`; then call `await doc.addReviewNotification(reviewer.email, sendResult)` regardless of the result — none of this may change the existing `201`/`400`/`500` response codes or throw if the send fails *(depends on T009, T006, T008)*

**Checkpoint**: User Story 1 is fully functional and independently testable — known reviewers get notified, and the attempt is recorded either way.

---

## Phase 4: User Story 2 - Directory users don't have to be looked up by hand before they can be set up as reviewers (Priority: P2)

**Goal**: Assigning a directory (AD) user with no existing eTraveler account auto-creates a minimal account (name + email from the directory) instead of failing outright for lack of any record — while the existing, separate requirement that the account hold the Reviewer role is completely unaffected.

**Independent Test**: Assign a `uid` with no existing `User` document; confirm a `User` document is created with `name`/`email` from a stubbed directory lookup and `roles: []`, and confirm the request is still rejected with today's "needs reviewer role" message (not the old "please add user id ... to etraveler user list" message). Confirm a `uid` matching zero or multiple directory entries is rejected with no `User` document created.

### Tests for User Story 2

- [X] T011 [US2] In `test/lib/review-test.js`, add tests for `addReviewRequest`'s directory fallback: stub `User.findById` to resolve `null` and stub `lib/ldap-client.js`'s `search()` to resolve exactly one match — assert a new `User` is created and saved with `name`/`email` taken from that match and `roles: []`, and assert the function still returns the existing "needs reviewer role" `400` (no `reviewRequest` is added, no email is sent); then stub `search()` to resolve zero results, and again to resolve two results — assert both are rejected with a clear `400` and that `User.prototype.save` is never called in either case *(depends on T009, same file)*

### Implementation for User Story 2

- [X] T012 [US2] In `lib/review.js`'s `addReviewRequest`, when `User.findById(uid.toLowerCase())` resolves to nothing: require `ad` from `../config/config` and `ldapClient` from `./ldap-client` at the top of the file; call `ldapClient.search(ad.searchBase, { filter: ad.searchFilter.replace('_id', uid), attributes: ad.objAttributes, scope: 'sub' }, false, callback)` (same shape as `updateUserProfile` in `routes/user.js`); on exactly one result, create and save `new User({ _id: uid.toLowerCase(), name: result[0].displayName, email: result[0].mail, roles: [] })` and continue into the existing `if (!reviewer.roles.includes(Reviewer))` check completely unchanged; on zero or more than one result, respond `400` with a clear message (replacing today's "please add user id ... to etraveler user list" message for this specific not-found/ambiguous case) and create nothing; log lookup errors via the existing `logger` import, never `console.log` *(depends on T011, T010 — same file as T010, must follow it; depends on T008)*

**Checkpoint**: User Stories 1 AND 2 both work independently — brand-new directory reviewers get auto-provisioned but still need an administrator to grant the Reviewer role before they're notified; already-known reviewers are unaffected.

---

## Phase 5: User Story 3 - Form keeps a record of the notifications it sent (Priority: P3)

**Goal**: Confirm the audit trail from the Foundational phase (T008) and User Story 1 (T010) is actually visible through the form's existing, already-gated review data — with no new route and no wider exposure.

**Independent Test**: After notification attempts have been recorded (via `addReviewNotification`), `form.__review.reviewNotifications` (and therefore the existing `GET /forms/:id/review/json` response, which serializes `form.__review` verbatim) contains one entry per attempt with `recipient`, `sentOn`, `success`, and `type`; access to that data remains gated exactly as it is today (`reqUtils.isOwnerMw('id')`), with no new, wider-access route introduced.

### Tests for User Story 3

- [X] T013 [US3] In `test/lib/review-test.js`, add a test that calls `addReviewNotification(recipient, success)` directly on a `Form`-shaped document (or the in-memory mongoose doc used elsewhere in the file) twice — once with `success: true`, once with `success: false` — and asserts `doc.__review.reviewNotifications` ends up with both entries, each carrying `recipient`, a `sentOn` timestamp, and the matching `success` value, locking in the shape `GET /forms/:id/review/json` will serialize *(depends on T008; no production code change needed for this story)*

**Checkpoint**: All three user stories are independently functional. The notification record is visible wherever a form's review information is already visible today, and nowhere else.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation accuracy, repo-wide code quality, and end-to-end sign-off.

- [X] T014 [P] Update the "Configuration" and "Shared libraries" sections of `CLAUDE.md` to mention the new required `config/email.json` (loaded in `config/config.js`) and `lib/review.js`'s expanded responsibility (AD auto-provisioning, sending the review-request notification, recording it)
- [X] T015 Run `npx eslint .` and `npx prettier --write .` across all files touched by this feature (`lib/review.js`, `lib/email.js`, `model/review.js`, `config/config.js`, `test/lib/review-test.js`, `test/lib/email-test.js`) and fix any reported issues — **note**: `npx eslint .` cannot run in this environment (`eslint-config-airbnb-base`, referenced by `.eslintrc`, is not installed and isn't in `package.json` — pre-existing, unrelated to this feature); `npx prettier --write` ran clean across all touched files
- [X] T016 Run `npx mocha test/lib/` and confirm the full suite passes, including the new/updated `review-test.js` and `email-test.js` *(depends on T015 and all of T001–T013)* — **note**: ran all of `test/lib/` except `ldap-client-test.js`, which requires a real `config/ad.json` with live LDAP credentials that has never existed in this repo (pre-existing, unrelated to this feature) and therefore cannot run here either; all 256 other tests pass
- [ ] T017 Walk through `quickstart.md` Scenarios 1–4 end-to-end against a local instance (`node app.js`, pointed at a config directory that includes the new `email.json`, with a local SMTP catcher) and check off its Validation Checklist *(depends on T016)* — **blocked in this session**: requires a running app, a reachable SMTP catcher, and a live AD/LDAP test fixture, none of which this sandboxed environment has

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Logically depends on Setup (the config files T005 loads should exist first) — **BLOCKS all user stories**
- **User Stories (Phase 3–5)**: All depend on Foundational completion. US1 and US3 have no dependency on US2. US2 extends the same file (`lib/review.js`) that US1 does, so **US2's implementation task (T012) must follow US1's (T010)** even though the stories are otherwise independent in scope.
- **Polish (Phase 6)**: Depends on all three user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational — no dependency on US2/US3
- **User Story 2 (P2)**: Can start after Foundational; shares `lib/review.js` and `test/lib/review-test.js` with US1, so its tasks are sequenced after US1's within those files, even though the *behavior* it adds is independent and separately testable
- **User Story 3 (P3)**: Can start after Foundational (T008) alone — does not require US1 or US2's code, only their data shape; sequenced last here only because it shares `test/lib/review-test.js`

### Within Each Phase

- Tests are written before the implementation task they validate, in the same file, and are expected to fail until that implementation task lands
- `model/review.js` (T008) has no dependency on `config/config.js`/`lib/email.js` (T005–T007) and can proceed in parallel with them

### Parallel Opportunities

- T001, T002, T003, T004 (Setup) — four different config files, all parallel
- T005 and T008 (Foundational) — different files, no mutual dependency, parallel
- T014 (Polish, `CLAUDE.md`) can run any time after the behavior it documents is implemented, in parallel with T015/T016/T017's own sequencing

---

## Parallel Example: Setup Phase

```bash
# Launch all Setup tasks together — four independent config-file edits:
Task: "Create config/email_change.json with the six required fields"
Task: "Create docker/email.json populated from docker/app.json's current smtp_*/notification_email_address values"
Task: "Remove smtp_*/notification_email_address keys from config/app_change.json"
Task: "Remove smtp_*/notification_email_address keys from docker/app.json"
```

## Parallel Example: Foundational Phase

```bash
# These two touch different files and have no dependency on each other:
Task: "Add required config.email loader to config/config.js"
Task: "Add reviewNotification sub-schema + addReviewNotification() to model/review.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Run `npx mocha test/lib/review-test.js test/lib/email-test.js`, then quickstart.md Scenario 1
5. At this point, every reviewer who already has an account and the Reviewer role gets notified — the core value is delivered even before US2/US3 land

### Incremental Delivery

1. Setup + Foundational → config and schema ready
2. Add User Story 1 → test independently → known reviewers get notified (MVP)
3. Add User Story 2 → test independently → brand-new directory reviewers stop hitting a dead-end error, without changing who can hold the Reviewer role
4. Add User Story 3 → test independently → confirm the audit trail the first two stories already produced is visible through existing, already-gated data
5. Polish → docs, lint, full suite, full quickstart walkthrough

### Notes

- [P] tasks = different files, no dependency on an incomplete task
- Because this feature concentrates most of its logic in one shared function (`lib/review.js`'s `addReviewRequest`), US1 and US2's implementation tasks (T010, T012) are necessarily sequential on that file even though they're independently testable in behavior
- Commit after each checkpoint (end of each phase), not after every individual task
- Avoid: vague tasks, same-file conflicts marked `[P]`, skipping the "needs reviewer role" check when auto-creating an account (that check must survive untouched per the `/speckit-clarify` decision)
