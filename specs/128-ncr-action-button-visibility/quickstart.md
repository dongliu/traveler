# Quickstart: Reposition and Permission-Gate the NCR Next-Action Button

How to run and check this feature. Implementation steps are in `tasks.md`.

## Prerequisites

- Docker stack up: `docker compose up` (web on 3001, API on 3002).
- `.env` has `E2E_USER`, `E2E_PASS`, `E2E_USER2`, `E2E_PASS2`.
- First time only: `npx playwright install chromium`.
- Personas in this dev environment (matching `e2e/us3-qa-concurrence-and-approver-coordination.spec.js`'s
  own documented convention): `dong` (primary) is QA staff; `bob`
  (secondary) is a real, authenticatable identity, also a pre-existing
  `ncr-qa` member in this dev DB (temporarily removable via the
  `remove-group-member`/`add-group-member` fixtures, the same technique
  that spec already uses); `guobao` is a real AD identity used as
  Originator/CE/CS context without ever logging in.

## 1. Manual walk-through

1. Create an NCR in `Submitted` status with `dong` as CE/CS, `guobao` as Originator.
   - As `dong`: open the NCR detail page. Expect: no button beside the NCR
     number anymore; "Create Disposition" appears left-aligned, directly
     above Event Timeline.
   - As anyone who isn't `dong`: open the same page. Expect: no action
     button anywhere on the page.
2. Move it to `Dispositioned`.
   - As `dong` (QA staff): "QA Concurrence" appears above Event Timeline.
   - As someone temporarily removed from `ncr-qa`: no action button.
3. Move it to `Approval Requested` with `bob` as the sole designated approver.
   - As `bob`: "Approve / Return" appears above Event Timeline.
   - As `dong` (not a designated approver on this NCR): no action button.
4. Move it to `Final Approval`.
   - As the Originator (or their Designate): "Close NCR" appears above
     Event Timeline.
   - As anyone else: no action button.
5. Close it (`Closed` status) or return it (`Returned for Comment`):
   confirm no action button for anyone — unchanged from today.

## 2. End-to-end suite

```bash
npm run e2e -- e2e/us-ncr-next-action-visibility.spec.js
```

New spec. Covers: the button's new position (left-aligned, above Event
Timeline, not beside the NCR number) and, for each of the four statuses,
that only an authorized viewer sees its button while an unauthorized
viewer sees none.

## Acceptance

Feature is done when: the e2e spec passes; the manual walk-through in
section 1 matches its expectations; and `npx eslint .` reports no new
errors (this feature touches no `.js` file other than the new e2e spec).
