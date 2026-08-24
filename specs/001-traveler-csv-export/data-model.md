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
| Value | `TravelerData.value`, except for a `file`-type field where it is `` `${base}/data/${TravelerData._id}` `` | `base` = same `req.proxied ? authConfig.proxied_service : authConfig.service` used for the traveler Link; links to the existing `/data/:id` download route (see research.md §6, superseded 2026-08-23) |
| Input By | `TravelerData.inputBy` | Empty string if no `TravelerData` doc exists yet for this field |
| Input On | `TravelerData.inputOn`, rendered as a Unix timestamp (whole seconds since epoch) | Empty string if no `TravelerData` doc exists yet |

### Row-building rule (join logic)

A field can have more than one `TravelerData` doc: submitting a value never overwrites a prior
one — `POST /travelers/:id/data/` always `new TravelerData({...})` and appends its id to
`traveler.data` (`routes/traveler.js`) — so a field resubmitted over time accumulates a history.
Per the 2026-08-23 follow-up request, the export surfaces that whole history rather than only the
latest value (superseding the original "latest wins" design below).

For each `name` key in `traveler.labels` (in insertion order):
1. Look up `label = traveler.labels[name]`, `type = traveler.types[name]`.
2. Query the traveler's `TravelerData` documents once (`TravelerData.find({ _id: { $in:
   traveler.data } }, 'name value inputOn inputBy inputType')`), then collect all matching docs
   by `name`, sorted ascending by `inputOn` (oldest first).
3. If no matching docs are found, emit a single row with empty `value`, `inputBy`, `inputOn`
   (FR-006).
4. Otherwise, emit one CSV row per matching doc, each with:
   - `inputOn` converted to a Unix timestamp in seconds
     (`Math.floor(new Date(doc.inputOn).getTime() / 1000)`)
   - `value` = `doc.value`, except when `type === 'file'`, where it is
     `` `${base}/data/${doc._id}` `` instead (one distinct download link per submission)
5. Row shape: `[name, label, type, value, inputBy, inputOn]`.

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
- N data rows: one per value ever submitted for each field defined in `traveler.labels`, or one
  empty row for a field never answered (N may be 0 total — header row still present, per the
  Edge Cases section of spec.md).

All values pass through the `lib/csv.js` escaping helper (research.md §1) before being written.
