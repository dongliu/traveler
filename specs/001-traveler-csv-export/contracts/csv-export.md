# Contract: Traveler CSV Export Endpoint

## `GET /travelers/:id/csv`

Web app route (session-authenticated), mounted alongside the existing `/travelers/:id/json`
route in `routes/traveler.js`. Not exposed on the REST API server (`routes/api.js`), per
Constitution Principle III.

### Auth & Access

- Requires an authenticated session (`auth.ensureAuthenticated`).
- Requires the traveler to exist (`reqUtils.exist('id', Traveler)`).
- Requires read access to the traveler (`reqUtils.canReadMw('id')`) — same rule set as viewing
  the traveler (owner, reviewer, sharedWith, sharedGroup, publicAccess).

### Request

| Part | Value |
|---|---|
| Method | `GET` |
| Path | `/travelers/:id/csv` |
| Path param `id` | Traveler's Mongo ObjectId (string) |
| Body | none |

### Responses

| Status | Condition | Body |
|---|---|---|
| `200` | Traveler exists and requester has read access | `text/csv` body, see Body Shape below |
| `403` | Traveler exists but requester lacks read access | Plain text: `you are not authorized to access this resource` (from `canReadMw`) |
| `404` | No traveler with the given id | Plain text: `item <id> not found` (from `reqUtils.exist`) |

### Response Headers (200)

| Header | Value |
|---|---|
| `Content-Type` | `text/csv; charset=utf-8` |
| `Content-Disposition` | `attachment; filename="traveler-<id>.csv"` |

### Body Shape (200)

See [`../data-model.md`](../data-model.md#csv-output-shape-not-a-persisted-entity--the-response-body)
for the authoritative row-by-row shape (metadata block, blank separator, data header, data rows).

### Example

Request:

```
GET /travelers/64f1a2b3c4d5e6f7a8b9c0d1/csv
Cookie: <session cookie>
```

Response (200):

```
Traveler Link,https://traveler.example.org/travelers/64f1a2b3c4d5e6f7a8b9c0d1/view
Traveler Id,64f1a2b3c4d5e6f7a8b9c0d1
Traveler Title,Pump Assembly Torque Check
Traveler Status,active

Field Name,Label,Type,Value,Input By,Input On
torque_reading,Torque Reading (Nm),number,42,jdoe,2026-08-20T14:03:11.000Z
inspector_notes,Inspector Notes,textarea,,,
```

(Second data row shows a field with no submitted value yet — FR-006.)
