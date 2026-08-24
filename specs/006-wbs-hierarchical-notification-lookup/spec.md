# Feature Specification: WBS Hierarchical Notification Lookup

**Feature Branch**: `006-wbs-hierarchical-notification-lookup`

**Created**: 2026-08-22

**Status**: Draft

**Input**: User description: "The WBS number is defined in the application now. The WBS number follows a hierarchical relationship. E.g. wbs number '1' is the parent of '1.1'. The retrieving of notification email follows the following logic: 1) if there is an exact match in the system for a given wbs number, then use the exact match; 2) if there is no exact match, but use the closest parent match; e.g. '1.1' is the closest match of '1.1.1', but '1' or '1.1.1.1' are not. When a user creates an NCR, if the wbs number does not have either an exact match or a parent match, then display a warning and suggest that the admin should add a wbs number." Clarified via follow-up: a resolved match must result in an actual notification email being sent, per `specs/emails.md`.

## Background

`specs/001-ncr-workflow/spec.md` ("Future Work: Group Leader and Director
Notifications (Deferred)") explicitly deferred sending the Cognizant Group
Leader / Cognizant Division Director notification because "the mechanism for
resolving Group Leader and Division Director/PM from a WBS number is not yet
defined," suggesting "a WBS ownership mapping table" as one way to close the
gap. The WBS Notification Registry (`specs/005-wbs-notification-registry`)
is exactly that mapping table. This feature defines the lookup algorithm
that resolves a WBS number to a registry entry and wires the result into the
two notification emails from `specs/emails.md` that already name Cognizant
GL/Director as recipients (template 2, initial notification; template 7,
final distribution) but have never had anyone to send them to.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Exact WBS Match Notifies the Registered Contact (Priority: P1)

An Originator creates an NCR against a WBS number that has an exact entry in
the WBS Notification Registry. When the NCR is submitted, the registered
contact receives the initial notification email, just like QA Staff already
do today.

**Why this priority**: This is the core, most common case — most NCRs are
expected to be filed against WBS numbers an Admin has already registered.

**Independent Test**: Register a WBS number with a notification email, create
an NCR against that exact WBS number, and confirm the registered address
receives the initial notification email with the NCR's summary and link.

**Acceptance Scenarios**:

1. **Given** a WBS number `1.2` is registered with `email-a@example.com`,
   **When** an Originator submits an NCR with WBS number `1.2`,
   **Then** `email-a@example.com` receives the initial notification email
   (matching `specs/emails.md` template 2) alongside the existing QA Staff
   recipients
2. **Given** the same NCR later reaches closure, **When** it is closed,
   **Then** `email-a@example.com` also receives the final distribution email
   (matching `specs/emails.md` template 7)
3. **Given** the notification is sent, **When** the NCR's event log is
   reviewed, **Then** the resolved recipient's delivery status is recorded
   per-recipient, the same way every other notification recipient's status
   is already tracked

---

### User Story 2 - Ancestor WBS Match Notifies the Nearest Registered Parent (Priority: P1)

An Originator creates an NCR against a WBS number that has no exact registry
entry, but a parent level in its hierarchy does. The nearest registered
ancestor's contact is notified instead.

**Why this priority**: WBS numbers are expected to be filed at a finer grain
than an Admin will always register individually (e.g. registering `1.2`
should cover `1.2.1`, `1.2.2`, etc. without re-registering each one) — this
is what makes the registry practical to maintain at scale.

**Independent Test**: Register only WBS number `1.2` (not `1.2.1`), create an
NCR with WBS number `1.2.1`, and confirm `1.2`'s registered contact is
notified.

**Acceptance Scenarios**:

1. **Given** WBS number `1.2` is registered with `email-a@example.com` and
   `1.2.1` is not registered, **When** an Originator submits an NCR with WBS
   number `1.2.1`, **Then** `email-a@example.com` receives the notification
2. **Given** both `1` and `1.2` are registered with different emails, and
   `1.2.1` is not registered, **When** an Originator submits an NCR with WBS
   number `1.2.1`, **Then** only `1.2`'s email is notified (the nearer
   ancestor wins over the more distant one)
3. **Given** WBS number `1.2.1` is registered, **When** an Originator submits
   an NCR with WBS number `1.2.1.1` (a child, not an ancestor, of any
   registered number), **Then** the registered entry for `1.2.1` is used —
   confirming that only ancestors (not descendants, and not the number
   itself when unregistered) participate in the match
4. **Given** only `1.2.1.1` is registered (a descendant of the NCR's WBS
   number) and `1.2.1` is not, **When** an Originator submits an NCR with WBS
   number `1.2.1`, **Then** no match is found — a descendant registration
   never satisfies an ancestor's lookup

---

### User Story 3 - No Match Warns the Originator Instead of Silently Notifying No One (Priority: P1)

An Originator creates an NCR against a WBS number with no exact match and no
registered ancestor anywhere in its hierarchy. Rather than the notification
silently going nowhere, the Originator sees a warning suggesting an Admin
register the WBS number.

**Why this priority**: Without this, a coverage gap in the registry is
invisible — no one would ever learn that a WBS number's Cognizant GL/Director
notification silently failed to reach anyone.

**Independent Test**: Create an NCR against a WBS number with no exact match
and no registered ancestor at any level, and confirm a clear warning is shown
suggesting an Admin add the WBS number, without blocking submission of the
NCR itself.

**Acceptance Scenarios**:

