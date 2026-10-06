# Feature Specification: Automated Playwright E2E Test Suite for the Local Docker Stack

**Feature Branch**: `005-playwright-e2e-tests`

**Created**: 2026-09-27

**Status**: Draft

**Input**: User description: "design and implement an approach to do e2e test with playwright in the local docker setup."

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
   a title and at least one input field, **Then** the form exists in "draft"
   status with the fields as entered.
2. **Given** a draft form, **When** its owner submits it for review and
   designates a user holding the reviewer role as a reviewer, **Then** the
   form transitions to "under review" and the request appears in that
   reviewer's queue.
3. **Given** a form under review, **When** its designated reviewer submits an
   approval, **Then** the approval is recorded for the form's current version,
   and once every designated reviewer has approved, the form's owner can
   release it — creating a released-form snapshot of its current fields and
   transitioning the form to "released".
4. **Given** a form under review with a designated reviewer, **When** that
   reviewer instead requests changes, **Then** the form reverts to "draft",
   its review requests are cleared, and it is not releasable until
   resubmitted and re-approved.
5. **Given** a released form, **When** someone attempts to edit its source
   form, **Then** the edit is rejected because a released form cannot be
   edited, and the released snapshot remains unchanged.
6. **Given** a new form submitted without a title, **When** a user attempts
   to create it, **Then** the creation is rejected and no form is saved.
7. **Given** a released form, **When** its owner archives it, **Then** the
   form transitions to "archived" and no longer appears in the active
   released-forms list.

---

### User Story 2 - Automated Verification of the Traveler Data-Entry and Completion Lifecycle (Priority: P1)

A developer wants confidence that a change anywhere in the traveler creation →
data entry → submission for completion → completion-approval chain hasn't
broken any step, end to end, in a single run.

**Why this priority**: This is the core value-delivering path of the entire
application — a released form that can never become a completed traveler is a
broken product. Second only to the form pipeline itself, and exercises the
traveler state machine, the other non-negotiable constitutional principle.

**Independent Test**: Can be fully tested by creating its own traveler
instance from a released form, filling in data entries, and driving it
through submission and completion, confirming each transition's recorded
state — independent of any other scenario.

**Acceptance Scenarios**:

1. **Given** a released form, **When** a user creates a new traveler instance
   from it, **Then** the traveler is created and the fields are copied from
   the released form.
2. **Given** an active traveler, **When** a user enters data for an input,
   **Then** the value, the entering user, and the entry timestamp are
   recorded.
3. **Given** an active traveler, **When** a user with write access to it
   submits it for completion, **Then** it transitions to "submitted for
   completion".
4. **Given** a traveler submitted for completion, **When** a user holding the
   admin or manager role approves it, **Then** it transitions to "completed";
   **When** such a user instead rejects it, **Then** it returns to "active".
5. **Given** a traveler submitted for completion, **When** a user who holds
   neither the admin nor the manager role attempts to approve or reject it,
   **Then** the request is rejected with an authorization error and the
   traveler remains "submitted for completion".
6. **Given** an active traveler, **When** an authorized user freezes it,
   **Then** it transitions to "frozen" and its data entries can no longer be
   edited; **When** it is later unfrozen, **Then** it returns to "active".

---

### User Story 3 - Programmatic Test Fixture Provisioning and Cleanup (Priority: P1)

Someone running the suite for the first time, or against a freshly reset local
environment, should not have to open a database browser and hand-edit
documents (grant a role, add a reviewer, pre-create a released form) before
the tests will pass. And once a run finishes, the forms, released forms,
travelers, and binders it created should be cleaned out of the active lists,
so repeated runs do not accumulate test data in the shared database.

**Why this priority**: Without automated fixture provisioning the suite
cannot run unattended, which defeats the purpose of an automated suite. Every
other scenario in this spec depends on some precondition (a role, a document
already sitting in a given state or access configuration) that this story
must be able to produce on demand. Cleanup is equally load-bearing: a suite
that leaves its own forms and travelers active in the shared database makes
every later run's list and filter assertions less reliable.

**Independent Test**: Can be fully tested by provisioning each fixture type in
isolation (a role grant, a pre-released form, a share/access grant on a
document, a traveler pre-positioned in a given lifecycle state), then
cleaning them up and confirming the resulting state matches what manual setup
and manual cleanup would have produced, without any other scenario depending
on it.

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
   status (e.g. "submitted for completion"), **When** the suite provisions
   that fixture, **Then** the traveler exists in that status without the
   scenario having to drive every prior UI step itself.
5. **Given** the suite has finished a run, **When** the next run starts,
   **Then** fixtures and documents created by the previous run do not cause
   the new run's scenarios to fail or produce ambiguous results (e.g. two
   forms matching a search filter that expects exactly one).
6. **Given** a scenario created one or more forms, released forms, travelers,
   or binders, **When** that scenario finishes — whether it passed or failed —
   **Then** every artifact it created is cleaned out (archived) before the next
   scenario that depends on the active lists starts.
