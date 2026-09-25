# Feature Specification: Traveler Input NCR Gating and Closure Record

**Feature Branch**: `124-traveler-input-ncr-gating`

**Created**: 2026-09-24

**Status**: Draft

**Continues**: `specs/123-traveler-ncr-input-linking/spec.md` — which lets a
user initiate an NCR from a filled-in traveler input and shows the linked
NCR's link and status on that input. This feature keeps all of that and adds:
(a) a second way to link an NCR to a traveler input — by typing or pasting a
reference on the NCR initiation form; (b) a rule that only *active* travelers
can have NCRs initiated against them; (c) two "an open NCR holds work back"
rules, one for the input and one for submitting the traveler for completion
approval; and (d) an
automatically produced PDF record of each closed NCR, attached back to the
traveler input it was raised against.

**Input**: User description: "The user can initiate an NCR from any traveler inpuyt now. On top of that, enable the following 1) when a user directly initiate an NCR, they can specify a traveler input from the initiation form. 2) the input should be in the format like `traveler_id::input_name`. To make that possible, the user can open a traveler and copy the string from any input. 3) when initiate an NCR from a traveler, the traveler must be in active status. 4) a traveler cannot be completed if any associated NCR is not closed. 5) a traveler input is not finished if any associated NCR is not closed. 6) when an NCR is closed, a pdf should be generated with the NCR details, and attatched to the traveler input."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Link a Directly-Initiated NCR to a Traveler Input by Reference (Priority: P1)

A quality inspector or engineer finds a nonconformance and opens the standard
NCR initiation form rather than starting from inside the traveler. They open
the relevant traveler in another tab, use a "copy reference" control on the
affected input to copy a short reference string in the form
`traveler_id::input_name`, and paste it into a "Traveler input" field on the
NCR initiation form. The form confirms which traveler and which input the
reference points to. On submission, the new NCR is linked to that exact
traveler input, exactly as if it had been initiated from the traveler itself.

**Why this priority**: This is the new entry path the whole request is built
around. Without it, an NCR raised from the standard form can never be tied to
a traveler input, and the gating rules in the later stories would only ever
apply to NCRs started from inside a traveler.

**Independent Test**: Can be fully tested by copying the reference from an
input on a traveler, pasting it into the NCR initiation form, submitting, and
confirming the new NCR is linked to that traveler and input (visible on both
the NCR and on the traveler input) — and by confirming that a malformed or
unresolvable reference is refused with a clear message and no NCR is created.

**Acceptance Scenarios**:

1. **Given** a user is viewing a traveler, **When** they look at any input on
   it, **Then** they can copy that input's reference in the format
   `traveler_id::input_name` with a single action, and the user is told the
   copy succeeded
2. **Given** a user has copied a valid reference, **When** they paste it into
   the traveler input field on the NCR initiation form, **Then** the form shows
   the traveler's title and the input's label the reference resolves to, so
   they can confirm it before submitting
3. **Given** a valid reference is entered and every other required NCR field
   is complete, **When** the user submits, **Then** the NCR is created linked
   to that exact traveler and input, with the input's label captured at
   creation time, and it appears on the traveler input and on the NCR detail
   page exactly as an NCR initiated from the traveler does today
4. **Given** the user initiates an NCR using the "Initiate NCR" action on a
   traveler input, **When** the NCR initiation form opens, **Then** the same
   traveler input field is already filled with that input's reference
5. **Given** the traveler input field is left blank, **When** the user
   submits, **Then** a standalone NCR is created exactly as it is today, with
   no traveler reference
6. **Given** a reference is malformed (no `::` separator, missing traveler
   identifier, missing input name) or points to a traveler or input that does
   not exist, **When** the user enters or submits it, **Then** they see a
   message saying what is wrong, and no NCR is created
7. **Given** every other existing NCR creation requirement (mandatory fields,
   CE/CS assignment, notification emails, per `specs/001-ncr-workflow`),
   **When** an NCR is initiated with a reference, **Then** all of them still
   apply unchanged

---

