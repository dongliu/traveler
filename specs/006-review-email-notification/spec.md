# Feature Specification: Form Review Request Email Notification

**Feature Branch**: `006-review-email-notification`

**Created**: 2026-10-25

**Status**: Draft

**Input**: User description: "When a form is assigned to a user for review, send a review request email notification. A first email details are specify at specs/email.md. The `notification_email_address` was already defined in docker/app.json. Refactor to have a dedicate config json file for email. The `email-disclaimer` should be included in the new config file. When a user is added as a reviewer from AD, check if the user is already in the user model, if not add them with user name and user email. This will avoid an issue that later we cannot find the user's email from just the user id. The form should keep a record for the emails sent."

## Clarifications

### Session 2026-10-25

- Q: Should an account auto-created for a brand-new AD reviewer also be automatically granted the Reviewer role, so the assignment succeeds immediately without a separate admin step? → A: No. The existing reviewer-assignment step already has a separate, unaffected check that a reviewer must hold the Reviewer role; auto-creation only fills in the missing user record (name/email) so that check has something to check. An administrator must still grant the Reviewer role separately, exactly as today.
- Q: Should the application refuse to start if the new dedicated email configuration file is missing, or start normally and skip sending until it's added? → A: Required / fail fast — the application must refuse to start without the dedicated email configuration file, consistent with other mandatory configuration files such as `app.json` and `ad.json`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reviewer is notified by email when assigned (Priority: P1)

A form owner assigns someone as a reviewer for a form that is under review. Today that person only finds out by noticing it inside eTraveler. Once assigned, the reviewer should instead receive an email telling them they've been asked to review a specific form, with a link to go do it, addressed the way the organization's standard review-request notice is worded.

**Why this priority**: This is the core value of the feature — reviews start sooner when reviewers are told directly instead of having to notice an assignment on their own. Every other part of this feature exists to make this notification reliable.

**Independent Test**: Assign an existing eTraveler user (one who already has an account with an email on file) as a reviewer on a form that is under review, and confirm the reviewer receives a single email with the form's title/link and the standard disclaimer, sent from the configured notification address and copied to the form owner.

**Acceptance Scenarios**:

1. **Given** a form is under review and the assigning owner picks a person who already has an eTraveler account with an email on file, **When** the reviewer is added to the form's review list, **Then** that person receives one email identifying the form, who assigned them, and where to go to review it, sent from the configured notification address and copied to the form owner, ending with the organization's standard disclaimer text.
2. **Given** the outgoing mail service is temporarily unavailable, **When** a reviewer is assigned, **Then** the review assignment still succeeds (the reviewer is added to the review list) even though the notification email could not be delivered.

---

### User Story 2 - Directory users don't have to be looked up by hand before they can be set up as reviewers (Priority: P2)

Today, assigning someone as a reviewer who has never logged into eTraveler or been manually added fails with an error telling the form owner that an administrator must first add that person — including manually looking up and typing in their name and email — before granting them the Reviewer role. Owners pick reviewers from the organization directory (AD), so the system already knows that person's name and email; it shouldn't make anyone look those up and retype them by hand just to create the account. Who is allowed to actually act as a reviewer is a separate, unchanged decision that an administrator still makes deliberately.

**Why this priority**: Without this, Story 1 does not reliably work — a sizeable share of real-world reviewer candidates are people the system hasn't seen before, and today their account has to be created by hand, by someone willing to go find and re-enter their name and email, before an administrator can even get to the point of granting them the Reviewer role.

**Independent Test**: Pick a directory user who has never been added to eTraveler as a reviewer on a form under review, and confirm a minimal account is created automatically using their directory name and email (instead of the assignment failing outright for lack of any record), while the existing requirement that an administrator separately grant them the Reviewer role before the assignment can complete is unchanged.

**Acceptance Scenarios**:

