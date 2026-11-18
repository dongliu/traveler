# Feature Specification: Role and Permission Separation

**Feature Branch**: `007-role-permission-separation`

**Created**: 2026-11-11

**Status**: Draft

**Input**: User description: "In the current implementation, the roles and permissions are mixed together in lib/role.js. Make changes to achieve the following 1) seperate roles and permissions, the admin can modify the user's roles, and permission is controled by a configuration file that maps role to permission. 2) define a default role as `user`. that role cannot be added or removed from a user. 3) manager, admin, and reviewer are the roles that can be added or removed. 4) the permission list includes Read_all_forms, Write_active_travelers, Review_forms, Approve_travelers, Manage_users. `user` can Read_all_forms and Write_active_travelers. manager can Approve_travelers. reviewer can Approve_travelers. admin can Review_forms, Approve_travelers, Manage_users. The design and implementation can refer to the upton branch."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Administrator grants and revokes roles for a user (Priority: P1)

An administrator needs to change what a specific person is allowed to do in the system — for example, making someone a reviewer so they can start approving traveler work, or taking away someone's manager role when they change jobs. Today, "roles" and the specific abilities they unlock are tangled together, which makes it hard to be sure a change to one person's roles only affects what it's supposed to affect.

**Why this priority**: This is the core administrative action the feature exists to make safe and reliable — everything else (the permission list, the default role) exists to support this action.

**Independent Test**: Can be fully tested by having an administrator add the `reviewer` role to a user who doesn't have it, confirming the user gains the ability to approve travelers, then removing the role and confirming that ability is gone — without touching any other user's access.

**Acceptance Scenarios**:

