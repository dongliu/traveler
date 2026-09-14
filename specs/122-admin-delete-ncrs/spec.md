# Feature Specification: Admin NCR Deletion

**Feature Branch**: `122-admin-delete-ncrs`

**Created**: 2026-09-13

**Status**: Draft

**Input**: User description: "similar to travelers, allow the admin user to delete NCRs. Only admin can perform this operation. The admin can select one or more NCRs from the dashboard, and perform deletion. All records of the deleted NCRs including files attached should be removed."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin Deletes One or More NCRs from the Dashboard (Priority: P1)

An administrator viewing the NCR dashboard selects one or more NCRs and permanently deletes them in a single action. On confirmation, the system removes each selected NCR entirely — its record and any attached files — from the system. Users without the admin role never see this capability and cannot perform it even by calling the underlying operation directly.

**Why this priority**: This is the entire scope of the feature. Without it, there is no supported way to remove an NCR that was created in error, duplicated, or otherwise needs to be purged from the system.

**Independent Test**: Can be fully tested by logging in as an admin, selecting one or more NCRs on the dashboard, confirming deletion, and verifying the selected NCRs and their attachment files no longer exist anywhere in the system, while unrelated NCRs are unaffected.

**Acceptance Scenarios**:

1. **Given** an admin is viewing the NCR dashboard, **When** they select one or more NCRs and choose to delete them, **Then** the system asks for confirmation naming the NCR(s) to be deleted before proceeding
2. **Given** an admin has confirmed deletion of one or more selected NCRs, **When** the deletion completes, **Then** those NCRs no longer appear on the dashboard or in any NCR lookup, and any files attached to them are also removed from storage
3. **Given** an admin selects multiple NCRs at once, **When** they confirm deletion, **Then** all selected NCRs are deleted together and the admin sees a summary of how many were deleted
4. **Given** a user who is not an admin views the NCR dashboard, **When** the page renders, **Then** no delete/selection controls are shown to them
5. **Given** a non-admin user attempts to invoke the deletion capability directly (bypassing the dashboard UI), **When** the request is processed, **Then** it is rejected and no NCR is deleted
6. **Given** an admin attempts to delete a batch where one selected NCR no longer exists (e.g., already deleted by another admin moments earlier), **When** the deletion is processed, **Then** the system completes deletion of the remaining valid selections and reports which one(s) could not be found, rather than failing the entire batch
7. **Given** an NCR has reached "Closed" status, **When** an admin selects it for deletion, **Then** it can be deleted the same as an NCR in any other status — no lifecycle stage is protected from deletion

### Edge Cases

- What happens when an admin selects zero NCRs and clicks delete? The delete action is disabled/unavailable until at least one NCR is selected.
- What happens if a file attached to an NCR being deleted is already missing from storage? Deletion of the NCR record still proceeds; a missing file is not treated as a blocking error.
- What happens when two admins attempt to delete overlapping selections at the same time? The admin whose request processes second and finds an NCR already gone is handled per the batch-reporting behavior in Acceptance Scenario 6, not treated as a failure.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow only users with the admin role to delete NCRs.
- **FR-002**: System MUST hide or disable NCR deletion controls for any user who does not have the admin role.
- **FR-003**: System MUST reject a deletion attempt from a non-admin user — whether attempted through the dashboard or by calling the underlying operation directly — and delete nothing in that case.
- **FR-004**: System MUST let an admin select one or more NCRs from the dashboard list before initiating deletion.
- **FR-005**: System MUST require the admin to confirm the deletion before it is carried out, identifying which NCR(s) will be deleted.
- **FR-006**: System MUST permanently remove the entire record of each deleted NCR, including its disposition, preventive actions, approver history, and event/notification history.
- **FR-007**: System MUST remove every file attached to a deleted NCR from storage, not just its reference in the NCR record.
- **FR-008**: System MUST process a multi-NCR deletion as a single batch action and report to the admin how many NCRs were successfully deleted.
- **FR-009**: System MUST NOT fail an entire batch deletion because one selected NCR could not be found or had already been deleted; it MUST delete the remaining valid selections and report the exception.
- **FR-010**: System MUST NOT allow a deleted NCR or its data to be recovered through any user-facing feature — deletion is permanent.
- **FR-011**: System MUST allow deletion of an NCR regardless of its current status, including "Closed" — no lifecycle stage is excluded from deletion.
- **FR-012**: System MUST NOT retain any record that a given NCR ever existed or was deleted once deletion completes — no separate deletion log, audit entry, or trace is kept outside the NCR's own (now-removed) record.

### Key Entities

- **NCR**: The nonconformance report record being deleted, including its embedded disposition, preventive actions, approver list, and event/notification history — all removed as a unit when the NCR is deleted.
- **NCR Attachment**: A file uploaded to an NCR and stored outside the database; must be removed from storage when its parent NCR is deleted.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can select and permanently delete one or more NCRs from the dashboard, including confirmation, in under 1 minute.
- **SC-002**: 100% of files attached to a deleted NCR are removed from storage as part of the same operation that deletes the NCR record.
- **SC-003**: Zero non-admin users are able to delete an NCR, whether through the dashboard or by calling the underlying operation directly, across all attempts.
- **SC-004**: After deletion, a deleted NCR no longer appears in any dashboard view, count, or report, and no orphaned data (database or file) remains for it.

## Assumptions

- "Admin" refers to the existing administrator role already used elsewhere in the system to gate other administrative actions (e.g., deleting a Traveler); no new role is introduced by this feature.
- Deletion is a hard delete (permanent removal from the database and file storage), not a soft/archive flag — mirroring how Traveler deletion already works in this system, but additionally removing attached files, which Traveler deletion today does not do.
- The confirmation step is a standard "are you sure" dialog naming the selected NCR(s); no additional re-authentication (e.g., re-entering a password) is required.
- There is no limit on how many NCRs can be selected for deletion in a single batch beyond what is visible/selectable on the dashboard at one time.
- Deletion is permitted on an NCR in any status, including "Closed" — the admin role carries the discretion to delete any NCR, and no deletion audit trail is retained after the fact (per the resolved clarifications above).
- QA/notification group configuration and any other unrelated NCR functionality are unaffected by this feature.
