# Implementation Plan: Guarantee Stakeholder Notification Delivery via Directory-Backed User Records

**Branch**: `127-upsert-user-on-stakeholder-add` | **Date**: 2026-10-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/127-upsert-user-on-stakeholder-add/spec.md`

## Summary

NCR stakeholder roles resolved from the AD typeahead (CE/CS, additional
Approver, Originator Designate) already receive `{id, name, email}` from the
client at the moment they're added, but the application only persists that
email for some roles (Approver, Originator Designate) and never for others
(CE/CS). Every later notification that isn't sent inline at add-time instead
re-resolves the person by id through the local `User` collection — so anyone
who has never logged in silently drops off NCR Issuance and Final
Distribution. The fix is not to persist more emails on the NCR; it's to
guarantee, at the moment someone is added from the typeahead, that a local
`User` record exists for them — created from the already-resolved directory
data if one doesn't exist yet. Once that's true, every existing id-based
`User` lookup already in `lib/ncr-service.js` and `lib/review.js` becomes
reliable on its own, with no change to how notifications are sent. A new
shared helper, `lib/user-directory.js#ensureUserExists`, is called at each
of the four places a person is added from the typeahead (NCR CE/CS, NCR
additional Approver, NCR Originator Designate, and a Form's review
request), plus one line of client script so the Form reviewer-add flow —
which today sends no email at all — gains access to the email the
Bloodhound directory cache already has. No schema changes, no new
endpoints, no change to how or when any notification is sent.

## Technical Context

**Language/Version**: JavaScript, Node.js 18+ (unchanged)

**Primary Dependencies**: Express 4, Mongoose 7, jQuery + Bloodhound
(`public/javascripts/usernames.js`) on the client. No new dependency.

**Storage**: MongoDB via Mongoose. No schema change, no new collection, no
new field on `model/ncr.js` or `model/review.js` — this feature changes
*when* a `User` document is created, not what any document stores.

**Testing**: Mocha unit tests in `test-unit/` (`npm run unit`) for the new
`lib/user-directory.js#ensureUserExists` helper and for each call site
(`createNcr`, `assignDesignate`, `submitConcurrence`, `addApprover`,
`addReviewRequest`) gaining coverage for the "person has never logged in"
path. A Playwright e2e scenario in `e2e/` exercises the one path that can't
be verified any other way: a Form reviewer-add from the typeahead, for a
person with no prior `User` record, now succeeding end to end (client email
capture → server provisioning → permission check) instead of being refused.

**Target Platform**: Browser (existing NCR and Form review pages), reached
through the existing session-authenticated web app and the existing
Basic-Auth REST API (`POST /api/ncrs`, `PATCH /api/ncrs/:id/*`) — both
already call the same `lib/ncr-service.js` functions this feature touches.

**Project Type**: Web application (server-rendered Pug/Jade pages with
jQuery client code), extending the existing single-repository layout.

**Performance Goals**: One extra `User.findById` (and, rarely, one extra
`.save()`) per typeahead-sourced stakeholder add — bounded by a single
document lookup, no new query pattern, no change to any notification-send
path's cost.

**Constraints**: Must not change who receives any existing notification or
when it is sent (FR-003/FR-004/FR-007) — only whether the underlying `User`
lookup that notification already depends on can find the person. Must not
weaken the existing review-permission check in `lib/review.js#addReviewRequest`
(FR-006) — a newly-provisioned reviewer still needs the same role-based
permission any other reviewer needs; this feature only removes the
precondition that they must have logged in *before* being added. Must not
overwrite an existing `User` record's fields (FR-009). Must reject the add
when the directory entry has no email (FR-008), the same way a required
field is rejected today.

**Scale/Scope**: Four add-sites in two files (`lib/ncr-service.js`,
`lib/review.js`) call one new shared helper; one small client-side addition
(`public/javascripts/review.js`) to carry an email that is already resolved
client-side but currently dropped before it reaches the server. Preventive
Action Owner, QA Staff, and session-derived identities (e.g. a Traveler's
`manPower`) are explicitly out of scope per the spec's Assumptions.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Checked against `.specify/memory/constitution.md` v1.1.0.

