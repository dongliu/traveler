# Implementation Plan: Role and Permission Separation

**Branch**: `007-role-permission-separation` | **Date**: 2026-11-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-role-permission-separation/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Split the mixed role/permission list in `lib/role.js` into three separate pieces: a fixed set of
five permission names (`lib/permission.js`), a config file that maps each role (including the
implicit default `user` role) to the permissions it grants (`config/permission.json`, loaded by
`config/config.js`), and a trimmed `lib/role.js` holding only the three roles an admin can assign
or remove (`manager`, `admin`, `reviewer`). The default role's permissions (`Read_all_forms`,
`Write_active_travelers`) are computed at request time and never written to the `User.roles` field
in MongoDB, so they can't be edited away. Every place in the app that currently makes an access
decision from a raw role string (`routes/user.js`, `routes/review.js`, `routes/traveler.js`,
`lib/review.js`, `lib/req-utils.js`'s `getAccess`) is re-pointed at the new permission set. The
design follows the pattern already proven out on the `upton-4-permission` branch (config-driven
role→permission mapping, default role resolved outside the stored role list) and completes an
architecture `CLAUDE.md` already documents ahead of the code — `lib/auth/index.js` setting
`res.locals.roles`/`res.locals.permissions`/`res.locals.userid`, and `reqUtils.isAdmin(req)` /
`reqUtils.requireAdmin()` — neither of which exists yet in this codebase.

## Technical Context

**Language/Version**: JavaScript, Node.js 14 (`.nvmrc`)

**Primary Dependencies**: Express 4.17 (two instances: session-auth web app + basic-auth REST
API), Mongoose 5.13 (MongoDB), Jade view engine, jQuery + Bootstrap on the frontend (no build
step), Winston via `lib/loggers.js`

**Storage**: MongoDB via Mongoose. `User.roles` continues to store only the three assignable role
strings (`manager`, `admin`, `reviewer`); the role→permission mapping itself lives in a JSON
config file, not the database, and the default role's permissions are never persisted per-user.

**Testing**: Mocha (`test/lib/`). New: `test/lib/permission-test.js`, `test/lib/role-test.js`.
Updated: `test/lib/req-utils-test.js` (the `getAccess` branches being removed).

**Target Platform**: Linux server; the existing two-Express-instance Node.js deployment. No
infrastructure or deployment change.

**Project Type**: Web application — single Node.js codebase, server-rendered Jade views plus a
separate JSON REST API process; not a frontend/backend split, not mobile.

**Performance Goals**: N/A — permission checks are in-memory array lookups against data already
loaded into the session/request; no new query or network cost. No regression to existing request
latency.

**Constraints**: Must not change `routes/api.js` behavior — the REST API is basic-auth only and
does not use role/permission checks today, and that stays true (Two-Server Separation, below).
Must not introduce a build step or a new frontend framework (Minimal, Build-Free Frontend, below).
The existing admin UI's role checkboxes (`manager`/`reviewer`/`admin` — never `user`) keep working
without a redesign.

**Scale/Scope**: Internal tool; a handful of administrators managing on the order of tens to low
hundreds of user accounts. No scale-driven design pressure.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Lifecycle State Machine** — N/A. `User` is not a lifecycle-state entity (no `stateTransition`
  governs it today); this feature does not add one. **PASS**.
- **II. Permission-Layered Access Control** — Directly engaged, and this feature *increases*
  compliance rather than risking it: today `routes/user.js`, `routes/review.js`, and
  `routes/traveler.js` each inline their own `req.session.roles.indexOf(...)` checks instead of
  going through `lib/req-utils.js`. This plan moves those checks into `reqUtils.requireAdmin()`
  and a new `reqUtils.requirePermission(permission)` factory. The documented owner → reviewer →
  sharedWith → sharedGroup → publicAccess hierarchy inside `getAccess()` is untouched; only the
  two extra blanket-access branches for the `manager`/`admin` *roles* (which sit outside that
  documented hierarchy) are removed, since blanket role-only access isn't one of the five
  permissions this feature defines. **PASS** — see `research.md` for why removing that blanket
  access is treated as in-scope rather than a separate change.
- **III. Two-Server Separation** — `routes/api.js` has no role- or permission-based checks today
  (`checkWritePermissions` is a static basic-auth credential check) and this plan does not add
  any; the permission model stays scoped to the session-authenticated web app. **PASS**.
- **IV. Composable Model Features** — N/A. No new cross-cutting schema mixin is needed; `User`
  does not use `addReview`/`addShare`-style composition for its `roles` field, and this feature
  doesn't change that. **PASS**.
- **V. Minimal, Build-Free Frontend** — The only UI change is one additional read-only line on
  `views/user.jade` (showing effective permissions) using the existing Jade templating already
  wired through `routesUtilities.getRenderObject`. No new JS library, no build tooling. **PASS**.

## Project Structure

### Documentation (this feature)

```text
specs/007-role-permission-separation/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

This is the existing single Node.js/Express repository described in `CLAUDE.md` — no new
top-level project or directory split. The only structural change is turning the single file
`lib/auth.js` into a directory module `lib/auth/index.js` (a mechanical move: every call site
uses the extension-less `require('../lib/auth')`, which Node resolves to `auth/index.js` exactly
as it resolved to `auth.js`, so no caller changes).

```text
config/
├── config.js                  # load config.permission from permission.json (NEW, required —
│                               # same pattern as email.json)
└── permission_change.json     # NEW example/default role→permission mapping

lib/
├── role.js                    # TRIMMED to the 3 assignable roles: Manager, Admin, Reviewer, Roles
├── permission.js              # NEW: the 5 permission constants, PermissionList, getPermissions(roles)
├── auth/
│   └── index.js                # was lib/auth.js; same exports (ensureAuthenticated, verifyRole,
│                               # requireRoles, checkAuth, sessionLocals, basicAuth, proxied),
│                               # plus res.locals.roles / res.locals.permissions / res.locals.userid
├── req-utils.js                 # ADD isAdmin(req), requireAdmin(), requirePermission(permission);
│                               # getAccess() drops the Manager/Admin blanket-access branches
└── review.js                    # addReviewRequest's Reviewer-role eligibility check becomes a
                                # permission check

model/
└── user.js                      # roles: [String] gets an enum restricted to the 3 assignable roles

routes/
├── user.js                      # PUT /users/:id validates/filters the roles array instead of
│                               # accepting req.body verbatim; inline admin role check replaced
├── review.js                     # Reviewer-role check -> permission check
└── traveler.js                   # inline admin/manager role checks -> permission check

utilities/
└── routes.js                     # ADD hasPermission(req, permission), alongside the existing
                                # checkUserRole(req, role); getRenderObject keeps passing roles

views/
└── user.jade                      # show effective permissions alongside the existing roles row

test/lib/
├── permission-test.js             # NEW
├── role-test.js                    # NEW
└── req-utils-test.js                # updated for the removed getAccess branches
```

**Structure Decision**: Single existing project, no new services or packages. Changes are
localized to the config, `lib/`, `model/`, `routes/`, `utilities/`, and `views/` directories
already described in `CLAUDE.md`; the REST API (`routes/api.js`) is untouched per the Two-Server
Separation principle.

## Complexity Tracking

> No Constitution Check violations — this section is intentionally empty.
