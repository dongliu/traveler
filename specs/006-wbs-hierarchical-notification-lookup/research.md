# Research: WBS Hierarchical Notification Lookup

**Date**: 2026-08-22

No external research required — every decision below is resolved by reading
the existing codebase's own notification pipeline and the 005 registry it
extends.

---

## Decision 1: Ancestor-walk algorithm and query shape

**Decision**: Build the candidate list by repeatedly trimming the last
`.`-delimited segment off the WBS number — `candidates[0]` is the number
itself (exact match), `candidates[1]` is its immediate parent, and so on up
to the root single segment. Issue one `WbsNotification.find({ wbs_number: {
$in: candidates } })` query, then in application code return the first
candidate (in nearest-to-farthest order) that has a match.

**Rationale**: A single query against `$in` is cheap regardless of how many
ancestor levels exist (bounded by the WBS number's own segment count, which
is small), and avoids N sequential round-trips walking the hierarchy one
level at a time. MongoDB's `$in` does not preserve result ordering by input
array position, so the "nearest wins" rule is enforced in application code
by iterating `candidates` in the known nearest-to-farthest order and
returning on the first hit — not by trusting query result order.

**Alternatives considered**:
- Sequential per-level queries (query exact, if empty query parent, ...)
  until a hit or exhausted — rejected: more round-trips for no benefit,
  since the registry is small enough that fetching all candidate matches at
  once is trivially cheap (see 005's plan.md Scale/Scope: tens to low
  hundreds of entries).
- A MongoDB aggregation with `$expr`/regex prefix matching (e.g. "any
  registry entry whose `wbs_number` is a case-sensitive prefix of the NCR's
  WBS number, followed by a `.` or end-of-string") — rejected as
  unnecessary complexity; the `$in`-over-explicit-candidates approach is
  simpler, easier to unit test exhaustively, and just as correct given the
  small candidate-list size.

---

## Decision 2: Where the resolved contact is threaded into the two notification emails

**Decision**: `sendInitialNotification`/`sendFinalDistribution` in
`lib/ncr-email.js` are unchanged. `createNcr()`/`closeNcr()` in
`lib/ncr-service.js` each independently call
`resolveWbsContact(ncr.wbs_number)` and, if a match is found, append its
`notification_email` to the flat recipient-email array each function
already builds before calling `sendInitialNotification`/`sendFinalDistribution`.

**Rationale**: Both send functions already accept `recipients` as a flat
`string | string[]` and send one email to everyone on it (per
`sendToRecipients`'s existing "not one email per recipient" design) — the
resolved contact is just one more address on that same list. This requires
zero changes to `lib/ncr-email.js`, and the per-recipient event logging
(`appendNotificationEvent`) already iterates whatever `results` come back
from `sendToRecipients`, so the resolved contact's delivery status is
recorded automatically, with no changes needed there either (satisfies
FR-005 for free).

**Alternatives considered**:
- Add a dedicated `cognizantContact` parameter to
  `sendInitialNotification`/`sendFinalDistribution` — rejected; would
  require a signature change to functions with existing callers/tests, for
  no behavioral benefit over just appending to the existing list, since
  neither email template distinguishes recipients by role in its body text.
- A brand-new `sendCognizantNotification()` function sending a second,
  separate email — rejected; `specs/emails.md` templates 2 and 7 already
  describe ONE email with Cognizant GL/Director as additional TO
  recipients, not a separate email.

---

## Decision 3: Communicating the no-match warning to the client without changing `createNcr()`'s return contract

**Decision**: `createNcr()` still returns a bare Mongoose `Ncr` document (its
existing contract, relied on by `routes/ncr.js` and every test in
`test-unit/lib/ncr-service.test.js`). The boolean result of the lookup is
stashed as a plain, non-schema property on that same document
(`ncr._wbsNotificationMatched = !!match`) before returning — Mongoose
documents accept arbitrary extra properties that are simply never persisted
(they're not declared schema paths), so this is invisible to `.save()` and
to anything reading the document from the database, but readable by the
immediate caller in the same request. `routes/ncr.js`'s `POST /` handler
reads that property and adds `wbs_notification_matched: boolean` to its
JSON response.

**Rationale**: Every existing caller of `createNcr()` — the route and all of
`test-unit/lib/ncr-service.test.js` — does `const ncr = await createNcr(...)`
and uses `ncr` as a document directly. Changing the return type to something
like `{ ncr, wbsNotificationMatched }` would be a breaking change requiring
edits to every existing call site and test for a small piece of
transient-only information the spec explicitly says should not be persisted
(see spec.md Assumptions). The non-schema-property approach avoids a second
database lookup in the route (which would otherwise need to re-run
`resolveWbsContact` itself) while touching zero existing call sites.

**Alternatives considered**:
- Change `createNcr()`'s return shape to an object — rejected, breaking
  change to existing tests/callers for no proportional benefit.
- Have `routes/ncr.js` independently call `resolveWbsContact(ncr.wbs_number)`
  a second time after `createNcr()` returns — considered acceptable
  (registry is small, a second lookup is cheap) but rejected in favor of
  the non-schema-property approach since it avoids the duplicate query
  entirely at negligible extra complexity.

---

## Decision 4: No-match warning does not block NCR submission

**Decision**: FR-007 (spec.md) — the warning is purely informational. The
NCR is created and the initial notification is still sent to existing
recipients (QA Staff) regardless of whether the WBS lookup found anyone.

**Rationale**: NCR creation is a time-sensitive quality-reporting action.
Blocking it on an unrelated Admin configuration gap (a WBS number nobody has
registered yet) would let an administrative oversight suppress an urgent
nonconformance report — a clearly worse outcome than an informational
warning. This mirrors how `specs/001-ncr-workflow`'s own FR-007a already
established the precedent for a related but distinct case (missing ncr-qa
group configuration DOES block creation, because QA Staff notification is a
mandatory, not supplementary, recipient) — by contrast, the Cognizant
GL/Director-equivalent contact this feature resolves has always been
explicitly optional/deferred, never a hard requirement for a valid NCR.

**Alternatives considered**:
- Block submission until an Admin confirms or a match exists — rejected;
  contradicts the "does not block submission" requirement stated directly
  in the feature description, and would regress the currently-working
  unconditional NCR creation flow.
