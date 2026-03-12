# NCR Data Model

## Overview

The NCR Workflow Management system uses 7 interconnected entities managed
through MongoDB with Mongoose ODM. All entities maintain audit trail information
and support workflow state transitions.

## Entity Definitions

### 1. NCR (Nonconformance Report)

**Purpose**: Core entity representing a reported quality issue for an item that
doesn't meet specifications.

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

  // Status & Workflow
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

  // QA Concurrence
  qa_staff_identity: ObjectId,
  qa_staff_name: String,
  qa_concurrence_timestamp: Date,

  // Additional Approvers Designation
  additional_approvers: [{
    approver_id: ObjectId,
    approver_name: String,
    approver_role: String,
    designated_timestamp: Date,
    approval_status: String,   // "Pending" | "Approved" | "Returned for Comment"
    approval_timestamp: Date,
    comments: String
  }],

  // Closure Information
  closure_record: {
    closed_by: ObjectId,
    closed_by_name: String,
    closure_date: Date,
    closure_notes: String,
    closure_timestamp: Date,
    distribution_notification_timestamp: Date
  },

  // Audit & Tracking
  attachments: [{
    file_id: ObjectId,
    file_name: String,
    file_type: String,
    upload_timestamp: Date
  }],

  // Timestamps
  created_at: Date,
  updated_at: Date
}
```

**Relationships**:

- References Part/Item master data (external system)
- References Supplier master data (external system)
- References Specification/Drawing/PO (external system)
- Links to eTraveler records (optional)
- Has one Disposition
- Has multiple Approvals
- Has one Closure Record
- Has many Audit Log entries
- Has many Forwarding Log entries

### 2. Disposition

**Purpose**: Records CE/CS engineering analysis and disposition decision for the
nonconforming item.

**Mongoose Schema** (embedded in NCR or separate collection):

```javascript
{
  _id: ObjectId,
  ncr_id: ObjectId,

  parts_disposition: String,  // Predefined options
  root_cause_documentation: String,
  preventive_actions: [String],
  rework_repair_instructions: String,

  ce_cs_identity: ObjectId,
  ce_cs_name: String,
  disposition_timestamp: Date,
  disposition_status: String, // "Submitted" | "Rejected" | "Accepted"

  supporting_documentation: [{
    document_id: ObjectId,
    document_name: String,
    upload_timestamp: Date
  }],

  created_at: Date,
  updated_at: Date
}
```

**Relationships**:

- Belongs to one NCR
- Created by CE/CS user
- Reviewed by QA Staff

### 3. Approval

**Purpose**: Tracks QA Staff concurrence and Designated Approver authorizations
with comment resolution.

**Mongoose Schema** (embedded in NCR):

```javascript
{
  _id: ObjectId,
  ncr_id: ObjectId,

  qa_staff_identity: ObjectId,
  qa_staff_name: String,
  qa_concurrence_timestamp: Date,
  qa_concurrence_status: String,  // "Concurred" | "Rejected"
  qa_feedback: String,

  additional_approvers: [{
    approver_id: ObjectId,
    approver_name: String,
    approver_role: String,
    approval_status: String,      // "Pending" | "Approved" | "Returned for Comment"
    approval_timestamp: Date,
    comments: String,
    comment_type: String           // "Return for Comment" | "Approval"
  }],

  status_history: [{
    previous_status: String,
    new_status: String,
    changed_by: ObjectId,
    changed_timestamp: Date,
    reason: String
  }],

  created_at: Date,
  updated_at: Date
}
```

**Relationships**:

- Belongs to one NCR
- Created by QA Staff
- Updated by Designated Approvers
- Can trigger return to CE/CS for comment resolution

### 4. Closure Record

**Purpose**: Documents execution of authorized disposition and formal closure of
NCR.

**Mongoose Schema** (embedded in NCR):

```javascript
{
  _id: ObjectId,
  ncr_id: ObjectId,

  closed_by: ObjectId,
  closed_by_name: String,
  closure_date: Date,
  closure_notes: String,
  closure_timestamp: Date,

  disposition_execution_verified: Boolean,
  preventive_actions_verified: Boolean,

  distribution_notification_timestamp: Date,

  created_at: Date
}
```

**Relationships**:

- Belongs to one NCR with Final Approval status
- Created by NCR Originator or designee
- Triggers auto-distribution to 5 recipient groups

### 5. Audit Log Entry

**Purpose**: Tracks all changes to NCR throughout its lifecycle for compliance
and traceability.

**Mongoose Schema** (separate collection):

```javascript
{
  _id: ObjectId,
  ncr_id: ObjectId,

  action_type: String,        // "Created" | "Disposition Submitted" | "Concurrence" | "Approved" | "Returned for Comment" | "Closed" | etc.
  user_identity: ObjectId,
  user_name: String,
  user_role: String,

  timestamp: Date,

  previous_state: Object,     // Full NCR state before change
  new_state: Object,          // Full NCR state after change
  changed_fields: [String],   // List of field names that changed

  comments: String,           // Optional change notes

  created_at: Date
}
```

**Indexes**: CREATE INDEX on (ncr_id, timestamp) for efficient audit trail
retrieval

**Relationships**:

- References NCR
- References user who made change
- Multiple entries per NCR lifecycle

### 6. Forwarding Log Entry

**Purpose**: Records transmission and delivery of NCR to stakeholders at each
workflow step.

**Mongoose Schema** (separate collection):

```javascript
{
  _id: ObjectId,
  ncr_id: ObjectId,

  forwarding_type: String,    // "Initial Notification" | "Engineering Disposition Request" | "QA Concurrence" | "Approval Request" | "Issuance" | "Final Distribution"

  recipients: [{
    recipient_id: ObjectId,
    recipient_name: String,
    recipient_role: String,    // "QA Staff" | "CE/CS" | "Group Leader" | "Director/PM" | "Designated Approver" | "PPM"
    recipient_email: String,

    notification_timestamp: Date,
    delivery_status: String,   // "Pending" | "Delivered" | "Failed" | "Bounced"
    delivery_timestamp: Date,
    error_message: String,     // If delivery failed

    recipient_role_at_time: String  // For audit compliance
  }],

  forwarding_timestamp: Date,
  attachments_sent: Boolean,
  email_template_used: String,

  created_at: Date
}
```

**Indexes**: CREATE INDEX on (ncr_id, forwarding_type, forwarding_timestamp)

**Relationships**:

- References NCR
- Records all email notifications
- Multiple entries per NCR (one per forwarding step)

### 7. Preventive Action

**Purpose**: Tracks preventive actions identified by CE/CS and owned/executed by
designated personnel.

**Mongoose Schema** (separate collection or embedded in NCR):

```javascript
{
  _id: ObjectId,
  ncr_id: ObjectId,
  disposition_id: ObjectId,

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
- Associated with Disposition
- Owned by designated personnel (not necessarily NCR Originator, CE/CS, or QA)

## Collection Design

### MongoDB Collections

1. **ncrs** - Primary NCR documents

   - Documents: One per NCR
   - Indexes: ncr_number (unique), status, discovery_date, part_number,
     supplier_name, created_at
   - Sharding: By ncr_id if >1M documents

2. **audit_logs** - Complete change history

   - Documents: Multiple per NCR (10-50 expected per NCR lifecycle)
   - Indexes: (ncr_id, timestamp), user_id
   - Retention: Keep indefinitely for compliance

3. **forwarding_logs** - Email delivery records

   - Documents: 6-10 per NCR (one per forwarding step)
   - Indexes: (ncr_id, forwarding_type), recipient_id
   - TTL: 90 days for failed delivery records

4. **preventive_actions** - Task tracking
   - Documents: 1-5 per NCR
   - Indexes: (ncr_id, status), owner_id
   - TTL: Keep 1 year after completion

## Workflow State Transitions

```
Submitted
  → [CE/CS disposition]
  → Dispositioned
    → [QA concurrence + approver designation]
    → Approved (if additional approvers needed)
      → [Approvers review]
      → Approved (if return for comment)
        → [loop back through, then resubmit]
      → Final Approval
    → Final Approval (if no additional approvers)
      → [Originator execution]
      → Closed
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

## Migration Strategy

1. **v1.0**: Initial schema with all 6 status states
2. **Schema Migrations**: Tracked in version control with timestamps
3. **Backward Compatibility**: Maintain schema versioning for future
   enhancements
4. **Data Cleanup**: Archive closed NCRs >2 years old separately (not deleted)
