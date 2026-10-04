# Feature Specification: Traveler-Driven NCR Input Flow and Live Status

**Feature Branch**: `125-traveler-ncr-input-flow`

**Created**: 2026-10-03

**Status**: Draft

**Continues**: `specs/123-traveler-ncr-input-linking` and
`specs/124-traveler-input-ncr-gating`. Their open-NCR rules (no submission
while an NCR is open, an input with an open NCR is not finished, the closure
PDF, active-only initiation) all still hold. This feature changes how a user
reaches those rules from the screen, and supersedes these parts of earlier
specs:

- `specs/124` User Story 1 and FR-001, FR-003, FR-004 (the reference-typing
  path and the copy-reference control) — **removed**.
- `specs/123` FR-001 and FR-002 (Initiate NCR only on inputs that already have
  a value) — **superseded**: Initiate NCR is offered on every input.
- `specs/124` FR-021 and User Story 4, scenario 7 (an open NCR does not stop
  a value being entered) — **superseded**: an open NCR hides the Input option
  until it is Closed.

**Input**: User description: "1) remove the `copy NCR reference` button from
traveler, and the input `Traveler Input` from the new NCR form. The user can
only initiate from inside a traveler if they want to integrate an NCR with a
traveler. 2) when a user is update a traveler, for each input for any type,
they have two option buttons, either `Input` or `Initiate NCR`. when Input is
click, the `Initiate NCR` disappears. After `input` is clicked, the user can
further update the input value and save it. 3) If an NCR is initiated, the user
do not see option for `input` until the NCR is closed. 3) a traveler can only be
submitted to review when all the associated NCRs are closed and all inputs have
values. The submit for completion only become valid when those conditions are
met. 4) We need a lightweight solution to show the `real time` status of an NCR.
we can achieve this by pulling the input and NCR status every 30 seconds on an
open active traveler page. An open NCR page should be refreshed every 30 seconds
as well."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Choose Input or Initiate NCR for Each Traveler Input (Priority: P1)

When a user updates an active traveler, every input on it — whatever its type
and whether or not it already has a value — shows two options: **Input** and
**Initiate NCR**. The user picks one. Choosing **Input** reveals the input's
editing controls and hides **Initiate NCR** for that input, so the user can
update the value and save it. Choosing **Initiate NCR** starts a nonconformance
report linked to that exact input.

**Why this priority**: This is the new way a user works through a traveler.
Every other rule in this feature depends on an input being either entered or
raised as an NCR, so this is the first slice to deliver.

**Independent Test**: Open an active traveler that has at least one text,
number, checkbox, radio, file, and rich-text input. Confirm each shows exactly
the two options and that its value cannot be changed until **Input** is
chosen. Choose **Input** on one, confirm **Initiate NCR** disappears for it,
change the value, save it, and confirm the input returns to showing both
options with the new value.

**Acceptance Scenarios**:

1. **Given** an active traveler, **When** a user views any input (empty or
   filled, of any type), **Then** the input shows an **Input** option and an
   **Initiate NCR** option, and its value cannot be changed yet
2. **Given** an input showing both options, **When** the user chooses
   **Input**, **Then** **Initiate NCR** is hidden for that input, the input's
   controls become editable, and Save and Reset are offered
3. **Given** an input in Input mode, **When** the user saves a value,
   **Then** the value is stored, the input is locked and completed: it offers
   neither **Input** nor **Initiate NCR**, and the traveler's finished-input
   figure is updated
4. **Given** an input in Input mode, **When** the user chooses Reset, **Then**
   the unsaved change is discarded, the stored value is shown, and both options
   return
5. **Given** an input in Input mode, **When** the user views the rest of the
   traveler, **Then** the other inputs' options are not usable until this one is
   saved or reset (one input is entered at a time)
6. **Given** an input with no value, **When** the user chooses **Initiate NCR**,
   **Then** the NCR creation form opens already linked to that input (see
   User Story 3) — no value is required first
