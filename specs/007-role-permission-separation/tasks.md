---

description: "Task list for role and permission separation"
---

# Tasks: Role and Permission Separation

**Input**: Design documents from `/specs/007-role-permission-separation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/role-management.md, quickstart.md

**Tests**: Included. The constitution's Development Workflow requires a test for every new `lib/`
function and a smoke test for every new/changed route, so test tasks are not optional here.

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1, US2, US3) — omitted for Setup,
  Foundational, and Polish tasks
- File paths are exact, relative to the repository root

## Path Conventions

Existing single Node.js/Express repository (see `plan.md` Project Structure) — no `src/`/`backend/`
split. Paths below are `config/`, `lib/`, `model/`, `routes/`, `utilities/`, `views/`, `test/lib/`.

---

## Phase 1: Setup

**Purpose**: Add the new, required configuration file and wire its loader. Nothing in this phase
contains authorization logic yet.

- [X] T001 [P] Create `config/permission_change.json` as the example/default role→permission
  mapping, following the `_change.json` convention of `config/email_change.json` etc. Content
  exactly as in `data-model.md`'s Role-to-Permission Mapping section:
  ```json
  {
    "user": ["read_all_forms", "write_active_travelers"],
    "manager": ["approve_travelers"],
    "reviewer": ["review_forms", "approve_travelers"],
    "admin": ["review_forms", "approve_travelers", "manage_users"]
  }
  ```
- [X] T002 [P] In `config/config.js`, add `module.exports.permission = require('../' + configPath + '/permission.json');` next to the other required loads (same pattern as `email.json` — required, unlike the `optionalRequire`'d `mqtt.json`).

**Checkpoint**: `config.permission` is loadable; nothing reads it yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared mechanism every user story depends on — permission constants, the
config-driven lookup, the trimmed role list, where roles/permissions land on a request, and the
middleware helpers that read them. No user story's acceptance scenario can be exercised until
this phase is done.

**⚠️ CRITICAL**: Do not start Phase 3+ until this phase is complete.

- [X] T003 Create `lib/permission.js`: export the five permission constants as lower-snake-case
  string values (`Read_all_forms = 'read_all_forms'`, `Write_active_travelers = 'write_active_travelers'`,
  `Review_forms = 'review_forms'`, `Approve_travelers = 'approve_travelers'`, `Manage_users = 'manage_users'`),
  a `PermissionList` array of all five, and `getPermissions(roles)`: reads `config.permission`
  (from `config/config.js`), unions the permissions listed for every role in `roles` that has an
  entry in the config, de-duplicates, and filters the result to `PermissionList` so an
  unrecognized permission string in the config (or a role with no entry) never produces an
  unrecognized or thrown result (`data-model.md`: "getPermissions filters, it never throws").
- [X] T004 [P] Trim `lib/role.js` to export only `Manager = 'manager'`, `Admin = 'admin'`,
  `Reviewer = 'reviewer'`, and `Roles = [Manager, Admin, Reviewer]`. Remove the `Read_all_forms`
  and `Write_active_travelers` constants and the `Permissions` array from this file entirely —
  they now live only in `lib/permission.js` (T003).
- [X] T005 Move `lib/auth.js` to `lib/auth/index.js` (`git mv`), no content change in this task.
  Every existing call site uses the extension-less `require('../lib/auth')` / `require('./auth')`,
  which Node resolves to `auth/index.js` exactly as it resolved to `auth.js` — no caller edits
  needed (confirmed in `research.md` §2).
- [X] T006 In `lib/auth/index.js`'s `sessionLocals(req, res, next)` (runs on every web-app request
  via `app.use(auth.sessionLocals)` in `app.js`), when `req.session.userid` is set, also assign:
  `res.locals.userid = req.session.userid`; `res.locals.roles = ['user'].concat(req.session.roles || [])`;
  `res.locals.permissions = getPermissions(res.locals.roles)` (import `getPermissions` from
  `lib/permission.js`). Leave the existing `res.locals.session`/`res.locals.prefix` assignment
  untouched. Depends on: T003, T005.
- [X] T007 [P] In `model/user.js`, import `Roles` from `lib/role.js` and add `enum: Roles` to the
  `roles: [String]` field definition. Note for later tasks: Mongoose does **not** run schema
  validators on `findOneAndUpdate` by default, so this enum alone does not protect the
  `PUT /users/:id` write path in `routes/user.js` (T014 handles that path explicitly) — it is
  defense-in-depth for `.save()`-based writes such as `storeUser`'s `new User(...).save()` in
  `routes/user.js`.
- [X] T008 In `lib/req-utils.js`: add `isAdmin(req)` (returns whether `res.locals.roles` contains
  `'admin'`, matching `CLAUDE.md`'s documented contract) and `requireAdmin()` (a middleware
  factory: `next()` if `isAdmin(req)`, else `403`); add `requirePermission(permission)` (a
  middleware factory: `next()` if `res.locals.permissions` includes `permission`, else `403`).
  Update `isOwnerOrAdminMw` to call the new `isAdmin(req)` instead of its current inline
  `routesUtilities.checkUserRole(req, 'admin')`. In `getAccess()`, delete the two branches that
  return `1` solely because `routesUtilities.checkUserRole(req, Manager)` or
  `routesUtilities.checkUserRole(req, Admin)` is true — this blanket role-only access is not one
  of the five permissions and is dropped per `research.md` §4 / `spec.md`'s Assumptions. Remove
  the now-unused `Manager`/`Admin` import from `./role` in this file if nothing else in it needs
  them. Depends on: T003, T006.
- [X] T009 In `utilities/routes.js`, add `hasPermission(req, permission)`: reads
  `req.res.locals.permissions` and returns whether it includes `permission` — same `(req, X)` call
  shape as the existing `checkUserRole(req, role)` so call sites can be swapped 1:1. Export it
  alongside `checkUserRole`. Depends on: T006.
- [X] T010 Create `test/lib/permission-test.js` covering `getPermissions` against an in-test
  fixture mapping (do not depend on the real `etc/traveler-config/permission.json`): (a) a role
  with an entry returns exactly its listed permissions; (b) a role with no entry in the mapping
  grants nothing; (c) a permission string in the mapping that is not in `PermissionList` is
  filtered out of the result; (d) permissions from multiple held roles are unioned and
  de-duplicated. Depends on: T003.
- [X] T011 [P] Create `test/lib/role-test.js` asserting `lib/role.js`'s `Roles` array is exactly
  `['manager', 'admin', 'reviewer']` (no more, no less, order-independent) and that the module does
  not export anything named `Read_all_forms`, `Write_active_travelers`, or `Permissions`. Depends
  on: T004.
- [X] T012 Update `test/lib/req-utils-test.js`'s existing `getAccess` test cases: remove/replace
  any assertion that a requester holding only the `manager` or `admin` role gets full (`1`) access
  to a document they don't own, aren't shared on, and isn't public — such a requester should now
  get the same result as any other non-owner, non-shared, non-public requester (per T008). Depends
  on: T008.

**Checkpoint**: Foundation ready — roles/permissions are computed per-request and the middleware
helpers exist. User story implementation can now begin.

---

## Phase 3: User Story 1 - Administrator grants and revokes roles for a user (Priority: P1) 🎯 MVP

**Goal**: An admin can add/remove `manager`/`admin`/`reviewer` on any account through the existing
admin UI/endpoint, gated by the `Manage_users` permission, with the write path itself refusing to
store `user` or any unrecognized role string.

**Independent Test**: Admin adds `reviewer` to a user with no optional roles; that user can now
approve a submitted traveler; admin removes it; the ability is gone, and no other user's roles or
abilities changed.

### Implementation for User Story 1

- [X] T013 [US1] In `routes/user.js`, replace the inline
  `req.session.roles === undefined || req.session.roles.indexOf('admin') === -1` checks in
  `POST /users/`, `GET /users/json`, `PUT /users/:id`, `GET /users/:id/ownership`, and
  `GET /users/:id/refresh` with `reqUtils.requirePermission(Manage_users)` route middleware
  (import `Manage_users` from `lib/permission.js`, `reqUtils` already imported in this file).
  Depends on: T008.
- [X] T014 [US1] In `routes/user.js`'s `PUT /users/:id` handler, before the call to
  `User.findOneAndUpdate`: if `req.body.roles` is an array, replace it with
  `req.body.roles.filter(r => Roles.includes(r))` (import `Roles` from `lib/role.js`) so `user`
  and any other value outside the three assignable roles is silently dropped, never persisted
  (per `contracts/role-management.md` — not an error response, just not stored). Also pass
  `{ runValidators: true }` as the options argument to `findOneAndUpdate`, so T007's schema enum
  is enforced on this write path too. Depends on: T013, T007.
- [X] T015 [US1] In `routes/traveler.js` (the submitted-traveler approve/reject gate, ~lines
  1180-1200), replace the inline
  `routesUtilities.checkUserRole(req, 'admin') || routesUtilities.checkUserRole(req, 'manager')`
  checks with `routesUtilities.hasPermission(req, Approve_travelers)` (import `Approve_travelers`
  from `lib/permission.js`). Do **not** touch the separate admin-only status-override checks
  elsewhere in this file (~lines 1061, 1109-1117) — those are out of scope here and handled
  unchanged in T027. Depends on: T009.
- [X] T016 [US1] In `routes/user.js`'s `GET /users/:id` and `GET /usernames/:name` handlers,
  compute `const permissions = getPermissions(['user'].concat(user.roles || []));` (import
  `getPermissions` from `lib/permission.js`) for the **viewed** user — not the logged-in session —
  and pass it into `getRenderObject(req, { user, permissions, myRoles: req.session.roles })`.
- [X] T017 [US1] In `views/user.jade`, add a "Permissions" `dt`/`dd` row immediately after the
  existing "Roles" row (`dt Roles` / `dd #{user.roles}`), rendering `#{permissions}`. Depends on:
  T016.
