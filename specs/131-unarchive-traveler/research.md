# Research: Admin Traveler Unarchive

## D1 — Scope: the numeric lifecycle status, not the separate boolean archive lock

**Decision**: This feature touches only the numeric `status` field (0/1/1.5/2/3/4) on `Traveler`. The schema's separate `archived: Boolean` field — an independent lock the traveler's *owner* can already toggle freely in either direction via `PUT /travelers/:id/archived` — is untouched.

**Rationale**: The user's described problem ("once a traveler is archived, the traveler cannot be transfer to other status") is specifically about `status === 4`: `model/traveler.js`'s `stateTransition` array has no `{ from: 4, ... }` entry, so `lib/traveler.js#updateStatus` always 400s on any further change once a traveler reaches it. The boolean field has no such problem — it already round-trips `true`/`false` freely and has no "previous value" concept to restore, because it never needed one.

**Alternatives considered**: Also clearing the boolean lock as part of unarchiving. Rejected — the two fields are already independent today (setting one never touches the other), and conflating them would silently change the owner's own lock without being asked to. Noted as an edge case in spec.md instead.

## D2 — Admin gate: a hard role check, not the existing archive-in permission

**Decision**: Gate the new endpoint with `reqUtils.requireAdmin()` (`lib/req-utils.js`), the same hard `Admin`-role check already used by `DELETE /travelers/:id/`, rather than the `Approve_travelers` permission that today's archive-*in* transitions (`2→4`, `2→1`, `1.5→1`) use via `routesUtilities.hasPermission(req, Approve_travelers)`.

**Rationale**: The feature description says "admin user" specifically. `Approve_travelers` is a config-driven permission (`config/permission.json`) that, in the committed `docker/permission.json` dev config, is granted to the default `"user"` role — i.e., not admin-restricted in practice, despite a code comment nearby reading "only admin or manager can archive." Using the same mechanism for *un*archiving would make the feature's own admin-only requirement dependent on deployment config rather than true for every deployment, which the user's literal wording doesn't ask for.

**Alternatives considered**: Reusing `Approve_travelers` for symmetry with the archive-in gate. Rejected for the reason above. Introducing a new dedicated permission (e.g. `Unarchive_travelers`) in `config/permission.json`. Rejected as unnecessary indirection — the user asked for an admin-only action, and `reqUtils.requireAdmin()` already means exactly that, with an existing precedent in the very same route file.

## D3 — A dedicated, bodyless endpoint rather than extending the generic status route

**Decision**: `PUT /travelers/:id/unarchive` is a new, separate route in `routes/traveler.js`, backed by a new `unarchiveTraveler(req, res)` in `lib/traveler.js`. It takes no request body; the destination status is entirely server-determined.

**Rationale**: `PUT /travelers/:id/status` (`lib/traveler.js#updateStatus`) carries a web of transition-specific rules that don't apply to restoring from archive and shouldn't be re-entangled with it: the `1.5→2` block (completion only via the review flow), the NCR-gating check (`isSubmissionTransition`/`assertSubmittable`), and the `Approve_travelers` permission checks on other transitions. Folding a `{ from: 4, to: [...] }` entry into the shared `stateTransition` table would make all of that generic machinery apply to restoring from archive too, for no benefit. A dedicated function with its own single rule (admin, and currently archived) is simpler and safer. Taking no body also means the client cannot propose a wrong destination status — directly satisfying the resolved spec clarification that the system decides, not the admin.

**Alternatives considered**: Adding `{ from: 4, to: [0, 1, 2] }` to `stateTransition` and letting the client PUT the recorded status back through the existing route. Rejected — it would require the client to already know the right value (defeating "without requiring that user to know or re-enter that status manually," FR-001) and would pull in unrelated transition rules as above.

## D4 — "Previous status" is a direct field; no general status-change audit trail is added

**Decision**: Add `statusBeforeArchive: Number` directly to the `Traveler` schema (no default — absent means "not recorded"). It is set at every point that currently transitions `status` to `4`, and is the sole source `unarchiveTraveler` reads from. `Traveler` is **not** wired into `model/history.js`'s `addHistory` plugin (the generic audit-log mechanism already used by `Form`/`ReleasedForm`), and no other general change-tracking mechanism is added for traveler status.

