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
   NCR, **Then** the system assigns a unique NCR number following the
   organization's naming convention and transitions the NCR to "Submitted"
   status
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

Upon submission of an NCR, the system automatically forwards the initiated NCR
(including all attachments such as photographs, inspection reports, or test
data) to the appropriate organizational personnel for notification and action.
The NCR Originator or system administrator can verify that all required
stakeholders have been notified and have received the complete NCR
documentation.

**Why this priority**: Timely notification of key stakeholders (CE/CS, Group
Leader, QA Staff, Division Director/PM) is critical for rapid response to
nonconformances. Delays in notification can cascade into longer resolution times
and increased impact to production. This is a core part of the initiation
workflow.

**Independent Test**: Can be fully tested by creating and submitting an NCR,
then verifying that: (1) the system correctly identifies and routes the NCR to
all required stakeholders based on organizational roles/assignments, (2) all
attachments are successfully transmitted with the NCR, and (3) notification
records show delivery/receipt confirmation for each stakeholder.

**Acceptance Scenarios**:

1. **Given** an NCR is submitted with valid data, **When** the system processes
   the submission, **Then** the NCR is automatically forwarded to: Cognizant
   Engineer/Scientist (for engineering disposition), Cognizant Group Leader (for
   notification), QA Staff (for notification), and Cognizant Division Director
   or Project Manager (for notification)
2. **Given** an NCR includes attachments (photographs, reports, test data),
   **When** it is forwarded to stakeholders, **Then** all attachments are
   transmitted with the NCR and remain accessible to each recipient
3. **Given** stakeholders have been identified for an NCR, **When** the system
   forwards the NCR, **Then** each recipient receives email notification with a
   link to view the complete NCR details
4. **Given** an NCR has been forwarded, **When** the NCR Originator or
   authorized user views the forwarding status, **Then** they see confirmation
   that all required stakeholders have been notified with timestamp and delivery
   status for each recipient
5. **Given** a stakeholder's role or contact information changes, **When** a
   previously submitted NCR is viewed, **Then** the system identifies the
   stakeholder roles that were valid at the time of submission for audit
   compliance

---

### User Story 2 - Review and Disposition Nonconformance Report (Priority: P1)

The Cognizant Engineer/Scientist (CE/CS) receives the forwarded NCR and performs
engineering disposition by selecting the appropriate parts disposition option
(Rework, Repair, Return to Vendor, Scrap, or Use-As-Is), providing detailed
rework/repair instructions (if applicable), documenting the root cause of the
nonconformance, and specifying corrective actions to prevent future occurrence.
After completing the disposition analysis, the CE/CS electronically forwards the
dispositioned NCR to QA Staff for review and approval.

**Why this priority**: Dispositioning is the critical engineering analysis step.
The CE/CS provides the technical expertise to determine the correct disposition
and root cause analysis. Without sound technical disposition and preventive
actions, nonconformances will recur. This drives actual resolution and
continuous improvement.

**Independent Test**: Can be fully tested by routing a forwarded NCR to an
CE/CS, allowing them to enter all mandatory disposition information (parts
disposition from defined options, detailed instructions, root cause analysis,
preventive actions), and verifying the NCR transitions to "Dispositioned" status
and routes to QA Staff with complete audit trail.

**Acceptance Scenarios**:

1. **Given** an NCR is in "Submitted" status and has been forwarded to the
   CE/CS, **When** the CE/CS accesses the NCR, **Then** they see mandatory
   fields for: Parts Disposition (checkbox selection from Rework, Repair, Return
   to Vendor, Scrap, Use-As-Is), Rework/Repair Instructions, Root Cause of
   Problem, and Actions to Prevent Future Occurrence
2. **Given** a CE/CS selects a disposition option requiring corrective action
   (Rework or Repair), **When** they attempt to save, **Then** the system
   requires detailed Rework/Repair Instructions and will not allow submission
   without this information
