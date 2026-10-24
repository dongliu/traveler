# Research: Guarantee Stakeholder Notification Delivery via Directory-Backed User Records

**Feature**: [spec.md](spec.md) | **Date**: 2026-10-24

All items below are resolved against the existing codebase, not a new
dependency. The full current-state inventory this research is based on
covered every AD-typeahead add site and every id-based `User` lookup for
notification across `model/ncr.js`, `model/review.js`, `model/traveler.js`,
`model/form.js`, and `model/binder.js`/`model/share.js`.

## R1 — Provision from the client-supplied directory fields; no second AD lookup; the Originator needs no call at all

**Decision**: `ensureUserExists({id, name, email})` is called with the
`{id, name, email}` the client already sent on the request — the same
values `lib/ncr-service.js` already trusts as-is for `approver_email` and
`originator_designate_email` (see the existing comments at
`lib/ncr-service.js` explaining "the approver has no local User record —
e.g. they've never logged into the app — so `findUsers`... returns
nothing; `approver_name` must still come from the submitted payload").
There is no second, server-side LDAP re-resolution.

The NCR Originator is the one role that needs no call at all:
`createNcr`'s `user` parameter is always the current session's own
identity, and a session cannot exist for someone without a `User` record
(`lib/auth/ldap.js` creates one on first login). The Originator's
reachability was never actually broken by the "never logged in" failure
mode — only CE/CS, additional Approvers, and the Originator Designate can
be *named* by someone else without ever having logged in themselves.

**Rationale**: FR-001. Re-querying AD a second time at add-time would be
slower, redundant (the exact same lookup already happened client-side
seconds earlier to populate the typeahead), and inconsistent with the
pattern this codebase already uses for every other NCR stakeholder field.

**Alternative considered**: Reuse `lib/share.js#addUserFromAD`'s shape,
which does re-run an LDAP search by name server-side before creating the
record. Rejected for NCR/Review: that module's callers (`addUser`) only
have a bare `name` to go on and no previously-resolved id/email, so a
server-side AD search is the only option available to *them*. NCR and
Review routes already receive the fully-resolved `{id, name, email}`
up front; re-deriving it from AD a second time would be strictly worse
than just using what's already been sent.

## R2 — One shared helper, not four inline blocks

**Decision**: A single new module, `lib/user-directory.js`, exports
`ensureUserExists({id, name, email})`:
1. `User.findById(id)` — if found, return it unchanged (FR-009).
2. If not found and `email` is missing/empty, throw a validation error
   (FR-008) with the same shape `routes/*.js`'s existing `400` validation
   errors use.
3. If not found and `email` is present, `new User({_id: id, name, email}).save()`
   and return the new document.

**Rationale**: FR-001/FR-006. The same three-step shape is needed at four
call sites across two files (`lib/ncr-service.js`'s CE/CS, Approver, and
Originator Designate adds; `lib/review.js`'s reviewer add). A shared helper
means the "don't overwrite an existing record" and "reject a missing email"
rules are enforced once, not reimplemented — and tested once.

**Alternative considered**: Extend `lib/share.js#addUserFromAD`'s create
step in place. Rejected: that function is tightly coupled to its own
LDAP-search-then-save flow and to the specific `doc.sharedWith`/
`user.forms/travelers/binders` bookkeeping Share performs — none of which
applies to an NCR stakeholder or a Form reviewer. A new, smaller, purpose-built
helper is simpler than carving a reusable piece out of `addUserFromAD`.

## R3 — Review's permission check is untouched; only the "no record exists" refusal is removed

**Decision**: `lib/review.js#addReviewRequest` currently does
`User.findById(uid.toLowerCase())` and, when that's `null`, refuses the
add outright (400: "please add user id ... A user is added when s/he logs
in for the first time."). That hard refusal is replaced with a call to
`ensureUserExists({id: uid, name, email})`. Every line of code after that
point — in particular, `const roles = [...reviewer.roles, ...config.auth.default_roles]`
and the subsequent `permissions.includes(Review_forms)` check — is
unchanged.

**Rationale**: FR-006/FR-007, and the Constraints' explicit requirement
not to weaken authorization. A brand-new `User` record created by
`ensureUserExists` has `roles: []`, exactly like the record the login flow
itself would create for that same person (`lib/auth/ldap.js`). The merge
with `config.auth.default_roles` that already happens in `addReviewRequest`
treats a freshly-provisioned reviewer exactly as it would treat someone who
had logged in one second earlier — if they still lack review permission,
they still get refused, just with the *true* reason ("needs permission to
review") instead of today's misleading one ("ask an admin to have them log
in first", which was never actually the real blocker — permission was).
This is a strict improvement to the error message's accuracy, not a
loosening of the check itself.

## R4 — The one path worth an e2e test

**Decision**: Every other acceptance scenario in the spec is reachable and
verifiable through a unit test against `lib/ncr-service.js`/`lib/review.js`
functions directly (stubbing `User.findById`/`.save()`), since none of
them depend on rendered DOM or a live LDAP server. The one exception is the
Form reviewer-add flow's client-side email capture
(`public/javascripts/review.js`): there is no unit-test equivalent for
client script in this codebase's Mocha setup (no DOM), the same gap
already documented for `public/javascripts/lib/live-refresh.js` in spec
125 and the print page's client script in spec 126. A new Playwright
scenario drives the actual click-to-add flow for a person with no `User`
record and asserts the add succeeds (instead of being refused) and the
request carries an email.

**Rationale**: Constitution I ("E2E recommended for critical user
journeys") and consistency with how this codebase already treats
client-script-only logic.

## R5 — `closeNcr`'s final distribution: prefer an already-stored email over an id-only lookup, for Preventive Action owners specifically

**Decision**: `lib/ncr-service.js#closeNcr` builds one `recipientIds` set (CE/CS,
QA staff, every `additional_approvers[].approver_id`, every
`preventive_actions[].owner_id` — Originator and Originator Designate are
resolved the same way) and resolves every id in it through a single
`findUsers()` call, discarding any email that was already captured and
stored on the document itself (`approver_email`, `owner_email`). For CE/CS
and the Originator Designate, R1-R2's provisioning at add-time is what
makes this id-based lookup reliable (FR-003/FR-004) — there's nothing
stored to prefer instead, for CE/CS in particular, since `ce_cs_email` was
never persisted to begin with. Preventive Action Owner is different: it is
explicitly *not* provisioned by this feature (it's free text, not a
directory identity — see spec Assumptions), yet FR-004 still requires a
never-logged-in PA owner to receive the final distribution email. Since
`preventive_actions[].owner_email` is already captured and stored at
assignment time, `closeNcr`'s email list is changed to include each PA
owner's stored `owner_email` directly, in addition to (not instead of) the
existing id-based resolution — so an owner with no local `User` record is
no longer silently dropped, with no provisioning and no schema change
required for this one field.

**Rationale**: FR-004's explicit inclusion of Preventive Action Owner.
This is a narrower, independent fix from `ensureUserExists` — it corrects
`closeNcr`'s own carelessness (discarding data it already has), rather
than adding a new guarantee that an identity exists. It generalizes the
same fix spec 003 already made for the Originator Designate in
`removeDesignate` (prefer the NCR's own stored email over a `User` lookup
when the person may never have logged in) to this one remaining place it
wasn't yet applied.

**Alternative considered**: Mark FR-004's Preventive Action Owner
guarantee as a known gap and drop it from scope entirely, matching PA
Owner's exclusion everywhere else in this feature. Rejected: the email is
already sitting on the document, so leaving the gap open would be a
strictly worse outcome than this feature's own title promises
("deliver the emails correctly") for a fix this cheap and this low-risk.

## R6 — Defensive fix alongside, not instead of, the root cause

**Decision**: `routes/form.js` (around the point where a Form moves to
status 0.5 / submitted for review) maps every `reviewRequest._id` through
`User.findOne({_id: ...})` and immediately reads `.email` off the result
with no null check — a live `TypeError` crash today for any review request
that predates a `User` record existing for that reviewer (e.g., one added
by direct document manipulation, or one left over from before this
feature shipped). This feature adds the straightforward null-guard
(skip an unresolved reviewer rather than throw) at that one spot, in the
same change that fixes the root cause going forward.

**Rationale**: It is the same reliability problem this feature exists to
fix — a reviewer with no local `User` record — surfacing as a crash
instead of a silently dropped notification. Since this feature's core
guarantee (FR-006) only applies to review requests added *after* it ships
(per the spec's Assumptions: no retroactive backfill), the pre-existing
crash risk for older review requests would otherwise remain even after
this feature lands. Fixing it is a one-line, low-risk addition directly in
scope of "every notification tied to a reviewer added this way must not
fail the surrounding request."
