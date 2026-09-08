# Data Model: Concurrence Multi-Approver (No Role)

## Affected Entity: NCR — `additional_approvers` subdocument

The `additional_approvers` array on the NCR document is unchanged at the schema level. The `approver_role` field becomes an inert optional field — it is no longer populated by new concurrence submissions.

### `AdditionalApprover` subdocument (effective shape after this feature)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `approver_id` | String | Yes | Username of the designated approver |
| `approver_name` | String | No | Resolved display name (looked up at concurrence time) |
| `approver_role` | String | No | **Deprecated** — retained in schema for historical records; no longer populated |
| `designated_timestamp` | Date | Yes | Set at concurrence submission |
| `approval_status` | String | Yes | `'Pending'` → `'Approved'` or `'Returned'` |

### State Transitions (unchanged)

```
Dispositioned
    │
    ▼  QA submits concurrence
    ├── (0 approvers) ──────────────────────────────▶ Final Approval
    │
    └── (1+ approvers) ──▶ Approval Requested (pending) ──▶ Final Approval
                                                   (all approved)
```

## API Payload Shape

### Request: `PATCH /api/ncrs/:id/concurrence`

```json
{
  "additional_approvers": [
    { "approver_id": "jdoe" },
    { "approver_id": "msmith" }
  ]
}
```

`approver_role` is no longer accepted or required in each entry. An empty array (`[]`) is valid and triggers direct Final Approval.

### Response (unchanged shape)

```json
{
  "success": true,
  "ncr": {
    "ncr_id": "...",
    "ncr_number": "NCR-001",
    "status": "Approval Requested",
    "additional_approvers": [...]
  }
}
```
