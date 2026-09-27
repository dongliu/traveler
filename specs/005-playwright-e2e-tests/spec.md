# Feature Specification: Automated Playwright E2E Test Suite for the Local Docker Stack

**Feature Branch**: `005-playwright-e2e-tests`

**Created**: 2026-09-27

**Status**: Draft

**Input**: User description: "design and implement an approach to do e2e test with playwright in the local docker setup. check the artifacts for the spec `specs/002-playwright-e2e-tests` in `124-traveler-input-ncr-gating` branch."

> **Note**: `124-traveler-input-ncr-gating` is a sibling feature branch that added an
> NCR (non-conformance report) workflow on top of this application, and its own
> `specs/002-playwright-e2e-tests` designed and built a Playwright suite for that
> combined app. This branch does not include the NCR workflow, so this spec adapts
> the same proven approach — driving the running local Docker stack with Playwright,
> provisioning fixtures programmatically, and producing a pass/fail run report — to
> this repository's own workflows: form authoring/release, traveler data entry and
> approval, and the shared permission model.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Automated Verification of the Form Authoring and Release Lifecycle (Priority: P1)

A developer who just changed the form builder or the review/release logic wants
to know, in one command, whether the core "author a draft form → submit it for
review → release it" pipeline still works — without manually clicking through
the form builder and re-checking every state transition by hand.

**Why this priority**: This is the entry point to the entire system — a
traveler cannot be created until a form has been released. The underlying
state machine (draft → under review → released → archived) is one of this
project's constitutional, non-negotiable principles, making a silent
regression here the highest-impact failure this suite can catch.

**Independent Test**: Can be fully tested by creating its own draft form with a
small set of fields, driving it through review and release, and confirming
each transition and the resulting released-form snapshot — independent of any
other scenario.

**Acceptance Scenarios**:

1. **Given** an authenticated user, **When** they create a new draft form with
   at least one input field and save it, **Then** the form exists in "draft"
   status with the fields as entered.
2. **Given** a draft form, **When** its owner submits it for review, **Then**
   the form transitions to "under review" and appears in the assigned
   reviewer's review queue.
3. **Given** a form under review, **When** a reviewer approves and releases
   it, **Then** the form transitions to "released" and a released-form
   snapshot is created capturing its current fields.
4. **Given** a released form, **When** the underlying draft form is later
   edited, **Then** the previously released snapshot remains unchanged.
5. **Given** a draft form missing a mandatory field (e.g. no title), **When**
   a user attempts to submit it for review, **Then** the submission is
   rejected with field-level validation messages and the form remains in
   "draft".
6. **Given** a released form, **When** its owner archives it, **Then** the
   form transitions to "archived" and no longer appears in the active
   released-forms list.

---

### User Story 2 - Automated Verification of the Traveler Data-Entry and Approval Lifecycle (Priority: P1)

A developer wants confidence that a change anywhere in the traveler creation →
data entry → submission → review → approval chain hasn't broken any step, end
to end, in a single run.

**Why this priority**: This is the core value-delivering path of the entire
application — a released form that can never become a completed, approved
traveler is a broken product. Second only to the form pipeline itself, and
exercises the traveler state machine, the other non-negotiable constitutional
principle.

**Independent Test**: Can be fully tested by creating its own traveler
instance from a released form, filling in the required data entries, and
driving it through submission, review, and approval, confirming each
transition's recorded state — independent of any other scenario.

**Acceptance Scenarios**:

1. **Given** a released form, **When** a user creates a new traveler instance
   from it, **Then** the traveler exists in "not started" status with the
   fields copied from the released form.
2. **Given** a traveler in progress, **When** a user enters data for a
   required input, **Then** the value, the entering user, and the entry
   timestamp are recorded and the traveler is/remains "in progress".
3. **Given** a traveler with all required fields completed, **When** its
   owner submits it for review, **Then** it transitions to "submitted for
   review".
4. **Given** a traveler submitted for review, **When** a reviewer approves
   it, **Then** it transitions to "approved".
