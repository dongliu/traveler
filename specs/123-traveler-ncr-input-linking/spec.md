# Feature Specification: Traveler-Initiated NCRs Linked to a Specific Input

**Feature Branch**: `123-traveler-ncr-input-linking`

**Created**: 2026-09-13

**Status**: Draft

**Continues**: `specs/001-ncr-workflow/spec.md` — "Future Work: eTraveler UI Integration
(Not Yet Planned)" (line 782). That section deferred an "Initiate NCR" launch
point within the traveler UI and displaying the resulting NCR back on the
traveler. This feature implements both, and goes further than that note
originally scoped: the association is made to a specific, uniquely-named
input on the traveler (not just the traveler as a whole), and the link/status
display is two-way (traveler → NCR and NCR → traveler).

**Input**: User description: "continue the work left at
specs/001-ncr-workflow/spec.md:782. A user can initiate an NCR from a
traveler. Each traveler input is uniquely named, and associate the NCR to an
input. Once the NCR is created. The input inside a traveler shows a link to
the NCR, and the NCR status. When an NCR is initiated from a traveler, the
NCR also has a link to the traveler, and the input label/name."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Initiate an NCR from a Filled-In Traveler Input (Priority: P1)

A user viewing a traveler notices that a value already entered for one of its
inputs indicates a nonconformance. From that specific input, they trigger
"Initiate NCR," which starts NCR creation already associated with that exact
traveler and that exact input. Completing the standard NCR creation form
produces a new NCR permanently linked to that input.

**Why this priority**: This is the launch point the whole feature depends on
— without it, no traveler-initiated, input-linked NCR can ever be created.

**Independent Test**: Can be fully tested by filling in one input on a
traveler, triggering "Initiate NCR" from it, completing NCR creation, and
confirming the resulting NCR is linked to that traveler and that specific
input (not just the traveler in general).

**Acceptance Scenarios**:

1. **Given** a traveler input has a submitted value, **When** the user views
   that input, **Then** an "Initiate NCR" action is available for it
2. **Given** a traveler input has not yet been filled in, **When** the user
   views that input, **Then** no "Initiate NCR" action is available for it
3. **Given** the user triggers "Initiate NCR" from a specific input, **When**
   the NCR creation flow completes, **Then** the resulting NCR is associated
   with that exact traveler and that exact input — identified by the input's
   name, unique within that traveler — not merely the traveler as a whole
4. **Given** the same traveler has multiple filled-in inputs, **When** NCRs
   are initiated from two different inputs, **Then** each NCR is linked to
   its own distinct input, never conflated with the other
5. **Given** a user initiates an NCR from an input, **When** they complete
   NCR creation, **Then** every other existing NCR creation requirement
   (mandatory fields, CE/CS assignment, notification emails, per
   `specs/001-ncr-workflow`) still applies unchanged — this feature only adds
   the traveler/input association, not a shortcut around what's already
   required

---

### User Story 2 - See the Linked NCR's Link and Status on the Traveler Input (Priority: P1)

Anyone viewing a traveler can see, at any input that has one or more linked
NCRs, a link to each NCR and its current status, so they know a
nonconformance exists for that input and how far along it is, without
leaving the traveler.

**Why this priority**: Without this, the association created by User Story 1
is invisible from the traveler side, defeating the point of linking it to a
specific input in the first place.

**Independent Test**: Can be fully tested by initiating an NCR from an input,
returning to the traveler, and confirming a link and current status appear
at that input; advancing the NCR's status and confirming the traveler
reflects the change.

**Acceptance Scenarios**:

1. **Given** an input has one linked NCR, **When** a user views the
   traveler, **Then** they see a link to that NCR and its current status
   displayed at that input
2. **Given** an input has more than one linked NCR, **When** a user views
   the traveler, **Then** they see a link and current status for each one
   individually, distinguishable from one another (e.g., by NCR number)
3. **Given** a linked NCR's status changes after it was initiated, **When**
   the user next views the traveler, **Then** the displayed status reflects
   the NCR's current status, not its status at initiation time
4. **Given** a user can view the traveler at all, **When** they look at an
   input with a linked NCR, **Then** they can see its link and status
   regardless of whether they personally have any role on that NCR
   (originator, CE/CS, QA, approver) — traveler access alone is sufficient
5. **Given** the user clicks the link, **When** the NCR opens, **Then** they
   land on that NCR's own detail view

---

### User Story 3 - See the Source Traveler and Input on the NCR (Priority: P2)

Someone viewing an NCR that was initiated from a traveler can see which
traveler it came from and which specific input flagged it, with a link back
to the traveler, giving full context on where the nonconformance was
discovered.

**Why this priority**: This completes the two-way link — valuable on its
own, but secondary to the traveler-side launch point and display (User
Stories 1-2) that make the association possible in the first place.

**Independent Test**: Can be fully tested by opening a traveler-initiated
NCR's detail page and confirming it shows a link to the originating traveler
and the originating input's label, and confirming a standalone (non-traveler)
NCR shows neither.

**Acceptance Scenarios**:

1. **Given** an NCR was initiated from a traveler input, **When** a user
   views that NCR's detail page, **Then** they see a link to the originating
   traveler and the label of the specific input that triggered it
