# Feature Specification: Backfill Traveler Classification Metadata

**Feature Branch**: `008-backfill-traveler-metadata`

**Created**: 2026-11-15

**Status**: Draft

**Input**: User description: "The admin or owner can update the released form's meta information:   subsystem, device, and activity. There are travelers that were created before a released form has this information. In this change, when the released form's meta information is upated, check all the travelers cretead from this release form including version string, if the traveler's corresponding meta information is empty, update that. The traveler metadate is not tracked by history yet. Leave history consideration to the future."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Correcting Old Travelers When Form Metadata Is Fixed (Priority: P1)

A form owner or admin notices that a released form's Subsystem, Device, or Activity classification is missing or wrong, and corrects it on the released form. Travelers that were created from that exact released form before the classification was available (so they still have blank values for one or more of those fields) should pick up the correction automatically, without anyone having to open and edit each traveler by hand.

**Why this priority**: This is the entire point of the change — closing the gap left by travelers that were created before the released form had classification data. Without this, the classification effort on the released form never reaches the travelers that need it most.

**Independent Test**: Can be fully tested by releasing a form, creating a traveler from it (so the traveler's Subsystem/Device/Activity are blank because the released form had none), then setting the released form's Subsystem, Device, and Activity, and verifying the existing traveler's matching blank fields are updated to the new values.

**Acceptance Scenarios**:

1. **Given** a released form with a blank Activity and a traveler created from it that also has a blank Activity, **When** the owner or admin sets the released form's Activity to a value, **Then** the traveler's Activity is updated to that same value.
2. **Given** a released form linked to several travelers, each missing different combinations of Subsystem/Device/Activity, **When** the owner or admin updates one or more of the released form's classification fields, **Then** each linked traveler is updated only for the fields it was missing, independently of the others.
3. **Given** a released form with no travelers created from it yet, **When** its classification metadata is updated, **Then** the update completes normally with no other records affected.

---

### User Story 2 - Existing Traveler Data Is Never Disturbed (Priority: P1)

A user who has already set or inherited a non-blank Subsystem, Device, or Activity value on a traveler — whether it came from the released form at creation time or was entered later — needs that value to stay exactly as they left it, even after someone edits the released form's classification metadata. Likewise, travelers that belong to a different released form (or a different released version of the same form) must not be touched by an update to this released form.

**Why this priority**: The backfill is only safe to ship if it is strictly additive. If it could overwrite a value someone already set, or reach travelers outside the released form being edited, it would silently corrupt data users rely on.

**Independent Test**: Can be fully tested by creating a traveler whose Subsystem is already set (either inherited or edited), then updating the released form's Subsystem to a different value, and verifying the traveler's Subsystem is unchanged; separately, by creating travelers from two different released forms and verifying that updating one released form never changes the other's travelers.

**Acceptance Scenarios**:

1. **Given** a traveler whose Subsystem already has a non-blank value, **When** the released form it was created from has its Subsystem changed to a different value, **Then** the traveler's Subsystem is left unchanged.
2. **Given** two released forms (or two separately released versions of the same form title), each with their own travelers, **When** one released form's classification metadata is updated, **Then** travelers created from the other released form or version are unaffected.
3. **Given** a traveler with a blank Subsystem but a non-blank Device, **When** the released form's Subsystem and Device are both updated, **Then** only the traveler's Subsystem is filled in; its existing Device value is untouched.

---

### Edge Cases

- Released form metadata is updated but the new value for a given field is itself blank (the field was cleared, not filled in) — there is nothing to propagate for that field, so no linked traveler changes for it.
- A traveler is in an approved, frozen, or archived state and has a blank classification field — it is still corrected, since this is an automatic data correction filling in previously-missing information, not a user-initiated edit subject to the normal lifecycle edit restrictions on those fields.
- A released form's metadata is "updated" with the exact same values it already had — the check-and-fill still runs; the outcome for every linked traveler is identical to before (idempotent).
- A released form has a very large number of linked travelers — the update to the released form still succeeds and all eligible travelers are corrected; this is not expected to be a common case for this system.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: After an owner or admin successfully updates a released form's Subsystem, Device, or Activity, the system MUST find every traveler that was created from that exact released form, matched by both the released form's identifier and its version string.
- **FR-002**: For each traveler found, the system MUST evaluate its Subsystem, Device, and Activity fields independently and, for each one that is currently blank, set it to the released form's current value for that field.
- **FR-003**: The system MUST NOT change a traveler's Subsystem, Device, or Activity if that field already holds a non-blank value, regardless of what the released form's value changed to.
- **FR-004**: The system MUST NOT modify any traveler that was not created from the exact released form (identifier and version string) being updated, including travelers created from a different released version of the same form title.
- **FR-005**: This automatic correction MUST be applied the same way regardless of the traveler's current lifecycle status (not started, in progress, submitted for review, approved, frozen, or archived).
- **FR-006**: The released form's own metadata update MUST continue to be recorded in the released form's existing history/audit trail exactly as it is today.
- **FR-007**: The automatic correction of traveler fields MUST NOT create a traveler-side history/audit entry; traveler classification metadata is not yet tracked by history, and that remains out of scope for this change.
- **FR-008**: The existing permission rule for who may update a released form's classification metadata (the form's owner or an admin) MUST remain unchanged; this feature does not introduce any new permission, since the traveler correction is an automatic side effect of that existing action rather than a direct edit of the traveler.

### Key Entities

- **Released Form**: An approved, immutable form snapshot that other work is built from. Relevant to this feature: a unique identifier, a version string, and its Subsystem/Device/Activity classification values, which the owner or an admin can edit after release.
- **Traveler**: A work instance created from a released form. Relevant to this feature: the identifier and version string of the released form it was created from, and its own Subsystem/Device/Activity values — originally copied from the released form when the traveler was created, but independently blank or filled in since.
- **Relationship**: A traveler is considered to have been "created from" a released form when its stored released-form identifier and version string match that released form's. A released form may have zero, one, or many travelers linked to it this way; a released form's metadata update only affects travelers linked to it exactly.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After an owner or admin fills in a previously-blank classification value on a released form, 100% of that released form's existing travelers that were missing that value show the corrected value with no manual per-traveler edit required.
- **SC-002**: 100% of traveler classification values that were already set before a released form's metadata update remain exactly as they were afterward — zero unintended overwrites.
- **SC-003**: 100% of travelers linked to any other released form, or to a different released version, remain unchanged after an unrelated released form's metadata update.
- **SC-004**: Updating a released form's classification metadata completes and confirms success to the owner or admin without a noticeable increase in wait time compared to today, even when the released form has a sizeable number of linked travelers.

## Assumptions

- "Blank" means the field holds the schema default empty string, or is otherwise unset; no additional trimming or whitespace-normalization is introduced beyond whatever already applies when a value is saved.
- The check-and-fill runs synchronously as part of handling the released form's metadata update, so that by the time the owner or admin sees a success response, all eligible travelers have already been corrected.
- Because the correction only ever fills in a field that was genuinely blank and never overwrites a value a person already set, it is treated as a data correction rather than a restricted user edit, and so is applied regardless of a traveler's lifecycle status.
- Only the three fields that are copied from the released form at traveler-creation time (Subsystem, Device, Activity) are in scope. The traveler-only fields (Machine Area, Sector, Product Windchill ID) have no released-form counterpart and are not touched by this change.
- Per the user's explicit instruction, no history/audit trail for traveler-side metadata changes is introduced by this feature; that is left for a future change.