3. **Given** a CE/CS has entered all mandatory information, **When** they submit
   the disposition, **Then** the system records the CE/CS identity, timestamp,
   and all disposition details and automatically routes the NCR to QA Staff
4. **Given** a CE/CS attempts to submit disposition without completing all
   mandatory root cause and preventive action fields, **When** they click
   submit, **Then** the system displays validation errors specifying which
   required fields are incomplete and prevents submission
5. **Given** disposition has been submitted by the CE/CS, **When** the NCR
   status updates, **Then** it transitions to "Dispositioned" and becomes
   visible to QA Staff and approvers

---

### User Story 3 - QA Review and Approve Nonconformance Report (Priority: P1)

QA Staff receives the dispositioned NCR from the CE/CS and reviews both the
nonconformance details and the engineering disposition. In conjunction with the
CE/CS (as needed), QA Staff determines whether additional Approvers and
personnel beyond the standard distribution are necessary. QA Staff may designate
additional Approvers for approval authority and additional personnel to receive
copies of the NCR. After making these designations, QA Staff approves the NCR
using the Nonconformance Reporting System. Upon QA Staff's approval, the system
automatically distributes the NCR to all designated Approvers.

**Why this priority**: QA Staff provides essential quality oversight and
coordinates approvals. Their role in designating appropriate approval
authorities and interested parties ensures all necessary stakeholders
participate in authorization decisions. Without QA's systematic approach to
approval coordination, critical stakeholders might be missed and approval
authority might be inconsistent.

**Independent Test**: Can be fully tested by routing a dispositioned NCR to QA
Staff, allowing them to review the disposition, work with CE/CS context to
designate additional approvers and distribution personnel, approve the NCR, and
verifying the NCR reaches all designated approvers automatically with
appropriate access and notification.

**Acceptance Scenarios**:

1. **Given** an NCR is in "Dispositioned" status, **When** QA Staff accesses the
   NCR, **Then** they see the full nonconformance description, CE/CS-provided
   disposition (parts disposition, root cause, preventive actions, rework/repair
   instructions), and can review all supporting documentation
2. **Given** QA Staff is reviewing a disposition, **When** they consult with the
   CE/CS (through NCR comments or direct communication), **Then** they can
   identify if additional Approvers beyond the standard approvers are necessary
3. **Given** QA Staff determines additional Approvers are needed, **When** they
   access the approval section of the NCR, **Then** they can designate
   additional Approvers by role, name, or organizational unit
4. **Given** QA Staff may want to notify additional personnel outside the formal
   approval chain, **When** they designate additional distribution personnel,
   **Then** the system allows them to specify additional recipients who will
   receive read-only copies of the complete NCR
5. **Given** QA Staff has reviewed the disposition and made all necessary
   approver/distribution designations, **When** they click "Approve", **Then**
   the system records QA Staff identity, approval timestamp, designated
   additional approvers, and designated distribution personnel, transitions NCR
   to "Approved" status, and automatically sends the NCR to all designated
   additional approvers with a request to review and approve
6. **Given** QA Staff's approval is recorded, **When** any designated Approver
   accesses the NCR, **Then** they see QA Staff's approval and have the ability
   to give final authorization or return for comment
7. **Given** a Designated Approver does not agree with the disposition, **When**
   they click "Return for Comment", **Then** the NCR transitions to "Returned
   for Comment" status and is routed back to QA Staff for comment resolution
8. **Given** there are no outstanding comments, **When** a Designated Approver
   reviews the NCR, **Then** they can approve it using the system and record
   their final authorization
9. **Given** QA Staff needs to reject the disposition, **When** they click
   "Reject" with required feedback, **Then** the NCR transitions back to
   "Dispositioned" status with feedback visible to the CE/CS

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
   status (Submitted, Dispositioned, Approved, Returned for Comment, Final
   Approval, Closed), and average time in workflow
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