### User Story 2 - Only Active Travelers Can Have NCRs Initiated Against Them (Priority: P1)

An NCR can only be raised against a traveler that is currently being worked
(status "active"). If the traveler is not active — for example it is still
initialized, already submitted for completion, completed, frozen, or archived
— NCR initiation against it is refused, whichever way the user tries: the
"Initiate NCR" action on the traveler, or a pasted reference on the NCR
initiation form.

**Why this priority**: This is the guard that makes the submission rule in
User Story 3 hold. Without it, an NCR could be opened against a traveler
after it had already passed the submission check, leaving a traveler that is
under approval or completed holding an unresolved nonconformance.

**Independent Test**: Can be fully tested by attempting to initiate an NCR
(via both entry paths) against travelers in each non-active status and
confirming every attempt is refused with the traveler's current status named,
then repeating against an active traveler and confirming it succeeds.

**Acceptance Scenarios**:

1. **Given** a traveler is in any status other than active, **When** a user
   views one of its inputs, **Then** the "Initiate NCR" action is not offered
   for it (or is shown disabled with a reason)
2. **Given** a traveler is not active, **When** a user pastes a reference to
   one of its inputs into the NCR initiation form and submits, **Then** the
   submission is refused with a message naming the traveler's current status,
   and no NCR is created
3. **Given** a traveler is active when the NCR initiation form is opened but
   is no longer active when the user submits, **When** they submit, **Then**
   the submission is refused — the status at the moment of submission decides,
   not the status when the form was opened
4. **Given** a traveler is active, **When** a user initiates an NCR against
   any of its inputs by either path, **Then** the NCR is created

---

### User Story 3 - A Traveler Cannot Be Submitted for Completion Approval While Any Linked NCR Is Open (Priority: P1)

A traveler with even one linked NCR that is not yet Closed cannot be submitted
for completion approval. The person trying to submit it is stopped and shown
exactly which NCRs are still open, so they know what has to be resolved. Once
every linked NCR is Closed, submission proceeds under the existing rules and
the traveler goes on to its normal approval.

**Why this priority**: This is the core quality control the feature exists to
enforce — product work cannot be put forward for sign-off while a recorded
nonconformance against it is still unresolved.

**Independent Test**: Can be fully tested by linking an NCR to an active
traveler, attempting to submit the traveler for completion approval and
confirming the attempt is refused with the open NCR listed, then closing the
NCR and confirming the traveler can be submitted and goes through its normal
approval.

**Acceptance Scenarios**:

1. **Given** an active traveler has at least one linked NCR that is not
   Closed, **When** a user attempts to submit it for completion approval,
   **Then** the attempt is refused and the traveler stays active
2. **Given** a submission attempt is refused, **When** the user sees the
   message, **Then** it lists each open linked NCR by number, current status,
   and the input it is linked to, with a link to each
3. **Given** the traveler has several linked NCRs, some Closed and some not,
   **When** a user attempts to submit it, **Then** the attempt is refused
   until every one of them is Closed
4. **Given** every linked NCR is Closed (or the traveler has none), **When** a
   user attempts to submit it, **Then** the NCR rule does not stand in the
   way, and the traveler's other existing submission and approval rules apply
   as before
5. **Given** a traveler that was submitted has been sent back for more work,
   and an NCR raised against it since is still open, **When** a user attempts
   to resubmit it, **Then** the attempt is refused exactly as for a first
   submission
6. **Given** the person attempting submission is an administrator or manager,
   **When** a linked NCR is not Closed, **Then** the attempt is refused
   exactly as for any other user — there is no override

---

### User Story 4 - An Input With an Open NCR Does Not Count as Finished (Priority: P2)

An input that has a value but also has a linked NCR that is not yet Closed is
shown as not finished, and is left out of the traveler's finished-input
progress, so the progress figure reflects real readiness rather than just
"something was typed in." The input counts as finished again once every NCR
linked to it is Closed.

**Why this priority**: It gives everyone looking at a traveler — and at binders
and lists that roll traveler progress up — an accurate at-a-glance picture,
and it reinforces the submission rule in User Story 3. It is secondary
because the hard block (User Story 3) already prevents bad submissions;
this makes the reason visible earlier and continuously.

