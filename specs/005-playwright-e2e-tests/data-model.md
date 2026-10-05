# Phase 1 Data Model: Automated Playwright E2E Test Suite

**Feature**: `005-playwright-e2e-tests` | **Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

This feature introduces no changes to the application's own data model
(`model/*.js`). The entities below are artifacts of the *test suite itself*
— concretizing the Key Entities named in the spec into the shapes the
implementation will actually pass between Playwright test code and the
route-based fixture helpers (research.md Decision 2).

## Test Scenario

A Playwright test file corresponding to one spec user story (and, within it,
one `test()`/`test.describe()` block per Acceptance Scenario).

| Field | Type | Notes |
|---|---|---|
| `runId` | string | A fresh timestamp+random suffix generated per scenario (not one shared value for the whole suite run), so two scenarios *within the same run* never collide on a shared tag; see `e2e/fixtures/run-id.js` |
| `scenarioName` | string | Maps 1:1 to an Acceptance Scenario in spec.md (e.g. `US1-AS3-reviewer-approves`) |
| `personaUsed` | enum: `primary` \| `secondary` | Which of the two configured identities (research.md Decision 4) drives this scenario's browser actions; a scenario may use both (e.g. owner acts as primary, reviewer as secondary) |
| `fixtureActions` | Fixture Action[] | Zero or more route calls this scenario provisions before acting |
| `createdArtifacts` | Created Artifact[] | Every form, released form, traveler, or binder this scenario created; cleaned out when the scenario finishes (FR-013) |

**Rule**: every form, traveler, or binder a scenario creates MUST embed
`runId` in its title (and tags, where the entity supports them) so
assertions can scope queries/UI filters to only the data this scenario
created (research.md Decision 5 — cross-run isolation).

## Fixture Action

One authenticated HTTP call a Playwright test's fixture helper makes against
the running app, per contracts/fixture-routes.md, using a persona's saved
`storageState`.

| Field | Type | Notes |
|---|---|---|
| `helper` | enum | One of: `grantRole`, `removeRole`, `setGroupMembership`, `createGroup`, `shareWithUser`, `shareWithGroup`, `setPublicAccess`, `transferOwnership`, `setTravelerStatus`, `createReleasedForm` (the multi-step sequence in contracts/fixture-routes.md) |
| `actingPersona` | enum: `primary` \| `secondary` | Whose saved session performs the call — must already hold whatever role/ownership the target route requires (e.g. `admin` for `grantRole`, document ownership for the `/share/` routes) |
| `targetType` | enum: `Form` \| `Traveler` \| `Binder` \| `User` \| `Group` | The entity the call acts on |
| `targetId` | string | The target document/user/group id |
| `payload` | object | Helper-specific request body (e.g. `{ role: "manager" }`, `{ name: "<AD display name>", access: "write" }`) |

**Output contract**: unlike a purpose-built fixture CLI, there is no custom
JSON success/failure envelope — each helper asserts the real route's HTTP
status (per contracts/fixture-routes.md) and either returns the relevant
response field or throws, failing the calling test with a clear message
naming which fixture call failed.

**Rule**: `grantRole`/`shareWithUser`/`shareWithGroup`/`setGroupMembership`
(add) are called only as the `primary` persona, since it is the one
configured with the `admin` role (research.md Decision 4); a scenario that
needs a *different* acting owner first uses `transferOwnership` or simply
creates the document as that persona in the first place.

## Created Artifact

A form, released form, traveler, or binder a run created. Recorded in a
run-scoped registry as soon as the creating call succeeds, so cleanup can
find it even if the scenario fails part-way (research.md Decision 8).

| Field | Type | Notes |
|---|---|---|
| `kind` | enum: `form` \| `releasedForm` \| `traveler` \| `binder` | Selects the archive route (contracts/fixture-routes.md, Cleanup routes) |
| `id` | string | The record's id, as returned by the creating route |
| `title` | string | Includes the run's `runId`, so the record can be found by title if the id is lost |
| `ownerPersona` | enum: `primary` \| `secondary` | Whose session must perform the archive call |
| `scenarioName` | string | The scenario that created it, for the run report |
| `dependsOn` | string[] | Ids of artifacts this one depends on or contains (a binder's travelers, a traveler's released form); drives dependents-first ordering |
| `cleanupStatus` | enum: `pending` \| `archived` \| `failed` | `failed` entries are listed in the run report under FR-015 |
| `cleanupError` | string? | The route's error message, when `cleanupStatus` is `failed` |

**Rule**: `archived` is set only after the archive route returns a success
status. A `failed` entry stays in the registry, so the global teardown sweep
can retry it, and the run report names it if it still fails.

## Run Report

The consolidated output of a full or partial suite execution — produced
natively by Playwright's reporters (no custom schema to build), documented
here as what quickstart.md promises a person can rely on finding.

| Field | Source | Notes |
|---|---|---|
| Per-scenario pass/fail | Playwright HTML reporter (`playwright-report/index.html`) | One row per `test()`, grouped by file/describe block (= user story) |
| Overall summary | Playwright HTML/JSON reporter | Total passed/failed/skipped, wall-clock duration |
| Failure diagnostics | Playwright trace/video/screenshot artifacts, linked from the HTML report | Only produced for failed tests (`retain-on-failure` policy — research.md Decision 6) |
| Cleanup failures | The suite's own list of Created Artifacts with `cleanupStatus: failed` | Listed separately from scenario results, identified by id and title (FR-015) |
| Machine-readable summary | Playwright JSON reporter output (`playwright-report/results.json`) | For any future CI or scripted consumption; out of scope to build a consumer for in this feature |

## Relationships

```
Test Scenario ──performs 0..N──> Fixture Action ──calls──> an existing app route (contracts/fixture-routes.md)
Test Scenario ──creates 0..N──> Created Artifact ──archived by──> cleanup route, as ownerPersona (contracts/fixture-routes.md)
Test Scenario ──drives──> browser (Playwright) ──acts on──> running app (host-exposed WEB_PORT)
Suite run ──aggregates all Test Scenarios──> Run Report (includes Created Artifacts with cleanupStatus: failed)
```

No "Notification Verification" entity is defined for this feature (unlike
the `002-playwright-e2e-tests` reference suite) — see research.md Decision 3
and spec.md's Assumptions: no workflow on this branch sends outbound
notification email yet.