1. **Given** a person found through the organization directory has no existing eTraveler account, **When** they are assigned as a reviewer, **Then** the system creates an account for them using the name and email on file in the directory — instead of rejecting the assignment outright for lack of any record — and the existing requirement that they hold the Reviewer role before the assignment can complete is unaffected.
2. **Given** that account now exists with name and email already on file but without the Reviewer role, **When** an administrator grants them the Reviewer role and the owner assigns them again, **Then** the assignment succeeds without anyone needing to look up or re-enter that person's email address.
3. **Given** a person already has both an eTraveler account and the Reviewer role, **When** they are assigned as a reviewer again later (e.g., on a subsequent review round), **Then** no duplicate account is created and their existing account is reused, the same as today.
4. **Given** the id used to assign a reviewer cannot be found in the directory (or matches more than one person), **When** the assignment is attempted, **Then** the assignment is rejected with a clear explanation, the same way an invalid reviewer is rejected today.

---

### User Story 3 - Form keeps a record of the notifications it sent (Priority: P3)

A form owner, reviewer, or administrator later wants to confirm whether a reviewer was actually notified — for example, when a review is taking longer than expected and someone asks "did they even get the email?". The form should be able to answer that question from its own history rather than requiring someone to dig through server logs.

**Why this priority**: This is an auditability/troubleshooting improvement on top of Stories 1 and 2 — useful, but the feature still delivers its core value without it.

**Independent Test**: After a review-request notification is sent (or attempted) for a form, confirm the form's record shows who was notified, when, and whether the email went out successfully.

**Acceptance Scenarios**:

1. **Given** a review-request email has been sent for a form, **When** someone with access to that form's review information looks at it, **Then** they can see that a notification was sent to that reviewer and when.
2. **Given** a review-request email attempt failed (e.g., the mail service was unavailable, or the reviewer had no email on file), **When** someone with access to that form's review information looks at it, **Then** the record shows the attempt did not succeed, rather than silently looking identical to a successful one.

---

### Edge Cases

- A directory user is assigned as a reviewer but their directory record has no email on file: the account is still created (or reused) with a blank email, but the notification attempt is recorded as not sent, instead of erroring out or sending a blank/invalid email.
- A reviewer is assigned who was removed from a previous review round and is now being assigned again (e.g., after rework): this is treated as a new request and a new notification is sent.
- A brand-new directory user is assigned as a reviewer before an administrator has granted them the Reviewer role: the account is created with their name and email, but the assignment is rejected at the existing Reviewer-role check, the same as it is today for any account lacking that role — an administrator must grant the role before the assignment can be retried successfully.
- The dedicated email configuration file is missing at startup: the application fails to start, the same way it already fails to start today without `app.json` or `ad.json`. A deployment upgrading to this feature must add the file first.
- The dedicated email configuration file is present but an individual outgoing notification still can't be sent (e.g., the mail relay is temporarily unreachable): the review assignment still succeeds; the notification attempt is logged and recorded as failed rather than crashing the request.
- Someone tries to assign a reviewer using an id that matches zero or multiple people in the directory: the assignment is rejected with a clear error, the same as today's handling of an unrecognized reviewer id.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST send a review-request email notification to a reviewer whenever that reviewer is successfully added to a form's review list, using the subject, recipients (reviewer, with the form owner copied), sender, and body content defined for the "review request" notification in `specs/email.md`.
- **FR-002**: Every outgoing review-request email MUST end with the organization's standard email disclaimer text.
- **FR-003**: A failure to send the notification email MUST NOT prevent or roll back the reviewer assignment — the assignment is the authoritative outcome; the email outcome is tracked separately (see FR-008).
- **FR-004**: System MUST provide one dedicated email configuration file (parallel to the existing per-topic configuration files) holding the outgoing-mail connection settings, the notification "from" address, and the standard disclaimer text.
- **FR-005**: The email-related settings currently kept in the general application configuration (outgoing-mail connection settings and the notification "from" address) MUST be removed from there and sourced only from the new dedicated email configuration.
- **FR-006**: The disclaimer text appended to outgoing notification emails MUST be read from the dedicated email configuration, not hard-coded, so it can be changed without a code change.
- **FR-007**: The dedicated email configuration file MUST be required for the application to start, consistent with other mandatory configuration files (e.g., `app.json`, `ad.json`) — the application MUST refuse to start if it is missing.
- **FR-008**: Each form MUST retain a record of every review-request notification attempted for it, capturing at minimum: who was notified, when, and whether the attempt succeeded. This record MUST persist with the form and remain available to anyone who can already view that form's review information.
- **FR-009**: When a reviewer is assigned by their directory (AD) identity and no eTraveler account exists for them yet, the system MUST create one automatically, using the name and email currently on file in the directory for that identity. Creating this account MUST NOT itself grant the Reviewer role — the existing requirement that a reviewer hold the Reviewer role before a review request can be completed is unchanged, and remains a separate, deliberate administrator action.
- **FR-010**: System MUST NOT create a duplicate account for a directory identity that already has an eTraveler account — the existing account is reused when that identity is assigned as a reviewer again.
- **FR-011**: If a reviewer identity cannot be uniquely resolved in the directory (not found, or ambiguous), the system MUST reject the reviewer assignment with a clear error rather than creating an incomplete account.
- **FR-012**: Assigning a reviewer who already has an eTraveler account with an email on file MUST continue to work exactly as it does today, in addition to now triggering the notification in FR-001.

