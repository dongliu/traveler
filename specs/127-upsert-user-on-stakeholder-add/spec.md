# Feature Specification: Guarantee Stakeholder Notification Delivery via Directory-Backed User Records

**Feature Branch**: `127-upsert-user-on-stakeholder-add`

**Created**: 2026-10-24

**Status**: Draft

**Input**: User description: "there is an issue for NCR notification functionality. when a stakeholder is added in to the NCR workflow, the application retrive the user information for AD. At that moment, the system knows the user's email. But later, the email address is retrieved from user model, if a user has never logs into the application, then the system does not know the email address to deliver the email. Fix this with the following approach: once a user is added into the NCR workflow from typeahead, then the system checks if the user is already in the user model, add the user if not. This will remove the needs to keep email address in the NCR model, and deliver the emails correctly. Perform this check and fix for the other models where a notification is needed."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - NCR workflow notifications always reach a newly-added stakeholder (Priority: P1)

An NCR Originator or QA staff member picks a colleague from the directory lookup to serve as CE/CS, an additional Approver, or an Originator Designate. That colleague has never logged into the application before. Later, when the NCR reaches the step that should notify that colleague (engineering disposition request, approval request, issuance, or final closure distribution), they receive the email exactly as anyone who has logged in before would.

**Why this priority**: This is the exact failure the feature was requested to fix — it is the most common way a real NCR workflow notification silently fails today, and it undermines trust in the entire NCR email system.

**Independent Test**: Pick a person who has never logged into the app (confirmed by their absence from the user list) as CE/CS, an Approver, or an Originator Designate on an NCR, drive that NCR through to the notification step tied to that role (disposition request, approval request, issuance, or closure), and confirm the email is delivered to them.

**Acceptance Scenarios**:

1. **Given** a person who has never logged into the application, **When** they are selected from the directory lookup and added as CE/CS on a new NCR, **Then** they can later receive every NCR notification addressed to the CE/CS role, including the NCR's final closure distribution.
2. **Given** a person who has never logged into the application, **When** they are selected from the directory lookup and added as an additional Approver or as the Originator Designate, **Then** they receive the notifications addressed to that role (approval request, issuance, final closure distribution) without needing to log in first.
3. **Given** a person is added as a stakeholder from the directory lookup, **When** the system checks for them afterward, **Then** a record for that person exists so that any future notification addressed to them can find their email without depending on whether they have ever logged in.

---

### User Story 2 - NCR closure notifies every stakeholder, not just the ones who logged in (Priority: P2)

When an NCR is closed, a single "final distribution" notification is meant to reach everyone who touched the NCR: the Originator, the Originator Designate (if any), the CE/CS, QA staff, every additional Approver, and every Preventive Action owner. Today, closure re-checks each of these people and silently drops anyone who has never logged in, even when their email was already captured earlier in the workflow. This story ensures closure notifications are no less reliable than the rest of the workflow.

**Why this priority**: Closure is the final, summary notification; losing a recipient here is the most visible and consequential failure, but it is a narrower, well-defined fix layered on top of Story 1.

**Independent Test**: Build an NCR all the way to closure where the Originator, an Approver, and a Preventive Action owner have each never logged in, close the NCR, and confirm all three receive the final distribution email.

**Acceptance Scenarios**:

1. **Given** an NCR whose Originator has never logged into the application, **When** the NCR reaches Final Approval, **Then** the Originator still receives the issuance notification.
2. **Given** an NCR being closed where the CE/CS, an Approver, and a Preventive Action owner have each never logged in, **When** the closure's final distribution notification is sent, **Then** all three receive it.

---

### User Story 3 - The same guarantee applies to reviewer notifications on Forms and Travelers (Priority: P3)

Outside of NCRs, Forms and Travelers use the same directory lookup to let someone add a reviewer to an approval workflow. Today, adding a reviewer who has never logged in is flatly refused, forcing an administrator to intervene before the reviewer can be added at all. This story extends the same "ensure the person is known to the system" guarantee to that flow, so a reviewer selected from the directory lookup can always be added and will always be reachable for review-related notifications.

**Why this priority**: It reaches beyond NCR into the other workflow explicitly identified as sharing this problem, but it is independent of, and lower-urgency than, getting NCR notifications right first.

**Independent Test**: Select a person who has never logged in as a reviewer on a Form (or Traveler) review request, confirm the request is accepted rather than refused, and confirm that person is reachable for the review notifications tied to that role.

**Acceptance Scenarios**:

1. **Given** a person who has never logged into the application, **When** they are selected from the directory lookup and added as a reviewer on a Form or Traveler, **Then** the request succeeds instead of being refused for lacking a local record.
2. **Given** a reviewer added this way, **When** a review-related notification is later addressed to them (e.g., all approvals received, or returned for comment), **Then** they receive it.

---

### Edge Cases

