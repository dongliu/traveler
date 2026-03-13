# NCR Data Model

## Overview

The NCR Workflow Management system uses 4 MongoDB collections. All state
transitions, user actions, and system notifications are recorded as immutable
events embedded in the NCR document following the **event sourcing pattern**.
Separate audit-log and forwarding-log collections are not needed — the NCR's
`events[]` array is the authoritative record of everything that happened.

## Event Sourcing Pattern

Every significant occurrence in the NCR lifecycle is appended to
`ncr.events[]` as an immutable event. Events are never modified or deleted.
The event stream answers: _who did what, when, and what happened next?_

**Three actor types**:
- **User input**: an authenticated user takes an action (submit, approve, close)
- **System input**: the FSM fires a transition in response to a user action
- **System output**: the notification service sends an email to stakeholders

State transitions are embedded in the triggering user event (`previous_status`
/ `new_status`), keeping cause and effect co-located in a single event.
Notification events capture per-recipient delivery status.

## Event Subschema

```javascript
// NcrEvent — embedded in ncr.events[]
{
  _id: ObjectId,           // auto-generated

  // Classification
  event_type: String,      // see Event Type Enum below
  actor_type: String,      // "user" | "system"

  // Actor (null fields for system events)
  actor_id: ObjectId,      // User ObjectId (null for system)
  actor_name: String,      // Display name ("System" for system events)
  actor_role: String,      // Role at time of event (null for system)

  timestamp: Date,         // When the event occurred (required)

  // State transition (only for events that change NCR status)
  previous_status: String, // null if no status change
  new_status: String,      // null if no status change

  // Event-specific data (shape depends on event_type)
  payload: Object,

  // For notification events: per-recipient delivery tracking
  recipients: [{
    recipient_id: ObjectId,
    recipient_name: String,
    recipient_role: String,       // "QA Staff" | "CE/CS" | "Group Leader" | etc.
    recipient_role_snapshot: String, // role as of this event (audit compliance)
    recipient_email: String,
    delivery_status: String,      // "Pending" | "Delivered" | "Failed"
    delivery_timestamp: Date,     // null until delivered/failed
    error_message: String         // null unless Failed
  }]
}
```

## Event Type Enum

### User Input Events (actor_type: "user")

| event_type | Triggered by | Causes status change? |
|---|---|---|
| `ncr.submitted` | NCR Originator creates NCR | → Submitted |
| `disposition.submitted` | CE/CS submits engineering disposition | → Dispositioned |
| `delegate.assigned` | CE/CS assigns originator delegate | No |
| `qa.concurred` | QA Staff gives concurrence | → Approved or Final Approval |
| `approvers.designated` | QA Staff designates additional approvers | No (part of qa.concurred payload) |
| `qa.rejected` | QA Staff rejects disposition (back to CE/CS) | → Submitted |
| `approval.approved` | Designated approver approves | → Final Approval (when all approved) |
| `approval.returned_for_comment` | Designated approver returns for comment | → Returned for Comment |
| `qa.resubmitted` | QA resubmits after comment resolution | → Approved |
| `ncr.closed` | Originator/designee closes NCR | → Closed |
| `traveler.signed_off` | Originator signs off in eTraveler | → Closed (traveler-initiated) |
| `pa.owner_assigned` | QA assigns preventive action owner | No |
| `pa.status_updated` | PA owner updates status | No |
| `pa.closed` | QA Staff closes preventive action | No |

### System Output Events (actor_type: "system")

| event_type | Triggered after | Recipients |
|---|---|---|
| `notification.initial` | ncr.submitted | QA Staff, Group Leader, Division Director |
| `notification.disposition_request` | ncr.submitted (after initial notification) | CE/CS |
| `notification.qa_notification` | disposition.submitted | QA Staff |
| `notification.approval_request` | qa.concurred (with additional approvers) | Designated Approvers |
| `notification.issuance` | Final Approval reached | NCR Originator/Designee |
| `notification.final_distribution` | ncr.closed | All 5 recipient groups |
| `notification.pa_assigned` | pa.owner_assigned | Preventive Action Owner |

## Entity Definitions

### 1. NCR (Nonconformance Report)

**Purpose**: Core document containing all NCR data and the complete event
stream for the NCR's lifecycle.

**Mongoose Schema**:

