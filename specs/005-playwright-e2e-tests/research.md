# Phase 0 Research: Automated Playwright E2E Test Suite

**Feature**: `005-playwright-e2e-tests` | **Spec**: [spec.md](./spec.md)

This research resolves every open technical question needed to fill the
plan's Technical Context before design. Each decision was grounded by reading
the actual repo (`app.js`, `docker-compose.yml`, `docker/*.json`,
`routes/*.js`, `model/*.js`, `lib/req-utils.js`, `lib/review.js`,
`views/ldaplogin.jade`) rather than assumed.

## Decision 1: Test runner and browser automation library

**Decision**: `@playwright/test`, running as a host-side Node process (not
inside a container).

**Rationale**: Explicitly requested by the feature description. It bundles
its own browser binaries, test runner, assertion library, HTML/JSON
reporters, and trace/video/screenshot capture — no additional test framework
or assertion library is needed. The `web` service already publishes
`WEB_PORT`/`API_PORT` to the host (`docker-compose.yml`), so a host-side
browser reaches it exactly as a developer's own browser would.

**Alternatives considered**:
- *Cypress*: comparable capability, but not what the feature requested, and
  adds a second, differently-shaped config/runner pattern to the repo.
- *Playwright inside the `web` container*: would need X-server plumbing for
  no benefit, since the host can already reach the published port directly.

## Decision 2: Test fixture provisioning (roles, group membership, share/access grants, pre-positioned lifecycle states)

**Decision**: Provision every fixture through the running app's own
authenticated routes, called with Playwright's built-in `request`
(APIRequestContext) fixture using a persona's saved session — **not** a
database-bypass fixture CLI.

| Fixture need (spec User Story 3) | Route used | Auth required |
|---|---|---|
| Grant/remove a role (`admin`, `manager`, `reviewer`) | `PUT /users/:id` (raw `{roles: [...]}` body) | acting session must already hold `admin` |
| Add/remove group membership | `PUT /groups/:id/addmember/:user`, `PUT /groups/:id/removeMembers` | route-level auth (see contracts/fixture-routes.md) |
| Share a form/traveler/binder with a user, a group, or the public | `POST /<forms\|travelers\|binders>/:id/share/:list/`, `PUT /<...>/:id/share/public` | document owner or admin |
| Transfer document ownership | `PUT /travelers/:id/owner` (and form/binder equivalents) | owner or admin |
| Pre-position a traveler at a lifecycle status | `PUT /travelers/:id/status` | write access; `admin`/`manager` required for the completion-approval transitions |
| Pre-position a form under review / released | `POST /forms/:id/review/requests`, `POST /forms/:id/review/results`, `PUT /forms/:id/released` (chained) | owner (requests, release), designated reviewer (results) |

**Rationale**: Reading `routes/user.js`, `routes/group.js`,
`routes/form.js`, `routes/traveler.js`, and `routes/binder.js` closely shows
that every fixture this spec's User Story 3 lists already has a legitimate,
role-gated application route. `PUT /users/:id`
(`routes/user.js:298`) lets an admin session set a user's `roles` array
directly; the `/share/` routes already exist on all three shareable entity
types; `PUT /travelers/:id/status` (`routes/traveler.js:1088`) accepts any
valid state-machine transition without any additional field-completeness
gate; and a form can be walked from draft to released entirely through its
own review-request/review-result/release routes. Provisioning through these
routes, authenticated as the appropriate persona, exercises the app's real
authorization middleware (`lib/req-utils.js`) rather than routing around it —
a better fit with this project's Permission-Layered Access Control
constitutional principle than a parallel Mongoose bootstrap would have been —
and needs no `docker compose exec` dependency, no duplicated schema
definitions, and no test-only code path added to the app.

**Implementation pitfalls to flag for the tasks phase**:
- `PUT /users/:id` does a raw `User.findOneAndUpdate(id, req.body)` — it
  **replaces** the `roles` array wholesale rather than merging into it. A
  `grantRole` fixture helper must first read the user's current roles
  (`GET /users/:id/json`) and PUT the union back, or it will silently
  clobber any other role the persona already holds.
