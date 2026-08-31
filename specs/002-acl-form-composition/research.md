# Phase 0 Research: ACL Form Composition on Release

All items below were open technical questions after the spec was finalized (the spec deliberately
stays at the outcome level; this document resolves *how*). None remain as `NEEDS CLARIFICATION` —
each has a decision, rationale, and rejected alternatives.

## 1. Version identifier / duplicate-detection scheme

**Decision**: Split display from duplicate detection into two separate fields, since a single string
cannot serve both well:

- `ver` — a **human-readable display string** built from version *numbers*, in the placement order
  the user composed them in:

  ```text
  ver = "base: <baseVer>"                                    // zero ACL forms
  ver = "base: <baseVer>, acl: <aclVer1>, <aclVer2>, ..."     // one or more, in placement order
  ```

- `compositionKey` — a separate, **not displayed**, deterministic string built from the **underlying
  draft form ids** (not the released-form ids) of the base and each selected ACL form, used only for
  duplicate detection:

  ```text
  compositionKey = "<baseFormId>"                                // zero ACL forms
  compositionKey = "<baseFormId>:<aclFormId1>,<aclFormId2>,...>" // ids sorted ascending
  ```

  Each id here is `formContent._id` (`base.base._id` for the base, `f.base._id` for each ACL form) —
  the embedded snapshot's own id, which `new FormContent(form)` sets to the *original draft `Form`
  document's* stable id at release time (see `formContent.js` model), not `base._id`/`f._id` (the
  specific `ReleasedForm` document picked, which is different every time that draft form is released
  again).

The duplicate check becomes `ReleasedForm.findOne({ title, formType, compositionKey, status: 1 })` —
the same shape as the existing check (today at `routes/form.js:1096-1103`), just pointed at
`compositionKey` instead of `ver`.

**Rationale**: The first version of this decision used *released-form* ids for the id-based scheme,
which produced raw ObjectId strings directly in `ver` — unreadable to a human trying to understand
what version of what was released (e.g., `5f2a1c...:64b7e2...,9c0f31...`). Splitting `ver` (human,
version-number-based) from `compositionKey` (id-based, hidden) fixed the readability problem — but
switching `compositionKey` from released-form ids to the underlying *draft form* ids was a second,
separate correction, needed for a different reason: released-form ids are minted fresh every time a
draft form is released again, so composing the exact same base and ACL *forms* a second time — after
either got a new release — would never collide with the earlier composition, silently leaving two
active compositions of the same form set around at once. Keying on the draft form ids instead means
composing the same forms again is *always* treated as a duplicate of the still-active prior
composition, regardless of which version of each was picked — which is the behavior actually wanted,
and is exactly why composing now offers a "prior compositions of this base" step to archive the old
one first (mirroring how the standard release flow offers to archive prior versions of a draft form):
archiving flips its `status` away from `1`, so it drops out of the `status: 1` duplicate lookup and a
new composition of the same forms can proceed. Listing ACL versions in placement (not sorted) order in
`ver` also makes the display match what the user actually composed, which sorted ids alone could never
do (order is deliberately discarded in `compositionKey` to keep duplicate detection reliable).

**Alternatives considered**:
- *`compositionKey` keyed on released-form ids* (an earlier version of this decision) — rejected: lets
  the same base/ACL form set accumulate multiple simultaneously-active compositions across re-releases,
  with nothing forcing the "prior compositions" archive step to actually matter.
- *Single id-based string doing both jobs* (`ver` itself id-based) — rejected on human-readability
  grounds, per above.
- *Single version-number string doing both jobs* (`base: 3, acl: 1, 2` used for duplicate detection
  too) — rejected: reintroduces the exact ambiguity that made the original `base_v[:discrepancy_v]`
  concatenation scheme unworkable for a variable-length ACL set, which is what motivated this whole
  decision in the first place.
- *Short hash of the sorted id set* for `compositionKey` (`base:H(sortedIds)`) — rejected: adds a
  hashing dependency/step for no benefit over just joining the ids directly (ObjectId hex strings are
  already short and stable); direct id concatenation is also easier to eyeball during debugging/audit.

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