```javascript
{
  // Unique Identifier
  ncr_number: String,         // Auto-generated per org naming convention

  // NCR Origination
  originator_id: ObjectId,    // Reference to User
  originator_name: String,
  creation_timestamp: Date,
  discovery_date: Date,
  discovery_context: String,  // "incoming_inspection" | "in_house_assembly" | "in_house_inspection"

  // Part Information (Mandatory)
  part_name: String,
  part_number: String,
  part_revision: String,
  quantity: Number,
  supplier_name: String,
  wbs_number: String,

  // Reference Information
  specification_drawing_reference: String,
  po_reference: String,
  description_of_nonconformance: String,

  // Status & Workflow (denormalized read model; source of truth is events[])
  status: String,             // "Submitted" | "Dispositioned" | "Approved" | "Returned for Comment" | "Final Approval" | "Closed"

  // eTraveler Integration
  traveler_link: {
    traveler_id: ObjectId,
    step_number: Number,
    initiated_from_traveler: Boolean
  },

  // CE/CS Assignment
  ce_cs_name: String,
  ce_cs_id: ObjectId,
  ce_cs_delegate_id: ObjectId,  // If CE/CS delegates

  // Disposition (populated after CE/CS submission)
  disposition: {
    parts_disposition: String,  // "Rework" | "Repair" | "Return to Vendor" | "Scrap" | "Use-As-Is"
    root_cause_documentation: String,
    preventive_actions: [String],
    rework_repair_instructions: String,
    ce_cs_identity: ObjectId,
    ce_cs_timestamp: Date
  },

  // QA Concurrence (denormalized for quick access)
  qa_staff_identity: ObjectId,
  qa_staff_name: String,
  qa_concurrence_timestamp: Date,

  // Additional Approvers Designation
  additional_approvers: [{
    approver_id: ObjectId,
    approver_name: String,
    approver_role: String,
    designated_timestamp: Date,
    approval_status: String,    // "Pending" | "Approved" | "Returned for Comment"
    approval_timestamp: Date,
    comments: String
  }],

  // Closure Information (denormalized for quick access)
  closure_record: {
    closed_by: ObjectId,
    closed_by_name: String,
    closure_date: Date,
    closure_notes: String,
    closure_timestamp: Date,
    distribution_notification_timestamp: Date
  },

  // Attachments
  attachments: [{
    file_id: ObjectId,
    file_name: String,
    file_type: String,
    upload_timestamp: Date
  }],

  // ── EVENT SOURCING ──────────────────────────────────────────────────────────
  // Append-only event stream. Every user action, state transition, and system
  // notification is recorded here. Never modify or delete events.
  events: [NcrEventSchema],   // see Event Subschema above
  // ───────────────────────────────────────────────────────────────────────────

  // Timestamps
  created_at: Date,
  updated_at: Date
}
```

**Why denormalize status/disposition/closure alongside events?**

Denormalized fields (status, disposition, closure_record, additional_approvers)
serve as read-model projections for efficient queries (dashboard, filtering).
The `events[]` array is the authoritative history. On any conflict, `events[]`
wins.

**Relationships**:

- References Part/Item master data (external system)
- References Supplier master data (external system)
- References Specification/Drawing/PO (external system)
- Links to eTraveler records (optional)
- Has one Disposition (embedded)
- Has multiple Approvals (embedded in additional_approvers)
- Has one Closure Record (embedded)
- Has complete event stream (embedded events[])

### 2. Closure Record

**Purpose**: Documents execution of authorized disposition and formal closure.
Embedded in NCR document.

```javascript
// Embedded in ncr.closure_record
{
  closed_by: ObjectId,
  closed_by_name: String,
  closure_date: Date,
  closure_notes: String,
  closure_timestamp: Date,

  disposition_execution_verified: Boolean,
  preventive_actions_verified: Boolean,

  distribution_notification_timestamp: Date
}
```

Recorded via `ncr.closed` event in `events[]`. The `notification.final_distribution`
system event captures all recipient delivery statuses.

### 3. Preventive Action

**Purpose**: Tracks preventive actions identified by CE/CS and owned/executed
by designated personnel. Kept as a separate collection because preventive
actions have independent lifecycle and ownership outside the NCR's primary
workflow.

**Mongoose Schema** (separate collection):

```javascript
{
  _id: ObjectId,
  ncr_id: ObjectId,

  action_description: String,

  owner_id: ObjectId,
  owner_name: String,
  owner_email: String,

  target_completion_date: Date,
  actual_completion_date: Date,

  status: String,             // "Open" | "In Progress" | "Completed" | "Overdue"

  status_history: [{
    previous_status: String,
    new_status: String,
    changed_by: ObjectId,
    changed_timestamp: Date
  }],

  comments: [String],

  created_at: Date,
  updated_at: Date
}
```

**Relationships**:

- Belongs to one NCR
- Owned by designated personnel
- PA lifecycle events (`pa.owner_assigned`, `pa.status_updated`, `pa.closed`)
  are also recorded in the parent NCR's `events[]` for unified history

### 4. User (Reference)

Managed by external identity/authorization system. The NCR module stores
`user_id`, `user_name`, and `user_role` snapshots in events for audit
compliance — role changes after the fact do not alter historical records.

## Collection Design

### MongoDB Collections

1. **ncrs** - Primary NCR documents (with embedded events)

   - Documents: One per NCR
   - Indexes:
     - `ncr_number` (unique)
     - `status`
     - `discovery_date`
     - `part_number`
     - `supplier_name`
     - `created_at`
     - `events.timestamp` (for event range queries)
     - `events.event_type` (for filtering specific event types)
   - Embedded arrays: `events[]`, `additional_approvers[]`, `attachments[]`
   - Expected events per NCR: 15–40 events (all user actions + notifications)

