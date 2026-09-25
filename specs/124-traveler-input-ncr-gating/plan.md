# Implementation Plan: Traveler Input NCR Gating and Closure Record

**Branch**: `124-traveler-input-ncr-gating` | **Date**: 2026-09-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/124-traveler-input-ncr-gating/spec.md`

## Summary

Extends `specs/123-traveler-ncr-input-linking` so a traveler input and the NCRs
raised against it hold each other to account. A user can link a directly-initiated
NCR to an input by pasting a `traveler_id::input_name` reference (copied from any
input on the traveler) into the NCR form; NCRs can only be raised against an
*active* traveler; a traveler cannot be submitted for completion approval, and
an input does not count as finished, while a linked NCR is not Closed; and closing
a traveler-linked NCR attaches a PDF of it to the input.

Approach: one server-side rules module (`lib/traveler-ncr.js`) that every entry
point calls, so no rule lives only in the UI or in one route — there are **three**
code paths that can submit a traveler for completion approval, and both ways a user links an NCR (the
traveler's "Initiate NCR" action and a pasted reference) end in the same
`POST /api/ncrs` (research.md Findings A/B). "Not finished" changes the *stored* `finishedInput`
counter (lists and binders read it) rather than only the page. The PDF is built by
a new `lib/ncr-pdf.js` (pdfkit + an embedded Unicode font) after the closure is
saved, stored in a new traveler-side collection so it survives NCR deletion and
never alters the input's value, and can never block closure.

## Technical Context

**Language/Version**: JavaScript, Node.js 20 (Docker `node:20-alpine`) — unchanged

**Primary Dependencies**: **New runtime**: `pdfkit@^0.20.2` (MIT, pure JS, built-in
tables) and `dejavu-fonts-ttf@^2.37.3` (Unicode TTFs). Existing: Express 4, Mongoose
`^5.13.13` (as installed — `CLAUDE.md`'s "Mongoose 7" does not match `package.json`),
Jade, jQuery/ES-module traveler scripts. Both new packages go in `dependencies`
because the Dockerfile installs with `--omit=dev`.

**Storage**: MongoDB via Mongoose — one new collection (`TravelerNcrPdf`); PDF files
under the existing `config.uploadPath`; two new `NCR_EVENT_TYPES`
(`traveler.pdf_attached`, `traveler.pdf_failed`). **No** change to the `Ncr` or
`Traveler` schemas; no migration.

**Testing**: Mocha/Sinon/Chai unit (`npm run unit`); Playwright e2e against the
Docker stack (`npm run e2e`). This repo has no route-level integration harness —
route behaviour is covered by e2e (research.md Decision 12).

**Target Platform**: Linux server (Docker) — unchanged

**Project Type**: Web service (Express MVC) extending the NCR and Traveler modules

**Performance Goals**: PDF built in-process inside the close request (a few hundred
ms for a typical NCR); attached well inside SC-005's one minute by construction.
Gating queries use the existing `traveler_link.traveler_id` index prefix.

**Constraints**: Closure must never fail or roll back because of the PDF; every rule
enforced server-side (spec FR-007); a traveler's existence is not disclosed to a
user without read access (FR-008); `POST /travelers/:id/data/` still returns `204`;
`createNcr()`'s signature and `POST /api/ncrs`'s required-field validation
unchanged (SC-007).

**Scale/Scope**: 5 user stories / 29 functional requirements / 7 success criteria.
Touches 17 existing files (including `package.json`/`package-lock.json`) and adds 5 new
files: 2 source, 2 unit-test, 1 e2e (below).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| I. Automated testing | PASS | New unit tests for both new `lib/` files (≥ 80% coverage target); `ncr-service` tests extended for the PDF hook and delete-refresh; new e2e spec for every user story plus a checkbox-set input and a cross-traveler PDF-id check. Regression test for the `complete()` disabled-inputs defect that the refusal exposes. |
| II. Code quality | PASS | Rules in `lib/traveler-ncr.js`, not routes; async/await; camelCase/PascalCase as elsewhere; ESLint clean. `lib/ncr-service.js` requires the new module lazily so the existing test stubbing order is unaffected (research.md Decision 1). |
| III. Security | PASS | Reference validated at the boundary (trim, ≤ 256 chars, ObjectId checked *before* any query); read access enforced with a uniform not-found; PDF text is drawn as text only (no HTML/CSS/URL rendering); PDF download scoped by `{_id, traveler}` (no cross-traveler id); file paths server-generated, never user-supplied, never returned to the client; failure reasons carry no paths or stacks. Run `npm audit` on the two new dependencies. |
| IV. Versioning & breaking changes | PASS, with release notes | MINOR (new feature). Behaviour changes to call out: the three status paths — including the Basic-auth REST API — now return `409 OPEN_NCRS`, so an integration that submits or completes travelers programmatically is refused while NCRs are open; `POST /api/ncrs` legacy `traveler_*` fields are a deprecated alias for one release and `traveler_id` without an input name is now a 400. The repo has no `CHANGELOG`; record these in the PR description and `CLAUDE.md` Recent Changes, as prior features did. |
| V. Documentation | PASS | Five contract files, data model, quickstart; JSDoc on `lib/traveler-ncr.js` (the check order and the "why `doc.save()`" reasoning are non-obvious); `CLAUDE.md` refreshed by the optional agent-context hook. |

*Post-Phase-1 re-check*: No change to the gates. Phase 1 added two items to
Complexity Tracking (a new dependency pair and a new collection); neither is a
constitution violation. No new authorization mechanism (the existing
`reqUtils.canRead`/`canReadMw` are reused), no secrets, no new external call.

## Project Structure

### Documentation (this feature)

```text
specs/124-traveler-input-ncr-gating/
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Phase 0 — 12 decisions, two code findings, PDF spike results
├── data-model.md        # Phase 1 — TravelerNcrPdf, event types, reference grammar, progress formula
├── quickstart.md        # Phase 1 — manual + automated verification
├── contracts/
│   ├── traveler-input-lookup.json          # GET  /api/ncrs/traveler-input  (new)
│   ├── ncr-create-traveler-input-ref.json  # POST /api/ncrs                 (field added; aliases deprecated)
│   ├── traveler-completion-refusal.json    # 409 OPEN_NCRS on three paths   (new behaviour)
│   ├── traveler-ncr-pdfs.json              # GET  /travelers/:id/ncr-pdfs/[:pdfId] (new) + PDF content list
│   └── ncr-close-response.json             # PATCH /api/ncrs/:id/close      (closure_pdf added)
├── checklists/requirements.md   # from /speckit-specify
└── tasks.md             # Phase 2 — /speckit-tasks (NOT created by /speckit-plan)
```

### Source Code — Files Added

```text
lib/traveler-ncr.js        # THE rules module. parseInputRef/formatInputRef;
                           # resolveInputRef(req, ref) (fixed order: parse → ObjectId →
                           # load → canRead → input in labels → status===1; typed errors
                           # with code + HTTP status); findOpenNcrs/assertNoOpenNcrs
                           # (409 OPEN_NCRS); openNcrInputNames; refreshTravelerProgress
                           # (sets only finishedInput, uses doc.save()); attachClosurePdf
                           # (guarded, never throws; writes file + TravelerNcrPdf +
                           # event). Depends on utilities/routes.js, never the reverse.