**Rationale**: The only question this feature actually needs answered is "what status does a given archived traveler restore to" — and a single recorded value answers that completely, with no further machinery. `addHistory` would have been one way to derive that answer (each change it records is only the field's *new* value, so the status immediately before an archiving event is technically reconstructable as the second-most-recent `status`-change entry), but that's materially more code, slower, and harder to reason about than a direct field — and it would exist solely to solve a problem the direct field already solves on its own. A direct field also mirrors a pattern already on this exact schema: `archivedBy`/`archivedOn` are already set directly at archive time rather than derived from anything else. Building the general audit trail anyway, on the theory that it might have other value (who changed what, when, for every transition, forever), was considered and explicitly rejected: nothing else in this feature's scope needs it, and adding it without a concrete requirement driving it would be exactly the kind of unrequested abstraction this codebase's own conventions (and the project's general engineering practice) call for avoiding.

**Alternatives considered**: Deriving the prior status from `History` at unarchive time instead of a direct field. Rejected — more complex, with no offsetting benefit over a direct field, and still vulnerable to a gap if some future code path saves a status change without going through the plugin. Wiring `addHistory` onto `Traveler` for *every* status change (not just to derive the restore value, but as a standalone audit-trail feature) and switching every status-mutating call site in the codebase (`lib/traveler.js#updateStatus`, `routes/api.js`'s status route, and both Traveler branches of `lib/review.js`) to `saveWithHistory`. This was the original plan and is a reasonable thing to build on its own merits, but it was removed from this feature's scope at the user's explicit request after discussing that the direct field already fully satisfies the actual need — it remains a candidate for a future, separately-justified feature if an audit-trail requirement ever materializes.

## D5 — Legacy fallback: restore to Active when nothing was recorded

**Decision**: `unarchiveTraveler` computes the destination as `doc.statusBeforeArchive !== undefined ? doc.statusBeforeArchive : 1` (`1` = Active).

**Rationale**: Resolved directly with the user during spec clarification. Every traveler already archived as of this feature's release has no `statusBeforeArchive` (the field didn't exist when they were archived), so this fallback is not a rare edge case — it's the only behavior those travelers will ever get. `Active` is the safest practical guess, and because it's an ordinary status (not a dead end), an admin who restores to the wrong guess can simply change the traveler's status again afterward — the fallback never blocks a further correction.

## D6 — No new unarchive endpoint on the Basic-Auth REST API

**Decision**: `routes/api.js` gains no new route for unarchiving. The capability is web-app-only.

**Rationale**: `routes/api.js` authenticates every write with a single shared credential (`basic-auth`, checked against the constant `WRITE_API_USER`) — there is no per-user identity, and therefore no concept of "this particular caller is an admin." `reqUtils.isAdmin`/`requireAdmin` read `req.res.locals.roles`, which is populated only by the session-based web app's own middleware and is never set for API requests. Consistent with that: no existing admin-only traveler action (e.g. `DELETE /travelers/:id/`) is exposed through `routes/api.js` today either. Adding an "admin-only" API endpoint that can't actually distinguish admins from any other holder of the shared write credential would not meet FR-002, so the honest answer is not to add it. (This corrects an initial assumption made while writing spec.md, which had guessed the action would be offered through both surfaces before this asymmetry was confirmed by reading `routes/api.js` directly.)

**Alternatives considered**: Exposing it via the API gated only by `checkWritePermissions` (the existing write-credential check). Rejected — that would make it admin-equivalent-to-anyone-with-the-write-credential, not admin-only, directly contradicting FR-002.

## D7 — UI placement: one button, admin-only, one traveler at a time

**Decision**: Add a single "Unarchive" button to `views/traveler-viewer.jade` — the page every archived traveler already renders through (`routes/traveler.js`'s `redirectPreview` middleware sends `status === 4` there) — visible only when `isAdmin` (already computed globally in `views/layout.jade` from `locals.roles`, no new render-object plumbing needed) and `traveler.status === 4`. It sits alongside the existing status-4-gated "Create PDF" button. It submits `PUT /travelers/:id/unarchive` with no body, then navigates to the traveler's normal (now-editable) detail page.

**Rationale**: Matches the spec's own resolved scope (one traveler at a time; bulk left for future enhancement) and reuses an existing admin-visibility convention already established in this exact view file's layout chain, rather than introducing a new one. `views/travelers.jade`'s bulk "Archive" button pattern (`public/javascripts/lib/modal.js#archive`/`dearchive`, which PUTs a client-chosen status to the generic status route) is not reused, because D3 already ruled out a client-chosen destination status for this action.

**Alternatives considered**: A bulk "Unarchive" button on the "Archived travelers" tab in `views/travelers.jade`, mirroring `Modal.dearchive`. Rejected for this feature per the spec's own scope decision — `Modal.dearchive`'s existing behavior (reset to a fixed status, e.g. `0` for binders) is also the wrong model to copy, since it does not restore an actual previous status (noted in spec.md's Edge Cases as the contrasting precedent this feature intentionally improves on).
