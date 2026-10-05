# Research: Traveler-Driven NCR Input Flow and Live Status

No open NEEDS CLARIFICATION remain. Each decision below resolves a question the
spec left to the plan, and each cites the code it was checked against.

## R1 — What "has a saved, non-empty value" means

**Decision**: An input has a value when a `TravelerData` entry exists for its
name on this traveler and its stored value is not empty. Empty means `null`,
`undefined`, an empty string, or an empty array (a checkbox set with nothing
ticked). The check reads `TravelerData` through `traveler.data`, not
`traveler.touchedInputs`.

**Rationale**: `touchedInputs` is set on every save, including a save of an empty
value (`public/javascripts/traveler.js` Save handler appends the name without
checking it). The spec (User Story 4, FR-019) requires a non-empty value, so the
stored value has to be read. `finishedInput` keeps its existing meaning
(`finishedCount` in `utilities/routes.js` is unchanged), so existing progress
figures do not move.

**Alternatives considered**:
- Use `touchedInputs` alone. Rejected: a blank save would pass the submission
  gate, contradicting the spec.
- Add a stored `hasValue` flag on `Traveler`. Rejected: a second source of truth
  to keep in step with `TravelerData`, and a migration. Not needed for a check
  done once per submission and once per poll.

## R2 — Transport for live status on the traveler page

**Decision**: One new read endpoint, `GET /travelers/:id/live-status/`, that
returns the traveler's status, its finished and total counts, one entry per
counted input (name, label, whether it has a value, a `revision` string, and its
open and closed NCR counts), the list of open NCRs, and the list of missing
inputs. It does not return values. The client fetches the full saved values
(`GET /travelers/:id/data/`, which exists) only when an input's `revision` has
changed since the last poll.

**Rationale**: The request asks for a lightweight poll. Returning values for
every input every 30 s would transfer rich-text bodies and uploads repeatedly.
The `revision` string lets the client fetch only what changed. The payload is
built by one function in `lib/traveler-ncr.js`, so the page and the submission
check read the same state.

**Alternatives considered**:
- Re-fetch `/travelers/:id/data/` and `/travelers/:id/ncr-links/` every 30 s.
  Rejected: two requests, full values every time, and the submission check would
  still need its own source.
- Server-sent events or websockets. Rejected: the spec asks for a lightweight 30 s
  pull; a push channel is more infrastructure than the feature needs and the app
  has no such channel today.

## R3 — Shape of the submission gate

**Decision**: Add `assertInputsComplete(traveler)` to `lib/traveler-ncr.js` and a
combining function `assertSubmittable(travelerId)` that runs the existing
`assertNoOpenNcrs` check and then the new input check. The three call sites
(`lib/traveler.js` status handler, `routes/api.js` status handler at ~345, and the
`POST /apis/update/traveler/:id/` path at ~739) call `assertSubmittable`. Failure
raises `TravelerNcrError`:
- When open NCRs exist: code `OPEN_NCRS` (409), as today, plus `missing_inputs`
  if any also exist.
- When only inputs are missing: code `INPUTS_MISSING` (409), with `missing_inputs`
  and `open_ncrs: []`.

**Rationale**: One refusal shape for the page and the API. `OPEN_NCRS` keeps its
meaning for existing integrations; the new code is additive.

**Alternatives considered**:
- A single new code `SUBMISSION_BLOCKED` for both. Rejected: it would change the
  meaning of `OPEN_NCRS` for callers that already branch on it.
- Check the input rule only in the page. Rejected: the spec requires it on every
  route (FR-021).

## R4 — Removing the reference path from the NCR form