7. **Given** a scenario fails partway through, **When** cleanup runs,
   **Then** it covers everything the scenario created up to the point of
   failure, so no artifact is left active because the scenario did not finish.
8. **Given** the artifacts a scenario created depend on one another (a binder
   that contains travelers, a traveler created from a released form), **When**
   cleanup runs, **Then** the dependent artifacts are cleaned out before the
   artifacts they depend on.
9. **Given** cleanup cannot clean out one of the artifacts (for example, the
   owning session is no longer valid), **When** the run finishes, **Then** the
   run report lists that artifact by its identifier and title, separately from
   scenario pass/fail results, so a person can clean it out by hand.
10. **Given** a run has finished, **When** a person lists the active forms,
    travelers, and binders filtered by that run's identifying tag, **Then** none
    appear, while the same records remain visible in the archived lists for
    inspection.

---

### User Story 4 - Automated Verification of Access Control (Priority: P2)

A developer wants confirmation that the layered permission model — public
access, ownership, blanket manager/admin roles, per-document sharing with a
user or a group, and (for forms specifically) a designated reviewer's access
to the form under review — is still enforced after a change touching routes
or middleware.

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
   explicit owner, role, or share grant.
5. **Given** a user with the admin or the manager role, **When** they access
   a document they neither own nor have been granted access to, **Then**
   access is granted on the basis of that role alone.

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
- What happens when the suite process is killed or crashes before cleanup
  finishes? The artifacts it left behind carry that run's identifying tag, so
  they are identifiable, never counted by a later run's assertions, and can be
  cleaned out by a later invocation that targets that tag.
- What happens when an artifact is still under review, or a traveler is still
  submitted for completion, at the time cleanup runs? Cleanup still cleans it
  out; the review requests and status of that artifact do not prevent it.

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
- **FR-013**: The suite MUST clean out every form, released form, traveler,
  and binder it creates once the scenario that created it finishes, whether
  that scenario passed or failed, acting through the session of the persona
  that owns each artifact.
- **FR-014**: Cleanup MUST retire records by archiving them — the
  application's own end-of-life state for forms, released forms, travelers,
  and binders. It MUST NOT permanently delete any record, because the
  application provides no supported way to do so for these records.
- **FR-015**: The suite MUST report, separately from scenario pass/fail
  results, any run-created artifact that cleanup could not clean out,
  identifying it by its identifier and title.

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
- **Created Artifact**: A form, released form, traveler, or binder a run
  created, recorded with its identifier, title, owning persona, and whether
  it has been cleaned out — the list cleanup works through once a scenario
  finishes.
- **Run Report**: The consolidated output of a suite execution — per-scenario
  pass/fail, an overall summary, links to any failure diagnostics produced,
  and any artifacts cleanup could not clean out.

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
- **SC-007**: After any completed run, a search for active (non-archived)
  forms, released forms, travelers, and binders carrying that run's
  identifying tag returns zero results, while every record the run created
  is still retrievable from the archived lists.

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
  database is outside this feature's control. Cleanup (User Story 3) keeps
  that data out of active lists once a run finishes, so the tag-based scoping
  is a safety net for interrupted runs rather than the main isolation
  mechanism.
- "Clean out" means archiving. The application offers no supported way to
  permanently delete forms, released forms, travelers, or binders; permanent
  deletion would require direct database writes outside the application,
  which this suite deliberately avoids. If permanent deletion is wanted later,
  that is a separate, explicit decision.
- Cleanup acts through the session of the persona that created and owns each
  artifact, because archiving is restricted to the owner (or an administrator,
  for some record types).
- Session-based authentication against the LDAP service already configured
  for local Docker development is the login path exercised.
- The manager and admin roles grant blanket write access across forms,
  travelers, and binders alike; a designated reviewer's access is scoped to
  the specific form(s) they were asked to review, not travelers or binders.
  This suite's access-control scenarios (User Story 4) test both the blanket
  roles and, within User Story 1, the form-specific reviewer grant, rather
  than treating "reviewer" as a fourth blanket role alongside manager/admin.
- No workflow in this branch currently sends outbound notification emails as
  part of form, traveler, or review actions — the mail-sending library exists
  as infrastructure but is not yet called from any route — so this suite does
  not include email-notification verification. It should not preclude adding
  such coverage later if notification sending is introduced.
- The suite has two test identities, so User Story 4's "a different,
  non-shared user still cannot" is proven with the secondary identity before a
  share is granted or after it is revoked. Proving exclusion of an unrelated
  third person would need a third LDAP test account, which this design does not
  assume.
- Device-linked inputs (optional, disabled by default in this local setup)
  are out of scope for this suite.
- This suite targets local developer execution, as stated in the feature
  request ("in the local docker setup"); wiring it into a CI pipeline is out
  of scope for this specification.
- The session-authenticated web application is the surface under test; the
  separate basic-auth REST API server is a distinct interface to the same
  data and is not driven directly by this browser-based suite.