2. **Given** an NCR was created through the standalone creation page (not
   from a traveler), **When** a user views that NCR's detail page, **Then**
   no traveler/input reference is shown
3. **Given** the user clicks the traveler link on the NCR, **When** the
   traveler opens, **Then** they land on that traveler, subject to the
   traveler's own normal access rules

### Edge Cases

- What happens if the traveler or its specific input is later deleted or the
  form template revised so that input no longer exists? The NCR keeps its
  own stored reference (traveler identity, input name, and the input's label
  captured at creation time) and shows an inactive/broken link rather than
  losing the historical record of where it came from.
- What happens if the same input name is reused by a different traveler
  (input names are unique within one traveler's form, not globally)?
  Association is always scoped to the specific (traveler, input) pair, never
  to the input name alone — two different travelers' identically-named
  inputs never get confused with each other.
- What happens if a user later changes or re-submits a new value for an
  input that already has a linked NCR? The existing link is unaffected — it
  stays associated with that input's identity regardless of how many times
  its value is subsequently updated.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a user to initiate an NCR from a specific
  input on a traveler once that input has a submitted value.
- **FR-002**: System MUST NOT offer NCR initiation for a traveler input that
  has no submitted value yet.
- **FR-003**: System MUST associate each traveler-initiated NCR with the
  exact traveler and the exact input — identified by that input's
  name, unique within that traveler — it was initiated from, not merely the
  traveler as a whole.
- **FR-004**: System MUST capture the input's human-readable label at the
  time the NCR is created, so it can be displayed as-is even if the source
  form template's labels change later.
- **FR-005**: System MUST require every already-mandated piece of
  information for NCR creation (per `specs/001-ncr-workflow`) when creating
  an NCR from a traveler input — this feature adds an association, not a
  shortcut around existing requirements.
- **FR-006**: System MUST display, at each traveler input that has one or
  more linked NCRs, a link to each linked NCR and that NCR's current status.
- **FR-007**: System MUST allow any user with view access to the traveler to
  see a linked NCR's link and status at that input, independent of whether
  that user has any role on the NCR itself.
- **FR-008**: System MUST allow a traveler input to accumulate more than one
  linked NCR over time, showing each one distinguishably (e.g., by NCR
  number), and MUST NOT block initiating a new NCR from an input that
  already has one or more linked NCRs.
- **FR-009**: System MUST display, on the detail view of an NCR that was
  initiated from a traveler input, a link to the originating traveler and
  the label of the originating input.
- **FR-010**: System MUST NOT display any traveler/input reference on an NCR
  that was not initiated from a traveler.
- **FR-011**: System MUST continue to support the existing traveler sign-off
  confirmation at NCR closure (`specs/001-ncr-workflow` FR-043) unchanged for
  a traveler-initiated NCR.
- **FR-012**: System MUST retain the traveler/input reference on an NCR even
  if the referenced traveler or input is later deleted or changed, rather
  than removing the historical record.

### Key Entities

- **Traveler Input**: An individual field within a traveler's form,
  identified by a name unique within that traveler and a human-readable
  label; once it has a submitted value, it can accumulate zero or more
  linked NCRs over time.
- **NCR (traveler-initiated)**: An NCR record that stores which traveler and
  which specific input it was initiated from, including that input's label
  captured at creation time.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can initiate a fully linked NCR from a filled-in
  traveler input in the same number of steps as creating a standalone NCR
  today, with zero extra manual linking steps — the association is
  automatic.
- **SC-002**: 100% of NCRs initiated from a traveler input show a working
  link and correct, current status on both the traveler input and the NCR
  itself.
- **SC-003**: A user viewing a traveler can determine, without leaving the
  page, which of its inputs have a nonconformance on record and each one's
  current status.
- **SC-004**: Reusing the same input name across two different travelers
  never causes a nonconformance link to appear on the wrong traveler.

## Assumptions

- Only a user who already has write/fill-in access to the traveler (the same
  authorization already required to submit a value for that input) can
  initiate an NCR from one of its inputs — no new, separate permission is
  introduced.
- The NCR creation form itself (mandatory fields, CE/CS assignment,
  notification emails) is unchanged by this feature; only the traveler/input
  association and its two-way display are added. Automatic pre-population of
  NCR fields from the traveler's context remains out of scope, as in the
  original "Future Work" note this feature continues.
- Visibility of a linked NCR's link/status on the traveler is governed
  solely by the traveler's own existing access rules, not by any additional
  NCR-specific access check — consistent with the NCR detail page itself
  today having no per-viewer access restriction beyond being an
  authenticated user.
- An input can accumulate multiple linked NCRs over time (e.g., a new
  nonconformance found after a prior one on the same input is closed);
  initiating a new one is never blocked by an existing one.
- Every other already-specified capability in `specs/001-ncr-workflow` —
  including the traveler sign-off confirmation at closure (FR-043) — is
  unchanged. This feature fills in the "Initiate NCR" launch point and the
  two-way link/status display that the original "Future Work" note deferred,
  and additionally introduces per-input (rather than per-traveler)
  association, per this feature's explicit request. Performing traveler
  sign-off from within the traveler UI itself and auto-attaching a closed
  NCR copy to the traveler record remain deferred/out of scope.
