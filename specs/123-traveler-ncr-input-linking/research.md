# Phase 0 Research: Traveler-Initiated NCRs Linked to a Specific Input

**Feature**: `123-traveler-ncr-input-linking` | **Spec**: [spec.md](./spec.md)

This research is grounded in reading the actual running code
(`model/ncr.js`, `model/traveler.js`, `utilities/routes.js`, `routes/traveler.js`,
`public/javascripts/traveler.js`, `public/javascripts/lib/traveler.js`,
`views/traveler.jade`, `views/ncr-create.jade`, `views/ncr-detail.jade`).

> **Important correction discovered during research**: `public/javascripts/
> traveler-form-loader.js` (which already contains a `renderNotes()` with the
> exact per-input-badge mechanics this feature needs) is **dead code** —
> nothing references it, and it hasn't been touched since 2019. The live
> equivalent is `public/javascripts/traveler.js` (loaded as an ES module from
> `views/traveler.jade`) together with `public/javascripts/lib/traveler.js`,
> which exports its own `renderNotes()`/`renderHistory()`. All decisions below
> target the live files, not the dead one.

## Decision 1: Rename `Ncr.traveler_link.step_number` to `input_name`, add `input_label` — no new collection

**Decision**: `model/ncr.js`'s `traveler_link` sub-schema changes from
`{traveler_id, step_number: Number, initiated_from_traveler}` to
`{traveler_id, input_name: String, input_label: String, initiated_from_traveler}`.
No new collection is introduced for the traveler-side display — the
traveler page queries `Ncr` directly by `traveler_link.traveler_id` at render
time.

**Rationale**: `step_number` is provably dead — grep confirms it is populated
only by test fixtures (`e2e/fixtures/cli.js`, `test-unit/lib/ncr-service.test.js`)
and never by any real route or UI; the field's own inline comment already
says `// this need to be the input unique name` while its type is `Number`,
i.e., the schema itself documents that this exact fix was always intended.
Fixing it now — rather than adding a third field alongside two dead ones — is
the honest, minimal change. A separate denormalized "link" collection
(mirroring `TravelerNote`'s `(traveler, name)` keying) was considered and
rejected: `Ncr.traveler_link` is already the authoritative record per
FR-003/FR-012 (it must survive traveler/input deletion), so a second
collection caching the same fact would be pure duplication with a drift risk,
against the constitution's "avoid code duplication." Querying
`Ncr.find({'traveler_link.traveler_id': ..., 'traveler_link.initiated_from_traveler': true})`
at traveler-render time is a single indexed query, not a performance concern
at this app's scale (spec.md's own base spec targets 10,000+ NCRs total).

**Alternatives considered**:
- *New `TravelerNcrLink` collection, `{traveler, name, ncr, ncr_number}`*:
  rejected per above — no second source of truth needed when `Ncr` already
  holds everything required.
- *Keep `step_number` and add new fields alongside it*: rejected — `step_number`
  has zero real callers and no historical data of consequence (this whole
  eTraveler integration was never live in the UI per the base spec's own
  "Future Work: Not Yet Planned" framing), so there is nothing to preserve
  compatibility with.

## Decision 2: "Initiate NCR" reuses the existing standalone creation page via URL query parameters — no new creation route

**Decision**: The traveler page's "Initiate NCR" action is a plain link to
`{prefix}/ncrs/new?traveler_id=<id>&input_name=<name>&input_label=<label>`
(URL-encoded). `views/ncr-create.jade` reads these three query parameters on
load and merges them into the same JSON body it already POSTs to
`/api/ncrs` — no new NCR-creation endpoint, no new page.

**Rationale**: `routes/ncr.js`'s `POST /api/ncrs` already accepts
`traveler_id`/`traveler_step_number` in the body and `lib/ncr-service.js`'s
`createNcr()` already builds `ncr.traveler_link` from them (renamed per
Decision 1) — the plumbing for "this NCR came from a traveler" already
exists end-to-end, just never populated by any UI. `views/ncr-create.jade`
today reads no query parameters at all, so this is a small, additive change
in exactly one place (its existing submit-payload assembly), directly
satisfying FR-005 ("every already-mandated piece of information... still
applies unchanged — this feature only adds the association").

**Alternatives considered**:
- *A dedicated "Initiate NCR from Traveler" page/modal*: rejected — would
  duplicate the entire existing NCR creation form for no behavioral gain,
  and risks the two forms drifting out of sync over time.

## Decision 3: "Has a submitted value" is `touchedInputs`, kept live client-side after each save (no page reload needed)

**Decision**: Whether an input shows the "Initiate NCR" action is decided
from `Traveler.touchedInputs` (existing field, an array of input names that
have at least one submitted value). The traveler page already dumps the
whole traveler document — `touchedInputs` included — into a client-side
`traveler` variable at load (`views/traveler.jade`'s `block bodyJs`). The one
gap: today, a successful per-field save (`POST /travelers/:id/data/`,
handled in `public/javascripts/traveler.js` around its `incrementFinished()`
call) updates the *server's* `touchedInputs` (via `resetTouched()`,
`utilities/routes.js`) but returns `204 No Content` — the client's in-memory
copy goes stale until the page is reloaded. This feature adds one small
client-side update alongside the existing `incrementFinished()` call: push
the just-saved field's name into the client's own `traveler.touchedInputs`
array (if not already present) and reveal the "Initiate NCR" action for that
one field immediately, with no reload.

**Rationale**: Reuses a field that already exists and already means exactly
"has a submitted value" — no new server state. The one live gap (stale
client copy after save) already exists today for `finishedInput` too, and is
already patched the same way (`incrementFinished()` is precisely this kind
of "update the client's own snapshot after a known-successful save"
pattern) — this feature's fix follows that exact, already-established
precedent rather than inventing a new one.

**Alternatives considered**:
- *Have `POST /travelers/:id/data/` return the updated `touchedInputs` in its
  response body instead of `204`*: rejected as a larger, riskier change to
  an existing, widely-used endpoint's response contract, for a problem a
  small client-side patch already solves without touching the server route
  at all.

## Decision 4: New read-only endpoint `GET /travelers/:id/ncr-links/`, styled exactly like the existing `GET /travelers/:id/notes/`

**Decision**: Add one new route in `routes/traveler.js`:
`auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.canReadMw('id')`,
querying `Ncr.find({'traveler_link.traveler_id': req.params.id, 'traveler_link.initiated_from_traveler': true}, {ncr_number:1, status:1, 'traveler_link.input_name':1}).lean()`
and returning a flat JSON array `[{input_name, ncr_id, ncr_number, status}, ...]`
— the same shape convention as the existing notes route's flat array of
`{name, ...}` objects.

**Rationale**: Matches this file's own established house style exactly (same
three-middleware chain, same "flat array the client filters by name" shape
the live `renderNotes()` already consumes) rather than introducing a
different pattern. `reqUtils.canReadMw('id')` is the traveler's own existing
read-access gate — per the spec's resolved clarification, visibility of the
NCR link/status is governed by traveler access alone, so no additional
NCR-specific authorization check is added here. This is consistent with
`routes/ncr-view.js`'s `GET /ncrs/:id` already having no per-viewer access
restriction beyond being authenticated — this endpoint doesn't expose
anything a user couldn't already reach by opening the NCR link directly.

