# Research: Form & Traveler Metadata Fields

## Finding 1: Existing Model Fields — No Overlap

**Decision**: All six new fields (`subsystem`, `device`, `activity`, `machineArea`, `sector`, `windchillId`) are net-new additions to their respective schemas.

**Rationale**: `model/released-form.js` has no classification fields today. `model/traveler.js` has a `devices` array (plural, for device-app integration) that is semantically different from the singular `device` classification string we're adding. No renaming or migration conflict.

**Alternatives considered**: Reusing the `tags` array on either model — rejected because tags have no defined semantics and adding structured fields is cleaner and queryable.

---

## Finding 2: Form Release Flow — Body Parameters Already Pattern-Established

**Decision**: Add `subsystem`, `device`, `activity` as optional body parameters to the existing `POST /forms/:id/released` handler in `routes/form.js` (function `releaseForm`, line 1074). Assign them the same way `title` and `description` are already assigned: `releasedForm.subsystem = req.body.subsystem || ''`.

**Rationale**: The pattern `releasedForm.title = req.body.title || form.title` is already in use. The release modal in the UI already accepts title/description override. The three new fields require no change to the release workflow's state-machine logic.

**Alternatives considered**: A separate PATCH after release — rejected because capturing data at release time (the spec requirement) means it must be in the release request itself.

---

## Finding 3: Released Form Metadata Editing — New PUT Route Needed

**Decision**: Add `PUT /released-forms/:id/metadata` to `routes/form-management.js`. Use `reqUtils.isOwnerOrAdminMw('id')` for authorization (same as the existing `/status` route). Filter body to `['subsystem', 'device', 'activity']`. Persist via `saveWithHistory(req.session.userid)`.

**Rationale**: No general metadata-edit route exists for released forms today — only `/status`. Adding a separate `/metadata` route keeps the status endpoint's single-purpose contract intact and avoids conflating state transitions with metadata edits.

**Alternatives considered**: Extending the status PUT to accept metadata fields — rejected because it conflates state management with attribute editing and would require loosening the strict `['status', 'version']` filter.

---

## Finding 4: Traveler Creation Inheritance — `createTraveler` in `utilities/routes.js`

**Decision**: In `utilities/routes.js` function `createTraveler` (line 330), copy `form.subsystem`, `form.device`, `form.activity` to the new Traveler object at construction time, alongside the existing fields.

**Rationale**: All traveler creation (from `routes/traveler.js`) flows through this single utility function. Centralizing the copy here means all call sites inherit the behavior automatically.

**Alternatives considered**: Copying in each route handler — rejected because there are multiple creation paths and duplicating the logic violates the DRY principle and risks drift.

---

## Finding 5: Traveler Metadata Update — Extend Existing `/config` Route

**Decision**: Extend the existing `PUT /travelers/:id/config` route (line 1031 of `routes/traveler.js`) to also accept `machineArea`, `sector`, and `windchillId` in the body filter. The existing state guard `reqUtils.status('id', [0, 1])` needs to be extended to `[0, 1, 1.5]` to also allow updates while the traveler is submitted for review. The `isOwner || admin` check already present handles write authorization.

**Rationale**: The `/config` route is the canonical home for traveler metadata that is not form-input data. Extending it avoids creating a new endpoint for essentially the same action category.

**Alternatives considered**: A separate `/metadata` endpoint — acceptable but unnecessary given the clean fit with `/config`.

---

## Finding 6: Released Form History/Versioning Plugin

**Decision**: Add `subsystem`, `device`, `activity` to the `fieldsToWatch` array in the `addHistory` plugin call in `model/released-form.js`. Do **not** add them to `fieldsToVersion` (the version plugin).

**Rationale**: Per the constitution, `saveWithHistory` must capture all audit-relevant mutations. The `fieldsToVersion` list drives the form content versioning concept (structural changes that affect travelers); metadata like classification is not a structural change and should not bump the content version counter.

---

## Finding 7: Traveler History Plugin

**Decision**: Add `subsystem`, `device`, `activity`, `machineArea`, `sector`, `windchillId` to the Traveler schema's `addHistory` `fieldsToWatch` configuration in `model/traveler.js`.

**Rationale**: Same audit requirement as Finding 6. The traveler model already uses `saveWithHistory` for all significant mutations in the route handlers.

---

## Finding 8: UI Pattern for Inline Editing

**Decision**: For the released-form detail page, display the three classification fields as inline editable labels (similar to how `title` inline-editing is done on traveler pages). Use a hidden `<form>` with a save button that calls the new `PUT /released-forms/:id/metadata` endpoint via AJAX, restricted to visible-and-enabled only for owner/admin (rendered conditionally in Jade).

For the traveler page, extend the existing `PUT /travelers/:id/config` call that already handles title/description/deadline to also handle the three new traveler fields. The form-management JS in `released-form-management.js` gets a new section; the traveler-config JS pattern can be reused.

**Rationale**: All existing editable fields on both pages use inline AJAX editing with `$.ajax` against the JSON API routes. No new pattern needs to be introduced.

---

## Finding 9: State Guard for Traveler Metadata Updates (FR-009)

**Decision**: The current `/config` route uses `reqUtils.status('id', [0, 1])` — it only allows updates on "not started" and "in progress" travelers. To satisfy FR-009 (allow updates while submitted for review, block once approved/frozen/archived), change the allowed-statuses list to `[0, 1, 1.5]`.

**Rationale**: Traveler states per the constitution: `0`=not started, `1`=in progress, `1.5`=submitted for review, `2`=approved, `3`=frozen, `4`=archived. The spec requirement is that updates are blocked for approved/frozen/archived but allowed for all active states including submitted-for-review.

**Note**: Admin override (bypassing the state check) is already handled by the `isOwner || admin` pattern in the route body — admins can update at any state. The `reqUtils.status` guard applies to non-admin users.
