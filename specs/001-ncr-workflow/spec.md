# Feature Specification: Nonconformance Workflow Management (NCR)

**Feature Branch**: `001-ncr-workflow` **Created**: 2026-03-03 **Status**: Draft
**Input**: A Nonconformance workflow management application that enables
organizations to initiate, disposition, and approve Nonconformance Reports
(NCRs) when items have characteristics that do not conform to requirements of
specifications, drawings, Purchase Orders, contracts, Travelers, or other
product criteria.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Create and Submit Nonconformance Report (Priority: P1)

An NCR Originator (Quality Inspector, Line Inspector, or Quality Engineer)
discovers a nonconformance either at incoming inspection or during in-house
assembly/inspection. The NCR Originator creates a Nonconformance Report
documenting the nonconformance with mandatory part information, supplier
details, engineering contact, WBS reference, and a detailed description. The
system automatically generates a unique NCR number. If the nonconformance is
found while using an eTraveler, the NCR can be initiated directly from the
Traveler step, linking the NCR to that specific work activity.

**Why this priority**: This is the core workflow - without the ability to
initiate NCRs, the entire system has no purpose. All other workflows depend on
this functionality.

**Independent Test**: Can be fully tested by allowing an NCR Originator to
create an NCR with all required details (Part Information with revision and
quantity, Supplier, WBS, CE/CS name, Nonconformance Description), verify the
system captures and stores the information correctly, and demonstrates that the
NCR is ready for disposition by an authorized reviewer. Both standalone NCR
creation and Traveler-initiated NCR creation should be testable.

**Acceptance Scenarios**:

1. **Given** a user has NCR Originator role, **When** they access NCR creation
   form, **Then** they see mandatory fields for: Part Name, Part Number, Part
   Revision, Quantity, Supplier Name, Work Breakdown Structure (WBS) Number,
   Cognizant Engineer/Scientist name, Specification/Drawing Reference,
   Description of Nonconformance, and Discovery Date
2. **Given** required fields are populated correctly, **When** they submit the
   NCR, **Then** the system assigns a unique, sequential NCR number and
   transitions the NCR to "Submitted" status
3. **Given** an NCR has been submitted, **When** the NCR Originator or
   authorized user views it, **Then** they see complete audit trail including
   creation date, originator name, submission timestamp, and all captured
   information
4. **Given** an NCR Originator attempts to submit an NCR with missing mandatory
   fields, **When** they click submit, **Then** the system displays validation
   errors identifying which required fields are missing and prevents submission
5. **Given** an NCR Originator is working within an eTraveler and discovers a
   nonconformance, **When** they select "Initiate NCR" from the Traveler step,
   **Then** the NCR creation form pre-populates with the Traveler context and
   upon completion shows the new NCR number linked to that Traveler step

---

### User Story 1.5 - Forward and Notify NCR Stakeholders (Priority: P1)

Upon submission of an NCR, the system automatically forwards the initiated NCR (including all attachments such as photographs, inspection reports, or test data) to the appropriate organizational personnel for notification and action. The NCR Originator or system administrator can verify that all required stakeholders have been notified and have received the complete NCR documentation.

**Why this priority**: Timely notification of key stakeholders (CE/CS, Group Leader, QA Staff, Division Director/PM) is critical for rapid response to nonconformances. Delays in notification can cascade into longer resolution times and increased impact to production. This is a core part of the initiation workflow.

**Independent Test**: Can be fully tested by creating and submitting an NCR, then verifying that: (1) the system correctly identifies and routes the NCR to all required stakeholders based on organizational roles/assignments, (2) all attachments are successfully transmitted with the NCR, and (3) notification records show delivery/receipt confirmation for each stakeholder.

**Acceptance Scenarios**:

