# Contract: Compose a Released Form from Existing Released Forms

All endpoints below belong to the session-authenticated **web app** server only (see CLAUDE.md "Two
Express instances"); none are added to `routes/api.js`, matching how the existing discrepancy
feature has no REST API surface. All routes require `auth.ensureAuthenticated`.

## `POST /released-forms/:id/compose`

New endpoint. `:id` is the `ReleasedForm._id` of the **base** form (must be `formType: 'normal'`,
`status: 1`). Performs the compose action described in spec FR-002 through FR-008.

**Authorization**: `auth.requireRoles` gated to Manager or Admin (see `research.md` §"Permission" and
`plan.md` Constitution Check §II) — reuses the existing `role.js` constants (`Manager`, `Admin`).

**Request body**:

```json
{
  "title": "optional override; defaults to the base form's title",
  "aclFormIds": ["<ReleasedForm._id>", "<ReleasedForm._id>", "..."]
}
```

`aclFormIds` may be omitted or empty (base-form-only composition, per FR-007).

**Validation (in order, mirroring the existing `/forms/:id/released` middleware chain style)**:

1. `:id` must resolve to an existing `ReleasedForm` (`reqUtils.exist`).
2. That `ReleasedForm` must have `formType === 'normal'` and `status === 1` — otherwise `400`.
3. Each id in `aclFormIds` must resolve to an existing `ReleasedForm` with `formType === 'ACL'` and
   `status === 1` — otherwise `400` naming the offending id (mirrors the existing discrepancy-form
   type/status check at `routes/form.js:1050-1072`).
4. `aclFormIds` must not contain duplicates, and must not contain `:id` itself — otherwise `400`
   (spec Edge Cases: self-reference and duplicate-selection rejection).
5. Input `name` attributes across the base form's `html` and every selected ACL form's `html` must be
   disjoint (`research.md` §5) — otherwise `400` naming the colliding input name.
6. Compute `compositionKey = "<baseFormId>"` or `"<baseFormId>:<sortedAclFormId1>,..."`
   (`research.md` §1) — using the *underlying draft form ids* (`base.base._id`, each `f.base._id`),
   not the released-form ids `:id`/`aclFormIds` themselves, so composing the same forms again after a
   newer release of any of them still collides with the existing active composition — and check
   `ReleasedForm.findOne({ title, formType: 'normal_acl', compositionKey, status: 1 })` — if found,
   `400` "A form with the same title and composition was already released in `<existingId>`." (mirrors
   the existing duplicate message at `routes/form.js:1105-1111`; the "prior compositions" step below
   is how a caller clears this by archiving the old one first). Separately compute the human-readable
   `ver = "base: <baseVer>[, acl: <aclVer1>, <aclVer2>, ...]"` (ACL versions in placement order) — this
   is for display only and is never used for the duplicate check.

**On success**: creates a new `ReleasedForm` with `formType: 'normal_acl'`, `base` copied from the
selected base's own `base` field, `aclForms` copied from each selected ACL's own `base` field, saved
via `saveWithHistory(req.session.userid)` (Constitution's audit-relevant mutation rule). Responds
`201` with `{ "location": "<url to the new released form>" }`, mirroring the existing
`/forms/:id/released` and `/released-forms/:id/clone` response shape.

**Errors**: `400` for any validation failure above (message identifies which check failed); `403` if
the caller lacks Manager/Admin; `500` on unexpected persistence failure.

## `GET /released-forms/acl/json`

New endpoint, mirrors the existing `GET /released-forms/discrepancy/json`
(`routes/form-management.js:207-220`) exactly, filtered to `status: 1, formType: 'ACL'`, projecting
`title formType status tags _v releasedOn releasedBy`. Used to populate the ACL multi-select picker
table in the compose UI (DataTables `sAjaxSource`, same as the existing discrepancy/prior-versions
pickers in `form-builder.js`).

`GET /released-forms/normal/json` (already exists, `routes/form-management.js:188-205`) is reused
unmodified to populate the base-form picker — no change needed there.

## `GET /released-forms/:id/compositions/json`

New endpoint. `:id` is the base `ReleasedForm._id` (the same one used for the compose page/action).
Returns every existing `ReleasedForm` with `formType: 'normal_acl'`, `status: 1`, whose own `base._id`
matches the current base's `base.base._id` — i.e., every other still-active composition built from the
same underlying base form template, regardless of title or ACL set. Used to populate a "choose prior
composition(s) to archive" picker on the compose page, mirroring the "choose prior version(s) to
archive" step in `form-builder.js`'s `#release` handler (`public/javascripts/form-builder.js:1607`),
which does the analogous thing for the standard release path via `GET /forms/:id/released/json`
(`routes/form.js:431-452`, matched by `base._id` against the draft form).

The compose page's client JS defaults every row in this picker to selected (mirroring
`fnSelectAll(priorVersionsTable, 'row-selected', 'select-row', true)` in `form-builder.js`), and on
Compose, archives whatever remains selected via the existing `PUT /released-forms/:id/status`
(`{ status: 2, version: <its ver> }`) for each — the same mechanism `form-builder.js`'s
`archive_prior_released_forms` already uses — before submitting the compose request itself. Archiving
a given prior composition is still subject to the existing `isOwnerOrAdminMw` check on that endpoint;
a failure there surfaces as an inline error message and does not block the new composition from being
created.

## `GET /released-forms/:id/` (existing route, extended render data)

`routes/form-management.js:80-100` already renders `released-form` with `base`/`discrepancy`/etc.
Extend the render object to also pass `aclForms: releasedForm.aclForms` so `views/released-form.jade`
can display each attached ACL form's title/version and HTML (spec FR-012, User Story 4). No change to
the route's URL, method, or existing fields.

## `POST /forms/` (existing route, no contract change)

Already accepts arbitrary `formType` values via `reqUtils.filter('body', [..., 'formType'])`
(`routes/form.js:843-880`); the only formType-specific branch is the existing admin-only gate for
`formType === 'discrepancy'`. Creating a `formType: 'ACL'` draft form requires no route change —
authoring/review/release of a standalone ACL form reuses this endpoint and the existing
`/forms/:id/status` and `/forms/:id/released` endpoints unmodified, exactly as `'discrepancy'` forms
do today.

## Traveler creation (existing internal call, extended)

`utilities/routes.js`'s `createTraveler(form, ...)` currently rejects any `form.formType` other than
`'normal'`/`'normal_discrepancy'` (`utilities/routes.js:307-317`). Extend the allow-list to include
`'normal_acl'`, and extend the traveler-population logic (`addBase`, plus a new `addAclForms`
following the same shape) to push every entry of `form.aclForms` into the new `traveler.aclForms`
field and merge `mapping`/`labels`/`types`/`totalInput` per `data-model.md`. No change to the calling
routes (`routes/traveler.js`'s traveler-creation endpoint) beyond what `createTraveler` already does
internally.
