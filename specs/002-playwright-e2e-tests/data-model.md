# Phase 1 Data Model: Automated Playwright E2E Test Suite

**Feature**: `002-playwright-e2e-tests` | **Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

This feature introduces no changes to the application's own data model
(`model/*.js`). The entities below are artifacts of the *test suite itself* —
concretizing the Key Entities named in the spec into the shapes the
implementation will actually pass between Playwright test code and the
fixture CLI (Decision 2 in research.md).

## Test Scenario

A Playwright test file corresponding to one spec user story (and, within it,
one `test()`/`test.describe()` block per Acceptance Scenario).

| Field | Type | Notes |
|---|---|---|
| `runId` | string | Unique per suite invocation (e.g. timestamp + short random suffix), generated once in global setup and threaded through every scenario via a Playwright fixture |
| `scenarioName` | string | Maps 1:1 to an Acceptance Scenario in spec.md (e.g. `US1-AS3-cecs-disposition-request`) |
| `personaUsed` | enum: `primary` \| `secondary` | Which of the two configured identities (Decision 4) drives this scenario's browser actions |
| `fixturesRequired` | Test Fixture Request[] | Zero or more fixture requests this scenario provisions before acting |

**Rule**: every NCR (or other document) a scenario creates MUST embed
`runId` in at least one uniquely-filterable field (e.g.
`part_number: "BRK-${runId}"`, `wbs_number: "WBS-${runId}"`) so assertions can
scope queries/UI filters to only the data this scenario created (Decision 5 —
cross-run isolation).

## Test Fixture Request

The JSON payload a Playwright test passes to the fixture CLI
(`docker compose exec -T web node e2e/fixtures/cli.js <command> '<json>'`).

| Field | Type | Notes |
|---|---|---|
| `command` | enum | One of: `grant-role`, `set-ce-cs`, `add-group-member`, `remove-group-member`, `backdate-ncr`, `create-traveler-linked-ncr`, `get-ncr`, `get-user`, `get-group`, `reset-user-roles` |
| `userId` | string | Target user id (`_id` in the `users` collection) for role/group commands |
| `ncrId` | string | Target NCR id for NCR-scoped commands |
| `payload` | object | Command-specific data (e.g. `{ role: "manager" }`, `{ ceCsId: "..." }`, `{ groupId: "ncr-qa" }`, `{ daysAgo: 31 }`) |

**Output contract**: every command prints a single line of JSON to stdout on
success (`{ "ok": true, ...resultFields }`) and exits non-zero with a single
line of JSON to stderr on failure (`{ "ok": false, "error": "..." }`) — see
[contracts/fixture-cli.md](./contracts/fixture-cli.md) for the full command
reference.

## Notification Verification

The result of checking the mail catcher for a specific NCR event's outbound
email(s), built from Mailpit's API response (Decision 3).

| Field | Type | Notes |
|---|---|---|
| `eventType` | string | The NCR event type this verification corresponds to (e.g. `notification.disposition_request`, `notification.initial`) |
| `toAddresses` | string[] | Addresses found in the message's `To` field |
| `ccAddresses` | string[] | Addresses found in the message's `Cc` field |
| `subject` | string | Raw subject line, for substring assertions (e.g. contains the NCR number) |
| `bodyContains` | string[] | The set of expected substrings/facts a test asserts are present in the body (NCR number, part name, supplier, originator name, etc.) — not an exact-match comparison |
| `matchedMessageId` | string | Mailpit's message id, used to fetch the full body for `bodyContains` checks |

**Rule**: lookups poll Mailpit's search endpoint with a bounded retry/backoff
(handles async SMTP delivery — see spec Edge Cases) rather than a fixed
`sleep`, and always scope the search query by the scenario's `runId`-tagged
NCR number so a lookup can never match another scenario's email.

## Run Report

The consolidated output of a full or partial suite execution — produced
natively by Playwright's reporters (no custom schema to build), but the
following fields are what the suite's documentation (quickstart.md) promises
a person can rely on finding:

| Field | Source | Notes |
|---|---|---|
| Per-scenario pass/fail | Playwright HTML reporter (`playwright-report/index.html`) | One row per `test()`, grouped by file/describe block (= user story) |
| Overall summary | Playwright HTML/JSON reporter | Total passed/failed/skipped, wall-clock duration |
| Failure diagnostics | Playwright trace/video/screenshot artifacts, linked from the HTML report | Only produced for failed tests (`retain-on-failure` policy — see research.md Decision 6) |
| Machine-readable summary | Playwright JSON reporter output (e.g. `playwright-report/results.json`) | For any future CI or scripted consumption; out of scope to build a consumer for in this feature |

## Relationships

```
Test Scenario ──creates 0..N──> Test Fixture Request ──executed by──> fixture CLI (inside `web` container)
Test Scenario ──drives──> browser (Playwright) ──acts on──> running app (host-exposed WEB_PORT)
Test Scenario ──produces 0..N──> Notification Verification ──queries──> Mailpit API (host-exposed MAIL_PORT)
Suite run ──aggregates all Test Scenarios──> Run Report
```
