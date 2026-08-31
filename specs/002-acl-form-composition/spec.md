# Feature Specification: ACL Form Composition on Release

**Feature Branch**: `002-acl-form-composition`

**Created**: 2026-08-29

**Status**: Draft

**Input**: User description: "allow the user to release a new form with compistion of multiple previously released forms. This is similar to the discrepancy form feature, but have the following difference: 1. the new released form type is for ACL; 2. the user can chose multiple ACL forms to be added into the release form with one base form; 3. assume the use will choose either one/zero discrepancy form; or zero/one/multiple ACL forms when release a form. We need to consider a good way to define the released form ver (string). The way to derive the released form with just one discrepancy form will not work out of box in this case."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Compose a released form from existing released forms (Priority: P1)

An authorized user composes a brand-new released form by picking one already-released base form and zero, one, or multiple already-released ACL forms, so the system publishes a single bundled, versioned record combining the base template with the relevant ACL documentation — without re-authoring or re-releasing the base form itself. This is a distinct action from the existing single-form release flow: it operates on forms that are already released, not on a draft form being released for the first time.

**Why this priority**: This is the core capability requested — without it there is no way to compose several previously-released forms into one published record.

**Independent Test**: Can be fully tested by composing one released base form with two released ACL forms and confirming the resulting released form references the base and both ACL forms with their snapshotted content.

**Acceptance Scenarios**:

1. **Given** a released base form and two released ACL forms exist, **When** the user selects the base and both ACL forms and composes, **Then** a new released form is created referencing the base and both ACL forms.
2. **Given** a released base form exists and no ACL forms are selected, **When** the user composes with the base form only, **Then** a new released form is created referencing only the base — a valid, minimal composition (zero attached ACL forms).
3. **Given** a released base form and exactly one released ACL form, **When** the user selects both, **Then** the resulting release includes exactly that one ACL form.

---

### User Story 2 - ACL sections are fillable in the resulting traveler (Priority: P2)

A user working a traveler created from a composed released form sees every attached ACL form rendered at the top of the traveler, ahead of the base form's content, and can enter values into those ACL sections as needed, so ACL-related data is captured as part of the same work record.

**Why this priority**: A composition that cannot actually be used during traveler execution delivers little practical value — this is what makes the composed release usable by the people doing the work, not just an archival record.

**Independent Test**: Can be fully tested by creating a traveler from a released form composed with two ACL forms, confirming both ACL sections appear at the top of the traveler, and confirming values entered into them are saved.

**Acceptance Scenarios**:

1. **Given** a traveler created from a released form composed with two ACL forms, **When** the traveler is opened, **Then** both ACL forms' input sections are displayed at the top of the traveler, before the base form's content.
2. **Given** the ACL sections are displayed, **When** the user enters values into ACL fields, **Then** those values are captured and saved as part of the traveler's record, the same way base form field values are.
3. **Given** a traveler created from a released form with zero attached ACL forms (base-only composition), **When** the traveler is opened, **Then** no ACL section is displayed and the traveler behaves exactly as it does today.

---

### User Story 3 - Duplicate compositions are blocked, distinct ones are not (Priority: P3)

A user composing released forms is prevented from accidentally publishing a redundant duplicate of an existing composition (the same base plus the same set of ACL forms), while still being free to publish any genuinely different combination — a different base, a different set of ACL forms, or a different number of ACL forms.

**Why this priority**: Important for data integrity and avoiding confusing duplicate records, but the feature is still usable without it — it's a safeguard on top of the core composition capability.

**Independent Test**: Can be fully tested by composing the same base + ACL form combination twice and confirming the second attempt is blocked, then composing a different combination and confirming it succeeds.

**Acceptance Scenarios**:

1. **Given** an existing active composed released form referencing base B and ACL forms {A1, A2}, **When** a user attempts to compose the identical combination (B + A1 + A2) again, **Then** the system blocks it as a duplicate.
2. **Given** the same base B and ACL forms {A1, A2}, **When** a user selects them in a different order (A2 then A1) and composes, **Then** the system still recognizes it as the same combination and blocks it as a duplicate — selection order does not matter.
3. **Given** an existing composition of base B + ACL forms {A1, A2}, **When** a user composes base B with a different set (e.g., {A1, A3}, or {A1} alone), **Then** the system allows it as a distinct, new composition.

---

### User Story 4 - Audit the composition from the released form detail view (Priority: P4)

A user viewing a composed released form's detail page can see the identity and version of the base form and of every attached ACL form, so the composition is transparent without inspecting raw data.

**Why this priority**: Valuable for traceability and audit, but not required for the composition or traveler-rendering capabilities to function correctly.

**Independent Test**: Can be fully tested by composing a released form with two ACL forms, then opening its detail page and confirming the base and both ACL forms' titles and versions are listed.

**Acceptance Scenarios**:

1. **Given** a composed released form with two attached ACL forms, **When** a user views its detail page, **Then** the title and version of the base form and of each attached ACL form are visible.

---

### Edge Cases

