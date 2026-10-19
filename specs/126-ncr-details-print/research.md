# Research: Extend Traveler Print Output with NCR Details

**Feature**: [spec.md](spec.md) | **Date**: 2026-10-18

**Direction change (2026-10-18)**: An earlier draft of this document proposed
having `GET /travelers/:id/print` itself load the NCR/review data and render
it server-side in Jade. That direction was not committed and is replaced
here: a prior attempt at pulling the traveler's *form* content through a
similar server-side path ran into real complexity (the form is arbitrary,
builder-authored HTML, not a fixed schema — see the retired
`126-server-side-traveler-pdf` direction in this repo's history for why).
To avoid that class of problem entirely, this feature now follows the
print page's own existing pattern instead: fetch the new content with
client-side JavaScript, the same way the page's discrepancy log already
works, and let the browser's native print/"save as PDF" handle output, the
same way it already does for the rest of the page. Nothing about the
traveler's *form* rendering is touched by this feature either way — only
the new NCR and review sections are affected by this change of direction.

All items below are resolved against the existing codebase, not a new
dependency.

## R1 — Reuse `lib/ncr-pdf.js#buildNcrPdfModel` instead of a new field list

**Decision**: Unchanged from the original research: a new, read-only route
calls the already-existing, already-tested `buildNcrPdfModel(ncr, { travelerTitle })`
(`lib/ncr-pdf.js`, shipped with spec 124 for the NCR closure PDF) for each
linked NCR, and drops the one section headed `'Event History'`:
`model.sections.filter(s => s.heading !== 'Event History')`. The resulting
`sections` — each `{heading, rows: [[label,value]]}` or
`{heading, table: {head, rows, widths}}` or `{heading, note}`, every value
already a plain string via that module's own `text()`/`formatDate()`
helpers — is what the new endpoint returns as JSON, and what the client
renders.

**Rationale**: FR-002/FR-003. This stays the one existing source of truth
for "what is an NCR's substantive detail" (the same thing the NCR closure
PDF already shows), so the new endpoint's output can never drift from it.
Because every value is already a plain string by the time it reaches the
client, the client-side renderer (R5) never needs to interpret dates,
nulls, or nested objects — only draw strings, which keeps it simple and
safe.

## R2 — Client-side fetch and render, not server-side Jade rendering

**Decision** (revised): The print route (`GET /travelers/:id/print`) is
**not** changed. Two new read-only, session-authenticated JSON endpoints are
added instead — `GET /travelers/:id/ncr-print-details/` and
`GET /travelers/:id/review-records/` — and `public/javascripts/traveler-print.js`
fetches both in its existing `$(function() {...})` ready handler, the same
place `loadDiscrepancyLog()` already fetches the discrepancy log, and
builds the new sections into the page's DOM before the user prints.
`views/traveler-print.jade` gains two empty container elements
(`#review-records`, `#ncr-print-sections`) for that script to fill, plus a
heading for each — no server-side loop over NCRs or review results in Jade
at all.

**Rationale**: Matches the explicit direction change: keep the print page's
existing architecture (fetch-then-render client-side, browser-native print)
for this new content instead of introducing a second, server-side rendering
path on the same page. It also means this feature's blast radius is exactly
"two new read-only endpoints plus a page's own script" — nothing about how
the traveler's own form is loaded or rendered changes, which is the thing
the earlier, abandoned direction ran into trouble with.

**Alternatives considered**:
- *Server-side Jade rendering of the new sections* (the original version of
  this research document) — superseded per the direction change above; not
  wrong on its own terms, but inconsistent with what has already been tried
  and with what was asked for here.

## R3 — Every linked NCR, ordered to match the traveler's own form, not by creation time

**Decision**: `lib/traveler-ncr.js` (the existing module that already owns
`findOpenNcrs`, the "open, summary-only" query behind
`GET /travelers/:id/ncr-links/`) gains a sibling,
`findAllLinkedNcrs(travelerId)`: the same
`{'traveler_link.traveler_id': travelerId, 'traveler_link.initiated_from_traveler': true}`
filter, no `status` filter (every status, FR-001), no field projection
(full documents — `buildNcrPdfModel` needs every field), sorted
`{created_at: 1}` as its own baseline order.

That baseline is **not** the order shown to the user (revised — the
original version of this research document had NCRs print oldest-first;
FR-010 now asks for the traveler's own top-to-bottom order instead). A
second pure function, `orderNcrsByFormPosition(ncrs, labels)`, re-sorts the
fetched NCRs by the position of the input each was raised against
(`ncr.traveler_link.input_name`) within `labels` — the traveler's active
form's own name→label map, in the same order
`utilities/routes.js#activeFormLabels(doc)` already iterates it, which is
form/document order (the same order `126-server-side-traveler-pdf`'s own
research independently confirmed for this exact map). An NCR whose input is
no longer on the form (removed since) sorts after every NCR whose input is
still recognized. Within one input, NCRs keep `findAllLinkedNcrs`'s own
oldest-first order (the comparator only orders by position; same-position
entries keep their relative order, since `Array.prototype.sort` is a stable
sort in Node 18 — this is spelled out, not left as something a reader has
to already know). The new `GET /travelers/:id/ncr-print-details/` route
calls `findAllLinkedNcrs` then `orderNcrsByFormPosition(ncrs, activeFormLabels(traveler))`,
then maps the result through `buildNcrPdfModel`/the Event-History filter
(R1), and returns `[{ncrTitle, sections}, ...]` as JSON, already in the
final order.

**Rationale**: FR-010. Keeps "what counts as a traveler's linked NCRs"
*and* "what order do they print in" both defined in one place
(`lib/traveler-ncr.js`'s own stated charter) as two small, independently
testable pure steps — a DB query, then a pure reorder — rather than one
function trying to do both. Matching the form's own order is what the
request actually asked for: a reader scanning the printed traveler top to
bottom meets each NCR exactly where they would meet the input it was
raised against, not in some unrelated chronological order.

**Alternatives considered**:
- *Sort chronologically (oldest first)* — the original decision; superseded
  by FR-010's revision. Kept as `findAllLinkedNcrs`'s own baseline order
  only because it is still a reasonable, stable starting point before the
  position-based reorder, and the natural tie-break within one input.

## R4 — Review records: a new pure shaping function, with resolved names

**Decision**: Unchanged: `lib/traveler-ncr.js` gains
`reviewRecordRows(traveler, reviewerNames)` (pure): maps
`traveler.__review.reviewResults` to
`{reviewerName, outcome: 'Approved'|'Rejected', date, comment, voided}`,
`reviewerName` from a `reviewerNames` map (id → name) the new
`GET /travelers/:id/review-records/` route resolves via one batched
`User.find({_id: {$in: [...]}}, 'name').lean()` call, falling back to the
raw id when a reviewer no longer resolves (the same pattern `routes/form.js`
already uses for a Form's own review results — `routes/traveler.js` never
did this for travelers; this closes that gap as a side effect). Every
recorded result is included, voided or not (marked as such), not filtered
to only the one(s) behind the final approval — the same complete history
`views/traveler.jade`'s own "Completed review(s)" accordion already shows.

**Rationale**: FR-006/FR-007. A pure function is directly unit-testable
(Constitution I) and keeps "Approved vs Rejected, how voided is marked" in
one place. `__review.policy` is left out of the output for the same reason
as before: `allApproved()` never actually reads it, so showing it would
misrepresent how the traveler was really approved.

## R5 — Client-side rendering: safe DOM construction, not string-built HTML

**Decision**: `traveler-print.js` builds the new sections' DOM with jQuery
element construction and `.text()` for every value a `Section` carries
(`$('<td>').text(value)`, not `` $(`<td>${value}</td>`) `` or `.html(...)`)
— never by concatenating a value into an HTML string. A small local
renderer, `renderSections(container, sections)`, draws the generic
`{heading, rows|table|note}` shape (R1/R4) this way once, reused for both
the NCR and review containers.

**Rationale**: FR-009 ("never interpreted as markup") has to be earned
client-side here, the opposite of the server-rendered direction (where
Jade's default `#{}` escaping gave it for free). This codebase already has
a counter-example worth not repeating: `public/javascripts/lib/traveler.js`'s
existing `history()`/`notes()` helpers build HTML via raw template-string
interpolation of user-entered values with no escaping at all — a
pre-existing pattern this feature's own new code deliberately does not
follow, regardless of that precedent elsewhere on the same page.

**Alternatives considered**:
- *Reuse `history()`/`notes()`'s string-template style for consistency*  —
  rejected: consistency with an already-unsafe pattern is not a reason to
  add another unsafe one; this feature's new code is held to the
  constitution's security principle directly instead.

## R6 — Attachment file names only, never a path or a link

**Decision**: Unchanged: `buildNcrPdfModel`'s own "Attachments" section
already lists `attachment.file_name` only (never `file.path`) — reused as
part of R1 with no extra work on either the server or client side.

## R7 — Timing: the print button is not enabled until the new content has loaded

**Decision**: `#create-pdf` stays disabled (or hidden, matching the page's
existing `#print-control` visibility convention) until both new fetches —
NCR details and review records — have resolved; `traveler-print.js` enables
it once they have. The discrepancy log's own existing fetch has no such
guard today (a user can already print before it finishes loading), which
this feature does not change; the new guard applies only to the two new
fetches this feature itself adds.

**Rationale**: FR-001/FR-006 say this content is always part of the single
print/"Create PDF" action, not an optional extra a user might print before
retrieving (FR-008 — no new step, but also no way to produce an incomplete
record through the one step that exists). Guarding only the two new
fetches — not touching the discrepancy log's existing, already-accepted
timing — keeps this feature's change small and consistent with "research
only what this feature needs," rather than silently changing unrelated,
already-shipped behavior.

## R8 — Testing: client-rendered content is an e2e concern, not a unit-test one

**Decision**: The two new `lib/traveler-ncr.js` functions (R3, R4) are unit
tested directly (pure, no DOM). The new endpoints' JSON shape and the
rendered page's content (NCR sections present/absent, review records
present/absent including a voided one, no Event History, markup-like text
rendered literally, the print button staying disabled until both fetches
resolve) are covered by a new Playwright e2e spec — the same reasoning this
project's own prior work already recorded for client-only rendering logic
("the mocha setup has no DOM, so no unit test file is created" — the
equivalent note for `public/javascripts/lib/live-refresh.js`, spec 125).

**Rationale**: Matches Constitution I's testing levels (unit for `lib/`
logic, e2e for critical user journeys and anything that cannot be
meaningfully unit-tested without a browser).
