# Feature Specification: Automated Playwright E2E Test Suite for NCR Workflow

**Feature Branch**: `002-playwright-e2e-tests`

**Created**: 2026-08-09

**Status**: Draft

**Input**: User description: "design and implement an approach to do e2e test with playwright in the local docker setup. The e2e tests should be equivalent to the tests described in `test-e2e`."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Automated Verification of NCR Creation and Submission Notifications (Priority: P1)

A developer who just changed NCR creation logic or the notification emails
wants to know, in one command, whether the core "create an NCR → CE/CS and QA
Admin get notified" flow still works — without opening a browser, manually
filling a form, and eyeballing an inbox. They run the suite against their
already-running local Docker stack and get a pass/fail result covering NCR
creation, field validation, and both outbound notification emails (recipients,
CC, content, and delivery status).

**Why this priority**: This is the highest-traffic, most failure-prone part of
the workflow (it touches form validation, NCR-number generation, group lookup,
and email delivery all at once) and is the one most recently and repeatedly
changed. It is also the most tedious part of the existing manual suite to
verify by hand (`test-e2e/us1-create-and-submit-ncr.md` and
`us1.5-send-initial-notification.md`), since it requires cross-referencing a
mail catcher UI and the database by eye.

**Independent Test**: Can be fully tested by running only this scenario
against a running local stack — it creates its own NCR, and its pass/fail
result does not depend on any other scenario having run first.

**Acceptance Scenarios**:

1. **Given** the local Docker stack is running, **When** the suite runs the NCR
   creation scenario, **Then** it submits a new NCR through the same form
   fields a person would use, and confirms the NCR is created with a valid
   generated NCR number and "Submitted" status
2. **Given** an NCR creation attempt with missing or invalid mandatory fields,
   **When** the suite submits it, **Then** it confirms the submission is
   rejected with field-level validation messages and no NCR is created
3. **Given** an NCR was just submitted with a designated CE/CS, **When** the
   suite checks the mail catcher, **Then** it confirms an engineering
   disposition request email exists addressed TO the CE/CS with the Originator
   CC'd, and the body contains the NCR number, part name, supplier, originator
   name, and a working link to the NCR
4. **Given** an NCR was just submitted, **When** the suite checks the mail
   catcher, **Then** it confirms an initial notification email exists addressed
   TO each member of the ncr-qa group with the Originator CC'd, and the body
   contains the NCR number, part name, supplier, originator name, CE/CS name,
   and the problem description
5. **Given** both notification emails were sent, **When** the suite inspects
   the NCR's event log, **Then** it confirms delivery status and a delivery
   timestamp are recorded independently for every TO recipient and every CC
   recipient
6. **Given** the ncr-qa group has no members configured, **When** the suite
   attempts to submit an NCR, **Then** it confirms the submission fails with
   the configured error message rather than silently succeeding with no QA
   notification

---

### User Story 2 - Automated Verification of the Full Approval Lifecycle (Priority: P1)

A developer wants confidence that a change anywhere in the disposition →
QA concurrence → approver coordination → closure → final distribution chain
hasn't broken any step of the pipeline, end to end, in a single run.

**Why this priority**: This is the core value-delivering path of the entire
application — an NCR that never reaches Closed status with a correct audit
trail is a broken product. Today, verifying this whole chain requires running
four separate manual browser scripts in sequence
(`us2-ce-cs-disposition.md`, `us3-qa-concurrence-and-approver-coordination.md`,
`us5-ncr-issuance-and-execution.md`, `us6-final-distribution-and-closure-archive.md`)
and manually carrying state (the NCR id, its current status) between them.
Second only to creation itself — without a working disposition-through-closure
path, nothing created by User Story 1 can ever be resolved.

**Independent Test**: Can be fully tested by driving one NCR it creates itself
through every lifecycle transition (disposition, concurrence, approval or
direct final approval, closure) and confirming each transition's recorded
state and notification, independent of any other scenario.

