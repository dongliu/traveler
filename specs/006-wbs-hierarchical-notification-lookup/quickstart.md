# Quickstart: WBS Hierarchical Notification Lookup

## Prerequisites

- Docker stack running (`docker compose up`)
- Logged in as an Admin (for registry setup) and as an Originator (for NCR creation)
- The WBS Notification Registry admin tab exists (`specs/005-wbs-notification-registry`)

## Scenario 1 — Exact match (US1)

1. As an Admin, register WBS number `1.2` with a notification email.
2. As an Originator, create an NCR with WBS number `1.2`.
3. **Verify**: the response/success banner does not show the no-match warning.
4. **Verify**: `1.2`'s registered email appears as a recipient of the
   `notification.initial` event's recipients in the NCR's event log.
5. Close the NCR through to completion.
6. **Verify**: `1.2`'s registered email also appears as a recipient of the
   `notification.final_distribution` event.

## Scenario 2 — Nearest ancestor match (US2)

1. As an Admin, register WBS number `1` with `email-root@example.com` and
   `1.2` with `email-child@example.com`. Do NOT register `1.2.1`.
2. As an Originator, create an NCR with WBS number `1.2.1`.
3. **Verify**: `email-child@example.com` (the nearer ancestor, `1.2`) is
   notified — NOT `email-root@example.com`.
4. Create a second NCR with WBS number `1.2.1.1` (a number with no
   registered exact match, and whose only "relative" in the registry — if
   `1.2.1` were registered — would be a descendant, not an ancestor).
5. **Verify**: the same nearest-ancestor rule applies walking up from
   `1.2.1.1` — `1.2` is still the nearest actual ancestor match found
   (`1.2.1` itself is not registered in this scenario).

## Scenario 3 — No match warns without blocking (US3)

1. As an Originator, create an NCR with a WBS number that has no exact
   match and no registered ancestor at any level (e.g. `9.9.9`, assuming
   nothing under `9` is registered).
2. **Verify**: the NCR is created successfully (not blocked).
3. **Verify**: a warning is shown stating no WBS Notification Registry entry
   covers `9.9.9` and suggesting an Admin add one.
4. **Verify**: the `notification.initial` event still records successful
   delivery to the existing QA Staff recipients — the missing contact is
   simply absent from the recipient list, not a delivery failure.

## Running the automated suite

```bash
# Unit tests
TRAVELER_CONFIG_REL_PATH=docker npx mocha test-unit/lib/wbs-notification-service.test.js test-unit/lib/ncr-service.test.js

# e2e
cd e2e
npx playwright test us-wbs-hierarchical-notification-lookup.spec.js
```
