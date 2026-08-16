# Feature Specification: NCR Originator Designate Assignment

**Feature Branch**: `003-originator-designate`

**Created**: 2026-08-16

**Status**: Draft

**Input**: User description: "the NCR originator can optionly add one designate to an NCR. Oonly the originator can do that. The designate can perform all the actions as the originator."

## Background

`specs/001-ncr-workflow/spec.md` already refers to "NCR Originator or designee"
throughout NCR issuance, closure, and final distribution (User Story 5 Acceptance
Scenarios 1/4/5, User Story 6 Acceptance Scenario 1, FR-039, FR-040, FR-043,
FR-044) but never specifies how a designee is actually assigned, who is eligible,
or what authority they hold — the mechanism was assumed but never built. This
feature closes that gap: it defines and implements the missing "designee"
(referred to here as **Designate**, matching the feature request's wording)
assignment capability those existing requirements already depend on.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Originator Assigns a Designate (Priority: P1)

An NCR Originator, anticipating they may be unavailable to execute disposition
or close out their NCR, assigns one other person as their Designate on that
NCR. Only the Originator of that specific NCR can make this assignment — no
other role (QA Staff, CE/CS, Approver, Manager, Admin) can assign, change, or
remove it on the Originator's behalf. The Originator can change or remove the
Designate at any time while the NCR is still open.

**Why this priority**: Without an assignment mechanism, none of the
already-specified "Originator or designee" behavior in the base NCR workflow
spec can actually function — this is the foundational capability the rest of
the feature depends on.

**Independent Test**: Can be fully tested by having an NCR Originator open one
of their own NCRs, assign a Designate, and verifying the assignment is saved
and visible on the NCR; verifying a non-Originator user (including the
just-assigned Designate) cannot perform the assignment, change it, or remove
it; and verifying the Originator can later change or remove the Designate.

**Acceptance Scenarios**:

1. **Given** an NCR Originator is viewing an NCR they created, which currently
   has no Designate, **When** they select a user and assign them as Designate,
   **Then** the system records that user as the NCR's Designate and confirms
   the assignment
2. **Given** an NCR already has a Designate assigned, **When** the Originator
   selects a different user and assigns them as Designate, **Then** the
   previous Designate is replaced by the new one
3. **Given** an NCR has a Designate assigned, **When** the Originator removes
   the Designate, **Then** the NCR has no Designate and only the Originator
   retains Originator-equivalent authority on that NCR
4. **Given** a user is not the Originator of a specific NCR (including a user
   who is the Designate on that NCR, a user who is the Originator of a
   *different* NCR, QA Staff, CE/CS, an Approver, or a Manager), **When** they
   attempt to assign, change, or remove that NCR's Designate, **Then** the
   system rejects the request with an authorization error and the Designate
   assignment is unchanged
5. **Given** an NCR has reached "Closed" status, **When** the Originator
   attempts to assign, change, or remove the Designate, **Then** the system
   rejects the request, since there is no further Originator action left to
   delegate on a closed NCR
6. **Given** a Designate is assigned, **When** the assignment is recorded,
   **Then** the system sends the Designate a notification with a link to the
   NCR informing them of their new authority on it, and records the
   assignment (assigner identity, designate identity, timestamp) as an audit
   trail event on the NCR

---

### User Story 2 - Designate Exercises Originator Authority (Priority: P1)

A user who has been assigned as Designate on an NCR performs the same
Originator-scoped actions the Originator themselves could perform on that
specific NCR: viewing it (including in their own dashboard/NCR list), closing
it with closure notes (and, for Traveler-linked NCRs, the sign-off
self-attestation), and receiving the notifications an Originator would
receive for that NCR (the NCR ISSUANCE email and the FINAL NCR DISTRIBUTION
email). The Designate's authority is limited to the specific NCR(s) they were
assigned on — it does not make them an Originator generally, and does not
extend to any other NCR.

**Why this priority**: This is the actual value the feature delivers — an
assignment with no accompanying authority would not satisfy "the designate
can perform all the actions as the originator." It ships alongside User Story
1 as the same increment in practice, but is independently verifiable.

**Independent Test**: Can be fully tested by assigning a Designate to an NCR
(via User Story 1), then, acting as that Designate, verifying they can view
the NCR, receive the same notifications the Originator receives, and close
the NCR — and verifying none of this authority applies to any NCR they were
not assigned as Designate on.

**Acceptance Scenarios**:

1. **Given** a user is the Designate on an NCR, **When** they view their NCR
   dashboard/list, **Then** that NCR appears alongside NCRs where they are the
   Originator
2. **Given** an NCR reaches "Final Approval" status and has a Designate
   assigned, **When** the system sends the NCR ISSUANCE email, **Then** it is
   sent to both the Originator and the Designate
3. **Given** a user is the Designate on an NCR in "Final Approval" status,
   **When** they provide closure notes and select "Close NCR" (completing the
   Traveler sign-off self-attestation if the NCR is Traveler-linked), **Then**
   the NCR transitions to "Closed" exactly as if the Originator had closed it,
   and the closure record identifies the Designate (not the Originator) as
   the person who actually performed the closure
4. **Given** an NCR is closed, **When** the system sends the FINAL NCR
   DISTRIBUTION email, **Then** it is sent to both the Originator and the
   Designate (if one was assigned)
5. **Given** a user is the Designate on NCR A but has no relationship to NCR
   B, **When** they attempt to view or close NCR B, **Then** the system
   denies access exactly as it would for any unrelated user
6. **Given** a user is the Designate on an NCR, **When** the NCR's audit trail
   or closure record shows who performed a Designate-eligible action,
   **Then** it identifies the Designate's own identity, not the Originator's
   — the Originator's own identity is never recorded for an action the
   Designate actually performed

---

### Edge Cases

- What happens if the Originator tries to assign themselves as their own
  Designate? The system should reject this — a Designate exists to cover for
  the Originator, not duplicate them.
- What happens if the Originator assigns a Designate, and that Designate is
  later removed from the system (deactivated user) — does the NCR silently
  lose its Designate coverage, or does something surface this to the
  Originator?
- What happens if two different NCRs each designate the same person? Nothing
  prevents this — a single user can be the Designate on multiple NCRs
  simultaneously, each independently.
- What happens if the Originator account itself is deactivated while a
  Designate is assigned? The Designate's authority on that specific NCR is
  unaffected; only the Originator's own actions (like reassigning the
  Designate again later) would be unavailable.
