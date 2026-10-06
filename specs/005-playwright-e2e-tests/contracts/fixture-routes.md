# Contract: Fixture Routes

**Feature**: `005-playwright-e2e-tests` | **Consumers**: Playwright fixture
helpers (`e2e/fixtures/api-client.js`) only — these are the app's own
production routes, not a new interface this feature adds. This document
records exactly which existing route each fixture helper calls, its
authorization requirement, and gotchas discovered while verifying the design
(research.md Decision 2), so the tasks phase can implement the helpers
without re-deriving this from the route source again.

All calls are made with Playwright's `request` (APIRequestContext), using a
specific persona's saved `storageState` cookie — never a fresh, unauthenticated
context — since every route below requires an authenticated session.

## `grantRole` / `removeRole`

- **Route**: `PUT /users/:id`
- **Auth**: acting session must hold `admin` (checked against
  `req.session.roles`, `routes/user.js:298`)
- **Body**: `{ "roles": ["admin", "manager", "reviewer"] }` — this **replaces**
  the array; the helper must `GET /users/:id/json` first and compute the
  union (grant) or difference (remove) before sending the `PUT`.
- **Response**: `204` on success.
- **Used for**: spec User Story 3 Acceptance Scenario 1; enabling the
  `manager`/`admin` blanket-access checks in User Story 4; designating a
  `reviewer` before a User Story 1 review-request fixture.

## `setGroupMembership` (add)

- **Route**: `PUT /groups/:id/addmember/:user`
- **Auth**: acting session must hold `admin` (`routes/group.js:243`)
- **Path param**: `:user` is an **LDAP display name**, resolved via an AD/LDAP
  search (`ad.nameFilter`/`ad.searchBase`, `docker/ad.json`) — not the login
  id. The helper needs each persona's display name, not just its username.
  Fails `404`/`403` if the name doesn't resolve to exactly one directory
  entry.
- **Response**: `204` on success (also `204` if the user is already a
  member — idempotent).
- **Used for**: spec User Story 3 Acceptance Scenario 1 (group membership),
  and provisioning the `sharedGroup` scenarios in User Story 4/5.

## `setGroupMembership` (remove)

- **Route**: `PUT /groups/:id/removeMembers`
- **Auth**: acting session must hold `admin`
- **Body**: `[{ "_id": "<uid>" }, ...]` — by login id this time, not display
  name; no AD lookup involved.
- **Response**: `204` on success.

## `createGroup` (if a scenario needs a fresh group rather than a shared fixture one)

- **Route**: `POST /groups/`
- **Auth**: acting session must hold `admin`
- **Body**: `{ "name": "<group name>" }`
- **Response**: `200` with a link if a group with that name already exists;
  otherwise creates it. Idempotent by name.

## `shareWithUser`

- **Route**: `POST /<forms|travelers|binders>/:id/share/users/`
- **Auth**: document owner (`isOwnerMw`); admin also satisfies this via the
  blanket-role path in `getAccess`/write-access checks used elsewhere, but
  the share routes specifically check ownership, not the general access
  hierarchy — provision as the document's actual owner persona.
- **Body**: `{ "name": "<persona's AD display name>", "access": "read" | "write" }`
  — same AD display-name resolution as `setGroupMembership` (add), via
  `lib/share.js`'s `addUserFromAD`.
