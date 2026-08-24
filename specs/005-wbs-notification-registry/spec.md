# Feature Specification: WBS Notification Registry

**Feature Branch**: `005-wbs-notification-registry`

**Created**: 2026-08-22

**Status**: Draft

**Input**: User description: "A wbs number is a string with segments connected by `.`. each wbs number is associated to a string which is an email address which should be notified for an NCR associated with the wbs numbner. Allow the admin to create and update a list of wbs numbers. Each wbs number should be unique in the list."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin Views the WBS Notification Registry (Priority: P1)

An Admin opens the WBS Notification Registry and sees every WBS number currently on file, each paired with its notification email address.

**Why this priority**: Every other capability in this feature (add, update, remove) depends on the Admin first being able to see the current state of the registry. Without a view, the registry is unmanageable.

**Independent Test**: Can be fully tested by having an Admin with existing registry entries open the registry page and confirm each WBS number is shown together with its associated email address.

**Acceptance Scenarios**:

1. **Given** the registry has one or more entries, **When** an Admin opens the registry, **Then** they see every WBS number and its associated notification email address
2. **Given** the registry has no entries, **When** an Admin opens the registry, **Then** they see an empty-state message rather than an error

---

### User Story 2 - Admin Adds a WBS Number to the Registry (Priority: P1)

An Admin adds a new WBS number to the registry along with the email address that should be notified for NCRs associated with that WBS number.

**Why this priority**: This is the core data-entry action that populates the registry in the first place; without it there is nothing to view, update, or remove.

**Independent Test**: Can be fully tested by having an Admin submit a well-formed, not-yet-used WBS number and a valid email address, then confirming the new entry appears in the registry.

**Acceptance Scenarios**:

1. **Given** an Admin supplies a WBS number not already in the registry and a syntactically valid email address, **When** they submit the entry, **Then** the system saves it and it appears in the registry
2. **Given** an Admin supplies a WBS number that does not match the required dot-segmented format (e.g. empty, or containing empty segments such as `"1..2"`, `".1.2"`, or `"1.2."`), **When** they submit the entry, **Then** the system rejects it with a clear format error and does not save it
3. **Given** an Admin supplies a WBS number that already exists in the registry, **When** they submit the entry, **Then** the system rejects it with a clear "already exists" error and does not create a duplicate or alter the existing entry
4. **Given** an Admin supplies an email address that is not syntactically valid, **When** they submit the entry, **Then** the system rejects it with a clear validation error and does not save it

---

### User Story 3 - Admin Updates the Notification Email for a WBS Number (Priority: P1)

An Admin changes the notification email address associated with a WBS number that is already in the registry, without changing the WBS number itself.

**Why this priority**: Notification recipients change over time (staff turnover, reorganization); the registry must stay accurate or NCR notifications reach the wrong (or no) recipient.

**Independent Test**: Can be fully tested by having an Admin select an existing WBS number, submit a new valid email address for it, and confirm the registry reflects the new email while the WBS number itself is unchanged.

**Acceptance Scenarios**:

1. **Given** a WBS number already in the registry, **When** an Admin submits a new syntactically valid email address for it, **Then** the system saves the change and the registry shows the updated email for that WBS number
2. **Given** a WBS number already in the registry, **When** an Admin submits a new email address that is not syntactically valid, **Then** the system rejects the update with a clear validation error and the previously saved email is unchanged
3. **Given** a WBS number that no longer exists in the registry (e.g. removed by another Admin moments earlier), **When** an Admin attempts to update it, **Then** the system rejects the update with a clear "not found" error

---

### User Story 4 - Admin Removes a WBS Number from the Registry (Priority: P2)

An Admin removes a WBS number from the registry entirely, for example because the WBS number was retired or entered in error.

**Why this priority**: Important for keeping the registry accurate over time, but the registry is still usable without it in the short term (an unwanted entry can be corrected via update); lower priority than the core add/update/view capabilities.

