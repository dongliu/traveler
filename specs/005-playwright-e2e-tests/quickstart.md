# Quickstart: Automated Playwright E2E Test Suite

**Feature**: `005-playwright-e2e-tests` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

This is a validation guide for the design in this feature directory — it
describes how someone will set up and run the suite once it exists
(`/speckit-tasks` → `/speckit-implement` builds `e2e/`). It does not include
implementation code; see data-model.md and contracts/fixture-routes.md for
the shapes and routes the implementation will use.

## Prerequisites

1. **This project's Docker Compose stack** is running (`docker compose up`):
   `web`, `mongo`, `mongo-express` — see `docker.md`. The suite never starts
   or stops containers (FR-001).
2. **The external LDAP/AD service** this local setup depends on for login
   (per `docker.md`'s "get the dependencies" section) is running on the
   shared `traveler-dev` Docker network, and has two real test accounts
   provisioned — see "Test users" below.
3. Once: `npm install && npx playwright install chromium`.

## Configuration

Copy the port-override pattern `docker.md` already documents for `.env`, and
add four more variables for the suite:

| Variable | Meaning |
|---|---|
| `WEB_PORT`, `API_PORT` | host ports of the compose stack (defaults `3001` / `3002`, per `docker-compose.yml`) |
| `E2E_USER`, `E2E_PASS` | the **primary** test identity — a real LDAP account, needs the `admin` role granted once up front (the suite's `grantRole`/`shareWithUser`/`setGroupMembership` fixtures all act as this persona, per research.md Decision 4) |
| `E2E_USER2`, `E2E_PASS2` | the **secondary** test identity — a second real LDAP account, unprivileged by default |
| `E2E_USER_NAME`, `E2E_USER2_NAME` | each persona's LDAP **display name** (not login id) — required by the group-membership and document-sharing fixtures, which resolve people by AD display-name search (research.md Decision 2, contracts/fixture-routes.md) |

Environment variables set in the shell override `.env`, matching this
repo's existing convention.

## Running (once implemented)

```bash
npm run e2e                                                    # everything
npm run e2e -- e2e/us1-form-lifecycle.spec.js                  # one file
npm run e2e -- e2e/us1-form-lifecycle.spec.js -g AS3            # one scenario
npm run e2e -- --headed e2e/us1-form-lifecycle.spec.js          # watch the browser
```

Everything after `--` goes to Playwright. Calling `npx playwright test`
directly needs `--config=e2e/playwright.config.js`, or must be run from
inside `e2e/` — from the repo root without the config, Playwright loads no
settings (no base URL, no login).

Tests within one spec file run in order and some rely on state left by an
earlier test in the same file (research.md Decision 7); `-g` is safe for most
scenarios but not guaranteed for all. Different files run in parallel.

If the web app or the LDAP service is unreachable, or a login fails, the run
stops immediately with a message identifying which dependency failed
(FR-011), instead of failing test by test.

## Validating the design (what "it works" looks like)

1. **Prerequisite check fails fast**: stop the `web` container, run
   `npm run e2e`; the run should fail within seconds with a clear
   "web app unreachable" message, not a generic timeout deep inside a test.
2. **Form lifecycle (User Story 1)**: `npm run e2e -- e2e/us1-form-lifecycle.spec.js`
   passes end to end — draft creation, review-request to the secondary
   persona (granted `reviewer` first), approval, release, and the
   released-form snapshot's immutability after the draft is edited again.
3. **Traveler lifecycle (User Story 2)**: `npm run e2e -- e2e/us2-traveler-lifecycle.spec.js`
   passes — creation from a released form, data entry, submission for
   completion, admin/manager approval, and the freeze/unfreeze path (from
   "active", not from "completed" — see spec.md's corrected Acceptance
   Scenario 6).
4. **Fixture provisioning (User Story 3)**: `npm run e2e -- e2e/us3-fixture-provisioning.spec.js`
   passes on a freshly reset local database with no manual `mongo-express`
   setup beforehand.
5. **Access control (User Story 4)**: `npm run e2e -- e2e/us4-access-control.spec.js`
   passes, and deliberately breaking one check (e.g. commenting out the
   `admin`/`manager` blanket-access branch in `lib/req-utils.js`'s
   `getAccess`) makes exactly the corresponding scenario fail — proving the
   suite would actually catch that regression.
6. **Failure diagnostics (User Story 6)**: a deliberately-failing scenario in
   `us6-failure-diagnostics.spec.js` produces a trace/video/screenshot
   referenced from `playwright-report/index.html`; `npx playwright show-trace`
   on the produced trace file replays the failing step.
7. **Repeatability (SC-003)**: running `npm run e2e` twice in a row with no
   manual cleanup between runs produces the same pass/fail outcome both
   times.
7a. **Cleanup (FR-013, SC-007)**: after a full run, the active (non-archived)
   forms, travelers, and binders list, filtered by the run's identifying tag,
   is empty; the same records appear in the archived lists. Forcing a scenario
   to fail mid-way (as in `us6-failure-diagnostics.spec.js`) still leaves
   nothing active from that scenario. A cleanup failure appears in the run
   report under its own heading, separate from scenario results (FR-015).
8. **Time budget (SC-005, SC-006)**: a first-time setup, following this
   guide, completes in under 15 minutes (stack already running); a full run
   completes in under 15 minutes.

## Debugging a failure

- `playwright-report/index.html` — pass/fail report; failed tests link to
  their trace, video, and screenshot. `playwright-report/results.json` has
  the same in machine-readable form. Each run overwrites it.
- `test-results/<test>/` — the trace (`trace.zip`), video, and screenshot of
  each failed test.
- `npx playwright show-trace test-results/<failed-test>/trace.zip` replays a
  failure step by step, with DOM snapshots, network calls, and console
  output.

Both `playwright-report/` and `test-results/` are gitignored, along with
`e2e/.auth/` (the saved session cookies) — nothing here is ever committed.
