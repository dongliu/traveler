# Quickstart: Automated Playwright E2E Test Suite

**Feature**: `002-playwright-e2e-tests` | **Spec**: [spec.md](./spec.md)

The suite's day-to-day guide now lives in [`e2e/README.md`](../../e2e/README.md).

## Prerequisites

- The local Docker Compose stack is already running (`docker compose up`),
  including the `web`, `mongo`, `mongo-express`, and mail-catcher services.
  This suite never starts, stops, or reconfigures containers.
- Node.js 18+ on the host (matching the app's own requirement).
- A local `.env` file (gitignored) with, in addition to the existing
  `WEB_PORT`/`API_PORT`/`MONGO_EXPRESS_PORT`/`E2E_USER`/`E2E_PASS` variables:
  - `MAIL_PORT` (default `8025` if unset)
  - `E2E_USER2` / `E2E_PASS2` — a **second** real LDAP-backed test identity,
    distinct from `E2E_USER`, used only for the designated-approver scenarios
    (see research.md Decision 4). Any existing user document works.

## One-time setup

```bash
npm install                  # installs the new @playwright/test devDependency
npx playwright install chromium   # downloads the browser binary Playwright drives
```

## Running the suite

```bash
# Full suite
npm run e2e

# A single user story's scenarios
npm run e2e -- e2e/us1-create-and-submit-ncr.spec.js

# A single acceptance scenario within a file
npm run e2e -- e2e/us1-create-and-submit-ncr.spec.js -g "AS3"
```

Each run resolves `WEB_PORT`/`API_PORT`/`MONGO_EXPRESS_PORT`/`MAIL_PORT`/
`E2E_USER`/`E2E_PASS`/`E2E_USER2`/`E2E_PASS2` from `.env` at start — if the
web app or mail catcher isn't reachable, the run fails immediately with a
clear message identifying which dependency is unreachable (FR-012), rather
than proceeding into misleading per-scenario failures.

## Where results land

- `playwright-report/index.html` — open in a browser for a per-scenario
  pass/fail summary; failed scenarios link directly to their trace, video,
  and screenshot.
- `playwright-report/results.json` — machine-readable summary.
- Both paths are gitignored (added to `.gitignore` alongside `test-results/`,
  Playwright's default trace/artifact working directory).

## Debugging a failure

```bash
npx playwright show-trace test-results/<failed-test>/trace.zip
```

Opens Playwright's trace viewer — a full timeline of the failing scenario's
DOM snapshots, network requests (including the Mailpit API calls the
scenario made), and console output, without re-running anything.

## History: the manual `test-e2e/` scripts

This suite replaced the manual `test-e2e/*.md` scripts, which were driven by
hand through a browser skill. They have been removed (commit `84216a09`); this
Playwright suite is the only end-to-end approach. spec.md's Coverage Mapping
table records which manual file each automated scenario superseded, and the
files remain readable in git history (`git show 84216a09^:test-e2e/README.md`).