**Acceptance Scenarios**:

1. **Given** a Submitted NCR assigned to a CE/CS, **When** the suite submits an
   engineering disposition (parts disposition, root cause, preventive actions,
   and rework/repair instructions when required), **Then** it confirms the NCR
   transitions to "Dispositioned" and a QA notification is recorded
2. **Given** a Dispositioned NCR, **When** the suite records QA concurrence
   with no additional approvers, **Then** it confirms the NCR transitions
   directly to "Final Approval" and an issuance notification is recorded
3. **Given** a Dispositioned NCR, **When** the suite records QA concurrence
   with one or more designated approvers, **Then** it confirms the NCR
   transitions to "Approved" and an approval-request notification is recorded
   for each designated approver
4. **Given** an Approved NCR, **When** the suite has an approver return it for
   comment, **Then** it confirms the NCR transitions to "Returned for Comment"
   and, after QA resubmits it, back to "Approved"
5. **Given** an NCR in "Final Approval" status, **When** the suite closes it
   with closure notes, **Then** it confirms the NCR transitions to "Closed",
   a closure record is persisted, and a final-distribution notification is
   recorded for the required recipient groups
6. **Given** a Traveler-linked NCR reaches closure, **When** the suite attempts
   to close it without the Traveler sign-off confirmation, **Then** it confirms
   closure is blocked, and succeeds once the confirmation is supplied

---

### User Story 3 - Programmatic Test Fixture Provisioning (Priority: P1)

Someone running the suite for the first time, or in a freshly reset local
environment, should not have to manually open a database browser and hand-edit
documents (grant a role, set a CE/CS id, add a group member) before the tests
will pass. The suite provisions whatever preconditions each scenario needs by
itself.

**Why this priority**: Several existing manual tests are only runnable today
because a person has already followed the "Test fixture setup: roles and
assignments" steps in `test-e2e/README.md` by hand (granting `qa_staff`/
`manager` roles, setting `ce_cs_id` on an NCR, adding a user to the `ncr-qa`
group, backdating an NCR for aging tests). Without automating this, the suite
cannot run unattended, which defeats the purpose of an automated suite.

**Independent Test**: Can be fully tested by provisioning each fixture type in
isolation (role grant, CE/CS assignment, group membership, backdated NCR,
Traveler-linked NCR) and confirming the resulting database state matches what
manual editing would have produced, without any other scenario depending on
it.

**Acceptance Scenarios**:

1. **Given** a test user needs a role (e.g. QA Staff membership via the
   ncr-qa group, or a manager role) for a scenario, **When** the suite
   provisions that fixture, **Then** the required role/group membership exists
   before the scenario's steps run and is not left over from a previous run in
   a way that changes the outcome
2. **Given** a scenario needs a specific user assigned as CE/CS on an NCR
   (something the creation form does not expose as a real lookup), **When**
   the suite provisions that fixture, **Then** the NCR's `ce_cs_id` is set to
   that user before disposition is attempted
3. **Given** a scenario needs an NCR aged more than 30 days for an escalation
   check, **When** the suite provisions that fixture, **Then** the NCR's
   creation date is backdated accordingly before the dashboard is checked
4. **Given** a scenario needs a Traveler-linked NCR (not obtainable through the
   creation page), **When** the suite provisions that fixture, **Then** an NCR
   with `traveler_link.initiated_from_traveler = true` exists before the
   closure scenario runs
5. **Given** the suite has finished a run, **When** the next run starts,
   **Then** fixtures and NCRs created by the previous run do not cause the new
   run's scenarios to fail or produce ambiguous results (e.g. two NCRs
   matching a search filter that expects exactly one)

---

### User Story 4 - Automated Verification of Reporting, Dashboard, and Preventive Action Tracking (Priority: P2)

A developer changing the dashboard filters, aging/escalation logic, or
preventive-action tracking wants automated confirmation those still work,
equivalent to `us4-track-and-report.md` and `us7-preventive-action-tracking.md`.