1. **Given** an NCR is submitted with valid data, **When** the system processes the submission, **Then** the NCR is automatically forwarded to: Cognizant Engineer/Scientist (for engineering disposition), Cognizant Group Leader (for notification), QA Staff (for notification), and Cognizant Division Director or Project Manager (for notification)
2. **Given** an NCR includes attachments (photographs, reports, test data), **When** it is forwarded to stakeholders, **Then** all attachments are transmitted with the NCR and remain accessible to each recipient
3. **Given** stakeholders have been identified for an NCR, **When** the system forwards the NCR, **Then** each recipient receives notification (email, dashboard alert, or in-system notification) with a link to view the complete NCR details
4. **Given** an NCR has been forwarded, **When** the NCR Originator or authorized user views the forwarding status, **Then** they see confirmation that all required stakeholders have been notified with timestamp and delivery status for each recipient
5. **Given** a stakeholder's role or contact information changes, **When** a previously submitted NCR is viewed, **Then** the system identifies the stakeholder roles that were valid at the time of submission for audit compliance

---

### User Story 2 - Review and Disposition Nonconformance Report (Priority: P1)

An Operations Manager or Quality Lead receives new/pending NCRs and must review
the nonconformance details. Based on the situation (scrap, rework, use-as-is,
return to vendor), they select a disposition and document the rationale for
their decision.

**Why this priority**: Dispositioning is the second critical workflow step.
Without it, NCRs pile up and no corrective action occurs. This drives actual
resolution of quality issues.

**Independent Test**: Can be fully tested by routing a submitted NCR to a user
with disposition authority, allowing them to select from defined dispositions
with supporting documentation, and verifying the NCR transitions to
"Dispositioned" status with an audit trail.

**Acceptance Scenarios**:

1. **Given** an NCR is in "Submitted" status, **When** an authorized
   dispositioner accesses the NCR, **Then** they see disposition options: Scrap,
   Rework, Use-As-Is, Return to Vendor, Investigate Further, Review
   Specification
2. **Given** a dispositioner selects a disposition, **When** they submit
   supporting notes/rationale, **Then** the system records the choice,
   rationale, dispositioner name, and timestamp
3. **Given** a disposition is entered, **When** the NCR status updates, **Then**
   it transitions to "Dispositioned" and becomes visible to approvers
4. **Given** a dispositioner attempts to disposition without providing required
   rationale, **When** they click confirm, **Then** the system displays an error
   and requests the required documentation

---

### User Story 3 - Approve Nonconformance Report (Priority: P1)

A Quality Manager or Executive Approver reviews the disposition decision and
supporting rationale. They either approve the disposition plan or reject it with
feedback requiring further investigation or alternative disposition.

**Why this priority**: Approval provides management oversight and ensures
consensus on how to handle conformance issues. Without approvals, dispositions
may not be properly authorized or compliant with quality standards.

**Independent Test**: Can be fully tested by routing a dispositioned NCR to an
approver, allowing them to approve or reject with feedback, and verifying the
NCR transitions to "Approved" or "Failed Approval" status with documented
reasoning.

**Acceptance Scenarios**:

1. **Given** an NCR is in "Dispositioned" status, **When** an authorized
   approver views it, **Then** they see the full nonconformance description,
   proposed disposition, and supporting rationale
2. **Given** an approver reviews the disposition, **When** they click "Approve",
   **Then** the NCR transitions to "Approved" status with approver name and
   timestamp recorded
3. **Given** an approver determines the disposition is inadequate, **When** they
   click "Reject", **Then** it transitions back to "Submitted" with required
   feedback comments visible to the original dispositioner
4. **Given** an NCR has been approved, **When** any authorized user views the
   NCR, **Then** they see "APPROVED" clearly marked with approval date and
   approver information

---

### User Story 4 - Track and Report on Nonconformances (Priority: P2)

Quality Managers and Executives need visibility into NCR status, trends, and
closure rate. They can view reports showing: pending NCRs by category,
disposition breakdown (scrap vs rework vs use-as-is), aging NCRs (time in
workflow), and closure metrics.

**Why this priority**: Reporting enables quality visibility and management
decision-making, but is secondary to the core workflow. The system can function
without reporting; however, reporting ensures quality metrics are trackable.

**Independent Test**: Can be fully tested by creating multiple NCRs in various
states, then verifying the reporting dashboard correctly displays counts,
categories, aging, and trends without implementation-specific technical metrics.

**Acceptance Scenarios**:

1. **Given** there are multiple NCRs in the system, **When** a Quality Manager
   accesses the NCR Dashboard, **Then** they see: total open NCRs, NCRs by
   status (Submitted, Dispositioned, Approved), and average time in workflow
