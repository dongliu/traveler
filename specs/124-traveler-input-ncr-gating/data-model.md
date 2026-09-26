# Phase 1 Data Model: Traveler Input NCR Gating and Closure Record

**Feature**: `124-traveler-input-ncr-gating` | **Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

## Summary of storage changes

| Where | Change |
|---|---|
| `Ncr` schema (`model/ncr.js`) | **No field change.** `traveler_link` stays `{traveler_id, input_name, input_label, initiated_from_traveler}` from feature 123. `NCR_EVENT_TYPES` gains two values. |
| `Traveler` schema (`model/traveler.js`) | **No field change.** `touchedInputs` keeps its meaning; `finishedInput` keeps its type but its *value* now follows the formula below. |
| New collection | `TravelerNcrPdf` (model in `model/traveler.js`, beside `TravelerNote`). |
| Disk | One PDF file per record under the existing `config.uploadPath`. |
| Migration | None. The new collection starts empty; no existing document gains or loses a field. |

## New `NCR_EVENT_TYPES` (`model/ncr.js`)

| Value | Written when | `actor_type` | `payload` |
|---|---|---|---|
| `traveler.pdf_attached` | the closure PDF was written and its `TravelerNcrPdf` record inserted | `system` | `{traveler_id, input_name, pdf_id, file_name}` |
| `traveler.pdf_failed` | any step of the attach failed (traveler gone, input gone, render error, disk/DB error) | `system` | `{traveler_id, input_name, reason}` — `reason` is a short human-readable message, never a stack trace or file path |

Both are appended by `attachClosurePdf` **after** the closure has been saved, so
they never precede `ncr.closed`. The event timeline in `views/ncr-detail.jade`
renders `event.event_type` as a plain badge, so no view change is needed.

## New model: `TravelerNcrPdf`

```js
const travelerNcrPdf = new Schema({
  traveler: { type: ObjectId, required: true, index: true }, // the Traveler _id (kept even if the traveler is later removed)
  input_name: String,      // the input the NCR was linked to (Traveler form labels key)
  ncr_id: { type: ObjectId, required: true }, // kept even if the NCR is later deleted (FR-028)
  ncr_number: String,      // e.g. 'NCR-2026-0007' — copied so the record stands alone
  file_name: String,       // user-facing, `${ncr_number}.pdf`
  file: {
    path: String,          // server-generated name under config.uploadPath; never user-supplied
    mimetype: { type: String, default: 'application/pdf' },
    size: Number,
  },
  generatedOn: Date,
  generatedBy: String,     // user id of the person who closed the NCR
});
travelerNcrPdf.index({ traveler: 1, ncr_id: 1 }, { unique: true });
```

- The **unique** `(traveler, ncr_id)` index makes attaching idempotent: a retry
  or duplicate call for the same NCR fails the insert rather than attaching a
  second PDF. `attachClosurePdf` treats a duplicate-key error as
  `already attached` (success), not a failure.
- **Why a separate record** (not `TravelerData`, `Ncr.attachments`, or an array on
  `Traveler`): see research.md Decision 9.
- `ncr_id` and `ncr_number` are stored by value, so the record — and the PDF —
  remain usable after the `Ncr` document is deleted by an admin.

## Definitions used by the rules

| Term | Definition |
|---|---|
| **Linked NCR** (of a traveler) | An `Ncr` with `traveler_link.traveler_id` = the traveler's `_id` and `traveler_link.initiated_from_traveler === true` — the same selector `GET /travelers/:id/ncr-links/` uses. |
| **Open NCR** | A linked NCR whose `status !== 'Closed'` (`Submitted`, `Dispositioned`, `Approval Requested`, `Returned for Comment`, `Final Approval`). |
| **Open-NCR input names** (of a traveler) | The distinct, non-empty `traveler_link.input_name` values of its open NCRs. An open NCR with no `input_name` (a legacy/fixture record) blocks submission for completion approval but blocks no input. |
| **Active traveler** | `Traveler.status === 1` (`statusMap['1'] === 'active'`). |

Queries (both use the existing index `{traveler_link.traveler_id, traveler_link.input_name}` as a prefix on `traveler_id`):

