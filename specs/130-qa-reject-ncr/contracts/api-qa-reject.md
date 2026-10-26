# API Contract Changes: QA Reject with Comments

This feature changes the behavior of one existing endpoint and adds one new endpoint. Both are session-authenticated web API routes under `/api/ncrs` (`routes/ncr.js`); the Basic-Auth REST API on port 3002 shares the same `lib/ncr-service.js` functions and is affected identically.

## `PATCH /api/ncrs/:id/concurrence` — behavior change (additive)

**Existing shape, unchanged**:

```json
// request (today's two decisions — unchanged)
{ "additional_approvers": [{ "approver_id": "..." }, ...] }   // or [] for "no approvers"

// response 200
{ "success": true, "ncr": { "ncr_id": "...", "ncr_number": "...", "status": "...", "additional_approvers": [...] } }
```

**New, additive shape** — a third decision, selected by including `action: "reject"`:

```json
// request
{ "action": "reject", "comments": "string (required, non-blank)" }

// response 200
{ "success": true, "ncr": { "ncr_id": "...", "ncr_number": "...", "status": "Rejected", "qa_rejection_comments": "..." } }
```

| Scenario | Result |
|---|---|
| `action: "reject"`, `comments` non-blank, `ncr.status === 'Dispositioned'` | `200`; `ncr.status` → `"Rejected"`; `qa.rejected` event recorded; `notification.qa_rejection` sent to QA staff, Originator, and Designate (if any) |
| `action: "reject"`, `comments` blank/missing | `400 Validation Error`, `details: { comments: ["Required when action is reject"] }` — same error shape `PATCH /:id/approve` already uses for `return_for_comment` with no comment |
| `action: "reject"`, caller is not QA staff | `403 Forbidden` — same check `submitConcurrence` already performs |
| `action: "reject"`, `ncr.status !== 'Dispositioned'` | `409 Conflict` — same status-guard shape every other decision-point endpoint already uses |
| No `action` field (or `action` absent/falsy) | **Unchanged**: today's implicit dispatch on `additional_approvers` presence/length, exactly as before this feature |

**Non-breaking**: every existing caller that never sends `action` is completely unaffected — this is a pure addition to the request shape, not a replacement of it.

## `PATCH /api/ncrs/:id/resubmit` — **new** (reusing a previously-removed path for an unrelated purpose)

This path existed before spec 129 (where QA could resubmit the same, still-open approval round after an approver's return-for-comment) and has returned `404` since spec 129 removed it. This feature reintroduces the path for a **different** action — the Originator/Designate updating and resubmitting a `Rejected` NCR — with a different caller, a different request shape, and a different source status. There is no overlap or ambiguity for any client: the old shape (no body) and the new shape (the full editable-field body below) are distinguishable, and nothing has been calling the old, 404-returning path since spec 129 shipped.

```json
// request
{
  "part_name": "string (required)",
  "part_number": "string (required)",
  "part_revision": "string (required)",
  "quantity": "number >= 1 (required)",
  "supplier_name": "string (required)",
  "wbs_number": "string (required)",
  "specification_drawing_reference": "string (optional)",
  "po_reference": "string (optional)",
  "description_of_nonconformance": "string (required)",
  "discovery_date": "date, not in the future (required)",
  "discovery_context": "'incoming_inspection' | 'in_house_assembly' | 'in_house_inspection' (required)"
}
// — identical field set and validation rules to POST /api/ncrs (research.md D6);
//   ce_cs_*, originator_*, and originator_designate_* are not accepted here.

// response 200
{
  "success": true,
  "ncr": { "ncr_id": "...", "ncr_number": "...", "status": "Submitted", "previous_status": "Rejected" },
  "message": "NCR resubmitted successfully. CE/CS notified for engineering disposition."
}
```

| Scenario | Result |
|---|---|
| Valid body, caller is the Originator or the assigned Designate, `ncr.status === 'Rejected'` | `200`; fields overwritten on the NCR; `ncr.status` → `"Submitted"`; `ncr.resubmitted` event recorded; `notification.disposition_request` sent to the assigned CE/CS (same email `createNcr` already sends) |
| Missing/invalid required field | `400 Validation Error`, same per-field `details` shape `POST /api/ncrs` already uses |
| Caller is neither the Originator nor the Designate | `403 Forbidden` |
| `ncr.status !== 'Rejected'` | `409 Conflict` |

## Unchanged

- `PATCH /api/ncrs/:id/disposition`, `/approve`, `/close`, `/designate`, `POST`/`DELETE /api/ncrs/:id/approvers`, the preventive-action endpoints: no change.
- `GET /api/ncrs/:id`, `GET /api/ncrs`, `GET /api/ncrs/status-counts`: shape unchanged; `status` can now also be `"Rejected"` and `status-counts` can now report that key, both automatically (driven by `NCR_STATUSES`, see data-model.md) — no separate code change to either endpoint.
- `GET /api/ncrs/:id/events`: shape unchanged; the new `qa.rejected`/`ncr.resubmitted` event types are additive and read the same way every other event type already is.
