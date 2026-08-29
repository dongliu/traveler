# Phase 0 Research: ACL Form Composition on Release

All items below were open technical questions after the spec was finalized (the spec deliberately
stays at the outcome level; this document resolves *how*). None remain as `NEEDS CLARIFICATION` —
each has a decision, rationale, and rejected alternatives.

## 1. Version identifier / duplicate-detection scheme

**Decision**: For a composed released form, `ver` is a deterministic string built from the **source
released-form ids** the user selected — not from version numbers:

```text
ver = "<baseReleasedFormId>"                                   // zero ACL forms
ver = "<baseReleasedFormId>:<aclId1>,<aclId2>,...,<aclIdN>"    // ACL ids sorted ascending, one or more
```

The existing duplicate check (`ReleasedForm.findOne({ title, formType, ver, status: 1 })`, today at
`routes/form.js:1096-1103`) is reused unmodified for the compose path — only the *contents* of `ver`
differ from the `base_v[:discrepancy_v]` scheme used by the standard release path. Because `formType`
is part of the lookup key too, there is no risk of a composed `ver` (built from ObjectId hex strings)
ever colliding with a numeric-version `ver` from the standard/discrepancy path.

**Rationale**: A source released-form id already uniquely identifies *both* "which form" and "which
version of it" as one atomic value (each release event creates a new `ReleasedForm` document with a
fresh `_id`). Comparing sorted id sets directly:
- Is order-independent by construction (sorting before joining), satisfying spec User Story 3,
  Acceptance Scenario 2.
- Never collides two different ACL combinations, even when their underlying version numbers happen
  to coincide — this is exactly the failure mode the original `base_v[:discrepancy_v]` concatenation
  scheme could not avoid for a variable-length ACL set, which is what the user flagged as broken.
- Requires no new query mechanism, no new indexed field, and no schema migration — it reuses the
  `title + formType + ver + status` duplicate-check exactly as it exists today.
- Composing the same base/ACL *forms* again after any of them gets a new release (a new
  `ReleasedForm._id`) is correctly treated as a *new*, non-duplicate composition — which is the
  desired behavior (re-releasing an ACL form and recomposing with the new version should be allowed).

**Alternatives considered**:
- *Version-number concatenation* (`base_v:acl_v1,acl_v2,...`) — rejected: cannot distinguish which
  specific ACL forms are included when two different forms happen to share a version number (e.g.,
  two different ACL forms both at their own "v1"); this is the exact ambiguity called out as the
  reason the existing discrepancy-only scheme "will not work out of box."
- *Short hash of the sorted id set* (`base:H(sortedIds)`) — rejected: adds a hashing dependency/step
  for no benefit over just joining the ids directly (ObjectId hex strings are already short and
  stable); direct id concatenation is also easier to eyeball during debugging/audit.

## 2. Where the composed content lives on `ReleasedForm`

**Decision**: Add `aclForms: [formContent]` (default `[]`) to the `ReleasedForm` schema, following
the exact pattern of the existing `discrepancy: formContent` field — each entry is a full,
immutable snapshot (`html`, `mapping`, `labels`, `types`, `formType`, `_v`) copied from the selected
ACL `ReleasedForm`'s own `base` field at compose time (mirroring `releasedForm.discrepancy =
discrepancyForm.base` at `routes/form.js:1087` today).

**Rationale**: Consistent with the codebase's established convention of embedding full content
snapshots rather than references, so a `ReleasedForm` document remains self-contained even if the
underlying draft `Form` is later edited. Reusing the `formContent` sub-schema (rather than inventing
a new one) avoids duplicating shape/validation logic (Constitution Principle IV).

**Alternatives considered**: Storing only references (`ObjectId` list) to the source ACL
`ReleasedForm` documents — rejected because it breaks the immutability guarantee every other
released-form field already has (a later edit or archive of the source wouldn't be reflected, but a
pure reference *could* be dereferenced to changed data depending on query-time joins, which is an
inconsistency risk the snapshot approach avoids entirely).

## 3. `formType` values

**Decision**: Two new enum values:
- `'ACL'` on both `Form.formType` and `ReleasedForm.formType` (and `formContent.formType`) — a
  standalone ACL form authored/reviewed/released independently, exactly mirroring `'discrepancy'`.
- `'normal_acl'` on `ReleasedForm.formType` only — the output of the compose action, for *any* ACL
  count including zero. A single value (rather than branching on count) keeps the duplicate-check
  `formType` partition simple and keeps "produced via compose" auditable as one concept.

**Rationale**: Mirrors the existing `'discrepancy'` / `'normal_discrepancy'` pair exactly, so the
new code path is a recognizable sibling of the existing one rather than a divergent design.

**Alternatives considered**: Reusing plain `'normal'` for zero-ACL compositions — rejected per spec
FR-007, which calls out the base-only composition as a valid but still-distinct action; tagging it
`'normal_acl'` preserves that distinction for audit/history purposes without adding a third enum
value.

## 4. Traveler-side rendering and data capture for ACL sections

**Decision**: Each attached ACL form's `html` is rendered inline in `views/traveler.jade`, in its own
labeled `.control-group` section, prepended above the base form's section — all inside the **same**
`#form` element the base form already renders into (`views/traveler.jade:109-117`). A new `Traveler`
field `aclForms: [form]` (reusing the existing `form` sub-schema already used for `forms` and
`discrepancyForms`) holds every attached ACL snapshot; unlike `discrepancyForms` (where only index 0
is ever "active"), **all** entries in `aclForms` are rendered simultaneously — there is no
"active ACL form" concept.

