# Implementation Plan: Extend Traveler Print Output with NCR Details

**Branch**: `126-ncr-details-print` | **Date**: 2026-10-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/126-ncr-details-print/spec.md`

## Summary

A completed traveler's print/"Create PDF" output (`views/traveler-print.jade`)
gains two new sections: the traveler's own full review/approval history,
shown automatically near its existing content, and — gathered together at
the very end of the page, one after another — every NCR ever linked to the
traveler, with the same substantive detail its own closure record already
carries, minus its event history.

Technical approach (revised 2026-10-18 — see research.md's note at the
top): client-side, matching the print page's own existing pattern. Two new
read-only, session-authenticated JSON endpoints —
`GET /travelers/:id/ncr-print-details/` and `GET /travelers/:id/review-records/`
— are added; `public/javascripts/traveler-print.js` fetches both in its
existing ready handler, the same way it already fetches the discrepancy
log, and renders them into two new containers in `views/traveler-print.jade`
before the user prints. The print route itself (`GET /travelers/:id/print`)
is unchanged — no server-side rendering of the new content, and nothing
about the traveler's own form rendering is touched at all. NCR detail is
not re-derived: both new endpoints reuse existing, already-tested pure
logic — `lib/ncr-pdf.js#buildNcrPdfModel` (spec 124) for NCR content, with
its `'Event History'` section dropped, and a new `reviewRecordRows` for
review content. No new dependency, no schema change.

## Technical Context

**Language/Version**: JavaScript, Node.js 18+ (unchanged)

**Primary Dependencies**: Express 4, Mongoose 7, Pug/Jade (views), jQuery
(client). No new dependency — `lib/ncr-pdf.js` (pdfkit-based PDF generation)
is depended on for its pure `buildNcrPdfModel` export only; `renderNcrPdf`
(the part that touches pdfkit) is never called by this feature.

**Storage**: MongoDB via Mongoose. No schema change, no new collection.
Reads `Ncr` (existing `traveler_link` index), `Traveler.__review` (existing
`addReview` plugin fields), and `User` (for reviewer names) — nothing new.

**Testing**: Mocha unit tests in `test-unit/` (`npm run unit`) for the two
new `lib/traveler-ncr.js` functions (pure, no DOM). A new Playwright e2e
spec in `e2e/` (`npm run e2e`) for the two new endpoints' shape and the
print page's resulting DOM content — the client-side rendering logic has
no unit-test equivalent in this codebase (no DOM in the Mocha environment,
the same reasoning already recorded for `public/javascripts/lib/live-refresh.js`
in spec 125), so e2e is where it is actually verified (research.md R8).

**Target Platform**: Browser (the existing traveler print page), reached
only through the existing session-authenticated web app.

**Project Type**: Web application (server-rendered Pug/Jade pages with
jQuery client code), extending the existing single-repository layout.

**Performance Goals**: One extra `Ncr.find` and one batched `User.find` per
page load of the print view (via the two new endpoints), each bounded by
one traveler's own linked NCRs and review results (typically single
digits) — no pagination or heavy query added.

**Constraints**: No new step added to the existing print/"Create PDF"
action (FR-008) — the print button itself still does exactly what it does
today; it is simply not enabled until the two new fetches resolve
(research.md R7), so the single action always produces a complete record.
Nothing about this feature changes when the print page or its controls are
available, or how its existing show/hide validation/notes/details toggles
behave (FR-011). All NCR/review free text must render as plain text, never
interpreted as markup (FR-009) — on the client, this has to be earned
explicitly (no Jade auto-escaping applies to AJAX-fetched content): every
value is inserted via safe DOM construction (`.text()`), never `.html()` or
a string built by concatenating a value into HTML (research.md R5).

**Scale/Scope**: Bounded by one traveler's own data — every NCR linked to
it (any status) and its own review history; no cross-traveler query.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Checked against `.specify/memory/constitution.md` v1.1.0.

