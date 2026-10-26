# Feature Specification: NCR Approval Rounds

**Feature Branch**: `129-ncr-approval-round`

**Created**: 2026-10-25

**Status**: Draft

**Input**: User description: "There is an issue with the state transition now (lib/ncr-state-machine.js). After additional approvals are requested, the approvers review and submit decision. When any decision is return for comment, the current round of approval is stopped, and the NCR should return to Dispositioned state, where the QA can decide what to do next. This will require a concept of approval round, that is similar to the the review round implemented in model/review.js. Only when an existing approval round is fully approved state, then the NCR can go to finalApprove state. There should be no path from 'Approval Requested' or 'Returned for Comment' to go to Final Approval. Call out anything I need to clarify."

## Clarifications

### Session 2026-10-25

- Q: Any NCR currently sitting in 'Returned for Comment' status today will no longer fit the schema once that status is retired from the NCR itself. How should the system handle already-persisted NCRs in that status? → A: Assume none exist — no migration; treat as a non-issue since no NCR in an environment that matters is currently in that status.
- Q: Within a still-open round, can an approver change a decision they already submitted (e.g., approve, then later also submit a return-for-comment, or vice versa) before the round closes? → A: No — once an approver submits a decision for the round, it is final; a second submission from that same approver for that same round is rejected.
- Q: When a round is stopped by one approver's "Return for Comment," should the other, not-yet-decided approvers be notified that the round ended, or does notification stay QA-only? → A: QA-only — no notification to not-yet-decided approvers; a later attempt by one of them to act on the stale request is simply rejected with a clear error.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - An approver's "Return for Comment" sends the NCR back to QA, not into limbo (Priority: P1)

Today, when QA has asked one or more approvers to weigh in on an NCR, and one of them returns it for comment, the NCR gets stuck: the QA has no clean way to see the round stopped and decide what happens next, and in some cases the NCR can even reach Final Approval despite an unresolved "return for comment" still sitting on the record. QA needs the NCR to land back in a state where QA is squarely back in control, with full visibility into who returned it and why, and can decide the next step.

**Why this priority**: This is the exact defect reported — any NCR that goes through additional approvals and gets a single "return for comment" today either stalls or can advance to Final Approval incorrectly. Fixing this is the core value of the feature.

**Independent Test**: Put an NCR in Approval Requested with two or more designated approvers. Have one approver submit "Return for Comment." Confirm the NCR's status is now Dispositioned, the approver's comment is visible, and QA can take a disposition-stage action (concur with no approvers, or concur with a chosen set of approvers) from there.

**Acceptance Scenarios**:

1. **Given** an NCR in Approval Requested with approvers A and B both still undecided, **When** approver A submits "Return for Comment" with a required comment, **Then** the NCR's status becomes Dispositioned, approver A's comment is recorded and visible, and approver B is no longer asked to decide on that round.
2. **Given** an NCR in Approval Requested with approver A already Approved and approver B still undecided, **When** approver B submits "Return for Comment," **Then** the NCR's status becomes Dispositioned (A's earlier approval does not keep the NCR moving forward), and QA can see that the round stopped because of B's comment.
3. **Given** an NCR that is back in Dispositioned after a round was stopped, **When** QA submits a new concurrence decision, **Then** QA can choose to proceed with no approvers (sending the NCR directly to Final Approval) or designate a new set of approvers (starting a new approval round), exactly as QA could the first time the NCR reached Dispositioned.

---

### User Story 2 - Approvers must decide fresh in each new round (Priority: P2)

When QA starts a new approval round after a previous one was stopped, every approver designated for that new round — even someone who already approved in the stopped round and is being asked again — must submit a current decision before the NCR can move forward. A decision made in an earlier, stopped round never counts toward a later round.

**Why this priority**: This is what makes "approval round" a real guardrail rather than a cosmetic label. Without it, the defect in User Story 1 could resurface in a different shape (an NCR advancing on the strength of stale approvals from a round that was already abandoned).

**Independent Test**: Stop a round with approvers A (Approved) and B (Returned for Comment). From Dispositioned, start a new round with the same approvers A and B. Confirm the NCR does not advance to Final Approval until both A and B submit new decisions for this round, even though A already approved once before.

**Acceptance Scenarios**:

