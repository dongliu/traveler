# Phase 0 Research: Automated Playwright E2E Test Suite

**Feature**: `002-playwright-e2e-tests` | **Spec**: [spec.md](./spec.md)

This research resolves every open technical question needed to fill the
plan's Technical Context before design. Each decision was grounded by reading
the actual repo (`app.js`, `docker-compose.yml`, `docker/*.json`,
`test-e2e/README.md`) and, where feasible, verified empirically against the
running local Docker stack rather than assumed.

## Decision 1: Test runner and browser automation library

**Decision**: `@playwright/test`, running as a host-side Node process (not
inside a container).

**Rationale**: Explicitly requested by the feature description. It bundles
its own browser binaries, test runner, assertion library, HTML/JSON
reporters, and trace/video/screenshot capture — no additional test framework
or assertion library is needed. Running it host-side (rather than inside the
`web` container) mirrors how the existing manual suite already works: the
browser drives `http://localhost:${WEB_PORT}`, the same host-exposed port a
developer's own browser would use. Running a headed/headless Chromium inside
a Linux container would add container-display complexity (Xvfb, VNC) for no
benefit, since the `web` service already publishes its port to the host.

**Alternatives considered**:
- *Cypress*: comparable capability, but not what the user asked for, and adds
  a second, differently-shaped config/runner pattern to the repo for no gain.
- *Playwright running inside the `web` container*: would need X-server
  plumbing for the container and can't reach the host's Docker port mappings
  more easily than the host can — pure downside, no upside, rejected.

## Decision 2: Test fixture provisioning (roles, CE/CS assignment, group membership, backdating, Traveler links)

**Decision**: A small internal fixture CLI script, added to the repo (e.g.
`e2e/fixtures/cli.js`), invoked from Playwright test code via
`docker compose exec -T web node e2e/fixtures/cli.js <command> '<json-args>'`.
The script establishes its own Mongoose connection using the exact same
bootstrap `app.js` uses (`config.mongo.server_address/port/traveler_db` +
`user`/`pass`/`auth.authdb` from `docker/mongo.json`), then requires the
existing `model/*.js` files directly and performs the requested read/write.

**Rationale**: `test-e2e/README.md`'s "Test fixture setup" section documents
exactly which preconditions currently require a human to hand-edit MongoDB
via mongo-express (role grants, `ce_cs_id` assignment, `ncr-qa` group
membership, backdating `created_at`, constructing a Traveler-linked NCR) —
none of these have an existing app route. Automating them requires direct
database access. The `mongo` service's port is commented out in
`docker-compose.yml` (`# ports: - '27017:27017'`), so it is **not** reachable
from the host by default, and FR-001 forbids the suite from reconfiguring
containers to expose it. The `web` container, however, already has network
access to `mongo` and already holds the correct credentials in
`docker/mongo.json` (loaded via `TRAVELER_CONFIG_REL_PATH=docker`, the same
env var the Docker Compose `web` service sets). Because the repo is bind-mounted
into the `web` container (`.:/app` in `docker-compose.yml`), any new file
added under `e2e/fixtures/` is immediately visible inside the running
container with no rebuild — `docker compose exec` can run it right away.
Reusing the app's own `model/*.js` Mongoose schemas (rather than hand-rolling
parallel schema definitions in test code) guarantees the fixture CLI never
drifts out of sync with the real data model.