- What happens when the directory lookup's record for a newly-added stakeholder is missing an email address? No local record is created with no way to be notified. For a role where an email was already required to complete the add (the Originator Designate), the add is rejected exactly as it is today. For a role where it wasn't already required (CE/CS, an additional Approver), the add still succeeds exactly as it does today — this feature only adds a guarantee when an email *is* available; it does not take away today's ability to add someone by name/id alone.
- What happens when the same previously-unknown person is added to two different NCRs (or roles) at nearly the same time? The system must end up with exactly one record for that person, not a duplicate or a conflicting pair.
- What happens when a person already has a record (e.g., they logged in once a long time ago) and is then re-selected from the directory lookup with a current display name or email that differs slightly from what's on file? The existing record is left as-is; this feature only fills in a missing record, it does not reconcile or overwrite one that already exists.
- What happens to NCRs, Forms, or Travelers that already named a never-logged-in stakeholder *before* this fix shipped? They are not retroactively repaired; the guarantee applies from this point forward, to newly-added stakeholders.
- What happens when the Preventive Action Owner field (currently free text, not drawn from the directory lookup) names someone who has never logged in? No record is provisioned for them (see Assumptions — this role isn't sourced from the directory lookup), but the final closure distribution they're entitled to under FR-004 still reaches them, since their email was already captured and stored when they were assigned.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When a person is selected from the directory lookup and added to an NCR in the CE/CS, additional Approver, or Originator Designate role, the system MUST ensure a local record for that person exists, creating one from the already-resolved directory identity (unique id, display name, email) if no record exists yet.
- **FR-002**: The system MUST NOT reject or silently skip adding a stakeholder to one of the roles in FR-001 solely because that person has never logged into the application before.
- **FR-003**: Every NCR notification addressed to the Originator, Originator Designate, CE/CS, or an additional Approver (disposition request, approval request, issuance, and final closure distribution) MUST reach that person regardless of whether they have ever logged into the application, provided they were added via the directory lookup (or, for the Originator, provided they created the NCR).
- **FR-004**: The NCR's final closure distribution notification MUST reach every intended recipient — Originator, Originator Designate, CE/CS, QA staff, every additional Approver, and every Preventive Action owner — even when one or more of them has never logged into the application.
- **FR-005**: Once a stakeholder's local record is guaranteed to exist per FR-001, the system no longer needs to additionally store that stakeholder's email address directly on the NCR (or other affected record) purely as a delivery fallback; a single, reliable source of truth for each person's email is sufficient.
- **FR-006**: Adding a reviewer to a Form or Traveler review workflow from the directory lookup MUST succeed and MUST ensure a local record exists for that reviewer, using the same guarantee as FR-001, instead of refusing the add when the reviewer has never logged in.
- **FR-007**: Review-related notifications (e.g., results recorded, all approvals received, returned for comment) addressed to a reviewer added per FR-006 MUST reach that reviewer regardless of whether they have ever logged into the application.
- **FR-008**: The system MUST NOT create a local record with no deliverable email address. Where providing an email was already a precondition of the add (e.g., the Originator Designate), a missing email continues to refuse the add with a clear validation error, exactly as it does today. Where it was not already a precondition (e.g., CE/CS, an additional Approver), a missing email simply means no record is created for that person this time — it MUST NOT become a new reason the add itself fails; that would be a regression from today's behavior, where these roles have never required a resolvable email to be added, only to be notified.
- **FR-009**: If the person being added already has a local record, the system MUST use the existing record as-is and MUST NOT create a duplicate or overwrite the existing record's details.

### Key Entities *(include if feature involves data)*

- **User Record**: The local identity record (unique id, display name, email, roles) that all workflow notifications depend on to find a deliverable email address. Today it is created only when someone logs in for the first time, or through a small number of unrelated admin/sharing actions — never automatically when someone is merely *named* as a stakeholder elsewhere.
- **Directory Lookup Entry**: The externally-sourced identity (unique id, display name, email) a person is selected from when added to a workflow role. It is already resolved and available at the moment of selection, before anything is saved.
- **NCR Stakeholder Role**: A role on an NCR that can both be filled via the directory lookup and receive workflow notifications — Originator, Originator Designate, CE/CS, and additional Approver. (Preventive Action Owner and QA Staff are both notification recipients today but are out of this feature's scope — see Assumptions.)
- **Review Reviewer**: A person named on a Form's or Traveler's review workflow, selected via the same directory lookup, who can receive review-related notifications.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of NCR notifications (disposition request, approval request, issuance, final closure distribution) reach every intended CE/CS, Approver, Originator, and Originator Designate recipient, regardless of whether that person had ever logged into the application before being added.
- **SC-002**: Zero NCR closures ship a final distribution notification with a known stakeholder missing from it solely because that stakeholder had never logged in.
- **SC-003**: Adding a person as an NCR stakeholder, or as a Form/Traveler reviewer, via the directory lookup never fails and never needs an administrator's manual intervention solely because that person is new to the system.
- **SC-004**: After this fix ships, support requests reporting "a stakeholder never received an NCR (or review) notification because they'd never logged in" drop to zero for newly-added stakeholders.

## Assumptions

- The directory lookup's identity data (unique id, display name, email), already resolved on selection, is trustworthy enough to create a local record from — consistent with how the application already creates records from the same kind of directory data elsewhere (e.g., when sharing a Traveler/Binder/Form with someone new).
- This fix is forward-looking only: NCRs, Forms, and Travelers that already named a never-logged-in stakeholder before this fix shipped are not retroactively repaired.
- When a person already has a local record, this feature does not refresh or correct that record's name/email from the directory lookup — it only fills in a record that's missing, matching existing behavior elsewhere in the app.
- Preventive Action Owner on an NCR stays out of scope for the directory-backed provisioning this feature adds (FR-001/FR-006): it is entered as free text today, not selected from the directory lookup, so there is no resolved directory identity to provision a record from. Final closure distribution (FR-004) still reaches a Preventive Action owner who has never logged in, because the NCR already stores that owner's email directly from when they were assigned — closure is fixed to stop discarding that already-known email in favor of an id-only lookup, which is a distinct, narrower fix from the provisioning this feature otherwise adds, and applies only to this one field.
- QA Staff notifications stay out of scope: QA staff membership already requires a local user record through its group membership, independent of this feature.
- Session-derived identities that are recorded without going through the directory lookup (such as a Traveler's list of people who have worked on it) are out of scope, since those identities are not sourced from the directory lookup this feature targets, and the people involved are, by definition, already logged in.
