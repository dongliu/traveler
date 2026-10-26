# API Contract Changes: NCR Approval Rounds

This feature changes the behavior of three existing endpoints and removes one. No new endpoint is added. All are session-authenticated web API routes under `/api/ncrs` (`routes/ncr.js`); the Basic-Auth REST API on port 3002 shares the same `lib/ncr-service.js` functions and is affected identically wherever noted.

## `PATCH /api/ncrs/:id/approve` — behavior change

Request/response shape is **unchanged**:

```json
// request
{ "action": "approve" | "return_for_comment", "comments": "string (required iff return_for_comment)" }
// response 200
{ "success": true, "ncr": { "ncr_id": "...", "ncr_number": "...", "status": "...", "additional_approvers": [...] } }
```

**What changes**:

| Scenario | Before | After |
|---|---|---|
| `action: "return_for_comment"`, submitted by any designated approver | `ncr.status` → `"Returned for Comment"` | `ncr.status` → `"Dispositioned"` |
| `action: "approve"` or `"return_for_comment"` submitted by an approver whose entry is already `"Approved"` | Only `"approve"` was rejected (409); a second `"return_for_comment"` silently overwrote the entry | Either action is rejected (409) once the approver has any non-`"Pending"` decision recorded for the current round |
| A second approver's decision arrives after another approver already returned the NCR for comment (round already closed, NCR already back in `Dispositioned`) | Could still be recorded against `additional_approvers` (NCR already not `"Approval Requested"`, so this already 409'd — unchanged) | Same 409 (`NCR must be in 'Approval Requested' status`) — pre-existing check, confirmed still correct under the new design |

New 409 response body for the finality case (reuses the existing error shape):

```json
{ "success": false, "error": "Conflict", "message": "You have already submitted a decision for this NCR" }
```

## `PATCH /api/ncrs/:id/concurrence` — behavior change (no shape change)

Already allowed only when `ncr.status === 'Dispositioned'` (unchanged guard). What's new: this same call, made a second (or later) time on the same NCR after a round was stopped, is how QA starts a new round — no different from the first time. The response's `additional_approvers` reflects only the new round's designated approvers (old round's approvers/decisions are not included — see data-model.md). `ncr.status` response value transitions exactly as before (`Final Approval` for an empty list, `Approval Requested` for a non-empty one).

## `POST /api/ncrs/:id/approvers`, `DELETE /api/ncrs/:id/approvers/:approverId` — guard narrows

Both currently allowed while `ncr.status` is `'Approval Requested'` **or** `'Returned for Comment'`. After this change, `'Returned for Comment'` is never a reachable `ncr.status`, so the effective allowed window is just `'Approval Requested'`. No request/response shape change. The 409 error message's current wording ("...before issuance. Current status: ...") is unchanged; it will just never report `Returned for Comment` as the current status again.

## `PATCH /api/ncrs/:id/resubmit` — **removed**

This endpoint is deleted. Any request to it returns `404` (no matching route), the same treatment given to other removed endpoints in this codebase (see `specs/007-wbs-yaml-config`). There is no replacement endpoint: starting a new round after a stop is `PATCH /api/ncrs/:id/concurrence` (already documented above), the same call QA used to start the first round.

**Breaking change** — any external integration or script that calls `PATCH /api/ncrs/:id/resubmit` must switch to `PATCH /api/ncrs/:id/concurrence`. To be called out in `CLAUDE.md`'s "Recent Changes" on implementation.

## Unchanged

- `PATCH /api/ncrs/:id/disposition`, `/close`, `/designate`, and the preventive-action endpoints: no change.
- `GET /api/ncrs/:id`, `GET /api/ncrs`, `GET /api/ncrs/status-counts`: shape unchanged; `status` simply never returns `"Returned for Comment"` again, and `status-counts` never reports that key again (both are driven by `NCR_STATUSES`, see data-model.md).
- `GET /api/ncrs/:id/events`: shape unchanged; approval-round-related events gain a `round` field (new, additive — existing consumers reading other fields are unaffected).