- Both `PUT /groups/:id/addmember/:user` (`routes/group.js:243`) and sharing
  a document with a specific user (`lib/share.js`'s `addUserFromAD`, used by
  the `/share/` `POST` routes) resolve the target person by an **LDAP
  display-name search** (`ad.nameFilter`/`ad.searchBase` from
  `docker/ad.json`), not by login id — the request body's `name` must be the
  persona's AD display name, and the lookup fails if it isn't unique in the
  directory. `env.js` needs a display-name value for each persona
  (`E2E_USER_NAME`/`E2E_USER2_NAME`), not just their login id, and this path
  depends on the local LDAP/AD service being reachable and seeded with both
  test accounts (see Edge Cases in spec.md). Group *removal*
  (`PUT /groups/:id/removeMembers`) and traveler/form/binder ownership
  transfer do not share this AD-lookup dependency in the same way and can be
  driven by id/name directly once a member already exists.

**Alternatives considered**:
- *A `docker compose exec`-based fixture CLI reusing `model/*.js` directly*:
  rejected for this branch — it would duplicate logic the app's own routes already expose correctly,
  and would add a `docker` CLI dependency and a parallel Mongoose connection
  bootstrap for zero net capability gain, since no fixture in this spec needs
  a field or state genuinely unreachable through an existing route. This
  decision would need to be revisited if a future fixture need (e.g. backdating
  a document's `createdOn` for an aging check) turns out to have no route —
  none of this spec's scenarios do.
- *mongo-express's HTTP interface*: rejected — an HTML admin UI, not a stable
  API for scripted access.
- *Exposing MongoDB's port to the host and connecting directly*: unnecessary
  given the routes above cover every need; would also require a
  `docker-compose.yml` change affecting every developer's environment.

## Decision 3: Outbound email verification

**Decision**: Not part of this suite's design.

**Rationale**: Verified that no route on this branch calls
`lib/email.js`'s `sendNotification` (`grep -rl sendNotification` matches only
`lib/email.js` itself, its own unit test, and an unrelated SMTP-connectivity
CLI tool). This branch's form/traveler/review workflows send no notification
email, so building a mail-capture integration here would test a capability the
app doesn't yet exercise. If a
future feature wires `sendNotification` into a route, that feature's own
plan should revisit this decision; nothing in this design precludes adding
it later (see spec.md Assumptions).

## Decision 4: Authentication strategy across multiple personas

**Decision**: Two real, pre-existing LDAP-backed test identities — `E2E_USER`
(primary, holding the `admin` and `reviewer` roles) and `E2E_USER2`
(secondary, unprivileged by default) — each with its own Playwright
`storageState`, captured once via a `global-setup` login through
`/ldaplogin/` (a plain HTML form posting `username`/`password`, per
`views/ldaplogin.jade`) and reused across test files. New env vars
`E2E_USER2`/`E2E_PASS2` are added alongside `E2E_USER`/`E2E_PASS`. Every
other role difference (`manager`, temporarily-granted `admin` for a
different scenario, group membership) is simulated by toggling the **same**
two identities' roles/group-membership via the Decision 2 route-based
fixtures, not by provisioning additional LDAP accounts.

**Rationale**: `routes/form.js`'s `checkReviewer` (used by
`POST /forms/:id/review/results`) authorizes a review-result submission
against the **acting session's own user id** inside the form's
`reviewRequests` — a scenario that verifies "a designated reviewer, who is
not the form's owner, approves it" (spec User Story 1, Acceptance Scenarios
3–4) therefore needs a second, genuinely distinct logged-in identity; a
single identity cannot occupy both the owner role and the reviewer role in
the same acceptance scenario, since the owner-only release route
(`PUT /forms/:id/released`, `isOwnerMw`) and the reviewer-only result route
are gated on different, specific identities on the same document. User
Story 4's sharedWith checks (Acceptance Scenario 2: "a different, non-shared
user still cannot [access it]") independently need a second identity to
prove exclusion. Every other persona difference in the spec (manager, admin,
group membership) is a property of a user document's `roles`/group
membership, not of a specific document relationship — fully coverable by
toggling roles on the same two identities via Decision 2's route-based
fixtures.