- What happens to an already-assigned Designate's authority if the NCR is
  returned to an earlier status (e.g., "Returned for Comment")? The
  assignment persists — Designate authority is tied to the NCR itself, not to
  a particular status, except that new assignment/changes are blocked once
  "Closed" (User Story 1, Acceptance Scenario 5).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow the Originator of a specific NCR to assign
  exactly one other user as that NCR's Designate
- **FR-002**: System MUST allow only the Originator of that specific NCR to
  assign, change, or remove its Designate — no other role or user, including
  the current Designate, may do so
- **FR-003**: System MUST prevent an Originator from assigning themselves as
  their own Designate on the same NCR
- **FR-004**: System MUST allow the Originator to replace an existing
  Designate with a different user, or remove the Designate entirely, at any
  time before the NCR reaches "Closed" status
- **FR-005**: System MUST reject any attempt to assign, change, or remove a
  Designate on an NCR that has already reached "Closed" status
- **FR-006**: System MUST send the newly assigned Designate a notification
  email with a link to the NCR when they are assigned
- **FR-007**: System MUST record every Designate assignment, change, and
  removal as an audit trail event on the NCR, capturing the acting
  Originator's identity, the Designate's identity (for assignment/change),
  and the timestamp
- **FR-008**: System MUST grant the Designate the same access to view a
  specific NCR that its Originator has, for exactly the NCR(s) they are
  currently assigned as Designate on, and no others