**Independent Test**: Can be fully tested by filling in an input (progress
counts it), initiating an NCR against it (progress no longer counts it),
closing the NCR (progress counts it again), and confirming the input is
labeled accordingly at each step.

**Acceptance Scenarios**:

1. **Given** an input has a submitted value and no linked NCR, **When** a user
   views the traveler, **Then** it counts as finished
2. **Given** an input has a submitted value and at least one linked NCR that
   is not Closed, **When** a user views the traveler, **Then** it does not
   count as finished, and the input visibly indicates it is waiting on an open
   NCR
3. **Given** an input has several linked NCRs, **When** only some are Closed,
   **Then** it stays not finished until all are Closed
4. **Given** an input's last open linked NCR becomes Closed, **When** a user
   next views the traveler, **Then** the input counts as finished again (if it
   has a submitted value)
5. **Given** an input's only open linked NCR is removed (for example, deleted
   by an administrator), **When** a user next views the traveler, **Then** the
   input no longer counts as blocked
6. **Given** a traveler's progress is shown anywhere else (traveler lists,
   binders that include the traveler), **When** an input is not finished
   because of an open NCR, **Then** those figures reflect it too
7. **Given** an input is not finished because of an open NCR, **When** a user
   with write access wants to change that input's value, **Then** they can
   still do so — only the "finished" status is affected, not the ability to
   edit

---

### User Story 5 - A Closed NCR's PDF Record Is Attached to the Traveler Input (Priority: P2)

When an NCR that is linked to a traveler input is closed, the system
automatically produces a PDF containing the NCR's details and attaches it to
that input on the traveler. Anyone reviewing the traveler later can open the
PDF from the input to see the complete nonconformance record — what was
found, how it was dispositioned, who approved it, and how it was closed —
without needing to go to the NCR application.

**Why this priority**: It completes the loop — the traveler becomes a
self-contained quality record. It is secondary because the gating rules
(User Stories 2–4) deliver the control; this delivers the audit trail.

**Independent Test**: Can be fully tested by taking a traveler-linked NCR
through to closure, then opening the traveler and confirming the input now
shows a PDF whose contents match the NCR's details; and confirming a
standalone NCR closes without producing any traveler attachment.

**Acceptance Scenarios**:

1. **Given** an NCR linked to a traveler input reaches Closed, **When** the
   closure completes, **Then** a PDF containing the NCR's details is produced
   and attached to that traveler input
2. **Given** the PDF is attached, **When** anyone who can view the traveler
   views that input, **Then** they can open or download the PDF from it,
   alongside the NCR's link and status, and the PDF is named so the NCR number
   is evident
3. **Given** the PDF is opened, **When** a reviewer reads it, **Then** it
   contains the NCR's identifying information, the traveler and input it was
   raised against, the nonconformance description, the disposition, the
   review and approval outcomes, any preventive actions, the closure record,
   and the NCR's history of events
4. **Given** one input has several linked NCRs that are closed at different
   times, **When** a user views the input, **Then** each closed NCR has its own
   PDF, and none replaces another
5. **Given** an NCR that is not linked to any traveler is closed, **When** it
   closes, **Then** no traveler attachment is produced
6. **Given** the PDF cannot be produced or attached for any reason (e.g. the
   traveler or input no longer exists, or a technical failure), **When** the
   NCR is being closed, **Then** the closure still succeeds, and the failure is
   recorded in the NCR's history and made visible to the person who closed it
   so it can be followed up
7. **Given** a PDF has been attached, **When** the NCR's information is later
   changed or the NCR is removed, **Then** the attached PDF is unchanged — it
   is a snapshot of the NCR as it stood at closure

### Edge Cases

- What happens when the reference has extra spaces or line breaks around it
  (a common result of copy and paste)? Leading and trailing whitespace is
  ignored; the reference is otherwise judged exactly as typed.
- What happens when a traveler's input name itself contains the `::`
  separator? The reference is split at the *first* `::` only, so everything
  after it is the input name.
