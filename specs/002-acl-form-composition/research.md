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

- `compositionKey` — a separate, **not displayed**, deterministic string built from the **source
  released-form ids** the user selected, used only for duplicate detection:

  ```text
  compositionKey = "<baseReleasedFormId>"                                // zero ACL forms
  compositionKey = "<baseReleasedFormId>:<aclId1>,<aclId2>,...,<aclIdN>" // ids sorted ascending
  ```

The duplicate check becomes `ReleasedForm.findOne({ title, formType, compositionKey, status: 1 })` —
the same shape as the existing check (today at `routes/form.js:1096-1103`), just pointed at
`compositionKey` instead of `ver`.

**Rationale**: The first version of this decision used the id-based scheme for `ver` itself, since a
source released-form id uniquely identifies *both* "which form" and "which version of it." That
correctly solved duplicate detection, but produced raw ObjectId strings on the released-form detail
page (e.g., `5f2a1c...:64b7e2...,9c0f31...`) — unreadable to a human trying to understand what version
of what was released. Switching `ver` to human version numbers directly reintroduces the *original*
ambiguity this whole scheme exists to avoid: two different ACL forms can validly share the same
version number (e.g., two different forms both at their own "v1"), so a version-number-only string
cannot always tell two different compositions apart. Rather than accept that ambiguity or keep the
unreadable id string, splitting the two concerns keeps both intact: `ver` is now genuinely readable to
a human ("base: 3, acl: 1, 2"), while `compositionKey` keeps the original id-based guarantees —
order-independent, and never collides two different ACL combinations, even when their version numbers
happen to coincide — entirely out of the user's sight. Listing ACL versions in placement (not sorted)
order in `ver` also makes the display match what the user actually composed, which sorted ids alone
could never do (order was deliberately discarded there to keep duplicate detection reliable).

**Alternatives considered**:
- *Single id-based string doing both jobs* (the original decision) — rejected on human-readability
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