7. **Given** a traveler that is not active (initialized, submitted, frozen,
   completed, or archived), **When** a user views it, **Then** neither option is
   offered, and the input values are read-only as they are today

---

### User Story 2 - An Input With an Open NCR Waits Until the NCR Is Closed (Priority: P1)

Once an NCR has been initiated against an input, the user no longer sees the
**Input** option for that input. The input stays on hold until every NCR linked
to it is Closed. Then **Input** comes back, so the input can be given a value.

**Why this priority**: It stops a value being changed while a nonconformance
against it is still being worked, and it makes the input's state readable at a
glance. It is needed alongside User Story 1 for the input flow to be correct.

**Independent Test**: On an active traveler, choose **Initiate NCR** on an input
and create the NCR. Confirm the input no longer offers **Input**, and that its
NCR is shown with its status. Close the NCR and confirm **Input** is offered
again on the input, with no page reload needed beyond the live refresh in
User Story 5.

**Acceptance Scenarios**:

1. **Given** an input has one linked NCR that is not Closed, **When** a user
   views the traveler, **Then** the input does not offer **Input**, shows the
   linked NCR with its current status, and is shown as waiting on an open NCR
2. **Given** an input has several linked NCRs and only some are Closed,
   **When** a user views the traveler, **Then** **Input** is still not offered
3. **Given** every NCR linked to the input is Closed (or has been removed),
   **When** a user next views the traveler, **Then** **Input** is offered again
   if the input has no saved value (a completed input stays locked), and the
   input counts as finished if it has a saved value
4. **Given** an input with no saved value has an open NCR, **When** a user views
   it, **Then** **Initiate NCR** is still offered, so an additional NCR can be
   raised
   against the same input
5. **Given** an input's only open NCR is removed by an administrator, **When**
   the traveler is next viewed, **Then** the input is no longer on hold

---

### User Story 3 - NCRs Are Started From Inside a Traveler Only (Priority: P1)

A user raises an NCR linked to a traveler input only from that input's
**Initiate NCR** action on the traveler. The standalone NCR creation form no
longer has a traveler field, and no copy-reference control is shown anywhere on
a traveler. An NCR created from the standalone form is never linked to a
traveler.

**Why this priority**: This is the removal requested first. It closes the
separate path where an NCR could be tied to a traveler by typing a reference,
so every traveler link is made from the traveler itself.

**Independent Test**: Open the standalone NCR creation form and confirm there
is no traveler input field. Open an active traveler and confirm no input has a
copy-reference control. From an input's **Initiate NCR** action, confirm the
form opens with the traveler and input shown as a fixed line of context, then
submit and confirm the NCR is linked to that input.

**Acceptance Scenarios**:

1. **Given** a user opens the standalone NCR creation form, **When** they
   review the form, **Then** there is no traveler input field and no way to
   enter a traveler reference
2. **Given** a user views any input on a traveler, **When** they look for a
   way to copy an NCR reference, **Then** none is offered
3. **Given** a user chooses **Initiate NCR** on an input, **When** the form
   opens, **Then** it shows the traveler's title and the input's label as a
   fixed line of context that the user cannot edit or clear
4. **Given** the form was opened from an input and is submitted, **When** the
   NCR is created, **Then** it is linked to that exact traveler and input, as
   it is today, and the link appears on the input and on the NCR
5. **Given** the standalone form is submitted, **When** the NCR is created,
   **Then** it has no traveler link, as it does today
6. **Given** the form was opened from an input but the traveler is no longer
   active when the user submits, **When** they submit, **Then** the NCR is not
   created and the message names the traveler's current status (existing rule,
   `specs/124` FR-011 and FR-012)

---

### User Story 4 - A Traveler Can Be Submitted Only When Its NCRs Are Closed and Every Input Has a Value (Priority: P1)

The **Submit for completion** action on an active traveler becomes available
only when two things are both true: every NCR linked to any input on the
traveler is Closed, and every input on the traveler has a saved value. While
either is not true, the action is disabled and the page explains what is
missing — the open NCRs, each with a link, and the inputs that have no value.
The same conditions are enforced when the submission is received, so the rule
cannot be bypassed.

