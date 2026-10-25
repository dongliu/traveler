# Quickstart: Verifying NCR Approval Rounds

## By hand (Docker dev stack)

1. `docker compose up` (if not already running).
2. Create an NCR, submit a disposition, and have QA concur designating two approvers, A and B. NCR → `Approval Requested`, `current_approval_round` → `1`.
3. As approver B, open `/ncrs/:id/approve` and submit **Return for Comment** with a comment.
4. Confirm:
   - The NCR's status badge now reads `Dispositioned` (not `Returned for Comment` — that label no longer exists anywhere in the UI).
   - Approver A (who never decided) is not asked to decide; visiting their approval link now shows the "NCR must be in 'Approval Requested' status" error.
   - The NCR detail page's Event Timeline shows B's return-for-comment event tagged `Round 1`.
5. As QA, open the NCR (now `Dispositioned`) and submit concurrence again, this time designating A and B again. NCR → `Approval Requested`, `current_approval_round` → `2`.
6. Confirm A's approval page shows no recorded decision for A (their round-1 `Approved`, if they'd given one, does not carry over) — **note**: in this walkthrough A never decided in round 1, so this step mainly confirms B, who returned round 1 for comment, also starts round 2 with a clean `Pending` entry.
7. Have both A and B approve in round 2. NCR → `Final Approval`. Confirm the Event Timeline's round-2 events are tagged `Round 2`, distinct from round 1's.
8. Separately: repeat from step 2, but this time have QA concur with **zero** approvers after a round is stopped. Confirm the NCR goes straight to `Final Approval`, same as the very first time QA concurs with no approvers.

## Automated

```bash
# unit — lib/ncr-service.js and lib/ncr-state-machine.js (via ncr-service)
TRAVELER_CONFIG_REL_PATH=docker npx mocha test-unit/lib/ncr-service.test.js

# e2e — closest existing coverage; both files need updates under this feature
# (see tasks.md once generated), but should still exercise the renamed flows
npm run e2e -- e2e/us3-qa-concurrence-and-approver-coordination.spec.js
npm run e2e -- e2e/us-ncr-next-action-visibility.spec.js
```

See `baseline.txt` for the pass count recorded before any implementation changes.