5. **Given** an approved traveler, **When** it is frozen, **Then** it
   transitions to "frozen" and its data entries can no longer be edited.
6. **Given** a traveler missing a required data entry, **When** a user
   attempts to submit it for review, **Then** the submission is rejected
   identifying the missing field, and the traveler remains "in progress".

---

### User Story 3 - Programmatic Test Fixture Provisioning (Priority: P1)

Someone running the suite for the first time, or against a freshly reset local
environment, should not have to open a database browser and hand-edit
documents (grant a role, add a reviewer, pre-create a released form) before
the tests will pass.

**Why this priority**: Without automated fixture provisioning the suite
cannot run unattended, which defeats the purpose of an automated suite. Every
other scenario in this spec depends on some precondition (a role, a document
already sitting in a given state or access configuration) that this story
must be able to produce on demand.

**Independent Test**: Can be fully tested by provisioning each fixture type in
isolation (a role grant, a pre-released form, a share/access grant on a
document, a traveler pre-positioned in a given lifecycle state) and confirming
the resulting state matches what manual setup would have produced, without any
other scenario depending on it.

**Acceptance Scenarios**:

1. **Given** a test user needs a role (e.g. admin, manager, or reviewer) for a
   scenario, **When** the suite provisions that fixture, **Then** the
   required role exists before the scenario's steps run.
2. **Given** a scenario needs a form already sitting in "released" status
   (skipping the authoring/review UI), **When** the suite provisions that
   fixture, **Then** a released form and its snapshot exist before the
   scenario begins.
3. **Given** a scenario needs a document (form, traveler, or binder) shared
   with a specific user, shared with a group, or made public, **When** the
   suite provisions that fixture, **Then** the document's access
   configuration is set accordingly before the scenario begins.
4. **Given** a scenario needs a traveler already in a specific lifecycle
   status (e.g. "submitted for review"), **When** the suite provisions that
   fixture, **Then** the traveler exists in that status without the scenario
   having to drive every prior UI step itself.
5. **Given** the suite has finished a run, **When** the next run starts,
   **Then** fixtures and documents created by the previous run do not cause
   the new run's scenarios to fail or produce ambiguous results (e.g. two
   forms matching a search filter that expects exactly one).

---

### User Story 4 - Automated Verification of Access Control (Priority: P2)

A developer wants confirmation that the shared owner → reviewer → shared-with
→ shared-group → public-access permission hierarchy is still enforced after a
change touching routes or middleware.

**Why this priority**: A silently broken permission check is high-impact — it
can expose sensitive work documents — but the surface it covers is narrower
than the two core lifecycle chains above, and it changes less often.

**Independent Test**: Can be fully tested by attempting a restricted action as
a user without the corresponding grant, and a permitted action as a user with
exactly one layer of the hierarchy granted, independent of other scenarios'
data.

**Acceptance Scenarios**:

1. **Given** a user with no access to a private form, traveler, or binder,
   **When** they attempt to view or edit it, **Then** the request is rejected
   or the document is not shown to them.
2. **Given** a document shared with a specific user, **When** that user
   accesses it, **Then** they can view (and edit, if granted) it, while a
   different, non-shared user still cannot.
3. **Given** a document shared with a group the current user belongs to,
   **When** that user accesses it, **Then** access is granted on the same
   basis as a direct per-user share.
4. **Given** a document with public access enabled, **When** any
   authenticated user accesses it, **Then** access is granted without an
   explicit owner, reviewer, or share grant.
5. **Given** a user with the admin role, **When** they access a document they
   neither own nor have been granted access to, **Then** access is granted on
   the basis of the admin role.

---

### User Story 5 - Automated Verification of Binder Management (Priority: P2)

A developer wants confirmation that grouping travelers into binders, and the
access rules that apply to a binder as a collection, still work after a
change.

**Why this priority**: Binders are a distinct, real entity in the system, but
see less traffic and change less often than the form and traveler lifecycles.

**Independent Test**: Can be fully tested by creating its own binder and
traveler(s), adding and removing travelers from it, and verifying the
resulting contents and the binder's own access behavior, independent of other
scenarios.

