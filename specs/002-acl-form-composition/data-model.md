# Phase 1 Data Model: ACL Form Composition on Release

This documents the schema changes layered onto the existing `Form`, `ReleasedForm`, and `Traveler`
models (`model/form.js`, `model/released-form.js`, `model/traveler.js`). Only additions/changes are
shown; all other existing fields, plugins (`addHistory`, `addVersion`, `addReview`), and state
machines are unchanged and continue to govern these entities per Constitution Principle I.

## Form (`model/form.js`)

| Field      | Change                                                                 |
|------------|-------------------------------------------------------------------------|
| `formType` | Enum extended: `['normal', 'discrepancy', 'ACL']` (was `['normal', 'discrepancy']`) |

No other change. An ACL form is authored, submitted for review, and released through the exact same
`stateTransition` (`0` draft → `0.5` submitted → `1` released → `2` archived) and the same
`/forms/`, `/forms/:id/status`, `/forms/:id/released` routes already used for `'discrepancy'` forms
today — releasing a standalone ACL form does **not** go through the new compose action; it produces
a plain `ReleasedForm` with `formType: 'ACL'` via the existing `/forms/:id/released` handler (no
`discrepancyFormId` is relevant to it, since only `formType === 'normal'` bases currently offer that
attachment, unchanged).

## ReleasedForm (`model/released-form.js`)

| Field       | Change                                                                                          |
|-------------|---------------------------------------------------------------------------------------------------|
| `formType`  | Enum extended: `['normal', 'discrepancy', 'normal_discrepancy', 'ACL', 'normal_acl']`             |
| `aclForms`  | **New**: `[formContent]`, default `[]` — immutable content snapshots of every attached ACL form   |
| `ver`       | No schema change (still `String`) — for `formType: 'normal_acl'`, its *contents* follow the id-set scheme from `research.md` §1 instead of the `base_v[:discrepancy_v]` scheme |

`formContent` sub-schema (`html`, `mapping`, `labels`, `types`, `formType`, `_v`) is reused as-is for
`aclForms` entries — its own `formType` enum must also be extended to include `'ACL'` since it is
shared between `base`, `discrepancy`, and (new) `aclForms` entries:

```text
formContent.formType enum: ['normal', 'discrepancy', 'ACL']
```

### `formType` semantics (updated)

```text
normal            => base only, base is a normal released form                    (unchanged)
discrepancy       => base only, base is a discrepancy released form                (unchanged)
normal_discrepancy=> base + discrepancy, produced by the standard release action   (unchanged)
ACL               => base only, base is an ACL released form                       (new)
normal_acl        => base + zero-to-many aclForms, produced by the compose action  (new)
```

`normal_acl` and `normal_discrepancy` are mutually exclusive outcomes of two separate actions
(standard release vs. compose); a single `ReleasedForm` document is never both.

### `addVersion` / `addHistory` field lists

Both plugin configurations (`fieldsToVersion`, `fieldsToWatch`) must include `aclForms` alongside the
existing `title`, `description`, `base`, `discrepancy` so that composing correctly bumps `_v` and is
captured in the audit history the same way attaching a discrepancy form is today.

### Duplicate-detection key (unchanged mechanism, new `ver` contents)

The existing check remains:

```js
ReleasedForm.findOne({ title, formType, ver, status: 1 })
```

For `formType: 'normal_acl'`, `ver` is computed per `research.md` §1 from the **source released-form
ids** the user selected (the `_id` of the base `ReleasedForm` and the sorted `_id`s of the selected
ACL `ReleasedForm`s) — not from the embedded snapshots' own `_v` values.

## Traveler (`model/traveler.js`)

| Field                  | Change                                                                                  |
|------------------------|--------------------------------------------------------------------------------------------|
| `aclForms`             | **New**: `[form]` (reuses the existing `form` sub-schema already used by `forms`/`discrepancyForms`) — one entry per ACL form attached to the released form the traveler was created from |
| `mapping`/`labels`/`types` | Semantics extended: now the **merge** of the base form's `mapping`/`labels`/`types` with every entry in `aclForms`' `mapping`/`labels`/`types` (previously base-only) |
| `totalInput`           | Semantics extended: computed from the size of the **merged** `labels` (previously `_.size(base.labels)` only) |

No new "active ACL form" pointer field is added (unlike `activeForm`/`activeDiscrepancyForm`) —
every entry in `aclForms` is always rendered; there is no single-active-selection concept for ACL
sections, matching FR-009's "render every attached ACL form."

### Validation rule enforced at compose time (not a schema constraint)

Before a composition is accepted (see `contracts/compose-released-form.md`), the input `name`
attributes across the base form's `html` and every selected ACL form's `html` must be disjoint (no
name appears in more than one). This is a request-time validation in the compose route handler, not
a Mongoose schema-level constraint, since it depends on parsing HTML content (via `cheerio`, the same
library `model/form.js`'s pre-save hook already uses for its own within-form duplicate check).

## Relationships

```text
Form (formType: 'ACL')
  --release--> ReleasedForm (formType: 'ACL', base: <snapshot>)
                                   |
                                   |  selected as one of N ACL attachments
                                   v
Form (formType: 'normal')
  --release--> ReleasedForm (formType: 'normal', base: <snapshot>)
                                   |
                                   |  selected as the base
                                   v
                    [compose action: base ReleasedForm + 0..N ACL ReleasedForms]
                                   |
                                   v
                ReleasedForm (formType: 'normal_acl', base: <base snapshot>,
                               aclForms: [<ACL snapshot>, ...],
                               ver: "<baseId>:<sortedAclId1>,<sortedAclId2>,...")
                                   |
                                   |  createTraveler
                                   v
                Traveler (forms: [<base snapshot>], aclForms: [<ACL snapshot>, ...],
                           mapping/labels/types: merged, totalInput: merged size)
```
