# NCR Workflow — Browser E2E Test Suite

These test cases exercise the Nonconformance Report (NCR) workflow through the
actual rendered UI, using the **Claude in Chrome** browser extension as the
executor. Each file is a self-contained script: Claude drives the browser
step-by-step, and a human then works through the "Human Verification
Checklist" at the end to confirm the run actually did what it claims.

These are **not** automated/asserting tests (no Playwright/Cypress code) —
they are structured natural-language scripts, because the goal is a real
browser session a human can watch and double-check, not a CI gate.

## How to run a test file

Each test file is self-contained: its "Test Steps for Claude in Chrome"
section already includes reading `.env` for the real ports and writing the
report — you don't need to add any of that yourself, just point Claude at
the file. Requires the **Claude in Chrome** browser extension installed and
connected (Claude will prompt you to connect it on first use if it isn't
already).

These test files do not produce a video or screenshot artifact. Both were
tried and dropped: OS-level screen recording (`screencapture -v`) captures
the physical display, and the browser Claude drives isn't reliably on it
(on this machine it recorded nothing but the desktop background); saving
individual screenshots to disk (`save_to_disk`) reported success but the
files were never found anywhere on the accessible filesystem. Verification
relies on the step-by-step results in the report and the human independently
re-checking the app per the "Human Verification Checklist," not on a replay
artifact.

### Running in Claude Code Desktop app

1. Open the Claude Code desktop app with this repo as the project.
2. In the chat, tell it which file to run, e.g.:
   > Run `test-e2e/us1-create-and-submit-ncr.md` end to end using Claude in
   > Chrome.
3. Approve the Chrome-extension connection prompt and any tool-use
   confirmations if asked.
4. Claude reads the file's Setup + Test Steps sections itself, drives the
   browser, and leaves the markdown report in `test-e2e/results/`.

### Running in Claude Code CLI

1. From a terminal, `cd` into this repo and start Claude Code:
   ```bash
   claude
   ```
2. Give it the same instruction as above, referencing the file by path:
   ```
   Run test-e2e/us1-create-and-submit-ncr.md end to end using Claude in Chrome.
   ```
   Or run it non-interactively:
   ```bash
   claude -p "Run test-e2e/us1-create-and-submit-ncr.md end to end using Claude in Chrome."
   ```
3. Approve any permission prompts for the browser tools or for writing to
   `test-e2e/results/`.

### After either method

1. Compare what happened against the file's "Expected Results" section.
2. Go through "Human Verification Checklist" yourself — re-check the final
   state in the browser (and in mongo-express, where noted) independently of
   what Claude reports, since Claude's summary of its own actions is not a
   substitute for you looking at the actual page/data.

## Prerequisites

- The Docker stack must already be running (`docker compose up`) before executing
  any test — do not start or stop containers as part of a test run.
