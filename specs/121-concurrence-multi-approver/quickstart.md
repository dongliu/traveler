# Quickstart Validation Guide: Concurrence Multi-Approver (No Role)

## Prerequisites

- Docker dev environment running (`docker compose up`)
- At least one NCR in `Dispositioned` status
- QA staff account credentials
- Two additional user accounts to use as approvers

## Scenario 1 — Add Multiple Approvers, No Role Field Present

1. Log in as a QA staff user.
2. Navigate to a Dispositioned NCR and click **QA Concurrence**.
3. **Verify**: The approvers table has two columns — "Username" and an action column. No "Role" column or role input field is present.
4. Type a valid username in the username field and click **Add**.
5. Type a second valid username and click **Add**.
6. **Verify**: Both usernames appear in the table with a Remove button. No role is shown or requested.
7. Click **Concur**.
8. **Expected**: Success banner appears. NCR status changes to `Approval Requested`. Both designated users receive an approval-request email.

## Scenario 2 — Zero Approvers → Direct Final Approval

1. Navigate to a Dispositioned NCR as QA.
2. Leave the approvers list empty.
3. Click **Concur**.
4. **Expected**: Success banner reads "NCR moved to Final Approval." NCR status is `Final Approval`.

## Scenario 3 — Duplicate Username Rejected

1. Add a username to the approvers list.
2. Attempt to add the same username again.
3. **Expected**: The list remains unchanged (one entry only for that username).

## Scenario 4 — Remove Approver Before Submit

1. Add two approvers.
2. Click **Remove** next to the first one.
3. **Expected**: Only the second approver remains in the list.
4. Click **Concur**.
5. **Expected**: Only the remaining approver receives an approval request.

## API Smoke Test (optional)

```bash
# Concur with two approvers, no role field
curl -s -X PATCH http://localhost:3002/api/ncrs/<NCR_ID>/concurrence \
  -H "Content-Type: application/json" \
  -u <api_user>:<api_password> \
  -d '{"additional_approvers":[{"approver_id":"jdoe"},{"approver_id":"msmith"}]}'
# Expected: HTTP 200, status "Approval Requested"

# Concur with no approvers
curl -s -X PATCH http://localhost:3002/api/ncrs/<NCR_ID>/concurrence \
  -H "Content-Type: application/json" \
  -u <api_user>:<api_password> \
  -d '{"additional_approvers":[]}'
# Expected: HTTP 200, status "Final Approval"

# Missing approver_id should return 400
curl -s -X PATCH http://localhost:3002/api/ncrs/<NCR_ID>/concurrence \
  -H "Content-Type: application/json" \
  -u <api_user>:<api_password> \
  -d '{"additional_approvers":[{}]}'
# Expected: HTTP 400, Validation Error
```

## See Also

- [API Contract](contracts/api-concurrence.md)
- [Data Model](data-model.md)
