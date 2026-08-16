# Phase 0 Research: NCR Originator Designate Assignment

**Feature**: `003-originator-designate` | **Spec**: [spec.md](./spec.md)

This research is grounded entirely in reading the actual running code
(`model/ncr.js`, `lib/ncr-service.js`, `routes/ncr.js`, `views/ncr-detail.jade`)
rather than assumed patterns, since this feature closes a gap the codebase
already partially anticipated.

## Decision 1: Reuse the existing `ce_cs_delegate_id` pattern, not a new mechanism

**Decision**: Model the Designate exactly the way `ce_cs_delegate_id` already
works for CE/CS — a plain string field on the `Ncr` document holding the
delegate's user id, checked alongside the primary identity (`originator_id`)
at every permission gate, rather than inventing a new delegation mechanism.

**Rationale**: `lib/ncr-service.js`'s `submitDisposition()` already contains
`if (ncr.ce_cs_id !== user.id && ncr.ce_cs_delegate_id !== user.id)` — a
working permission check for a CE/CS delegate concept — even though
`specs/001-ncr-workflow/spec.md`'s "Future Work: CE/CS Delegate Assignment"
marks that capability as deferred, and no route or service function anywhere
in the codebase ever sets `ce_cs_delegate_id` (it's permanently `undefined`
today — a check with no way to ever become true). `routes/ncr.js`'s error
message for that same check already reads "Only assigned CE/CS or Originator
Delegate can submit disposition" and `closeNcr()`'s own error message already
reads "Only the NCR Originator (or delegate) can close the NCR" — both
anticipate exactly this feature's concept, in the Originator's case almost
verbatim. Following the identical shape (a plain id field, checked with `||`
alongside the primary identity field) is the smallest, most consistent change
and gives future work on the CE/CS delegate (once its own open questions are
resolved) a matching, already-proven pattern to follow.

**Alternatives considered**:
- *A separate `Delegation` collection/subdocument with richer metadata
  (reason, expiry, accept/reject state)*: rejected — nothing in the feature
  request or the base spec's existing "Originator or designee" references
  asks for any of that, and it would be inconsistent with the CE/CS
  delegate's already-established minimal shape sitting right next to it in
  the same schema.

## Decision 2: Reuse the existing `NCR_EVENT_TYPES` entry `delegate.assigned`, add one sibling `delegate.removed`

**Decision**: Use the event type `'delegate.assigned'` (already present in
`model/ncr.js`'s `NCR_EVENT_TYPES` enum but never pushed anywhere in the
codebase) for the audit trail event when a Designate is assigned or changed,
and add a new sibling `'delegate.removed'` for removal.

**Rationale**: The enum entry's presence with zero producers anywhere in the
codebase is strong evidence it was reserved in advance for exactly this kind
of delegation-assignment event (the same design intent as the pre-wired
`ce_cs_delegate_id` permission check) — reusing it avoids a redundant,
near-duplicate event type. No corresponding "removed" type exists yet, so one
new enum value is needed to satisfy FR-007's requirement to audit-log removal
as well as assignment.

**Alternatives considered**:
- *A single `delegate.assigned` event type for both assign and remove,
  distinguished only by a `payload.action` field*: rejected — every other
  audit-significant transition in this schema (e.g. `pa.owner_assigned` vs.
  `pa.closed`, `approval.approved` vs. `approval.returned_for_comment`) uses
  a distinct `event_type` per outcome rather than a payload flag, so a
  distinct `delegate.removed` type matches the established convention.

## Decision 3: `actor_role` stays `'originator'` regardless of whether the actual actor is the Originator or their Designate

**Decision**: When a Designate performs a Designate-eligible action (closing
the NCR, the Traveler sign-off event), the event's `actor_role` field is
still recorded as `'originator'` — the same as when the Originator performs
it themselves. `actor_id`/`actor_name` always capture the real, actual
identity of whoever performed the action.

**Rationale**: This matches the existing, unconditional precedent already in
`submitDisposition()`: its `disposition.submitted` event hardcodes
`actor_role: 'ce_cs'` regardless of whether `ncr.ce_cs_id` or
`ncr.ce_cs_delegate_id` matched the caller — `actor_role` in this schema
represents the *capacity* someone acted in, not a literal role/identity
match, while `actor_id`/`actor_name` already correctly and completely
capture who actually did it (satisfying spec.md FR-011/Acceptance Scenario 6
— the Designate's own identity is what's recorded and auditable, just via
`actor_id`, not via a distinct `actor_role` value). Introducing a new
`'originator_designate'` role label here would be the only place in the
schema where capacity-vs-identity is split that way, breaking consistency
with the CE/CS precedent for no functional benefit.

