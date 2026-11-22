# Contract: Admin Traveler Unarchive

## New endpoint

### `PUT /travelers/:id/unarchive`

Web application only (session-authenticated, port 3001). No REST API (port 3002) equivalent — see research.md D6.

**Authentication**: existing session (`auth.ensureAuthenticated`).

**Authorization**: caller must hold the `admin` role (`reqUtils.requireAdmin()`). Otherwise `403`.

**Preconditions** (checked in this order):

1. Traveler `:id` must exist (`reqUtils.exist('id', Traveler)`) — otherwise `404`, existing codebase convention.
2. Caller must be admin — otherwise `403`, body: `you are not authorized to access this resource` (existing `requireAdmin()` message, unchanged).
3. Traveler's current `status` must be `4` (Archived) — otherwise `409`, body: a short message indicating the traveler is not archived. (Choosing `409` over `400` because the request itself is well-formed — it conflicts with the resource's current state, not with anything malformed about the request.)

**Request body**: none. The destination status is entirely server-determined (research.md D3) — the endpoint does not accept or require any JSON body.

**Behavior on success**:

- Destination status = `doc.statusBeforeArchive` if present, else `1` (Active) (research.md D5).
- `doc.status` set to that destination.
- `doc.statusBeforeArchive` cleared (set to `undefined`).
- `doc.updatedBy` = `req.session.userid`, `doc.updatedOn` = now (matching every other status-mutating call site's existing convention).
- `mqttUtilities.postTravelerStatusChangedMessage(doc)` fired (matching `updateStatus`'s existing convention — downstream MQTT consumers see this exactly like any other status change).
- Saved via `doc.save()` (no history recording — see research.md D4 for why this feature records only the single `statusBeforeArchive` value and not a general change log).
- `updateBinderProgress` fires via the model's existing `post('save')` hook, unchanged.

**Response**:

- `200`, body: `status updated to <destination>` (matches `updateStatus`'s existing response text convention, so any client/log parsing already built around that phrase keeps working).

**Response codes summary**:

| Code | When |
|---|---|
| 200 | Restored successfully |
| 403 | Caller is not an admin |
| 404 | Traveler does not exist |
| 409 | Traveler's current status is not `4` |

## Additive changes to existing endpoints/functions (no shape change)

### `PUT /travelers/:id/status` (web, `lib/traveler.js#updateStatus`)

No change to request body, response body, status codes, or any existing status/permission check, and no change to how the document is saved. Purely additive, only on the `doc.status === 4` branch (i.e. archiving in):

- Also sets `doc.statusBeforeArchive = oldStatus` (the status the traveler held just before this save), alongside the existing `doc.archivedBy`/`doc.archivedOn` assignments already made on this same branch.

### `PUT /apis/travelers/:id/status/` (REST API, `routes/api.js`)

No change to request body, response body, status codes, `checkWritePermissions`/`reqUtils.archived` guards, or how the document is saved. Purely additive, only on the `req.body.status === 4` branch:

- Also sets `doc.statusBeforeArchive = oldStatus`.

## Not part of this contract

- No new field is added to any API response — `statusBeforeArchive` is never serialized back to a client by this feature (`GET /travelers/:id/json`'s existing `_.pick(...)` field allow-list is unchanged; it would need its own explicit addition to expose it, which no requirement asks for).
- `lib/review.js` is untouched — `allApproveFlow` and `rejectionFlow` never set a traveler's status to `4`, so they have nothing to do with capturing `statusBeforeArchive`, and no general audit trail is being added for them (or anything else) to participate in (research.md D4).
- No endpoint to list or browse any status-change history is added — none is recorded beyond the single `statusBeforeArchive` value (research.md D4).