2. **Given** an NCR has been approved, **When** it is marked as "Closed" with
   closure notes, **Then** it appears in closed NCR reports and is excluded from
   open/pending metrics
3. **Given** a user needs to trend nonconformances, **When** they access the
   Nonconformance Report view, **Then** they can filter by: Product/Part Number,
   Specification/Drawing, Date Range, Root Cause Category, Disposition Type
4. **Given** 30+ days have passed since NCR submission without approval,
   **When** the aging report is generated, **Then** the NCR appears as
   "Escalation Needed" and is highlighted to management

---

### User Story 5 - Close and Archive Nonconformance Record (Priority: P3)

After a nonconformance has been approved and all corrective actions are
complete, an authorized user marks the NCR as Closed. The closed NCR becomes
part of the quality history archive but is no longer considered "open" in active
workflow dashboards.

**Why this priority**: Closure and archiving are important for data hygiene and
historical tracking, but can be implemented after core workflow (P1) is
complete. Organizations can informally track closure before this feature exists.

**Independent Test**: Can be fully tested by completing full workflow (submit →
disposition → approve) and then verifying a user can mark as closed, specify
closure details, and confirm it removes from active tracking while remaining
searchable in archives.

**Acceptance Scenarios**:

1. **Given** an NCR is in "Approved" status, **When** a user with appropriate
   role accesses it, **Then** they see an option to "Close NCR"
2. **Given** a user selects "Close NCR", **When** they provide closure notes
   (e.g., "Corrective action completed"), **Then** the NCR transitions to
   "Closed" with closure date and notes recorded
3. **Given** an NCR is closed, **When** a user views the active/open NCR list,
   **Then** the closed NCR does not appear, improving focus on items requiring
   action
4. **Given** a closed NCR is searched for historical purposes, **When** a user
   performs a search including closed NCRs, **Then** the record is found with
   full history intact

---

### Edge Cases

- What happens when a critical nonconformance requires escalation before normal
  disposition (e.g., safety issue)?
- How does the system handle NCRs affecting shipped/delivered products vs.
  in-progress items?
- What if the referenced Specification/Drawing/PO is no longer available in the
  system?
- How does the system manage NCR reassignment if the original dispositioner is
  unavailable?
- Can an approved disposition be overridden, and if so, what audit trail changes
  are needed?
- What happens if a stakeholder (CE/CS, Group Leader, QA, Director/PM) is not
  assigned or the email/notification delivery fails?
- How does the system handle changes to stakeholder assignments after an NCR has
  already been forwarded?

## Requirements _(mandatory)_

### Functional Requirements

#### NCR Initiation

- **FR-001**: System MUST allow NCR Originators (Quality Inspectors, Line
  Inspectors, Quality Engineers) and authorized users to create a new
  Nonconformance Report (NCR)
- **FR-002**: System MUST capture the following mandatory data when creating an
  NCR: Part Name, Part Number, Part Revision, Quantity, Supplier Name, Work
  Breakdown Structure (WBS) Number, Cognizant Engineer/Scientist (CE/CS) name,
  Specification/Drawing/PO Reference, Description of Nonconformance, Discovery
  Date, and Originator Information
- **FR-003**: System MUST validate that all mandatory fields are populated and
  properly formatted before allowing NCR submission
- **FR-004**: System MUST automatically assign a unique, sequential NCR number
  upon submission
- **FR-005**: System MUST record the creation timestamp, creator identity, and
  transition NCR to "Submitted" status upon creation
- **FR-006**: System MUST allow NCR Originators to attach supporting
  documentation (images, drawings, test results, inspection reports) to NCRs
- **FR-006a**: System MUST support launching NCR creation from within an
  eTraveler work instruction, with automatic context capture (Traveler ID, step
  number, associated part/assembly information) and linking of the NCR to the
  specific Traveler step
- **FR-006b**: System MUST display the newly generated NCR number in the
  eTraveler upon successful creation when NCR is initiated from a Traveler step

#### NCR Forwarding and Notification

- **FR-007**: System MUST automatically forward the submitted NCR to all required
  stakeholders upon submission: Cognizant Engineer/Scientist (CE/CS) for
  engineering disposition, Cognizant Group Leader, QA Staff, and Cognizant
  Division Director or Project Manager
