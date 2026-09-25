# Phase 0 Research: Traveler Input NCR Gating and Closure Record

**Feature**: `124-traveler-input-ncr-gating` | **Spec**: [spec.md](./spec.md) | **Builds on**: [123 research](../123-traveler-ncr-input-linking/research.md)

Grounded in the running code: `lib/traveler.js`, `lib/review.js`, `lib/ncr-service.js`,
`lib/req-utils.js`, `routes/ncr.js`, `routes/traveler.js`, `routes/api.js`,
`utilities/routes.js`, `model/traveler.js`, `model/binder.js`, `model/ncr.js`,
`public/javascripts/traveler.js`, `public/javascripts/lib/traveler.js`,
`views/ncr-create.jade`, `views/ncr-close.jade`, `views/ncr-detail.jade`,
`e2e/fixtures/cli.js`.

Two findings from the code shape most decisions below:

> **Finding A — a traveler can reach "submitted" or "completed" by four
> different code paths, not one.** `PUT /travelers/:id/status`
> (`lib/traveler.js` `updateStatus`), `PUT /apis/travelers/:id/status/` and
> `POST /apis/update/traveler/:id/` (both `routes/api.js`, the latter via
> `utilities/routes.js` `updateTravelerStatus`, whose `case 2` even permits
> 1 → 2 directly), and reviewer approval (`lib/review.js` `allApproveFlow`
> sets `status = 2` when every reviewer approves). A gate placed only on the
> web status route would leave three ways around it.
>
> **Finding B — "finished input" is a stored counter, and binders roll it up
> from that stored value.** `Traveler.finishedInput` is written by
> `utilities/routes.js` `resetTouched()` on every data save, and the
> `Traveler` post-save hook re-rolls binder progress **only when `finishedInput`
> was modified through `doc.save()`**. Lists (`public/javascripts/table.js`)
> and binders read the stored figure. So "an input with an open NCR is not
> finished" must change the *stored* number, not just the traveler page.

## Decision 1: One server-side rules module, called from every entry point

**Decision**: Add `lib/traveler-ncr.js` holding every rule this feature
introduces — reference parsing/formatting, reference resolution (existence,
read access, active status), the open-NCR queries, the completion refusal,
and the progress refresh. Routes, `lib/ncr-service.js`, `lib/traveler.js`,
`lib/review.js` and `routes/api.js` call it; none re-implement a rule.

**Rationale**: Finding A. The constitution asks for logic in `lib/`, not in
routes, and FR-007 requires the rules to hold "by any route", not just the
form. One module makes "which code enforces FR-013?" answerable with one
grep, and makes the rules unit-testable without Express.

**Dependency direction**: `lib/traveler-ncr.js` → `utilities/routes.js` (for
the active-form label lookup it shares with `resetTouched`), never the
reverse. `resetTouched()` consults `Ncr` directly (it already requires
models), so no cycle. Inside `lib/ncr-service.js` the module is
`require`d lazily where needed so the existing `ncr-service.test.js` stubbing
order is unaffected.

**Alternatives considered**:
- *Put the checks in each route/handler*: rejected — four completion paths
  plus two creation paths would each carry a copy.
- *Extend `lib/traveler.js`*: rejected — it is the status-update handler
  (takes `req`/`res`); the rules also run from `lib/ncr-service.js`, which
  has no `req`.

## Decision 2: The reference is resolved and validated by the server; the label is server-derived

**Decision**:
- Format `traveler_id::input_name`, split at the **first** `::` after trimming
  whitespace (FR-002). Length capped at 256 characters. The traveler id must be
  a valid ObjectId **before** any query (an unchecked bad id would raise a
  Mongoose `CastError` and surface as a 500).
- `POST /api/ncrs` gains one body field, `traveler_input_ref`. The route
  resolves it with `resolveInputRef(req, ref)`; on success it passes
  `{traveler_id, traveler_input_name, traveler_input_label}` to `createNcr()`,
  whose signature and existing tests are unchanged.
