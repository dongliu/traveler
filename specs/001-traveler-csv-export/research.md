# Phase 0 Research: Traveler CSV Export

No `NEEDS CLARIFICATION` markers remained in the Technical Context after grounding it in the
existing codebase. This document records the decisions made and the codebase evidence behind
each one.

## 1. CSV generation approach

**Decision**: Hand-roll a small RFC 4180-style escaping helper in `lib/csv.js` (quote a field
when it contains a comma, double quote, or line break; double any embedded double quotes).

**Rationale**: `package.json` has no CSV library today (`grep`-confirmed), and the codebase's
existing `lib/` modules (`lib/tag.js`, `lib/share.js`, `lib/req-utils.js`) are consistently small,
dependency-free, hand-written utilities. The escaping algorithm needed here is a handful of
lines and fully unit-testable, so it does not justify a new runtime dependency.

**Alternatives considered**: `json2csv` / `csv-stringify` npm packages — rejected; they'd be the
only CSV dependency in the project for a well-understood, small algorithm, adding install/audit
surface without proportional benefit.

## 2. Field enumeration source (which fields appear as rows)

**Decision**: Enumerate rows from the keys of `traveler.labels` (a `name -> label` map stored on
the `Traveler` document, `model/traveler.js:149`), cross-referencing `traveler.types` (`name ->
input type`, same doc) for each field's type.

**Rationale**: `traveler.labels` is populated once, when the form snapshot is captured onto the
traveler, from every input in the form's HTML (`model/form.js:94-166`) — it is the complete,
authoritative set of fields defined for that traveler, independent of whether any value has been
entered. Enumerating from `traveler.labels` (rather than from existing `TravelerData` documents)
is what satisfies **FR-006**: unanswered fields still get a row.

**Alternatives considered**: Enumerate from `traveler.data` (the array of `TravelerData` document
ids already saved) — rejected, because a field with no submitted value has no `TravelerData`
document yet and would silently be omitted, violating FR-006.

## 3. Internal field name / stable reference key (the column added per the 2026-08-23 clarification)

**Decision**: Use the `name` key itself (the same string used as the object key in
`traveler.labels` / `traveler.types`, and stored verbatim as `TravelerData.name` on every
recorded value, `model/traveler.js:240`) as the "internal field name" reference column.

**Rationale**: `model/form.js:94-166` shows two candidate identifiers exist on a form input: the
mandatory `inputName` (from the HTML `name` attribute — every input has one, and it is what
`labels`, `types`, and `TravelerData.name` all key off of) and the optional `data-userkey`
attribute, which only populates `traveler.mapping[userkey] = inputName` when an author explicitly
sets it (`model/form.js:152`). Since `mapping` entries are optional and not every field has one,
using `mapping`'s key as the "stable reference" would leave gaps for fields without a
`data-userkey`. `name` is universal — every field has exactly one — so it is the only candidate
that can satisfy FR-005 for *every* row.

**Alternatives considered**: `traveler.mapping`'s user-key — rejected as non-universal (see
above); a synthetic row index — rejected, it is not stable across re-exports if fields are ever
added mid-lifecycle.

## 4. Traveler link construction

**Decision**: Reuse the existing pattern already used for post-action redirects in
`routes/traveler.js` (e.g. lines ~479, ~1346): `` `${req.proxied ? authConfig.proxied_service :
authConfig.service}/travelers/${id}/view` ``.

**Rationale**: This is the exact base-URL-selection logic the codebase already uses everywhere
it needs to hand back a traveler URL, so reusing it keeps the exported link consistent with links
the application produces elsewhere (e.g., in `Location` headers), including correctly handling
reverse-proxy deployments.

**Alternatives considered**: Deriving the link from `req.protocol`/`req.get('host')` directly —
rejected, it would diverge from the config-driven `service`/`proxied_service` values the rest of
the app relies on for proxied deployments.

## 5. Status label

**Decision**: Use the existing `statusMap` exported from `model/traveler.js` (keyed by the
traveler's numeric `status`) to render the human-readable status name (FR-004).

**Rationale**: This map already exists specifically to translate the internal numeric status
codes described in the Constitution's Principle I into display text; no new mapping is needed.

## 6. File-attachment field values (FR-009)

**Decision**: No special-case handling is required. Output `TravelerData.value` as-is for every
field, including file-type ones.

**Rationale**: Inspecting the file-upload route (`routes/traveler.js`, the handler that creates
`TravelerData` for `inputType === 'file'`) shows `value: uploaded.originalname` is already set to
the plain uploaded filename string at write time — the raw binary is stored separately
(`file.path` on disk) and is never held in `value`. So the general "output the value" path
already yields a readable filename reference for file fields, satisfying FR-009 with no branch.

**Alternatives considered**: Building a download link into the CSV cell (e.g., pointing at the
existing `/data/:id` route) — deferred as an unrequested enhancement; the spec only requires a
"readable reference," which the plain filename already is.

## 7. Access control

**Decision**: Guard the new route with `reqUtils.exist('id', Traveler)` followed by
`reqUtils.canReadMw('id')`, identical to the existing `/travelers/:id/json` route
(`routes/traveler.js:552-566`).

**Rationale**: This is the Constitution's mandated pattern (Principle II) and is already proven
for a structurally identical case — a read-only, non-HTML, single-traveler data endpoint.

## 8. Response mechanics (headers, delivery)

**Decision**: `res.set('Content-Type', 'text/csv; charset=utf-8')`, `res.set('Content-
Disposition', 'attachment; filename="..."')`, then `res.send(csvString)` (or `res.status(200).send
(...)`), following the `res.set(...)` idiom already used throughout `routes/traveler.js` for
response headers.

**Rationale**: Matches existing header-setting style in this file; `res.download()` (also already
used at `routes/traveler.js:1366`) is for filesystem-backed files and doesn't fit an in-memory
generated string, so a plain `res.send` with explicit headers is the closer existing precedent.

## 9. CSV layout (metadata block vs. data table)

**Decision**: A single CSV file: a small metadata block first (one row per fact — Link, Id,
Title, Status), then a blank separator row, then a header row for the data table (`Field Name,
Label, Type, Value, Input By, Input On`), then one data row per field, in the iteration order of
`traveler.labels` (JS preserves insertion order for string keys, which matches the original
field order captured from the form's HTML at snapshot time).

**Rationale**: Directly satisfies **US2/FR-003** ("traveler's link, id, title, and status are
visible... before any collected data rows") while giving the newly-added field-name column (and
every other data column) an explicit header, so the file is self-describing per **US3**.

**Alternatives considered**: Two separate CSV files (metadata + data) — rejected; the spec
describes a single downloadable file per traveler id, and a single file is simpler for a
recipient to handle.

## 10. Testing approach

**Decision**: Unit-test `lib/csv.js`'s escaping/row-building functions in `test/lib/csv-test.js`
(happy path, commas, quotes, embedded newlines, empty values), plus one smoke test for the new
route in the existing traveler route test suite covering: 200 with expected header/data rows for
an accessible traveler, 403 for a traveler the user cannot read, 404 for a non-existent id.

**Rationale**: Matches CLAUDE.md's test commands (`npx mocha test/lib/`) and the Constitution's
Development Workflow requirement that "every new route MUST have at least a smoke test validating
the happy path," plus the requirement that new `lib/` functions have corresponding tests.