### Key Entities

- **Email Configuration**: The dedicated settings that govern all outgoing notification email for the application — outgoing-mail connection details, the "from"/notification address, and the standard disclaimer text appended to every notification.
- **Review Request Notification Record**: An entry kept with a form noting that a review-request email was sent (or attempted) to a specific reviewer, including the recipient, the time of the attempt, and whether it succeeded.
- **Reviewer Account**: The minimal eTraveler profile (identity, name, email, and the roles granted to them) representing a person who can be assigned to review a form and notified by email. Its identity, name, and email may now come into existence automatically, from directory data, at the moment they are first assigned as a reviewer — but the Reviewer role on that account is still only ever granted by a separate, deliberate administrator action, unchanged from today.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every reviewer successfully added to a form's review list has a matching notification record on that form showing whether they were emailed, with no manual lookup in server logs required to answer "were they notified?".
- **SC-002**: A person who has never used eTraveler before can be set up as a reviewer without anyone having to manually look up or re-type their name or email — the account is created with that information automatically. Granting them the Reviewer role remains the only manual step, unchanged from today.
- **SC-003**: An outage of the outgoing mail service results in zero blocked or failed reviewer assignments — review assignment success is fully decoupled from notification delivery success.
- **SC-004**: An operator can change the outgoing-mail settings or the disclaimer wording in a single configuration file, without editing any other application setting.

## Assumptions

- This feature covers only the "review request" notification described in `specs/email.md`. The companion "review result" (approved/rejected outcome) notification documented in the same file is a separate enhancement and is out of scope here.
- The reviewer's email address used for sending (and for the account created in Story 2) is taken from the organization directory itself at the time of assignment, not from values supplied by the browser, consistent with how directory-sourced user data is already handled elsewhere in the system.
- The link included in the notification points to the existing reviewer-facing page where that person reviews the form.
- Only the assigned reviewer and the form's owner are addressed on the review-request email, matching `specs/email.md`.
- Existing deployments will need to add the new dedicated email configuration file as part of upgrading to this feature, before the upgraded application will start; the settings being moved out of the general application configuration are expected to live only in the new file going forward.
- The notification record kept on the form (Story 3) only needs to be available to people who already have access to that form's review information today — it does not require a new, separately-permissioned view.
- Granting the Reviewer role to any account — whether pre-existing or newly auto-created from the directory — remains exclusively a deliberate administrator action through the existing user-administration capability; this feature does not change who can grant that role or how.