- **FR-008**: System MUST identify the correct CE/CS, Cognizant Group Leader,
  QA Staff, and Division Director/PM based on organizational role assignments,
  part assignment, or project assignment
- **FR-009**: System MUST transmit all NCR attachments (photographs, inspection
  reports, test data, drawings) along with the NCR forwarding to all
  stakeholders
- **FR-010**: System MUST send notifications (email, dashboard alert, or
  in-system notification) to all forwarded stakeholders with a link to access
  the complete NCR details
- **FR-011**: System MUST maintain a forwarding log showing: each stakeholder
  who received the NCR, timestamp of forwarding, delivery status for each
  recipient, and stakeholder roles as they existed at time of forwarding
- **FR-012**: System MUST record and display forwarding confirmation on the NCR,
  showing that all required stakeholders have been notified with delivery
  timestamp for each

#### NCR Disposition

- **FR-013**: System MUST display NCRs in "Submitted" status to users with
  disposition authority
- **FR-014**: System MUST provide a predefined set of disposition options:
  Scrap, Rework, Use-As-Is, Return to Vendor, Investigate Further, Review
  Specification
- **FR-015**: System MUST require dispositioning users to document the
  rationale/justification for their selected disposition
- **FR-016**: System MUST record the disposition, rationale, dispositioner
  identity, and timestamp when a disposition decision is recorded
- **FR-017**: System MUST transition NCR to "Dispositioned" status after
  disposition data is submitted
- **FR-018**: System MUST prevent disposition submission if required rationale
  fields are empty

#### NCR Approval

- **FR-019**: System MUST display "Dispositioned" NCRs to users with approval
  authority
- **FR-020**: System MUST show the complete NCR history (nonconformance details,
  disposition, rationale) to approvers for review
- **FR-021**: System MUST allow approvers to approve or reject dispositions
- **FR-022**: System MUST transition approved NCRs to "Approved" status and
  record approver identity and timestamp
- **FR-023**: System MUST transition rejected NCRs back to "Submitted" status
  with required feedback comments visible to dispositioner
- **FR-024**: System MUST NOT allow closure of an NCR until it has been approved

#### NCR Closure

- **FR-025**: System MUST allow authorized users to close approved NCRs
- **FR-026**: System MUST require closure notes documenting completion status
  and corrective actions taken
- **FR-027**: System MUST transition closed NCRs to "Closed" status and record
  closure date and notes
- **FR-028**: System MUST exclude closed NCRs from active/open workflow
  dashboards by default

#### Reporting and Visibility

- **FR-029**: System MUST provide a dashboard showing counts of NCRs by status
  (Submitted, Dispositioned, Approved, Closed)
- **FR-030**: System MUST generate aging reports showing time elapsed since NCR
  submission for open NCRs
- **FR-031**: System MUST support filtering and searching NCRs by: Item/Part
  Number, Specification Reference, Date Range, Status, Disposition Type, and
  Root Cause Category
- **FR-032**: System MUST maintain complete audit trail for all NCR state
  transitions with timestamp and user identity

#### Security and Access Control

- **FR-033**: System MUST enforce role-based access control: Quality Inspector
  (create), Dispositioner (disposition), Approver (approve), Manager (view
  reports)
- **FR-034**: System MUST require authentication for all NCR operations
- **FR-035**: System MUST prevent unauthorized users from modifying or viewing
  restricted NCR data
- **FR-036**: System MUST log all access and modifications to NCRs for
  compliance auditing

#### Data Management

- **FR-037**: System MUST persist all NCR data reliably with backups
- **FR-038**: System MUST handle concurrent access to the same NCR without data
  corruption
- **FR-039**: System MUST not allow duplicate NCRs for the same nonconformance
  incident
- **FR-040**: System MUST support linking related NCRs (e.g., same root cause
  affecting multiple items)

### Key Entities

**Nonconformance Report (NCR)**:

- Represents a reported quality issue for an item/product that doesn't meet
  specifications or requirements
- Attributes: NCR Number (unique, auto-generated), Part Name, Part Number, Part
  Revision, Quantity, Supplier Name, WBS Number, Cognizant Engineer/Scientist
  Name, Specification/Drawing/PO Reference, Description of Nonconformance,
  Discovery Date, Discovery Context (incoming inspection / in-house assembly /
  in-house inspection), Status (Submitted/Dispositioned/Approved/Closed),
  Originator Identity, Creation Timestamp, Traveler Link (if applicable:
  Traveler ID, step number)