1. **Given** a stopped round where approver A had already approved before the round was stopped, **When** QA starts a new round that again designates approver A, **Then** approver A's NCR view shows no recorded decision for the new round, and the NCR cannot reach Final Approval until A (and every other approver on the new round) submits a fresh Approved decision.
2. **Given** a new round where every designated approver has now submitted a fresh "Approved" decision, **When** the last of them approves, **Then** the NCR transitions to Final Approval.

---

### User Story 3 - The NCR's history shows which round each decision belongs to (Priority: P3)

An NCR may go through more than one approval round over its life. Anyone looking at the NCR's existing event/activity history should be able to tell which round a given approver decision belongs to, so it's clear which decisions led to a round being stopped and which belong to the round that eventually succeeded (or is still open).

**Why this priority**: This is an audit/traceability improvement that depends on the round concept existing, but isn't required for the core defect fix to deliver value, so it can follow the first two stories.

**Independent Test**: Take an NCR that went through a stopped round and a second, successful round. Open its event history and confirm each approver-decision event is tagged with the round it belongs to, distinguishing round 1 (stopped) from round 2 (fully approved).

**Acceptance Scenarios**:

1. **Given** an NCR with one stopped round and one later, fully-approved round, **When** QA or any other viewer opens the NCR's event history, **Then** each approver decision event is labeled with its round number, and the stopped round's events are distinguishable from the later round's events.

---

### Edge Cases

