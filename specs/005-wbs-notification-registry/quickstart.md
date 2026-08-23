# Quickstart: WBS Notification Registry

## Prerequisites

- Docker stack running (`docker compose up`)
- Logged in as a user with the Admin role

## Scenario 1 — View the registry (US1)

1. Navigate to `/admin/` and click the "WBS Notifications" tab.
2. **Verify**: If entries exist, each row shows a WBS number and its
   notification email address.
3. **Verify**: If no entries exist, an empty-state message is shown — no
   error.

## Scenario 2 — Add a new entry (US2)

1. On the "WBS Notifications" tab, enter a WBS number (e.g. `1.2.3`) and an
   email address (e.g. `qa-lead@example.com`) in the add form.
2. Click "Add".
3. **Verify**: The new row appears in the table immediately.
4. Attempt to add the same WBS number (`1.2.3`) again with any email.
5. **Verify**: The submission is rejected with a clear "already exists"
   error; the table still shows only one `1.2.3` row.
6. Attempt to add a malformed WBS number, e.g. `1..3` or `.1.2` or `1.2.`.
7. **Verify**: The submission is rejected with a clear format error.
8. Attempt to add a WBS number with an invalid email, e.g. `not-an-email`.
9. **Verify**: The submission is rejected with a clear validation error.

## Scenario 3 — Update an entry's email (US3)

1. On an existing row, click "Edit" (or equivalent) and change the email
   address to a new valid address.
2. Save.
3. **Verify**: The row now shows the new email; the WBS number itself is
   unchanged.
4. Repeat, but submit an invalid email on save.
5. **Verify**: The submission is rejected; the row still shows the
   previously saved (valid) email — unchanged.

## Scenario 4 — Remove an entry (US4)

1. On an existing row, click "Remove" (or equivalent) and confirm.
2. **Verify**: The row disappears from the table.
3. Using the browser console or an API client, attempt to
   `DELETE /api/wbs-notifications/<a WBS number that does not exist>`.
4. **Verify**: The response is 404, not a silent success.

## Scenario 5 — Non-admin access is blocked

1. Log in as a user without the Admin role.
2. Navigate to `/admin/`.
3. **Verify**: The page itself is blocked (existing `/admin/` gate).
4. Using the browser console while authenticated as this non-admin user,
   call `fetch('/api/wbs-notifications')`.
5. **Verify**: The response is 403.

## Running the automated suite

```bash
# Unit tests (service-layer validation, uniqueness, CRUD, audit fields)
TRAVELER_CONFIG_REL_PATH=docker npx mocha test-unit/lib/wbs-notification-service.test.js

# e2e (admin UI flow + non-admin 403s)
cd e2e
npx playwright test us-wbs-notification-registry.spec.js
```