- [X] T018 [P] [US1] Add a test (new file `test/lib/user-roles-test.js`, following the existing
  `test/lib/req-utils-test.js` style for exercising a route handler directly) covering: a
  non-admin's `PUT /users/:id` request with a `roles` body is rejected with `403`; an admin's
  `PUT /users/:id` with `roles: ['user', 'manager', 'bogus']` results in the stored
  `User.roles` being exactly `['manager']`. Depends on: T014.
- [X] T019 [P] [US1] Add a test confirming a user holding only the `manager` role (no `admin`,
  no `reviewer`) can reach the traveler-approval gate touched in T015, and a user holding none of
  `manager`/`admin`/`reviewer` cannot. Depends on: T015.

**Checkpoint**: User Story 1 is fully functional and independently testable.

---

## Phase 4: User Story 2 - Every account keeps its baseline abilities no matter what (Priority: P2)

**Goal**: `Read_all_forms` and `Write_active_travelers` are present for every account regardless of
its optional roles, and the `user` role can never be added to or removed from an account through
any code path.

**Independent Test**: Attempt, as an admin, to add or remove `user` via the role-editing path;
confirm it has no effect on the stored roles and the account's baseline abilities are unaffected
either way.

### Implementation for User Story 2

- [X] T020 [P] [US2] Add a `getPermissions(['user'])` case to `test/lib/permission-test.js`
  (extends T010) asserting it already includes `read_all_forms` and `write_active_travelers` with
  no optional role present — the baseline does not depend on any optional role being held. Depends
  on: T010.