**Alternatives considered**:
- *One identity, toggling roles only*: rejected for the reviewer-approval
  scenario per the `checkReviewer` reasoning above — a self-review would not
  exercise the same authorization path a real second-reviewer approval does,
  and would leave User Story 1 Acceptance Scenario 4 (a *different* person
  requesting changes) untested as written.
- *A pool of N identities*: rejected as unnecessary — every persona
  difference beyond "a second real user" already lives at the data layer
  (roles, group membership).

## Decision 5: Cross-run data isolation (no shared-database reset)

**Decision**: Every scenario generates a fresh, unique identifying suffix
(via `runId()`) and embeds it in the title (and, where applicable, tags) of
any form, traveler, or binder it creates. Any assertion that could be
affected by leftover data from a previous run (list/filter results, counts)
scopes its query to that run's suffix rather than asserting exact global
counts.

**Rationale**: FR-001 forbids the suite from managing container lifecycle,
so the shared local Mongo volume persists across invocations exactly as it
does for a developer's own manual testing today. Scoping to a
suite-run-generated identifier is the same technique needed regardless of
database state, and satisfies FR-008 (no cross-run interference) without
requiring any reset step.

**Update**: Decision 8 now adds active cleanup, so the tag is no longer the
only thing keeping run data out of the way. Run-created records are archived
once their scenario finishes; the tag remains the safety net for artifacts
left behind by an interrupted run.

**Alternatives considered**:
- *Truncate/reset relevant collections before each run*: rejected — outside
  FR-001's bounds, and would destroy any other in-progress manual testing
  data a developer has in their local database.

## Decision 6: Failure diagnostics and reporting

**Decision**: Playwright's built-in configuration options —
`trace: 'retain-on-failure'`, `video: 'retain-on-failure'`,
`screenshot: 'only-on-failure'` — plus its built-in HTML reporter (human-
readable per-scenario pass/fail) and JSON reporter (machine-readable
summary), both written to a gitignored `playwright-report/` directory.

**Rationale**: First-class, zero-additional-dependency Playwright features
that directly satisfy User Story 6 / FR-007 / FR-008. A trace file lets a
developer replay the exact failing step (DOM snapshots, network calls,
console logs) without re-running anything.

**Alternatives considered**:
- *Custom diagnostics capture*: rejected as unnecessary duplication of a
  built-in capability.

## Decision 7: Project/persona structure and within-file parallelism

**Decision**: A single Playwright *project*, defaulting every spec file to
the primary persona's `storageState` at the top-level `use` config. The
secondary persona is opted into locally, per-test, via
`test.use({ storageState: SECONDARY_AUTH_STATE })` rather than a second
Playwright project. `fullyParallel` is left at Playwright's default
(`false`): tests within one spec file run serially; different files run in
parallel across workers.

**Rationale**: Playwright runs every matched spec file under *every configured
project*, so a two-project (`primary`/`secondary`) setup would run each user
story's file twice for no reason, and would race on any scenario that shares
mutable state within a file (e.g. a form created in one test and reused by a
later assertion in the same file). Defaulting to one project with local
overrides, and serial execution within a file, avoids both problems.

**Alternatives considered**:
- *Two Playwright projects*: rejected per the double-run and race reasoning
  above.

## Decision 8: Cleanup of run-created forms, released forms, travelers, and binders

