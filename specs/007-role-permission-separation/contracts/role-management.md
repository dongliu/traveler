# Contract: User Role Management (session-authenticated web app)

This is an existing endpoint on the web app server (not the REST API — see Two-Server Separation
in `plan.md`), already used by `views/admin.jade` + `public/javascripts/users.js` to let an admin
add or remove `manager`/`admin`/`reviewer` on a user. This document describes its behavior after
this feature, where it changes from today.

## `PUT /users/:id`

Session-authenticated (`auth.ensureAuthenticated`).

**Authorization**: Caller must hold the `Manage_users` permission (today: an inline check for the
literal `admin` role on `req.session.roles`; after this feature: `reqUtils.requirePermission(Manage_users)`).
Unauthorized callers get `403`, as today.

**Request body** (JSON): any subset of the user's editable profile fields, exactly as today
(`name`, `email`, `office`, `phone`, `mobile` via the AD-refresh flow), plus optionally `roles`.

**Behavior change — `roles` field**:
- *Today*: `req.body` is passed straight to `User.findOneAndUpdate`, so whatever array is in
  `roles` is persisted verbatim.
- *After this feature*: if `roles` is present in the body, the server only persists the subset
  that is one of `manager`/`admin`/`reviewer` (`lib/role.js`'s `Roles`). Any other value present
  in the submitted array (including `user`, or a legacy string like `read_all_forms`) is dropped
  before the write — never rejected with an error, simply not stored, matching `spec.md`'s edge
  case guidance that unrecognized entries are inert rather than fatal.
- Fields other than `roles` are unaffected.

**Response**: `204 No Content` on success, unchanged from today. `403` if the caller lacks
`Manage_users`. `415` if the body isn't JSON (unchanged).

## `GET /users/:id` (rendered page) and `GET /users/:id/json`

No authorization change. One rendering change: the rendered `user` page (`views/user.jade`) gains
a read-only "Permissions" line, computed as `getPermissions(['user', ...user.roles])`, next to the
existing "Roles" line — this is how `spec.md` FR-011's "view which permissions are in effect for a
user" is satisfied; it does not require a new admin screen, since the role→permission mapping
itself is a config file, not code, and is viewable directly (`spec.md` SC-004).

## Unchanged

- `POST /users/` (create user) — the initial `roles` array is still built from the
  `manager`/`reviewer`/`admin` checkboxes in the "Add user" form (`storeUser` in `routes/user.js`);
  no change needed, since that form never offered a `user` checkbox and only ever sends the three
  assignable role names.
- `routes/api.js` — no role- or permission-based checks exist there today and none are added.
