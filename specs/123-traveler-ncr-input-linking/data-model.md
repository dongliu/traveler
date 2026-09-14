# Phase 1 Data Model: Traveler-Initiated NCRs Linked to a Specific Input

**Feature**: `123-traveler-ncr-input-linking` | **Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

## `Ncr.traveler_link` schema change (`model/ncr.js`)

**Before**:
```js
traveler_link: {
  traveler_id: ObjectId,
  // this need to be the input unique name
  step_number: Number,
  initiated_from_traveler: Boolean,
},
```

**After**:
```js
traveler_link: {
  traveler_id: ObjectId,
  input_name: String,   // the input's `name` attribute — unique within the source traveler's form (model/traveler.js TravelerData.name)
  input_label: String,  // the input's human-readable label, captured at NCR creation time (FR-004)
  initiated_from_traveler: Boolean,
},
```

`step_number` is removed outright, not deprecated-in-place — research.md
Decision 1 establishes it has no real (non-test-fixture) data depending on
it today. No migration is needed for the same reason.

**New index**: `NcrSchema.index({ 'traveler_link.traveler_id': 1, 'traveler_link.input_name': 1 });`
— supports the traveler-side lookup in the next section without a full
collection scan.

## Deriving the traveler-side display (no new collection)

Per research.md Decision 1, "which NCRs are linked to this traveler's
inputs" is answered by querying `Ncr` directly, not by maintaining a second,
denormalized record:

```js
Ncr.find(
  { 'traveler_link.traveler_id': travelerId, 'traveler_link.initiated_from_traveler': true },
  { ncr_number: 1, status: 1, 'traveler_link.input_name': 1 }
).lean();
```

Each result row is `{_id, ncr_number, status, traveler_link: {input_name}}`
— the new `GET /travelers/:id/ncr-links/` route (see
`contracts/traveler-ncr-links.json`) reshapes this into the flat
`{ncr_id, ncr_number, status, input_name}` array the client filters by name,
mirroring the existing notes endpoint's shape exactly.

## "Has a submitted value" — reusing `Traveler.touchedInputs`

No schema change here: `Traveler.touchedInputs: [String]` (existing field)
already means exactly "these input names have at least one submitted
`TravelerData` value" (`utilities/routes.js`'s `resetTouched()` already
maintains it on every save). This feature reads it, both server-side
(dumped into the page at load, `views/traveler.jade`'s existing
`var traveler = !{JSON.stringify(traveler)};`) and updates the client's
in-memory copy immediately after each first-time-touched save (research.md
Decision 3) — no new persistence.

## Request/response shape for NCR creation from a traveler input

`POST /api/ncrs` (existing endpoint, `routes/ncr.js`) gains two renamed/added
optional body fields, replacing the dead `traveler_step_number`:

| Field | Before | After |
|---|---|---|
| `traveler_id` | optional, unchanged | optional, unchanged |
| `traveler_step_number` | optional, never populated by any UI | **removed** |
| `traveler_input_name` | — | optional; the input's name, carried through from the traveler page's "Initiate NCR" link |
| `traveler_input_label` | — | optional; the input's label at the moment "Initiate NCR" was clicked |

`lib/ncr-service.js`'s `createNcr()` builds `ncr.traveler_link` from these
three (`traveler_id`, `traveler_input_name`, `traveler_input_label`) exactly
as it already builds it from `traveler_id`/`traveler_step_number` today —
same `if (data.traveler_id) {...}` gate, same shape, just the two renamed
source fields.

## Event payload rename

`closeNcr()`'s `traveler.signed_off` event payload
(`lib/ncr-service.js`, currently `{traveler_id, step_number}`) becomes
`{traveler_id, input_name}` — same rename, no new behavior.

## New Entities

No new Mongoose model/collection is introduced. The two "entities" named in
spec.md's Key Entities section map onto existing structures as follows:

- **Traveler Input** → an entry in the traveler's `form.labels` map
  (`{name: label}`) whose `name` appears in `Traveler.touchedInputs`; not a
  stored document of its own.
- **NCR (traveler-initiated)** → an existing `Ncr` document whose
  `traveler_link.initiated_from_traveler === true`, using the two fields
  above.

## Relationships

```
Traveler.touchedInputs[]  ──(name)──>  gates whether "Initiate NCR" shows for that input
Ncr.traveler_link.traveler_id  ──>  Traveler._id   (kept even if the Traveler is later deleted, per FR-012)
Ncr.traveler_link.input_name   ──>  a name that was in that Traveler's form.labels at creation time
```

An input can have zero, one, or many `Ncr` documents pointing at it via
`(traveler_link.traveler_id, traveler_link.input_name)` — this pair, not the
input name alone, is what scopes a link, satisfying SC-004 (two travelers'
identically-named inputs are never confused) since `traveler_id` always
disambiguates.
