# API Contract: QA Concurrence

## `PATCH /api/ncrs/:id/concurrence`

Submits QA concurrence for a Dispositioned NCR, optionally designating additional approvers by username.

### Authentication
Session-authenticated (same as all web routes).

### Request

**Path parameter**: `id` — MongoDB ObjectId of the NCR.

**Body** (`application/json`):

```json
{
  "additional_approvers": [
    { "approver_id": "string (username)" }
  ]
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `additional_approvers` | Array | No | If present, must be an array; may be empty |
| `additional_approvers[].approver_id` | String | Yes (per entry) | Non-empty username; duplicates within a single request are silently deduplicated |

`approver_role` is **not accepted** and is ignored if provided.

### Responses

| Status | Condition | Body |
|--------|-----------|------|
| 200 | Concurrence submitted | `{ success: true, ncr: { ncr_id, ncr_number, status, additional_approvers } }` |
| 400 | `additional_approvers` is not an array, or any entry is missing `approver_id` | `{ success: false, error: "Validation Error", message, details }` |
| 401 | Not authenticated | Standard auth redirect |
| 404 | NCR not found or invalid id | `{ success: false, error: "Not Found" }` |
| 409 | NCR is not in Dispositioned status | `{ success: false, error: "...", message: "..." }` |

### Status Transition

| Approvers count | Resulting NCR status |
|-----------------|----------------------|
| 0 (empty array) | `Final Approval` |
| 1+ | `Approved` (pending all designated approvers) |
