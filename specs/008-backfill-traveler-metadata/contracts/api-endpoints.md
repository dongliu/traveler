# API Contracts: Backfill Traveler Classification Metadata

One existing endpoint gains a side effect. Its request/response shape is unchanged.

---

## Update Released Form Classification (Modified — side effect added)

**`PUT /released-forms/:id/metadata`** *(existing endpoint from spec 003, behavior extended)*

Web-app server, session-authenticated. Owner or admin only (`reqUtils.isOwnerOrAdminMw('id')`) — unchanged.

### Request Body (unchanged)

```json
{
  "subsystem": "Cryogenics",
  "device": "Magnet Assembly",
  "activity": "Inspection"
}
```

All fields optional; only fields present in the body are updated on the released form, exactly as today.

### Response (unchanged shape)

- `200 OK` — `{ "subsystem": "...", "device": "...", "activity": "..." }` (echoes the released form's saved values, same as today)
- `403 Forbidden` — caller is not owner or admin
- `404 Not Found` — released form not found
- `500 Internal Server Error` — save failure (now also covers a failure while backfilling travelers — see below)

### New Side Effect (not reflected in the response body)

After the released form itself is saved, the server finds every `Traveler` with `referenceReleasedForm` equal to this released form's `_id` **and** `referenceReleasedFormVer` equal to this released form's `ver`. For each one, any of `subsystem`/`device`/`activity` that is currently blank on the traveler is set to the released form's corresponding value (if that value is itself non-blank). Travelers with no blank-and-fillable field are left untouched and not saved. This happens before the `200 OK` is returned, so a successful response means the backfill has already completed.

The response body is **not** changed to report which or how many travelers were updated — callers (the released-form detail page) only need their own confirmation that the released form saved; the updated travelers surface the new values the next time each one is viewed, exactly as with any other traveler field.

### Error Handling

If saving the released form itself fails, behavior is unchanged (no backfill is attempted). If the released form save succeeds but backfilling travelers throws (e.g., a database error while finding or saving a traveler), the handler responds `500 Internal Server Error` — the released form's own change has already been persisted at that point; the operation is safe to retry (fields are only ever moved from blank to the (possibly already-reapplied) released form value, never away from a non-blank value), consistent with the idempotency called out in the spec's Edge Cases.
