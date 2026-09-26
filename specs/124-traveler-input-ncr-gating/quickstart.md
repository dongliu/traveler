# Quickstart: Traveler Input NCR Gating and Closure Record

**Feature**: `124-traveler-input-ncr-gating` | **Spec**: [spec.md](./spec.md)

## What this feature adds

On top of 123 (initiate an NCR from a filled-in traveler input; see its link and
status on the input), a user can now:

1. **Link by reference** — copy `traveler_id::input_name` from any input on a
   traveler and paste it into the NCR initiation form.
2. **Only against active travelers** — both entry paths refuse a traveler that
   is not active.
3. **Submitting the traveler for completion approval is blocked** while any linked
   NCR is not Closed; the refusal lists them.
4. **Input progress** does not count an input that has an open NCR.
5. **Closure PDF** — closing a traveler-linked NCR attaches a PDF of it to the input.

Design detail: [data-model.md](./data-model.md). Endpoint changes:
[contracts/traveler-input-lookup.json](./contracts/traveler-input-lookup.json),
[contracts/ncr-create-traveler-input-ref.json](./contracts/ncr-create-traveler-input-ref.json),
[contracts/traveler-completion-refusal.json](./contracts/traveler-completion-refusal.json),
[contracts/traveler-ncr-pdfs.json](./contracts/traveler-ncr-pdfs.json),
[contracts/ncr-close-response.json](./contracts/ncr-close-response.json).

## Prerequisites

- `npm install` — this feature adds two runtime dependencies (`pdfkit`,
  `dejavu-fonts-ttf`), so a Docker stack needs `docker compose up --build`
  once to pick them up.
- Two users: an **owner** who can fill in the traveler, and a second user who
  can only **view** it (this app's default `publicAccess: 0` gives every
  authenticated user read access and restricts writes to the owner).
- An **active** traveler with at least three inputs (A, B, C), with A and B
  filled in and C left blank. A second traveler that is **not** active
  (submit one for completion, or use one already completed/frozen).

## Manual verification

### 1 — Link by reference (User Story 1)

1. As the owner, open the active traveler. At input A find **Copy NCR
   reference** and click it. Confirm a "Copied" confirmation appears.
2. Repeat on input C (unfilled) — the control is there too.
3. Open `/ncrs/new`. Paste the reference into **Traveler input**. Confirm the
   form shows the traveler's title and input A's label.
4. Complete the other required fields and submit. Confirm creation succeeds.
5. Open the traveler: input A shows the new NCR's link and status. Open the
   NCR: it shows the traveler link and input A's label.
6. Click **Initiate NCR** on input B instead. Confirm `/ncrs/new` opens with the
   **same field already filled** with B's reference and its preview shown.
7. Leave the field blank on a fresh `/ncrs/new` and submit. Confirm a standalone
   NCR is created and shows no traveler/input section.
8. Try each bad value and confirm a specific message and **no NCR created**:
   `abc`, `::x`, `<valid id>::`, a valid id + a made-up input name, a valid
   ObjectId that is not a traveler, and a reference with spaces around it
   (that last one should **work**).

### 2 — Only active travelers (User Story 2)

1. On the non-active traveler, confirm no **Initiate NCR** action is offered.
2. Paste a reference to one of its inputs into `/ncrs/new` and submit. Confirm
   the refusal names its status (e.g. "submitted for completion") and no NCR exists.
3. Open `/ncrs/new` with an active traveler's reference, then (in another tab)
   move that traveler out of active, then submit. Confirm it is refused.

### 3 — Submission for completion approval is blocked (User Story 3)

1. With an open NCR linked to input A, click **Submit for completion** on the
   traveler. Confirm it is refused and the traveler stays active, the message
   lists the NCR (number, status, input, link), and the form inputs are
   **still editable** (not left disabled).
2. As an administrator, try the same. Confirm it is still refused.
3. Repeat with two NCRs, closing only one. Still refused until both are Closed.
4. Close every linked NCR and click **Submit for completion** again. Confirm it
   goes through to approval exactly as before.
5. (Resubmission) With no open NCRs, submit the traveler and have a reviewer
   reject it, so it returns to active. Raise a new NCR against it and submit
   again. Confirm the second submission is refused.
6. (Legacy API) With an open NCR linked, use the REST API to set the traveler's
   status to 1.5, and to 2 while it is still active. Confirm both are refused
   with `409 OPEN_NCRS`.

### 4 — Input progress (User Story 4)

1. Note the "N inputs finished out of M" figure with A and B filled in (2).
2. Raise an NCR against A. Reload: the figure drops to 1, and A's NCR is listed
   in a warning box under the input. Edit A's value to confirm editing still works.
3. Raise an NCR against **unfilled** C by reference. Fill C: the figure does
   not rise while that NCR is open.
4. Check the same traveler in the travelers list and, if it is in a binder, the
   binder's progress: both show the reduced figure.
5. Close the NCR on A: reload shows the figure back up. Delete the NCR on C as
   an administrator: the figure updates again.

### 5 — Closure PDF (User Story 5)

1. Take an NCR linked to input A through to **Final Approval**, then close it as
   the originator (traveler sign-off box ticked).
2. Open the traveler: input A's warning box shows the NCR on its own row, and on
   that same row, after **Close report:**, a PDF link named for the NCR number. As
   the view-only user, confirm the link is also visible and opens. Delete the NCR
   as an administrator and reload: the report is still there, on a row of its own
   with the NCR's number and no NCR link.
3. Open the PDF. Confirm it lists: NCR number/status/dates, the traveler and
   input, part/supplier/PO, description and discovery, CE/CS, disposition,
   approvals, preventive actions, the closure record with the traveler sign-off,
   attachment **file names**, and the event history. Include an `Ω` or `≥` in the
   description beforehand and confirm it renders.
4. Close a second NCR on the same input. Confirm **two** PDFs are listed.
5. Close an NCR that is **not** traveler-linked. Confirm no attachment appears anywhere.
6. Failure path: delete the linked traveler's input from the fixture data (or
   point an NCR at a removed traveler) and close it. Confirm the NCR still
   closes, the close page shows a warning, and the NCR's history has a
   `traveler.pdf_failed` event.
7. As an administrator, delete the NCR from step 2. Confirm the traveler still
   lists and opens its PDF.

## Automated verification

```bash
# lint
npx eslint .

# unit — new: traveler-ncr, ncr-pdf; extended: ncr-service
TRAVELER_CONFIG_REL_PATH=docker npm run unit
TRAVELER_CONFIG_REL_PATH=docker npx mocha test-unit/lib/traveler-ncr.test.js test-unit/lib/ncr-pdf.test.js

# e2e (needs the Docker stack running: docker compose up)
npx playwright test --config=e2e/playwright.config.js e2e/us-traveler-ncr-gating.spec.js
npx playwright test --config=e2e/playwright.config.js e2e/us-traveler-ncr-input-linking.spec.js   # updated for the new field
```

- **Unit** covers reference parsing and the fixed resolve order, uniform
  not-found for a user without read access, active-only, the open-NCR queries,
  the finished-count formula, the PDF section builder against the spec's
  content list, and `closeNcr`'s three PDF outcomes (attached, failed-but-closed,
  not applicable).
- **E2E** covers the manual scenarios above, including the checkbox-set input,
  the download's `Content-Type` and `%PDF-` header, and that a different
  traveler's URL cannot fetch a PDF id.
- Then run the whole e2e suite once: the 123 spec and the NCR specs that create
  traveler-linked NCRs should be unaffected apart from the banner assertions.