- **Ports are not fixed** — `docker-compose.yml` reads them from a local
  `.env` file (gitignored, not the same as the repo's `.env.example`, which
  only documents NCR-specific settings and doesn't set these port vars),
  falling back to defaults only if unset: `WEB_PORT` (default `3001`),
  `API_PORT` (default `3002`), and `MONGO_EXPRESS_PORT` (default `8081`).
  **Check your own `.env` before running any test** and substitute the real
  port everywhere a test file says `localhost:3001` / `localhost:8081` — a
  repo checkout can easily be running on non-default ports (e.g.
  `WEB_PORT=3201`, `MONGO_EXPRESS_PORT=8281`) if these are overridden to
  avoid colliding with another instance of this app on the same machine.
  - Web app: `http://localhost:${WEB_PORT-3001}`
  - API (Basic Auth): `http://localhost:${API_PORT-3002}`
  - Mongo Express (DB browser): `http://localhost:${MONGO_EXPRESS_PORT-8081}`
    — login `traveler` / `travelerpass` (per `docker-compose.yml`; this
    credential pair is not overridden by `.env`)
- Login credentials set in `.env` as `E2E_USER` (username) and `E2E_PASS`
  (password). Each test's Session Setup step reads these from `.env` and logs
  in automatically if not already authenticated. The dev/test auth backend is
  whatever `docker/auth.json` points at (LDAP in the default docker-compose
  setup) — `E2E_USER`/`E2E_PASS` must be valid credentials for that backend.
- Know your own login username (`E2E_USER`). It is the `_id` of your document
  in the `users` collection, and it is what appears as `originator_id` /
  `actor_id` / `approver_id` throughout the NCR data model. The tests below
  refer to this as `<your-username>`.

## Test fixture setup: roles and assignments

Several NCR actions are role-gated or assignee-gated **at the service layer**,
not just hidden in the UI, so — per `lib/ncr-service.js` — the fastest way to
set up test fixtures is often to edit MongoDB directly via mongo-express
rather than hunting for a "make me QA staff" button, because none exists yet
(role assignment is out of scope for this feature and expected to come from
the org's identity system in production). All edits below are made in the
`traveler` database.

- **Grant a role to your test user** (`users` collection, document
  `_id: "<your-username>"`): edit the `roles` array to include the role you
  need for a given test, e.g. `["qa_staff"]` or `["manager"]`. Multiple roles
  can coexist in the array.
- **Assign yourself as CE/CS on an NCR**: the standalone NCR creation page
  only captures a free-text `ce_cs_name` — it does **not** set `ce_cs_id`
  (there is no lookup/typeahead wired to a real user id on that field today).
  Submitting a disposition requires `ncr.ce_cs_id === <your-username>`
  (`lib/ncr-service.js` `submitDisposition`), so after creating the test NCR,
  open it in the `ncrs` collection in mongo-express and set
  `ce_cs_id: "<your-username>"` on that document before attempting the
  disposition test. This is called out again in the test that needs it.
- **Backdate an NCR for aging/escalation tests**: edit `created_at` on an
  `ncrs` document to a date more than 30 days in the past.
- **Traveler-linked NCR**: the standalone NCR creation page has no
  Traveler-linking fields by design (see `specs/001-ncr-workflow/spec.md`,
  "Future Work: eTraveler UI Integration" — that integration hasn't been
  built). To test the Traveler sign-off requirement at closure (spec User
  Story 5, Acceptance Scenario 5), create the NCR via a direct API call
  instead of the UI, as shown in `us5-ncr-issuance-and-execution.md`.

## Conventions used in each test file

- **Setup** — starting state required (roles, existing NCRs, fixture edits).
- **Test Steps for Claude in Chrome** — the literal instructions to hand to
  Claude. Steps reference visible page text/labels, not CSS selectors or
  code, since that's what a browser-driving agent actually sees.
- **Expected Results** — what should be true immediately after each step,
  written so a mismatch is obvious.
- **Human Verification Checklist** — a checkbox list a human runs through
  independently (re-reading the page, re-querying mongo-express, etc.) to
  confirm the automated run's claims.

## Test index

One file per user story in `specs/001-ncr-workflow/spec.md`, in spec order,
plus one supplementary test for cross-cutting requirements that don't
belong to any single user story.

| User Story (spec.md) | File | Covers |
|---|------|--------|
| US1 — Create and Submit Nonconformance Report | `us1-create-and-submit-ncr.md` | Standalone NCR creation, all 4 acceptance scenarios, confirms no Traveler-link fields exist on the page |
| US1.5 — Send Initial Notification | `us1.5-send-initial-notification.md` | Verifies the `notification.initial` event and its actual recipient list against the spec's required QA/Group Leader/Division Director audience |
| US1.6 — Request Engineering Disposition | `us1.6-request-engineering-disposition.md` | CE/CS disposition-request notification (via API-created NCR, since the creation page can't set `ce_cs_id`); also checks Originator Delegate assignment (AS4/AS5) |
| US2 — CE/CS Performs Engineering Disposition | `us2-ce-cs-disposition.md` | Disposition form fields, Rework/Repair-requires-instructions validation, full submission |
| US3 — QA Concurrence and Approver Coordination | `us3-qa-concurrence-and-approver-coordination.md` | All 9 acceptance scenarios: no-approvers path, with-approvers path, approve, return-for-comment, QA resubmit, and the QA "Reject" scenario (AS9) |
| US4 — Track and Report on Nonconformances | `us4-track-and-report.md` | Dashboard status counts, filters (Part Number/Root Cause/Date/Disposition), 30+ day escalation flag, "average time in workflow" check (AS1) |
| US5 — NCR Issuance and Execution | `us5-ncr-issuance-and-execution.md` | Standalone closure (AS1-4) and Traveler-linked closure sign-off requirement (AS5, via API-created NCR) |
| US6 — Final NCR Distribution and Closure Archive | `us6-final-distribution-and-closure-archive.md` | Final-distribution recipient groups vs. the spec's 5 required groups, archive search/exclusion behavior |
| US7 — Preventive Action Tracking and Management | `us7-preventive-action-tracking.md` | PA capture, owner assignment + notification, status updates, closure, and the AS5 completion-notification check |
| *(supplementary)* | `supplementary-access-control-and-validation.md` | Cross-cutting Security/Access Control and Data Management requirements (FR-057–065): wrong-role 403s via browser console `fetch`, 404s, validation errors — not tied to one user story |

Run them roughly in spec order — several build on state (an existing NCR in
a particular status) created by an earlier test. A few of these tests are
written to actively surface gaps between the spec's acceptance criteria and
the current implementation (e.g. initial-notification recipients, Originator
Delegate assignment, QA rejection, final-distribution recipient groups,
preventive-action completion notification) — where a test's "Expected
Results" section says to expect something *not* to work, that's the test
doing its job, not an error in the test itself.