1. **Given** an administrator is viewing a user who has no optional roles, **When** the administrator assigns the `manager` role to that user, **Then** the user immediately becomes able to approve travelers, and no other user's roles or abilities change.
2. **Given** a user currently holds the `admin` role, **When** an administrator removes the `admin` role from that user, **Then** the user loses the abilities that come only from being an admin (reviewing forms, approving travelers via the admin role, and managing other users' roles), while keeping every ability granted by their remaining roles.
3. **Given** a user who is not an administrator, **When** that user attempts to add or remove a role on any account (including their own), **Then** the system refuses the change.

---

### User Story 2 - Every account keeps its baseline abilities no matter what (Priority: P2)

Every person who uses the system — regardless of any special role — needs to always be able to read all forms and submit data on active travelers. This baseline must not be something an administrator can accidentally take away while managing someone's optional roles.

**Why this priority**: This protects the most basic, day-to-day functionality of the system from being broken by a role-management mistake; it is the safety net that makes User Story 1 safe to use freely.

**Independent Test**: Can be fully tested by attempting, as an administrator, to remove the baseline role from a user (e.g., through the same control used to manage optional roles) and confirming the system does not allow it and the user's baseline abilities are unaffected.

**Acceptance Scenarios**:

1. **Given** any user account, **When** an administrator views or edits that user's roles, **Then** the baseline role is not presented as something that can be removed, and no action in the system results in its removal.
2. **Given** a brand-new user who has never been given any optional role, **When** that user uses the system, **Then** they can already read all forms and write to active travelers.
3. **Given** a user who holds one or more optional roles, **When** all of those optional roles are removed, **Then** the user still retains the baseline abilities.

---

### User Story 3 - The set of abilities each role grants can be adjusted without a code change (Priority: P3)

The person responsible for configuring the system needs to be able to look up, in one place, exactly which abilities each role grants, and to adjust that mapping (for example, adding a new ability to the reviewer role in the future) without needing a developer to change and redeploy the application.

**Why this priority**: This is what makes the separation durable — without it, "roles" and "what they can do" would just be re-mixed the next time a requirement changes. It is lower priority than Stories 1 and 2 because the initial, correct mapping can ship without this being exercised on day one.

**Independent Test**: Can be fully tested by locating the role-to-ability mapping, changing which abilities a role grants, and confirming the change takes effect for every user who holds that role without any change to application code.

**Acceptance Scenarios**:

1. **Given** the current mapping of roles to the abilities they grant, **When** an authorized person inspects it, **Then** they can see, for every role, the complete and exact list of abilities it grants.
2. **Given** a change to the mapping (for example, granting a new ability to the `manager` role), **When** the change is saved, **Then** every user holding the `manager` role gains that ability without any per-user edits.

---

### Edge Cases

- What happens when an administrator removes their own `admin` role? The action MUST be allowed to proceed like any other role change (the system does not special-case "self"), which means administrators must take care not to remove the last remaining admin; this is an operational responsibility, not a system-enforced guarantee.
- What happens to a user account that, under the prior mixed design, had something like `read_all_forms` stored as if it were one of their roles? Such leftover entries are no longer meaningful under the new design and MUST be treated as inert — they grant nothing and MUST NOT be displayed or offered as a role an administrator can add or remove.
- What happens if a user holds more than one role that grants the same ability (e.g., both `manager` and `reviewer` grant the ability to approve travelers)? The user simply has that ability once; holding it via multiple roles has no additional effect and removing one of the two roles does not remove the ability as long as the other role remains.
- What happens if the configured mapping is missing an entry for a role that exists in the system, or lists an ability that isn't one of the five defined abilities? The system MUST treat the role as granting no abilities beyond its omissions, and MUST ignore any listed ability that is not one of the five defined abilities, rather than failing to start or granting unintended access.
- What happens to abilities that today come from simply holding the `manager` or `admin` role but are not part of the five named abilities (for example, broad access to every form and traveler regardless of ownership or sharing)? Those abilities are intentionally not carried forward as blanket, role-only access; going forward, access to a specific form or traveler continues to be governed by ownership, sharing, and the five named abilities — not by holding a role alone. See Assumptions.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST treat "roles" (labels that can be held by a user account) and "permissions" (specific abilities that gate a protected action) as two distinct concepts, no longer represented as a single mixed list.
- **FR-002**: System MUST support exactly five permissions: Read_all_forms, Write_active_travelers, Review_forms, Approve_travelers, and Manage_users.
- **FR-003**: System MUST define, in one configurable location, which permissions each role grants, and MUST compute a user's effective permissions as the union of the permissions granted by every role the user currently holds.
- **FR-004**: System MUST define a default role, `user`, that every account holds automatically and that grants the Read_all_forms and Write_active_travelers permissions.
- **FR-005**: System MUST prevent the default `user` role from ever being added to or removed from an individual account — it is implicit and constant for every account.
- **FR-006**: System MUST support exactly three roles that can be added to or removed from a user account: `manager`, `admin`, and `reviewer`.
- **FR-007**: System MUST grant the Approve_travelers permission to a user who holds the `manager` role, the `reviewer` role, the `admin` role, or any combination of the three.
- **FR-008**: System MUST grant the Review_forms permission to a user who holds the `reviewer` role, the `admin` role, or both, and MUST grant the Manage_users permission only to a user who holds the `admin` role.
- **FR-009**: System MUST restrict the ability to add or remove the `manager`, `admin`, or `reviewer` role on any user account to users who hold the Manage_users permission.
- **FR-010**: System MUST re-evaluate every existing protected action that currently depends on a role (reading all forms, writing to active travelers, viewing or acting on the form-review queue, approving or rejecting submitted travelers, and managing user accounts and their roles) so that each action is permitted only when the acting user's effective permissions include the corresponding permission from FR-002.
- **FR-011**: System MUST allow an authorized person to view, for any given role, the complete list of permissions it currently grants, and to view, for any given user, which roles they hold and which permissions are in effect as a result.
- **FR-012**: System MUST allow the mapping between roles and the permissions they grant to be changed without requiring a change to application code; such a change MUST take effect for every user holding the affected role.
- **FR-013**: System MUST NOT grant any ability beyond the five permissions in FR-002 on the basis of a role alone; any other access to a specific form, traveler, or other document continues to be determined by that document's existing ownership, sharing, and public-access rules, independent of role.

### Key Entities

- **Role**: A named label that can be held by a user account. One role (`user`) is the implicit default held by every account and cannot be assigned or removed per-account. Three roles (`manager`, `admin`, `reviewer`) are optional and can be added to or removed from any account by someone with the Manage_users permission.
- **Permission**: One of five named abilities that gates a specific protected action in the system: Read_all_forms, Write_active_travelers, Review_forms, Approve_travelers, Manage_users.
- **Role-to-Permission Mapping**: The configuration that defines which permissions each role (including the default role) grants. This mapping is the single source of truth for the authorization model and can be changed independently of any individual user's assigned roles.
- **User Account**: Has one identity, always holds the default role, and may additionally hold zero or more of the three optional roles. Its effective permissions are the union of the permissions granted by all roles it holds.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An administrator can change a user's optional roles in a single action, and the resulting change in that user's abilities is correct 100% of the time, with no unintended change to any other user's abilities.
- **SC-002**: 0% of role-management actions are able to remove a user's baseline abilities (reading all forms, writing to active travelers); every account retains these abilities regardless of what optional roles it does or doesn't hold.
- **SC-003**: Adjusting which abilities a role grants is achievable by editing a single configuration, with no application code change, and the adjustment applies to every current and future holder of that role.
- **SC-004**: For any of the five defined abilities, an authorized person can determine which roles grant it and which users currently have it, without needing to read source code.
- **SC-005**: Every place in the system that previously made an access decision directly from a role name now makes that decision from one of the five named permissions, eliminating ad hoc, undocumented role checks.

## Assumptions

- **Reference implementation**: An existing internal branch (referred to as "upton", specifically its permission-focused line of work) already demonstrates this role/permission separation pattern — a configuration mapping roles to permissions, and a default role resolved outside of a user's stored role list so it can't be edited away. This feature follows that same pattern; the specific five-permission list and role-to-permission assignments in this spec are as given by the requester, which differ in detail from that branch's own sample configuration.
- **Admin keeps exclusive control of user management**: Only the `admin` role carries Manage_users, so only administrators can change anyone's optional roles (including, deliberately, their own) — matching "the admin can modify the user's roles."
- **The `reviewer` role keeps its form-review ability and gains traveler approval**: Today, holding something equivalent to a reviewer role is what lets a person be assigned to review form templates and see the form-review queue. That ability is preserved: `reviewer` grants Review_forms, same as `admin`. `reviewer` additionally grants Approve_travelers, which is new — previously only `admin`/`manager` could approve travelers. So holding `reviewer` now means "can review form templates and can approve traveler work," while `admin` alone is still the only role that can manage other users' roles (Manage_users).
- **No more blanket access from holding `manager` or `admin` alone**: Today, simply holding the manager or admin role grants unrestricted read/write access to every form and traveler, regardless of ownership or sharing. That blanket behavior is not one of the five named permissions and is not carried forward as-is; access to a specific document continues to come from ownership, sharing, public access, or the five named permissions. This matches the documented access hierarchy (owner → reviewer-on-that-document → shared-with → shared-group → public access), which never included "holds the manager/admin role" as a tier, and matches the reference implementation referenced above.
- **Leftover legacy entries are harmless**: Any account that, under the old mixed design, ended up with a permission-like string (e.g. `read_all_forms`) stored among its roles is assumed safe to leave in place; the new design simply stops treating such entries as meaningful, rather than requiring a cleanup pass before launch.
- **Role changes take effect on next use, not mid-session**: Consistent with how role changes already behave today, a change to a user's roles is assumed to take effect the next time that user's session is established (e.g., next login), not instantaneously inside a browser tab the user already has open.
