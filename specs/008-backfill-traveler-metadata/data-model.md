# Data Model: Backfill Traveler Classification Metadata

No new fields, schemas, or migrations. This feature changes *behavior* of an existing endpoint over existing fields on two existing entities.

## Entity: ReleasedForm (`model/released-form.js`)

Unchanged. The fields this feature reads are already defined:

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | Identifies the released form |
| `ver` | String | `base_v[:discrepancy_v]`, set once at release time, never reassigned |
| `subsystem` | String | Default `''`; editable post-release by owner/admin via `PUT /released-forms/:id/metadata` |
| `device` | String | Same as above |
| `activity` | String | Same as above |

## Entity: Traveler (`model/traveler.js`)

Unchanged. The fields this feature reads and conditionally writes:

| Field | Type | Notes |
|-------|------|-------|
| `referenceReleasedForm` | ObjectId | Set once at creation (`utilities/routes.js`, `createTraveler`); identifies the source `ReleasedForm` |
| `referenceReleasedFormVer` | String | Set once at creation; the source `ReleasedForm`'s `ver` at that time |
| `subsystem` | String | Default `''`; initially copied from the released form at creation; may still be blank for travelers created before the released form had a value |
| `device` | String | Same as above |
| `activity` | String | Same as above |

No new `addHistory`/`saveWithHistory` registration is added to `Traveler` for this feature — none exists today, and the spec explicitly defers traveler-side history tracking to a future change (FR-007).

## Relationship this feature acts on

```
ReleasedForm (one document, identified by _id + ver)
  │
  │  "created from" ⇔ traveler.referenceReleasedForm === releasedForm._id
  │                 AND traveler.referenceReleasedFormVer === releasedForm.ver
  ▼
Traveler (zero, one, or many documents)
```

When `subsystem`, `device`, or `activity` is updated on a `ReleasedForm` document via `PUT /released-forms/:id/metadata`, every `Traveler` document matching that relationship is re-evaluated:

- Per field (`subsystem`, `device`, `activity`), independently:
  - If the traveler's current value is blank (`''`, `null`, or `undefined`) **and** the released form's current value for that field is non-blank → set the traveler's field to the released form's value.
  - Otherwise → leave the traveler's field untouched.
- A traveler is saved only if at least one of its three fields changed.

No other traveler fields (`machineArea`, `sector`, `windchillId`, `status`, etc.) are read or written by this behavior.

## Validation Rules

- "Blank" = schema default empty string, `null`, or `undefined` — no additional trimming/whitespace handling beyond what already applies when a value is saved (unchanged from spec 003).
- The released form's own value is used as-is (already sanitized by the existing `PUT /released-forms/:id/metadata` handler via `reqUtils.sanitize`); no re-sanitization is needed when copying it onto a traveler.