- What happens when a valid reference points to an input that has no submitted
  value yet? It is accepted — the reference can be copied from any input, and
  an unfilled input is simply already "not finished" (User Story 4), so the
  open NCR does not change its progress state. The "Initiate NCR" action on
  the traveler itself stays available only for filled-in inputs, unchanged
  from `specs/123-traveler-ncr-input-linking`.
- What happens when a user pastes a reference for a traveler they are not
  allowed to see? It is refused exactly as an unresolvable reference is, and
  nothing about that traveler is revealed (FR-008).
- What happens if the traveler's status changes while a user is filling in the
  NCR initiation form? The status is checked again at the moment of submission
  and that check decides (User Story 2, scenario 3).
- What happens if an NCR was raised against an active traveler and the traveler
  is then frozen or returned for work before the NCR closes? It keeps
  blocking the traveler's submission for completion approval (a frozen
  traveler must be made active again first, and one sent back for more work
  is checked again on its next submission), and it can still be worked
  through to Closed; when it closes, its PDF is still attached to the
  traveler input, whatever the traveler's status at that moment.
- What happens when a linked NCR was created in error? There is no
  cancel/void status for an NCR today; the existing administrator-only NCR
  deletion (`specs/122-admin-delete-ncrs`) is the only way to clear such an
  NCR, and once it is deleted it stops blocking the input and the traveler.
- What happens to NCRs, travelers, and PDFs that already exist when this
  feature ships? Travelers already completed stay completed. Active travelers
  that already have open linked NCRs are subject to the submission and
  "not finished" rules from that point on; travelers already submitted for
  completion approval are not re-checked. NCRs already Closed are not given
  PDFs retroactively.
- What happens if the same NCR reference is used by two different users for
  two different NCRs? Both NCRs link to the same input; an input can hold many
  NCRs (`specs/123-traveler-ncr-input-linking` FR-008).

## Requirements *(mandatory)*

### Functional Requirements

**Linking by reference (User Story 1)**

- **FR-001**: The NCR initiation form MUST provide an optional field where a
  user can enter a traveler input reference.
- **FR-002**: A traveler input reference MUST have the form
  `traveler_id::input_name` — the traveler's unique identifier and the input's
  name (unique within that traveler), separated by `::`. Leading and trailing
  whitespace MUST be ignored, and the reference MUST be split at the first
  `::` only.
- **FR-003**: Every input on a traveler MUST offer a single-action way to copy
  that input's reference, in exactly the format in FR-002, and MUST tell the
  user when the copy has succeeded.
- **FR-004**: When a reference is entered, the form MUST show the title of the
  traveler and the label of the input it resolves to, or a specific message
  when it cannot be resolved (malformed, traveler not found, input not found
  on that traveler), so the user can confirm or correct it before submitting.
- **FR-005**: The "Initiate NCR" action on a traveler input MUST open the NCR
  initiation form with the traveler input field already filled with that
  input's reference, so both entry paths produce identical linkage, including
  capturing the input's human-readable label at creation time.
- **FR-006**: When the traveler input field is left blank, NCR creation MUST
  behave exactly as it does today, producing an NCR with no traveler
  reference.
- **FR-007**: A reference MUST be verified by the system when the NCR is
  submitted — not only by the form — so that a malformed, unresolvable, or
  ineligible reference can never produce a linked NCR by any route, and the
  refusal MUST state the specific reason.
- **FR-008**: The system MUST require that the user submitting an NCR with a
  traveler input reference has at least read access to that traveler (write
  access is not required), and MUST NOT reveal a traveler's title or an input's
  label to a user who lacks read access. For such a user, the reference MUST be
  refused with the same message as one that does not resolve, so the existence
  of a traveler is not disclosed.

**Active-only initiation (User Story 2)**

- **FR-009**: The system MUST allow an NCR to be initiated against a traveler
  input only while the traveler's status is "active", regardless of which
  entry path (the traveler's "Initiate NCR" action or a reference on the NCR
  initiation form) is used.