- What happens if a user selects the same released form as both the base and one of the ACL attachments? The system must reject this — a form cannot be composed with itself.
- What happens if the same ACL form is selected more than once in a single composition request? The system must de-duplicate or reject rather than attaching it twice.
- What happens if a selected base or ACL form is archived (or otherwise stops being released) between when the user opens the compose action and when they submit it? The system must re-validate at submission time and reject the composition with a clear error.
- What happens if a selected "ACL" attachment is actually not of the ACL form type (e.g., a mis-tagged form)? The system must reject the composition, consistent with how a non-discrepancy form is rejected as a discrepancy attachment today.
- What happens to travelers already created from a composition whose released form later becomes archived? They continue to function; only the ability to create new travelers from that released form is affected, consistent with how archiving works for released forms today.
- What happens when a composed released form itself gets a new version (e.g., is later archived and re-composed)? Each compose action produces a new, independently versioned released form; it does not mutate a prior composition.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST support a new form type, "ACL," that is authored, submitted for review, and released using the same lifecycle already used by other form types (draft → submitted for review → released → archived).
- **FR-002**: The system MUST provide a distinct "compose released form" action, separate from the existing single-form release action, that lets an authorized user select exactly one already-released base form (of the standard type) and zero, one, or multiple already-released ACL forms, and publish them together as one new released form.
- **FR-003**: The compose action MUST be independent of the existing discrepancy-form-attachment mechanism; composing with ACL forms and attaching a discrepancy form remain two separate release paths and are never combined in a single release.
- **FR-004**: The system MUST only allow selection of a base form and ACL forms that are currently in released status, and MUST re-validate at submission time that every selected form (base and each ACL form) is still released and correctly typed, rejecting the composition with a clear error otherwise.
- **FR-005**: The system MUST prevent the same released form from being selected more than once as an ACL attachment within a single composition, and MUST prevent a form from being selected as both the base and an ACL attachment in the same composition.
- **FR-006**: The system MUST treat two composed released forms as duplicates precisely when they reference the identical base released form and the identical set of ACL released forms, regardless of the order in which the ACL forms were selected, and MUST block publishing a new composition when an active duplicate already exists.
- **FR-007**: The system MUST allow a composition consisting of the base form alone (zero ACL forms attached) as a valid action, distinct from composing with one or more ACL forms.
- **FR-008**: The system MUST persist an immutable snapshot of the content of the base form and of every attached ACL form at the moment of composition, consistent with how released form content is snapshotted today.
- **FR-009**: When a traveler is created from a composed released form, the system MUST render every attached ACL form's input fields at the top of the traveler, ahead of the base form's content, in a deterministic and consistent order.
- **FR-010**: The system MUST allow users to enter and save values into the ACL form fields displayed in a traveler, capturing that data as part of the traveler's record the same way base form field values are captured today.
- **FR-011**: When a composed released form has zero attached ACL forms, the resulting traveler MUST render exactly as a traveler created from a plain base-only released form does today, with no ACL section shown.
- **FR-012**: The system MUST display, on a composed released form's detail view, the identity and version of the base form and of every attached ACL form, so the composition is auditable without inspecting raw data.
- **FR-013**: Only an authorized user MUST be able to perform the compose action, consistent with the system's existing permission model for publishing released content.

### Key Entities

- **ACL Form**: A form template of the new "ACL" type. Authored and reviewed like any other form template, and must itself be released before it becomes eligible for selection in a composition.
- **Composed Released Form**: A released form produced by the compose action, referencing one base released form plus zero-to-many ACL released forms, each captured as an immutable content snapshot. Distinct from a released form produced by the standard release action (which may instead carry a single optional discrepancy form).
- **Composition (source set)**: The specific combination of base and ACL released forms referenced by a composed released form. Used to determine whether two compositions are duplicates, and to determine which ACL sections render in resulting travelers.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can publish a new composed released form from an already-released base and any number of ACL forms without re-authoring or re-releasing the base form.
- **SC-002**: 100% of composition attempts that exactly duplicate an existing active composition (same base plus the same set of ACL forms) are blocked; 100% of attempts with a genuinely different base or a different set of ACL forms succeed.
- **SC-003**: 100% of travelers created from a composition with attached ACL forms display every attached ACL section at the top of the traveler and accept and save user input in them.
- **SC-004**: A user viewing a composed released form's detail page can identify the base form and every attached ACL form, with their versions, with zero need to inspect raw underlying data.

## Assumptions

- ACL forms follow the same authoring/review/release lifecycle already used by other form types (draft → submitted for review → released → archived), reusing the existing form and released-form state machines rather than introducing a new workflow.
- The compose action is only available with a base form of the standard ("normal") type; ACL forms are not, in turn, composed with other ACL forms or a discrepancy form when they themselves are released.
- The compose action and the existing discrepancy-attachment release path are separate, mutually exclusive product actions — a single released form is produced by either one or the other, never both.
- When multiple ACL forms are attached, the user explicitly arranges their placement during composition (not merely the order they were selected in), and the traveler renders them in that exact, stored order.
- Composing a new released form is restricted to users with elevated permissions (e.g., Manager or Admin), consistent with the sensitivity of publishing an official released record that bundles content the composer does not necessarily own, since — unlike a standard release — there is no single "owning" draft form driving the action.
- There is no policy-driven cap on the number of ACL forms in a single composition.
- Existing released forms, the existing discrepancy-attachment mechanism, and travelers created from base-only or base+discrepancy released forms are unaffected by this feature.