1. **Given** WBS number `9.9.9` has no exact registry entry and none of `9.9`
   or `9` is registered either, **When** an Originator submits an NCR with
   WBS number `9.9.9`, **Then** the NCR is still created successfully, and
   the Originator sees a warning stating that no WBS Notification Registry
   entry covers `9.9.9` and suggesting an Admin add one
2. **Given** the same no-match scenario, **When** the initial notification
   email is sent, **Then** it is still sent to the existing QA Staff
   recipients — the missing Cognizant GL/Director recipient is simply
   omitted, not treated as a delivery failure
3. **Given** a WBS number consisting of a single segment (e.g. `9`, which has
   no possible parent), **When** it has no exact registry match, **Then** it
   is treated the same as any other no-match case (warning shown, no
   ancestor to fall back to)

---

### Edge Cases

- A WBS number that is registered gets both the initial notification (US1
  Acceptance Scenario 1) and the final distribution (US1 Acceptance Scenario
  2) — the same resolved contact is used at both points; the lookup is not
  re-run with different results between submission and closure, since the
  registry entry is looked up fresh each time and would only change if an
  Admin edited or removed it in between (acceptable — the latest registry
  state governs each notification independently).
- If an Admin removes or edits the matching registry entry between an NCR's
  submission and its closure, the final distribution notification uses
  whatever the registry says at closure time, not what it said at
  submission time.
- Matching is case-sensitive and exact per segment, consistent with the WBS
  Notification Registry's own existing uniqueness rule (`specs/005-wbs-notification-registry`).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST, for a given NCR's WBS number, look up a matching
  entry in the WBS Notification Registry as follows: (a) an exact match on
  the full WBS number, if one exists in the registry; otherwise (b) the
  match on the nearest ancestor WBS number that exists in the registry,
  where "ancestor" means the WBS number with one or more trailing
  dot-separated segments removed, and "nearest" means the ancestor with the
  most segments (closest to the original number) among all registered
  ancestors
- **FR-002**: System MUST NOT treat a descendant of the NCR's WBS number (a
  registry entry with additional trailing segments beyond the NCR's own WBS
  number) as a match under any circumstance
- **FR-003**: System MUST resolve this lookup at NCR submission time and use
  the resolved contact (if any) as an additional recipient of the initial
  notification email (`specs/emails.md` template 2), alongside the existing
  QA Staff recipients
- **FR-004**: System MUST resolve this lookup again at NCR closure time and
  use the resolved contact (if any) as an additional recipient of the final
  distribution email (`specs/emails.md` template 7), alongside the existing
  recipient groups
- **FR-005**: System MUST record the resolved recipient's delivery status
  per-recipient in the NCR's event log, the same way every other
  notification recipient's delivery status is already recorded
- **FR-006**: System MUST, when no exact match and no ancestor match exists
  for the NCR's WBS number, display a warning to the Originator at NCR
  creation stating that no WBS Notification Registry entry covers this WBS
  number and suggesting an Admin add one
- **FR-007**: System MUST NOT block NCR creation when no match is found — the
  warning is informational; the NCR is still created and submitted normally
- **FR-008**: System MUST NOT fail or error the initial/final notification
  send when no match is found — the resolved-contact recipient is simply
  omitted; existing recipients are unaffected

### Key Entities

- **WBS Notification Registry** (existing, from `specs/005-wbs-notification-registry`):
  unchanged by this feature — this feature only reads from it, it does not
  add, modify, or remove fields.
- **NCR**: unchanged in its own stored fields by this feature; the
  Cognizant GL/Director-equivalent recipient is resolved fresh at
  notification time rather than being stored on the NCR document itself
  (see Assumptions).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of NCRs submitted against an exactly-registered WBS
  number result in the registered contact receiving the initial notification
- **SC-002**: 100% of NCRs submitted against an unregistered WBS number whose
  nearest ancestor is registered result in that ancestor's contact receiving
  the initial notification, and never a more distant ancestor's contact when
  a nearer one is also registered
- **SC-003**: 100% of NCRs submitted against a WBS number with no exact or
  ancestor match result in a visible warning to the Originator, with zero
  NCR submissions blocked by that warning
- **SC-004**: 100% of resolved-contact deliveries (or the absence of one) are
  reflected accurately in the NCR's event log, matching the actual outcome

## Assumptions

- The WBS Notification Registry stores exactly one email address per WBS
  number (per `specs/005-wbs-notification-registry`). This feature uses that
  single resolved address to fulfill both the "Cognizant Group Leader" and
  "Cognizant Division Director/PM" recipient roles named in
  `specs/001-ncr-workflow/spec.md` and `specs/emails.md` collectively — the
  registry does not distinguish between the two roles, and this feature does
  not introduce that distinction.
- The resolved recipient is computed fresh at each notification point
  (submission, closure) rather than being captured once and stored on the
  NCR — so a registry change between submission and closure is reflected at
  closure. This is a reasonable default consistent with the registry being
  the live source of truth; nothing in the request asks for the resolution
  to be "frozen" at submission time.
- The no-match warning is shown to the Originator at NCR creation only (a
  point-in-time message), not persisted as an ongoing tracked item elsewhere
  in the system (e.g., no admin-facing "coverage gap" dashboard) — the
  request only describes a warning "when a user creates an NCR."
- This feature does not change WBS number format validation on the NCR
  creation form itself — a WBS number is still free text there (per
  `specs/001-ncr-workflow`); this feature only affects which registry entry
  (if any) is resolved from whatever value was entered.
