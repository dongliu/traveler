# Quickstart: Admin NCR Deletion

**Feature**: `122-admin-delete-ncrs` | **Spec**: [spec.md](./spec.md)

## What this feature adds

An admin viewing the NCR dashboard can select one or more NCRs and
permanently delete them, including any attached files. No other user role
sees the controls for this, and the server rejects a deletion attempt from
anyone whose session roles don't include `admin`, independent of the UI. See
[contracts/ncr-delete.json](./contracts/ncr-delete.json) for the endpoint
this drives, and [data-model.md](./data-model.md) for exactly what gets
removed.

## Manual verification (once implemented)

1. As an admin, open the NCR dashboard (`/ncrs`). A checkbox column and a
   "Delete Selected" toolbar button are visible.
2. As a non-admin user, open the same dashboard. Confirm neither the
   checkbox column nor the "Delete Selected" button is present anywhere on
   the page.
3. As the admin, create an NCR and attach a file to it (or use an existing
   NCR that already has an attachment).
4. On the dashboard, select that NCR's checkbox (and, to also cover the
   multi-select path, one or two other NCRs) and click "Delete Selected".
   Confirm a `window.confirm()` dialog appears naming the NCR number(s)
   about to be deleted.
5. Confirm the dialog. Confirm a summary appears reporting how many NCRs
   were deleted, and that the table reloads without the deleted NCR(s).
6. Attempt to open the deleted NCR directly by its old URL
   (`/ncrs/<id>`). Confirm it 404s.
7. Attempt to download the attachment that used to belong to the deleted
   NCR via its old attachment URL. Confirm it 404s (the NCR itself is gone).
8. As the admin, select an NCR in "Closed" status and delete it. Confirm
   this succeeds the same as any other status (no lifecycle-stage
   restriction).
9. As a non-admin user, attempt `DELETE /api/ncrs/<id>` directly (e.g. via
   the browser console or curl, with valid session cookies) against an NCR
   that still exists. Confirm a `403` with `{"success":false,...}` and that
   the NCR still exists afterward.
10. As the admin, select two NCRs, then (in a second browser session) delete
    one of them as the admin from that session first. Back in the first
    session, confirm the delete-selected action for both still completes —
    the still-existing NCR is deleted and the summary reflects that one of
    the two could not be found, rather than the whole action failing.

## Automated verification (once implemented)

- Unit: `npx mocha test-unit/lib/ncr-service.test.js` — new
  `describe('lib/ncr-service — deleteNcr')` block covering: 403 for a
  non-admin `user`, 404 for a missing NCR, successful deletion (document
  removed, every attachment's `file_path` passed to `fs.promises.unlink`),
  and a failing/missing unlink not throwing or blocking document deletion.
- E2E: a new Playwright spec `e2e/us-admin-ncr-deletion.spec.js` — admin
  deletes a single NCR and a multi-NCR selection; dashboard hides the
  controls for a non-admin; a direct `DELETE` by a non-admin is rejected;
  an attached file is confirmed removed from disk via the new `file-exists`
  fixture-CLI command (see [research.md](./research.md) Decision 7); a
  "Closed" NCR can be deleted; a double-delete of the same id 404s on the
  second attempt without affecting a sibling deletion in the same batch.