### User Story 5 - Execute Disposition and Close Nonconformance Record (Priority: P3)

After an NCR has received final approval from all designated approvers, the NCR
Originator (or a designee) executes the authorized disposition (such as
performing rework, repair, or other corrective actions) and then closes the NCR.
When an NCR is marked as Closed, the system automatically distributes it to all
Approvers and designated distribution personnel, and the closed NCR becomes part
of the quality history archive but is no longer considered "open" in active
workflow dashboards. If a Traveler was used, the Originator returns to the
operation where the nonconformance occurred and electronically signs off, which
closes the NCR in the system.

**Why this priority**: Closure and archiving are important for data hygiene and
historical tracking, but can be implemented after core workflow (P1) is
complete. Organizations can informally track closure before this feature exists.
Importantly, the Originator's execution of the disposition and sign-off ensures
accountability and verifies that corrective actions are actually implemented.

**Independent Test**: Can be fully tested by completing full workflow (submit →
disposition → approve → final approval) and then verifying the NCR Originator
can close the NCR with closure notes, that closure auto-distributes to all
Approvers and distribution personnel, and confirms it removes from active
tracking while remaining searchable in archives. For Traveler-initiated NCRs,
verify electronic sign-off capability closes the NCR.

**Acceptance Scenarios**:

1. **Given** an NCR is in "Final Approval" status, **When** the NCR Originator
   or designee accesses it, **Then** they see an option to "Close NCR" and
   execute the authorized disposition
2. **Given** a user selects "Close NCR", **When** they provide closure notes
   (e.g., "Rework completed and verified"), **Then** the NCR transitions to
   "Closed" with closure date and notes recorded
3. **Given** an NCR is closed, **When** the system records the closed status,
   **Then** it automatically distributes the closed NCR to all designated
   Approvers and distribution personnel for their final records
4. **Given** an NCR was initiated from a Traveler, **When** the NCR Originator
   returns to the operation where the nonconformance occurred, **Then** they can
   electronically sign off, which closes the NCR and includes an electronic copy
   with the Traveler
5. **Given** an NCR is closed, **When** a user views the active/open NCR list,
   **Then** the closed NCR does not appear, improving focus on items requiring
   action
6. **Given** a closed NCR is searched for historical purposes, **When** a user
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
- How does the system manage NCR reassignment if the original dispositioner or
  Originator is unavailable?
- Can an approved disposition be overridden, and if so, what audit trail changes
  are needed?
- What happens if a stakeholder (CE/CS, Group Leader, QA, Director/PM) is not
  assigned or the email/notification delivery fails?
- How does the system handle changes to stakeholder assignments after an NCR has
  already been forwarded?
- What happens when a Designated Approver returns an NCR for comment multiple
  times before reaching agreement?
- How does the system handle when the NCR Originator or Designee is unavailable
  to close/execute the disposition?
- What occurs if a Traveler-initiated NCR is closed but the Traveler record is
  no longer active or accessible?

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
- **FR-004**: System MUST automatically assign a unique NCR number following the
  organization's naming convention upon submission
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

- **FR-007**: System MUST automatically forward the submitted NCR to all
  required stakeholders upon submission: Cognizant Engineer/Scientist (CE/CS)
  for engineering disposition, Cognizant Group Leader, QA Staff, and Cognizant
  Division Director or Project Manager
- **FR-008**: System MUST identify the correct CE/CS, Cognizant Group Leader, QA
  Staff, and Division Director/PM based on organizational role assignments, part
  assignment, or project assignment
- **FR-009**: System MUST transmit all NCR attachments (photographs, inspection
  reports, test data, drawings) along with the NCR forwarding to all
  stakeholders
- **FR-010**: System MUST send email notifications to all forwarded stakeholders
  with a link to access the complete NCR details
- **FR-011**: System MUST maintain a forwarding log showing: each stakeholder
  who received the NCR, timestamp of forwarding, delivery status for each
  recipient, and stakeholder roles as they existed at time of forwarding
