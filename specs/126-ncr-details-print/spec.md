# Feature Specification: Extend Traveler Print Output with NCR Details

**Feature Branch**: `126-ncr-details-print`

**Created**: 2026-10-18

**Status**: Draft

**Input**: User description: "Extend the pdf print for completed traveler to include NCR details in the output pdf. The will be mainly update the views/traveler-print.jade file and corresponding js. The NCR details should be at the end of PDF one after the other. No Event History is needed for each NCR. The output should include the review records by default."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every linked NCR's details, gathered at the end of the printed record (Priority: P1)

A user printing (or saving as PDF) a completed traveler sees, after the traveler's own content, the full detail of every nonconformance report (NCR) that was ever raised against one of that traveler's inputs — one after another — without that NCR's event history. Today the printed traveler shows nothing about its linked NCRs at all; a reviewer has to separately open each one.

**Why this priority**: This is the explicit, primary ask, and the reason the feature exists — a printed traveler is not a complete quality record today without the NCRs raised against it.

**Independent Test**: Print (or save as PDF) a completed traveler that has two or more linked NCRs in different statuses, and confirm every one of them appears, with its substantive detail, gathered together after the traveler's own content, in the same order every time, with no NCR missing and no event-history listing shown for any of them.

**Acceptance Scenarios**:

1. **Given** a completed traveler with NCRs linked to more than one of its inputs, **When** the user prints it (or saves it as a PDF), **Then** every one of those NCRs' details appears in the output, gathered together after the traveler's own content, one after another, in the same top-to-bottom order as the inputs they were raised against appear on the traveler's form — not, for example, in the order the NCRs happen to have been created.
2. **Given** an NCR included in the printed output, **When** the user reads that NCR's section, **Then** it shows the NCR's substantive detail (identification, part/supplier/reference information, nonconformance description, people involved, disposition, review/approval, preventive actions, closure information, and attachment file names) but does not show that NCR's event history.
3. **Given** a completed traveler with no NCRs linked to any of its inputs, **When** the user prints it, **Then** the output states that no NCRs exist for the traveler rather than silently showing nothing.
4. **Given** a traveler that is not completed, **When** the user views it, **Then** nothing about this feature changes — NCR details are only ever added to a completed traveler's printed output, the same scope the print/"Create PDF" action is already limited to today.

---

### User Story 2 - Review/approval records included automatically (Priority: P2)

A user printing a completed traveler sees the traveler's own review/approval history — who approved or rejected it, and when — without doing anything extra to reveal it. Today the printed traveler shows none of this; only the traveler's normal edit page does, and only there.

**Why this priority**: This completes the printed record as a quality document (who signed off on it, and when) but is scoped below User Story 1 because the NCR content is the larger, explicitly primary request.

**Independent Test**: Print a completed traveler that went through a review, and confirm the review history — every recorded outcome, not just the one that produced the final approval — appears without the user toggling anything on.

**Acceptance Scenarios**:

1. **Given** a completed traveler that was reviewed and approved, **When** the user prints it, **Then** the output shows every recorded review outcome (approved or rejected), who gave it, and when — automatically, with no extra action required to reveal it.
2. **Given** a completed traveler with no review history on record (e.g., completed by a direct status change rather than a formal review), **When** the user prints it, **Then** the output states that no review records exist rather than omitting the section without explanation.

---

### Edge Cases