**Verified**: `docker compose exec -T web node -e "..."` successfully reaches
the `mongo` service over the Docker network from inside `web` (network path
confirmed); `docker/mongo.json`'s `traveler`/`travelerpassword` credentials
were confirmed present via the seed script
(`traveler-mongo/seed/task1-add-db-user.sh`) and confirmed previously
successful in `mongo`'s own auth log (`Successfully authenticated as
principal traveler on admin`). A hand-written one-off reproduction of
`app.js`'s connection options did *not* immediately succeed (a legacy
mongoose 5 `auth: {authdb}` option quirk) — the fixture CLI implementation
must reuse the exact connection bootstrap from `app.js` rather than a
simplified rewrite; this is called out as an implementation pitfall for the
tasks phase, not a blocker to this design.

**Alternatives considered**:
- *Expose Mongo's port to the host permanently* (uncomment the
  `docker-compose.yml` line) and connect directly from the host Playwright
  process via the `mongodb` npm package: rejected because it requires a
  one-time, shared change to `docker-compose.yml` that affects every
  developer's environment regardless of whether they use the e2e suite, and
  duplicates the app's Mongoose schema definitions in a second place that can
  drift.
- *Add authenticated test-only fixture routes to the running app* (e.g.
  `POST /test/fixtures/...`, gated by an env flag): rejected — this adds
  test-only surface area to production route code, which the constitution's
  Security-First principle discourages, and risks the flag being
  misconfigured in a real deployment.
- *mongo-express's HTTP interface*: rejected — it is an HTML admin UI, not a
  stable JSON API designed for scripted access; fragile to scrape.

## Decision 3: Outbound email verification

**Decision**: Query the Mailpit HTTP API directly from Playwright's built-in
`request` (APIRequestContext) fixture, against the host-exposed `MAIL_PORT`
(default `8025`).

**Rationale**: Mailpit already captures all outbound SMTP from the app on the
Docker network and already exposes its API on the host (confirmed:
`DELETE http://localhost:8025/api/v1/messages` succeeds directly from the
host shell). No new dependency is needed — Playwright's own `request` context
covers arbitrary JSON HTTP calls, so there's no reason to add `axios`/`node-fetch`
alongside it.

**Alternatives considered**:
- *Parse the Mailpit web UI with the same Playwright browser*: rejected —
  slower, brittle to UI changes, and unnecessary when a JSON API exists.

## Decision 4: Authentication strategy across multiple personas

**Decision**: Two real, pre-existing LDAP-backed test identities, each with
its own Playwright `storageState` (cookie/session snapshot captured once via
a `global-setup` UI login, reused across test files/contexts). New env vars
`E2E_USER2`/`E2E_PASS2` are added alongside the existing `E2E_USER`/`E2E_PASS`
convention. Role/assignment differences between "personas" beyond these two
real identities (QA Staff, Manager, CE/CS-on-a-specific-NCR) are simulated by
toggling the **same** identity's roles/group-membership/assignment via the
Decision 2 fixture CLI, not by provisioning additional LDAP accounts.

