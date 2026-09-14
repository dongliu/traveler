# Quickstart: Traveler-Initiated NCRs Linked to a Specific Input

**Feature**: `123-traveler-ncr-input-linking` | **Spec**: [spec.md](./spec.md)

## What this feature adds

A user filling in a traveler can initiate an NCR directly from one specific
already-filled-in input. The traveler and the NCR then link to each other:
the traveler shows the NCR's link and live status at that input, and the NCR
shows a link back to the traveler and that input's label. See
[contracts/traveler-ncr-links.json](./contracts/traveler-ncr-links.json) and
[contracts/ncr-create-traveler-fields.json](./contracts/ncr-create-traveler-fields.json)
for the two endpoint changes this drives, and
[data-model.md](./data-model.md) for the underlying schema change.

## Manual verification (once implemented)

1. Open a traveler you can write to, at an input that has **not** yet been
   filled in. Confirm no "Initiate NCR" action appears at that input.
2. Fill in and save that input's value. Confirm "Initiate NCR" now appears
   at that input, with no page reload required.
3. Click "Initiate NCR". Confirm it opens the standard NCR creation page,
   and that the page indicates which traveler/input this NCR will be linked
   to.
4. Complete NCR creation as normal (all the usual mandatory fields still
   apply). Confirm creation succeeds exactly as it would for a standalone
   NCR.
5. Return to the traveler. Confirm the same input now shows a link to the
   NCR you just created, along with its current status ("Submitted").
6. Open the NCR's own detail page. Confirm it shows a link back to the
   traveler and the label of the input that initiated it.
7. Progress the NCR through disposition (or any status change). Return to
   the traveler and confirm the displayed status has updated to match,
   without needing anything re-linked manually.
8. From the **same** input (which already has one linked NCR), click
   "Initiate NCR" again and create a second NCR. Confirm the traveler now
   shows both NCRs at that input, distinguishable by NCR number, and that
   creating the second one was never blocked by the first.
9. As a different user who can only *view* the traveler (not edit it),
   confirm they can still see the linked NCR's link and status at that
   input.
10. On an NCR created through the standalone `/ncrs/new` page directly (no
    `traveler_id`), confirm its detail page shows no traveler/input
    reference section at all.
11. Create two different travelers that each happen to have an input with
    the same name (e.g. both built from the same form template), fill in
    that input on both, and initiate an NCR from each. Confirm each
    traveler shows only its own NCR at that input — never the other
    traveler's.

## Automated verification (once implemented)

- Unit: `npx mocha test-unit/lib/ncr-service.test.js` — updated assertions
  for `createNcr()`'s `traveler_link` shape (`input_name`/`input_label`
  instead of `step_number`), and the `traveler.signed_off` event payload
  rename.
- E2E: a new Playwright spec under `e2e/` covering the manual steps above
  against the real running app, reusing (with renamed parameters) the
  fixture CLI's `create-traveler-linked-ncr` command and the existing
  Traveler creation/data-save flow.
