# Implementation Plan: Automated Playwright E2E Test Suite for NCR Workflow

**Branch**: `002-playwright-e2e-tests` | **Date**: 2026-08-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-playwright-e2e-tests/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Build an automated Playwright test suite that provides unattended, scriptable
coverage equivalent to the 10 manual `test-e2e/*.md` files (currently driven
by hand through the Claude-in-Chrome browser extension). The suite runs
host-side against the already-running local Docker Compose stack: Playwright
drives a real browser against the host-exposed web app port; a small fixture
CLI (invoked via `docker compose exec`) provisions preconditions the existing
manual suite currently requires a human to set up by hand-editing MongoDB
(role grants, CE/CS assignment, `ncr-qa` group membership, backdated NCRs,
Traveler-linked NCRs); outbound email is verified against the mail-catcher's
JSON API instead of a human reading an inbox. See research.md for the
technology decisions and their rationale.

## Technical Context

**Language/Version**: JavaScript (Node.js 18+, matching the app's existing runtime)

**Primary Dependencies**: `@playwright/test` (new devDependency); no other new dependency required — Mailpit verification uses Playwright's own built-in `request` fixture, and fixture provisioning reuses the app's own `mongoose`/`model/*.js` inside the `web` container rather than adding a second DB driver

**Storage**: N/A directly — the suite introduces no new storage layer; fixture provisioning delegates to the existing app's own Mongoose models via `docker compose exec` (see research.md Decision 2)

**Testing**: `@playwright/test`'s own test runner, assertions, and reporters — this feature *is* the testing framework being added, alongside the existing `mocha`-based `test-unit/` suite (unaffected)

**Target Platform**: Host-side Node process (developer machine) driving a browser against the already-running local Docker Compose stack; the fixture CLI executes inside the existing `web` container via `docker compose exec`

**Project Type**: Test-automation suite alongside the existing web-service app (web + API servers) — not a new deployable

**Performance Goals**: N/A in the traditional request-latency sense; bounded by SC-006 (full suite completes in under ~15 minutes)

**Constraints**: Must not start/stop/reconfigure any Docker container (FR-001); must resolve all ports and credentials from `.env` at run time, not hardcoded (FR-002); async SMTP delivery requires bounded polling, not fixed sleeps or immediate single checks (Edge Cases, contracts/mailpit-api.md); must not interfere with a subsequent run sharing the same persistent local database (FR-009, research.md Decision 5)

**Scale/Scope**: 6 user stories / ~30 acceptance scenarios, 1:1 traceable to the 10 existing `test-e2e/*.md` files via the spec's Coverage Mapping table

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Evaluation

| Principle | Status | Notes |
|---|---|---|
| I. Automated Testing | PASS | The constitution explicitly recommends E2E tests for critical user journeys — this feature directly delivers that. Does not touch the existing `test-unit/` coverage or its 80%-for-new-code target (no `lib/`/`model/`/`routes/` code changes). |
| II. Code Quality and Consistency | PASS | New JS files (`e2e/**`) go through the same ESLint/Prettier configuration already governing the repo; no new lint config needed since Playwright test files use explicit `import { test, expect } from '@playwright/test'` rather than relying on injected globals. |
| III. Security-First Architecture | PASS with note | The fixture CLI performs direct Mongoose writes that bypass the app's own service-layer validation — by design, since it *provisions preconditions*, not the behavior under test. It is never imported by or reachable from any production route (`routes/*.js` unchanged), runs only via `docker compose exec` against a developer's own local stack, and introduces no new secret (reuses `docker/mongo.json`, already present in the repo). See research.md Decision 2's rejected alternative ("test-only fixture routes on the running app") for why this shape was chosen specifically to avoid adding test-only surface to production code. |
| IV. Versioning & Breaking Changes | PASS | Purely additive tooling; no existing route, model, or API contract changes. |
| V. Documentation | PASS | quickstart.md documents setup/run/debug; contracts/ documents the two internal interfaces (fixture CLI, Mailpit API dependency) this design introduces. |

No gate violations. No complexity tracking required.

### Post-Design Re-check

| Principle | Status | Notes |
|---|---|---|
| I. Automated Testing | PASS | Design confirmed: 6 Playwright spec files (one per user story), each independently runnable per spec's "Independent Test" clauses, satisfying the constitution's E2E recommendation without depending on run order. |
| II. Code Quality and Consistency | PASS | Project Structure below keeps `e2e/` fully separate from `lib/`/`routes/`/`model/`, preserving the existing separation of concerns; the fixture CLI reuses (never duplicates) the app's own schemas. |
| III. Security-First Architecture | PASS | Confirmed via research.md Decision 2's verification step: the fixture CLI's DB access path was empirically checked against the running stack (network reachability + existing credentials), not assumed; no new secret or exposed port was introduced (Mongo's port remains unexposed to the host, per the rejected "expose Mongo's port" alternative). |
| IV. Versioning & Breaking Changes | PASS | No change since pre-design. |
| V. Documentation | PASS | All Phase 1 artifacts produced (data-model.md, contracts/fixture-cli.md, contracts/mailpit-api.md, quickstart.md). |

No gate violations after design. No complexity tracking required.

## Project Structure

### Documentation (this feature)

```text
specs/002-playwright-e2e-tests/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── fixture-cli.md
│   └── mailpit-api.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
e2e/                              # NEW — Playwright suite (fully separate from test-e2e/, which is untouched)
├── playwright.config.js          # baseURL from resolved .env ports, trace/video/screenshot-on-failure, reporters
├── global-setup.js               # logs in as E2E_USER and E2E_USER2 once, saves storageState per persona
├── fixtures/
│   ├── cli.js                    # the fixture CLI (contracts/fixture-cli.md) — runs inside the web container
│   ├── env.js                    # resolves WEB_PORT/API_PORT/MONGO_EXPRESS_PORT/MAIL_PORT/E2E_USER(2)/E2E_PASS(2) from .env, same convention as test-e2e/README.md
│   ├── mailpit.js                # Mailpit API helper (contracts/mailpit-api.md) — search/poll/fetch-message
│   └── run-id.js                 # per-run unique suffix generator (research.md Decision 5)
├── us1-create-and-submit-ncr.spec.js            # User Story 1 (spec.md) — supersedes test-e2e/us1*.md, us1.5*.md, us1.6*.md
├── us2-approval-lifecycle.spec.js               # User Story 2 — supersedes test-e2e/us2*.md, us3*.md, us5*.md, us6*.md
├── us3-fixture-provisioning.spec.js             # User Story 3 — exercises fixtures/cli.js directly
├── us4-reporting-and-preventive-actions.spec.js # User Story 4 — supersedes test-e2e/us4*.md, us7*.md
├── us5-access-control-and-validation.spec.js    # User Story 5 — supersedes test-e2e/supplementary-*.md
└── us6-failure-diagnostics.spec.js              # User Story 6 — a deliberately-failing scenario asserting diagnostics are produced

playwright-report/                # gitignored — HTML + JSON reporter output (data-model.md's Run Report)
test-results/                     # gitignored — Playwright's default trace/video/screenshot working directory
```

No changes to `lib/`, `model/`, `routes/`, or `views/` — this feature is
purely additive test tooling. `package.json` gains one devDependency
(`@playwright/test`) and one script (`"e2e": "playwright test"`, run from
`e2e/playwright.config.js`). `.env.example` gains `MAIL_PORT`, `E2E_USER2`,
`E2E_PASS2` alongside the existing `E2E_USER`/`E2E_PASS` documented there.
`.gitignore` gains `playwright-report/` and `test-results/`.

**Structure Decision**: Single new top-level `e2e/` directory, mirroring the
existing top-level `test-e2e/` (manual) and `test-unit/` (mocha) directories
— consistent with this repo's existing pattern of one top-level directory per
test type/tool, rather than nesting under `test-e2e/` (which would blur the
line between the manual markdown scripts and this automated suite) or under
`lib/`/`routes/` (which are production code, not test code).

## Complexity Tracking

*No Constitution Check violations — this section is not applicable.*
