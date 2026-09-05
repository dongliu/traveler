# Feature Specification: Concurrence Multi-Approver (No Role)

**Feature Branch**: `121-concurrence-multi-approver`

**Created**: 2026-09-05

**Status**: Draft

**Input**: User description: "when QA submits Concurrence, allow the QA to add multiple approvers. Do not specify the role of approver."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Add Multiple Approvers at Concurrence (Priority: P1)

When a QA user submits a concurrence on a dispositioned NCR, they can designate zero or more additional approvers by username only. If approvers are added, each must approve before the NCR advances; if none are added, the NCR moves directly to Final Approval.

**Why this priority**: Core of the feature — without this, the multi-approver flow cannot function at all.

**Independent Test**: Open a dispositioned NCR as QA, navigate to the concurrence screen, add two usernames, submit concurrence, and verify both designated users receive an approval request and the NCR status reflects pending approval.

**Acceptance Scenarios**:

1. **Given** an NCR in Dispositioned status, **When** the QA opens the concurrence screen, **Then** a panel to add approvers by username is visible with no role field present.
2. **Given** the QA has entered one or more valid usernames, **When** they submit the concurrence, **Then** each designated user receives an approval request and the NCR moves to Approved status pending their responses.
3. **Given** the QA has added no approvers, **When** they submit the concurrence, **Then** the NCR advances directly to Final Approval without waiting for additional approvals.

---

### User Story 2 - Prevent Duplicate Approvers (Priority: P2)

The QA cannot add the same username twice to the approver list in a single concurrence submission.

**Why this priority**: Prevents ambiguous approval state where the same person appears multiple times, which would complicate the approval workflow.

**Independent Test**: Attempt to add the same username twice on the concurrence screen and verify the second addition is silently ignored or produces an inline warning, leaving only one entry for that user.

**Acceptance Scenarios**:

1. **Given** a username already in the approver list, **When** the QA attempts to add the same username again, **Then** the duplicate entry is not added and the list remains unchanged.

---

### User Story 3 - Remove an Approver Before Submission (Priority: P2)

The QA can remove a previously added approver from the list before submitting the concurrence.

**Why this priority**: Mistakes when entering usernames should be recoverable before committing the concurrence.

**Independent Test**: Add two approvers, remove one, submit, and confirm only the remaining approver receives a request.

**Acceptance Scenarios**:

1. **Given** one or more approvers in the list, **When** the QA clicks the remove action for an entry, **Then** that entry is removed from the list immediately.
2. **Given** an approver was removed before submission, **When** the QA submits the concurrence, **Then** the removed user does not receive an approval request.

---

### Edge Cases

- What happens when the QA enters a username that does not exist in the system?
- What happens when the approver list is empty and the QA submits — does the NCR bypass approval correctly?
- How does the system behave if the same NCR concurrence is submitted twice (duplicate submission)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The concurrence form MUST allow the QA to add zero or more approvers by username.
- **FR-002**: The concurrence form MUST NOT include a role field when adding an approver — only the username is captured.
- **FR-003**: The system MUST prevent the same username from being added to the approver list more than once per concurrence submission.
- **FR-004**: The QA MUST be able to remove an approver from the list before submitting the concurrence.
- **FR-005**: When approvers are designated, the system MUST send each approver a notification or approval request upon concurrence submission.
- **FR-006**: When no approvers are designated, the system MUST advance the NCR directly to Final Approval upon concurrence submission.
- **FR-007**: The concurrence screen MUST display the current list of added approvers so the QA can review before submitting.

### Key Entities

- **NCR (Non-Conformance Report)**: The work record being concurred; its status transitions from Dispositioned → Approved (pending approvals) or directly to Final Approval (no approvers).
- **Additional Approver**: A person designated by QA at concurrence time, identified by username only (no role). Each approver must take action before the NCR advances.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: QA can add, view, and remove multiple approvers on the concurrence screen in a single session without page reloads between actions.
- **SC-002**: Submitting a concurrence with N approvers results in exactly N approval requests dispatched — no more, no fewer.
- **SC-003**: Submitting a concurrence with zero approvers always results in the NCR advancing to Final Approval without waiting for any additional actions.
- **SC-004**: No role field is present or submitted anywhere in the concurrence approver flow.

## Assumptions

- The existing username autocomplete (Bloodhound typeahead) available elsewhere in the NCR system will be reused for approver username entry, so QA can find users without memorizing exact usernames.
- Approver notification on submission follows the same email mechanism already used for other NCR workflow transitions.
- The existing `additional_approvers` data structure on the NCR model is retained; the `approver_role` field will simply no longer be populated or displayed.
- There is no minimum number of approvers required — zero is a valid submission.
- Only users with QA access can access the concurrence screen; no additional permission change is in scope.
