# Feature Specification: Form & Traveler Metadata Fields

**Feature Branch**: `003-form-traveler-metadata`

**Created**: 2026-09-12

**Status**: Draft

**Input**: User description: "add more metadata to released form and traveler. add Subsystem, Device, Activity to released form. request user to input these when releasing a base form. for forms already released, make these properties editable. When a traveler is created from a released form, the Subsystem, Device, Activity will be copied to the new traveler. Add Machine Area, Sector, Product Windchill ID to traveler, and allow user to update them."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Provide Metadata When Releasing a Form (Priority: P1)

A form owner submitting a draft form for release is prompted to provide three classification fields — Subsystem, Device, and Activity — before the release is finalized. These fields describe what the form covers so that travelers created from it carry meaningful context from the start.

**Why this priority**: Without this data at release time, all existing and future travelers will lack classification context. Getting the data at the earliest natural checkpoint (release) avoids a retroactive bulk-update problem.

**Independent Test**: Can be fully tested by creating a draft form, initiating the release flow, and verifying that the three new fields are presented, required, and persisted on the resulting released form.

**Acceptance Scenarios**:

1. **Given** a form in draft state, **When** the owner initiates the release action, **Then** the system presents input fields for Subsystem, Device, and Activity before confirming the release.
2. **Given** the release form with Subsystem, Device, and Activity filled in, **When** the owner confirms release, **Then** the released form record stores all three values and the form transitions to released state.
3. **Given** the release form with one or more fields left blank, **When** the owner attempts to confirm release, **Then** the system accepts the release (fields are optional) and stores whatever values were provided.

---

### User Story 2 - Edit Metadata on an Already-Released Form (Priority: P2)

A form manager who needs to correct or add classification data on a previously released form can edit Subsystem, Device, and Activity without changing the form's released state or its content.

**Why this priority**: Forms released before this feature is deployed will have no classification data; users need a way to backfill them without going through a full re-release cycle.

**Independent Test**: Can be fully tested by opening an existing released form and verifying that Subsystem, Device, and Activity are editable fields, changes save successfully, and the form remains in released state.

**Acceptance Scenarios**:

1. **Given** a released form with no classification data, **When** the owner or an admin edits the metadata fields, **Then** the updated values are saved and immediately visible on the form detail page.
2. **Given** a released form with existing classification data, **When** a user with edit access changes one or more values, **Then** only the changed fields are updated; form state and other attributes are unchanged.
3. **Given** a released form, **When** a user without edit access views the form, **Then** classification fields are shown as read-only and no edit controls are presented.

---

### User Story 3 - Traveler Inherits Classification From Released Form (Priority: P1)

When a traveler is created from a released form, the Subsystem, Device, and Activity values are automatically copied to the new traveler, so users do not have to re-enter data already recorded on the form.

**Why this priority**: Automatic inheritance is the core value of capturing data at the form level; if travelers don't inherit it, the classification effort is wasted.

**Independent Test**: Can be fully tested by creating a traveler from a released form that has all three fields populated, then verifying those values appear on the traveler without manual entry.

**Acceptance Scenarios**:

1. **Given** a released form with Subsystem, Device, and Activity populated, **When** a traveler is created from that form, **Then** the traveler's Subsystem, Device, and Activity are pre-populated with the form's values.
2. **Given** a released form where some classification fields are blank, **When** a traveler is created, **Then** the blank fields remain blank on the traveler (no placeholder or error).
3. **Given** a traveler that inherited classification values, **When** a user views the traveler, **Then** the inherited values are visible without any additional action.

---

### User Story 4 - Update Traveler-Specific Metadata (Priority: P2)

A user working on a traveler can set or update all six metadata fields — the inherited Subsystem, Device, and Activity, as well as the traveler-specific Machine Area, Sector, and Product Windchill ID — at any point during the traveler's active lifecycle. This lets a user correct an inherited classification value (e.g., the released form's Subsystem no longer matches this specific instance) alongside capturing instance-specific deployment context.

**Why this priority**: Inherited values are a starting point, not a permanent lock — the traveler instance sometimes needs a different Subsystem/Device/Activity than its source form (e.g., the form is reused across a slightly different scope). The three traveler-specific fields capture deployment context (where and what product the traveler applies to) that is specific to each work instance and cannot be known at form-release time.

**Independent Test**: Can be fully tested by opening a traveler in any active state and verifying that all six fields (Subsystem, Device, Activity, Machine Area, Sector, Product Windchill ID) are editable, changes persist, and the fields are shown on the traveler detail page.

**Acceptance Scenarios**:

1. **Given** a traveler in any active state (not started, in progress, or submitted for review), **When** the user updates any of the six metadata fields, **Then** the new values are saved and shown on the traveler.
2. **Given** a traveler in an approved or frozen state, **When** a non-admin user attempts to update any of the six fields, **Then** the system rejects the update (fields are read-only for non-admins once approved).
3. **Given** a traveler where Product Windchill ID is set, **When** the user views the traveler, **Then** the Windchill ID is displayed in a way that distinguishes it from free-text fields (e.g., labeled clearly).
4. **Given** a traveler that inherited Subsystem/Device/Activity from its released form, **When** the user edits one of those fields on the traveler, **Then** the traveler's value changes but the source released form's value is unaffected.

---

### Edge Cases

- What happens when a form is released without Subsystem, Device, or Activity — travelers created from it must still be creatable with those fields blank.
- How does the system handle a released form's metadata being edited after one or more travelers have already been created from it? The existing travelers retain their inherited values; they are not retroactively updated.
- What happens if a user tries to update traveler metadata (Machine Area, Sector, Windchill ID) on an archived traveler? The system must reject the update.
- Windchill ID format: assumed to be a free-text string; no format validation is imposed (users are responsible for correct entry).

## Requirements *(mandatory)*

### Functional Requirements

**Released Form — Classification Fields**

- **FR-001**: The released form data model MUST include three optional text fields: Subsystem, Device, and Activity.
- **FR-002**: When a form owner initiates the release action for a draft form, the system MUST present input controls for Subsystem, Device, and Activity as part of the release flow.
- **FR-003**: The system MUST persist the Subsystem, Device, and Activity values provided during release onto the released form record.
- **FR-004**: The form owner and admins MUST be able to edit Subsystem, Device, and Activity on an already-released form without changing its released state.
- **FR-005**: Users without edit access MUST see Subsystem, Device, and Activity as read-only on a released form.

**Traveler — Inherited and Instance Fields**

- **FR-006**: When a traveler is created from a released form, the system MUST automatically copy Subsystem, Device, and Activity from the released form to the new traveler as the traveler's initial values.
- **FR-007**: The traveler data model MUST include Subsystem, Device, and Activity fields (initially populated from the released form) and three additional optional fields: Machine Area, Sector, and Product Windchill ID.
- **FR-008**: Users with write access MUST be able to set or update any of the six metadata fields (Subsystem, Device, Activity, Machine Area, Sector, Product Windchill ID) on a traveler that is in an active state (not started, in progress, or submitted for review). Editing these fields on the traveler MUST NOT change the source released form's values.
- **FR-009**: Traveler metadata updates (any of the six fields) MUST be rejected for travelers in approved, frozen, or archived states unless the requesting user is an admin.
- **FR-010**: All six metadata fields MUST be visible on the traveler detail view.

### Key Entities

- **Released Form**: An immutable snapshot of an approved form template. Gains three new optional text fields: `subsystem`, `device`, `activity`. These are set at release time and may be edited post-release by the owner or admin.
- **Traveler**: A work instance created from a released form. Gains six metadata fields: `subsystem`, `device`, `activity` (copied from the released form at creation), and `machineArea`, `sector`, `windchillId` (set by users during the traveler's lifecycle).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can provide all three classification fields (Subsystem, Device, Activity) and complete the form release in under one additional minute compared to the current release flow.
- **SC-002**: 100% of travelers created after this feature is deployed have their Subsystem, Device, and Activity fields automatically populated when the source released form has those values set.
- **SC-003**: A user can update all three traveler-specific fields (Machine Area, Sector, Product Windchill ID) in a single save action with no page reload required.
- **SC-004**: All six metadata fields on a traveler are visible without scrolling past the primary traveler information on a standard desktop display.

## Assumptions

- Subsystem, Device, Activity, Machine Area, Sector, and Product Windchill ID are all free-text fields with no enforced format or controlled vocabulary; validation is limited to maximum length.
- All six fields are optional; no existing workflows are blocked if they are left blank.
- Editing classification fields on a released form is a metadata-only update and does not constitute a new form revision or trigger a re-review workflow.
- Travelers already created before this feature is deployed will have blank classification fields; no backfill migration is planned (users may update traveler-specific fields manually).
- The released form's classification fields (Subsystem, Device, Activity) on existing released forms are editable immediately after deployment without any migration step, since the fields simply default to empty.
- Access control for editing form classification fields follows the existing form ownership model: owner and admins may edit; other users may not.
- Access control for updating traveler metadata follows the existing traveler write-access model; the approved/frozen/archived restriction aligns with the state machine in the constitution.
- The `saveWithHistory` audit trail applies to all metadata updates on both released forms and travelers, per the project constitution.
