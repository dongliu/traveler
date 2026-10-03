# Implementation Plan: Traveler-Driven NCR Input Flow and Live Status

**Branch**: `125-traveler-ncr-input-flow` | **Date**: 2026-10-03 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/125-traveler-ncr-input-flow/spec.md`

## Summary

Five changes to the traveler and NCR screens, with one server rule added:

1. **Remove the reference path.** Delete the copy-reference control on every traveler input and the traveler field on the standalone NCR form. The "Initiate NCR" action remains the only way a web user links an NCR to an input; the form it opens shows the traveler and input as fixed context.
2. **Per-input choice.** On an active traveler, every input shows **Input** and **Initiate NCR**. Inputs are read-only until **Input** is chosen; choosing it hides **Initiate NCR** for that input.
3. **Open-NCR hold.** While an input has a linked NCR that is not Closed, **Input** is not offered for it. It returns when the NCR closes.
4. **Submission gate.** **Submit for completion** is enabled only when every linked NCR is Closed and every counted input has a saved, non-empty value. The server enforces the same rule on the page route and the REST API, and returns the reasons.
5. **30-second live status.** The active traveler page polls one lightweight status endpoint every 30 s and refreshes what changed. The NCR page polls its own status endpoint and re-renders its body only when the NCR has changed and the user has nothing unsaved.

Technical approach: no new dependencies. Server rules go in the existing `lib/traveler-ncr.js` module, which already owns the open-NCR refusal. Client changes go in the two existing traveler modules and `views/ncr-detail.jade`, plus one small shared client module for the 30-second timer.

## Technical Context

**Language/Version**: JavaScript, Node.js 18+ (unchanged)

**Primary Dependencies**: Express 4, Mongoose 7, Pug (views), jQuery 3.7 and Bootstrap 2-era markup on the client (unchanged). No new dependencies.

**Storage**: MongoDB via Mongoose. No new collection. No schema change: `Traveler.labels`, `Traveler.touchedInputs`, `Traveler.finishedInput`, `TravelerData` (name, value, inputOn) and `Ncr.traveler_link` are read as they are. (Research R1 explains why the submission check reads `TravelerData`, not `touchedInputs`.)

**Testing**: Mocha unit tests in `test-unit/` (`npm run unit`) for `lib/traveler-ncr.js`; Playwright end-to-end tests in `e2e/` (`npm run e2e`) for the page behaviour, following the pattern of `e2e/us-traveler-ncr-gating.spec.js`.

**Target Platform**: Browser (desktop, the existing traveler and NCR pages) and the existing Basic-auth REST API.

**Project Type**: Web application (server-rendered Pug pages with jQuery client code, plus a REST API), in one repository.

**Performance Goals**: One status request per open traveler page and per open NCR page every 30 s. A status response is small: no input values, no rich-text bodies (Research R2).

**Constraints**: No full-page reload on refresh. A refresh never changes text the user has typed or a value they are entering. The submission gate must be enforced on the server; the page's disabled button is advisory. The 409 refusal shape stays backward compatible (`code` and `open_ncrs` unchanged).

**Scale/Scope**: About 15 active travelers and NCRs open per user session in a typical deployment; polling load scales with open tabs, not total records.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Checked against `.specify/memory/constitution.md` v1.1.0.

| Principle | Status | How this plan meets it |
|---|---|---|
| I. Automated Testing | Pass (with a note) | Unit tests for the new gate and the live-status builder in `test-unit/lib/traveler-ncr.test.js`. Integration coverage through the REST route and the page's 409 handling. Playwright for the page behaviour (the constitution recommends E2E for critical journeys). Each removed behaviour gets its test changed, not deleted without replacement. |
| II. Code Quality and Consistency | Pass | Server rules live in `lib/traveler-ncr.js`, not in routes (the constitution asks for this). The 30-second timer is one shared client module, not copied into two pages. |
| III. Security-First Architecture | Pass | The two new GET endpoints use the existing `auth.ensureAuthenticated` and `reqUtils.canReadMw`, the same as `GET /travelers/:id/ncr-links/`. The NCR fragment is rendered by the server from data the caller may already read. The live-status payload contains no values and no PII beyond what the traveler and NCR pages already show. |
| IV. Versioning & Breaking Changes | Pass (with a note) | The 409 body gains a new code (`INPUTS_MISSING`) and a `missing_inputs` field; existing codes are unchanged. However, REST integrations that submitted a traveler with blank inputs will now be refused. This is a behaviour change, documented in CLAUDE.md and the OpenAPI spec, and called out in the release notes (Constitution IV: communicate breaking changes). Recorded as a justified exception below. |
| V. Documentation | Pass | `tools/openapi/openapi.yaml` gets the two new endpoints and the new 409 body. CLAUDE.md's 124 entry is updated to say the reference path is removed. The three superseded spec sections are noted at the top of spec 125. |

**Gate result**: PASS. One justified exception, recorded in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/125-traveler-ncr-input-flow/
├── spec.md
├── plan.md                         # this file
├── research.md                     # Phase 0 decisions
├── data-model.md                   # Phase 1: entities and derived states
├── quickstart.md                   # Phase 1: how to verify by hand and by e2e
├── contracts/
│   ├── traveler-live-status.json   # new GET /travelers/:id/live-status/
│   ├── ncr-live-status.json        # new GET /ncrs/:id/live-status and /fragment
│   └── traveler-completion-refusal.json  # 409 body: new INPUTS_MISSING code
├── checklists/requirements.md
└── tasks.md                        # created by /speckit-tasks
```