**Why this priority**: This is the core quality control the whole feature
serves. Without it, a traveler can go forward for sign-off with unresolved
nonconformances or blank inputs.

**Independent Test**: On an active traveler with one empty input and one input
with an open NCR, confirm **Submit for completion** is disabled and lists both
problems. Enter a value for the empty input and close the NCR; once the page
refreshes, confirm the action is enabled and submission proceeds to the normal
approval.

**Acceptance Scenarios**:

1. **Given** an active traveler has an input with no saved value, **When** a
   user views it, **Then** **Submit for completion** is disabled and the page
   lists that input by its label as missing a value
2. **Given** an active traveler has a linked NCR that is not Closed, **When** a
   user views it, **Then** **Submit for completion** is disabled and the page
   lists each open NCR by number, status, input, with a link to it
3. **Given** an active traveler has an input in Input mode with unsaved
   changes, **When** a user views it, **Then** **Submit for completion** is
   disabled until that input is saved or reset
4. **Given** every input has a saved value and every linked NCR is Closed (or
   the traveler has no NCRs), **When** a user views it, **Then** **Submit for
   completion** is enabled and the traveler's other existing submission rules
   apply as before
5. **Given** a submission is sent while an NCR is open or an input has no
   value (for example from a stale page or the REST API), **When** the system
   receives it, **Then** the submission is refused, the traveler stays active,
   and the refusal lists the open NCRs and the inputs missing values
6. **Given** a traveler was sent back for more work, **When** it is submitted
   again, **Then** the same conditions apply in full
7. **Given** the user is an administrator or manager, **When** a condition is
   not met, **Then** the submission is refused exactly as for any other user —
   there is no override

---

### User Story 5 - Input and NCR Status on an Open Active Traveler Refreshes Every 30 Seconds (Priority: P2)

While an active traveler is open in a browser, the page pulls the current state
of its inputs and linked NCRs every 30 seconds and updates what is shown. A
user sees an NCR's status change, an input being saved by someone else, or the
**Submit for completion** action becoming enabled, without reloading the page
and without losing anything they are typing.

**Why this priority**: The rules in User Stories 2 and 4 are only as useful as
the page's picture of them. Without a refresh, a user who has just closed the
last NCR still sees the traveler held back until they reload. It is P2 because
the rules themselves are enforced on the server, so the refresh improves what
users see rather than what is allowed.

**Independent Test**: Open an active traveler in one browser and, in another,
close one of its linked NCRs and save a value on one of its inputs. Without
reloading the first browser, confirm that within 30 seconds the NCR status, the
input's state, and the **Submit for completion** availability have all updated.

**Acceptance Scenarios**:

1. **Given** an active traveler page is open, **When** 30 seconds pass, **Then**
   the page pulls the current input states and linked NCR statuses and updates
   what is shown, without a page reload
2. **Given** an NCR linked to the traveler changes status in another session,
   **When** the next refresh runs, **Then** the NCR's status shown on the input
   is the current one
3. **Given** another user saves a value on an input, **When** the next refresh
   runs, **Then** the input shows the saved value and counts toward finished
   inputs, unless this user is currently entering that same input
4. **Given** this user is entering a value on an input, **When** a refresh
   runs, **Then** what they have typed is not changed, and that input is updated
   once they save or reset
5. **Given** the traveler's status has changed away from active in another
   session, **When** the next refresh runs, **Then** the input options and
   **Initiate NCR** are no longer offered, and **Submit for completion** is not
   available
6. **Given** a refresh fails (for example, a brief loss of connection), **When**
   it fails, **Then** the page keeps the last state it showed, shows when it was
   last updated, and tries again at the next interval without raising an error
   message on each attempt
7. **Given** the browser tab is hidden, **When** the tab is not visible, **Then**
   refreshing pauses, and it runs once when the tab becomes visible again

---

### User Story 6 - An Open NCR Page Refreshes Every 30 Seconds (Priority: P2)