**Alternatives considered**:
- *A distinct `actor_role: 'originator_designate'` value*: rejected for the
  consistency reason above; also not required by any FR — FR-011 only
  requires the *closer identity* be the Designate's own, which `actor_id`/
  `closure_record.closed_by` already satisfy without any special-casing,
  since `closeNcr()` already unconditionally uses `user.id`/`user.name` for
  both fields today.

## Decision 4: Designate selection UI reuses the existing CE/CS typeahead pattern

**Decision**: The Originator selects a Designate the same way the NCR
creation form already lets them select a CE/CS — a text input bound to the
existing `travelerGlobal.usernames` Bloodhound typeahead (prefetched from
`/adusernames`), requiring an exact `displayName` match before submission is
allowed, exactly as `views/ncr-create.jade`'s `#ce_cs_name` field already
works.

**Rationale**: This is the only user-picker pattern already proven and
already wired to live LDAP-backed user data anywhere in this codebase (`lib:
public/javascripts/usernames.js`). Introducing a second, different
user-lookup mechanism for the Designate field for no reason would add
inconsistency and maintenance surface with no benefit — the same component
already resolves a typed display name to `{uid, mail}`, which is exactly
what's needed to populate `originator_designate_id` and the notification
email address.

**Alternatives considered**:
- *A `<select>` populated from a role-scoped user list (e.g. only other
  Originators)*: rejected — the spec's own Assumptions section already
  settled this (any authenticated user is eligible), and no such role-scoped
  list mechanism exists anywhere else in the app to reuse.

## Decision 5: Permission and visibility checks are added at every point that already keys off `originator_id`, not centralized behind a new helper

**Decision**: Every existing site in `lib/ncr-service.js` that currently
checks or scopes by `ncr.originator_id` gets a parallel
`ncr.originator_designate_id` check added directly, mirroring exactly how
`ce_cs_delegate_id` already sits alongside `ce_cs_id` at its one existing
call site (`submitDisposition`), rather than introducing a new
`isOriginatorOrDesignate(ncr, user)` helper function.

**Rationale**: There are exactly four call sites, identified by reading the
full file: `closeNcr()`'s permission check (line ~511), the issuance-email
recipient lists in `submitConcurrence()` and `submitApproval()` (lines ~263,
~371), `closeNcr()`'s final-distribution recipient set (line ~583), and
`buildRoleScope()`/`getNcrById()`'s dashboard-visibility scope (lines ~631,
~715-717, the latter needing a matching manual clause since `getNcrById`
re-implements scope matching by hand against a `.lean()` document rather than
a live Mongoose query). Four call sites is small enough that a shared helper
would add a layer of indirection without meaningfully reducing duplication,
and the codebase's own precedent (`ce_cs_delegate_id`) already established
"check it inline, right next to the primary id" as the pattern for exactly
this kind of secondary-identity check.

**Alternatives considered**:
- *A shared `isOriginatorOrDesignate(ncr, userId)` helper, mirroring
  `isQaStaffMember()`*: considered, but `isQaStaffMember()` exists because
  QA-staff-membership requires an async database lookup (the `ncr-qa`
  group) reused across many call sites; an Originator/Designate check is a
  synchronous string comparison against fields already present on the `ncr`
  document already in hand at every call site, so a helper saves only a
  couple of characters, not a database round-trip — not worth the
  indirection.

## Summary of resolved Technical Context

| Field | Resolution |
|---|---|
| Language/Version | JavaScript (Node.js 18+) — unchanged, extends the existing app |
| Primary Dependencies | None new — reuses Express/Mongoose/Nodemailer and the existing `travelerGlobal.usernames` typeahead already used for CE/CS selection |
| Storage | MongoDB via Mongoose — additive fields on the existing `Ncr` schema (`model/ncr.js`); no new collection |
| Testing | `test-unit/lib/ncr-service.test.js` (Mocha/Sinon/Chai, existing file, new `describe` blocks) for unit coverage; a new spec file in `e2e/` (Playwright, reusing the fixture CLI and Mailpit client already built for `specs/002-playwright-e2e-tests`) for end-to-end coverage |
| Target Platform | Same existing web-service (Express web + API servers) |
| Project Type | Extension to the existing NCR workflow module — not a new deployable |
| Performance Goals | N/A beyond the existing NCR module's — this feature adds simple field reads/writes, no new query patterns of concern |
| Constraints | Every permission/visibility check must be enforced server-side in `lib/ncr-service.js` (never only in the view layer), consistent with the app's existing security posture |
| Scale/Scope | 2 user stories / 11 acceptance scenarios; touches `model/ncr.js`, `lib/ncr-service.js` (4 existing call sites + 1-2 new functions), `lib/ncr-email.js` (1 new notification), `routes/ncr.js` (1 new route), `views/ncr-detail.jade` (display + assignment UI) |
