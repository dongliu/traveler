# Data Model: Form & Traveler Metadata Fields

## Entity: ReleasedForm (`model/released-form.js`)

### New Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `subsystem` | String | No | `''` | Classification subsystem label |
| `device` | String | No | `''` | Classification device label |
| `activity` | String | No | `''` | Classification activity label |

### Schema Changes

Add to the `releasedForm` schema definition (after the existing `compositionKey` field):

```js
subsystem: { type: String, default: '' },
device:    { type: String, default: '' },
activity:  { type: String, default: '' },
```

### History Plugin Update

Add the three fields to `fieldsToWatch` in the `addHistory` plugin call:

```js
releasedForm.plugin(addHistory, {
  fieldsToWatch: [
    'title', 'description', 'tags', 'status',
    'base', 'discrepancy', 'aclForms', '_v',
    'subsystem', 'device', 'activity',       // NEW
  ],
});
```

**`fieldsToVersion` is unchanged** — classification fields are metadata, not structural form content; they do not trigger a version bump.

---

## Entity: Traveler (`model/traveler.js`)

### New Fields

| Field | Type | Required | Default | Source | Editable After Creation |
|-------|------|----------|---------|--------|------------------------|
| `subsystem` | String | No | `''` | Initially copied from released form | Yes (active states only) |
| `device` | String | No | `''` | Initially copied from released form | Yes (active states only) |
| `activity` | String | No | `''` | Initially copied from released form | Yes (active states only) |
| `machineArea` | String | No | `''` | User-provided | Yes (active states only) |
| `sector` | String | No | `''` | User-provided | Yes (active states only) |
| `windchillId` | String | No | `''` | User-provided | Yes (active states only) |

All six fields share the same edit rule: editable while the traveler is in an active state, and editable by admins at any state. Editing `subsystem`/`device`/`activity` on the traveler only changes that traveler's copy — it never writes back to the source `ReleasedForm`.

**"Active states"**: `0` (not started), `1` (in progress), `1.5` (submitted for review). Fields become read-only for non-admins once the traveler reaches state `2` (approved) or beyond.

### Schema Changes

Add to the `traveler` schema definition (after the existing `archived` field):

```js
subsystem:   { type: String, default: '' },
device:      { type: String, default: '' },
activity:    { type: String, default: '' },
machineArea: { type: String, default: '' },
sector:      { type: String, default: '' },
windchillId: { type: String, default: '' },
```

### History Plugin Update

Add all six fields to `fieldsToWatch` in the Traveler schema's `addHistory` plugin call (find the existing plugin registration in `model/traveler.js` and extend it):

```js
// Add to the existing fieldsToWatch array:
'subsystem', 'device', 'activity',
'machineArea', 'sector', 'windchillId',
```

---

## Traveler Creation Propagation

In `utilities/routes.js`, function `createTraveler` (line ~354), the `Traveler` constructor call gains three new fields:

```js
var traveler = new Traveler({
  // ... existing fields ...
  subsystem: form.subsystem || '',
  device:    form.device    || '',
  activity:  form.activity  || '',
});
```

The `machineArea`, `sector`, and `windchillId` fields are **not** copied from the released form — they default to `''` and are populated later by users.

---

## Relationships

```
ReleasedForm
  └─ subsystem, device, activity  ──(copied at creation)──►  Traveler.subsystem / .device / .activity
                                                              Traveler.machineArea  (independent)
                                                              Traveler.sector       (independent)
                                                              Traveler.windchillId  (independent)
```

---

## Validation Rules

- All six fields are free-text strings; no format validation beyond maximum length.
- Maximum length: 200 characters per field (enforced at the route level via sanitization, consistent with other text fields in the project).
- No controlled vocabulary; users are responsible for consistent entry.
- Blank string (`''`) and absent (`undefined`) are treated equivalently; always stored as `''` via the schema default.
