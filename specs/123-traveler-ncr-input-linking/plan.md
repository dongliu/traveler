# Implementation Plan: Traveler-Initiated NCRs Linked to a Specific Input

**Branch**: `123-traveler-ncr-input-linking` | **Date**: 2026-09-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/123-traveler-ncr-input-linking/spec.md`

## Summary

Fills in the "Initiate NCR" launch point and two-way link/status display
that `specs/001-ncr-workflow/spec.md`'s "Future Work: eTraveler UI
Integration" left deferred — and extends it to associate an NCR with a
specific, uniquely-named traveler **input**, not just the traveler as a
whole. A user who has already filled in a traveler input can initiate an
NCR from it; the traveler then shows a link and live status for each NCR
linked to that input, and each such NCR shows a link back to the traveler
and the input's label. Implemented by fixing a previously-dead,
wrongly-typed field (`Ncr.traveler_link.step_number`, whose own comment
already said it should hold "the input unique name") rather than adding new
storage, plus one new small read-only endpoint and small additions to the
existing traveler client script and the existing NCR creation/detail pages.

## Technical Context

**Language/Version**: JavaScript (Node.js 18+) — unchanged, extends the
existing app

**Primary Dependencies**: None new — reuses Express/Mongoose and the
existing client-side jQuery/ES-module traveler scripts
(`public/javascripts/traveler.js`, `public/javascripts/lib/traveler.js`)

**Storage**: MongoDB via Mongoose — `Ncr.traveler_link` gains
`input_name`/`input_label`, replacing the never-populated `step_number`; one
new compound index; no new collection (traveler-side display is derived by
querying `Ncr` directly, per research.md Decision 1)

**Testing**: Mocha/Sinon/Chai (unit, `test-unit/lib/ncr-service.test.js`);
Playwright (e2e, new spec under `e2e/`)

**Target Platform**: Linux server (Docker) — unchanged

**Project Type**: Web service (Express MVC), extends both the existing NCR
module and the existing Traveler module

**Performance Goals**: N/A — one small indexed query per traveler page load;
no new round trip added to the existing per-field save path

**Constraints**: `POST /travelers/:id/data/`'s response contract stays
`204` (no body) — the client-side `touchedInputs` staleness this feature
needs to fix is patched entirely client-side (research.md Decision 3), not
by changing that route; `POST /api/ncrs`'s existing required-field
validation is unchanged (FR-005) — the traveler fields are additive
metadata only

**Scale/Scope**: 3 user stories / 13 acceptance scenarios; touches
`model/ncr.js`, `lib/ncr-service.js`, `routes/ncr.js`, `routes/traveler.js`
(1 new route), `views/ncr-create.jade`, `views/ncr-detail.jade`,
`public/javascripts/traveler.js`, `public/javascripts/lib/traveler.js`; also
renames a field referenced only by test fixtures across `e2e/fixtures/cli.js`,
6 existing e2e spec files, and `test-unit/lib/ncr-service.test.js`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| Automated tests required | PASS | Unit tests updated for the `traveler_link` shape change; new e2e coverage for initiate → link/status on both sides → status-updates-reflect → multiple-NCRs-per-input → cross-traveler name reuse → non-traveler NCR shows no reference |
| Input validation at boundaries | PASS | No new user-writable field beyond the two additive, optional `traveler_input_name`/`traveler_input_label` strings, sanitized the same way every other free-text NCR creation field already is (`sanitizeStr`) in `routes/ncr.js` |
| Separation of concerns | PASS | The new traveler-side route matches `routes/traveler.js`'s own existing house style (inline Mongoose query, same as its notes route) rather than introducing a service-layer split inconsistent with that file; NCR-side logic stays in `lib/ncr-service.js`, matching every other NCR change in this codebase |
| No code duplication | PASS | Reuses `Traveler.touchedInputs` (no new "has a value" tracking), reuses the existing notes endpoint's DOM-injection mechanics (`renderNotes()`) for the new NCR-links badges rather than inventing a second approach, and reuses the standalone NCR creation page rather than building a second creation flow |
| Security | PASS | No new authorization mechanism — the new traveler-side route reuses `reqUtils.canReadMw('id')` (the traveler's own existing gate); NCR creation's existing `auth.ensureAuthenticated`-only gate is unchanged, consistent with the resolved clarification that traveler access alone governs visibility of the link/status |

*Post-Phase-1 re-check*: No changes to the above — Phase 1 design
(data-model.md, two contracts, quickstart.md) introduced no new gate
concerns; no new collection, no new dependency, no new authorization
mechanism, no change to any endpoint's required-field validation.

## Project Structure

### Documentation (this feature)

```text
specs/123-traveler-ncr-input-linking/
├── plan.md              ← this file
├── research.md          ← Phase 0
├── data-model.md         ← Phase 1
├── contracts/
│   ├── traveler-ncr-links.json          ← Phase 1 (new endpoint)
│   └── ncr-create-traveler-fields.json  ← Phase 1 (existing endpoint's field rename)
├── quickstart.md         ← Phase 1
└── tasks.md              ← Phase 2 (generated by /speckit-tasks)
```

### Source Code — Files Modified

```text
model/ncr.js                         # traveler_link: replace step_number
                                        # (Number) with input_name (String)
                                        # and input_label (String); add the
                                        # compound index on
                                        # traveler_link.traveler_id +
                                        # traveler_link.input_name

lib/ncr-service.js                   # createNcr(): build ncr.traveler_link
                                        # from data.traveler_id/
                                        # traveler_input_name/
                                        # traveler_input_label instead of
                                        # traveler_step_number (same
                                        # `if (data.traveler_id)` gate)
                                        #
                                        # closeNcr(): rename the
                                        # traveler.signed_off event payload's
                                        # step_number key to input_name

routes/ncr.js                        # POST '/' handler: replace
                                        # traveler_step_number:
                                        # req.body.traveler_step_number with
                                        # traveler_input_name:
                                        # sanitizeStr(req.body.traveler_input_name)
                                        # and traveler_input_label:
                                        # sanitizeStr(req.body.traveler_input_label)
                                        # in the body-parse block (b)

routes/traveler.js                   # add
                                        # GET /travelers/:id/ncr-links/
                                        # (auth.ensureAuthenticated,
                                        # reqUtils.exist('id', Traveler),
                                        # reqUtils.canReadMw('id')), styled
                                        # exactly like the existing
                                        # GET /travelers/:id/notes/ a few
                                        # lines above it — queries Ncr by
                                        # traveler_link.traveler_id, returns
                                        # the flat array per
                                        # contracts/traveler-ncr-links.json

views/ncr-create.jade                # on load, read traveler_id/input_name/
                                        # input_label from location.search
                                        # (URLSearchParams); if traveler_id
                                        # is present, show a small banner
                                        # naming the input this NCR will be
                                        # linked to, and merge the three
                                        # values into the existing payload
                                        # object before the POST /api/ncrs
                                        # call

views/ncr-detail.jade                # if ncr.traveler_link &&
                                        # ncr.traveler_link.initiated_from_traveler,
                                        # add an "Originating Traveler"
                                        # fieldset: a link to
                                        # /travelers/:traveler_id/ and the
                                        # input_label — per data-model.md
                                        # and User Story 3; absent entirely
                                        # for a non-traveler-initiated NCR

public/javascripts/lib/traveler.js   # add renderNcrLinks(), a sibling of
                                        # the existing renderNotes(): fetch
                                        # GET ./ncr-links/, iterate
                                        # #form .controls exactly as
                                        # renderNotes() does, and for each
                                        # field (a) if its name is in
                                        # window.traveler.touchedInputs,
                                        # append an "Initiate NCR" link
                                        # (href built from prefix +
                                        # '/ncrs/new?traveler_id=' +
                                        # window.traveler._id +
                                        # '&input_name=' + encoded name +
                                        # '&input_label=' + encoded label,
                                        # the label read from
                                        # window.traveler's active form's
                                        # labels map — same
                                        # single-form-vs-activeForm branch
                                        # utilities/routes.js's
                                        # resetTouched() already uses); (b)
                                        # append a badge+link for every
                                        # matching entry in the fetched
                                        # array, per input_name; called
                                        # once at load, right next to the
                                        # existing renderNotes() call inside
                                        # renderHistory()

public/javascripts/traveler.js       # in the '#form' 'click' handler on
                                        # 'button[value="save"]', inside the
                                        # existing first-time-touched branch
                                        # (the `else` alongside
                                        # incrementFinished(), ~line 642):
                                        # push input.name into
                                        # window.traveler.touchedInputs if
                                        # not already present, then reveal
                                        # the "Initiate NCR" link for that
                                        # one field immediately (no reload) —
                                        # research.md Decision 3

e2e/fixtures/cli.js                  # createTravelerLinkedNcr(): rename its
                                        # stepNumber param/destructure to
                                        # inputName, and the ncrData it
                                        # builds from step_number: stepNumber
                                        # to input_name: inputName (default
                                        # undefined is fine — most existing
                                        # callers only care about
                                        # initiated_from_traveler, not the
                                        # value)

e2e/us1-create-and-submit-ncr.spec.js          # rename stepNumber: 1 →
e2e/us-admin-ncr-deletion.spec.js              # inputName: 'field_1' (or
e2e/us-originator-designate.spec.js            # similar placeholder) in
e2e/us2-ce-cs-disposition.spec.js              # each call to
e2e/us3-qa-concurrence-and-approver-coordination.spec.js  # create-traveler-linked-ncr —
e2e/us-ncr-attachments.spec.js                 # these 6 files only need
                                                  # initiated_from_traveler
                                                  # to be true for their own
                                                  # (unrelated) assertions,
                                                  # so any placeholder value
                                                  # keeps them passing

test-unit/lib/ncr-service.test.js    # update the two traveler_id/
                                        # traveler_step_number fixtures (line
                                        # ~226, ~917, ~948 per research) to
                                        # traveler_input_name, and the
                                        # assertion on
                                        # ncr.traveler_link.step_number to
                                        # ncr.traveler_link.input_name
```

### Source Code — Files Added

```text
e2e/us-traveler-ncr-input-linking.spec.js   # initiate NCR from a filled-in
                                               # input; no action offered for
                                               # an untouched input; traveler
                                               # shows link+live status;
                                               # status updates reflect after
                                               # a disposition change; a
                                               # second NCR from the same
                                               # input is never blocked and
                                               # both show distinctly; NCR
                                               # detail shows the traveler
                                               # link + input label; a
                                               # standalone (non-traveler)
                                               # NCR shows neither; two
                                               # travelers sharing an input
                                               # name never cross-link
```

### Source Code — Files NOT Changed

```text
model/traveler.js                    # no schema change — touchedInputs
                                        # (existing field) already means
                                        # exactly what FR-001/FR-002 need;
                                        # no new per-input storage is added
                                        # (research.md Decision 1)
public/javascripts/traveler-form-loader.js  # dead code (research.md) —
                                               # not touched, not the file
                                               # this feature extends
utilities/routes.js                  # resetTouched()'s existing logic is
                                        # reused conceptually (the
                                        # single-form-vs-activeForm label
                                        # lookup) but not modified — the new
                                        # client-side label lookup is a
                                        # small, independent read, not a
                                        # call into this function
lib/req-utils.js                     # no change — reqUtils.canReadMw/
                                        # exist are used as-is by the new
                                        # traveler route
```

## Complexity Tracking

No constitution violations. This feature fixes a previously dead,
wrongly-typed field rather than adding new storage, adds exactly one new
read-only endpoint styled identically to an existing sibling endpoint on the
same file, and reuses the existing NCR creation page and existing
per-input-badge client-side mechanics rather than introducing new UI
patterns.