```js
// open NCRs for the submission refusal (FR-014)
Ncr.find(
  { 'traveler_link.traveler_id': id, 'traveler_link.initiated_from_traveler': true, status: { $ne: 'Closed' } },
  { ncr_number: 1, status: 1, 'traveler_link.input_name': 1, 'traveler_link.input_label': 1 }
).lean();

// open-NCR input names for progress (FR-017)
Ncr.distinct('traveler_link.input_name',
  { 'traveler_link.traveler_id': id, 'traveler_link.initiated_from_traveler': true, status: { $ne: 'Closed' } });
```

## Traveler input reference

A reference is a string, not a stored entity. Grammar and validation:

```
reference     := traveler-id "::" input-name
traveler-id   := 24 hex characters (a valid ObjectId)
input-name    := one or more characters (may itself contain "::")
```

| Rule | Behaviour | Error code (HTTP) |
|---|---|---|
| Trim leading/trailing whitespace first | applied before every other rule | — |
| Length ≤ 256 characters | longer is rejected without a query | `BAD_REFERENCE` (400) |
| Contains `::`, both sides non-empty | split at the **first** `::` only | `BAD_REFERENCE` (400) |
| `traveler-id` is a valid ObjectId | checked **before** any query | `BAD_REFERENCE` (400) |
| Traveler exists **and** the caller has read access | otherwise indistinguishable from "not found" | `TRAVELER_NOT_FOUND` (404) |
| `input-name` is a key of the traveler's active-form labels | message names the traveler's title (the caller can already read it) | `INPUT_NOT_FOUND` (404) |
| `Traveler.status === 1` | message names the current status | `TRAVELER_NOT_ACTIVE` (409) |

The rules run in that order. The label recorded on the NCR is the value from the
traveler's own labels map, never a client-supplied string.

## Which traveler statuses allow what

| Traveler status | Initiate NCR (both paths) | Submit for completion approval (→ 1.5) |
|---|---|---|
| 0 initialized | refused (`TRAVELER_NOT_ACTIVE`) | n/a (not a valid transition) |
| **1 active** | **allowed** | refused if any open linked NCR |
| 1.5 submitted for completion | refused | n/a |
| 2 completed | refused | n/a |
| 3 frozen | refused | n/a |
| 4 archived | refused | n/a |

The refusal (`OPEN_NCRS`, 409) is raised when a traveler is moved out of active
toward completion: target status **1.5**, and target **2 from status 1** (the
legacy API helper's direct route), on the three paths listed in research.md
Decision 4. It is **not** raised for approval (1.5 → 2), rejection back to
active (1.5 → 1), 1 → 3, or any → 4: NCR initiation requires an active
traveler, so none can be opened after submission (spec Assumptions).

## Progress figure

```
finishedInput = | touchedInputs  \  openNcrInputNames |
```

`touchedInputs` is unchanged (input names that have at least one submitted
value, per `resetTouched`). Worked example on a traveler with inputs A, B, C:

| Event | `touchedInputs` | open-NCR input names | `finishedInput` |
|---|---|---|---|
| A and B filled in | A, B | — | 2 |
| NCR-1 raised against A | A, B | A | 1 |
| NCR-2 raised against C by reference (C unfilled) | A, B | A, C | 1 |
| C filled in while NCR-2 is open | A, B, C | A, C | 1 |
| NCR-1 closed | A, B, C | C | 2 |
| NCR-2 deleted by an admin | A, B, C | — | 3 |

`finishedInput` is recomputed by `resetTouched` (data save) and by
`refreshTravelerProgress` on NCR **create**, **close**, and **delete**. The latter
sets only that one scalar and uses `doc.save()`, so the existing post-save hook
re-rolls binder progress (research.md Decision 5).

## Relationships

```
Ncr.traveler_link.traveler_id ──> Traveler._id           (123; survives traveler removal)
Ncr.traveler_link.input_name  ──> Traveler active form labels key
TravelerNcrPdf.traveler       ──> Traveler._id
TravelerNcrPdf.(input_name)   ──> the same input the NCR was linked to
TravelerNcrPdf.ncr_id         ──> Ncr._id                (by value; NCR may be deleted)
```

One input may have zero, one, or many `Ncr` documents and, once they close,
one `TravelerNcrPdf` each; neither side overwrites another (FR-025).