**Why this priority**: Important for catching regressions but lower risk of
silent data-integrity failure than the creation and approval-lifecycle paths —
these are primarily read/filter/status-tracking surfaces.

**Independent Test**: Can be fully tested using NCRs and preventive actions the
scenario provisions or creates itself, checking dashboard counts/filters and
preventive-action lifecycle transitions independently of other scenarios.

**Acceptance Scenarios**:

1. **Given** NCRs exist across multiple statuses, **When** the suite loads the
   dashboard, **Then** it confirms status counts match the actual number of
   NCRs in each status
2. **Given** NCRs with distinct part numbers, suppliers, dates, and disposition
   types, **When** the suite applies each dashboard filter, **Then** it
   confirms only matching NCRs are returned
3. **Given** an NCR backdated more than 30 days, **When** the suite loads the
   dashboard, **Then** it confirms that NCR is flagged for escalation
4. **Given** a Dispositioned NCR with preventive actions, **When** the suite
   assigns an owner and target date to a preventive action, **Then** it
   confirms the owner-assignment notification is sent and recorded
5. **Given** a preventive action has an assigned owner, **When** the suite
   updates its status and then closes it, **Then** it confirms each transition
   is recorded with a status-history entry and the action reaches "Completed"

---

### User Story 5 - Automated Verification of Access Control and Input Validation (Priority: P2)

A developer wants confirmation that role-gated actions and input validation
rules are still enforced after a change, equivalent to
`supplementary-access-control-and-validation.md`.

**Why this priority**: A security/data-integrity regression here (e.g. a role
check silently removed) is high-impact but the acceptance surface is narrower
and less frequently touched than the core workflow paths.

**Independent Test**: Can be fully tested by attempting each restricted action
as an unauthorized user and each invalid input as any user, independent of
other scenarios' NCR state.

**Acceptance Scenarios**:

1. **Given** a user without the required role for a given NCR action (e.g.
   submitting disposition, recording QA concurrence, approving), **When** the
   suite attempts that action on their behalf, **Then** it confirms the
   request is rejected with an authorization error and no state change occurs
2. **Given** a request for an NCR id that does not exist, **When** the suite
   makes that request, **Then** it confirms a not-found response is returned
3. **Given** a request with invalid or out-of-range field values (e.g.
   non-positive quantity, future discovery date, missing required field),
   **When** the suite submits it, **Then** it confirms the request is rejected
   with a validation error identifying the offending field

---

### User Story 6 - Failure Diagnostics and Consolidated Run Report (Priority: P2)

Someone reviewing a failed run — locally or looking at a teammate's failure —
wants to understand what broke without re-running the suite interactively
themselves.

**Why this priority**: Without this, a failing automated suite is only
marginally better than the manual one, since diagnosing *why* it failed would
still require reproducing the failure by hand.

**Independent Test**: Can be fully tested by deliberately forcing one scenario
to fail and confirming the produced artifacts are sufficient to identify the
failing step and its cause without re-running.

**Acceptance Scenarios**:

1. **Given** a scenario fails partway through, **When** the run finishes,
   **Then** a diagnostic artifact (at minimum: which step failed, the expected
   vs. actual outcome, and a visual capture of the page state at failure)
   is saved and referenced in the run output
2. **Given** a suite run completes (with any mix of pass/fail), **When** a
   person reviews the output, **Then** they can see a per-scenario pass/fail
   result and an overall summary without reading raw tool logs
3. **Given** a person wants to re-check just one scenario, **When** they invoke
   the suite for that scenario alone, **Then** only that scenario runs and
   reports its own result

---

### Coverage Mapping

Every existing manual test file has an automated equivalent among the six
user stories above (satisfies FR-003 / SC-002):

