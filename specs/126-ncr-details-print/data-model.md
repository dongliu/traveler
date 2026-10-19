# Data Model: Extend Traveler Print Output with NCR Details

**Feature**: [spec.md](spec.md) | **Research**: [research.md](research.md)

No schema change. This feature reads existing data (`Ncr`, `Traveler.__review`,
`User`) and reshapes it in memory for two new read-only endpoints the print
page's own script calls; nothing new is persisted.

## New endpoints

| Endpoint | Returns | Built from |
|---|---|---|
| `GET /travelers/:id/ncr-print-details/` | `Array<{ ncrTitle: String, sections: Array<Section> }>` | `findAllLinkedNcrs(travelerId)` → `orderNcrsByFormPosition(ncrs, activeFormLabels(traveler))` (research.md R3, ordered to match the traveler's own form top to bottom — not creation time) → each mapped through `buildNcrPdfModel(ncr, { travelerTitle }).sections`, `'Event History'` filtered out (R1). Empty array when the traveler has no linked NCRs — the client shows a "no NCRs" line (FR-005) rather than nothing. |
| `GET /travelers/:id/review-records/` | `Array<{ reviewerName, outcome: 'Approved'\|'Rejected', date, comment, voided }>` | `reviewRecordRows(traveler, reviewerNames)` (R4), `reviewerNames` resolved via one batched `User.find`. Empty array when there is no review history — the client shows a "no approvals" line (FR-007) rather than nothing. |

Both are read-only, authenticated the same way every other `/travelers/:id/*`
page-support endpoint already is (`auth.ensureAuthenticated`,
`reqUtils.exist('id', Traveler)`, `reqUtils.canReadMw('id')`).

### `Section` (existing shape, from `lib/ncr-pdf.js`, unchanged)

```js
{ heading: String, rows: Array<[String, String]> }   // label/value pairs
{ heading: String, table: { head: Array<String>, rows: Array<Array<String>>, widths?: Array<Number> } }
{ heading: String, note: String }                      // a single line, e.g. "None recorded"
```

Every value is already a display-ready string (`lib/ncr-pdf.js`'s own
`text()`/`formatDate()`), so the client-side renderer only ever inserts
strings via `.text()` (research.md R5) — no date math, no null-handling, no
HTML parsing, in the browser.

## New pure functions (`lib/traveler-ncr.js`)

### `findAllLinkedNcrs(travelerId)` → `Promise<Array<NcrDocument>>`

Every NCR with `traveler_link.traveler_id === travelerId` and
`traveler_link.initiated_from_traveler === true`, any status, full
documents, sorted `{ created_at: 1 }` (oldest first) as a baseline order.
Mirrors `findOpenNcrs`'s filter minus the `status` clause (research.md R3).

### `orderNcrsByFormPosition(ncrs, labels)` → `Array<NcrDocument>` (pure)

Re-sorts `ncrs` (as returned by `findAllLinkedNcrs`) by the position of
each NCR's `traveler_link.input_name` within `labels` (the traveler's
active form's own name → label map, in its existing document order). An
NCR whose input is not in `labels` (removed from the form since) sorts
after every NCR whose input is still recognized. NCRs on the same input
keep their relative (oldest-first) order, via `Array.prototype.sort`'s
guaranteed stability (research.md R3) — this is the function that actually
produces FR-010's "top to bottom, matching the form" order; `findAllLinkedNcrs`
only provides a stable starting point.

### `reviewRecordRows(traveler, reviewerNames)` → `Array<{reviewerName, outcome, date, comment, voided}>`

- Input: `traveler.__review.reviewResults` (existing schema: `reviewerId`,
  `result` (`'1'`|`'2'`), `submittedOn`, `v`, `comment`, `voided`) and
  `reviewerNames`, a `Map<String, String>` (id → name) the caller already
  resolved via a single batched `User.find`.
- Output: one row per result, recorded order — `reviewerName` (resolved, or
  the raw id as a fallback), `outcome` (`'Approved'` for `result === '1'`,
  else `'Rejected'`), `date` (`submittedOn`), `comment`, `voided` — every
  recorded result, not filtered (research.md R4).

## Client-side state (`public/javascripts/traveler-print.js`, not persisted)

Two fetches, issued in the page's existing ready handler alongside the
discrepancy log's own fetch:

```js
$.getJSON('./ncr-print-details/')   // -> Array<{ncrTitle, sections}>
$.getJSON('./review-records/')      // -> Array<{reviewerName, outcome, date, comment, voided}>
```

Both resolving is what enables `#create-pdf` (research.md R7); a failure on
either is handled the same way the page's other AJAX calls already handle a
failure (`ajax401`), not a new error-handling convention.

## Key Entities (spec.md, restated with their concrete source)

- **NCR**: every `Ncr` document `findAllLinkedNcrs` returns; its printed
  detail is `buildNcrPdfModel`'s own `sections`, Event History removed.
- **Review Record**: one `traveler.__review.reviewResults` entry, reshaped
  by `reviewRecordRows`.
- **Traveler**: unchanged — the existing page and its embedded `traveler`
  JSON blob are not modified by this feature.