**Acceptance Scenarios**:

1. **Given** one or more existing travelers, **When** a user creates a new
   binder and adds them to it, **Then** the binder lists exactly those
   travelers.
2. **Given** a binder, **When** a traveler is removed from it, **Then** the
   binder no longer lists that traveler.
3. **Given** a binder shared with a user, a group, or made public, **When**
   that access path is exercised, **Then** it behaves the same as User Story
   4's access-control checks, applied to a binder instead of a form or
   traveler.

---

### User Story 6 - Failure Diagnostics and Consolidated Run Report (Priority: P2)

Someone reviewing a failed run — locally, or looking at a teammate's failure —
wants to understand what broke without re-running the suite interactively
themselves.

**Why this priority**: Without this, a failing automated suite is only
marginally better than no suite at all, since diagnosing *why* it failed would
still require reproducing the failure by hand.

**Independent Test**: Can be fully tested by deliberately forcing one scenario
to fail and confirming the produced artifacts are sufficient to identify the
failing step and its cause without re-running.

**Acceptance Scenarios**:

1. **Given** a scenario fails partway through, **When** the run finishes,
   **Then** a diagnostic artifact (at minimum: which step failed, the
   expected vs. actual outcome, and a visual capture of the page state at
   failure) is saved and referenced in the run output.
2. **Given** a suite run completes (with any mix of pass/fail), **When** a
   person reviews the output, **Then** they can see a per-scenario pass/fail
   result and an overall summary without reading raw tool logs.
3. **Given** a person wants to re-check just one scenario, **When** they
   invoke the suite for that scenario alone, **Then** only that scenario runs
   and reports its own result.

---

### Edge Cases

- What happens when the local Docker stack (web app, database) is not running
  when the suite starts? The suite must fail fast with a clear message
  identifying the unreachable dependency, rather than hanging on a timeout or
  producing misleading scenario failures.