- **FR-012**: System MUST record and display forwarding confirmation on the NCR,
  showing that all required stakeholders have been notified with delivery
  timestamp for each

#### NCR Disposition (CE/CS Engineering Analysis)

- **FR-013**: System MUST display NCRs in "Submitted" status to the assigned
  Cognizant Engineer/Scientist (CE/CS) for engineering disposition
- **FR-014**: System MUST provide a predefined set of parts disposition options:
  Rework, Repair, Return to Vendor, Scrap, Use-As-Is
- **FR-015**: System MUST require the CE/CS to document the root cause of the
  nonconformance problem
- **FR-016**: System MUST require the CE/CS to specify actions to prevent future
  occurrence (corrective and preventive actions)
- **FR-017**: System MUST require the CE/CS to provide detailed Rework/Repair
  Instructions when the selected disposition is Rework or Repair
- **FR-018**: System MUST record the CE/CS identity, parts disposition
  selection, root cause documentation, preventive actions, rework/repair
  instructions (if applicable), and timestamp when disposition is submitted
- **FR-019**: System MUST transition NCR to "Dispositioned" status after all
  mandatory disposition data is submitted
- **FR-020**: System MUST prevent disposition submission if any mandatory fields
  (parts disposition, root cause, preventive actions, or-if applicable-rework
  instructions) are incomplete
- **FR-021**: System MUST automatically forward the dispositioned NCR to QA
  Staff upon CE/CS submission of disposition

#### NCR Approval (QA Review and Disposition Authorization)

- **FR-022**: System MUST display "Dispositioned" NCRs to QA Staff and other
  users with approval authority
- **FR-023**: System MUST show the complete NCR history including nonconformance
  details, CE/CS-provided disposition (parts disposition, root cause, preventive
  actions, rework/repair instructions), and associated documentation to
  reviewers
- **FR-024**: System MUST allow QA Staff and approvers to review and approve or
  reject the CE/CS disposition
- **FR-025**: System MUST transition approved NCRs to "Approved" status and
  record approver identity and timestamp
- **FR-026**: System MUST transition rejected NCRs back to "Dispositioned"
  status with required feedback comments visible to the CE/CS dispositioner
- **FR-027**: System MUST NOT allow closure of an NCR until it has been approved
  by authorized personnel

#### Final Approval (Designated Approvers Authorization and Comment Resolution)

- **FR-028**: System MUST display approved NCRs to designated approvers for
  final authorization review
- **FR-029**: System MUST allow designated approvers to review QA Staff's
  approval, all disposition details, and supporting documentation
- **FR-030**: System MUST allow designated approvers to provide final
  authorization by clicking "Approve" to record their authorization, identity,
  and timestamp
- **FR-031**: System MUST allow designated approvers to return an NCR for
  comment by clicking "Return for Comment" if they do not agree with the
  disposition
- **FR-032**: System MUST transition NCRs returned for comment to "Returned for
  Comment" status and route back to QA Staff for resolution and comment
  clarification
- **FR-033**: System MUST track which designated approver returned the NCR and
  what comments/concerns they raised
- **FR-034**: System MUST allow QA Staff to address returned comments through
  consultation with CE/CS and resubmit the NCR to approvers
- **FR-035**: System MUST transition NCRs with resolved comments to "Final
  Approval" status once all designated approvers have authorized
- **FR-036**: System MUST record the Final Approval timestamp and approver
  identities in the NCR audit trail

#### NCR Closure

- **FR-037**: System MUST allow NCR Originator or designee to execute the
  authorized disposition (such as performing rework, repair, or other corrective
  actions) and close approved NCRs that have received final approval
- **FR-038**: System MUST provide electronic sign-off capability for
  Traveler-initiated NCRs, allowing the Originator to return to the operation
  where the nonconformance occurred and electronically sign off, which closes
  the NCR