2. **preventive_actions** - Task tracking

   - Documents: 1–5 per NCR
   - Indexes: `(ncr_id, status)`, `owner_id`, `target_completion_date`
   - Retention: Keep 1 year after completion

**Removed collections** (replaced by `ncr.events[]`):
- ~~audit_logs~~ → covered by user input events with `previous_status`/`new_status`
- ~~forwarding_logs~~ → covered by system output events with `recipients[]`

## Workflow State Transitions

```
Submitted
  → [CE/CS: disposition.submitted]
  → Dispositioned
    → [QA: qa.concurred + approvers designated]
    → Approved (additional approvers required)
      → [Approver: approval.approved — all approved]
      → Final Approval
      → [Approver: approval.returned_for_comment]
      → Returned for Comment
        → [QA: qa.resubmitted]
        → Approved (loop)
    → Final Approval (no additional approvers — direct from QA concurrence)
      → [Originator: ncr.closed]
      → Closed
```

## Event Payload Examples

### ncr.submitted

```javascript
{
  event_type: 'ncr.submitted',
  actor_type: 'user',
  actor_id: ObjectId('...'),
  actor_name: 'Jane Smith',
  actor_role: 'NCR Originator',
  timestamp: ISODate('2026-03-11T10:00:00Z'),
  previous_status: null,
  new_status: 'Submitted',
  payload: {
    ncr_number: 'NCR-2026-0042',
    part_name: 'Bracket Assembly',
    part_number: 'BA-1234',
    initiated_from_traveler: false
  },
  recipients: []
}
```

### notification.initial

```javascript
{
  event_type: 'notification.initial',
  actor_type: 'system',
  actor_id: null,
  actor_name: 'System',
  actor_role: null,
  timestamp: ISODate('2026-03-11T10:00:05Z'),
  previous_status: null,
  new_status: null,
  payload: {
    email_template: 'ncr-initial-notification',
    ncr_number: 'NCR-2026-0042'
  },
  recipients: [
    {
      recipient_id: ObjectId('...'),
      recipient_name: 'Bob QA',
      recipient_role: 'QA Staff',
      recipient_role_snapshot: 'QA Staff',
      recipient_email: 'bob.qa@org.com',
      delivery_status: 'Delivered',
      delivery_timestamp: ISODate('2026-03-11T10:00:07Z'),
      error_message: null
    },
    {
      recipient_id: ObjectId('...'),
      recipient_name: 'Carol GL',
      recipient_role: 'Group Leader',
      recipient_role_snapshot: 'Group Leader',
      recipient_email: 'carol.gl@org.com',
      delivery_status: 'Delivered',
      delivery_timestamp: ISODate('2026-03-11T10:00:07Z'),
      error_message: null
    }
  ]
}
```

### approval.returned_for_comment

```javascript
{
  event_type: 'approval.returned_for_comment',
  actor_type: 'user',
  actor_id: ObjectId('...'),
  actor_name: 'Dave Approver',
  actor_role: 'Designated Approver',
  timestamp: ISODate('2026-03-12T14:30:00Z'),
  previous_status: 'Approved',
  new_status: 'Returned for Comment',
  payload: {
    comments: 'Root cause analysis is insufficient. Please clarify material traceability.',
    approver_index: 0
  },
  recipients: []
}
```

## Data Validation Rules

1. **NCR Creation**:

   - All mandatory fields required (Part Name, Number, Revision, Quantity,
     Supplier, WBS, CE/CS, Description)
   - Description minimum 20 characters
   - Quantity > 0
   - Discovery Date ≤ today

2. **Disposition Submission**:

   - Parts Disposition required (one of 5 options)
   - Root Cause minimum 50 characters
   - Preventive Actions minimum 1 entry, each ≥ 50 characters
   - If Rework/Repair selected: Instructions required, minimum 50 characters

3. **QA Concurrence**:

   - Cannot concur with rejected disposition
   - If additional approvers designated: at least 1 required
   - Cannot transition to Final Approval without concurrence

4. **Closure**:

   - Cannot close without Final Approval status
   - Closure Notes required, minimum 20 characters
   - Cannot close NCR initiated from Traveler without Traveler sign-off

5. **Events**:
   - `timestamp` required on every event
   - `event_type` must be in the defined enum
   - `actor_type` must be "user" or "system"
   - Events are append-only; no update or delete operations permitted

## Migration Strategy

1. **v1.0**: Initial schema with embedded `events[]` replacing separate audit/forwarding collections
2. **Schema Migrations**: Tracked in version control with timestamps
3. **Backward Compatibility**: Maintain schema versioning for future enhancements
4. **Data Cleanup**: Archive closed NCRs >2 years old separately (not deleted)
