# Feature Specification: Show People's Full Names Instead of Initials or User IDs

**Feature Branch**: `006-user-full-name-display`

**Created**: 2026-11-01

**Status**: Draft

**Input**: User description: "In the current implementation, the user is either displayed with a holder image from `personColumn` (public/javascripts/table.js:99) or user id (public/javascripts/public-travelers.js:79). Make a chage to display the user's full name (model/user.js:8). This means the user name should be polulated from services providing the data to render the pages."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Recognize who did what in form, traveler, and binder lists (Priority: P1)

A manager, reviewer, or form owner is scanning a list of forms, travelers, binders, or reviews (for example, "Created by", "Updated by", "Released by", "Archived by", "Reviewer", or "Added by") to figure out who is responsible for an item or who to follow up with. Today that column shows only a generic avatar icon with a single initial, so the viewer has to hover or click through to another page to learn who it actually is. They need to see the person's actual name at a glance.

**Why this priority**: This is the most common and most visible instance of the problem — it appears across nearly every list/table view in the application (forms, travelers, binders, released forms, reviews) and directly blocks the everyday task of identifying people from a list.

**Independent Test**: Open any list view that shows a "created by", "updated by", "released by", "archived by", "cloned by", "added by", or "reviewer" column and confirm the person's full name is shown in place of the single-letter avatar icon.

**Acceptance Scenarios**:

1. **Given** a list view (forms, travelers, binders, released forms, or reviews) with a column identifying a person by their account, **When** the page loads, **Then** the column shows that person's full name as text instead of a placeholder avatar icon.
2. **Given** a person's account has no full name on record, **When** their row is displayed, **Then** the column falls back to showing their account identifier (today's behavior) instead of an empty or broken cell.

---

### User Story 2 - Recognize who owns a publicly shared traveler (Priority: P2)

A user browsing the public travelers dashboard wants to know who created or last updated a traveler so they can reach out with a question. Today the "created by" / "updated by" information shows the bare account identifier (e.g., a login name) rather than a readable name.

**Why this priority**: This is a second, independently-reachable surface with the same underlying problem, but it affects one dashboard rather than every list in the app, so it is slightly less broadly impactful than User Story 1.

**Independent Test**: Open the public travelers dashboard, confirm the "Created" and "Updated" information shows the person's full name rather than their bare account identifier.

**Acceptance Scenarios**:

1. **Given** the public travelers dashboard lists a traveler, **When** the page loads, **Then** the "created by" and "updated by" information displays the person's full name alongside the date, as it does today for the date.
2. **Given** a traveler's recorded creator or updater no longer has a resolvable account, **When** the row is displayed, **Then** the information falls back to the stored account identifier instead of showing nothing.

---

### Edge Cases

- What happens when the underlying account identifier does not match any known person (for example, historical data referencing an account that was later removed)? The display falls back to showing the stored identifier, matching current behavior, rather than showing a blank or an error.
- What happens when a person's record exists but their full name has never been populated? Same fallback as above: show the stored identifier.
- What happens when the same list contains a very long full name next to a short one? Columns must still remain readable (truncation/wrapping is acceptable; the full name must not break the table layout).
- Sorting and filtering on these columns (several list views let a viewer filter/search a "by" column) must continue to work, now matching against the displayed full name rather than the account identifier.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every list/table view that identifies a person by account (including, but not limited to, "created by", "updated by", "released by", "archived by", "cloned by", "added by", reviewer, and traveler/document owner) MUST display that person's full name instead of a placeholder avatar icon.
- **FR-002**: The public travelers dashboard MUST display the full name of the person who created or last updated each traveler, in place of the bare account identifier it shows today.
- **FR-003**: When a person's full name cannot be determined (no matching account record, or the record has no name on file), the system MUST fall back to showing the stored account identifier, so no cell is ever left blank or broken.
- **FR-004**: The full name shown MUST come from each person's own account record, not be entered or edited as part of the form/traveler/binder data itself, so it always reflects the person's current name on file.
- **FR-005**: Existing search, filter, and sort behavior on these "person" columns MUST continue to work, operating against the person's full name once it is displayed.
- **FR-006**: The change MUST apply consistently everywhere the current avatar-icon or bare-account-identifier display pattern is used today, so a viewer sees full names uniformly rather than names in some lists and identifiers or icons in others.

### Key Entities

- **Person (User)**: An account in the system with a stored full name and a unique account identifier. The full name is what should be shown to viewers; the account identifier remains the fallback and the underlying key used to look up the full name.
- **Attributed Record (Form, Traveler, Binder, Review, Released Form)**: A record that stores, for various lifecycle events, which account performed the action (created, updated, released, archived, cloned, added, reviewed). Each such reference is a link to a Person, not a copy of their name.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A viewer can identify who created, updated, released, archived, or reviewed any item in a list view by reading the list alone, without hovering, clicking through, or opening another page.
- **SC-002**: 100% of list views that currently show the placeholder avatar icon or a bare account identifier for a person show that person's full name instead, after the change.
- **SC-003**: When a person's full name is unavailable, the viewer still sees a usable value (the account identifier) in 100% of cases — zero blank or broken cells.
- **SC-004**: Existing filtering and sorting on person-identifying columns continues to return correct results after the change.

## Assumptions

- "Full name" means the name already stored on each person's account record (populated from the organization's existing identity source), not a new field a user would type in.
- The avatar-icon pattern and the bare-account-identifier pattern described in the feature request are representative of every list/table and dashboard in the application that identifies a person by account; this change is applied uniformly to all of them rather than to only the two call sites named in the request.
- Replacing the single-letter avatar icon with the full name as text is acceptable visually; no new profile photo or richer identity card is in scope.
- Because every affected view already requires the viewer to be signed in (or authenticated to the API), showing full names instead of account identifiers does not introduce a new exposure to anonymous/unauthenticated users.
- Historical records that reference an account identifier with no matching or named account (e.g., a removed account) are rare enough that falling back to the stored identifier is an acceptable, non-blocking outcome rather than something requiring data cleanup as part of this feature.