| Existing file (`test-e2e/`) | Automated equivalent |
|---|---|
| `us1-create-and-submit-ncr.md` | User Story 1 (AS1, AS2) |
| `us1.5-send-initial-notification.md` | User Story 1 (AS3–AS6) |
| `us1.6-request-engineering-disposition.md` (superseded — folded into US1.5) | User Story 1 (AS3) |
| `us2-ce-cs-disposition.md` | User Story 2 (AS1) |
| `us3-qa-concurrence-and-approver-coordination.md` | User Story 2 (AS2–AS4) |
| `us5-ncr-issuance-and-execution.md` | User Story 2 (AS5, AS6) |
| `us6-final-distribution-and-closure-archive.md` | User Story 2 (AS5) |
| `us4-track-and-report.md` | User Story 4 (AS1–AS3) |
| `us7-preventive-action-tracking.md` | User Story 4 (AS4, AS5) |
| `supplementary-access-control-and-validation.md` | User Story 5 (AS1–AS3) |
| *(fixture setup steps in `README.md`)* | User Story 3 (all) |

---

### Edge Cases

- What happens when the local Docker stack (web app, database, mail catcher)
  is not running when the suite starts? The suite must fail fast with a clear
  message identifying the unreachable dependency, rather than hanging on a
  timeout or producing misleading scenario failures.
- What happens when `.env` overrides the default ports (as documented in
  `test-e2e/README.md`, e.g. `WEB_PORT=3201`)? The suite must resolve the
  actual ports at run time rather than assuming defaults.
- What happens when an outbound notification email has not yet arrived at the
  mail catcher at the moment the suite checks (async delivery)? The suite must
  wait/retry within a bounded time rather than either failing immediately on a
  race or hanging indefinitely.
- What happens when two suite runs execute back-to-back against the same
  shared local database without a reset in between? Data created by the first
  run must not cause the second run's assertions (e.g. "exactly one NCR
  matches this filter") to become false.
- What happens when a scenario that depends on a fixture from User Story 3
  (e.g. CE/CS assignment) runs before that fixture exists? The dependency must
  be explicit so the scenario provisions or requests its own fixture rather
  than silently failing on missing preconditions.
- What happens when the `ncr-qa` group is unexpectedly empty or missing at
  suite start (a real deploy-time misconfiguration the spec already accounts
  for)? At least one scenario (User Story 1, Acceptance Scenario 6) must
  verify this failure path explicitly rather than only the happy path.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The suite MUST execute against the existing local Docker Compose
  stack (web app, database, mail catcher, LDAP) without itself starting,
  stopping, or reconfiguring any container
- **FR-002**: The suite MUST resolve environment configuration (web/API/
  mongo-express/mail-catcher ports and login credentials) from the local
  environment configuration at run time rather than from hardcoded values, so
  it works against non-default port assignments
- **FR-003**: The suite MUST provide automated coverage equivalent to each of
  the scenarios currently documented in `test-e2e/*.md`, with a documented
  mapping from each existing manual test file to its automated equivalent
- **FR-004**: The suite MUST programmatically provision every test fixture
  that the existing manual suite requires a human to create by hand (role
  grants, CE/CS assignment, ncr-qa group membership, backdated NCRs,
  Traveler-linked NCRs), so no scenario depends on manual database editing
- **FR-005**: The suite MUST verify outbound notification emails (TO
  recipients, CC recipients, subject, key body content, and delivery status)
  by querying the mail-catcher service directly rather than requiring a human
  to visually inspect an inbox
- **FR-006**: The suite MUST verify NCR event-log entries (event type, actor,
  per-recipient delivery status and timestamp for both TO and CC) directly
  against stored data, not only against what is rendered in the UI
- **FR-007**: The suite MUST report a pass/fail result for each scenario and
  an overall summary for the run
- **FR-008**: The suite MUST capture failure diagnostics (at minimum: the
  failing step, expected vs. actual outcome, and a visual capture of page
  state) for any scenario that fails, sufficient to diagnose the failure
  without re-running interactively
- **FR-009**: The suite MUST avoid cross-run interference — data created by
  one run MUST NOT cause a subsequent run's scenarios to produce incorrect
  pass/fail results
