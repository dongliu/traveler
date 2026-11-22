# Feature Specification: Admin Traveler Unarchive

**Feature Branch**: `131-unarchive-traveler`

**Created**: 2026-11-22

**Status**: Draft

**Input**: User description: "In current implementation, once a traveler is archived, the traveler cannot be transfer to other status. Make changes to allow: 1) admin user can unarchived the traveler to its previous status. 2) all status changes are tracked with history plugin, so that when an archived traveler is moved out of archived status, we know its previous status. 3) add tests for this."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin restores an archived traveler to its prior status (Priority: P1)

Today, once a traveler is archived, it is permanently stuck — nothing can move it to any other status again, even by mistake. An admin needs a way to reverse an archive action and put the traveler back into the status it held immediately before it was archived (for example, back to Active if work needs to resume, or back to Completed if it was archived after being finished), without having to guess or manually re-create that status.

**Why this priority**: This is the core capability requested. Without it, archiving remains a one-way, unrecoverable action, which blocks legitimate corrections (an accidental archive) and legitimate business needs (resuming work on something archived too early).

**Independent Test**: Archive a traveler from a known status (e.g. Active), confirm it now shows as Archived, then have an admin perform the unarchive action and confirm the traveler's status reverts to Active and the traveler behaves normally for that status (e.g. accepts input again).

**Acceptance Scenarios**:

1. **Given** a traveler that was Active and has since been archived, **When** an admin unarchives it, **Then** the traveler's status becomes Active again.
2. **Given** a traveler that was Completed and has since been archived, **When** an admin unarchives it, **Then** the traveler's status becomes Completed again.
3. **Given** a traveler that was newly Initialized and has since been archived, **When** an admin unarchives it, **Then** the traveler's status becomes Initialized again.
4. **Given** an archived traveler, **When** a user who does not hold the admin role attempts to unarchive it, **Then** the action is refused and the traveler remains Archived.
5. **Given** a traveler that is not currently Archived, **When** any user attempts the unarchive action on it, **Then** the action is refused, since there is nothing to restore.

---

### Edge Cases

- What happens when an admin tries to unarchive a traveler that was archived before this feature existed, so no prior-status record exists for it? The system restores it to Active. This is a fallback, not a lie about history: if Active turns out to be the wrong status for a given traveler, the admin can simply change its status again afterward — being restored to the wrong guess never blocks correcting it further.
- What happens if two admins attempt to unarchive the same traveler at the same time? The first unarchive succeeds; the second finds the traveler is no longer Archived and is refused, the same way any other attempt to unarchive a non-archived traveler is refused (Acceptance Scenario 5 of User Story 1).
- Does unarchiving affect the traveler's separate, pre-existing archive lock (the on/off flag its owner can already toggle independently of status)? No — that lock is a distinct, already-working mechanism controlled by the owner and is unaffected by this feature. If that lock happens to still be on after an admin restores the traveler's status, the traveler remains write-protected by that lock until its owner turns it off, exactly as today.
- Does restoring a traveler to a prior status re-trigger one-time actions normally associated with first entering that status (such as an initial notification)? No — restoring a status does not replay one-time side effects; it only returns the traveler to behaving according to the rules of that status going forward.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a user holding the admin role to restore an Archived traveler to the status it held immediately before it was archived, without requiring that user to know or re-enter that status manually.
- **FR-002**: System MUST refuse any attempt to unarchive a traveler made by a user who does not hold the admin role.
- **FR-003**: System MUST refuse any attempt to unarchive a traveler that is not currently in the Archived status.
- **FR-005**: System MUST, as part of archiving a traveler, record the status it held immediately before archiving, so that status is available to restore later.
- **FR-006**: When a traveler is unarchived, system MUST set its status to exactly the status recorded as its status immediately before that archiving event (always one of: Initialized, Active, or Completed — the only statuses a traveler can be archived from).
- **FR-007**: When unarchiving a traveler that has no recorded prior status (because it was archived before this feature existed), system MUST restore it to the Active status as a fallback.
- **FR-008**: Once restored, the traveler MUST immediately behave according to the normal rules of its restored status (e.g. an Active traveler accepts data entry again; a Completed traveler behaves as completed).
- **FR-009**: System MUST NOT change any status transition other than adding the new path out of Archived — all other existing status-change rules continue to behave exactly as they do today.
- **FR-010**: System MUST record the status held immediately before archiving consistently regardless of which access path performs the archiving (see Assumptions for which access paths exist today), so that the prior status is available to restore later no matter how the traveler came to be archived.

### Key Entities *(include if feature involves data)*

- **Traveler**: A work instance that progresses through a lifecycle of statuses (Initialized, Active, Submitted for Completion, Completed, Frozen, Archived). Gains, as of this feature, a durable link from its Archived status back to whatever status it held immediately beforehand.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can restore any archived traveler to its correct pre-archive status in a single action, with no manual status lookup or re-entry required.
- **SC-002**: Attempts to unarchive a traveler by a non-admin user are refused 100% of the time, with the traveler left unchanged.
- **SC-003**: For any traveler restored under this feature, an admin can confirm exactly which status it was restored to.

## Assumptions

- "Admin" means a user holding this system's dedicated admin role — the same role already required for other administrator-only traveler actions (such as permanently deleting a traveler) — not merely a configurable permission that may also be granted to other roles.
- This feature addresses only a traveler's lifecycle status (Initialized / Active / Submitted for Completion / Completed / Frozen / Archived). The traveler's separate, pre-existing archive lock — an on/off flag its owner can already toggle independently — is a distinct mechanism and is not changed by this feature.
- Because a traveler can only ever be archived starting from Initialized, Active, or Completed, "its previous status" always resolves to one of those three statuses.
- Consistent with this project's existing testing standard (automated tests required for all new features and bug fixes), this feature's behavior — the unarchive action, its admin-only restriction, and status-history recording — will be covered by automated tests at the unit and integration level, following this codebase's existing test conventions, as requested in the feature description.
- The admin unarchive action is made available through the web application only. This system's programmatic integration access authenticates as a single shared system credential with no concept of an individual admin user, so no admin-only action in this system is offered through it today; this feature follows that same, already-established boundary rather than introducing a new one.
- Unarchiving applies to one traveler at a time; extending it to a bulk selection (mirroring the existing bulk "Archive" control) is not required by this feature and is left open for future enhancement.
- A traveler archived before this feature ships, for which no prior status was ever recorded, is restored to Active as a fallback when unarchived. If that guess is wrong for a particular traveler, an admin can correct its status afterward using the existing status-change capability — the fallback never blocks a further correction.
- This feature records only the single status a traveler held immediately before its most recent archiving — not a general, permanent audit trail of every status change a traveler has ever undergone. A broader change-history/audit capability was considered and explicitly descoped: the only need this feature has to satisfy is "what do I restore to," which a single recorded value answers completely, and nothing else in this feature's scope (admin-only restriction, correct restoration, the legacy fallback) requires more than that.