**Rationale**: `public/javascripts/traveler.js` already scopes every input listener (change capture,
save, reset, file upload, validation) to `#form input,textarea` generically (confirmed at
`public/javascripts/traveler.js:430-742` and throughout the file) — none of it inspects which
specific sub-form an input belongs to. Rendering ACL sections inside the same `#form` container means
the existing save/validate/upload machinery and the existing `POST /travelers/:id/data/` endpoint
work for ACL fields with zero client-side JS changes, satisfying FR-010 ("captured the same way base
form field values are captured today") for free. This is architecturally different from the
discrepancy-log mechanism (a separate popup + `Log`/`discrepancyLogs` collection) deliberately: the
user asked for ACL sections to be filled in as part of normal data entry, not as a separate log flow.

**Alternatives considered**: Reusing the discrepancy-log popup/`Log`-document mechanism for ACL data
— rejected: that mechanism captures data as a separate timestamped log entry outside `traveler.data`,
which does not match "the user will input values in the ACL sections if needed" (i.e., as part of
the same work record, not a separate append-only log).

## 5. Input-name collisions across base + multiple ACL forms

**Decision**: At compose time, validate that no input `name` appears in more than one of {base form,
each attached ACL form}, rejecting the composition with a clear error if a collision is found.

**Rationale**: `model/form.js`'s pre-save hook already rejects duplicate input names *within* a
single form (`form.pre('save')`, `routes/form.js` — see `duplicated input name` error). That
guarantees uniqueness inside each individual form, but composing multiple independently-authored
forms together does not automatically guarantee uniqueness *across* them. Since `traveler.mapping` /
`labels` / `types` are flat objects keyed by input name (merged across base + all attached ACL forms
per decision #6 below), and `POST /travelers/:id/data/` saves `TravelerData` keyed by that same flat
`name`, an undetected collision would make two different fields indistinguishable in submitted data
and in progress accounting. Checking at compose time (once, by a Manager/Admin) is far cheaper than
discovering it after travelers have already been created and data submitted.

**Alternatives considered**: Namespacing ACL input names automatically (e.g., prefixing with the ACL
form's id) — rejected: would require rewriting the ACL form's HTML at compose time (fragile,
diverges from the immutable-snapshot approach) and would break the userkey-based mapping lookups
(`reqUtils`/report code) that key off the literal `name` attribute as authored.

## 6. Progress accounting (`totalInput` / `touchedInputs` / `finishedInput`) with ACL forms

**Decision**: Extend traveler initialization (`utilities/routes.js` `addBase`-equivalent logic in
`createTraveler`) to merge `mapping` / `labels` / `types` from the base form with those of every
attached ACL form into the traveler's top-level `mapping` / `labels` / `types` fields, and compute
`totalInput` from the merged `labels` size (not just the base's). Extend `resetTouched`
(`utilities/routes.js:466-505`) to check submitted data names against the merged label set (base +
all `aclForms` entries) instead of only `activeForm.labels`.

**Rationale**: `resetTouched` today only reads `doc.forms.id(doc.activeForm).labels` (or
`doc.forms[0].labels`) to decide which submitted `TravelerData` names count as "touched"
(`utilities/routes.js:481-502`). Left unmodified, values entered into ACL fields would save
successfully as `TravelerData` records (the data-submission endpoint doesn't validate names against
any label set) but would never be counted toward `finishedInput`/`totalInput` progress, silently
breaking the traveler's progress indicator and completion tracking for any traveler with attached ACL
forms. This was the one place where "capture ACL data the same way base data is captured" (FR-010)
would silently fail without an explicit code change, so it is called out here rather than left
implicit.

**Alternatives considered**: Leaving progress accounting base-only and treating ACL fields as
"extra, untracked" inputs — rejected: contradicts FR-010's requirement that ACL data is captured the
same way base data is, and would produce a visibly wrong (perpetually under 100%, or already-100%
while ACL fields are still empty) progress indicator.