**Alternatives considered**:
- *Fold this data into the existing whole-document `traveler` dump at page
  load instead of a separate endpoint*: rejected — the notes precedent
  already establishes "small, separate, on-demand JSON endpoint" as this
  page's pattern (notes aren't in the initial dump either), and a separate
  endpoint means a newly-initiated NCR's badge can be picked up by a manual
  refresh of just that data without a full page reload in the future, matching
  how notes already work.

## Decision 5: `renderNcrLinks()` in `public/javascripts/lib/traveler.js`, mirroring `renderNotes()`'s DOM-injection mechanics exactly

**Decision**: Add a sibling function to the existing `renderNotes()` in
`public/javascripts/lib/traveler.js`, called once at page load right next to
the existing `renderNotes()` call (inside `renderHistory()`, per
`lib/traveler.js`'s existing structure). It iterates `#form .controls`
exactly as `renderNotes()` does, and for each field: (a) if its name is in
`touchedInputs`, appends an "Initiate NCR" link; (b) for every entry in the
fetched ncr-links array whose `input_name` matches, appends a status
badge/link. Both live in one new small container appended to the same
`.controls` div `renderNotes()` already targets — visually adjacent to, not
replacing, the existing notes UI.

**Rationale**: This is the only existing precedent in the codebase for "a
per-input, name-matched, badge-and-link injected into `.controls`" — reusing
its exact iteration and matching logic (rather than a new approach) keeps
the two features visually and structurally consistent on the same page.

**Alternatives considered**:
- *Server-render the badges into the form HTML directly (Jade, at
  `GET /travelers/:id/` time)*: rejected — the form's HTML is stored,
  pre-rendered content (`traveler.forms[0].html`, injected via `!=` in
  `views/traveler.jade`), not composed fresh by Jade per request; the notes
  precedent already solved "annotate stored form HTML per field" exactly
  this way (client-side, post-load), so this feature follows the same path
  rather than restructuring how the form is rendered.

## Summary of resolved Technical Context

| Field | Resolution |
|---|---|
| Language/Version | JavaScript (Node.js 18+) — unchanged, extends the existing app |
| Primary Dependencies | None new — reuses Express/Mongoose and the existing client-side jQuery/ES-module traveler scripts |
| Storage | MongoDB via Mongoose — `Ncr.traveler_link` gains `input_name`/`input_label` (replacing the never-populated `step_number`); one new compound index (`traveler_link.traveler_id` + `traveler_link.input_name`); no new collection |
| Testing | `test-unit/lib/ncr-service.test.js` (rename `step_number` references, per Decision 1); new e2e coverage in `e2e/` reusing the fixture CLI's `create-traveler-linked-ncr` command (renaming its `stepNumber` param) |
| Target Platform | Same existing web service (Express web app on port 3001) |
| Project Type | Extension to both the existing NCR module and the existing Traveler module |
| Performance Goals | N/A — one small indexed query per traveler page load; per-field save already round-trips the server today, this adds no new round trip to that path |
| Constraints | `POST /travelers/:id/data/`'s response contract is unchanged (still `204`, per Decision 3); `POST /api/ncrs`'s existing required-field validation is unchanged (per FR-005) |
| Scale/Scope | 3 user stories / 13 acceptance scenarios; touches `model/ncr.js`, `lib/ncr-service.js`, `routes/ncr.js`, `routes/traveler.js` (1 new route), `views/ncr-create.jade`, `views/ncr-detail.jade`, `public/javascripts/traveler.js`, `public/javascripts/lib/traveler.js`; renames a dead field referenced only in test fixtures/unit tests across 6 e2e spec files, `e2e/fixtures/cli.js`, and `test-unit/lib/ncr-service.test.js` |
