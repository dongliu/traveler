# Roles and permissions

Traveler keeps two things separate: **roles**, which are labels attached to a user account, and
**permissions**, which are the specific abilities those labels unlock. A role grants nothing by
itself — what it actually lets you do comes entirely from a mapping that lives in a config file,
not in code, so it can differ between deployments.

This document has three audiences: everyday users, admins who manage other people's roles, and
whoever configures or deploys the application. Each section below is written for one of them.

---

## Overview

**Roles** — stored on the `User` document (`lib/role.js`):

- `user` — implicit. Every logged-in account holds it automatically. It is never stored on the
  account, never shown as a checkbox, and can't be added or removed.
- `manager`, `reviewer`, `admin` — optional. An admin adds or removes these per account.

**Permissions** — the five fixed abilities the system checks (`lib/permission.js`):

- `Read_all_forms`
- `Write_active_travelers`
- `Review_forms`
- `Approve_travelers`
- `Manage_users`

**The mapping** from role to permissions is a JSON config file (`permission.json`) that your
site's deployer controls — see the "configure" section below for how it works. Because it's just
config, the same role can grant different abilities at different deployments, so this document
doesn't assume any particular mapping is in effect at your site.

---

## For users: what your roles and permissions mean

### Checking your own access

Your profile page (`/profile`) shows both a **Roles** row (what's stored on your account) and a
**Permissions** row (what those roles currently resolve to, under your site's config). That row
is the ground truth for what you can actually do — this document explains what each permission
means, not which roles grant it at your site.

### What each permission means for you

Whatever subset of the five permissions your Permissions row lists, here's what each one unlocks:

| Permission | What it unlocks |
|---|---|
| `Read_all_forms` | Read any form in the system, not only ones you own or that were shared with you. |
| `Write_active_travelers` | Write to any traveler, not only ones you own or that were shared with you. |
| `Review_forms` | Being added as a form reviewer, and seeing the review queue. |
| `Approve_travelers` | Approving a traveler submitted for review, sending it back for more work, or archiving a completed one. |
| `Manage_users` | Adding or removing other users' roles. |

Holding more than one role that grants the same permission doesn't stack — you simply have the
ability, from whichever role currently grants it.

### Where this shows up in the UI

- The **Reviews** nav link only appears if you hold `Review_forms`.
- The **Admin** nav link, and the `/admin/` page itself, only appear if you hold the `admin` role
  specifically — this one check is hard-coded to the role, not routed through the permission
  mapping, so it can't be delegated by changing `permission.json` alone.
- On a traveler that's been submitted for review or approved, the **Approve completion** /
  **More work** / **Archive** buttons only appear if you hold `Approve_travelers`.
- The **Obsolete** action on a released form is restricted to the `admin` role specifically, not
  to the permission system — holding `Manage_users` or any other permission doesn't unlock it.

### Being asked to review a form

If someone tries to add you as a form reviewer, the system checks that your account currently
resolves to `Review_forms`. If you don't (for example, your `reviewer` role was removed, or your
site's admin remapped `Review_forms` away from your roles), the request fails with a message
asking the requester to grant you the needed role first.

---

## For admins: managing roles

### Where

The **Admin** page (`/admin/` — visible in the nav bar once you hold the `admin` role), **Users**
tab.

### Adding a new account

Type the person's name, check whichever of **manager** / **reviewer** / **admin** you want them
to start with (there's no checkbox for `user` — it's automatic), and click **Add**. Accounts are
also auto-created with no roles the first time someone logs in, or when they're first added as a
form reviewer.

### Changing an existing account's roles

Select one or more rows in the user table, click **Modify role**, check exactly the roles those
accounts should end up holding, then **Confirm**.

> **This replaces the role list, it doesn't toggle individual roles.** Whatever you check in the
> modal becomes each selected account's complete role list — and if you select several accounts
> at once, confirming applies that exact same final set to every one of them. If different
> accounts need to end up with different roles, modify them in separate passes rather than
> selecting them together.

Anything you could check that isn't `manager`/`reviewer`/`admin` is simply dropped when saved,
never rejected with an error. `user` never appears and can't be removed.

### Checking what someone's roles currently grant

Open their user page (`/users/<id>`) — it shows **Roles** (what's stored) next to **Permissions**
(what those roles resolve to right now, under your site's current mapping).

### A gap worth knowing about

`Manage_users` is what gates the user-management endpoints underneath the Admin page. If your
site's config grants `Manage_users` to a role other than `admin`, holders of that role could call
those endpoints directly, but they still won't see the **Admin** nav link or be able to open
`/admin/` itself — that page checks the literal `admin` role, not the permission. The same is true
of the **Obsolete** action on released forms. In practice, today, administering users/groups and
obsoleting forms both require the `admin` role itself, regardless of how `permission.json` is set up.

---

## For whoever configures or deploys the app

### What's fixed vs. what's configurable

The five permissions (`lib/permission.js`) and the three assignable roles plus the implicit
`user` (`lib/role.js`) are fixed in code — you can't add a sixth permission or a fourth assignable
role without a code change. What *is* configurable, per deployment, is **which permissions each
role grants**.

### The mapping file

That mapping lives in `permission.json`, alongside the other per-deployment config files
described in this project's `CLAUDE.md`, in your external config directory (`../etc/traveler-config/`
by default, or the path in `TRAVELER_CONFIG_REL_PATH`). It's loaded once into `config.permission`
by `config/config.js`.

Shape: a plain JSON object mapping each role name to an array of permission strings — for
example, `{"admin": ["manage_users"]}` grants the `admin` role the `Manage_users` permission. The
repository ships an example mapping (`config/permission_change.json`, alongside the other config
file examples) to copy into your config directory as `permission.json` and adjust to your site's
needs.

Rules:

- A role with no entry in the file grants nothing.
- Unknown permission strings (typos, leftovers from an old mapping) are silently ignored, not
  rejected — `getPermissions()` filters the result down to the fixed five.
- `user` is applied to every session automatically; giving it an entry in this file (as the
  default does) is what decides what *every* logged-in account can do, not just the ones with an
  optional role.
- The file is read once, at process startup (`config.load()` in `app.js`). Editing it requires
  restarting the app — there's no hot reload.

### `auth.json`'s `default_roles`

The optional `default_roles` field in `auth.json` lists roles (drawn from `manager` / `reviewer` /
`admin` — not permission strings) that a brand-new account is given the first time it logs in, in
addition to the always-present `user`. Most deployments leave this empty so new accounts start
unprivileged.

### Two checks this mapping can't reach

Regardless of how `permission.json` is set up, two actions always require the literal `admin`
role on the account:

- the `/admin/` page (`routes/admin.js`)
- the **Obsolete** status change on a released form (`routes/form-management.js`)

If you want some other role to perform either of these, the only way today is to also grant that
role the `admin` role name itself — remapping `Manage_users` to it is not sufficient.

### Where each permission is enforced, for reference

| Permission | Enforced in |
|---|---|
| `Read_all_forms` | `routes/form.js` (`/allforms/json`); `lib/req-utils.js`'s `getAccess()` (read access to any form) |
| `Write_active_travelers` | `lib/req-utils.js`'s `getAccess()` (write access to any traveler) |
| `Review_forms` | `routes/review.js` (the `/reviews/` pages); `lib/review.js` (gate on adding someone as a reviewer) |
| `Approve_travelers` | `routes/traveler.js` (the approve / request-more-work / archive status transitions) |
| `Manage_users` | `routes/user.js` (all `/users/*` admin endpoints) |
