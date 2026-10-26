# Feature Specification: Reposition and Permission-Gate the NCR Next-Action Button

**Feature Branch**: `128-ncr-action-button-visibility`

**Created**: 2026-10-24

**Status**: Draft

**Input**: User description: "on views/ncr-detail-body.jade , there is `.span4.text-right`to hold the next posible action. Firstly, move the button to the left bottom the page on top of the `Event Timeline` section. Secondly, only show the button to the user who can perform the action."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The next-action button moves to the bottom of the page (Priority: P1)

Today, the button offering the NCR's next workflow action (e.g. "Create Disposition," "QA Concurrence," "Approve / Return," "Close NCR") sits at the top of the page, right-aligned next to the NCR number. This story moves it to the bottom of the page instead, left-aligned, directly above the Event Timeline section — so it no longer competes for attention with the NCR's identity/status at the top, and instead sits where someone who has just finished reading the NCR's full detail naturally looks next.

**Why this priority**: It's the first thing requested, and it's a self-contained layout change that doesn't depend on anything else in this feature.

**Independent Test**: Open any NCR detail page whose status offers a next action; confirm no action button appears next to the NCR number anymore, and confirm it now appears left-aligned, directly above the Event Timeline section at the bottom of the page.

**Acceptance Scenarios**:

1. **Given** an NCR in a status that offers a next action, **When** an authorized viewer opens its detail page, **Then** the action button is not shown next to the NCR number, and is instead shown left-aligned, directly above the Event Timeline section.
2. **Given** the same NCR, **When** the viewer compares the button's destination (the page it opens) to before this change, **Then** it is unchanged — only the button's position moved.

---

### User Story 2 - Only someone who can actually perform the action sees its button (Priority: P2)

Today, the next-action button is shown to every viewer of an NCR's detail page whenever its status offers one, regardless of whether that viewer is actually allowed to perform it — e.g. everyone sees "Approve / Return" on an NCR awaiting approval, not just the people designated to approve it. Clicking it as an unauthorized viewer leads to a page that refuses them. This story shows the button only to a viewer who is actually authorized for that NCR's current next action, matching the authorization the system already enforces when the action itself is submitted.

**Why this priority**: It depends only on the button existing (which it already does); it does not depend on User Story 1's repositioning, so it can ship on its own, but it's sequenced second because it's a visibility refinement layered on the same control.

**Independent Test**: Open the same NCR's detail page as two different users — one who is authorized to perform its next action, one who isn't — and confirm only the authorized one sees the button.

**Acceptance Scenarios**:

1. **Given** an NCR in `Submitted` status, **When** the person assigned as CE/CS views its detail page, **Then** they see "Create Disposition"; **when** anyone else views the same page, **Then** they see no action button.
2. **Given** an NCR in `Dispositioned` status, **When** a member of the QA staff group views its detail page, **Then** they see "QA Concurrence"; **when** a non-QA-staff viewer views the same page, **Then** they see no action button.
3. **Given** an NCR in `Approval Requested` status, **When** one of its designated approvers views its detail page, **Then** they see "Approve / Return"; **when** anyone not designated as an approver on that NCR views the same page, **Then** they see no action button.
4. **Given** an NCR in `Final Approval` status, **When** the Originator or their assigned Designate views its detail page, **Then** they see "Close NCR"; **when** anyone else views the same page, **Then** they see no action button.

---

### Edge Cases

- An NCR in `Submitted` status with no CE/CS assigned yet: nobody sees "Create Disposition," since nobody can yet be the assigned CE/CS — matching the fact that nobody can submit a disposition for it yet either.
- An NCR in a status with no next action at all (`Returned for Comment`, `Closed`): no button is shown to anyone, exactly as today.
- A viewer who happens to be authorized under more than one role (e.g. the Originator who is also a designated approver on the same NCR): only one authorization rule is ever relevant at a time, since an NCR has exactly one current status and therefore exactly one possible next action.
- A QA staff member managing approvers on an NCR awaiting approval, who is not themselves one of its designated approvers: they do not see "Approve / Return," since they are not authorized to submit that NCR's approval decision — only to manage who is designated.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST show the NCR's next-action button, when its current status offers one, left-aligned and positioned directly above the Event Timeline section at the bottom of the NCR detail page, instead of next to the NCR number at the top.
- **FR-002**: The system MUST NOT change which action is offered for a given NCR status, or which page that action's button leads to — only where it is positioned and to whom it is shown.
- **FR-003**: The system MUST show the "Create Disposition" button only to the person currently assigned as the NCR's CE/CS.
- **FR-004**: The system MUST show the "QA Concurrence" button only to a member of the QA staff group.
- **FR-005**: The system MUST show the "Approve / Return" button only to a person who is a designated approver on that NCR.
- **FR-006**: The system MUST show the "Close NCR" button only to the NCR's Originator or their currently assigned Designate.
- **FR-007**: A viewer who is not authorized to perform an NCR's current next action MUST see no action button at all for that NCR — not a disabled button, not a placeholder, nothing.
- **FR-008**: Each button's own authorization rule (FR-003 through FR-006) MUST match exactly what the system already enforces when that action is actually submitted, so a viewer who sees the button is always someone who can actually complete the action if they click it.

### Key Entities *(include if feature involves data)*

- **NCR Next Action**: The single workflow action available for an NCR's current status (at most one at a time) — its label, destination page, and the specific person or group authorized to perform it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of NCR detail page views by a viewer who is not authorized for that NCR's current next action show no action button.
- **SC-002**: 100% of NCR detail page views by a viewer who is authorized for that NCR's current next action show that action's button, left-aligned, directly above the Event Timeline section.
- **SC-003**: Zero change in which NCR statuses offer a next action, which action each offers, or which page each action's button leads to.

## Assumptions

- "Authorized to perform the action" means exactly what the system already enforces when that action is submitted (CE/CS identity match, QA staff group membership, designated-approver identity match, Originator/Designate identity match) — this feature does not change who is allowed to perform any action, only whether the page correctly reflects that to the viewer.
- "Left" placement means left-aligned within its own row at the bottom of the page, replacing the button's current right-alignment at the top — consistent with the explicit request to move it to the "left bottom" of the page.
- This feature touches only the NCR detail page's own display of the next-action button; it does not change the dedicated action pages themselves (e.g. the disposition, concurrence, approval, or close pages), which already apply their own authorization.