- **FR-039**: System MUST require closure notes documenting completion status
  and verification that corrective actions and preventive actions from the CE/CS
  disposition have been implemented
- **FR-040**: System MUST transition closed NCRs to "Closed" status, record
  closure date, notes, and originator identity
- **FR-040a**: System MUST automatically distribute the closed NCR to all
  designated Approvers and designated Distribution Personnel upon closing for
  their final records
- **FR-040b**: System MUST, for Traveler-initiated NCRs, include an electronic
  copy of the closed NCR with the Traveler record
- **FR-040c**: System MUST exclude closed NCRs from active/open workflow
  dashboards by default

#### Reporting and Visibility

- **FR-041**: System MUST provide a dashboard showing counts of NCRs by status
  (Submitted, Dispositioned, Approved, Returned for Comment, Final Approval,
  Closed)
- **FR-042**: System MUST generate aging reports showing time elapsed since NCR
  submission for open NCRs
- **FR-043**: System MUST support filtering and searching NCRs by: Item/Part
  Number, Specification Reference, Date Range, Status, Parts Disposition Type
  (Rework/Repair/Return/Scrap/Use-As-Is), and Root Cause Categories
- **FR-044**: System MUST maintain complete audit trail for all NCR state
  transitions with timestamp and user identity

#### Security and Access Control

- **FR-045**: System MUST enforce role-based access control with specific role
  permissions: NCR Originator (create), CE/CS (disposition), QA Staff (review,
  approve, designate approvers/distribution), Designated Approver (review and
  provide final approval), Manager (view reports)
- **FR-046**: System MUST require authentication for all NCR operations
- **FR-047**: System MUST prevent unauthorized users from modifying or viewing
  restricted NCR data
- **FR-048**: System MUST provide read-only access to designated distribution
  personnel without approval authority
- **FR-049**: System MUST log all access and modifications to NCRs for
  compliance auditing

#### Data Management

- **FR-050**: System MUST persist all NCR data reliably with backups
- **FR-051**: System MUST handle concurrent access to the same NCR without data
  corruption
- **FR-052**: System MUST not allow duplicate NCRs for the same nonconformance
  incident
- **FR-053**: System MUST support linking related NCRs (e.g., same root cause
  affecting multiple items)

### Key Entities

**Nonconformance Report (NCR)**:

- Represents a reported quality issue for an item/product that doesn't meet
  specifications or requirements, tracked through engineering disposition and
  quality approval coordination
- Attributes: NCR Number (unique, auto-generated following naming convention),
  Part Name, Part Number, Part Revision, Quantity, Supplier Name, WBS Number,
  Cognizant Engineer/Scientist (CE/CS) Name, Specification/Drawing/PO Reference,
  Description of Nonconformance, Discovery Date, Discovery Context (incoming
  inspection / in-house assembly / in-house inspection), Status
  (Submitted/Dispositioned/Approved/Returned for Comment/Final Approval/Closed),
  Originator Identity, Creation Timestamp, Traveler Link (if applicable:
  Traveler ID, step number), Parts Disposition (Rework/Repair/Return to
  Vendor/Scrap/Use-As-Is), Root Cause Documentation, Preventive Actions,
  Rework/Repair Instructions (if applicable), CE/CS Identity, CE/CS Disposition
  Timestamp, QA Staff Identity, QA Staff Approval Timestamp, Designated
  Additional Approvers (list with roles/names), Designated Distribution
  Personnel (list)
- Relationships: Links to specific Items/Parts, References Suppliers, References
  Specifications/Drawings/POs, Links to eTraveler steps (optional), Has
  Disposition (completed by CE/CS), Has QA Approval (completed by QA Staff), Has
  Final Approval (completed by Designated Approvers), Has Closure Record, Tracks
  Audit History, Tracks Forwarding History, Tracks Approver Designations

**Disposition**:

