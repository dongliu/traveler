# Quickstart: Remove Root Cause Analysis from CE/CS Disposition

## Prerequisites

- Docker stack running (`docker compose up`)
- Logged in as a user with CE/CS access to a Submitted NCR
- Playwright suite wired up (`e2e/` directory)

## Scenario 1 — Disposition form has no Root Cause field

1. Navigate to an NCR in "Submitted" status as the assigned CE/CS.
2. Click the "Submit Disposition" link/button to open the disposition form.
3. **Verify**: The form does **not** contain any "Root Cause" label, textarea,
   or section heading.
4. **Verify**: No `#root_cause_documentation` element exists in the DOM (open
   DevTools → `document.getElementById('root_cause_documentation')` → expect
   `null`).

## Scenario 2 — Submission succeeds without root cause

1. On the disposition form, select "Use-As-Is" as the parts disposition.
2. Enter a preventive action description of at least 50 characters.
3. Click Submit.
4. **Verify**: The NCR transitions to "Dispositioned" status.
5. **Verify**: The success banner appears; no validation error about root cause.

## Scenario 3 — Rework/Repair still requires instructions (no regression)

1. On the disposition form, select "Rework".
2. Leave Rework/Repair Instructions blank. Enter a valid preventive action.
3. Click Submit.
4. **Verify**: Validation error appears for Rework/Repair Instructions only —
   no mention of root cause.
5. Fill in the instructions (≥50 chars) and submit again.
6. **Verify**: Submission succeeds.

## Scenario 4 — NCR detail page shows no Root Cause section

1. After submitting disposition, navigate to the NCR detail page.
2. **Verify**: The disposition summary section contains Parts Disposition,
   Preventive Actions, and (if Rework/Repair) Instructions — but no Root Cause
   row.

## Scenario 5 — Old NCR with root cause data still renders correctly

1. Locate (or create via fixture CLI) an NCR whose `disposition.root_cause_documentation`
   is already populated (from before this change).
2. Navigate to its detail page, disposition page, and concurrence page.
3. **Verify**: All pages load (HTTP 200) without error.
4. **Verify**: No root cause value is displayed on any of those pages (the field
   is silently ignored).

## Running the automated suite

```bash
cd e2e
npx playwright test us2-ce-cs-disposition.spec.js
```

All 8 tests should pass. In particular:
- AS2 ("form fields present") asserts `#root_cause_documentation` is **not** in the DOM.
- AS4/AS5 ("full submission") completes without a root cause payload.
- "Server-side validation bypass" does not assert a `root_cause_documentation` error.
