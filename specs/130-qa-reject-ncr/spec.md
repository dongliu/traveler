# Feature Specification: QA Reject with Comments

**Feature Branch**: `130-qa-reject-ncr`

**Created**: 2026-10-25

**Status**: Draft

**Input**: User description: "When QA perform concurrence, current, the QA can either request more approvers, or choose to not adding any approver. An addition option is need for the QA to directly reject with comments. This action will move the NCR to a new state where the initiator or the initiator delegate needs to update the NCR, then the NCR will be in Submitted state. This action should generate notification to QA, initiator, and initiator delegate if any. First update the specs/NCR-flow.md to show the new stat transition."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - QA rejects an NCR with comments instead of concurring (Priority: P1)

Today, when an NCR reaches QA Concurrence, QA can only move it forward: concur with no additional approvers (straight to Final Approval) or concur with a chosen set of approvers (Approval Requested). If QA finds the NCR itself is flawed — the original submission is incomplete, wrong, or otherwise needs rework before QA can responsibly concur — QA has no way to send it back to whoever raised it. QA needs a third option at this same decision point: reject the NCR outright, with a required comment explaining why, so the NCR goes back to the people who can actually fix it instead of being forced through a disposition/approval cycle that doesn't apply.

**Why this priority**: This is the core capability requested — without it, QA is stuck either rubber-stamping a flawed NCR forward or working around the system outside of it. Every other part of this feature exists to support this one action.

**Independent Test**: Put an NCR in Dispositioned status. As QA, choose "Reject with Comments," enter a comment, and submit. Confirm the NCR leaves Dispositioned, is no longer awaiting QA concurrence or any approver decision, and QA's comment is recorded and visible on the NCR.

**Acceptance Scenarios**:

1. **Given** an NCR in Dispositioned status awaiting QA concurrence, **When** QA chooses "Reject with Comments," enters a comment, and submits, **Then** the NCR's status changes to a distinct "Rejected" status, the comment and QA's identity are recorded on the NCR, and the NCR is no longer in any disposition, concurrence, or approval queue.
2. **Given** QA is on the concurrence screen for an NCR in Dispositioned status, **When** QA selects "Reject with Comments" but leaves the comment blank and submits, **Then** the system refuses the action and the NCR's status does not change.
3. **Given** an NCR that is not currently in Dispositioned status (e.g., Approval Requested, Final Approval, or already Closed), **When** an attempt is made to reject it, **Then** the system refuses the action and the NCR's status does not change.

---

### User Story 2 - The Originator and Originator Designate update and resubmit a rejected NCR (Priority: P2)

Once QA rejects an NCR, the Originator (or their Originator Designate, if one is assigned) needs to see why it was rejected, fix the underlying submission, and send it forward again. Resubmitting restarts the review cycle from the beginning — the assigned CE/CS is asked for a fresh engineering disposition, exactly as when the NCR was first created — rather than resuming wherever it left off.

**Why this priority**: This is what makes the rejection action useful rather than a dead end; it closes the loop QA opens in User Story 1. It is second priority only because it has nothing to act on until a rejection exists.

**Independent Test**: Take an NCR already in "Rejected" status with QA's comment attached. As the Originator, update the NCR's submitted information and resubmit. Confirm the NCR's status becomes Submitted and the assigned CE/CS is asked again for a disposition.

**Acceptance Scenarios**:

1. **Given** an NCR in "Rejected" status, **When** the Originator updates the NCR's submitted information and resubmits, **Then** the NCR's status changes to Submitted and the assigned CE/CS receives a new request for engineering disposition.
2. **Given** an NCR in "Rejected" status that has an Originator Designate assigned, **When** the Originator Designate (instead of the Originator) updates and resubmits the NCR, **Then** the resubmission succeeds the same way as if the Originator had done it.
3. **Given** an NCR in "Rejected" status, **When** someone who is neither the Originator nor the Originator Designate attempts to update or resubmit it, **Then** the system refuses the attempt and the NCR remains in "Rejected" status.

---

### User Story 3 - Everyone affected is notified the moment QA rejects (Priority: P3)

The moment QA rejects an NCR, QA staff, the Originator, and the Originator Designate (if one is assigned) all receive a notification containing QA's rejection comment and a link to the NCR, so nobody has to discover the rejection by checking back manually.

**Why this priority**: This is a visibility/communication layer on top of User Story 1's state change. The feature still functions without it (the rejection is visible on the NCR itself), but timely notification is what the requester explicitly called for and what makes the workflow usable in practice.

**Independent Test**: Reject an NCR that has an Originator Designate assigned. Confirm a notification referencing the rejection and QA's comment reaches QA staff, the Originator, and the Originator Designate. Repeat on an NCR with no Originator Designate and confirm only QA staff and the Originator are notified.

**Acceptance Scenarios**:

1. **Given** an NCR with both an Originator and an Originator Designate, **When** QA rejects the NCR with a comment, **Then** QA staff, the Originator, and the Originator Designate each receive a notification containing the comment and a link to the NCR.
2. **Given** an NCR with no Originator Designate assigned, **When** QA rejects the NCR with a comment, **Then** QA staff and the Originator receive the notification and no notification is sent for a non-existent designate.