- Represents the CE/CS engineering analysis and authorized decision on how to
  handle the nonconforming item, including root cause analysis and preventive
  actions
- Attributes: Parts Disposition Type (Rework/Repair/Return to
  Vendor/Scrap/Use-As-Is), Root Cause Documentation, Preventive Actions (Actions
  to Prevent Future Occurrence), Rework/Repair Instructions (if applicable),
  CE/CS Identity, Disposition Timestamp, Supporting Technical Documentation
- Relationships: Associated with one NCR, Recorded by Cognizant
  Engineer/Scientist (CE/CS) User, Forwarded to QA Staff for approval

**Approval**:

- Represents management authorization of the disposition decision, including QA
  Staff approval with approver designations and Final Approval by designated
  approvers
- Attributes: Approval Status (Approved/Rejected/Returned for Comment), Approver
  Identity, Approval Timestamp, Comments/Feedback, Re-review Timestamp (if
  rejected and resubmitted), Designated Additional Approvers (list), Designated
  Distribution Personnel (list)
- Relationships: Associated with one Dispositioned NCR, Recorded by QA Staff
  and/or Designated Approver Users, Tracks Comment Resolution If Returned for
  Comment

**Closure Record**:

- Represents execution of the authorized disposition and formal closure of the
  NCR by the NCR Originator or designee
- Attributes: Closure Date, Closure Notes (documenting disposition execution
  verification), Closed By (NCR Originator or designee identity), Closure
  Timestamp, Distribution Notification Timestamp (when auto-distributed)
- Relationships: Associated with one Final-Approved NCR, References Executed
  Corrective Actions, Tracks Closure Notifications to Approvers and Distribution
  Personnel

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
  Forwarding Time (for audit compliance), Attachment Transmission Status, Email
  Notification Status
- Relationships: Associated with one NCR, Multiple entries per NCR (one per
  stakeholder), Created at time of NCR submission

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can create a complete NCR with all required information in
  under 5 minutes
- **SC-002**: 100% of created NCRs are successfully stored and retrievable in
  the system
- **SC-003**: NCRs transition through workflow states (Submitted → Dispositioned
  → Approved → Final Approval → Closed) automatically upon user action with zero
  data loss; Returned for Comment status enables comment resolution loops
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
- **SC-009**: Returned-for-comment and rejected NCRs are successfully
  resubmitted and re-reviewed without losing original documentation
- **SC-010**: System supports concurrent access by 10+ users simultaneously
  without data corruption or conflicts
- **SC-011**: NCR closure reduces the count of "open/pending" NCRs in dashboards
  in real-time
- **SC-012**: Upon NCR closure by the Originator, the system automatically
  distributes the closed NCR to all designated Approvers and distribution
  personnel within 2 minutes
- **SC-013**: Users report the NCR interface as "easy to use" in post-deployment
  survey with at least 80% satisfaction rating

## Assumptions

- User roles (Quality Inspector, Dispositioner, Approver, Manager) are
  pre-configured and managed separately (external identity/authorization system)
- Item/Part Numbers and Specification/Drawing References already exist in a
  system that can be referenced (assume separate master data system)
- Nonconformance workflows follow a progression (Submitted → Disposition →
  Approval → Final Approval → Closure) with rejection and comment loops: QA
  rejection loops back to Disposition, and Approver "Return for Comment" loops
  back to QA Staff for resolution
- The organization defines disposal options (Scrap, Rework, etc.) in advance;
  system uses predefined list rather than user-defined
- The organization defines the NCR numbering/naming convention; system applies
  this convention when auto-generating NCR numbers (not necessarily sequential)
- Email notifications for status changes are the primary notification method and
  are required for all stakeholder communications (dashboard remains optional
  for visibility)
- Historical closed NCRs remain searchable and auditable with no data
  purge/deletion policy enforced
- System will initially support single-language interface (English);
  internationalization can be added later if needed
