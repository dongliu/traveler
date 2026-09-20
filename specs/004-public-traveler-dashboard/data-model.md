# Data Model: Public Traveler Listing API & Dashboard

**No persisted schema changes.** The feature is read-only. It reads the existing `Traveler`
collection (`model/traveler.js`) and introduces three transient shapes: the **Listing Query**
(input), the **Public Traveler Record** (one output row), and the **Listing Result** (the
response). The six classification properties already exist on `Traveler` from feature 003.

## Source fields read from `Traveler`

`_id`, `title`, `status`, `archived`, `createdBy`, `createdOn`, `updatedBy`, `updatedOn`,
`archivedOn`, `owner`, `tags`, `totalInput`, `finishedInput`, `subsystem`, `device`, `activity`,
`machineArea`, `sector`, `windchillId`, `publicAccess`.

Nothing else is projected, so the heavy embedded arrays (`forms`, `data`, `mapping`, and so on)
never leave the database.

## Public Traveler Record

| Output key | Source | Rule when source is missing / notes |
|---|---|---|
| `_id` | `_id` | Stable identifier. The name matches `/apis/travelers/` and what the dashboard's report and binder helpers read. |
| `title` | `title` | `''` |
| `status` | derived | Effective human-readable status name (see Effective status). |
| `statusCode` | derived | Effective numeric code: `0`, `1`, `1.5`, `2`, `3`, or `4`. JSON only. |
| `createdBy` | `createdBy` | `''` |
| `createdOn` | `createdOn` | `null` |
| `updatedBy` | `updatedBy` | `''` |
| `updatedOn` | `updatedOn` | `null`. Reported as stored; **not** back-filled from `createdOn` (used only for ordering). |
| `archivedOn` | `archivedOn` | Reported **only** when `archived === true`; otherwise `null`. |
| `owner` | `owner \|\| createdBy` | Same ownership rule as `isOwner` in `lib/req-utils.js`. `''` if both are missing. |
| `tags` | `tags` | `[]` |
| `totalInput` | `totalInput` | `0` |
| `finishedInput` | `finishedInput` | `0` |
| `subsystem` | `subsystem` | `''` (travelers created before feature 003 lack the field) |
| `device` | `device` | `''` |
| `activity` | `activity` | `''` |
| `machineArea` | `machineArea` | `''` |
| `sector` | `sector` | `''` |
| `windchillId` | `windchillId` | `''` |

Every key is always present (FR-006 / SC-002). The CSV drops `statusCode` and renders `tags` joined
by `;`; see [contracts/public-travelers-list.md](contracts/public-travelers-list.md).

### Effective status

Computed from the stored `archived` flag and `status`:

| Condition | Effective code | Effective name |
|---|---|---|
| `archived === true` **or** `status === 4` | `4` | `archived` |
| otherwise `status` | `0` / `1` / `1.5` / `2` / `3` | `initialized` / `active` / `submitted for completion` / `completed` / `frozen` |
| `status` missing or not in the map | none | `unknown` (not counted in `statusCounts`) |

Names come from `statusMap` exported by `model/traveler.js`. This is the same rule the existing
`/archivedtravelers/json` route uses to find archived travelers.

## Public access (the visibility rule)

A traveler is public when `publicAccess ∈ {0, 1}` (public read or public write); `-1` means no
public access. This is the same predicate today's page uses. It is part of every pipeline's first
`$match` and is not caller-configurable, so no request can widen it (FR-001, SC-005).

## Listing Query

| Parameter | Type / accepted values | Default | Validation and rules |
|---|---|---|---|
| `format` | `json` \| `csv` (case-insensitive) | `json` | Anything else → 400. |
| `page` | integer ≥ 1 | `1` | Non-numeric, zero, negative, or > 100000 → 400. |
| `limit` | integer ≥ 1 | `25` | Non-numeric, zero, negative → 400. Above `500` → reduced to `500`; the response reports the applied value. |
| `updatedFrom` | `YYYY-MM-DD` or ISO 8601 timestamp | none | Date-only = start of that local day. Unparseable → 400. |
| `updatedTo` | `YYYY-MM-DD` or ISO 8601 timestamp | none | Date-only = end of that local day. Unparseable → 400. `updatedFrom` after `updatedTo` → 400. |
| `subsystem`, `device`, `activity`, `machineArea`, `sector`, `windchillId` | string | none | Case-insensitive **partial** match. Max 200 characters (longer → 400). Blank ignored. Treated literally. |
| `status` | status name or numeric code; comma-separated or repeated | none | Names case-insensitive. An unknown value → 400 listing the accepted values. A record matches if its effective status is any of the given. |
| `tags` | tag label; comma-separated or repeated | none | Whole-label, case-insensitive; **all** given tags must be present. Blank ignored. |
| `includeArchived` | `true` / `false` / `1` / `0` | `false` | Anything else → 400. |

Cross-cutting rules:

- All parameters must arrive as strings (or arrays of strings for `status` and `tags`); a parsed
  object such as `subsystem[$ne]=x` is a 400. This is the defence against operator injection.
- **Effective include-archived** = `includeArchived` **or** the `status` list contains `archived`.
  This single value drives both pipelines, so the counts and the items always agree.
- Filters combine with AND. Unknown query parameters are ignored.
- For CSV, "paged" means `page` **or** `limit` was supplied; otherwise the whole matching set is
  returned.

## Listing Result

| Field | Meaning |
|---|---|
| `travelers` | Array of Public Traveler Records for the requested page. |
| `page` | The page returned. |
| `limit` | The page size **applied** (after clamping). |
| `total` | Number of travelers matching **all** filters including `status`. Equals the sum of `statusCounts` for the requested statuses (all of them when none requested). |
| `statusCounts` | Object keyed by status name: count of travelers matching every filter **except `status`**. Names with no travelers are present with `0`. The `archived` key is present only when effective include-archived is true. |

`totalPages` is intentionally not sent; clients compute `ceil(total / limit)`. CSV output has no
envelope: it is the header row plus the record rows (un-paged CSV skips the skip/limit stages and
returns every matching record).

## Query construction (shape only)

Let `F` be the raw-field filters (public access, archived rule, six text filters, tags, and the
date range), and `S` the status match. All values are built typed by the lib.

- **Archived rule** (effective include-archived false): `{archived: {$ne: true}, status: {$ne: 4}}`.
  When true, no archived restriction is added.
- **Status match `S`** for a set of codes: non-archived codes match
  `{archived: {$ne: true}, status: {$in: [...non-4 codes]}}`; code `4` matches
  `{$or: [{archived: true}, {status: 4}]}`; multiple parts are OR-ed.
- **Date range**: `{$or: [{updatedOn: {$gte: from, $lte: to}}, {updatedOn: null, createdOn: {$gte: from, $lte: to}}]}`,
  with either bound omitted when not supplied.

Pipelines:

1. **Items**: `$match(F ∧ S)` → `$project(record fields, _sortKey = ifNull(updatedOn, createdOn))` →
   `$sort({_sortKey: -1, _id: -1})` → `$skip` → `$limit`. `allowDiskUse: true`.
2. **Counts**: `$match(F)` → `$group({_id: effectiveStatusExpr, n: {$sum: 1}})`, where
   `effectiveStatusExpr = $cond([archived == true OR status == 4], 4, $status)`.

The items and counts pipelines run in parallel and are not transactional; a write landing between
them can make `total` differ by one from the items shown, which is acceptable for a listing.

## State transitions

None. The feature never writes, so Constitution I (state machine) is unaffected.