An NCR page that is open in a browser refreshes its displayed status and details
every 30 seconds, so the people following an NCR see its progress as it
happens. The refresh does not discard anything a user has typed or any dialog
they have open.

**Why this priority**: It completes the live status requested for NCRs,
mirroring User Story 5 from the NCR side. It is P2 because it is a visibility
improvement and does not change what can be done.

**Independent Test**: Open an NCR page in one browser and advance the NCR
(for example, record a disposition) in another. Without reloading the first
browser, confirm the new status and details appear within 30 seconds. Then
start typing a comment on the first page, advance the NCR again, and confirm the
typed text is still there when the refresh runs.

**Acceptance Scenarios**:

1. **Given** an NCR page is open, **When** 30 seconds pass, **Then** the page
   refreshes the NCR's status and displayed details without a full page reload
2. **Given** the NCR's status changes in another session, **When** the next
   refresh runs, **Then** the status shown is the current one, with the history
   of events updated to match
3. **Given** the user has unsaved text in a form or a dialog open on the NCR
   page, **When** a refresh runs, **Then** that text and dialog are not
   discarded, and that part of the page is refreshed once the user saves or
   closes it
4. **Given** the refresh fails, **When** it fails, **Then** the page keeps what
   it showed and tries again at the next interval, without raising an error
   message on each attempt
5. **Given** an NCR is Closed, **When** its page is open, **Then** it is still
   refreshed, so a PDF or closure record that is added later appears

---

### Edge Cases

- What happens when a traveler has no inputs? Every input has a value
  trivially, so the input part of the submission rule passes; the NCR part
  still applies.
- What happens when an input is saved with an empty value (blank text, or no
  option ticked)? It does not count as having a value. The input stays
  "missing a value" until something is entered.
- What happens when a user chooses **Initiate NCR** and then does not create
  the NCR? No NCR exists, so the input keeps both options. Nothing is recorded.
- What happens when a user chooses **Initiate NCR** and the NCR form is still
  open in another tab when the traveler page refreshes? The input's options
  change on the next refresh after the NCR is created, not when the form is
  opened.
- What happens when an input is in Input mode and the traveler is returned to
  another status by someone else? The refresh does not discard the unsaved
  entry, but the Input mode ends and the entry can no longer be saved, and the
  page says so.
- What happens to NCRs already linked to inputs through the removed reference
  path? They stay linked exactly as they are. Nothing is unlinked or migrated.
- What happens to travelers already submitted for completion? They are not
  re-checked against the new input rule (as `specs/124` already decided for the
  NCR rule). A traveler sent back for more work is checked again on its next
  submission.
- What happens when the NCR linked to an input is deleted by an administrator?
  It no longer counts as open. The input is no longer on hold (User Story 2,
  scenario 5).

## Requirements *(mandatory)*

### Functional Requirements

**Removing the reference path (User Story 3)**

- **FR-001**: The standalone NCR creation form MUST NOT show a traveler input
  field, or any other way to enter a traveler reference.
- **FR-002**: No traveler input MUST offer a control for copying an NCR
  reference.
- **FR-003**: An NCR MUST be linked to a traveler input only when it is started
  from that input's **Initiate NCR** action on the traveler.
- **FR-004**: The NCR creation form opened from **Initiate NCR** MUST show the
  traveler's title and the input's label as fixed context, which the user
  cannot edit or clear.
- **FR-005**: An NCR created from the standalone form MUST have no traveler link.
- **FR-006**: The traveler link on an NCR MUST be checked when the NCR is
  submitted, under the existing rules: the traveler must be active when the
  form is submitted (`specs/124` FR-009 to FR-012), and the user must have at
  least read access to the traveler (`specs/124` FR-008).

**Per-input choice (User Story 1)**

- **FR-007**: Every input on an active traveler MUST show two options,
  **Input** and **Initiate NCR**, whether or not it has a value, for every
  input type the traveler supports (including text, number, number with unit,
  rich text, checkbox, radio, checkbox set, and file upload).