- **FR-010**: The traveler's "Initiate NCR" action MUST NOT be offered — or
  MUST be shown disabled with the reason — while the traveler is not active.
- **FR-011**: A refusal because the traveler is not active MUST name the
  traveler's current status, and MUST NOT create an NCR.
- **FR-012**: The traveler's status MUST be checked at the moment of
  submission, and that check is the one that counts.

**Submission gating (User Story 3)**

- **FR-013**: The system MUST NOT allow a traveler to be submitted for
  completion approval while any NCR linked to any of its inputs has a status
  other than Closed, including when it is resubmitted after having been sent
  back for more work.
- **FR-014**: A refusal under FR-013 MUST list each open linked NCR with its
  number, current status, and the input it is linked to, each with a link to
  the NCR.
- **FR-015**: FR-013 MUST apply to every user, including administrators and
  managers; there is no override.
- **FR-016**: Once every linked NCR is Closed or removed, the NCR rule MUST no
  longer block submission for completion approval, and the traveler's other
  existing submission and approval rules remain unchanged.

**Input progress (User Story 4)**

- **FR-017**: An input with at least one linked NCR that is not Closed MUST NOT
  count as finished, even if it has a submitted value.
- **FR-018**: The traveler MUST visibly mark such an input as waiting on an
  open NCR, and the traveler's finished-input progress MUST exclude it.
- **FR-019**: Every place traveler progress is shown or rolled up (the
  traveler itself, traveler lists, and binders containing the traveler) MUST
  reflect FR-017.
- **FR-020**: An input MUST count as finished again once every NCR linked to
  it is Closed or removed (and it has a submitted value). The change MUST be
  visible the next time the traveler is viewed after an NCR is created, closed,
  or removed.
- **FR-021**: An open linked NCR MUST NOT prevent a user with write access from
  entering or changing the input's value; it affects only whether the input
  counts as finished.

**Closure PDF (User Story 5)**

- **FR-022**: When an NCR linked to a traveler input is closed, the system MUST
  produce a PDF containing the NCR's details and attach it to that traveler
  input.
- **FR-023**: The PDF MUST include, at minimum: the NCR's number, status, and
  key dates; originator; the traveler and input it was raised against; part,
  supplier, and PO information; the nonconformance description and discovery
  details; the assigned CE/CS; the disposition; the review and approval
  outcomes; any preventive actions; the closure record (including the traveler
  sign-off); and the history of events. Files attached to the NCR are listed
  by name but their contents are not embedded.
- **FR-024**: The attached PDF MUST be viewable and downloadable from the input
  by any user who can view the traveler, shown alongside the linked NCR, and
  MUST be named so the NCR number is evident.
- **FR-025**: When one input has several closed linked NCRs, each MUST have its
  own PDF; producing one MUST NOT replace or remove another.
- **FR-026**: The system MUST NOT produce a traveler attachment when an NCR
  that is not linked to a traveler is closed.
- **FR-027**: If the PDF cannot be produced or attached, the NCR's closure MUST
  still succeed; the failure MUST be recorded in the NCR's history and shown to
  the person closing it.
- **FR-028**: The PDF MUST be a snapshot as of closure; later changes to, or
  removal of, the NCR MUST NOT alter or remove an already attached PDF.
- **FR-029**: Producing and attaching the PDF MUST work regardless of the
  traveler's status at the time of closure.

### Key Entities

- **Traveler Input Reference**: A short text of the form
  `traveler_id::input_name` that uniquely identifies one input on one
  traveler. It is produced by copying from the input on the traveler and
  consumed by pasting into the NCR initiation form. It is a lookup key, not a
  stored record of its own; what is stored is the traveler/input link on the
  resulting NCR (`specs/123-traveler-ncr-input-linking`).
- **Traveler (status)**: A work instance with a lifecycle status (initialized,
  active, submitted for completion, completed, frozen, archived). Its status
  decides whether NCRs may be initiated against it (FR-009) and, together with
  the status of its linked NCRs, whether it may be submitted for completion
  approval (FR-013).
