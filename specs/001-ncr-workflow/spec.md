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
system automatically generates a unique NCR number.

> **Implementation note**: The standalone NCR creation page does not expose any
> Traveler-linking fields to the user. The underlying data model
> (`traveler_link`) and the create API's `traveler_id`/`traveler_step_number`
> parameters still exist and remain available for a future eTraveler-launched
> creation flow — see
> [Future Work: eTraveler UI Integration](#future-work-etraveler-ui-integration-not-yet-planned).
> Until that future work is built, no NCR is created with a Traveler link.

**Why this priority**: This is the core workflow - without the ability to
initiate NCRs, the entire system has no purpose. All other workflows depend on
this functionality.

**Independent Test**: Can be fully tested by allowing an NCR Originator to
create an NCR with all required details (Part Information with revision and
quantity, Supplier, WBS, CE/CS name, Nonconformance Description), verify the
system captures and stores the information correctly, and demonstrates that the
NCR is ready for disposition by an authorized reviewer.

**Acceptance Scenarios**:

1. **Given** a user has NCR Originator role, **When** they access NCR creation
   form, **Then** they see mandatory fields for: Part Name, Part Number, Part
   Revision, Quantity, Supplier Name, Work Breakdown Structure (WBS) Number,
   Cognizant Engineer/Scientist name, Description of Nonconformance, Discovery
   Date, and Discovery Context, plus an optional field for Specification/
   Drawing Reference (and PO Reference), and no Traveler-linking fields
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

---

### User Story 1.5 - Send CE/CS Disposition Request and QA Admin Initial Notification (Priority: P1)

Upon submission of an NCR, the system automatically sends two email
notifications: (1) an engineering disposition request TO the designated CE/CS
(with the NCR Originator CC'd) asking them to complete the CE/CS section of the
report, and (2) an initial FYI notification TO all QA Admins (members of the
ncr-qa group) informing them that the NCR has been initiated and forwarded to
CE/CS for engineering disposition. Both notifications depend on the ncr-qa
group being configured with at least one member: if it is not, the system
MUST NOT send either notification — including the CE/CS disposition request —
and the NCR submission itself MUST fail with a clear configuration error,
rather than leaving the CE/CS notified about an NCR that was never actually
created.

> **Implementation note**: Notifications to Cognizant Group Leader and Cognizant
> Division Director/PM upon NCR submission are deferred. The mechanism for
> identifying those personnel from a WBS number is not yet defined. See
> [Future Work: Group Leader and Director Notifications](#future-work-qa-and-management-notifications-deferred).

**Why this priority**: Notifying the CE/CS immediately initiates the engineering
disposition phase, which is the critical next step in the workflow. The CC to
the Originator confirms receipt without requiring a separate confirmation email.
Alerting QA Admins simultaneously ensures quality oversight from the start of
each NCR.

**Independent Test**: Can be fully tested by creating and submitting an NCR,
then verifying that: (1) an engineering disposition request email is sent TO the
designated CE/CS with the NCR Originator CC'd, containing NCR number, Part
Name, Supplier name, Originator name, and a link to the NCR; (2) an initial FYI
notification email is sent TO all members of the ncr-qa group with the NCR
Originator CC'd, containing NCR number, Part Name, Supplier name, Originator
name, CE/CS name, problem description, and a link; and (3) notification records
show delivery status and timestamp for each TO recipient and each CC recipient
independently, with CC status resolved as the best result across all outbound
sends carrying that CC address.

**Acceptance Scenarios**:

1. **Given** an NCR is submitted, **When** the system processes the submission,
   **Then** an engineering disposition request email is automatically sent TO
   the designated CE/CS, with the NCR Originator CC'd, containing: the assigned
   NCR number, Part Name, Supplier name, Originator name, a link to the NCR,
   and any additional comments from the Originator
2. **Given** an NCR is submitted, **When** the system processes the submission,
   **Then** an initial FYI notification email is automatically sent TO all
   members of the ncr-qa group, with the NCR Originator CC'd, containing: the
   assigned NCR number, Part Name, Supplier name, Originator name, CE/CS name,
   the initial description of the nonconformance problem, and a link to the NCR
3. **Given** the CE/CS receives the disposition request email, **When** they
   click the link, **Then** they access the complete NCR with all mandatory
   fields and supporting documentation ready for disposition
4. **Given** a QA Admin receives the initial notification email, **When** they
   click the link, **Then** they can view current and on-going details of the NCR
5. **Given** an NCR has been submitted, **When** an authorized user views the
   notification status, **Then** they see confirmation that both the CE/CS
   disposition request and QA Admin initial notification have been sent, with
   delivery status and timestamp for each TO recipient and for each CC recipient
   independently tracked
6. **Given** the ncr-qa group has no members configured, **When** an NCR
   Originator attempts to submit an NCR, **Then** the submission fails with a
   clear configuration error identifying that QA staff is not configured, no
   CE/CS disposition request email is sent, no QA Admin notification email is
   sent, and no NCR document is created

---

### User Story 2 - CE/CS Performs Engineering Disposition (Priority: P1)

The Cognizant Engineer/Scientist (CE/CS) receives the engineering disposition
request email (with link to NCR) and performs the technical analysis by
selecting the appropriate parts disposition option (Rework, Repair, Return to
Vendor, Scrap, or Use-As-Is), providing detailed rework/repair instructions (if
applicable), documenting the root cause of the nonconformance, and specifying
corrective/preventive actions to prevent future occurrence. After completing the
disposition analysis, the CE/CS submits the disposition through the system.

**Why this priority**: Dispositioning is the critical engineering analysis step.
The CE/CS provides the technical expertise to determine the correct disposition
and root cause analysis. Without sound technical disposition and preventive
actions, nonconformances will recur. This drives actual resolution and
continuous improvement.

**Independent Test**: Can be fully tested by sending a disposition request email
to CE/CS with link to NCR, allowing them to enter all mandatory disposition
information (parts disposition from defined options, detailed instructions, root
cause analysis, preventive actions), and verifying the NCR disposition is
recorded with complete audit trail and ready for QA concurrence.

**Acceptance Scenarios**:

1. **Given** an NCR has been submitted and CE/CS receives disposition request
   email, **When** the CE/CS clicks the link and accesses the NCR, **Then** they
   see all mandatory NCR data: Part Name, Number, Revision, Quantity, Supplier,
   WBS, Description, and supporting attachments
2. **Given** the CE/CS is preparing disposition, **When** they access the
   disposition form, **Then** they see mandatory fields for: Parts Disposition
   (checkbox selection from Rework, Repair, Return to Vendor, Scrap, Use-As-Is),
   Rework/Repair Instructions (if applicable), Root Cause of Problem, and
   Actions to Prevent Future Occurrence
3. **Given** a CE/CS selects a disposition option requiring corrective action
   (Rework or Repair), **When** they attempt to save, **Then** the system
   requires detailed Rework/Repair Instructions and will not allow submission
   without this information
4. **Given** a CE/CS has entered all mandatory information, **When** they submit
   the disposition, **Then** the system records the CE/CS identity, timestamp,
   and all disposition details
5. **Given** a CE/CS attempts to submit disposition without completing all
   mandatory root cause and preventive action fields, **When** they click
   submit, **Then** the system displays validation errors specifying which
   required fields are incomplete and prevents submission

---

### User Story 3 - QA Concurrence and Approver Coordination (Priority: P1)

QA Staff receives a notification that the CE/CS has completed the disposition.
QA Staff reviews the nonconformance details and the engineering disposition. QA
Staff determines whether additional Approvers beyond the standard distribution
are necessary for approval. If additional Approvers are needed, QA Staff
designates them. QA Staff then gives concurrence to the disposition. If QA Staff
gives concurrence, the system sends approval requests to any designated
additional Approvers. If additional Approvers all approve, the NCR moves to
"Final Approval" status. If any Approver does not approve, the NCR returns to QA
Staff for comment resolution.

**Why this priority**: QA Staff provides essential quality oversight and
coordinates approvals. Their role in designating appropriate approval
authorities ensures all necessary stakeholders participate in authorization
decisions. Without QA's systematic approach to approval coordination, critical
stakeholders might be missed.

**Independent Test**: Can be fully tested by routing a dispositioned NCR to QA
Staff, allowing them to review the disposition, designate additional approvers
(if needed), give concurrence, and verifying the NCR reaches all designated
approvers automatically with appropriate access and notification.

**Acceptance Scenarios**:

1. **Given** CE/CS has completed disposition, **When** QA Staff receives
   notification, **Then** they can access the complete NCR with CE/CS-provided
   disposition, view all mandatory fields and supporting documentation
2. **Given** QA Staff is reviewing the disposition, **When** they determine if
   additional Approvers are needed, **Then** they can designate additional
   Approvers by role, name, or organizational unit
3. **Given** QA Staff has reviewed the disposition, **When** they click
   "Concurrence", **Then** the system records QA Staff identity, concurrence
   timestamp, and any designated additional approvers
4. **Given** QA Staff has given concurrence and no additional Approvers are
   designated, **When** the NCR is recorded, **Then** it transitions to "Final
   Approval" status and NCR Originator is notified to execute/close
5. **Given** QA Staff has designated additional Approvers, **When** concurrence
   is recorded, **Then** the NCR transitions to "Approved" status and each
   designated Approver receives an email requesting their approval
6. **Given** a Designated Approver reviews the NCR, **When** they access it,
   **Then** they see the complete nonconformance, CE/CS disposition, and QA
   concurrence with ability to approve or request changes
7. **Given** an Approver does not agree with the disposition, **When** they
   click "Return for Comment", **Then** the NCR transitions to "Returned for
   Comment" status and is routed back to QA Staff with comments
8. **Given** all designated Approvers approve the NCR, **When** the final
   approval is recorded, **Then** the NCR transitions to "Final Approval" status
9. **Given** QA Staff needs to reject the disposition, **When** they click
   "Reject" with required feedback, **Then** the NCR is returned to CE/CS with
   feedback and "Dispositioned" status for revision

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
   Specification/Drawing, Date Range, Disposition Type
4. **Given** 30+ days have passed since NCR submission without approval,
   **When** the aging report is generated, **Then** the NCR appears as
   "Escalation Needed" and is highlighted to management

---

### User Story 5 - NCR Issuance and Execution (Priority: P2)

After the NCR has received final approval from QA Staff (or from all designated
Approvers if additional approvers were designated), the system sends an NCR
ISSUANCE email to the NCR Originator (or designee) requesting execution of the
authorized disposition and subsequent closure of the NCR. The email includes a
link to the NCR with all disposition details and approved corrective actions.
The NCR Originator executes the authorized disposition and then marks the NCR as
Closed.

> **Implementation note**: The "designee" referenced throughout this user
> story (and User Story 6) is the Designate concept defined and implemented
> by [`specs/003-originator-designate/spec.md`](../003-originator-designate/spec.md).
> An NCR's Originator may assign exactly one other user as Designate, who
> then holds the same authority the Originator has on that specific NCR —
> including receiving the ISSUANCE and FINAL NCR DISTRIBUTION emails below,
> and closing the NCR, with their own identity (not the Originator's)
> recorded as the closer. See that spec for the full assignment mechanism,
> authorization rules, and audit trail; this was previously an unspecified
> gap in this document.

**Why this priority**: Issuance ensures the Originator receives clear
notification that the disposition has been approved and they are authorized to
proceed with execution. This provides accountability and prevents unauthorized
actions.

**Independent Test**: Can be fully tested by completing the approval workflow
(submit → disposition → QA concurrence → approval, if needed) and then verifying
the NCR Originator receives an issuance email with link to NCR, can access all
disposition details, mark the NCR as closed with closure notes, and the NCR
transitions to "Closed" status.

**Acceptance Scenarios**:

1. **Given** an NCR has Final Approval status, **When** the approval is recorded
   by QA Staff or final Approver, **Then** the system sends an NCR ISSUANCE
   email to the NCR Originator or designee requesting execution
2. **Given** the NCR Originator receives the issuance email, **When** they click
   the link, **Then** they can access the complete NCR with all approved
   disposition details, root cause analysis, corrective/preventive actions, and
   rework/repair instructions
3. **Given** the NCR Originator is preparing to execute the disposition,
   **When** they access the NCR, **Then** they see the option to mark the NCR as
   "Closed" with execution completion notes
4. **Given** an NCR Originator or designee selects "Close NCR", **When** they
   provide closure notes (e.g., "Rework completed and verified"), **Then** the
   NCR transitions to "Closed" with closure date and notes recorded
5. **Given** an NCR is linked to a Traveler (Traveler ID/step number recorded at
   creation), **When** the NCR Originator or designee attempts to close it,
   **Then** the NCR close form requires them to check a confirmation stating
   the associated Traveler step has been signed off, and the NCR cannot
   transition to "Closed" until this confirmation is checked

> **Implementation note**: This confirmation is a self-attestation checkbox on
> the NCR's own closure form — it is not an electronic sign-off performed
> inside the eTraveler UI, and no electronic copy of the closed NCR is
> attached to the Traveler record. See
> [Future Work: eTraveler UI Integration](#future-work-etraveler-ui-integration-not-yet-planned).

---

### User Story 6 - Final NCR Distribution and Closure Archive (Priority: P2)

When an NCR is marked as Closed, the system automatically sends a FINAL NCR
DISTRIBUTION email to multiple recipient groups: (1) NCR Originator/Designee,
CE/CS, and QA Staff, (2) Preventive Action Owner (if identified), (3) Additional
Approvers (if designated), (4) Cognizant Group Leader and Division Director, (5)
PPM if the nonconformance involved a supplier issue. The closed NCR is removed
from active workflow dashboards but remains searchable in historical archives
with complete audit trail.

> **Implementation note**: "Designee" here is the same Designate concept
> introduced in User Story 5's implementation note — see
> [`specs/003-originator-designate/spec.md`](../003-originator-designate/spec.md).

**Why this priority**: Final distribution ensures all stakeholders receive
closure notification for their records. Archive retention allows historical
trending and reference retrieval without cluttering active dashboards.

**Independent Test**: Can be fully tested by completing full workflow (submit →
disposition → approval → issuance → closed) and then verifying: (1) final
distribution email is sent to 5 stakeholder groups with link to complete NCR,
(2) closed NCR does not appear in active/open NCR list, (3) closed NCR is
searchable and returns complete history when included in search criteria.

**Acceptance Scenarios**:

1. **Given** an NCR is marked as Closed, **When** the system records the closed
   status, **Then** it automatically distributes the closed NCR via email to:
   (1) Originator/Designee, CE/CS, QA Staff, (2) Preventive Action Owner, (3)
   Additional Approvers, (4) Cognizant Group Leader and Division Director, (5)
   PPM (if supplier issue)
2. **Given** recipients receive the final distribution email, **When** they
   click the link, **Then** they can view the complete closed NCR with all
   history: creation, disposition, approvals, and closure information
3. **Given** an NCR is closed, **When** a user views the active/open NCR list,
   **Then** the closed NCR does not appear, improving focus on items requiring
   action
4. **Given** a closed NCR is searched for historical purposes, **When** a user
   performs a search including closed NCRs, **Then** the record is found with
   complete history and audit trail intact
5. **Given** the system maintains closed NCRs in archive, **When** historical
   reports are generated, **Then** closed NCRs remain available for trend
   analysis, root cause trending, and quality metrics reporting

---

### User Story 7 - Preventive Action Tracking and Management (Priority: P2)

When a CE/CS specifies "Actions to Prevent Future Occurrence" during
disposition, the system captures these preventive actions. QA Staff maintains a
list of all preventive actions associated with NCRs and designates an owner for
each preventive action. QA Staff tracks preventive actions to closure, ensuring
that all identified preventive measures are implemented and completed.

**Why this priority**: Preventive action tracking ensures that root causes are
addressed systematically, not just the immediate nonconformance. This drives
continuous improvement and reduces recurrence of similar nonconformances.

**Independent Test**: Can be fully tested by creating an NCR with preventive
actions identified during disposition, verifying the system creates preventive
action records, allows QA Staff to designate owners, track status, and receive
notifications as actions progress to completion.

**Acceptance Scenarios**:

1. **Given** a CE/CS has documented preventive actions during disposition,
   **When** the disposition is submitted, **Then** the system captures and
   displays the list of preventive actions
2. **Given** preventive actions are identified for an NCR, **When** QA Staff
   reviews the NCR, **Then** they can designate an owner/responsible party for
   each preventive action
3. **Given** an owner is designated for a preventive action, **When** the
   designation is recorded, **Then** the system sends notification to the
   designated Preventive Action Owner with details of the action and target
   completion date
4. **Given** a Preventive Action is in progress, **When** the owner updates the
   status, **Then** the system records status changes and tracks toward closure
5. **Given** a Preventive Action is marked complete, **When** QA Staff receives
   completion notification, **Then** they can close the preventive action and
   archive it as part of NCR closure records

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

##### Direct Initiation

- **FR-001**: System MUST allow NCR Originators (Quality Inspectors, Line
  Inspectors, Quality Engineers) and authorized users to create a new
  Nonconformance Report (NCR)
- **FR-002**: System MUST capture the following mandatory data when creating an
  NCR: Part Name, Part Number, Part Revision, Quantity, Supplier Name, Work
  Breakdown Structure (WBS) Number, Cognizant Engineer/Scientist (CE/CS) name,
  Description of Nonconformance, Discovery Date, Discovery Context, and
  Originator Information
- **FR-002a**: System MUST additionally capture the following optional data
  when creating an NCR, if provided: Specification/Drawing Reference and PO
  Reference
- **FR-003**: System MUST validate that all mandatory fields are populated and
  properly formatted before allowing NCR submission
- **FR-004**: System MUST automatically assign a unique NCR number following the
  organization's naming convention upon submission
- **FR-005**: System MUST record the creation timestamp, creator identity, and
  transition NCR to "Submitted" status upon creation
- **FR-006**: System MUST allow NCR Originators to attach supporting
  documentation (images, drawings, test results, inspection reports) to NCRs

##### Initiation from Traveler (data model + API only — not exposed in any UI yet; reserved for [Future Work](#future-work-etraveler-ui-integration-not-yet-planned))

- **FR-006a**: The NCR data model and creation API MUST support an optional
  Traveler ID and step number, persisted as a link between the NCR and the
  referenced Traveler when provided. The standalone NCR creation page MUST NOT
  present any field for entering this link — it exists at the data/API layer
  only, reserved for a future eTraveler-launched creation flow
- **FR-006b**: System MUST make Traveler-linked NCRs retrievable/queryable by
  their linked Traveler ID and step number (for whichever future caller
  populates the link via the API)

#### NCR Submission Notification Emails

- **FR-007**: System MUST automatically send an engineering disposition request
  email TO the designated CE/CS upon NCR submission, with the NCR Originator
  CC'd, requesting completion of the CE/CS section and including: the assigned
  NCR number, Part Name, Supplier name, Originator name, a link to the NCR, and
  any additional comments from the Originator
- **FR-007a**: System MUST verify the ncr-qa QA Admin group has at least one
  configured member *before* sending any submission notification, including
  the CE/CS disposition request (FR-007). If the group is missing or empty,
  the system MUST NOT send the CE/CS disposition request or the QA Admin
  notification, and MUST fail the NCR submission entirely (no NCR document is
  created) with a configuration error identifying that QA staff is not
  configured
- **FR-008**: System MUST automatically send an initial FYI notification email
  TO all members of the ncr-qa QA Admin group upon NCR submission, with the NCR
  Originator CC'd, informing them the NCR has been initiated and forwarded to
  CE/CS for engineering disposition, and including: the assigned NCR number,
  Part Name, Supplier name, Originator name, CE/CS name, initial description of
  the nonconformance problem, and a link to the NCR
- **FR-009**: System MUST record each notification event in the NCR event log,
  capturing for every TO recipient: email address, delivery status, and delivery
  timestamp; and for every CC recipient: email address, delivery status, and
  delivery timestamp tracked independently from TO recipients
- **FR-010**: System MUST track delivery confirmation for both TO and CC
  recipients on each notification email; CC delivery status is resolved as the
  best result (Delivered if any outbound send carrying that CC address succeeded)
- **FR-011**: System MUST display the notification log on the NCR detail view,
  showing TO and CC recipients as distinct rows, each with delivery status badge
  and delivery timestamp

> **Deferred**: Notification to Cognizant Group Leader and Cognizant Division
> Director/PM upon NCR submission is deferred until the mechanism for
> identifying those personnel from a WBS number is defined. QA Admin
> notification (FR-008) is implemented via the ncr-qa group. See
> [Future Work: Group Leader and Director Notifications](#future-work-qa-and-management-notifications-deferred).

> **Resolved — FR-015**: CE/CS delegate assignment will not be implemented.
> Delegation authority on an NCR belongs solely to the Originator. See
> [Resolved: CE/CS Delegate Assignment](#resolved-cecs-delegate-assignment-superseded-by-originator-designate).

#### NCR Disposition (CE/CS Engineering Analysis)

- **FR-016**: System MUST display the engineering disposition request to the
  assigned Cognizant Engineer/Scientist (CE/CS) for their action
- **FR-017**: System MUST provide a predefined set of parts disposition options:
  Rework, Repair, Return to Vendor, Scrap, Use-As-Is
- **FR-018**: System MUST require the CE/CS to document the root cause of the
  nonconformance problem
- **FR-019**: System MUST require the CE/CS to specify actions to prevent future
  occurrence (corrective and preventive actions)
- **FR-020**: System MUST require the CE/CS to provide detailed Rework/Repair
  Instructions when the selected disposition is Rework or Repair
- **FR-021**: System MUST record the CE/CS identity, parts disposition
  selection, root cause documentation, preventive actions, rework/repair
  instructions (if applicable), and timestamp when disposition is submitted
- **FR-022**: System MUST transition NCR to "Dispositioned" status after all
  mandatory disposition data is submitted
- **FR-023**: System MUST prevent disposition submission if any mandatory fields
  (parts disposition, root cause, preventive actions, or-if applicable-rework
  instructions) are incomplete

#### QA Concurrence and Approver Coordination

- **FR-024**: System MUST display "Dispositioned" NCRs to QA Staff for
  concurrence review
- **FR-025**: System MUST show the complete NCR history including nonconformance
  details, CE/CS-provided disposition (parts disposition, root cause, preventive
  actions, rework/repair instructions), and associated documentation to QA Staff
- **FR-026**: System MUST allow QA Staff to review the disposition and designate
  additional Approvers if needed for approval authority
- **FR-027**: System MUST allow QA Staff to record their concurrence on the
  disposition by clicking "Concurrence"
- **FR-028**: System MUST record QA Staff identity, concurrence timestamp, and
  any designated additional approvers when concurrence is recorded
- **FR-029**: System MUST transition NCRs with no additional approvers to "Final
  Approval" status upon QA Staff concurrence
- **FR-030**: System MUST transition NCRs with designated additional approvers
  to "Approved" status and automatically send approval requests to each
  designated approver
- **FR-031**: System MUST allow designated approvers to review QA Staff's
  concurrence, CE/CS disposition, and all supporting documentation
- **FR-032**: System MUST allow designated approvers to provide final
  authorizationby clicking "Approve" to record their authorization, identity,
  and timestamp
- **FR-033**: System MUST allow designated approvers to return an NCR for
  comment by clicking "Return for Comment" if they do not agree with the
  disposition
- **FR-034**: System MUST transition NCRs returned for comment to "Returned for
  Comment" status and route back to QA Staff for resolution and comment
  clarification
- **FR-035**: System MUST track which designated approver returned the NCR and
  what comments/concerns they raised
- **FR-036**: System MUST allow QA Staff to address returned comments through
  consultation with CE/CS and resubmit the NCR to approvers
- **FR-037**: System MUST transition NCRs with resolved comments to "Final
  Approval" status once all designated approvers have authorized
- **FR-038**: System MUST record the Final Approval timestamp and approver
  identities in the NCR audit trail

#### NCR Issuance and Execution

> **Implementation note**: "Designee" in FR-039, FR-040, and FR-043 below is
> the Designate concept defined and implemented by
> [`specs/003-originator-designate/spec.md`](../003-originator-designate/spec.md)
> — see User Story 5's implementation note above for details.

- **FR-039**: System MUST send an NCR ISSUANCE email to the NCR Originator or
  designee upon Final Approval status, with a link to the complete NCR and all
  approved disposition details, requesting execution of the authorized
  disposition and subsequent closure
- **FR-040**: System MUST allow NCR Originator or designee to mark the NCR as
  "Closed" upon completion of the disposition execution
- **FR-041**: System MUST require closure notes documenting completion status
  and verification that corrective actions from the CE/CS disposition have been
  implemented
- **FR-042**: System MUST transition closed NCRs to "Closed" status, record
  closure date, notes, and originator identity
- **FR-043**: System MUST, for Traveler-linked NCRs, require the Originator or
  designee to check a self-attestation confirmation on the NCR closure form
  stating that the associated Traveler step has been signed off, and MUST
  block closure until this confirmation is checked. (This confirmation lives on
  the NCR's own closure form, not inside the eTraveler UI — see
  [Future Work](#future-work-etraveler-ui-integration-not-yet-planned) for
  in-Traveler sign-off and automatic electronic-copy attachment.)

#### Final Distribution and Closure Archive

> **Implementation note**: "Designee" in FR-044 below is the same Designate
> concept — see User Story 5's implementation note above.

- **FR-044**: System MUST automatically send a FINAL NCR DISTRIBUTION email when
  an NCR is closed to the following recipient groups: (1) Originator/Designee,
  CE/CS, QA Staff, (2) Preventive Action Owner (if identified), (3) Additional
  Approvers (if designated), (4) Cognizant Group Leader and Division Director,
  (5) PPM/Supply Management (if the nonconformance involves a supplier issue)
- **FR-045**: System MUST provide a link to the complete closed NCR with full
  history in the final distribution email
- **FR-046**: System MUST exclude closed NCRs from active/open workflow
  dashboards by default
- **FR-047**: System MUST maintain closed NCR records in archive with complete
  audit trail for historical reference and trending

#### Preventive Action Tracking

- **FR-048**: System MUST capture preventive actions documented by CE/CS during
  disposition and create preventive action records linked to the NCR
- **FR-049**: System MUST allow QA Staff to designate an owner for each
  preventive action and assign a target completion date
- **FR-050**: System MUST track preventive action status from initiation through
  completion and closure
- **FR-051**: System MUST notify the designated Preventive Action Owner of their
  assignment with action details and target completion date
- **FR-052**: System MUST provide preventive action reporting showing open
  actions, aging (time overdue), and closure status

#### Reporting and Visibility

- **FR-053**: System MUST provide a dashboard showing counts of NCRs by status
  (Submitted, Dispositioned, Approved, Returned for Comment, Final Approval,
  Closed)
- **FR-054**: System MUST generate aging reports showing time elapsed since NCR
  submission for open NCRs
- **FR-055**: System MUST support filtering and searching NCRs by: Item/Part
  Number, Specification Reference, Date Range, Status, Parts Disposition Type
  (Rework/Repair/Return/Scrap/Use-As-Is), and Root Cause Categories
- **FR-056**: System MUST maintain complete audit trail for all NCR state
  transitions with timestamp and user identity

#### Security and Access Control

- **FR-057**: System MUST enforce role-based access control with specific role
  permissions: NCR Originator (create), CE/CS (disposition), QA Staff (review,
  concur, designate approvers), Designated Approver (review and provide final
  approval), Manager (view reports)
- **FR-058**: System MUST require authentication for all NCR operations
- **FR-059**: System MUST prevent unauthorized users from modifying or viewing
  restricted NCR data
- **FR-060**: System MUST provide read-only access to designated distribution
  personnel without approval authority
- **FR-061**: System MUST log all access and modifications to NCRs for
  compliance auditing

#### Data Management

- **FR-062**: System MUST persist all NCR data reliably with backups
- **FR-063**: System MUST handle concurrent access to the same NCR without data
  corruption
- **FR-064**: System MUST not allow duplicate NCRs for the same nonconformance
  incident
- **FR-065**: System MUST support linking related NCRs (e.g., same root cause
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

## Resolved: CE/CS Delegate Assignment (Superseded by Originator Designate)

**Resolution**: CE/CS delegate assignment will not be implemented. Delegation
authority on an NCR belongs solely to the Originator, who may assign exactly
one Designate holding the Originator's own full authority on that specific
NCR — see [`specs/003-originator-designate/spec.md`](../003-originator-designate/spec.md).
The CE/CS role has no separate delegation mechanism of its own: engineering
disposition (FR-016 through FR-023) remains tied exclusively to the NCR's
assigned CE/CS identity (`ce_cs_id`). The codebase's earlier
`ce_cs_delegate_id` scaffolding — a field anticipated by an early permission
check but never actually settable through any route or UI — has been removed
accordingly.

This closes out the open questions previously listed here (When/Who/
Authority/How/Audit for a CE/CS-initiated delegate): they no longer apply,
since the Originator's Designate already covers the underlying need — someone
else acting with equivalent authority on a specific NCR — end-to-end.

---

## Future Work: Group Leader and Director Notifications (Deferred)

Upon NCR submission, notifications to Cognizant Group Leader and Cognizant
Division Director/PM are deferred. QA Admin initial notification (FR-008) is
implemented via the ncr-qa group. The mechanism for resolving Group Leader and
Division Director/PM from a WBS number is not yet defined. Once a
WBS-to-personnel lookup strategy is established (e.g., an organizational
directory integration, a WBS ownership mapping table, or a manual assignment
step), the following capabilities can be implemented:

- Automatic identification of the Cognizant Group Leader and Division
  Director/PM from the WBS number on the NCR
- INITIAL NOTIFICATION email to those stakeholders with NCR summary and link,
  matching the template for QA and management notification (emails.md template 2)
- Delivery confirmation logged per recipient in the notification log
- Stakeholder role snapshot at time of submission for audit compliance

Until then, the submission workflow notifies the CE/CS (engineering disposition
request, with Originator CC'd) and QA Admins (via the ncr-qa group). Group
Leader and Division Director/PM notifications are deferred.

---

## Future Work: eTraveler UI Integration (Not Yet Planned)

The current implementation supports linking an NCR to a Traveler only at the
data/API layer (FR-006a/FR-006b): the NCR data model has a `traveler_link`
field and the creation API accepts optional `traveler_id`/`traveler_step_number`
parameters, but the standalone NCR creation page does not present any field for
entering them — no NCR can be Traveler-linked through the UI today. A
self-attestation checkbox on the NCR closure form confirms Traveler sign-off
before a Traveler-linked NCR can close (FR-043), which would apply once some
future caller (e.g. an eTraveler-launched creation flow) populates the link via
the API. No eTraveler-side UI work has been planned or implemented for this
feature. The following capabilities remain out of scope until a future phase is
planned:

- An "Initiate NCR" action or launch point within the eTraveler step UI itself
- Any user-facing way (on the NCR creation page or elsewhere) to enter a
  Traveler ID/step number and link a new NCR to it
- Automatic pre-population of the NCR creation form from the Traveler's current
  context (Traveler ID, step number, associated part/assembly information)
- Display of the resulting NCR number back within the eTraveler step once an
  NCR is created
- Performing the Traveler sign-off confirmation from within the eTraveler UI
  (today this is a checkbox on the NCR's own closure form)
- Automatically attaching an electronic copy of the closed NCR to the Traveler
  record

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

## Outstanding Clarifications _(deferred to planning phase)_

### NCR Visibility & Access Control

**Question**: Who should have visibility to view all NCRs and their current
status?

**Options Under Consideration**:

- **Option B**: All authenticated users can view all NCRs and their statuses
  (transparency/visibility for everyone)
- **Option C**: Role-filtered view - each role sees NCRs relevant to them:
  Originator sees their created NCRs, CE/CS sees submitted NCRs, QA sees
  dispositioned NCRs, Managers see all for reporting

**Decision Status**: Deferred to planning/implementation phase. Will be resolved
based on organizational security policy and visibility requirements during
requirements refinement with stakeholders.