- What happens when the external LDAP service the app depends on for login is
  unreachable (it runs alongside this stack but is not itself part of this
  repository's Docker Compose file)? The suite must fail fast identifying LDAP
  specifically, distinct from the web app being down.
- What happens when local port overrides are in effect (this repo's local
  setup documents overriding the web/API/database-admin ports)? The suite must
  resolve the actual ports at run time rather than assuming defaults.
- What happens when two suite runs execute back-to-back against the same
  shared local database without a reset in between? Data created by the first
  run must not cause the second run's assertions (e.g. "exactly one form
  matches this filter") to become false.
- What happens when a scenario that depends on a fixture from User Story 3
  (e.g. a pre-released form) runs before that fixture exists? The dependency
  must be explicit so the scenario provisions or requests its own fixture
  rather than silently failing on a missing precondition.
- What happens when optional device-input configuration is absent, as it is by
  default in this local setup? Device-linked input scenarios are out of scope
  for this suite rather than failing on a missing optional feature.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The suite MUST execute against the existing local Docker Compose
  stack (web app, database) without itself starting, stopping, or
  reconfiguring any container.
- **FR-002**: The suite MUST resolve environment configuration (application
  ports and login credentials) from the local environment configuration at
  run time rather than from hardcoded values, so it works against non-default
  port assignments.
- **FR-003**: The suite MUST provide automated coverage of the form
  authoring/release lifecycle, the traveler data-entry/approval lifecycle, and
  the shared permission hierarchy — the areas this project's governing
  principles treat as non-negotiable.
- **FR-004**: The suite MUST programmatically provision every test fixture a
  scenario needs (role grants, pre-released forms, pre-positioned lifecycle
  states, share/access grants), so no scenario depends on manual database
  editing.
- **FR-005**: The suite MUST authenticate using the same session-based login
  mechanism the application uses in its local Docker setup, rather than
  bypassing authentication.
- **FR-006**: The suite MUST report a pass/fail result for each scenario and
  an overall summary for the run.
- **FR-007**: The suite MUST capture failure diagnostics (at minimum: the
  failing step, expected vs. actual outcome, and a visual capture of page
  state) for any scenario that fails, sufficient to diagnose the failure
  without re-running interactively.
- **FR-008**: The suite MUST avoid cross-run interference — data created by
  one run MUST NOT cause a subsequent run's scenarios to produce incorrect
  pass/fail results.
- **FR-009**: The suite MUST be runnable via a single command from the
  repository root, covering the full scenario set by default.
- **FR-010**: The suite MUST support running any single scenario or file in
  isolation.
- **FR-011**: The suite MUST fail with a clear, specific error when a
  prerequisite (the web app, the database, or the login service) is
  unreachable at start, rather than proceeding into misleading scenario
  failures.
- **FR-012**: The suite MUST run unattended — no scenario may require a
  browser extension, an AI agent, or a human driving the browser during
  execution.

### Key Entities *(include if feature involves data)*

- **Test Scenario**: An automated, independently runnable check of one
  user-facing workflow (form lifecycle, traveler lifecycle, access control,
  binder management, fixture provisioning, or diagnostics); has its own
  setup/fixture requirements, a sequence of actions against the running app,
  and assertions against both UI state and underlying stored data.
- **Test Fixture**: A precondition provisioned programmatically before a
  scenario runs — a role grant, a pre-released form, a document at a specific
  share/access configuration, or a traveler pre-positioned in a given
  lifecycle status — replacing manual database edits.
- **Run Report**: The consolidated output of a suite execution — per-scenario
  pass/fail, an overall summary, and links to any failure diagnostics
  produced.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A person can execute the full regression suite with a single
  command against an already-running local stack and receive a pass/fail
  result for every scenario, without opening a browser or a database browser
  by hand.
- **SC-002**: The suite covers, end to end, the form authoring/release
  lifecycle, the traveler data-entry/approval lifecycle, and the shared
  permission hierarchy, with at least one passing scenario per lifecycle
  transition and per access-control layer described in this spec.
- **SC-003**: Running the full suite twice in a row against the same running
  stack, with no manual cleanup in between, produces the same pass/fail
  outcome both times.
- **SC-004**: When a scenario fails, a person can identify the failing step
  and the expected-vs-actual mismatch from the produced report and
  diagnostics alone, without re-running the suite.
- **SC-005**: A person unfamiliar with the suite can set it up and execute it
  for the first time, following documented setup steps, in under 15 minutes
  (assuming the Docker stack is already running).
- **SC-006**: The full suite completes within a bounded, predictable time
  (target: under 15 minutes) so it is practical to run after every
  significant change rather than only occasionally.

## Assumptions

- The local Docker Compose stack (web app, database, database admin UI) is
  already running before the suite is invoked, along with the external LDAP
  login service this local setup depends on; the suite does not manage
  container lifecycle.
- Playwright is the browser-automation tool used to build this suite, per the
  feature request; specific configuration, project structure, and version
  choices are determined during planning, not in this specification.
- Environment configuration (ports, test credentials) comes from a local,
  git-ignored environment file, following this repository's existing
  convention for overriding default ports; a similar convention is used for
  the test-user credentials this suite needs.
- Data isolation between runs is achieved by scoping each run's created data
  distinctly (e.g. unique identifying values per run) rather than requiring a
  full database reset before every run, since resetting the shared local
  database is outside this feature's control.
- Session-based authentication against the LDAP service already configured
  for local Docker development is the login path exercised.
- No workflow in this branch currently sends outbound notification emails as
  part of form, traveler, or review actions — the mail-sending library exists
  as infrastructure but is not yet called from any route — so this suite does
  not include email-notification verification. This differs from the
  reference NCR suite (which verifies notification emails extensively) and
  should not preclude adding such coverage later if notification sending is
  introduced.
- Device-linked inputs (optional, disabled by default in this local setup)
  are out of scope for this suite.
- This suite targets local developer execution, as stated in the feature
  request ("in the local docker setup"); wiring it into a CI pipeline is out
  of scope for this specification.
- The session-authenticated web application is the surface under test; the
  separate basic-auth REST API server is a distinct interface to the same
  data and is not driven directly by this browser-based suite.
