# Quickstart: Verifying QA Reject with Comments

## By hand (Docker dev stack)

1. `docker compose up` (if not already running).
2. Create an NCR, submit a disposition as CE/CS. NCR → `Dispositioned`.
3. As QA, open `/ncrs/:id/concurrence`. Confirm a "Reject with Comments" option is available alongside "Concur". Click it with the comment field blank and confirm the action is refused.
4. Enter a comment (e.g. "Description of nonconformance is missing the affected lot number.") and submit the rejection. Confirm:
   - The NCR's status badge now reads `Rejected`.
   - QA staff, the Originator, and the Originator Designate (if one is assigned — assign one first via the NCR detail page to exercise this) each receive an email containing the comment and a link to the NCR.
   - The NCR detail page shows the rejection comment and a "Resubmit" action, visible only to the Originator/Designate.
5. As someone who is neither the Originator nor the Designate, confirm the NCR detail page shows no resubmit action and a direct API call to `PATCH /ncrs/:id/resubmit` is refused (`403`).
6. As the Originator (or Designate), open `/ncrs/:id/resubmit`, correct the flagged field, and submit. Confirm:
   - The NCR's status badge now reads `Submitted`.
   - The assigned CE/CS receives a new disposition-request email, identical in form to the one sent when the NCR was first created.
7. Submit a disposition again as CE/CS, and concur again as QA (with or without approvers). Confirm the NCR proceeds exactly as it would have the first time through — nothing about having gone through a rejection changes how disposition/concurrence/approval behave afterward.
8. Open the NCR's Event Timeline. Confirm both the rejection (`qa.rejected`) and the resubmission (`ncr.resubmitted`) appear as distinct, correctly-attributed entries.

## Automated

```bash
# unit — lib/ncr-service.js and lib/ncr-state-machine.js (via ncr-service)
TRAVELER_CONFIG_REL_PATH=docker npx mocha test-unit/lib/ncr-service.test.js

# unit — email body/recipients for the new notification
TRAVELER_CONFIG_REL_PATH=docker npx mocha test-unit/lib/ncr-email.test.js

# e2e — closest existing coverage of the concurrence decision point and the
# next-action-visibility button; both need new scenarios under this feature
# (see tasks.md once generated)
npm run e2e -- e2e/us3-qa-concurrence-and-approver-coordination.spec.js
npm run e2e -- e2e/us-ncr-next-action-visibility.spec.js
```

See `baseline.txt` for the pass count recorded before any implementation changes.