**Decision**: In `views/ncr-create.jade`, delete the "Traveler Input" control
group (the input, its help text and `#traveler-ref-preview`) and the JavaScript
that reads and validates it on input and blur. When the page is opened with
`?traveler_input_ref=` (from "Initiate NCR"), it calls the existing
`GET /ncrs/traveler-input` and renders a read-only line: "Linked to: <traveler
title> — <input label>", with a hidden field carrying the reference on submit.
Server-side handling in `routes/ncr.js` (`requestedTravelerRef`,
`sendTravelerRefError`) is unchanged, so the REST API keeps its link (see the
spec's Assumptions).

**Rationale**: The user can only start a traveler-linked NCR from the traveler,
and the spec (FR-004) requires the context to be visible and fixed. Reusing
`GET /ncrs/traveler-input` means the banner cannot disagree with what the
submission accepts.

**Alternatives considered**:
- Remove the banner and pass the reference silently. Rejected: the user would not
  see which input the NCR is linked to before submitting.
- Remove `traveler_input_ref` from the server as well. Rejected: the "Initiate
  NCR" action depends on it, and integrations use it. Revisit only if the user
  wants the REST path closed too (flagged in the spec).

## R5 — Per-input options and input gating on the traveler page

**Decision**: On an active traveler, `renderNcrLinks` (in
`public/javascripts/lib/traveler.js`) renders each counted input's two options:
an **Input** button and an **Initiate NCR** link (the existing `initiate-ncr-link`
markup, now shown for every input). Form controls are disabled on load for every
input. Clicking **Input** on one input enables that input's controls only, adds
the existing Save and Reset buttons, hides its **Initiate NCR** link, and disables
every other input's options (the existing `formInputMade` behaviour extended to
the new buttons). Save and Reset return the input to its default state, with both
options. The **Input** option is not rendered while the input has an open linked
NCR. The `traveler.status === 1` check in `appendInitiateNcrLink` is kept.

**Rationale**: It reuses the existing Save/Reset and `formInputMade` machinery,
which already enforces one input at a time. The change is in what is disabled on
load and what the options do.

**Alternatives considered**:
- Hide the controls with CSS and reveal them on click. Rejected: disabled controls
  keep keyboard and screen-reader state correct without a second set of rules.

## R6 — Live refresh on the traveler page

**Decision**: `public/javascripts/traveler.js` starts the shared timer
(R8) when the page loads and the traveler is active. Each tick calls
`GET /travelers/:id/live-status/` and applies it: updates the finished and total
figures, the input options and waiting markers, the NCR badges, the submit
button's enabled state and its reasons, and, when an input's `revision` changed
and that input is not in Input mode, fetches the saved values for that input and
updates it. If the traveler is no longer active, the timer stops and the input
options, **Initiate NCR**, and **Submit for completion** are removed or disabled.
An input in Input mode is never overwritten (FR-027); its update is applied when
the user saves or resets.

**Rationale**: The page already has the rendering code (`renderNcrLinks`, the
finished counter, the status display). The poll reuses those functions instead of
rebuilding the page.

**Alternatives considered**:
- Reload the page every 30 s when nothing is being edited. Rejected: it loses scroll
  position and any open popup, and the spec asks for no reload.

## R7 — Live refresh on the NCR page

**Decision**: `views/ncr-detail.jade`'s main body moves into a partial,
`views/ncr-detail-body.jade`, which both the page and a new
`GET /ncrs/:id/fragment` route render. The new `GET /ncrs/:id/live-status` returns
the NCR's `status`, `updated_at` and the count of events, which is the revision
token. The page polls this every 30 s; when the token changes and the page has no
unsaved entry and no open dialog, it fetches the fragment and swaps the body. If
the user has an unsaved entry or a dialog open, the swap waits until they save or
close it (FR-033).

"Unsaved entry" means any form control on the page whose value differs from the
value it had when the page loaded, or any Bootstrap modal that is shown.

**Rationale**: The NCR page is server-rendered and has many sections. Re-rendering
only the body keeps the header, the navigation and any open browser state. The
token check keeps the fragment request out of the common case where nothing
changed.

**Alternatives considered**:
- Full page reload, skipped when a form is dirty. Rejected: the spec requires no
  reload, and a dirty check would still need to exist.
- Re-render every section client-side. Rejected: it duplicates the Pug templates in
  JavaScript.

## R8 — Shared 30-second timer

**Decision**: A new file, `public/javascripts/lib/live-refresh.js`, exports
`startLiveRefresh(callback, { intervalMs: 30000 })`. It runs the callback every
interval, skips a tick while the previous call is still in flight, stops the timer
when the document is hidden and runs once immediately when it becomes visible
again, and returns a stop function. Both pages use it. A failed call is swallowed
by the caller (the page keeps its last state, FR-029).

**Rationale**: Two pages need the same behaviour, and the constitution asks for
shared code over duplicated code. It is small enough to test in isolation.

**Alternatives considered**:
- A timer inline in each page. Rejected: the pause-on-hidden and in-flight rules
  would be written twice and drift apart.