**Rationale**: Reading `test-e2e/us3-qa-concurrence-and-approver-coordination.md`
closely shows the existing manual suite already depends on a second real
login for the designated-approver scenarios specifically ("Log out, log back
in as `<approver-username>`" — because `additional_approvers[].approver_id`
must match a real distinct user id, an identity check the fixture CLI cannot
fake without a second real session). Every other "role" in the manual suite
(QA Staff, Manager, CE/CS-on-a-given-NCR) is achieved by editing the **same**
already-logged-in test user's own `roles` array, `ncr-qa` group membership, or
setting `ce_cs_id` to that same user's id — confirmed by
`test-e2e/README.md`'s fixture-setup section, which never mentions a third
identity. The app's Basic-Auth API path (`docker/api.json`) uses fixed
service accounts (`api_read`/`api_write`) unrelated to any specific user's
identity or role, so it cannot substitute for a second session where the
service layer checks a specific `approver_id`/`ce_cs_id` (confirmed by
reading `lib/ncr-service.js`'s identity checks). Two real identities plus
data-layer role toggling is therefore both necessary and sufficient — no
third identity is required anywhere in the spec's six user stories.

**Alternatives considered**:
- *One identity only, toggling roles for the approver scenario too*: rejected
  — `additional_approvers` entries are matched by user id in
  `lib/ncr-service.js`'s `submitApproval`, so a second designated approver
  genuinely requires a second, different identity acting on the NCR; a single
  identity cannot occupy both the QA-concurrence role and the
  designated-approver role in the same acceptance scenario.
- *A pool of N identities, one per persona*: rejected as unnecessary
  complexity — the manual suite's own documented workflow only ever needed
  two, and every other persona difference already lives at the data layer.

## Decision 5: Cross-run data isolation (no shared-database reset)

**Decision**: Every scenario generates its own uniquely-scoped identifying
values (e.g. a per-run suffix appended to `part_number`/`wbs_number`) for any
NCR it creates, and any assertion that could be affected by leftover data from
a previous run (dashboard counts, filter results) scopes its query to data
carrying that run's unique suffix rather than asserting exact global counts.

**Rationale**: FR-001 forbids the suite from managing container lifecycle, so
there is no built-in "reset the database" step between runs, and the
shared local Mongo volume persists across invocations exactly as it does for
a developer's own manual testing today. Scoping assertions to
suite-run-generated identifiers (rather than fixed constants or unscoped
counts) is the same technique needed regardless of database state, and
naturally satisfies both FR-009 (no cross-run interference) and the ability
to run scenarios in parallel later, since concurrently-running scenarios
never share an identifying value either.

**Alternatives considered**:
- *Truncate/reset relevant collections before each run*: rejected — this is a
  form of "reconfiguring" the running stack's data that FR-001 and the
  existing manual suite's "don't start/stop containers" prerequisite both
  caution against touching, and would destroy any other in-progress manual
  testing data a developer has in their local database.

## Decision 6: Failure diagnostics and reporting

**Decision**: Playwright's built-in configuration options —
`trace: 'retain-on-failure'`, `video: 'retain-on-failure'`,
`screenshot: 'only-on-failure'` — plus its built-in HTML reporter (for a
human-readable per-scenario pass/fail summary) and JSON reporter (for a
machine-readable summary), both written to a gitignored `playwright-report/`
directory.

**Rationale**: These are first-class, zero-additional-dependency Playwright
features that directly satisfy US6/FR-007/FR-008 — a trace file lets a
developer replay the exact failing step (DOM snapshots, network calls,
console logs) in Playwright's trace viewer without re-running anything. No
custom diagnostics code is needed.

**Alternatives considered**:
- *`screencapture -v` OS-level recording* (the approach used ad hoc for the
  manual suite's session recordings): rejected for this suite — `test-e2e/README.md`
  already documents that OS-level screen recording was tried for the manual
  suite and dropped as unreliable ("recorded nothing but the desktop
  background" on that machine); Playwright's own trace/video capture runs
  inside the same process driving the browser and doesn't depend on OS
  screen-recording permissions at all.

## Summary of resolved Technical Context

| Field | Resolution |
|---|---|
| Language/Version | JavaScript (Node.js 18+, matching the app's existing runtime) |
| Primary Dependencies | `@playwright/test` (new devDependency); no other new dependency needed |
| Storage | N/A directly — fixture provisioning delegates to the existing app's own Mongoose models via `docker compose exec`, introducing no new storage layer |
| Testing | `@playwright/test`'s own runner/assertions (this *is* the testing framework being added) |
| Target Platform | Host-side Node process (developer machine) driving a browser against the already-running local Docker Compose stack; fixture CLI executes inside the existing `web` container |
| Project Type | Test-automation suite alongside the existing web-service app (not a new deployable) |
| Performance Goals | N/A in the traditional sense — bounded by SC-006 (full suite under ~15 minutes) |
| Constraints | No container lifecycle management (FR-001); dynamic port/credential resolution from `.env` (FR-002); bounded retry for async email delivery; cross-run data isolation via unique per-run identifiers (FR-009) |
| Scale/Scope | 6 user stories / ~30 acceptance scenarios, 1:1 traceable to the 10 existing `test-e2e/*.md` files (see spec's Coverage Mapping table) |
