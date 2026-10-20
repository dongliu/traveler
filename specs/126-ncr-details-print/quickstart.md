# Quickstart: Extend Traveler Print Output with NCR Details

How to run and check this feature. Implementation steps are in `tasks.md`.

## Prerequisites

- Docker stack up: `docker compose up` (web on 3001, API on 3002).
- `.env` has `E2E_USER`, `E2E_PASS`, `E2E_USER2`, `E2E_PASS2` (see `.env.example`).
- First time only: `npx playwright install chromium`.
- Unit tests outside Docker need `TRAVELER_CONFIG_REL_PATH=docker`.

## 1. Unit tests

```bash
npm run unit
npx mocha test-unit/lib/traveler-ncr.test.js
```

Expected: `findAllLinkedNcrs` queries every status (no `status` filter,
unlike `findOpenNcrs`), sorted oldest-first as a baseline;
`orderNcrsByFormPosition` re-sorts that baseline to match the order its
linked inputs appear in the given form labels, puts an NCR whose input
isn't in that map last, and keeps same-input NCRs in their oldest-first
order; `reviewRecordRows` maps `'1'`/`'2'` to `Approved`/`Rejected`, keeps
every recorded result including a voided one, and falls back to the raw id
when a name is not in the given map.

## 2. Manual walk-through

1. Open the print view (`/travelers/<id>/print`) for a traveler that has:
   at least two NCRs linked to different inputs (one Closed is enough — a
   traveler cannot complete with an open one), and a review history
   (submitted, then approved by a reviewer).
   - Expect: the traveler's own content renders as it does today. Shortly
     after the page loads, a new "Approvals" section appears (reviewer,
     outcome, date, comment), and — after the form — a "Nonconformance
     Reports" section listing every linked NCR, one after another, each
     with its own substantive detail and no Event History listing.
   - Expect: the **Create PDF** button is disabled/greyed until both of
     these finish loading, then becomes clickable.
2. Open the browser's network tab and confirm two new requests:
   `GET .../ncr-print-details/` and `GET .../review-records/`.
3. Click **Create PDF** and confirm the browser's print/save-as-PDF output
   includes everything from step 1 — this feature adds no new step to that
   action (FR-008).
4. Open the print view for a traveler with no linked NCRs.
   - Expect: a clear "no NCRs" statement instead of silence.
5. Open the print view for a traveler with no review history on record
   (e.g., completed by a direct status change).
   - Expect: a clear "no approvals" statement instead of silence.
6. Open the print view for a traveler whose NCR/review free text contains
   characters that look like markup (`<b>`, `"`, `&`).
   - Expect: the characters render literally as text; the page's structure
     is unaffected (open devtools and confirm no stray elements were
     injected).

## 3. End-to-end suite

```bash
npm run e2e -- e2e/us-traveler-print-ncr-details.spec.js
```

New spec. Covers: both new endpoints return the right shape and ordering;
linked NCRs render on the page, gathered after the form, with no Event
History; a traveler with none states so; approvals render automatically
(including a voided result, marked as such); a traveler with no review
history states so; free text with markup-like characters renders as plain
text; `#create-pdf` is disabled until both fetches resolve.

## Acceptance

Feature is done when: unit tests pass; the e2e spec passes; the manual
walk-through in section 2 matches its expectations; and `npx eslint .`
reports no new errors.