- **FR-008**: An input's value MUST NOT be editable until the user chooses
  **Input** for it.
- **FR-009**: Choosing **Input** MUST hide **Initiate NCR** for that input and
  make its value editable, with Save and Reset available.
- **FR-010**: Saving MUST store the value and lock the input: once an input has a
  saved value it is completed, and it MUST offer neither **Input** nor
  **Initiate NCR**. Reset MUST discard unsaved changes and return the input to
  showing both options, unless it has a saved value or an open NCR applies
  (FR-013, FR-015).
- **FR-011**: Choosing **Initiate NCR** MUST open the NCR creation form linked to
  that input, as it does today.
- **FR-012**: Only one input MUST be in Input mode at a time. While one is, the
  options on the other inputs MUST NOT be usable.
- **FR-013**: **Initiate NCR** MUST be offered for every input that has no saved
  value, before **Input** is chosen. It is not offered once a value is saved
  (FR-010), and it is hidden while **Input** is in use. This supersedes
  `specs/123` FR-001 and FR-002, which offered it only after a value existed.
- **FR-014**: On a traveler that is not active, neither option MUST be offered.

**Open NCR holds the input (User Story 2)**

- **FR-015**: While an input has at least one linked NCR that is not Closed, the
  **Input** option MUST NOT be offered for it.
- **FR-016**: The **Input** option MUST be offered again once every NCR linked to
  the input is Closed or removed.
- **FR-017**: **Initiate NCR** MUST remain offered on an input that has an open
  NCR, so that another NCR can be raised.
- **FR-018**: An input with a linked NCR that is not Closed MUST NOT count as
  finished, even when it has a saved value (`specs/124` FR-017, unchanged).

**Submission (User Story 4)**

- **FR-019**: **Submit for completion** MUST be enabled only when all of the
  following are true: every NCR linked to any input on the traveler is Closed
  or removed; every input on the traveler has a saved, non-empty value; and no
  input is in Input mode with unsaved changes.
- **FR-020**: While any condition in FR-019 is not met, **Submit for completion**
  MUST be disabled, and the page MUST list each open linked NCR (number,
  status, input label, with a link) and each input that has no value (by
  label).
- **FR-021**: The system MUST refuse a submission for completion, whatever the
  route it arrives by (the traveler page or the REST API), while any condition
  in FR-019 is not met. The refusal MUST list the open NCRs and the inputs
  missing values.
- **FR-022**: The conditions in FR-019 and FR-021 MUST apply to every user,
  including administrators and managers, with no override.
- **FR-023**: The conditions MUST be checked at the moment of submission and
  again on resubmission after a traveler is sent back for more work.
- **FR-024**: The existing confirmation prompt for submitting a traveler with
  incomplete inputs MUST be replaced by the hard block in FR-019 and FR-021.
- **FR-025**: Once the conditions in FR-019 are met, the traveler's other existing
  submission and approval rules MUST apply unchanged.

**Live status on the traveler page (User Story 5)**

- **FR-026**: While an active traveler's page is open, the page MUST pull the
  current state of each input and of each linked NCR, and of the traveler's
  status, every 30 seconds, and update what is shown, without a full page
  reload.
- **FR-027**: A refresh MUST NOT change anything the user has typed, and MUST NOT
  change the value of an input the user is entering. Such an input MUST be
  updated after the user saves or resets it.
- **FR-028**: When a refresh shows the traveler is no longer active, the page
  MUST stop offering the input options and **Initiate NCR**, and MUST NOT offer
  **Submit for completion**.
- **FR-029**: The page MUST show when it was last refreshed. A failed refresh
  MUST keep the last state shown and MUST NOT raise an error message on each
  failed attempt.
- **FR-030**: Refreshing MUST pause while the browser tab is hidden and MUST run
  again when the tab becomes visible.
- **FR-031**: Pages of travelers that are not active MUST NOT refresh on this
  schedule.

**Live status on the NCR page (User Story 6)**

