# Implementation Plan: Admin Traveler Unarchive

**Branch**: `131-unarchive-traveler` | **Date**: 2026-11-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/131-unarchive-traveler/spec.md`

## Summary

Today, once a traveler's numeric lifecycle `status` reaches `4` ("archived"), `model/traveler.js`'s `stateTransition` table has no `{ from: 4, ... }` entry, so `lib/traveler.js#updateStatus` (and its Basic-Auth-API twin in `routes/api.js`) always refuses any further status change — archiving is a one-way trap. This plan adds a dedicated, admin-only `PUT /travelers/:id/unarchive` (web only; see D6 for why not the REST API) that restores the traveler to exactly the status it held immediately beforehand. That prior status is captured in a new scalar field, `statusBeforeArchive`, set at every existing "status → 4" call site (the web and API status routes) and consumed by the new endpoint. No general status-change audit trail is added — a single recorded value fully answers the one question this feature needs answered ("what do I restore to"), and research.md D4 records why a broader history mechanism was considered and deliberately left out.

## Technical Context

**Language/Version**: JavaScript, Node.js 18+ (unchanged)

**Primary Dependencies**: Express 4, Mongoose 7, Pug/Jade (views) — no new dependency, no reuse of `model/history.js`'s `addHistory` plugin (considered and deliberately not used — research.md D4).

**Storage**: MongoDB via Mongoose. One additive field on the existing `Traveler` schema (`statusBeforeArchive: Number`, absent by default). No new collection, no migration script — every traveler already archived today simply has no `statusBeforeArchive`, which the unarchive action's legacy fallback (restore to `Active`) already accounts for. See [data-model.md](data-model.md).

**Testing**: `tests/lib/traveler.test.js` (unit — new `unarchiveTraveler` coverage: restores to the recorded prior status for each of the three possible source statuses, falls back to `Active` when none is recorded, refuses when the traveler is not currently archived; extends `updateStatus` coverage for the new `statusBeforeArchive` capture on archiving). Extends `e2e/us-traveler-ncr-gating.spec.js` (already seeds status `4` via the `set-traveler-status` fixture and already exercises `PUT /apis/travelers/:id/status/`) with the end-to-end admin-unarchive and non-admin-refusal scenarios.

**Target Platform**: Browser, via the existing session-authenticated web app (port 3001). The Basic-Auth REST API (port 3002) is deliberately **not** extended with an unarchive endpoint (D6) — it authenticates as one shared `api_write` credential with no per-user role concept, so "admin-only" cannot be meaningfully enforced there, matching how no other admin-only traveler action (e.g. deletion) is exposed through it today. The API's existing archive-*in* path still needs the `statusBeforeArchive` capture added, since archiving itself remains reachable through it.

**Project Type**: Web application (server-rendered Pug/Jade + a parallel REST API), extending the existing single-repository layout — no new project or module.

**Performance Goals**: No new query or extra write beyond the single `findById` + one save per status change that `updateStatus` already performs today; capturing `statusBeforeArchive` adds one field to an already-happening save, not an additional write.

**Constraints**: None beyond what already applies to the existing status routes — no new assumption about request shape, no new failure mode introduced at either call site.

**Scale/Scope**: `model/traveler.js` (1 field added), `lib/traveler.js` (1 function added, 1 extended), `routes/traveler.js` (1 endpoint added), `routes/api.js` (1 existing endpoint extended, no new route), `views/traveler-viewer.jade` (1 admin-only button). No new files except tests and this spec's own documentation.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Checked against `.specify/memory/constitution.md` v1.1.0.

| Principle | Status | How this plan meets it |
|---|---|---|
| I. Automated Testing | Pass (pending Phase 2) | Every FR in spec.md — admin-only restore, refusal when not archived, correct restoration for each of the three possible source statuses, and the legacy fallback to `Active` — gets a direct unit test in `tests/lib/traveler.test.js`, extending that file's existing patterns rather than introducing new test infrastructure, plus new e2e coverage of the full admin/non-admin flow. |
| II. Code Quality and Consistency | Pass | The new capability is one function in `lib/traveler.js` (`unarchiveTraveler`), shaped like `updateStatus` in the same file; the new route is middleware composition mirroring the existing `DELETE /travelers/:id/` admin-only pattern already in `routes/traveler.js`. No new logic lives directly in a route handler. |
| III. Security-First Architecture | Pass | Authorization (`reqUtils.requireAdmin()`) is checked before any request data is read. The endpoint accepts no request body at all — the destination status is entirely server-determined, never client-supplied — which removes an entire class of input-validation concern rather than adding one. |
| IV. Versioning & Breaking Changes | Pass | No existing endpoint's request or response shape changes. The one behavior change to existing code — `routes/api.js`'s status endpoint also capturing `statusBeforeArchive` when archiving — is purely additive (one new field populated on an existing write) with no change to that endpoint's response shape or failure modes. |
| V. Documentation | Pass (pending implementation) | CLAUDE.md gets a `131` "Recent Changes" entry following the existing `121`–`130` format, explicitly noting that the REST API is deliberately not extended and why. |