- [X] T021 [US2] Add a test (extends T018's file, `test/lib/user-roles-test.js`) submitting
  `PUT /users/:id` with `roles: ['user']` only, and asserting the account's stored `User.roles`
  is unchanged by the call (i.e., `'user'` never lands in the persisted array) and that the
  account's effective permissions still include the two baseline permissions regardless. Depends
  on: T014, T018.
- [X] T022 [US2] Add a test for `lib/auth/index.js`'s `sessionLocals` confirming
  `res.locals.roles` includes `'user'` and `res.locals.permissions` includes the two baseline
  permissions even when `req.session.roles` is `[]` or `undefined`. Depends on: T006.

**Checkpoint**: User Stories 1 AND 2 both work independently (T020/T022 do not require US1's
route changes; T021 reuses US1's endpoint from T014).

---

## Phase 5: User Story 3 - Role→permission mapping is adjustable via config only (Priority: P3)

**Goal**: Changing which abilities a role grants (e.g., whether `reviewer` includes
`review_forms`) is a one-file config edit with no code change, and it takes effect for every
holder of that role.

**Independent Test**: Edit the mapping to grant a role a new permission; confirm every account
holding that role gains the resulting ability without any change to that account's stored roles.

### Implementation for User Story 3

- [X] T023 [US3] In `lib/review.js`'s `addReviewRequest`, replace the
  `reviewer.roles.includes(Reviewer)` eligibility check with
  `getPermissions(['user'].concat(reviewer.roles)).includes(Review_forms)` (import
  `getPermissions`/`Review_forms` from `lib/permission.js`); drop the now-unused `Reviewer` import
  from `./role` in this file.
- [X] T024 [US3] In `routes/review.js`, replace both inline
  `req.session.roles.indexOf(Reviewer) === -1` checks (on `/reviews/` and `/reviews/forms/json`)
  with `routesUtilities.hasPermission(req, Review_forms)` (import `Review_forms` from
  `lib/permission.js`; drop the now-unused `Reviewer` import from `../lib/role`). Depends on: T009.
- [X] T025 [P] [US3] Add a case to `test/lib/permission-test.js` (extends T010) that calls
  `getPermissions` against two different in-test fixture mappings — one where `manager` grants
  only `approve_travelers`, one where it also grants `review_forms` — and asserts the output
  differs accordingly with no change to `getPermissions` itself, demonstrating the config-only
  property described in `quickstart.md` step 4. Depends on: T010.
- [X] T026 [P] [US3] Add a test confirming a `reviewer`-only account can reach `/reviews/` (T024)
  under the default mapping (T001), and a `manager`-only account cannot. Depends on: T024.

**Checkpoint**: All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finish modernizing the remaining inline role checks without changing their behavior,
and validate the whole feature end-to-end.

- [X] T027 [P] In `routes/traveler.js` (~lines 1061, 1109-1117), replace the inline
  `routesUtilities.checkUserRole(req, 'admin')` calls with `reqUtils.isAdmin(req)`, preserving
  existing behavior exactly — this admin-only traveler-status override is not one of the five
  permissions and `spec.md` does not ask to change it; only the check mechanism is modernized.
  Depends on: T008.
- [X] T028 [P] Update `CLAUDE.md`'s Configuration section to add `permission.json` to the list of
  files `config/config.js` merges from `../etc/traveler-config/`, matching the Development
  Workflow rule that a config schema change updates both the loader and its documentation.
- [X] T029 [P] Run `npx eslint .` and `npx prettier --write .` across every file touched by this
  feature. NOTE: `npx eslint .` fails in this environment on an unrelated, pre-existing issue —
  ESLint 9.39.4 is installed but the repo's config is the legacy `.eslintrc` format, which ESLint 9
  no longer reads (confirmed by running it on an unmodified checkout). `npx prettier --write`
  ran successfully on every file this feature touched.
- [X] T030 Run `npx mocha test/lib/` (the full suite) and confirm it passes, including every test
  added or changed in T010-T012, T018-T022, T025-T026. Depends on: all prior test tasks. NOTE:
  `test/lib/ldap-client-test.js` fails to even load in this environment (`config/ad.json` doesn't
  exist here — pre-existing, requires a real LDAP deployment's config, unrelated to this feature).
  Running the suite excluding that one file: 302 passing, 0 failing.
- [ ] T031 Manually execute all 5 scenarios in `quickstart.md` against a local run (`node app.js`
  with `etc/traveler-config/permission.json` copied from T001) and confirm each scenario's
  "Expected" outcome holds. Depends on: T030. **NOT DONE** — this environment has no running
  MongoDB/LDAP/app instance to execute this against. Needs manual verification by someone with
  the docker stack running, per CLAUDE.md.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup (T002 needs T001's file to exist for a real run,
  though the tasks can be authored in either order) — **BLOCKS all user stories**.
- **User Stories (Phase 3-5)**: All depend on Foundational completion.
  - US1 (P1) has no dependency on US2 or US3.
  - US2 (P2)'s T020/T022 have no dependency on US1; T021 depends on US1's T014.
  - US3 (P3) has no dependency on US1 or US2.
- **Polish (Phase 6)**: Depends on whichever of US1/US2/US3 are in scope for this delivery; T030
  depends on all test tasks; T031 depends on T030.

### Within Each Phase

- Tasks touching the same file are sequential (no `[P]`), even within a user story (e.g.
  T013→T014 both edit `routes/user.js`).
- `[P]` tasks touch different files and have no incomplete dependency.

### Parallel Opportunities

- T001 and T002 (Setup) in parallel.
- T004 and T007 (Foundational) in parallel with the T003→T005→T006→T008→T009 chain (different
  files), though T008/T009 still need T006 done first.
- T011 in parallel with T010/T012.
- T018 and T019 (US1 tests) in parallel once their respective implementation tasks land.
- T020, T025, T026 (test-only, different files/cases) in parallel with each other.
- T027, T028, T029 (Polish) in parallel with each other.

---

## Parallel Example: Foundational

```bash
# Can be done at the same time as the lib/auth.js chain (different files):
Task: "Trim lib/role.js to the 3 assignable roles (T004)"
Task: "Add enum: Roles to model/user.js's roles field (T007)"
```

## Parallel Example: User Story 1 tests

```bash
Task: "Add PUT /users/:id role-filtering test in test/lib/user-roles-test.js (T018)"
Task: "Add traveler-approval permission test (T019)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational) — required before anything is testable.
2. Complete Phase 3 (US1): an admin can grant/revoke roles and see the effect, including on
   traveler approval.
3. **STOP and VALIDATE**: run `quickstart.md` scenarios 1-2.
4. This is already a complete, demonstrable fix for the "roles and permissions are mixed
   together" problem described in `spec.md`'s Input.

### Incremental Delivery

1. Setup + Foundational → mechanism in place, nothing user-visible yet.
2. Add US1 → admin role management works end-to-end → validate → this is the MVP.
3. Add US2 → baseline-permission guarantees are explicitly tested → validate.
4. Add US3 → form-review access becomes config-driven (reviewer gains `review_forms`, matching
   the updated `data-model.md` mapping) → validate.
5. Polish → remaining inline role checks modernized, docs and lint/test pass, full quickstart run.

## Notes

- `[P]` tasks = different files, no incomplete dependency.
- `[Story]` label maps a task to its user story for traceability; Setup/Foundational/Polish tasks
  have none because they serve every story.
- Commit after each task or logical group.
- Stop at any checkpoint to validate a story independently before moving on.