- Two approvers in the same round submit decisions at nearly the same time, and one of them is "Return for Comment": only the first decision processed stops the round and moves the NCR to Dispositioned; the other approver's decision, if it reaches the system after the round is already stopped, is rejected with a clear error rather than silently recorded against a round that is no longer open.
- QA removes the last still-undecided approver from an open round while every remaining approver has already approved in that same round: the round completes (vacuously) and the NCR advances to Final Approval, the same outcome as if that approver had approved.
- After a round is stopped, QA decides approvers are no longer needed at all (e.g., the disposition changed in a way that resolves the concern): QA can concur with no approvers and send the NCR directly to Final Approval — a stopped round does not force a future round to happen.
- An approver who was designated for a round but never submitted a decision before that round was stopped by someone else's "Return for Comment" is not asked again for that stopped round; they are only asked again if a later round designates them.
- QA adds or removes an approver while a round is open (Approval Requested, no one has returned it for comment yet): allowed, unchanged from today. Once any approver in that round has returned it for comment, the round is already stopped, so there is no longer an open round to add or remove approvers from.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST treat each concurrence decision by which QA designates one or more approvers for an NCR as the start of a new, sequentially numbered approval round for that NCR, distinct from any earlier round on the same NCR.
- **FR-002**: Within an open round, System MUST let each approver designated for that round submit exactly one decision of either Approve or Return for Comment (Return for Comment continues to require a comment). Once an approver has submitted a decision for that round, it is final: a further decision submitted by the same approver for the same round MUST be rejected with a clear error rather than overwriting the recorded decision.
- **FR-003**: The instant any approver in the current round submits a Return for Comment decision, System MUST stop that round — no further decision from another approver on that same round is accepted — and MUST transition the NCR directly from Approval Requested to Dispositioned.
- **FR-004**: System MUST NOT retain or reintroduce "Returned for Comment" as a status value of the NCR itself; it remains only the recorded decision of the individual approver who returned it, within their round.
- **FR-005**: System MUST transition an NCR from Approval Requested to Final Approval only when every approver designated in the current, still-open round has an Approved decision recorded for that exact round (vacuously true if that round, after any approver removals, has no designated approvers left), and only while the NCR is in Approval Requested status.
- **FR-006**: System MUST NOT provide any way for an NCR to reach Final Approval directly out of a round that has already been stopped by a Return for Comment decision; reaching Final Approval after a round is stopped requires QA to act again from Dispositioned (see FR-007) and that subsequent round (or no-approver concurrence) to complete.
- **FR-007**: Once an NCR is back in Dispositioned after a round is stopped, System MUST let QA take the same next-step actions available at the original disposition: concur with no approvers (sending the NCR directly to Final Approval) or concur with a chosen set of approvers (starting a new approval round).
- **FR-008**: When a new approval round starts, System MUST require every approver designated for that round to submit a current decision before the round can be considered fully approved, regardless of what any of them decided in an earlier round for the same NCR — a decision from a previous round never counts toward a later round.
- **FR-009**: System MUST retain the full decision record of every past approval round for an NCR (which approvers were designated, what each decided, and when) rather than overwriting or discarding it when a new round starts.
- **FR-010**: System MUST label each approver-decision event in the NCR's existing event/activity history with the approval round it belongs to, so a viewer can tell which round a given decision was made in.
- **FR-011**: System MUST continue to let QA add or remove a designated approver only while the current round is still open (NCR status is Approval Requested and no approver in that round has yet returned it for comment).
- **FR-012**: System MUST continue to notify QA when a round is stopped by a Return for Comment decision, identifying which approver returned it and their comment. System MUST NOT send any notification to approvers who had not yet decided when the round stopped; if one of them later attempts to act on their now-stale request, that attempt is handled by FR-014.
- **FR-013**: System MUST continue to send the existing issuance notification when an NCR reaches Final Approval, regardless of how many rounds preceded it.
- **FR-014**: System MUST reject, with a clear error, any approval decision submitted against a round that is no longer open (for example, one approver's decision arriving after another approver already stopped the same round).

### Key Entities

- **Approval Round**: One attempt, for a given NCR, to collect decisions from a specific set of QA-designated approvers. Has a sequence number (1, 2, 3, …) unique within the NCR, the list of approvers designated for that round together with each one's current decision and comments, and an outcome once it ends (fully approved, or stopped by a return-for-comment). Only the most recent round can still be open; all earlier rounds for the NCR are retained as history.
- **Approver Decision**: One approver's recorded choice (Approve or Return for Comment, with comments when returning) within one specific approval round. A decision belongs to exactly one round and does not carry over to any other round.
- **NCR** *(existing entity, behavior changed)*: Reaches Final Approval only by way of a round that became fully approved while the NCR was in Approval Requested status. No longer has "Returned for Comment" as a possible value of its own status; that status is now expressed only at the level of an individual approver's decision.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every time an approver returns an NCR for comment, the NCR is visible to QA in Dispositioned status, with the returning approver's identity and comment visible, with no follow-up action required from anyone other than QA to make that happen.
- **SC-002**: 100% of NCRs that reach Final Approval do so carrying a round in which every approver designated for that exact round has an Approved decision — zero NCRs reach Final Approval while carrying an unresolved or stale Return for Comment decision from any round.
- **SC-003**: QA can start a second or later approval round, or bypass approvers entirely, using the exact same steps available when the NCR first reached Dispositioned — no additional step is required solely because a prior round was stopped.
- **SC-004**: For any NCR that has gone through more than one approval round, a viewer can determine from the NCR's own history which approvers were asked and what each one decided, separately for every round, without needing help from engineering or support.

## Assumptions

- No NCR in any environment that matters is currently persisted in "Returned for Comment" status; this feature does not include a data migration step for pre-existing records in that status (see Clarifications).
- Removing "Returned for Comment" as an NCR-level status also removes it from status dashboards/counts, status-based filters, and any view logic that branches on the NCR being in that status; those surfaces are updated to reflect that the NCR is in Dispositioned instead. The approver-level "Returned for Comment" decision value is unaffected.
- A new approval round always requires every one of its designated approvers to submit a fresh decision; no prior round's decision is ever carried forward automatically, even if the same person is designated again and even if they had approved before.
- Starting a new round after a stop uses the same mechanism QA already uses to designate approvers from Dispositioned (choosing who to ask); it is not required to reuse the same approver list as the stopped round.
- QA retains full discretion at Dispositioned after a stop, including concurring with no approvers at all — a stopped round does not obligate a future round to occur before Final Approval can be reached.
- Round history is surfaced within the NCR's existing event/activity timeline (each approval-related event tagged with its round number); this feature does not add a separate, standalone "round history" page or section.
- This feature does not change who is eligible to act as QA staff or as an approver, how the original disposition is authored or revised, or anything about the Final Approval → Closed transition.
- The existing notification sent to QA when an approver returns an NCR for comment may continue to describe the event as a "return for comment" in its wording, even though the NCR's persisted status field is now Dispositioned rather than a distinct "Returned for Comment" value.
