# Phase 0 Research: Role and Permission Separation

The feature spec left no `[NEEDS CLARIFICATION]` markers — the requester gave an exact permission
list and an exact role→permission mapping. The research below resolves the *technical* unknowns
needed to design against the real codebase: how roles/permissions currently reach a request, what
already exists in `CLAUDE.md`'s documented (but not-yet-built) target shape, and how the
referenced "upton" branch solved the same problem previously.

## 1. How roles currently reach a request today

**Decision**: Keep the session as the single source of truth for "which roles does this request's
user hold," but stop writing permission-like strings into it. Compute the *effective* role set
(stored roles + the implicit default role) once, at the point the session is populated, and derive
permissions from that.

**Rationale**: `lib/auth.js`'s `getCurrentUser` currently does `req.session.roles = user.roles;`
for returning users, and only applies `auth.default_roles` at *account creation* time, persisting
whatever that config lists straight into `User.roles` in MongoDB. That is the literal "mixed
together" bug: anything used to seed baseline access (today, operators have used
`read_all_forms`/`write_active_travelers` in `default_roles`) ends up stored as if it were a role,
editable by any later role-management action. Computing the default role fresh on every request,
rather than persisting it, is what makes it un-removable (`spec.md` FR-005).

**Alternatives considered**:
- *Persist `user` into `User.roles` at creation, then special-case it everywhere it would be
  edited.* Rejected — every future role-editing code path (and anyone editing the collection
  directly) would need to remember the special case; one miss silently breaks FR-005.
- *Add a `baselineRole` virtual field on the schema.* Unnecessary — the default role never varies
  per user, so there is nothing per-user to store.

## 2. `CLAUDE.md` already documents the target shape

**Decision**: Build toward the architecture `CLAUDE.md` already describes, rather than a from-
scratch design:
- `lib/auth/index.js` "Sets `res.locals.roles`, `res.locals.permissions`, `res.locals.userid` from
  session."
- `lib/req-utils.js` already lists `reqUtils.requireAdmin()` and `reqUtils.isAdmin(req)` as
  existing middleware.
- `lib/role.js` is already described as just "Role constants: `Manager`, `Admin`, `Reviewer`" —
  no mention of the two permission strings currently mixed into it.

**Rationale**: None of the three exists yet in the actual code (`lib/auth.js` is a single file
with no `res.locals.roles`/`permissions`; `isAdmin`/`requireAdmin` are absent from
`lib/req-utils.js`; `lib/role.js` still exports `Read_all_forms`/`Write_active_travelers` today).
Git history shows `lib/auth/index.js` existed on the historical "Upton" line this branch forked
from. Treating `CLAUDE.md`'s description as the agreed target — rather than as stale documentation
to ignore — means this feature closes a documentation/code gap that already exists, instead of
inventing a fourth shape for the same concern.

**Alternatives considered**:
- *Treat `CLAUDE.md` as simply out of date and design independently.* Rejected — it would leave
  `CLAUDE.md` wrong in three more places than it already might be, and there's no indication the
  mismatch is anything other than this exact feature not having landed yet.

## 3. The `upton-4-permission` branch as reference design

**Decision**: Reuse its structural pattern — `lib/permission.js` holding the permission constants
and a `getPermissions(roles)` function that unions permissions across roles from a config object,
`config/permission.json` loaded by `config/config.js` the same way `email.json` is — rather than
copying its file contents, since its surrounding code (a different `lib/auth/ldap.js`, a different
`docker/`-based config layout, a different sample role→permission mapping) predates several
things this repository already has on the Ernest line.

**Rationale**: The branch is a real, working precedent for "config maps role to permission, with
a default role resolved outside the persisted role list" — exactly the shape FR-003/FR-004 need —
but it diverged from this codebase a long time ago (LDAP-only auth, Docker-first config, no
`email.json` split, etc.). Lifting the pattern and re-implementing it against the current
`lib/auth.js`/`config/config.js`/`lib/req-utils.js` avoids dragging in that drift.

**Alternatives considered**:
- *Merge/cherry-pick the branch directly.* Rejected — the diff touches hundreds of unrelated files
  (Dockerfile, old Jade input-view templates, a different LDAP client) that have nothing to do
  with this feature and would need to be reverted anyway.

## 4. Dropping blanket manager/admin access in `getAccess()`

**Decision**: Remove the two branches in `lib/req-utils.js#getAccess` that return full access
(`1`) solely because the requester holds the `manager` or `admin` role, since neither is one of
the five named permissions.

**Rationale**: `spec.md`'s Assumptions already flag this as an intentional behavior change, not
an oversight, and two independent sources confirm it's the right default rather than something to
ask the requester about: (a) the `upton-4-permission` branch's own `getAccess` dropped exactly
those two branches when it adopted the same permission model, and (b) this repo's own constitution
documents the access hierarchy as "owner → reviewer → sharedWith → sharedGroup → publicAccess" —
it never listed "holds the manager/admin role" as a tier, so removing it brings the code in line
with the hierarchy that was already supposed to be authoritative.

**Alternatives considered**:
- *Keep blanket access, add a 6th "manage all documents" permission to cover it.* Rejected — the
  requester enumerated exactly five permissions and did not ask for a sixth; inventing one to
  preserve an undocumented behavior would silently expand scope.

## 5. Validating `User.roles` on write

**Decision**: Add a Mongoose `enum` restricted to the three assignable roles on
`User.roles: [String]`, and have the `PUT /users/:id` handler in `routes/user.js` build the
`roles` array it persists from a known set (same three values) rather than passing `req.body`
through to `findOneAndUpdate` unfiltered.

**Rationale**: Today, `PUT /users/:id` forwards the entire request body straight into
`User.findOneAndUpdate`, so the `roles` field (if present in the body) is persisted with no
validation at all — any string, including `user` or something that isn't a role, can end up
stored. FR-005 and FR-009 require the system to actively prevent `user` from being stored as if it
were optional, and the edge case about legacy leftover entries requires the system to stop
treating unrecognized strings as meaningful. A schema-level `enum` plus a server-side allow-list
on the one write path closes both without touching the unrelated fields that same endpoint updates
today (name, email, office, phone, mobile via AD refresh).

**Alternatives considered**:
- *Validate only in the route handler, no schema-level enum.* Rejected — the schema is the last
  line of defense against any other write path (scripts, future endpoints) and costs nothing to
  add.

## 6. Testing approach

**Decision**: Add `test/lib/permission-test.js` (pure unit tests of `getPermissions(roles)`
against a fixture mapping) and `test/lib/role-test.js` (confirms `lib/role.js` exports exactly the
three assignable roles and nothing permission-shaped). Update `test/lib/req-utils-test.js` for the
`getAccess` branches being removed in §4.

**Rationale**: Matches the constitution's Development Workflow rule that "all new `lib/` functions
MUST have corresponding tests in `test/lib/`," and the existing test suite (Mocha, no new runner)
already has the fixture patterns to copy for config-backed unit tests.

**Alternatives considered**: None — this is the established project convention, not a choice.
