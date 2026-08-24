# Phase 1 Data Model: Traveler CSV Export

This feature is read-only: no new schema, no schema changes, no new persisted entity. It reads
two existing Mongoose models (`model/traveler.js`) and projects them into a CSV row set. This
document maps the spec's Key Entities to the concrete fields they are sourced from, for
implementers.

## Traveler (existing model, read-only)

Source: `Traveler` schema in `model/traveler.js`.

| Export concept (spec.md) | Source field | Notes |
|---|---|---|
| Id | `traveler._id` | Mongo ObjectId, stringified |
| Title | `traveler.title` | As stored, no transformation |
| Status | `traveler.status` → `statusMap[status]` | `statusMap` exported from `model/traveler.js`; numeric code MUST NOT appear in output (FR-004) |
| Link | Derived: `` `${base}/travelers/${traveler._id}/view` `` | `base` = `req.proxied ? authConfig.proxied_service : authConfig.service`, matching existing redirect logic elsewhere in `routes/traveler.js` |
| Field definitions | `traveler.labels` (`name -> label`), `traveler.types` (`name -> input type`) | Authoritative set of fields for this traveler; iteration order = insertion order = original form field order |

## Traveler Data Field (spec.md) → `TravelerData` (existing model, read-only)

Source: `TravelerData` schema in `model/traveler.js`.

| Export concept (spec.md) | Source field | Notes |
|---|---|---|
| Internal field name (reference key) | `TravelerData.name` (== the key in `traveler.labels`/`types`) | Universal — every field has one, unlike the optional `mapping` user-key (see research.md §3) |
| Label | `traveler.labels[name]` | Looked up per field, not stored per-`TravelerData` doc |
| Type | `traveler.types[name]` (fallback: `TravelerData.inputType` if present and `types[name]` is missing) | Human-facing input kind, e.g. `text`, `number`, `file` |
| Value | `TravelerData.value` | For `inputType === 'file'`, already the plain uploaded filename string (see research.md §6) — no special-casing needed |
| Input By | `TravelerData.inputBy` | Empty string if no `TravelerData` doc exists yet for this field |
| Input On | `TravelerData.inputOn` | Empty string if no `TravelerData` doc exists yet; when multiple docs exist for the same `name` (history), use the one with the latest `inputOn`, matching the existing `dataForName` latest-wins logic in `routes/traveler.js` |

### Row-building rule (join logic)

For each `name` key in `traveler.labels`:
1. Look up `label = traveler.labels[name]`, `type = traveler.types[name]`.
2. Query the traveler's `TravelerData` documents once (`TravelerData.find({ _id: { $in:
   traveler.data } }, 'name value inputOn inputBy inputType')`), then find the matching doc(s) by
   `name`, taking the one with the latest `inputOn` if more than one exists.
3. If no matching doc is found, emit the row with empty `value`, `inputBy`, `inputOn` (FR-006).
4. Emit one CSV row: `[name, label, type, value, inputBy, inputOn]`.

This is a single query against `TravelerData` (not one query per field), keeping the request
within the SC-001 performance budget.

## CSV Output Shape (not a persisted entity — the response body)

```
Traveler Link,<link>
Traveler Id,<id>
Traveler Title,<title>
Traveler Status,<status label>

Field Name,Label,Type,Value,Input By,Input On
<name>,<label>,<type>,<value>,<inputBy>,<inputOn>
...
```

- Metadata block: 4 rows, `Fact,Value` shape.
- 1 blank separator row.
- 1 header row for the data table.
- N data rows, one per field defined in `traveler.labels` (N may be 0 — header row still present,
  per the Edge Cases section of spec.md).

All values pass through the `lib/csv.js` escaping helper (research.md §1) before being written.
