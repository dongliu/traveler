# Quickstart: Validating Role and Permission Separation

## Prerequisites

- Local checkout on this branch, dependencies installed (`npm install`).
- `etc/traveler-config/permission.json` present, copied from
  `config/permission_change.json` (see `data-model.md` for the shipped default mapping). This is
  a new required config file — the app should fail to start without it, the same way it already
  does for a missing `email.json`.
- A running MongoDB instance and the rest of the usual local config (`mongo.json`, `auth.json`,
  etc.) already set up as for any local run (`node app.js` / `npx nodemon`).
- At least two test accounts: one that already holds the `admin` role, and one plain account with
  no optional roles.

## 1. Baseline permissions need nothing assigned

1. Log in as the plain account (no optional roles).
2. Confirm it can read all forms and submit data on an active traveler it doesn't own — these are
   `Read_all_forms`/`Write_active_travelers`, granted by the implicit `user` role alone.
3. Open that account's profile page (`/users/:id`) and confirm the new "Permissions" line lists
   exactly `read_all_forms, write_active_travelers` — see `contracts/role-management.md`.

**Expected**: both abilities work with zero roles assigned; nothing needed to be configured per
account.

## 2. Admin grants and revokes a role

1. Log in as the `admin` account, go to `/admin/`.
2. Add the `reviewer` role to the plain account from step 1.
3. Log back in as that account; confirm it can now approve a submitted traveler (`Approve_travelers`).
4. As the admin, remove the `reviewer` role from that account.
5. Log back in as that account; confirm it can no longer approve travelers, but still has the
   baseline abilities from step 1.

**Expected**: matches `spec.md` User Story 1's acceptance scenarios exactly.

## 3. The default role can't be added or removed

1. As the admin, attempt to submit `user` as one of the roles via the role-editing control (or,
   for a direct check, `PUT /users/:id` with `{"roles": ["user", "manager"]}`).
2. Inspect the account afterward.

**Expected**: the account ends up with `manager` only — `user` is never persisted into
`User.roles`, and the account's effective permissions still include the baseline abilities
regardless (`spec.md` FR-005, FR-009).

## 4. Config-only change to the mapping

1. Before editing anything, confirm an account holding only the `reviewer` role can already view
   the form-review queue (`/reviews/`) — `reviewer` grants `review_forms` by default (see
   `data-model.md`).
2. Edit `etc/traveler-config/permission.json`, adding `"review_forms"` to the `manager` entry too.
3. Restart the app (no code change).
4. Log in as an account holding only the `manager` role; confirm it can now also view the
   form-review queue, without any change to that account's stored roles.

**Expected**: matches `spec.md` User Story 3 — the ability shift comes entirely from the config
file.

## 5. Run the automated checks

```bash
npx eslint .
npx mocha test/lib/permission-test.js test/lib/role-test.js test/lib/req-utils-test.js
npx mocha test/lib/
```

**Expected**: all pass, including the updated `getAccess` tests in `req-utils-test.js` that no
longer expect blanket access from holding `manager`/`admin` alone.