| Principle | Status | How this plan meets it |
|---|---|---|
| I. Automated Testing | Pass | Unit tests for the new `ensureUserExists` helper (creates when missing, leaves an existing record untouched, rejects a missing email) and for each of the four call sites, each with a "stakeholder has never logged in" regression case. The one path only verifiable end-to-end (a Form reviewer-add via the typeahead, for a brand-new person, now succeeding) gets a new Playwright e2e scenario (research.md R4). |
| II. Code Quality and Consistency | Pass | One new, small, pure-ish library module (`lib/user-directory.js`) holding the one piece of shared logic, instead of four near-duplicate "find-or-create" blocks inlined into `lib/ncr-service.js` and `lib/review.js`. No logic is duplicated between NCR and Review call sites. |
| III. Security-First Architecture | Pass | A directory entry with no email is rejected the same way a missing required field already is (FR-008) — no record is ever created with an undeliverable address. The existing review-permission check in `addReviewRequest` is untouched and still runs after provisioning (research.md R3) — this feature removes an availability gap, not an authorization check. An already-existing `User` record is never overwritten (FR-009), so this can't be used to silently change someone's stored name/email/roles. |
| IV. Versioning & Breaking Changes | Pass | Additive and backward-compatible: no endpoint's request or response shape changes except that the Form review-request body gains one new, optional-on-the-wire `email` field (ignored by any older client that doesn't send it, in which case today's existing permission/availability behavior for that one person is unchanged). No field is removed from `model/ncr.js` or `model/review.js`. |
| V. Documentation | Pass | `contracts/user-directory.json` documents the new helper's contract and the one changed request body. CLAUDE.md gets a 127 "Recent Changes" entry once implemented. |

**Gate result**: PASS. No violations; Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/127-upsert-user-on-stakeholder-add/
├── spec.md
├── plan.md                      # this file
├── research.md                  # Phase 0 decisions R1-R5
├── data-model.md                # Phase 1: the one new helper + its four call sites
├── contracts/
│   └── user-directory.json      # ensureUserExists contract + the one changed request body
├── checklists/requirements.md
└── tasks.md                     # created by /speckit.tasks
```

### Source Code (repository root)

```text
lib/
├── user-directory.js            # NEW: ensureUserExists({id, name, email}) -> User doc
│                                   # find by _id; create-if-missing from the given directory
│                                   # fields; leave an existing record untouched; reject when
│                                   # the record would need creating but has no email
├── ncr-service.js                # createNcr(): ensureUserExists for CE/CS (data.ce_cs_id/_name/_email)
│                                   #   when ce_cs_id is present — Originator needs no call, they are
│                                   #   always the logged-in session user (research.md R1)
│                                   # assignDesignate(): ensureUserExists for the incoming Designate
│                                   #   (designateData.designate_id/_name/_email)
│                                   # submitConcurrence(): ensureUserExists for each entry in
│                                   #   additional_approvers before it's saved
│                                   # addApprover(): ensureUserExists for the one approver being added
└── review.js                     # addReviewRequest(): replaces the hard "please add user id ..."
                                    #   400 with ensureUserExists({id: uid, name, email}), then runs
                                    #   the SAME existing permission check as before (research.md R3)

routes/
└── form.js                       # line ~1094-1097 defensive fix: skip (don't throw) when a
                                    #   resolved reviewer has no local User doc, for review
                                    #   requests that predate this feature (research.md R5)

public/javascripts/
└── review.js                     # $('#add').on('click', ...): adds `data.email = userSelected.mail`
                                    #   before the existing addTo(data, reviewTable, 'users') call —
                                    #   the Bloodhound cache already has .mail, it was just never sent

test-unit/lib/
├── user-directory.test.js        # NEW: ensureUserExists unit tests
├── ncr-service.test.js            # + "never logged in" coverage at the four NCR call sites
└── review.test.js                 # + "never logged in" coverage for addReviewRequest, if this
                                     #   file exists already, else a new test-unit/lib/review.test.js

e2e/
└── us-review-request-new-user.spec.js   # NEW: add a never-logged-in person as a Form reviewer
                                           #   via the typeahead; the add succeeds and they can be
                                           #   notified
```

**Structure Decision**: Extend the existing web-app layout; no new
top-level directory. One new, small library module holds the one piece of
genuinely shared logic; every call site is a one- or two-line addition to a
function that already exists, immediately before or alongside the point
where that function already persists the person's id/name (and, where
applicable, email). No new routes, no new views, no schema migration.

## Phase 0 and Phase 1 outputs

- [research.md](research.md): decisions R1-R5.
- [data-model.md](data-model.md): the new `ensureUserExists` helper and its
  four call sites, plus the one changed request body.
- [contracts/](contracts/): `ensureUserExists`'s contract and the Form
  review-request body change.
- [quickstart.md](quickstart.md): how to verify by hand and by test.

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified

*(none — Constitution Check passed with no violations)*