- **Linked NCR**: An NCR associated with a specific traveler input. Its status
  (Closed or not) drives whether the input counts as finished (FR-017) and
  whether the traveler may be submitted for completion approval (FR-013).
- **NCR Closure PDF**: A read-only snapshot of one NCR's full details,
  produced at the moment that NCR is closed and attached to the traveler input
  the NCR was linked to. An input can hold many, one per closed linked NCR.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can go from an input on a traveler to a submitted,
  correctly linked NCR via the standard initiation form — copy reference,
  paste, confirm, submit — without retyping any identifier and in under one
  minute of user effort (excluding time spent filling the NCR's own mandatory
  fields).
- **SC-002**: 100% of NCR initiation attempts against a traveler that is not
  active are refused with the traveler's status named, across both entry
  paths, and none of them creates an NCR.
- **SC-003**: 0 travelers are submitted for completion approval while any
  linked NCR is not Closed, and 100% of refused submission attempts show the
  user every open NCR that caused the refusal.
- **SC-004**: A traveler's finished-input figure never includes an input that
  has an open linked NCR, and matches the true state on the next view after
  any NCR is created, closed, or removed — in the traveler, in lists, and in
  binders.
- **SC-005**: 100% of closed traveler-linked NCRs have a PDF attached to their
  input within one minute of closure, except where a failure has been recorded
  per FR-027; and 100% of those PDFs, when opened, contain every item listed
  in FR-023.
- **SC-006**: 100% of malformed or unresolvable references are refused with a
  message stating the specific reason before any NCR is created.
- **SC-007**: NCR creation without a traveler reference is unchanged: the same
  steps, the same required fields, the same result as before this feature.

## Assumptions

- The reference is a convenience for linking, not a new permission mechanism;
  the read-access condition in FR-008 is the only new access condition
  introduced (confirmed by the requester). This is deliberately looser than
  the write access `specs/123-traveler-ncr-input-linking` assumed for the
  in-traveler "Initiate NCR" action, so that QA staff and inspectors who
  do not work a traveler can still raise NCRs against it. Everything else
  about who can create, disposition, approve, and close an NCR is unchanged
  from `specs/001-ncr-workflow`.
- The reference field on the NCR initiation form is optional. Blank means a
  standalone NCR, as today.
- "Completed" in the user's request means the point where a traveler is
  submitted for completion approval, so the open-NCR rule is enforced at
  submission (confirmed by the requester). It is not checked again when
  approvers approve: because NCRs can only be initiated against an active
  traveler (FR-009), none can be opened once a traveler has been submitted. A
  traveler sent back for more work becomes active again and is checked again
  on its next submission. An NCR created at the very same instant as a
  submission is not guarded against.
- "Associated NCR" for the traveler-level rule means an NCR linked to *any*
  input on that traveler; for the input-level rule it means an NCR linked to
  *that* input.
- "Not closed" means any NCR status other than Closed (Submitted,
  Dispositioned, Approval Requested, Returned for Comment, Final Approval).
  No new NCR statuses (such as cancelled or void) are introduced.
- The PDF contains the NCR as it stands at closure and is produced by the
  system with no user action. A user-facing "regenerate PDF" control, and
  producing PDFs for NCRs closed before this feature ships, are out of scope.
- If an NCR is deleted after closure (`specs/122-admin-delete-ncrs`), its
  PDF on the traveler stays, as the traveler's own historical record.
- The "Initiate NCR" action on a traveler input remains limited to inputs that
  already have a submitted value, per `specs/123-traveler-ncr-input-linking`
  FR-001/FR-002. Only the reference path accepts any existing input on the
  traveler, because the request says the reference can be copied from any
  input.
- The traveler input's human-readable label continues to be captured at NCR
  creation, per `specs/123-traveler-ncr-input-linking` FR-004, regardless of
  entry path.
- Every other already-specified capability — including the traveler sign-off
  confirmation at NCR closure (`specs/001-ncr-workflow` FR-043) and the
  administrator-only NCR deletion (`specs/122-admin-delete-ncrs`) — is
  unchanged by this feature.