**Gate result**: PASS. No violation requires an entry in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/131-unarchive-traveler/
├── spec.md
├── plan.md                         # this file
├── research.md                     # Phase 0 decisions (D1-D7)
├── data-model.md                   # Phase 1: schema field, state notes
├── contracts/
│   └── api-traveler-unarchive.md   # new endpoint + additive change to existing ones
├── quickstart.md
├── checklists/requirements.md
└── tasks.md                        # created by /speckit-tasks
```

### Source Code (repository root)

```text
model/
└── traveler.js             # + statusBeforeArchive: Number (no default, absent by default)

lib/
└── traveler.js              # + unarchiveTraveler(req, res): 409 unless doc.status === 4;
                             #     restores to statusBeforeArchive ?? 1 (Active); clears the
                             #     field; saves via doc.save()
                             #   updateStatus(): when req.body.status === 4, also set
                             #     statusBeforeArchive = oldStatus (save mechanism unchanged)

routes/
├── traveler.js               # + PUT /travelers/:id/unarchive (auth.ensureAuthenticated,
                             #     reqUtils.exist('id', Traveler), reqUtils.requireAdmin() --
                             #     deliberately no archived/canWrite guard, since the whole
                             #     point is acting on an archived document)
└── api.js                    # PUT /apis/travelers/:id/status/ (existing route, no new one):
                             #   when status===4, also set statusBeforeArchive (save mechanism
                             #   unchanged)

views/
└── traveler-viewer.jade     # + admin-only "Unarchive" button when traveler.status === 4,
                             #   alongside the existing status-4-gated "Create PDF" button;
                             #   PUTs /travelers/:id/unarchive with no body, then reloads

tests/lib/
└── traveler.test.js          # + unarchiveTraveler coverage (restore per source status,
                             #     legacy fallback to Active, refusal when not archived)
                             #   + updateStatus coverage for statusBeforeArchive capture

e2e/
└── us-traveler-ncr-gating.spec.js   # extended: admin unarchive (each source status +
                             #   legacy fallback), non-admin refusal -- this file already
                             #   seeds status 4 and exercises the API status endpoint
```

**Structure Decision**: No new project, module, or view directory — this is a behavior extension entirely within the existing single-repository web app. One model file, one lib file (one function added, one extended), one route file gaining a new endpoint, one existing API route extended (deliberately no new API route — D6), and one view file. No deletions. `lib/review.js` is untouched — it never sets a traveler's status to `4`, so it has nothing to do with this feature.

## Phase 0 and Phase 1 outputs

- [research.md](research.md): decisions D1–D7 — the scope boundary against the separate boolean archive lock, why the admin gate is a hard role check rather than the config-driven permission the original archive-*in* path uses, why unarchive is a dedicated no-body endpoint rather than an extension of the generic status route, why "previous status" is a direct field and why a general status-change audit trail was considered and deliberately not built, the legacy-fallback behavior, why the REST API gets no new endpoint, and the UI placement.
- [data-model.md](data-model.md): the new `statusBeforeArchive` field, its lifecycle, and the (unchanged) `stateTransition` table plus the new out-of-band `4 → {0,1,2}` path.
- [contracts/api-traveler-unarchive.md](contracts/api-traveler-unarchive.md): the new endpoint's exact request/response shape, and the purely-additive side effects on the two existing endpoints/functions that can set `status` to `4`.
- [quickstart.md](quickstart.md): a by-hand walkthrough (archive → confirm trapped → admin unarchives → confirm restored; non-admin refusal; legacy-fallback case) plus the automated commands to run.

## Complexity Tracking

*(none — Constitution Check passed with no violations)*