- **Response**: `201`-ish on success (see the route's own status code);
  `400` if already shared with that name.
- **Used for**: spec User Story 4 Acceptance Scenario 2; User Story 5
  Acceptance Scenario 3 (binder variant).

## `shareWithGroup`

- **Route**: `POST /<forms|travelers|binders>/:id/share/groups/`
- **Auth**: document owner
- **Body**: `{ "id": "<group _id>", "access": "read" | "write" }`
- **Used for**: spec User Story 4 Acceptance Scenario 3; User Story 5
  Acceptance Scenario 3.

## `setPublicAccess`

- **Route**: `PUT /<forms|travelers|binders>/:id/share/public`
- **Auth**: document owner
- **Body**: `{ "access": "-1" | "0" | "1" }` (no access / read / write)
- **Used for**: spec User Story 4 Acceptance Scenario 4; User Story 5
  Acceptance Scenario 3.

## `transferOwnership`

- **Route**: `PUT /<forms|travelers|binders>/:id/owner` (traveler variant
  verified at `routes/traveler.js:981`, gated additionally on the document's
  current status not being archived/frozen where relevant)
- **Auth**: current owner or admin (`isOwnerOrAdminMw`)
- **Body**: `{ "name": "<new owner's AD display name>" }`
- **Used for**: setting up an "acting as owner" precondition without having
  created the document as that persona originally.

## `setTravelerStatus`

- **Route**: `PUT /travelers/:id/status`
- **Auth**: write access to the traveler for `1 → 1.5` (submit); `admin` or
  `manager` role specifically for `1.5 → 2`, `1.5 → 1`, `2 → 1`, `2 → 4`
  (`routes/traveler.js:1088`, verified against the route's own transition
  table and role checks)
- **Body**: `{ "status": 1 | 1.5 | 2 | 3 | 4 }` — must be a single valid step
  in `model/traveler.js`'s `stateTransition` table from the traveler's
  current status; the route rejects an invalid jump with `400`.
- **Used for**: spec User Story 2 (all transitions); User Story 3 Acceptance
  Scenario 4 (pre-positioning a traveler at a given status without driving
  every prior UI step).

## Cleanup routes (archive, never delete)

Used by `e2e/fixtures/api-client.js`'s `cleanOut(artifact)` helper and by the
teardown in research.md Decision 8. Every call runs as the artifact's owning
persona. Artifacts are processed dependents-first: binders, travelers, forms,
released forms.

### `archiveBinder`

- **Route**: `PUT /binders/:id/status`
- **Auth**: owner (`isOwnerMw`, `routes/binder.js:558`)
- **Body**: `{ "status": 3 }` (3 is the model's "archived")
- **Response**: `200` on success; `204` if already in that status

### `archiveTraveler`

- **Route**: `PUT /travelers/:id/archived`
- **Auth**: owner (`isOwnerMw`, `routes/traveler.js:950`)
- **Body**: `{ "archived": true }`
- **Response**: `200` on success; `204` if already archived

### `archiveForm`

- **Route**: `PUT /forms/:id/archived`
- **Auth**: owner (`isOwnerMw`, `routes/form.js:921`)
- **Body**: `{ "archived": true }`
- **Pre-step**: if the form is under review (status `0.5`), first remove each
  of its review requests with `DELETE /forms/:id/review/requests/:requestId`
  (owner, status `0.5` only, `routes/form.js:653`), so the reviewer's
  `users.reviews` reference is not left pointing at an archived form.
- **Response**: `200` on success; `204` if already archived

### `archiveReleasedForm`

- **Route**: `PUT /released-forms/:id/status`
- **Auth**: owner or admin (`isOwnerOrAdminMw`, `routes/form-management.js:107`)
- **Body**: `{ "status": 2, "version": "<ver>" }` — `version` must equal the
  released form's current `ver` string; the route rejects a mismatch with
  `400`, so the helper reads `GET /released-forms/:id/json` first.
- **Response**: `200` on success; `204` if already archived

Each cleanup helper treats a non-2xx response as a cleanup failure and records
it in the run's registry (data-model.md, Created Artifact), so the run report
can list it under FR-015 rather than dropping it silently.

## Provisioning a released form (chained, not a single call)

There is no single-call shortcut; a "released form" fixture is a short
sequence of real calls, all as real routes:

1. `POST /forms/` as the owner persona — `{ "title": "...", "html": "..." }`
   (title required, `routes/form.js:843`)
2. `PUT /forms/:id/status` as the owner — `{ "status": 0.5, "version": <f._v> }`
   (submit for review)
3. `POST /forms/:id/review/requests` as the owner —
   `{ "uid": "<reviewer's login id>", "name": "<reviewer's display name>" }`
   (`routes/form.js:639`; the reviewer must already hold the `reviewer` role
   via `grantRole`)
4. `POST /forms/:id/review/results` as the **reviewer persona** —
   `{ "result": "1" }` (`"1"` approves; `"2"` requests changes and reverts the
   form to draft, per `model/review.js`)
5. `PUT /forms/:id/released` as the owner — creates the `ReleasedForm`
   snapshot and sets the form to status `1` (`routes/form.js:1010`; requires
   `allApproved()`, i.e. step 4 completed with result `"1"` for every
   requested reviewer at the form's current version)

This is slower than a direct database insert would be, but needs no
test-only code path and exercises the review/release logic itself — which is
the behavior User Story 1 exists to protect. Where a *different* story (e.g.
User Story 2 or 3) needs a released form only as a precondition, the fixture
helper runs this same sequence once and reuses the resulting released-form
id, rather than re-deriving a shortcut.
