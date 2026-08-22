# Data Model: Remove Root Cause Analysis from CE/CS Disposition

## Schema Changes

### NCR Disposition Subdocument (`ncr.disposition`)

No schema field is removed. `root_cause_documentation` remains declared in
`model/ncr.js` for backward compatibility. The change is in validation and
population behavior only.

```javascript
// model/ncr.js — disposition embedded subdocument (UNCHANGED)
disposition: {
  parts_disposition: String,         // required — validated in route
  root_cause_documentation: String,  // KEPT but no longer populated or validated
  rework_repair_instructions: String,// required only when Rework/Repair
  ce_cs_identity: ObjectId,
  ce_cs_timestamp: Date,
},
```

### What Changes

| Layer | Before | After |
|-------|--------|-------|
| `routes/ncr.js` — read from body | `root_cause_documentation: sanitizeStr(...)` | removed |
| `routes/ncr.js` — validate | 50-char minimum required | removed entirely |
| `lib/ncr-service.js` — assign | `ncr.disposition.root_cause_documentation = data.root_cause_documentation` | removed |
| `lib/ncr-service.js` — event payload | `root_cause_excerpt: data.root_cause_documentation.slice(0, 100)` | removed |
| `views/ncr-disposition.jade` | RCA fieldset + client validation + payload field | removed |
| `views/ncr-detail.jade` | conditional `if` + `dt/dd` display | removed |
| `views/ncr-concurrence.jade` | `dt Root Cause` + `dd= ncr.disposition.root_cause_documentation` | removed |

### What Does Not Change

| Layer | Reason |
|-------|--------|
| `model/ncr.js` — `root_cause_documentation: String` | backward compat with existing records |
| `lib/ncr-service.js` — root_cause dashboard filter (L757-759) | historical search still valid |
| Existing NCR documents | no migration; old values stay in place, silently ignored by new UI |

## Disposition Event Payload

The `disposition.submitted` event stored in `ncr.events[]` changes shape for
new submissions. Old events retain their `root_cause_excerpt` field unchanged.

```javascript
// NEW shape (after this change)
{
  event_type: 'disposition.submitted',
  // ...
  payload: {
    parts_disposition: 'Use-As-Is',
    preventive_action_count: 2,
    // root_cause_excerpt: removed
  }
}
```

## Validation Rules (updated)

### Disposition Submission — required fields after change

| Field | Rule |
|-------|------|
| `parts_disposition` | One of: Rework, Repair, Return to Vendor, Scrap, Use-As-Is |
| `preventive_actions` | Array, ≥1 entry, each ≥50 characters |
| `rework_repair_instructions` | ≥50 characters **only when** parts_disposition is Rework or Repair |
| ~~`root_cause_documentation`~~ | ~~≥50 characters~~ — **removed** |