| Principle | Status | How this plan meets it |
|---|---|---|
| I. Automated Testing | Pass | Unit tests for the two new `lib/traveler-ncr.js` functions. A new Playwright e2e spec covers both new endpoints' JSON shape and the rendered page's resulting content (NCRs present/absent, review records present/absent including a voided one, no Event History, markup-like text rendered literally, `#create-pdf` staying disabled until both fetches resolve) — the constitution's "E2E recommended for critical user journeys," and the only meaningful way to verify client-side-rendered content in this codebase (research.md R8). |
| II. Code Quality and Consistency | Pass | NCR detail is not re-derived: both new endpoints reuse `lib/ncr-pdf.js#buildNcrPdfModel`, the one existing source of truth for "what is an NCR's substantive detail," the same way the NCR closure PDF already does (research.md R1). The two new traveler-level rules live in `lib/traveler-ncr.js`, the module that already owns this traveler's NCR-related rules, not inline in a route. One small client-side `renderSections` function draws both new sections instead of two near-duplicate blocks. |
| III. Security-First Architecture | Pass | Both new endpoints are read-only extensions of the existing, already-authenticated `/travelers/:id/*` middleware chain — no new input is accepted. All NCR/review free text is inserted client-side via `.text()`, never `.html()` or an HTML string built from a value (research.md R5) — a deliberate choice, made explicit because this codebase already has a nearby counter-example (`public/javascripts/lib/traveler.js`'s `history()`/`notes()` build HTML via unescaped string templates) that this feature's own new code does not repeat. Attachment file names only, never a path or a link (research.md R6). |
| IV. Versioning & Breaking Changes | Pass | Purely additive: two new endpoints, two new containers and a few new lines of script on an existing page. `GET /travelers/:id/print` itself is unchanged — no response-shape change for any existing caller. |
| V. Documentation | Pass | `contracts/traveler-print-ncr-and-review.json` documents both new endpoints and the two new `lib/` functions to the same standard as existing contracts. CLAUDE.md gets a 126 "Recent Changes" entry once implemented. |

**Gate result**: PASS. No violations; Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/126-ncr-details-print/
├── spec.md
├── plan.md                                     # this file
├── research.md                                 # Phase 0 decisions R1–R8 (direction change noted at top)
├── data-model.md                               # Phase 1: the two new endpoints + the two new lib functions
├── contracts/
│   └── traveler-print-ncr-and-review.json      # the two new endpoints + client contract
├── checklists/requirements.md
└── tasks.md                                    # created by /speckit.tasks
```

### Source Code (repository root)

```text
lib/
└── traveler-ncr.js            # + findAllLinkedNcrs(travelerId), + orderNcrsByFormPosition(ncrs, labels),
                                 #   + reviewRecordRows(traveler, reviewerNames)

routes/
└── traveler.js                 # + GET /travelers/:id/ncr-print-details/ (findAllLinkedNcrs ->
                                 #   orderNcrsByFormPosition -> buildNcrPdfModel, Event History filtered)
                                 # + GET /travelers/:id/review-records/ (batched User.find -> reviewRecordRows)
                                 # GET /travelers/:id/print itself: UNCHANGED

views/
└── traveler-print.jade         # + two empty containers (#review-records, #ncr-print-sections) with headings;
                                 #   no server-side loop over NCRs/reviews — filled by the script below

public/javascripts/
└── traveler-print.js           # + two $.getJSON calls (the two new endpoints) in the existing ready handler,
                                 #   alongside the existing discrepancy-log fetch
                                 # + renderSections(container, sections): draws the generic
                                 #   {heading, rows|table|note} shape via safe DOM construction (.text())
                                 # + #create-pdf stays disabled until both new fetches resolve (research.md R7)

test-unit/lib/
└── traveler-ncr.test.js        # + tests for findAllLinkedNcrs and reviewRecordRows

e2e/
├── fixtures/cli.js             # + a fixture command to set a traveler's __review.reviewResults directly
│                                #   (provisioning review history without driving the full review-submission
│                                #   flow, which is existing, already-tested behaviour this feature does not touch)
└── us-traveler-print-ncr-details.spec.js   # NEW
```

**Structure Decision**: Extend the existing web-app layout; no new
top-level directory. Two new routes in the existing `routes/traveler.js`
(no new router/file), two new functions in the existing `lib/traveler-ncr.js`,
and additions to the print page's existing view/script — no new client-side
module file, since the new logic is small enough to live alongside the
page's existing ready-handler code. `lib/ncr-pdf.js` is depended on for its
pure model builder only; its pdfkit-rendering half is untouched and unused
by this feature.

## Phase 0 and Phase 1 outputs

- [research.md](research.md): decisions R1–R8, with the direction change
  (client-side fetch-and-render, not server-side Jade rendering) recorded
  at the top.
- [data-model.md](data-model.md): the two new endpoints, the two new
  `lib/traveler-ncr.js` functions, and the client-side fetch/render
  contract.
- [contracts/](contracts/): the two new endpoints and the client contract.
- [quickstart.md](quickstart.md): how to verify by hand and by e2e.

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified

*(none — Constitution Check passed with no violations)*
