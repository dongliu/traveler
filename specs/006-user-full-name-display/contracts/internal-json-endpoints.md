# Contract: Internal DataTables JSON Sources & Other REST API List Endpoints

Covers every other JSON-producing read path that exposes a person-identifying field: the internal `/*/json` endpoints that feed `public/javascripts/table.js`'s DataTables (session-auth web app only — not part of the published REST API docs), and the other `routes/api.js` endpoints that already document these fields (`/apis/travelers/`, `/apis/travelers/:id/`; `/apis/forms/`, `/apis/binders/`, `/apis/releasedForms/` and their `:id` variants wherever they expose the same fields).

## Rule

Identical convention as `public-travelers-api.md`'s JSON section, applied uniformly regardless of whether the consumer is this app's own browser JS or an external REST client: **every existing field keeps its current value and meaning; a new `<field>Name` sibling is added.** There is no CSV variant for any of these endpoints today, so there is no substitution exception here — the public travelers CSV is the only place that rule applies.

| Field already present | New sibling field |
|---|---|
| `createdBy` | `createdByName` |
| `updatedBy` | `updatedByName` |
| `releasedBy` | `releasedByName` |
| `archivedBy` | `archivedByName` |
| `clonedBy` | `clonedByName` |
| `addedBy` (inside each `work` item of a binder) | `addedByName` (same item) |
| `inputBy` (inside each traveler-data entry) | `inputByName` (same entry) |
| `owner` | `ownerName` |
| `reviewRequests[]._id` (the reviewer's id) | `reviewRequests[].name` |
| `reviewResults[].reviewerId` | `reviewResults[].reviewerName` |
| `sharedWith[]._id` (a user a document is shared with) | `sharedWith[].name` |

Fallback is identical to data-model.md: the sibling field equals the original identifier when no `Person.name` is resolvable.

## Example — `/forms/json`

### Before (current; see `routes/form.js`'s Mongoose projection, e.g. `'title formType status tags mapping createdBy createdOn updatedBy updatedOn publicAccess sharedWith sharedGroup _v'`)

```json
[
  {
    "_id": "...",
    "title": "Vacuum pump-down checklist",
    "formType": "0",
    "status": 0,
    "tags": ["vacuum"],
    "createdBy": "liud",
    "createdOn": "2026-08-30T14:02:11.000Z",
    "updatedBy": "liud",
    "updatedOn": "2026-08-30T14:02:11.000Z",
    "sharedWith": [{ "_id": "smith", "access": "read" }],
    "sharedGroup": []
  }
]
```

### After

```json
[
  {
    "_id": "...",
    "title": "Vacuum pump-down checklist",
    "formType": "0",
    "status": 0,
    "tags": ["vacuum"],
    "createdBy": "liud",
    "createdByName": "Dong Liu",
    "createdOn": "2026-08-30T14:02:11.000Z",
    "updatedBy": "liud",
    "updatedByName": "Dong Liu",
    "updatedOn": "2026-08-30T14:02:11.000Z",
    "sharedWith": [{ "_id": "smith", "name": "John Smith", "access": "read" }],
    "sharedGroup": []
  }
]
```

Every other internal `/*/json` endpoint listed in plan.md's Technical Context (`travelers/json`, `binders/json`, `released-forms/json`, `reviews/forms/json`, their `transferred*/shared*/groupshared*/archived*` variants, etc.) follows the same additive pattern for whichever of the fields above it already returns.

## Client contract: `personColumn`

`public/javascripts/table.js`'s `personColumn(title, key)` is the single rendering point all of the above feed into. Its contract becomes: resolve `value = source[key + 'Name'] || source[key]` once, then use that same resolved value for every type DataTables asks for — `display` (as escaped text, never the `holder.js` avatar image), `sort`, and `filter` alike. This is a deliberate change from today's behavior, where sort/filter use the raw id: per FR-005, a viewer who now sees "Dong Liu" in the column expects typing "Dong" into that column's filter, or sorting it, to behave consistently with what is on screen — matching against the id after it has been replaced by a name on screen would be confusing and, for most ids, simply never match anything the viewer can see.
