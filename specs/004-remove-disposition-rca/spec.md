# Feature Specification: Remove Root Cause Analysis from CE/CS Disposition

**Feature Branch**: `004-remove-disposition-rca`

**Created**: 2026-08-22

**Status**: Draft

**Amends**: `specs/001-ncr-workflow/spec.md` — User Story 2 (CE/CS Performs Engineering Disposition)

## Summary of Change

Root Cause Analysis ("Root Cause of Problem") is removed from the CE/CS disposition form. CE/CS is no longer asked to document the root cause of the nonconformance when submitting their disposition. All other disposition fields remain unchanged.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - CE/CS Submits Disposition Without Root Cause Analysis (Priority: P1)

The CE/CS accesses the disposition form and completes the engineering disposition
without any Root Cause field being present. The mandatory fields are: Parts
Disposition (one of the five defined options), Rework/Repair Instructions (only
when Rework or Repair is selected), and at least one Preventive Action. No root
cause field appears on the form and no root cause data is collected or recorded.

**Why this priority**: This is the entire scope of the change — the form must
not collect root cause analysis. All downstream views and records that previously
displayed root cause must also not show it.

**Independent Test**: Can be fully tested by opening the disposition form on a
Submitted NCR and confirming (a) no Root Cause field is present, (b) a valid
submission succeeds with only Parts Disposition and Preventive Actions filled,
and (c) the saved disposition record contains no root cause data.

**Acceptance Scenarios**:

1. **Given** an NCR is in "Submitted" status and the CE/CS accesses the
   disposition form, **When** the form loads, **Then** no "Root Cause of
   Problem" (or equivalent) field is visible on the form
2. **Given** the CE/CS has selected a non-Rework/Repair disposition option and
   entered at least one preventive action, **When** they submit, **Then** the
   system accepts the submission and transitions the NCR to "Dispositioned"
   status without requesting any root cause information
3. **Given** the CE/CS has selected Rework or Repair and provided the required
   instructions and at least one preventive action, **When** they submit,
   **Then** the submission succeeds without requiring root cause information
4. **Given** a CE/CS attempts to submit with Parts Disposition selected but no
   preventive actions entered, **When** they click submit, **Then** the system
   displays a validation error for the missing preventive action — with no
   mention of root cause
5. **Given** a disposition has been submitted, **When** QA Staff views the
   disposition details (on the NCR detail, concurrence, or approval page),
   **Then** no root cause field or label is shown anywhere in the disposition
   summary

### Edge Cases

- A disposition submitted before this change (containing root cause data in the
  database) must not crash any view page — existing `root_cause_documentation`
  values in the database are silently ignored by the UI.
- The server-side validation must not reject a disposition payload that omits
  `root_cause_documentation`, even if an older client sends it.

---

## Requirements *(mandatory)*

### Functional Requirements

The following requirements amend `specs/001-ncr-workflow` FR-018, FR-021,
FR-023, FR-025.

- **FR-018 (amended)**: System MUST NOT require or collect root cause of the
  nonconformance from the CE/CS. The root cause field is removed from the
  disposition form entirely.
- **FR-021 (amended)**: System MUST record the CE/CS identity, parts
  disposition selection, preventive actions, and (when applicable)
  rework/repair instructions. Root cause documentation is no longer recorded.
- **FR-023 (amended)**: System MUST prevent disposition submission if any of
  the following mandatory fields are missing: parts disposition option,
  at least one preventive action description (minimum 50 characters each), or
  rework/repair instructions when Rework or Repair is selected. Root cause is
  no longer a mandatory (or optional) field for submission.
- **FR-025 (amended)**: System MUST show the complete NCR history including
  nonconformance details and CE/CS-provided disposition (parts disposition,
  preventive actions, rework/repair instructions if applicable). Root cause
  is no longer shown in any disposition summary view.
- **FR-026 (no change)**: QA concurrence behavior is unchanged.

### Key Entities

- **NCR Disposition** (embedded in NCR document): The `root_cause_documentation`
  field remains in the data model for backward compatibility with existing records
  but is no longer populated by new submissions. No migration is required.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The disposition form contains zero fields related to root cause
  analysis — verified by inspecting the rendered form with any browser.
- **SC-002**: A CE/CS can complete and submit the full disposition workflow
  without encountering any root cause prompt or validation error.
- **SC-003**: All existing disposition view pages (NCR detail, concurrence,
  approval) render without error for both old records (with root cause data)
  and new records (without root cause data).
- **SC-004**: No regression in other disposition validations — Parts
  Disposition, Rework/Repair Instructions, and Preventive Actions remain
  enforced as before.

---

## Assumptions

- Preventive Actions remain mandatory on the disposition form; only Root Cause
  is removed.
- The `root_cause_documentation` field is kept in the database schema at the
  model level for backward compatibility — existing stored values are not
  deleted or migrated.
- No downstream reporting or dashboard feature currently depends on root cause
  data being present on new submissions; if a root cause filter or trending
  report exists, it will simply show no new data after this change.
- This change applies to the web disposition form and the disposition API
  endpoint equally — neither should require or validate root cause going forward.