- Relationships: Links to specific Items/Parts, References Suppliers, References
  Specifications/Drawings/POs, Links to eTraveler steps (optional), Has
  Disposition, Has Approval, Has Closure Record, Tracks Audit History

**Disposition**:

- Represents the authorized decision on how to handle the nonconforming item
- Attributes: Disposition Type (Scrap/Rework/Use-As-Is/Return to
  Vendor/Investigate/Review Spec), Rationale, Dispositioner Identity, Decision
  Timestamp, Supporting Documentation
- Relationships: Associated with one NCR, Recorded by Dispositioner User

**Approval**:

- Represents management authorization of the disposition decision
- Attributes: Approval Status (Approved/Rejected), Approver Identity, Approval
  Timestamp, Comments/Feedback, Re-review Timestamp (if rejected and
  resubmitted)
- Relationships: Associated with one Dispositioned NCR, Recorded by Approver
  User

**Closure Record**:

- Represents completion of corrective actions and formal closure of the NCR
- Attributes: Closure Date, Closure Notes, Closed By (user identity), Closure
  Timestamp
- Relationships: Associated with one Approved NCR, References Completed
  Corrective Actions

**Audit Log Entry**:

- Tracks all changes to NCR throughout its lifecycle
- Attributes: Action Type, User Identity, Timestamp, Previous State, New State,
  Comments
- Relationships: Associated with one NCR, Multiple entries per NCR

**Forwarding Log Entry**:

- Records the transmission of an NCR to stakeholders upon submission
- Attributes: Stakeholder Role (CE/CS, Group Leader, QA Staff, Director/PM),
  Stakeholder Identity, Forwarding Timestamp, Delivery Status
  (Pending/Delivered/Failed), Delivery Timestamp, Stakeholder Role as of
  Forwarding Time (for audit compliance), Attachment Transmission Status,
  Notification Method (email/dashboard/system alert)
- Relationships: Associated with one NCR, Multiple entries per NCR (one per
  stakeholder), Created at time of NCR submission

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can create a complete NCR with all required information in
  under 5 minutes
- **SC-002**: 100% of created NCRs are successfully stored and retrievable in
  the system
- **SC-003**: NCRs transition through workflow states (Submitted → Dispositioned
  → Approved → Closed) automatically upon user action with zero data loss
- **SC-004**: NCR search and filtering returns matching records in under 2
  seconds for repositories with 10,000+ NCRs
- **SC-005**: Authorized users can view complete audit trail showing all changes
  to an NCR with timestamps and user identity
- **SC-006**: 95% of NCRs are dispositioned within 5 business days of submission
  (supports quality response metrics)
- **SC-007**: Managers can generate status reports showing open/pending NCR
  counts and aging within 1 minute
- **SC-008**: System prevents unauthorized access - users without proper roles
  cannot view or edit NCR data
- **SC-009**: Rejected NCRs are successfully resubmitted and re-reviewed without
  losing original documentation
- **SC-010**: System supports concurrent access by 10+ users simultaneously
  without data corruption or conflicts
- **SC-011**: NCR closure reduces the count of "open/pending" NCRs in dashboards
  in real-time
- **SC-012**: Users report the NCR interface as "easy to use" in post-deployment
  survey with at least 80% satisfaction rating

## Assumptions

- User roles (Quality Inspector, Dispositioner, Approver, Manager) are
  pre-configured and managed separately (external identity/authorization system)
- Item/Part Numbers and Specification/Drawing References already exist in a
  system that can be referenced (assume separate master data system)
- Nonconformance workflows follow a linear progression (Submitted → Disposition
  → Approval → Closure); rejection loops back to Submitted state
- The organization defines disposition options (Scrap, Rework, etc.) in advance;
  system uses predefined list rather than user-defined
- Email notifications for status changes are desirable but not required for MVP
  (can be added post-launch)
- Historical closed NCRs remain searchable and auditable with no data
  purge/deletion policy enforced
- System will initially support single-language interface (English);
  internationalization can be added later if needed