lib/ncr-pdf.js             # buildNcrPdfModel(ncr) — pure, ordered sections per FR-023;
                           # renderNcrPdf(model) — pdfkit, Letter, DejaVu Sans, footer
                           # with NCR number and page x of y; resolves a Buffer.
test-unit/lib/traveler-ncr.test.js
test-unit/lib/ncr-pdf.test.js
e2e/us-traveler-ncr-gating.spec.js   # all five stories against the real stack
```

### Source Code — Files Modified

```text
package.json, package-lock.json      # + pdfkit, dejavu-fonts-ttf (dependencies)

model/ncr.js                         # NCR_EVENT_TYPES += traveler.pdf_attached, traveler.pdf_failed
model/traveler.js                    # + TravelerNcrPdf schema/model (beside TravelerNote), unique
                                     # (traveler, ncr_id); exported
utilities/routes.js                  # resetTouched(): finishedInput = touched − open-NCR inputs
                                     # (queries Ncr directly — no cycle); extract the active-form
                                     # label lookup it shares with lib/traveler-ncr.js

lib/ncr-service.js                   # createNcr: refreshTravelerProgress after save (traveler-linked).
                                     # closeNcr: after the final save → attachClosurePdf →
                                     # refreshTravelerProgress; sets transient ncr._closurePdf.
                                     # deleteNcr: read traveler_link first, refresh progress after.