- **FR-032**: While an NCR page is open, the page MUST refresh the NCR's status
  and displayed details every 30 seconds, without a full page reload. This
  applies to NCRs of every status, including Closed.
- **FR-033**: A refresh MUST NOT discard unsaved text or an open dialog. Any part
  of the page that cannot be refreshed safely at that moment MUST wait until the
  user saves or closes it.
- **FR-034**: FR-029 and FR-030 MUST also apply to the NCR page.

### Key Entities *(include if feature involves data)*

- **Traveler input**: One named field on a traveler, with its type, label, saved
  value (if any), and its state: *no value*, *has value*, *waiting on an open
  NCR*, or *finished*. Its available options depend on the traveler's status
  and on the state of its linked NCRs.
- **Linked NCR**: An NCR associated with one traveler input, with a number, a
  status, and a closed/not-closed state. Its state decides whether the input
  offers **Input** (FR-015, FR-016) and whether the traveler may be submitted
  (FR-019).
- **Traveler submission state**: Whether **Submit for completion** is available,
  and if not, the list of open NCRs and inputs missing values that explain why
  (FR-019, FR-020).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On 100% of the NCR creation forms opened outside a traveler, there
  is no traveler field; on 100% of traveler inputs, there is no copy-reference
  control.
- **SC-002**: For every input type, 100% of active-traveler inputs show exactly
  two options before a choice is made, and 100% of inputs entered through
  **Input** can be saved or reset.
- **SC-003**: 0 travelers are submitted for completion while any linked NCR is
  not Closed or any input has no value, across the traveler page and the REST
  API; 100% of refused submissions list every cause.
- **SC-004**: After an NCR is closed or an input is saved elsewhere, the active
  traveler page shows the change within 30 seconds, without a reload, in 100%
  of trials.
- **SC-005**: After an NCR's status changes elsewhere, its page shows the new
  status within 30 seconds, and no text typed on the page is lost during a
  refresh in 100% of trials.
- **SC-006**: **Submit for completion** is enabled exactly when the conditions in
  FR-019 are met, and in every other case it is disabled with its reasons shown.

## Assumptions

- **"Submit to review"** in the request means the existing **Submit for
  completion** action, which moves an active traveler to submitted and into the
  review process.
- **Input options apply on active travelers only.** Values on other travelers
  stay read-only as they are today, and the options are not shown there.
- **A saved value completes its input.** A completed input is locked and offers
  neither option. Only a Reset before saving returns an input to showing both
  options. An input can be completed only once, so an NCR can be raised against an
  input only while it has no saved value.
- **Several NCRs may be raised against one input.** This keeps `specs/123`
  FR-008. Only the **Input** option is held back, per the request.
- **Server-side value saves are not blocked by an open NCR.** The request
  describes what the user sees, so FR-015 is enforced in the page. A direct
  save through the REST API while an NCR is open is still accepted. This
  supersedes `specs/124` FR-021 only for the page. If that is not wanted, it
  needs its own requirement.
- **The REST API keeps accepting a traveler link on NCR creation.** Integrations
  that link NCRs to traveler inputs programmatically keep working. Only the web
  form loses the traveler field.
- **"Input" count for the submission rule** is the set of inputs counted in the
  traveler's own input total (the "N inputs" figure on the traveler). Display-only
  elements are not inputs.
- **"Has a value" means a saved, non-empty value**, using the same saved data as
  the traveler's finished-input figure.
- **Live status uses a 30-second interval for both pages.** The interval is
  fixed, not user-configurable. The traveler page does not refresh once the
  traveler is no longer active, and the NCR page refreshes for any status.
- **The NCR seen from the traveler appears within one refresh.** Creating an NCR
  in another tab changes the input's options on the traveler page at its next
  refresh, not when the form is opened.
- **Existing data is unchanged.** NCRs already linked through the removed
  reference path stay linked, nothing is migrated, and travelers already
  submitted for completion are not re-checked.
- **Everything else in `specs/001-ncr-workflow`, `specs/122-admin-delete-ncrs`,
  and the closure PDF rules in `specs/124` stays unchanged.**