- A linked NCR is still open at print time — its current, in-progress detail (whatever has been recorded so far) is shown as-is; any field not yet filled in is shown as blank/not applicable rather than breaking the output. (In practice a traveler cannot reach Completed while any of its linked NCRs is open, so this case is defensive rather than expected.)
- A traveler has a large number of linked NCRs, or an NCR has a large amount of detail — the printed output still includes all of it, spanning as many printed pages as needed.
- NCR or review free-text content (descriptions, comments) contains characters that look like markup — the printed output shows it as plain readable text, never as interpreted markup, so nothing a user typed can alter the structure of the page.
- A review result was later voided or superseded by a newer one — it is still shown, marked as voided, rather than silently dropped or presented as if it were still current.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When a completed traveler is printed (or saved as a PDF), the output MUST include, after the traveler's own content, a section for every NCR linked to that traveler (raised against one of its inputs), regardless of that NCR's own status.
- **FR-002**: Each NCR's section MUST show the same categories of substantive detail already shown on that NCR's own detail record: identification, part/supplier/reference information, nonconformance description, people involved, disposition, review/approval, preventive actions, closure information, and attachment file names.
- **FR-003**: Each NCR's section MUST NOT show that NCR's event history.
- **FR-004**: All of a traveler's linked NCRs MUST be gathered together, one after another, after the traveler's own content — not interleaved with it.
- **FR-005**: When a traveler has no linked NCRs, the printed output MUST state that explicitly rather than silently omitting the section.
- **FR-006**: The printed output MUST include the traveler's own review/approval history — every recorded outcome (approved or rejected), who gave it, and when — automatically, without the user needing to toggle it on or take any extra action.
- **FR-007**: When a traveler has no review history on record, the printed output MUST state that explicitly rather than omitting the section without explanation.
- **FR-008**: This additional content MUST be produced through the same printing/"Create PDF" action already available for a completed traveler, adding no new steps.
- **FR-009**: NCR and review free-text content MUST be rendered as plain readable text, never interpreted as active markup, so content a user typed cannot alter the structure of the printed page.
- **FR-010**: NCRs MUST appear in the same order as the inputs they were raised against appear on the traveler's form, top to bottom; when more than one NCR was raised against the same input, those MUST appear together, in the order they were raised.
- **FR-011**: This feature MUST NOT change which travelers the print/"Create PDF" action is available for, or any of the output's existing behavior (e.g., its validation/notes/details show-hide controls) — it only adds the NCR and review content described above.

### Key Entities

- **Traveler**: The work instance being printed; already shown in the output today. Unchanged by this feature except for the new content appended to it.
- **NCR (Nonconformance Report)**: Raised against one of the traveler's inputs. Every NCR linked to the traveler — regardless of status — gets its own section in the printed output, with its substantive detail but excluding its own event history.
- **Review Record**: One entry in the traveler's own approval history — who reviewed it, whether they approved or rejected it, and when. Shown in full, automatically, as part of the printed output.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a completed traveler with any number of linked NCRs, printing it includes 100% of those NCRs' details, gathered together after the traveler's own content, in the same top-to-bottom order as the traveler's own inputs, with no event-history listing for any of them.
- **SC-002**: For a completed traveler with review history, printing it shows every recorded review outcome without the user performing any action beyond the single print/"Create PDF" action already in use today.
- **SC-003**: Printing a completed traveler with no linked NCRs, or no review history, clearly states so rather than presenting an unexplained gap.
- **SC-004**: Printed output never renders NCR or review free-text content as active markup, verified by printing a traveler/NCR whose text fields contain characters that look like markup and confirming the page's structure is unaffected.

## Assumptions

- Scope stays limited to a completed traveler, the same restriction the print/"Create PDF" action already has today; this feature does not change when that action is available.
- "All NCRs" means every NCR whose link identifies this traveler as the one it was raised from (via one of its inputs), regardless of that NCR's status — the same set already used elsewhere in the app to list a traveler's linked NCRs.
- "No Event History" refers specifically to an NCR's own chronological event/action log; every other category of its detail already shown on its own detail record is included.
- "Review records... by default" means the review history is always part of the printed output automatically — unlike the page's existing validation/notes/details controls, which stay as optional, user-toggled content and are unaffected by this feature.
- The review history shown is the traveler's complete recorded history — every outcome, including a later-voided or superseded one (clearly marked as such) — the same full history already available elsewhere for this traveler, not narrowed to only the result(s) behind the final approval.
- NCRs are listed in the same order their linked inputs appear on the traveler's form (top to bottom) — the same order a reader scanning the traveler itself would encounter them — not by when each NCR was raised. An NCR whose linked input is no longer on the form (e.g., the form changed since) is listed after every NCR whose input is still recognized, in the order it was raised relative to other such NCRs.