### Source Code (repository root)

```text
lib/
├── traveler-ncr.js            # + assertInputsComplete, + missingInputs(), + buildLiveStatus()
└── traveler.js (routes helper)  # submit gate call site (line ~64) updated

routes/
├── traveler.js                # + GET /travelers/:id/live-status/
├── api.js                     # submit gate call sites (lines ~345 and ~739)
└── ncr.js                     # + GET /ncrs/:id/live-status, + GET /ncrs/:id/fragment;
                               #   GET /traveler-input kept (used for the read-only banner)

views/
├── ncr-create.jade            # remove "Traveler Input" field and preview; add read-only banner
└── ncr-detail.jade            # body split into a partial so the fragment route reuses it

public/javascripts/
├── lib/live-refresh.js        # NEW: shared 30 s timer, pause on hidden tab, in-flight guard
├── lib/traveler.js            # remove copy-reference code; per-input options; renderNcrLinks rewrite
└── traveler.js                # Input/Save/Reset gating; submit button state; poll consumer;
                               #   replace the "submit anyway" confirmation

public/stylesheets/style.css   # remove .ncr-ref-* rules; add option-button and waiting styles

test-unit/lib/
├── traveler-ncr.test.js       # + gate and live-status tests
└── ncr-service.test.js        # unchanged unless a helper moves

e2e/
├── us-traveler-ncr-gating.spec.js        # reference-path and copy-control scenarios retired
├── us-traveler-ncr-input-linking.spec.js # "Initiate NCR" scenarios updated (value no longer required)
└── us-traveler-input-flow.spec.js        # NEW: Input/Initiate choice, hold, submit gate, polling

tools/openapi/openapi.yaml     # two new endpoints; new 409 body
```

**Structure Decision**: Extend the existing web-app layout. No new top-level directory. The only new file in `lib/` is none (new helpers go into `lib/traveler-ncr.js`); the only new client file is `public/javascripts/lib/live-refresh.js`, because two pages need the same timer and the constitution asks for shared code over duplication.

## Phase 0 and Phase 1 outputs

- [research.md](research.md): decisions R1–R8 (value rule, live-status transport, submission gate shape, reference-path removal, input gating, traveler polling, NCR refresh, shared timer).
- [data-model.md](data-model.md): the derived states of an input and a traveler's submission readiness, with no new stored fields.
- [contracts/](contracts/): the two new read endpoints and the amended 409 body.
- [quickstart.md](quickstart.md): how to run the feature by hand and through the e2e suite.

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Constitution IV: REST submissions with blank inputs are now refused (a behaviour change for existing integrations, not a signature change) | The request says a traveler can only be submitted when all inputs have values. A check that only the web page enforces would let the rule be bypassed through the API. | Enforcing only in the page was rejected: the spec requires the rule to hold on every route (FR-021). The change is additive in shape (same 409 status, new code) and is documented as a behaviour change. |