lib/traveler.js                      # updateStatus: assertNoOpenNcrs when the target is 1.5

routes/ncr.js                        # POST /: traveler_input_ref → resolveInputRef (after field
                                     # validation), legacy traveler_* alias, label ignored;
                                     # GET /traveler-input (before /:id); PATCH /:id/close adds
                                     # closure_pdf; 400/404/409 mapped with details.traveler_input_ref
routes/traveler.js                   # + GET /travelers/:id/ncr-pdfs/ and /:pdfId (canReadMw)
routes/api.js                        # PUT /apis/travelers/:id/status/ and POST
                                     # /apis/update/traveler/:id/: assertNoOpenNcrs on 1.5, and on 2
                                     # while the traveler is still active (the helper's 1 → 2 route)

public/javascripts/lib/traveler.js   # renderNcrLinks(): Copy-reference control on every input;
                                     # fetch ./ncr-pdfs/ and render PDF links; "Not finished —
                                     # open NCR" label; expose the open-input set; Initiate NCR link
                                     # → /ncrs/new?traveler_input_ref=…, not rendered unless
                                     # traveler.status === 1
public/javascripts/traveler.js       # setStatus: OPEN_NCRS list (DOM-built, links); complete():
                                     # re-enable inputs on failure;
                                     # skip incrementFinished for an open-NCR input

views/ncr-create.jade                # replace #traveler-link-banner + 3 URL params with the
                                     # #traveler_input_ref field, debounced lookup preview, submit
                                     # sends traveler_input_ref only
views/ncr-close.jade                 # warning alert when closure_pdf.status === 'failed'

e2e/fixtures/cli.js                  # create-fillable-traveler: status + multiple inputs;
                                     # + set-traveler-status, get-traveler
e2e/us-traveler-ncr-input-linking.spec.js  # banner/URL-param assertions → new field/preview
test-unit/lib/ncr-service.test.js    # + closeNcr PDF outcomes, createNcr/deleteNcr refresh
```

### Source Code — Files NOT Changed

```text
model/traveler.js (Traveler schema)  # no field change — touchedInputs keeps its meaning
routes/traveler.js POST /data/       # still 204; the count is recomputed server-side by resetTouched
model/binder.js, public/javascripts/table.js  # consume the stored finishedInput unchanged; the
                                     # existing post-save hook re-rolls binders
views/ncr-detail.jade                # timeline renders event_type as a badge, so the new events
                                     # show; the traveler/input reference display is 123's
lib/req-utils.js                     # canRead/canReadMw reused as-is
lib/review.js                        # reviewer approval is deliberately not gated (spec Assumptions)
lib/upload.js, routes/ncr-view.js    # PDF is server-generated (no upload filter); /ncrs/new serves the same page
```

**Structure Decision**: Extend the existing Express/Mongoose layout in place. New
business logic goes in `lib/` (the constitution's preferred home), route handlers
stay thin, and the one new model sits beside its sibling `TravelerNote` in
`model/traveler.js`. No new top-level directory.

## Complexity Tracking

> No constitution violations. Two departures from 123's "no new dependency, no new
> collection" pattern are recorded because they are real additions.

| Addition | Why Needed | Simpler Alternative Rejected Because |
|----------|------------|-------------------------------------|
| Runtime dependencies `pdfkit` + `dejavu-fonts-ttf` | Requirement 6 needs a PDF and the app has no PDF capability; engineering text needs `Ω`, `≥`, `Δ`, which pdfkit's built-in Latin-1 fonts cannot draw | Headless Chromium rendering the existing detail page: hundreds of MB in `node:20-alpine`, sandbox flags, launch latency, and a browser on a server that has none. `pdfmake` wraps pdfkit and adds nothing since pdfkit 0.20 has tables. (research.md Decision 8, with spike results) |
| New collection `TravelerNcrPdf` | The PDF must survive deletion of its NCR (FR-028) and must not change the input's value or finished state (FR-021, US4) | `TravelerData` file entry: a data row *is* the value, so it would overwrite it and make an unfilled input look finished. `Ncr.attachments`: deleted with the NCR. Array on `Traveler`: version conflicts with per-field saves and re-fires the binder hook. (research.md Decision 9) |
