# Data Model: Guarantee Stakeholder Notification Delivery via Directory-Backed User Records

**Feature**: [spec.md](spec.md) | **Date**: 2026-10-24

No new MongoDB collection and no new or removed field on `model/ncr.js` or
`model/review.js`. This feature changes *when* a `User` document is
created, not what any document stores. The one piece of new shape is the
helper's own input/output contract, plus the one request body that gains a
field.

## `ensureUserExists({ id, name, email })` — `lib/user-directory.js`

| Aspect | Detail |
|---|---|
| Input | `id` (string, required — the directory entry's unique identifier, lower-cased the same way every existing `User._id` lookup in this codebase already does), `name` (string, the directory entry's display name), `email` (string, required *only* when no record exists yet for `id`) |
| Output | The `User` document for `id` — either the pre-existing one (untouched) or a newly-created one |
| Side effect | Creates and persists exactly one new `User` document when none existed; otherwise none |
| Error | Throws a validation error (`status: 400`) when no record exists for `id` **and** `email` is missing/empty — mirrors the `400` shape `routes/ncr.js` and `routes/review.js`-adjacent routes already return for a missing required field |
| Idempotency | Calling it twice for the same never-before-seen `id` is safe: the first call creates the record, the second finds it and returns it unchanged (FR-009) |

**Validation rules** (from FR-008/FR-009):
- A record is only ever *created*, never updated — an existing record's
  `name`/`email`/`roles`/anything else is never modified by this helper.
- Creating a record always requires a non-empty `email`; `id` and `name`
  are required because the four callers below already require them
  (CE/CS, Approver, Designate, and reviewer identity are all required
  fields on their respective requests already).

## Call sites (existing functions, each gains one call)

| Call site | File : function | Person's `{id, name, email}` source | Notes |
|---|---|---|---|
| NCR CE/CS | `lib/ncr-service.js` : `createNcr` | `data.ce_cs_id` / `data.ce_cs_name` / `data.ce_cs_email` | Only when `data.ce_cs_id` is present (it's optional on NCR creation). |
| NCR additional Approver (initial designation) | `lib/ncr-service.js` : `submitConcurrence` | each entry of `additionalApprovers[]`: `approver_id` / `approver_name` / `approver_email` | Runs once per approver in the array before `ncr.additional_approvers` is saved. |
| NCR additional Approver (added later) | `lib/ncr-service.js` : `addApprover` | `approverData.approver_id` / `.approver_name` / `.approver_email` | Same helper, single entry. |
| NCR Originator Designate | `lib/ncr-service.js` : `assignDesignate` | `designateData.designate_id` / `.designate_name` / `.designate_email` | Already-required fields on this request; no behavior change to the request's own validation. |
| Form reviewer | `lib/review.js` : `addReviewRequest` | `req.body.uid` / `req.body.name` / `req.body.email` (new field, see Contracts) | Replaces the current hard `400` refusal when no `User` record exists; the existing review-permission check still runs immediately after. |

**Not a call site** (explicitly out of scope, per spec Assumptions):
- NCR Originator (`createNcr`'s own `user` parameter) — always the
  logged-in session identity; a `User` record is guaranteed by the login
  flow itself.
- NCR Preventive Action Owner (`assignPaOwner`) — entered as free text, not
  resolved from the directory lookup; there is no directory identity for
  `ensureUserExists` to provision from.
- NCR QA Staff — resolved through `ncr-qa` Group membership, which already
  requires a `User` reference.
- Traveler `manPower` / Form `createdBy` — session-derived, not
  typeahead-sourced; the person is, by construction, already logged in.

## Request body change

| Endpoint | Field added | Required? | Notes |
|---|---|---|---|
| `POST /forms/:id/review/requests` | `email` | No (absence preserves today's exact behavior for that one request — `ensureUserExists` then refuses only if no `User` record exists *and* no email was given, same as today's outright refusal, just with the accurate reason) | Populated client-side in `public/javascripts/review.js` from `userSelected.mail` (already present in the Bloodhound AD cache; previously resolved but never sent). |

## `closeNcr` final-distribution fix (no model/contract change)

`lib/ncr-service.js#closeNcr` currently collects `ce_cs_id`,
`qa_staff_identity`, every `additional_approvers[].approver_id`, and every
`preventive_actions[].owner_id` into one id set and resolves all of them
through a single `findUsers()` call — discarding any email already
captured and stored on the document itself. Once CE/CS and Approver are
provisioned at add-time (above), that id-based lookup becomes reliable for
them. Preventive Action Owner is not provisioned by this feature (no
directory identity exists for it — see Assumptions), so FR-004's
requirement that a never-logged-in PA owner still receives the final
distribution email is met a different way: `closeNcr`'s email list is
changed to also include each PA owner's already-stored `owner_email`
directly, alongside (not replacing) the existing id-based resolution.
No model field changes — `owner_email` already exists and is already
populated by `assignPaOwner`; this only stops `closeNcr` from throwing it
away. See `research.md` R5.

## Defensive fix (no model/contract change)

`routes/form.js:1094-1097` — resolving each `reviewRequest._id` to a `User`
document for the "New Review Request" notification currently assumes every
id resolves; a request added before this feature shipped (or by any other
means) that has no matching `User` document throws a `TypeError` on
`.email`. This feature filters out an unresolved reviewer instead of
throwing, matching how a missing email is already handled elsewhere in
this codebase (quietly excluded from the recipient list, not a hard
failure) — see `research.md` R5.
