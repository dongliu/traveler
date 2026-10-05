# Implementation Plan: Automated Playwright E2E Test Suite for the Local Docker Stack

**Branch**: `005-playwright-e2e-tests` | **Date**: 2026-09-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-playwright-e2e-tests/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Build an automated Playwright suite that drives a real browser against the
already-running local Docker Compose stack, covering the form
authoring/release lifecycle, the traveler data-entry/completion lifecycle,
and the layered access-control model — the areas this project's constitution
treats as non-negotiable. Every precondition the suite's scenarios need
(role grants, group membership, share/access grants, a traveler or form
pre-positioned at a given lifecycle status) is provisioned through the
running app's own authenticated routes, called directly over HTTP with
Playwright's `request` fixture. Verification against this repo's routes (see
research.md Decision 2) found that every fixture this spec needs already has a
role-gated application route, so no test-only bypass is required. Every
form, released form, traveler, and binder a run creates is archived by its
owner once its scenario finishes (research.md Decision 8). The app has no
permanent-delete route for these records, so archiving is the cleanup
mechanism. See research.md for the full set of technology decisions and their
rationale.

## Technical Context

**Language/Version**: JavaScript (Node.js 18+ host-side; the app's own Docker image runs Node 20-alpine — see `Dockerfile`)

**Primary Dependencies**: `@playwright/test` (new devDependency) — no other new dependency is needed; fixture provisioning reuses the app's own authenticated HTTP routes via Playwright's built-in `request` (APIRequestContext) fixture rather than a second database client

**Storage**: N/A directly — this feature introduces no new storage layer; all fixture state changes go through the running app's existing MongoDB-backed routes, exercising the app's own validation and authorization

**Testing**: `@playwright/test`'s own test runner, assertions, and reporters — this feature *is* the testing framework being added, alongside the existing `mocha`-based `test-unit/` suite (unaffected, unrelated npm script)

**Target Platform**: Host-side Node process (developer machine) driving a real Chromium browser against the already-running local Docker Compose stack's host-exposed `WEB_PORT`; no process runs inside a container

**Project Type**: Test-automation suite alongside the existing web-service app (web + API servers) — not a new deployable

**Performance Goals**: N/A in the traditional request-latency sense — bounded by SC-006 (full suite completes in under ~15 minutes)

**Constraints**: Must not start/stop/reconfigure any Docker container (FR-001); must resolve all ports and credentials from `.env` at run time, not hardcoded (FR-002); needs two real, pre-existing LDAP-backed identities rather than one plus role-toggling, because a form's review approval is checked against the *acting session's own user id* inside its review requests, not only against a role (spec User Story 1, Acceptance Scenarios 3–4; research.md Decision 4); cross-run data isolation via unique per-scenario identifiers, since there is no container-lifecycle "reset" available (FR-008)

**Scale/Scope**: 6 user stories / 29 acceptance scenarios (spec.md)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Evaluation

| Principle | Status | Notes |
|---|---|---|
| I. Lifecycle State Machine (NON-NEGOTIABLE) | PASS | This feature's entire purpose is exercising the Form and Traveler state machines through their real, validated `stateTransition` paths (spec User Stories 1–2) — it adds no code that could bypass them. |
| II. Permission-Layered Access Control | PASS | Fixture provisioning goes through the same `req-utils.js`-guarded routes real users hit (research.md Decision 2), so fixture setup exercises the permission hierarchy rather than routing around it — a stronger fit with this principle than a database-bypass approach would have been. User Story 4 directly regression-tests the hierarchy itself. |
| III. Two-Server Separation | PASS | The suite drives only the session-authenticated web app (spec Assumptions); the basic-auth REST API (`routes/api.js`) is untouched and undriven by this suite. |
| IV. Composable Model Features | N/A | No model or schema changes — this feature is test tooling only. |
| V. Minimal, Build-Free Frontend | PASS | No frontend code is added or changed; `e2e/` is test tooling, not shipped UI, and needs no build step of its own beyond Playwright's own CLI. |

No gate violations. No complexity tracking required.

### Post-Design Re-check

| Principle | Status | Notes |
|---|---|---|
| I. Lifecycle State Machine (NON-NEGOTIABLE) | PASS | Design confirmed: `us1-form-lifecycle.spec.js` and `us2-traveler-lifecycle.spec.js` assert every transition in `model/form.js`'s and `model/traveler.js`'s `stateTransition` tables that the spec's acceptance scenarios name, driven exclusively through the app's own routes. |
| II. Permission-Layered Access Control | PASS | Confirmed via research.md Decision 2's route-by-route verification: every fixture need in User Story 3 maps to an existing, role-gated route (`PUT /users/:id`, `PUT /groups/:id/addmember/:user`, the `/share/` routes, `PUT /travelers/:id/status`, the form review/release routes) — no test-only endpoint or direct database write was added anywhere in the design. |
| III. Two-Server Separation | PASS | No change since pre-design. |
| IV. Composable Model Features | N/A | No change since pre-design. |
| V. Minimal, Build-Free Frontend | PASS | No change since pre-design. |

No gate violations after design. No complexity tracking required.

## Project Structure

### Documentation (this feature)

```text
specs/005-playwright-e2e-tests/
├── plan.md                          # This file (/speckit-plan command output)
├── research.md                      # Phase 0 output (/speckit-plan command)
├── data-model.md                    # Phase 1 output (/speckit-plan command)
├── quickstart.md                    # Phase 1 output (/speckit-plan command)
├── contracts/                       # Phase 1 output (/speckit-plan command)
│   └── fixture-routes.md
└── tasks.md                         # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
e2e/                              # NEW — Playwright suite
├── README.md                     # setup/run/debug/writing-a-test guide (written during implementation; quickstart.md covers the same ground for this design phase)
├── playwright.config.js          # baseURL from resolved .env ports, trace/video/screenshot-on-failure, HTML+JSON reporters
├── global-setup.js               # checks the web app is reachable, logs in as E2E_USER and E2E_USER2 once via /ldaplogin/, saves each session's storageState
├── fixtures/
│   ├── env.js                    # resolves WEB_PORT/API_PORT ports and E2E_USER(2)/E2E_PASS(2) from .env, same convention docker.md already documents for ports
│   ├── auth-state.js             # the two saved sessions; specs default to the primary persona, opt into the secondary via test.use({ storageState: SECONDARY_AUTH_STATE })
│   ├── api-client.js             # fixture helpers that call the app's own authenticated routes (contracts/fixture-routes.md): grantRole, removeRole, setGroupMembership, shareWithUser, shareWithGroup, setPublicAccess, setTravelerStatus, createReleasedForm, transferOwnership, and cleanOut (archive-only cleanup routes)
│   ├── artifact-registry.js      # records every form, released form, traveler, and binder a run creates (data-model.md, Created Artifact); persists to e2e/.auth/ so a crash leaves a trail (research.md Decision 8)
│   └── run-id.js                 # runId(), a per-scenario unique tag for data isolation (research.md Decision 5)
├── global-teardown.js            # safety net: archives anything still pending in the artifact registry after all scenarios finish, dependents first; reports failures under FR-015
├── us1-form-lifecycle.spec.js               # User Story 1 (spec.md) — form authoring, review, release, archive
├── us2-traveler-lifecycle.spec.js           # User Story 2 — traveler creation, data entry, completion, freeze
├── us3-fixture-provisioning.spec.js         # User Story 3 — exercises fixtures/api-client.js directly
├── us4-access-control.spec.js               # User Story 4 — the layered permission model
├── us5-binder-management.spec.js            # User Story 5 — binder membership and its own share behavior
└── us6-failure-diagnostics.spec.js          # User Story 6 — a deliberately-failing scenario asserting diagnostics are produced

playwright-report/                # gitignored — HTML + JSON reporter output (data-model.md's Run Report)
test-results/                     # gitignored — Playwright's default trace/video/screenshot working directory
e2e/.auth/                        # gitignored — saved storageState files (session cookies), never committed
```

No changes to `lib/`, `model/`, `routes/`, or `views/` — this feature is
purely additive test tooling. `package.json` gains one devDependency
(`@playwright/test`) and one script (`"e2e": "playwright test"`, run from
`e2e/playwright.config.js`). `.gitignore` gains `playwright-report/`,
`test-results/`, and `e2e/.auth/`. This repo has no `.env.example` today;
`docker.md`'s existing `.env` documentation gains a
short section for the four new variables (`E2E_USER`, `E2E_PASS`,
`E2E_USER2`, `E2E_PASS2`) alongside its existing `WEB_PORT`/`API_PORT`
guidance, rather than introducing a new file convention.

**Structure Decision**: Single new top-level `e2e/` directory, mirroring the
existing top-level `test-unit/` (mocha) directory — consistent with this
repo's pattern of one top-level directory per test type/tool.

## Complexity Tracking

*No Constitution Check violations — this section is not applicable.*