**Decision**: Clean out by **archiving**, through the owning persona's
session, using the app's own archive routes — no direct database deletion.
Every fixture helper that creates a form, released form, traveler, or binder
records it in a run-scoped registry (research: `e2e/fixtures/artifact-registry.js`,
persisted to `e2e/.auth/` so it survives a crash inside one process). A
per-scenario teardown archives what that scenario registered, and a
`globalTeardown` sweep archives anything still registered, so a missed
teardown does not leave artifacts active.

| Artifact | Archive route | Auth | Notes |
|---|---|---|---|
| Binder | `PUT /binders/:id/status` with `{ "status": 3 }` | owner | status 3 is the model's "archived"; this route accepts it from any status (`routes/binder.js:558`) |
| Traveler | `PUT /travelers/:id/archived` with `{ "archived": true }` | owner | sets `archived` and `archivedOn` (`routes/traveler.js:950`) |
| Form (draft / under review / released source) | `PUT /forms/:id/archived` with `{ "archived": true }` | owner | if the form is under review (status `0.5`), remove its review requests first with `DELETE /forms/:id/review/requests/:requestId` — that route only works in `0.5` (`routes/form.js:653`) |
| Released form | `PUT /released-forms/:id/status` with `{ "status": 2, "version": "<ver>" }` | owner or admin | `version` must equal the record's current `ver` string (`routes/form-management.js:107`) |

**Order**: dependents before the things they depend on — binders, then
travelers, then forms, then released forms — so a binder that still contains
travelers, or a traveler still pointing at a released form, is never left as
the last active reference.

**Why not hard delete**: Verified by searching every route file and `lib/`:
the app has no `DELETE` route or `deleteOne` call for forms, released forms,
travelers, or binders. The only `deleteOne`/`findByIdAndDelete` calls are for
traveler data entries and traveler notes, which are sub-records. Permanent
deletion would therefore need direct MongoDB writes, reversing the
route-only principle in Decision 2, and would also orphan related records
(`TravelerData`, logs, released-form snapshots, review-request references on
users) unless each were cleaned individually. Archiving is the application's
own end-of-life state for these records, so the archived lists are where a
person would look for them anyway.

**Interrupted runs**: a process killed mid-run leaves its registry file behind
(in `e2e/.auth/`, gitignored). A later invocation can read a run's registry
and archive what is still active, or leave it for inspection; either way the
run-tag in each title keeps those records out of the next run's assertions
(Decision 5).

**Alternatives considered**:
- *Per-scenario teardown only*: rejected — a crash between creation and
  teardown would leave artifacts active with no record of what they were.
- *Direct database deletion through a fixture CLI*: rejected for the reasons
  above; it is the only way to get literal hard deletion, and it is a
  deliberate exception to Decision 2 that would need its own decision.
- *Asking the app to delete via an admin tool*: none exists in the repo.

## Summary of resolved Technical Context

| Field | Resolution |
|---|---|
| Language/Version | JavaScript (Node.js 18+ host-side; app's own runtime is Node 20 per `Dockerfile`) |
| Primary Dependencies | `@playwright/test` (new devDependency); no other new dependency needed |
| Storage | N/A directly — fixture provisioning goes through the app's own authenticated routes, introducing no new storage layer or database client |
| Testing | `@playwright/test`'s own runner/assertions (this *is* the testing framework being added) |
| Target Platform | Host-side Node process driving a browser against the already-running local Docker Compose stack's host-exposed ports |
| Project Type | Test-automation suite alongside the existing web-service app (not a new deployable) |
| Performance Goals | N/A in the traditional sense — bounded by SC-006 (full suite under ~15 minutes) |
| Constraints | No container lifecycle management (FR-001); dynamic port/credential resolution from `.env` (FR-002); two real LDAP identities required (Decision 4); cross-run data isolation via unique per-scenario identifiers (FR-008, Decision 5); run-created forms, released forms, travelers, and binders archived by their owner once their scenario finishes, never hard-deleted (FR-013/FR-014, Decision 8) |
| Scale/Scope | 6 user stories / 29 acceptance scenarios (spec.md) |
