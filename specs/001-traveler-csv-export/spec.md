# Feature Specification: Traveler CSV Export

**Feature Branch**: `001-traveler-csv-export`

**Created**: 2026-08-23

**Status**: Draft

**Input**: User description: "create a way to export the data of a tranveler in CSV format. For a given traveler id, the output should include, traveler link, id, title, status. It include all the data collected in the traveler with lable, type, value, input by, and input datetime."

## Clarifications

### Session 2026-08-23

- Q: When you say "add date field name in the output for reference," do you mean adding the internal field name/key as its own column, or adding a header row so each column is labeled by name? → A: Add a new column with the field's internal name/key (e.g., `name`) next to Label, for every data row — a stable reference identifier.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Export a traveler's data for sharing or record-keeping (Priority: P1)

As a user who has access to a traveler, I want to download all of its collected data as a
CSV file, so that I can share it with people or systems outside the application, archive it, or
analyze it in a spreadsheet tool.

**Why this priority**: This is the core capability being requested. Without it, no export exists;
with only this story implemented, the feature already delivers standalone value.

**Independent Test**: Can be fully tested by requesting an export for a traveler that has existing
data and verifying the resulting CSV contains the traveler's identifying details and one row per
value ever submitted for each of its data fields.

**Acceptance Scenarios**:

1. **Given** a traveler the user can view, with several data fields already filled in, **When**
   the user requests a CSV export for that traveler's id, **Then** the system produces a CSV file
   containing the traveler's link, id, title, and status, followed by one row per collected data
   field showing its internal field name, label, type, value, who entered it, and when it was
   entered.
2. **Given** a traveler the user can view, with some fields still unanswered, **When** the user
   requests the export, **Then** the CSV includes a row for every defined field, with unanswered
   fields showing an empty value, input-by, and input-on.
3. **Given** a traveler the user does NOT have permission to view, **When** the user requests the
   export, **Then** the system denies the request and no traveler data is disclosed.
4. **Given** a traveler where one field has been submitted more than once (e.g., a corrected
   reading), **When** the user requests the export, **Then** the CSV includes a separate row for
   each submitted value for that field, in the order they were entered, not only the latest one.

---

### User Story 2 - Identify the source traveler from the exported file alone (Priority: P2)

As someone who receives an exported CSV (a colleague, an auditor, or another system), I want the
file to clearly state which traveler it came from and its current status, so the file remains
traceable and meaningful outside the application.

**Why this priority**: Makes exports self-describing and reduces the risk of a file being
misfiled or misattributed once it leaves the system. Secondary to simply having the data.

**Independent Test**: Hand an exported CSV to someone unfamiliar with the traveler and confirm
they can identify which traveler it is and its current status without any other context.

**Acceptance Scenarios**:

1. **Given** an exported CSV file, **When** it is opened in a spreadsheet application, **Then**
   the traveler's link, id, title, and current status are visible at the top of the file, before
   any collected data rows.

---

### User Story 3 - Human-readable status and field labels (Priority: P3)

As a user reviewing an export, I want statuses and field names shown in plain language rather
than internal codes or keys, so the file is understandable without needing to consult the source
application.

**Why this priority**: Usability polish. The export is functional without it, but significantly
less useful to a reader outside the system.

**Independent Test**: Export travelers in several different lifecycle statuses and confirm the
status column always shows the human-readable name; confirm the label column matches the text
shown for that field in the traveler's own view.

**Acceptance Scenarios**:

1. **Given** a traveler that is currently in progress, **When** it is exported, **Then** the
   status column shows the human-readable status name rather than a numeric code.
2. **Given** a data field displayed with a specific label in the traveler's view, **When** the
   traveler is exported, **Then** that same label text appears in the corresponding CSV row.

---

### Edge Cases

- What happens when a traveler has no data fields defined yet? The export MUST still include the
  traveler's identifying information, with no data rows (or a clear indication that no data has
  been collected).
- How does the system handle a collected value that contains commas, quotation marks, or line
  breaks? The CSV MUST escape such values so the file remains correctly structured when opened in
  standard spreadsheet tools.
- What happens when the requested traveler id does not exist, or has been deleted? The system
  MUST report that the traveler was not found and produce no file.
- How does the system represent a collected field whose value is an uploaded file/attachment
  rather than typed text? The export MUST represent it with a readable text reference rather than
  embedding binary content.
- How does the system behave for a traveler with a very large number of data fields? The export
  MUST complete and include every field without truncating data.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a user with read access to a specific traveler to request a CSV
  export of that traveler by specifying the traveler's id.
- **FR-002**: System MUST deny the export request when the requesting user does not have read
  access to the traveler, consistent with the traveler's existing access rules (owner, reviewer,
  shared user/group, or public access).
- **FR-003**: The exported CSV MUST identify the source traveler by including its link (a
  reference that navigates back to the traveler within the application), id, title, and current
  status.
- **FR-004**: The exported CSV MUST render the traveler's status as its human-readable name, not
  an internal numeric code.
- **FR-005**: The exported CSV MUST include, for every data field defined in the traveler, one
  row for each value ever submitted for that field, each row showing: the field's internal name
  (a stable reference key), its label, its input type, the submitted value, who entered it, and
  when it was entered. A field submitted more than once MUST produce one row per submission
  (oldest first), not only its most recent value.
- **FR-006**: When a data field has not yet been answered, the exported row for that field MUST
  still appear, with the value, input-by, and input-on shown as empty.
- **FR-007**: The system MUST escape or quote exported values as needed so that commas,
  quotation marks, and line breaks inside a value do not break the CSV's row/column structure.
- **FR-008**: The system MUST return an error, and produce no export file, when the requested
  traveler id does not exist or is not accessible to the requesting user.
- **FR-009**: For data fields whose recorded value is a file/attachment, the export MUST show a
  readable reference to that file (such as its name) rather than embedding the file's contents.

### Key Entities

- **Traveler**: A work instance created from a released form. For this feature, the traveler
  contributes its id, title, current lifecycle status, and a link back to itself.
- **Traveler Data Field**: A single piece of data collected within a traveler. Contributes an
  internal field name (a stable reference key), a label (display name), a type (kind of input),
  the recorded value, who entered it, and when it was entered.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user with access to a traveler can obtain a complete CSV export of that
  traveler's data in under 5 seconds for typical travelers (up to roughly 200 data fields).
- **SC-002**: 100% of the data fields defined in a traveler, and 100% of the values ever
  submitted for each of them, appear as rows in its export, with none omitted.
- **SC-003**: A person unfamiliar with the source system can correctly identify the exported
  traveler (its id, title, and status) from the file alone within 10 seconds of opening it.
- **SC-004**: 0 export files are produced for users who lack read access to the requested
  traveler, across all tested access scenarios.
- **SC-005**: Exported files open correctly, with all rows and columns intact, in common
  spreadsheet applications for 100% of tested travelers, including ones containing special
  characters in field values.

## Assumptions

- Access to export a traveler is governed by the same read-permission rules already used to view
  that traveler; no new permission tier is introduced for exporting.
- "All the data collected in the traveler" refers to the traveler's data field entries, not its
  separate notes or discrepancy log entries.
- "Traveler link" means a reference (such as a URL) that navigates back to the traveler within
  the application.
- Each field defined in the traveler contributes one row per value ever submitted for it,
  ordered oldest first, or a single empty row if it has not been filled in yet.
- The CSV is generated on demand and reflects the traveler's data at the time of the request,
  rather than being a pre-generated or cached snapshot.
