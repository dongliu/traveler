# Data Model: Traveler-Driven NCR Input Flow and Live Status

No new stored entities and no schema change. Everything here is derived from
existing data at read time, in `lib/traveler-ncr.js`.

## Existing data read by this feature

| Source | Fields used | Notes |
|---|---|---|
| `Traveler` | `_id`, `title`, `status`, `labels` (name → label), `touchedInputs`, `finishedInput`, `data` (ids of `TravelerData`) | `labels` is the set counted as inputs; `totalInput` is its size. |
| `TravelerData` | `name`, `value`, `inputOn` | Holds each input's saved value. Read by name. |
| `Ncr` | `_id`, `ncr_number`, `status`, `updated_at`, `traveler_link.traveler_id`, `traveler_link.input_name`, `traveler_link.input_label`, `traveler_link.initiated_from_traveler` | "Linked" is the existing selector used by `ncr-links`. |

## Derived: input state (per counted input)

| Field | Rule |
|---|---|
| `name`, `label` | From `Traveler.labels`. |
| `has_value` | A `TravelerData` entry exists for `name` and its value is not `null`, `undefined`, `''`, or `[]` (R1). |
| `open_ncr_count` | Count of linked NCRs for this input whose status is not `Closed`. |
| `closed_ncr_count` | Count of linked NCRs for this input whose status is `Closed`. |
| `waiting_on_ncr` | `open_ncr_count > 0`. Drives the **Input** option (hidden when true) and the waiting marker. |
| `finished` | `has_value && !waiting_on_ncr`. Matches the existing `finishedCount` rule, except for the non-empty requirement. |
| `options` | `['input', 'initiate_ncr']` when the traveler is active; `[]` otherwise. `input` is removed when `waiting_on_ncr`. |
| `revision` | A string built from `TravelerData.inputOn` for `name` (ISO time, or `'none'`). Changes exactly when the saved value changes. |

## Derived: traveler submission readiness

| Field | Rule |
|---|---|
| `open_ncrs` | All linked NCRs not Closed: `ncr_id`, `ncr_number`, `status`, `input_name`, `input_label` (the same shape as the existing 409 body). |
| `missing_inputs` | Every counted input with `has_value === false`: `name`, `label`. |
| `submit_ready` | `open_ncrs.length === 0 && missing_inputs.length === 0`. |

Client-side, `submit_ready` also requires that no input is in Input mode with
unsaved changes (FR-019). That condition exists only in the page, and the server
does not see it; the server gate does not depend on it.

## State transitions

- **Input**: `no value` → (Save) → `has value`. `has value` ↔ `waiting on NCR`
  when an NCR is created or closed. Any state → `waiting on NCR` when an NCR is
  created against it.
- **Traveler**: `active` → `submitted` (1 → 1.5) only when `submit_ready`.
  `submitted` → `active` (sent back) re-runs the same check on the next submission.
- **NCR** (existing states): `Submitted` → … → `Closed`. Only `Closed` releases
  an input's hold and counts toward `submit_ready`.