---

### Edge Cases

- QA attempts to reject an NCR that has, in the moment between loading the concurrence screen and submitting, already moved out of Dispositioned status (e.g., another QA staff member acted first): the rejection is refused with a clear error, consistent with how a stale concurrence submission is already handled today.
- An NCR being rejected carries approval-round or disposition history from an earlier cycle (this is not the NCR's first time through disposition and concurrence): that history remains on the NCR's permanent record untouched; rejection only adds a new record on top of it.
- An NCR linked to an active traveler input is rejected: the link and any traveler-side gating behavior are unaffected by this feature — the traveler input simply continues to show the NCR as open until it eventually reaches Closed.
- The Originator and the Originator Designate both have the NCR open at the same time while it is "Rejected": whichever one resubmits first succeeds; the system does not need to merge or detect a conflict beyond the normal "last write wins" behavior already used elsewhere for NCR edits.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST offer "Reject with Comments" as a third option alongside "concur with no approvers" and "concur with approvers" at the QA Concurrence decision point, available only while the NCR is in Dispositioned status.
- **FR-002**: System MUST require a non-blank comment before a "Reject with Comments" action can be submitted, and MUST refuse the action if the comment is blank.
- **FR-003**: When QA submits "Reject with Comments," System MUST transition the NCR to a new "Rejected" status, distinct from every other existing NCR status, and MUST record QA's identity, the comment, and the timestamp permanently on the NCR.
- **FR-004**: System MUST refuse any attempt to reject an NCR that is not currently in Dispositioned status, without changing that NCR's status.
- **FR-005**: While an NCR is in "Rejected" status, System MUST allow only the Originator or the assigned Originator Designate to update the NCR's submitted information and resubmit it; System MUST refuse the update/resubmit attempt from anyone else.
- **FR-006**: System MUST NOT allow an NCR in "Rejected" status to proceed through engineering disposition, QA concurrence, or approval review until it has been resubmitted.
- **FR-007**: When the Originator or Originator Designate resubmits an NCR from "Rejected" status, System MUST transition the NCR to Submitted status and MUST send the assigned CE/CS a new request for engineering disposition, the same notification sent when the NCR was first created.
- **FR-008**: System MUST notify QA staff, the Originator, and (if one is assigned) the Originator Designate at the moment an NCR is rejected, and each notification MUST include QA's comment and a link to the NCR.
- **FR-009**: System MUST NOT send a rejection notification addressed to an Originator Designate when the NCR has no Originator Designate assigned.
- **FR-010**: System MUST retain every prior disposition, approval round, and rejection record on the NCR's permanent history, even after the NCR is rejected and later resubmitted one or more times.
- **FR-011**: System MUST record the rejection and the subsequent resubmission as distinct entries in the NCR's existing event/activity history, each identifying who acted and when.

### Key Entities

- **Rejection Record**: The outcome of one "Reject with Comments" action — the rejecting QA staff member's identity, their comment, and the timestamp. Lives on the NCR's permanent history; an NCR may accumulate more than one over its lifetime if it is rejected more than once across separate review cycles.
- **NCR** *(existing entity, behavior changed)*: Gains "Rejected" as a new possible status value, reachable only from Dispositioned and leaving only back to Submitted once the Originator/Designate resubmits.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: QA can send a flawed NCR back to the Originator in a single action, without first having to request approvers or otherwise push the NCR further through disposition and approval.
- **SC-002**: 100% of NCR rejections leave a durable, visible record of who rejected the NCR, when, and why, retrievable from the NCR itself.
- **SC-003**: 100% of NCR rejections notify every party who needs to act or stay informed (QA staff, Originator, and Originator Designate when assigned) without requiring any of them to check back manually.
- **SC-004**: Every rejected NCR that is subsequently corrected and resubmitted re-enters the same engineering disposition and QA concurrence review it originally went through, with no step skipped and no manual workaround needed.

## Assumptions

- "Reject with Comments" is only available to QA Staff, using the same QA-staff permission check already enforced for the existing concurrence actions.
- "Update the NCR" means the Originator/Designate may edit the same submitted information they could edit when the NCR was first created (part details, description of nonconformance, discovery information, etc.) — this feature does not introduce a separate, restricted edit form.
- "Notify QA" means the same QA staff group already notified elsewhere in the NCR workflow (e.g., when a disposition is submitted), not only the individual QA staff member who performed the rejection.
- Resubmitting a rejected NCR intentionally restarts the full engineering disposition and QA concurrence cycle rather than resuming mid-flow; any disposition, approvers, or approval round recorded before the rejection are kept as history but do not carry forward as active state.
- This feature does not change who is eligible to act as QA staff, Originator, or Originator Designate, nor anything about NCR Issuance, Preventive Action handling, Physical Disposition, Close Out, or Final Distribution.
- This feature does not add a limit on how many times an NCR can be rejected and resubmitted over its lifetime.