- **FR-010**: The suite MUST be runnable via a single command from the
  repository root, covering the full scenario set by default
- **FR-011**: The suite MUST support running any single scenario in isolation,
  equivalent to running one existing `test-e2e/*.md` file today
- **FR-012**: The suite MUST fail with a clear, specific error when a
  prerequisite (the web app, the database, or the mail catcher) is
  unreachable at start, rather than proceeding into misleading scenario
  failures
- **FR-013**: The suite MUST run unattended — no scenario may require a
  browser extension, an AI agent, or a human driving the browser during
  execution
- **FR-014**: The suite MUST authenticate against the same login mechanism
  used by the existing manual suite (session login via the configured test
  credentials) rather than bypassing authentication

### Key Entities *(include if feature involves data)*

- **Test Scenario**: An automated, independently runnable equivalent of one
  existing `test-e2e/*.md` file; has its own setup/fixture requirements, a
  sequence of actions against the running app, and a set of assertions
  against both UI state and underlying stored data
- **Test Fixture**: A precondition provisioned programmatically before a
  scenario runs (a role grant, a CE/CS assignment, group membership, a
  backdated NCR, a Traveler-linked NCR) — replaces the manual mongo-express
  edits described in the existing suite's README
- **Notification Verification**: A check against the mail-catcher service's
  captured messages for a given NCR event — recipients (TO and CC), subject,
  key body fields, and delivery confirmation
- **Run Report**: The consolidated output of a suite execution — per-scenario
  pass/fail, an overall summary, and links to any failure diagnostics produced

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A person can execute the full regression suite with a single
  command against an already-running local stack and receive a pass/fail
  result for every scenario, without opening a browser or a database browser
  by hand
- **SC-002**: Every scenario currently documented across the 10 files in
  `test-e2e/` has a corresponding automated scenario covering the same
  acceptance criteria
- **SC-003**: Running the full suite twice in a row against the same running
  stack, with no manual cleanup in between, produces the same pass/fail
  outcome both times
- **SC-004**: When a scenario fails, a person can identify the failing step
  and the expected-vs-actual mismatch from the produced report and
  diagnostics alone, without re-running the suite
- **SC-005**: A person unfamiliar with the suite can set it up and execute it
  for the first time, following documented setup steps, in under 15 minutes
  (assuming the Docker stack is already running)
- **SC-006**: The full suite completes within a bounded, predictable time
  (target: under 15 minutes) so it is practical to run after every
  significant change rather than only occasionally

## Assumptions

- The local Docker Compose stack (web app, database, mongo-express, mail
  catcher, LDAP) is already running before the suite is invoked, per the same
  prerequisite documented in `test-e2e/README.md`; the suite does not manage
  container lifecycle.
- Playwright is the browser-automation tool used to build this suite, per the
  feature request; specific configuration, project structure, and version
  choices are determined during planning, not in this specification.
- Environment configuration (ports, test credentials) continues to come from
  the local `.env` file, consistent with the existing manual suite — the same
  `E2E_USER`/`E2E_PASS` and port variables are reused, not replaced.
- Data isolation between runs is achieved by scoping each run's created data
  distinctly (e.g. unique identifying values per run) rather than requiring a
  full database reset before every run, since resetting the shared local
  database is outside this feature's control.
- The mail-catcher service already used by the manual suite (captures
  outbound SMTP on the Docker network) remains the mechanism for verifying
  email; the suite queries it programmatically rather than rendering its web
  UI.
- LDAP-backed authentication, as already configured for local Docker
  development, is the authentication path exercised; CAS and other auth
  strategies are out of scope for this suite.
- The existing `test-e2e/*.md` manual scripts remain in place as
  human-readable reference documentation after this suite exists; deciding
  whether to eventually retire them is a separate, future decision and out of
  scope here.
- This suite targets local developer execution, as stated in the feature
  request ("in the local docker setup"); wiring it into a CI pipeline is out
  of scope for this specification.