- The input **label is taken from the traveler's own form labels**, not from
  the client. (Today's 123 flow trusts a label passed in the URL.)
- The 123 body fields `traveler_id` / `traveler_input_name` /
  `traveler_input_label` remain accepted for one release as a **deprecated
  alias**: the route synthesizes `ref = traveler_id + '::' + traveler_input_name`
  and sends it through the same resolver, ignoring the client-supplied label.
  A `traveler_id` with no input name is now a 400 (the link is to an input).
- A new read-only `GET /api/ncrs/traveler-input?ref=…` powers the form's live
  preview (FR-004). It must be declared before `router.get('/:id')`.
- **Read access** (FR-008) uses `reqUtils.canRead(req, traveler)`. A user
  without it gets the **same** `TRAVELER_NOT_FOUND` response as a nonexistent
  traveler, so a traveler's existence is not disclosed. `INPUT_NOT_FOUND`
  (which names the traveler's title) is only ever returned *after* the read
  check passes.
- Check order: parse → valid ObjectId → load → read access → input exists →
  status is active. Existence of the input uses the active form's `labels`
  map (the same source `resetTouched()` treats as "the inputs of this form").

**Rationale**: One resolver for both entry paths satisfies FR-005 ("identical
linkage") and FR-007. Server-derived labels close a spoofing hole and make the
captured label trustworthy (FR-004 of 123). Keeping the legacy fields as an
alias respects the constitution's deprecate-before-remove rule, and — because
they now go through the resolver — also closes the gap that legacy fields let
any authenticated user link to any traveler with no checks.

**Alternatives considered**:
- *Drop the legacy fields immediately*: rejected — a client still sending them
  would silently create an **unlinked** NCR; an alias fails loudly if wrong.
- *Trust the form-resolved values the browser sends back*: rejected — FR-007
  requires server verification at submit.
- *Return 403 for no-access*: rejected — distinguishes "exists but forbidden"
  from "does not exist", the exact leak FR-008 forbids.

## Decision 3: "Active only" is checked at submission, and the action is simply not offered otherwise

**Decision**: `resolveInputRef` requires `traveler.status === 1` at the moment
of submission (FR-012); refusal is `409 TRAVELER_NOT_ACTIVE`, message names the
current status from `statusMap` (e.g. "submitted for completion"). In the UI
(`appendInitiateNcrLink`), the "Initiate NCR" action is **not rendered** when
the page's `traveler.status !== 1` (FR-010 allows "not offered" or "disabled
with reason"; not rendering matches how 123 already hides it for unfilled
inputs).

**Rationale**: The status is authoritative only at submit (the form can sit
open while the traveler moves). Note the *save* path already requires status 1
(`reqUtils.status('id', [1])`), so on a non-active page there is nothing the
user could fill in anyway.

**Alternatives considered**: *Disabled button with a tooltip* — rejected as
extra UI for a state in which the page's inputs are already disabled.

## Decision 4: The completion gate is one shared refusal, applied to all four paths

**Decision**: `assertNoOpenNcrs(travelerId)` returns nothing when every linked
NCR (`traveler_link.traveler_id` = id, `initiated_from_traveler` true) has
status `Closed`, and otherwise throws a `409` carrying `code: 'OPEN_NCRS'` and
`open_ncrs: [{ncr_id, ncr_number, status, input_name, input_label}]`. It runs
when the target status is **1.5 or 2** on:

1. `lib/traveler.js` `updateStatus` (web) — before the save.
2. `routes/api.js` `PUT /apis/travelers/:id/status/`.
3. `routes/api.js` `POST /apis/update/traveler/:id/` — before
   `updateTravelerStatus` when the requested status is 1.5 or 2.
4. `lib/review.js` `addReviewResult` — for a **Traveler** and an *approve*
   result, **before** the review result is recorded.

Applies to every role; no override (FR-015).

**Why (4) is before recording, not inside `allApproveFlow`**: `addReviewResult`
saves the reviewer's approval first, then `allApproveFlow` sets status 2. A
refusal *inside* the flow would leave every reviewer recorded as "approved"
while the traveler is stuck at 1.5 with nothing to re-trigger completion.
Refusing the approval attempt itself leaves the review state untouched, so it
can simply be retried once the NCRs close.

**Client fixes this exposes** (both are latent today, the refusal makes them
reachable):
- `complete()` in `public/javascripts/traveler.js` disables every form input
  *before* it calls `setStatus(1.5)`. On a refusal the inputs would stay
  disabled until reload. The failure handler must re-enable them.
- `setStatus`'s failure handler concatenates `jqXHR.responseText` into HTML;
  it needs a branch for `OPEN_NCRS` that builds the list with `.text()` /
  attribute setters (never string-concatenated HTML) and links each NCR.
- `submitReview` has **no** `.fail` handler, so a refused approval would do
  nothing visible. Add one that shows the same message.

**Residual race (accepted)**: NCR creation checks `status === 1` and
submission checks "no open NCRs"; there is no cross-collection transaction, so
a create and a submit landing in the same instant could leave a traveler at
1.5 with an open NCR. That is exactly what the second gate (1.5 → 2 and the
approval) catches, and the spec (US3 scenario 2) requires it.

**Alternatives considered**:
- *Gate only 1 → 1.5*: rejected — spec FR-013 and the race above.
- *Mongoose pre-save hook on `Traveler.status`*: rejected — hooks have no
  `req`, cannot return a structured 409 to the caller, and would also fire on
  unrelated saves.

## Decision 5: "Not finished" changes the stored counter, keyed off a formula, refreshed on three events

**Decision**: `finishedInput = |touchedInputs \ openNcrInputNames|`, where
`openNcrInputNames` is the distinct `traveler_link.input_name` of the
traveler's non-Closed linked NCRs.
- `touchedInputs` keeps its meaning ("has a submitted value"); 123's "Initiate
  NCR" gate depends on it. Only the *count* changes.
- `resetTouched()` (the two data-save call sites in `routes/traveler.js` and
  `routes/api.js`) applies the formula, so a later save can never quietly
  "un-block" an input.
- `refreshTravelerProgress(travelerId)` applies it after the three events that
  change an NCR's open/closed state: **create** (traveler-linked), **close**
  (`closeNcr`), **delete** (`deleteNcr`, feature 122). It loads the Traveler,
  sets **only** `finishedInput`, and calls `doc.save()`.

**Why `doc.save()` and only that one path**: Finding B — `Model.updateOne`
would skip the post-save hook and leave binders stale; and because only
`finishedInput` (a scalar) is modified, Mongoose sends a plain `$set` and does
not bump the array version, so it cannot collide with a concurrent
per-field save (which does modify `data`).

**Client**: `renderNcrLinks()` already fetches `./ncr-links/`; it derives the
open-input set from the statuses, marks those inputs "Not finished — open NCR"
(`label label-warning`, beside the NCR badges), and `incrementFinished()` is
skipped for an input in that set (possible now that an unfilled input can be
linked by reference). Editing is untouched (FR-021).

**Alternatives considered**:
- *Derive at read time and leave the stored figure alone*: rejected — lists and
  binders read the stored number (Finding B).
- *Exclude open-NCR inputs from `touchedInputs`*: rejected — it would hide the
  "Initiate NCR" action (which needs "has a value") and break 123.

## Decision 6: Copy control — every input block that already gets notes/NCR controls

**Decision**: `renderNcrLinks()` appends a "Copy NCR reference" button to the
same per-input `.ncr-links` container (`getOrCreateNcrLinksContainer`) for every
`#form .controls` block that contains an `input`/`textarea`. The value is
`${traveler._id}::${element.name}`. Copy uses `navigator.clipboard.writeText`
when available and falls back to a hidden `textarea` + `document.execCommand('copy')`
(the clipboard API needs a secure context; dev runs on plain http). Feedback is a
transient "Copied" label; on total failure the reference is shown selected in a
read-only field so it can still be copied by hand.

**Coverage check (spec FR-003 "every input")**: by inspection of the templates and
loops, the existing code skips only the outer wrapper of a checkbox set
(`.controls` whose child is `.checkbox-set-controls`). Each checkbox *inside* the
set renders as its own `.control-group > .controls > label.checkbox > input`
(`inputview/checkbox_in_set.jade`), and the form builder gives every input a
generated `name` (`form-builder.js`), so it is covered. The e2e spec should
include a checkbox-set traveler to confirm this rather than rely on inspection.

**Alternatives considered**: *Show the string in a read-only text box only* —
rejected; the request is explicitly "copy the string".

## Decision 7: The NCR form gets one field with a live preview; the "Initiate NCR" link fills it

**Decision**: `views/ncr-create.jade` replaces the 123 banner
(`#traveler-link-banner`, fed by three URL params) with an optional text field
`#traveler_input_ref` and a preview line. The "Initiate NCR" link becomes
`/ncrs/new?traveler_input_ref=<encoded ref>`; on load the page fills the field
and runs the lookup. Lookup fires (debounced ~300 ms) on input/blur, calls
`GET /api/ncrs/traveler-input?ref=`, and shows `Traveler "<title>" — Input
"<label>"` or the specific message. Submit sends `traveler_input_ref` only
(trimmed; omitted when blank). Server errors reuse the page's existing
`details` rendering, keyed `traveler_input_ref`.

**Rationale**: FR-005 — both paths must produce identical linkage; a single
field is the simplest way to guarantee it. The submit is **not** blocked
client-side: the server is authoritative (FR-007).

## Decision 8: PDF via `pdfkit` + a bundled Unicode font; a two-layer design

**Decision**: Add runtime dependencies `pdfkit@^0.20.2` and
`dejavu-fonts-ttf@^2.37.3`. `lib/ncr-pdf.js` has two layers:
1. `buildNcrPdfModel(ncr)` — pure: turns an NCR document into an ordered list of
   `{heading, rows|table}` sections covering FR-023 (identification, traveler
   and input, part/supplier/PO, description and discovery, CE/CS, disposition,
   review and approval outcomes, preventive actions, closure record incl.
   traveler sign-off, attachment **file names**, and event history).
2. `renderNcrPdf(model)` — draws it with pdfkit (Letter, 54 pt margins, page
   footer with NCR number and page x of y) and resolves a `Buffer`.

**Spike results** (throw-away scratch project, not in the repo): pdfkit 0.20.2
generated a valid PDF on Node 20 with its built-in `doc.table()`; DejaVu Sans
has glyphs for `Ω ≥ ≤ ± µ Δ ° é ü` (all `true`) and none for CJK (`温` →
`false`). The two TTFs used are 757 KB (Regular) and 706 KB (Bold).

**Why this stack**:
- pdfkit is pure JavaScript (dependencies: `fontkit`, `fflate`, `png-js`,
  `linebreak`, `@noble/*`) — nothing native, so it installs cleanly under
  `node:20-alpine` with `npm install --omit=dev` (the Dockerfile's command).
- pdfkit's built-in fonts are Latin-1 only; engineering text routinely contains
  `Ω`, `≥`, `Δ`, so a Unicode font is not optional. Taking the TTFs from an npm
  package avoids committing 1.4 MB of binaries; the package carries its own
  license. The package is ~12 MB unpacked (all variants) — negligible in the image.
- It is **not** a security surface: text is drawn as text, with no HTML/CSS/URL
  rendering, so user-authored NCR content cannot inject markup or trigger
  fetches.

**Known limitation**: characters outside DejaVu Sans (e.g. CJK) render as the
font's missing-glyph box. The PDF never fails on them. Accepted for this
release; the NCR form's existing user base enters Latin-script text.

**Alternatives considered**:
- *Headless Chromium (Puppeteer/Playwright) rendering `views/ncr-detail.jade`*:
  best visual fidelity with the on-screen page, but needs a browser in the
  alpine image (hundreds of MB, sandbox flags, launch time) for a server that
  has none today. `@playwright/test` is a *dev* dependency only.
- *pdfmake*: declarative and Node ≥ 20, but it wraps pdfkit and adds its own
  font/VFS setup; pdfkit 0.20 already has tables, so it adds nothing here.
- *wkhtmltopdf / LibreOffice*: unmaintained / system binaries.

## Decision 9: Store the PDF on the traveler side, in its own collection

**Decision**: A new model `TravelerNcrPdf` (in `model/traveler.js`, next to
`TravelerNote`) holds one record per closed, traveler-linked NCR:
`{traveler, input_name, ncr_id, ncr_number, file_name, file:{path,mimetype,size},
generatedOn, generatedBy}` with a **unique** index on `(traveler, ncr_id)` (so a
retry cannot attach twice). The file is written under `config.uploadPath` with a
server-generated name; users see `NCR-YYYY-NNNN.pdf`. Two traveler routes serve
it: `GET /travelers/:id/ncr-pdfs/` (list) and `GET /travelers/:id/ncr-pdfs/:pdfId`
(inline PDF), both `canRead`-gated, and the download queries
`{_id: pdfId, traveler: :id}` so an id from another traveler cannot be fetched
through this one.

**Why not the obvious homes**:
- *A `TravelerData` entry of `inputType: 'file'`* (how a user's own file upload
  is stored): a `TravelerData` row **is** the input's value. It would overwrite
  the displayed value, put the input into `touchedInputs`, and make an
  *unfilled* input look finished — the opposite of FR-021 and US4.
- *`Ncr.attachments`*: `deleteNcr` unlinks every NCR attachment, so an admin
  deleting the NCR would delete the PDF, contradicting FR-028.
- *An array on the `Traveler` document*: saving the traveler collides with
  concurrent per-field saves (array versioning) and fires the binder post-save
  hook.

**Display**: `renderNcrLinks()` also fetches `./ncr-pdfs/` and appends
`<a class="ncr-pdf-link">` (Font Awesome 4.3.0, which the traveler page loads, has `fa-file-pdf-o`) into that input's
`.ncr-links` container beside the NCR badge.

## Decision 10: PDF generation is a best-effort step after the closure is saved

**Decision**: In `closeNcr`, after the existing final `await ncr.save()`, if the
NCR is traveler-linked, call `attachClosurePdf(ncr, user)` inside a
`try/catch` that cannot throw. It (a) loads the traveler and confirms the input
name is still in its labels, (b) builds and renders the PDF, (c) writes the file
and inserts the `TravelerNcrPdf` record, (d) pushes event `traveler.pdf_attached`
and saves; on any failure it pushes `traveler.pdf_failed` (payload `{traveler_id,
input_name, reason}`) instead, logs, and removes any half-written file. The
outcome is returned as a transient `ncr._closurePdf = {status: 'attached' |
'failed' | 'not_applicable', message}` — the same idiom `createNcr` already uses
for `_wbsNotificationMatched`. `PATCH /api/ncrs/:id/close` adds
`closure_pdf` to its JSON, and `views/ncr-close.jade` shows a warning alert when
it is `failed`.

**Ordering**: the PDF is produced *after* the closure save so it includes the
`ncr.closed` and final-distribution events; it therefore does not list its own
attach event. It runs regardless of the traveler's status (FR-029) because it
writes to the traveler-side collection, not through any traveler status guard.

`refreshTravelerProgress` runs after it, also inside the guarded block (a
failure there is logged only; the next data save recomputes the figure).

**Two new `NCR_EVENT_TYPES`**: `traveler.pdf_attached`, `traveler.pdf_failed`.
`views/ncr-detail.jade` renders `event.event_type` as a plain badge, so no view
change is needed for them to appear in the timeline.

## Decision 11: Deleting an NCR refreshes progress and leaves the PDF alone

**Decision**: `deleteNcr` (feature 122) reads `traveler_link` before deleting and
then calls `refreshTravelerProgress`. It does not touch `TravelerNcrPdf`
(FR-028, and the spec's Assumptions). A deleted NCR no longer blocks completion
or the input because the queries are over live `Ncr` documents.

## Decision 12: Testing follows the repository's actual practice

**Decision**:
- **Unit** (Mocha/Sinon/Chai, like `test-unit/lib/ncr-service.test.js`):
  new `test-unit/lib/traveler-ncr.test.js` (parse/format edge cases;
  resolve order incl. uniform not-found for no access; active-only; open-NCR
  queries; the finished-count formula) and `test-unit/lib/ncr-pdf.test.js`
  (the pure section builder against FR-023's list; the renderer returns a
  buffer beginning `%PDF-`, and does not throw on `Ω`, on missing optional
  sections, or on a 500-event history). `ncr-service.test.js` gains
  `closeNcr` PDF-hook cases (attached / failed-but-closed / not applicable) and
  a `deleteNcr` refresh case. Coverage target for the two new lib files ≥ 80%.
- **Route level**: this repo has no supertest-style harness — route behaviour is
  covered by the Playwright suite against the Docker stack — so route/UI
  behaviour goes into a new `e2e/us-traveler-ncr-gating.spec.js`.
- **Fixtures**: `e2e/fixtures/cli.js` needs `create-fillable-traveler` to accept
  `status` and multiple inputs, plus small `set-traveler-status` and
  `get-traveler` commands. To exercise the real PDF path, the spec creates an NCR
  at `Final Approval` with the existing `create-traveler-linked-ncr`
  fixture, then closes it through the real `/ncrs/:id/close` page.
- **Updating 123's spec**: `e2e/us-traveler-ncr-input-linking.spec.js`
  asserts `#traveler-link-banner` and the three URL params; those assertions
  move to the new field/preview.
- PDF *text* content cannot be asserted from a compressed, subset-font PDF
  without a PDF parser, which is why the content check lives on the pure
  section model (unit), and e2e asserts the download's `Content-Type`,
  `%PDF-` header, filename, and access control.

## Resolved Technical Context

| Field | Resolution |
|---|---|
| Language/Version | JavaScript, Node.js 20 (Docker `node:20-alpine`) — unchanged |
| Primary Dependencies | **New runtime**: `pdfkit@^0.20.2`, `dejavu-fonts-ttf@^2.37.3`. Existing: Express 4, Mongoose `^5.13.13` (as installed), Jade, jQuery |
| Storage | MongoDB via Mongoose: one new collection (`TravelerNcrPdf`); PDF files under the existing `uploadPath`; two new `NCR_EVENT_TYPES`; **no** change to `Ncr` or `Traveler` schemas |
| Testing | Mocha/Sinon/Chai unit; Playwright e2e (Docker stack) |
| Target Platform | Linux server (Docker) — unchanged |
| Project Type | Web service extending the NCR and Traveler modules |
| Performance Goals | PDF built in-process inside the close request (a few hundred ms for a typical NCR); attached within SC-005's one minute by construction; gating queries use the existing `traveler_link.traveler_id` index prefix |
| Constraints | Closure never fails because of the PDF; every rule enforced server-side; no traveler existence leak; `POST /travelers/:id/data/` still returns `204`; existing NCR required-field validation and `createNcr()` signature unchanged |
| Scale/Scope | 5 user stories / 29 requirements; see plan.md for files |

No `NEEDS CLARIFICATION` remains.
