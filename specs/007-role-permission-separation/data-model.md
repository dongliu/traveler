# Phase 1 Data Model: Role and Permission Separation

## Role (constant, not database-backed)

A named label a user account can hold. Defined in `lib/role.js`.

| Role       | Assignable? | Held by                                  |
|------------|-------------|-------------------------------------------|
| `user`     | No          | Every account, implicitly, always         |
| `manager`  | Yes         | Whoever an admin assigns it to            |
| `admin`    | Yes         | Whoever an admin assigns it to            |
| `reviewer` | Yes         | Whoever an admin assigns it to            |

- `Roles` (the exported array in `lib/role.js`) lists only the three assignable roles. `user` is
  a separate, non-exported-as-assignable constant (or simply never appears in `Roles`) so that any
  code iterating `Roles` to build an admin UI or validate a write naturally excludes it.
- Only `User.roles` (see below) is mutable per-account storage, and it may only ever contain
  values from `Roles`.

## Permission (constant, not database-backed)

One of five named abilities. Defined in `lib/permission.js`.

| Permission                | Gates                                                              |
|---------------------------|---------------------------------------------------------------------|
| `Read_all_forms`          | Seeing every form, not just forms shared/owned/public to the viewer |
| `Write_active_travelers`  | Submitting data on a traveler that is in progress                   |
| `Review_forms`            | Viewing/acting on the form-review queue, being assignable as a form reviewer |
| `Approve_travelers`       | Approving or rejecting a submitted traveler                         |
| `Manage_users`            | Adding/removing the `manager`/`admin`/`reviewer` roles on any account |

`PermissionList` is the exported array of these five strings; `getPermissions(roles)` filters its
output against it, so a misconfigured mapping can never leak a 6th, made-up permission into
`res.locals.permissions`.

## Role-to-Permission Mapping (configuration, `config/permission.json`)

```json
{
  "user": ["read_all_forms", "write_active_travelers"],
  "manager": ["approve_travelers"],
  "reviewer": ["review_forms", "approve_travelers"],
  "admin": ["review_forms", "approve_travelers", "manage_users"]
}
```

- Loaded by `config/config.js` the same way `email.json` is (required, not optional like
  `mqtt.json`): `module.exports.permission = require('../' + configPath + '/permission.json');`
- Keys are role names (including `user`); values are arrays of permission strings. A role with no
  entry, or an entry listing a permission outside `PermissionList`, grants nothing beyond what's
  recognized — `getPermissions` filters, it never throws, so a bad config degrades access rather
  than crashing the app (consistent with the Edge Cases in `spec.md`).
- `config/permission_change.json` ships in the repo as the example a deployer copies into
  `etc/traveler-config/permission.json`, pre-filled with the mapping above as the shipped default.

## `getPermissions(roles: string[]) -> string[]`

Pure function in `lib/permission.js`. For a given list of role strings (the effective roles for a
session — the three assignable roles currently held, plus `user` always included by the caller),
returns the de-duplicated union of permissions those roles grant per the current config, filtered
to `PermissionList`.

## Session Authorization Context (`res.locals`, computed per request)

Set by `lib/auth/index.js` once the session's `userid` is known (mirrors `CLAUDE.md`'s already-
documented target):

- `res.locals.userid` — the authenticated user's id
- `res.locals.roles` — `['user', ...<assignable roles currently on User.roles>]` (effective roles
  for this request; never written back to the database)
- `res.locals.permissions` — `getPermissions(res.locals.roles)`

This replaces reading `req.session.roles` directly for authorization decisions. `req.session.roles`
itself keeps storing exactly what's in `User.roles` in the database (no behavior change there) —
`res.locals.roles` is the derived, request-time superset that includes the implicit default role.

## `User` (existing Mongoose model, `model/user.js`)

No new fields. One change to the existing `roles: [String]` field:

- Add `enum: Roles` (the three assignable role strings from `lib/role.js`). `user` is never a
  legal value here — it is never read from or written to this field.
- Any value already present in a document that is not in `Roles` (a leftover from the prior mixed
  design, e.g. `read_all_forms`) is left alone in the database (no migration required per
  `spec.md`'s Assumptions) but is inert: `getPermissions` only recognizes the three assignable
  role names plus `user`, so a leftover string contributes nothing, and the enum blocks it from
  being *re-written* going forward.

## Validation Rules Summary

1. `User.roles` may only contain values from `lib/role.js`'s `Roles` (schema `enum` + route-level
   allow-list on write).
2. `user` is never accepted as a value to add to or remove from `User.roles`, from any entry
   point.
3. `res.locals.roles` always includes `user` in addition to whatever is in `User.roles`.
4. `getPermissions` output is always a subset of `PermissionList` — unrecognized role names or
   permission strings in the config are dropped, not propagated.
5. Changing or removing the `manager`/`admin`/`reviewer` role on an account requires the acting
   session to have the `Manage_users` permission.
