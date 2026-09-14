# Phase 0 Research: Admin NCR Deletion

**Feature**: `122-admin-delete-ncrs` | **Spec**: [spec.md](./spec.md)

This research is grounded in reading the actual running code (`routes/traveler.js`,
`model/traveler.js`, `lib/req-utils.js`, `routes/ncr.js`, `lib/ncr-service.js`,
`views/ncr-dashboard.jade`, `views/binder.jade`) — the spec explicitly asks for
a feature "similar to travelers," so the existing Traveler deletion path is
the primary precedent, adapted where the NCR module's own conventions differ.

## Decision 1: Reuse the existing `admin` role, checked in the service layer, not `reqUtils.requireAdmin()` middleware

**Decision**: Add the authorization check inside a new `deleteNcr(ncrId, user)`
function in `lib/ncr-service.js` — `if (!user.roles.includes('admin')) throw 403`
— rather than adding `reqUtils.requireAdmin()` as route middleware (the way
`routes/traveler.js`'s `DELETE /travelers/:id/` does it).

**Rationale**: The role name and concept are identical to Traveler deletion
(`lib/role.js`'s `Admin = 'admin'`, checked against `res.locals.roles`), so
nothing new is introduced there. But `routes/ncr.js` has its own,
already-established convention: every mutating endpoint in this file (
`submitDisposition`, `closeNcr`, `assignDesignate`, `addApprover`, …) does its
authorization check inside `lib/ncr-service.js`, throwing an `Error` with a
`.status`, caught by the route and translated to a JSON `{success:false,
error,message}` body via `mapServiceError()`. `reqUtils.requireAdmin()`
instead short-circuits with a bare `403` plain-text response — correct for
`routes/traveler.js` (a session-rendered-view route with no JSON contract to
keep), but inconsistent with the JSON envelope every other `/api/ncrs/...`
response already uses. Keeping the check in the service layer matches the
file it's actually joining, not the file it's modeled after.

**Alternatives considered**:
- *`reqUtils.requireAdmin()` middleware, verbatim*: rejected — would be the
  only endpoint in `routes/ncr.js` returning a plain-text 403 instead of the
  established JSON error shape, breaking any client-side handling that
  expects `resp.message`/`resp.error` (as the dashboard's own delete-summary
  UI will).

## Decision 2: One `DELETE /api/ncrs/:id` endpoint, called once per selected NCR from the dashboard — no new batch endpoint

**Decision**: Add a single-resource `DELETE /api/ncrs/:id` route, mirroring
Traveler's `DELETE /travelers/:id/` shape exactly. The dashboard's "delete
selected" action issues one `DELETE` request per selected NCR and aggregates
the results into one summary shown to the admin, rather than the server
exposing a `POST /api/ncrs/bulk-delete` (or similar) endpoint that accepts an
array of ids.

**Rationale**: FR-008 ("report how many were deleted") and FR-009 ("don't
fail the whole batch because one NCR is already gone") are both admin-facing
UX requirements, not requirements on the shape of the API. A client-side loop
over independent single-resource `DELETE` calls satisfies both directly: each
call either succeeds or 404s on its own, and the client tallies success/failure
without any new server-side batch logic. The number of NCRs an admin can
select is bounded by what's visible on one dashboard page (`state.limit`,
currently 25 — `views/ncr-dashboard.jade`), so this is at most ~25 small
requests, not a performance concern. This also keeps the new route symmetric
with every other single-resource mutation already in `routes/ncr.js`.

**Alternatives considered**:
- *A single batch endpoint (`POST /api/ncrs/bulk-delete` with `{ids: [...]}`)*:
  rejected — adds a new request/response shape and a new partial-failure
  reporting format to design and test, for no behavior the client-side loop
  doesn't already provide at the scale involved.

## Decision 3: Attached files are unlinked best-effort; a missing or failing unlink never blocks record deletion

**Decision**: `deleteNcr()` attempts `fs.promises.unlink()` for every
`attachments[].file_path` on the NCR, catching and logging (not throwing) any
error from each attempt — including `ENOENT` (already missing) and any other
filesystem error — before deleting the NCR document itself.

**Rationale**: Directly satisfies FR-007/SC-002 (files removed from storage)
while matching the edge case the spec calls out explicitly: a file already
missing from storage must not block deletion of the record. Traveler
deletion (`model/traveler.js`'s `clean()`) does not unlink any files at all
today — this feature deliberately goes further than its own precedent here,
per the spec's explicit requirement ("including files attached"), while
reusing the exact same `file_path` value and `path.resolve()` handling the
existing attachment download route (`routes/ncr.js`'s
`GET /:id/attachments/:fileId`) already uses to read these files back.

**Alternatives considered**:
- *Abort the whole deletion if any attachment fails to unlink*: rejected —
  would leave the NCR record undeleted (and thus still user-visible) over a
  filesystem-level problem the admin has no way to fix from the UI, directly
  contradicting the edge case in spec.md.

## Decision 4: No deletion audit trail is written anywhere — confirmed by spec.md's resolved clarification

**Decision**: `deleteNcr()` writes nothing to any collection other than
deleting the `Ncr` document itself. No `History` record, no new
"ncr.deleted" event elsewhere, no log collection entry.

**Rationale**: spec.md's Assumptions/FR-012 explicitly resolve this: "no
separate deletion log, audit entry, or trace is kept outside the NCR's own
(now-removed) record." Since an NCR's entire audit trail already lives
embedded in its own `events[]` array (there is no separate per-NCR `History`
collection the way Form/Traveler have, per `model/history.js`'s scope),
deleting the document removes that trail along with everything else by
construction — there is nothing additional to clean up or preserve.

**Alternatives considered**: None — this was a direct clarification resolved
with the user during `/speckit-specify`, not an open design choice.

## Decision 5: Dashboard gets a plain-jQuery checkbox column and toolbar button, not a DataTables-based selection widget

**Decision**: Add a checkbox `<th>`/`<td>` column and a "Delete Selected"
toolbar button to `views/ncr-dashboard.jade`, implemented with the same
plain jQuery this file already uses for its own row rendering and pagination
(`renderRows()`) — tracking selected ids in a JS `Set` — rather than adopting
the DataTables-based `fnSelectAll`/`fnGetSelected` helpers used by
`views/binder.jade`/`views/ownership.jade` (`public/javascripts/binder-viewer.js`).

**Rationale**: The binder/ownership multi-select pattern is the closest
existing precedent for "select several rows, act on the selection" in this
codebase, but it's built entirely on DataTables' own row-state API. The NCR
dashboard table is not a DataTable — it's a plain `<table>` whose rows
`renderRows()` already builds and replaces by hand on every filter/page
change. Pulling in DataTables here just to reuse `fnSelectAll` would add a
library dependency and a second table-rendering paradigm to a page that
doesn't otherwise need one; the underlying *concept* (checkbox per row +
select-all + a toolbar action working from the current selection) is
reused, just implemented the way this specific file already does everything
else.

**Alternatives considered**:
- *Convert `#ncr-table` to a DataTable*: rejected as far larger in scope than
  this feature calls for, and not requested.

## Decision 6: Confirmation is a native `window.confirm()`, naming the count and NCR numbers

**Decision**: Before issuing any delete requests, show
`window.confirm('Permanently delete N NCR(s): <list of ncr_numbers>? This cannot be undone.')`.
Proceeding only on `true`.

**Rationale**: Matches the exact existing precedent for a destructive NCR
action in this codebase — `views/ncr-approval.jade`'s remove-approver button
already does `if (!window.confirm('Remove this approver from the NCR?'))
return;`. No new confirmation-modal component is introduced. This satisfies
spec.md's Assumptions ("a standard 'are you sure' dialog naming the selected
NCR(s); no additional re-authentication").

**Alternatives considered**:
- *A custom Bootstrap modal listing each NCR*: rejected — `window.confirm()`
  already satisfies every FR/acceptance scenario and matches the codebase's
  own established pattern for this exact kind of action.

## Decision 7: E2E verification of "file actually removed from storage" needs one new fixture-CLI command

**Decision**: Add a `file-exists` command to `e2e/fixtures/cli.js` (in the
same style as its existing `get-ncr`/`get-user` read-only commands) that
returns `{ exists: fs.existsSync(filePath) }` for a given absolute path,
run inside the `web` container exactly like every other fixture-CLI command.

**Rationale**: Playwright's `page.request` can observe the app's HTTP surface
(e.g., that `GET /:id/attachments/:fileId` now 404s because the NCR is gone)
but cannot inspect the container's filesystem directly. FR-007/SC-002 are
specifically about the *physical file* being removed, not just its metadata
reference — proving that requires a filesystem check on the same host the
app itself runs on, which is exactly what the fixture CLI (already invoked
via `docker compose exec` into the `web` container, per
`e2e/fixtures/exec-cli.js`) is for.

**Alternatives considered**:
- *Only assert on the HTTP-level 404 after deletion*: rejected — that proves
  the NCR document is gone (trivially true, since the whole document is
  deleted) but not that the attachment file itself was unlinked, which is
  the specific behavior FR-007 adds beyond Traveler's own precedent.

## Summary of resolved Technical Context

| Field | Resolution |
|---|---|
| Language/Version | JavaScript (Node.js 18+) — unchanged, extends the existing app |
| Primary Dependencies | None new — reuses Express/Mongoose, Node's built-in `fs.promises`/`path`, and the existing `lib/role.js` admin role constant |
| Storage | MongoDB via Mongoose — no schema change; this feature only deletes existing `Ncr` documents and unlinks files already referenced by `attachments[].file_path` |
| Testing | `test-unit/lib/ncr-service.test.js` (Mocha/Sinon/Chai, new `describe('lib/ncr-service — deleteNcr')` block) for unit coverage; a new Playwright spec under `e2e/`, plus one new read-only command in `e2e/fixtures/cli.js`, for end-to-end coverage |
| Target Platform | Same existing web service (Express web app on port 3001) |
| Project Type | Extension to the existing NCR workflow module — not a new deployable |
| Performance Goals | N/A — deletion is an infrequent admin action bounded by one dashboard page (~25 rows) of individual, independent requests |
| Constraints | Authorization MUST be enforced server-side in `lib/ncr-service.js` regardless of what the dashboard UI shows/hides, consistent with the app's existing security posture (matches `003-originator-designate`'s identical constraint) |
| Scale/Scope | 1 user story / 7 acceptance scenarios; touches `lib/ncr-service.js` (1 new function), `routes/ncr.js` (1 new route), `views/ncr-dashboard.jade` (selection UI), `e2e/fixtures/cli.js` (1 new command) |