**Independent Test**: Can be fully tested by having an Admin remove an existing WBS number and confirming it no longer appears in the registry.

**Acceptance Scenarios**:

1. **Given** a WBS number already in the registry, **When** an Admin removes it, **Then** it no longer appears in the registry
2. **Given** a WBS number that does not exist in the registry, **When** an Admin attempts to remove it, **Then** the system reports a clear "not found" error rather than silently succeeding

---

### Edge Cases

- What happens when two Admins edit the same WBS number's email at nearly the same time? The later save wins; no data corruption or duplicate entries should result.
- What happens when a WBS number is submitted with extra surrounding whitespace? Leading/trailing whitespace is trimmed before validation and storage, so `" 1.2 "` is treated the same as `"1.2"`.
- What happens when an Admin submits the exact same WBS number that already exists but with different letter casing (e.g. registry has `WBS.1.2`, Admin submits `wbs.1.2`)? Matching is case-sensitive, so this is treated as a different, new WBS number (see Assumptions).
- What happens when a non-Admin user attempts any registry action directly (bypassing the UI)? The action is rejected as unauthorized, and the registry is unchanged.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow an Admin to view every WBS number currently in the registry together with its associated notification email address
- **FR-002**: System MUST allow an Admin to add a new WBS number and an associated notification email address to the registry
- **FR-003**: System MUST validate that a WBS number consists of one or more non-empty segments separated by single `.` characters, with no leading, trailing, or consecutive dots
- **FR-004**: System MUST reject an attempt to add a WBS number that already exists in the registry (exact, case-sensitive match), without altering the existing entry
- **FR-005**: System MUST validate that the notification email address is syntactically valid before saving it
- **FR-006**: System MUST allow an Admin to update the notification email address for a WBS number already in the registry, without changing the WBS number itself
- **FR-007**: System MUST allow an Admin to remove a WBS number from the registry
- **FR-008**: System MUST restrict viewing, adding, updating, and removing registry entries to users with Admin privileges
- **FR-009**: System MUST reject update or removal attempts against a WBS number that is not in the registry, with a clear "not found" error
- **FR-010**: System MUST record which Admin added or last changed each entry, and when

### Key Entities

- **WBS Notification Contact**: One registry entry. Attributes: WBS number (dot-segmented string; unique key), notification email address, who created/last updated the entry, when it was created/last updated.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An Admin can add a new WBS number and its notification email to the registry in under 30 seconds
- **SC-002**: 100% of attempts to add a WBS number that already exists in the registry are rejected, with zero duplicate entries ever created
- **SC-003**: 100% of attempts to save a malformed WBS number or an invalid email address are rejected before being stored
- **SC-004**: An Admin can locate any existing WBS number in the registry and update its notification email using only the WBS number itself, without needing any other technical identifier
- **SC-005**: 100% of attempts by non-Admin users to add, update, or remove registry entries are blocked

## Out of Scope

- Automatically sending a notification email to the registered address when an NCR is created, updated, or reaches any particular status. This feature builds and maintains the registry data only; wiring an actual NCR-triggered notification against this registry is a separate, future feature.
- Validating or cross-referencing the free-text WBS Number field already captured on NCR creation against this registry. The two remain independent until a future feature connects them.
- Bulk import/export of registry entries.

## Assumptions

- "The admin" refers to a user holding this application's existing Admin role; no new role is introduced by this feature.
- WBS number matching for uniqueness, update, and removal is case-sensitive and exact (after trimming surrounding whitespace) — `WBS.1.2` and `wbs.1.2` are treated as distinct entries.
- Each WBS number maps to exactly one notification email address, matching the feature description's "associated to a string which is an email address" (singular).
- "Update" is limited to changing the notification email for an existing WBS number; changing the WBS number itself is treated as removing the old entry and adding a new one (User Story 4 + User Story 2), not as an in-place rename.
- Although the feature description says only "create and update," the ability to remove an entry (User Story 4) is included as a reasonable, expected part of managing a unique-keyed list over time, consistent with standard list-management conventions.