- **FR-009**: System MUST include NCRs where a user is the current Designate
  in that user's NCR dashboard/list, alongside NCRs where they are the
  Originator
- **FR-010**: System MUST allow the Designate to close an NCR under the same
  conditions the Originator could (closure notes required; Traveler sign-off
  self-attestation required for Traveler-linked NCRs), producing the same
  "Closed" state transition
- **FR-011**: System MUST record the Designate's own identity — not the
  Originator's — as the closer on the closure record when the Designate
  performs the closure
- **FR-012**: System MUST include the Designate (in addition to the
  Originator) as a recipient of the NCR ISSUANCE email when one is assigned
- **FR-013**: System MUST include the Designate (in addition to the
  Originator) as a recipient of the FINAL NCR DISTRIBUTION email when one is
  assigned
- **FR-014**: System MUST NOT extend a user's Designate authority to any NCR
  they were not explicitly assigned as Designate on, even if they are the
  Designate on other NCRs

### Key Entities

- **NCR Designate Assignment**: Represents the delegation of Originator
  authority for one specific NCR to exactly one other user
  - Attributes: Designate Identity, Assigning Originator Identity, Assignment
    Timestamp, (on removal/change) Removal or Replacement Timestamp
  - Relationships: Associated with exactly one NCR at a time (an NCR has at
    most one active Designate); references a User as the Designate; tracked
    in that NCR's audit trail

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An NCR Originator can assign a Designate to one of their NCRs in
  under 30 seconds
- **SC-002**: 100% of Designate-eligible actions (viewing the NCR, receiving
  the ISSUANCE and FINAL NCR DISTRIBUTION emails, closing the NCR) are
  available to the Designate with identical outcomes to the Originator
  performing the same action
- **SC-003**: 0% of Designate-assignment attempts by any user other than the
  NCR's own Originator succeed
- **SC-004**: 100% of closures performed by a Designate record the
  Designate's own identity, verifiable by any authorized user reviewing the
  NCR's closure record or audit trail
- **SC-005**: A Designate's authority never applies to an NCR they were not
  assigned Designate on, verified across all NCRs in the system

## Assumptions

- "Designate" in this spec is the same concept the base NCR workflow spec
  (`specs/001-ncr-workflow/spec.md`) already refers to informally as
  "designee" — this feature defines and implements it; no separate,
  additional "designee" concept exists alongside it.
- Designate authority is scoped per-NCR (tied to the specific NCR's own
  Designate assignment), not a system-wide role — this mirrors the existing
  `ce_cs_delegate_id` pattern already present for CE/CS, which is also
  per-NCR rather than a global role.
- Any authenticated user in the system is eligible to be assigned as a
  Designate — there is no restricted pool or role requirement, consistent
  with how a CE/CS is already freely selected by name on NCR creation.
  Reassigning the Designate does not require the outgoing or incoming
  Designate's acceptance or confirmation; the Originator's assignment takes
  effect immediately, consistent with how QA Staff's designation of
  additional Approvers already works with no separate accept step.
  (Deactivated/unavailable Designates are not specifically handled beyond
  what Edge Cases already describes — the Originator remains free to
  reassign at any time.)
- When the Designate performs a Designate-eligible action, their own
  identity is recorded (not the Originator's) — this follows the same audit
  philosophy already stated for the (currently deferred) CE/CS delegate
  concept: "Delegate performs disposition with their own identity recorded;
  original CE/CS assignment is preserved in history for audit compliance."
  The NCR's `originator_id` itself is never overwritten by a Designate
  assignment or action.
- The scope of "all the actions as the originator" is bounded to the
  Originator-specific authority already defined in the base NCR workflow
  spec: NCR closure (User Story 5), receiving the ISSUANCE notification
  (User Story 5), receiving the FINAL NCR DISTRIBUTION notification (User
  Story 6), and NCR visibility/dashboard access. It does not include
  capabilities that are not Originator-instance-specific to begin with (e.g.
  the general ability to create new NCRs, which any authenticated user
  already has regardless of Originator status).
