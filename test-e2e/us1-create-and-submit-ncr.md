# Test E2E — User Story 1: Create and Submit Nonconformance Report

**Spec reference**: `specs/001-ncr-workflow/spec.md`, "User Story 1 - Create and
Submit Nonconformance Report" (Priority: P1)
**Files under test**: `views/ncr-create.jade`, `routes/ncr.js` (`POST /api/ncr`), `lib/ncr-service.js` (`createNcr`)

## Setup

- Logged in as any authenticated user (`<your-username>`). No special role
  needed — this is the NCR Originator role, open to any authenticated user.
- No existing NCR fixtures required.
- Port note: substitute your actual `WEB_PORT` per the README — this file
  uses `localhost:3001` as a placeholder.

## Test Steps for Claude in Chrome

### Acceptance Scenario 1 — mandatory fields, no Traveler-linking fields

1. Navigate to `http://localhost:3001/ncr/new`.
2. Confirm the page title is "New Nonconformance Report".
3. Read every visible field label and section legend on the form and list
   them out.

### Acceptance Scenario 2 — successful submission assigns an NCR number

4. Fill in the form with these values:
   - Part Name: `Bracket Assembly E2E`
   - Part Number: `BA-E2E-001`
   - Part Revision: `A`
   - Quantity: `5`
   - Supplier Name: `Acme Fabrication`
   - WBS Number: `WBS-E2E-01`
   - Specification / Drawing Ref.: `DWG-E2E-100`
   - PO Reference: leave blank
   - CE/CS Name: `Doe, Jane`
   - Discovery Date: today's date
   - Discovery Context: select "Incoming Inspection"
   - Description of Nonconformance: `Surface crack observed along the edge of the bracket during incoming inspection, approximately 2cm in length.`
5. Click "Submit NCR".
6. Read the success banner text and the NCR number it displays. Record the
   NCR number and its id (visible in the URL if you click through, or via
   mongo-express) for later user-story tests — this NCR will be reused by
   `us2-ce-cs-disposition.md` and following tests.

### Acceptance Scenario 3 — audit trail visible after submission

7. Navigate to the NCR's detail page (`http://localhost:3001/ncr/<ncr-id>`).
8. Confirm the page shows: Part Information, Reference (including CE/CS
   name and Originator name), Nonconformance Details (discovery date,
   context, description), and an Event Timeline section.
9. Expand/read the Event Timeline and confirm it includes a
   `ncr.submitted` entry with a timestamp and your username as actor.

### Acceptance Scenario 4 — validation blocks incomplete submission

10. Navigate to `http://localhost:3001/ncr/new` again (fresh page).
11. Fill in all fields as in step 4, except set Description of
    Nonconformance to just: `Too short`
12. Click "Submit NCR".
13. Read the red error banner text that appears.

## Expected Results

- **AS1**: field labels are exactly: Part Name, Part Number, Part Revision,
  Quantity, Supplier Name, WBS Number, Specification / Drawing Ref., PO
  Reference, CE/CS Name, Discovery Date, Discovery Context, Description of
  Nonconformance. **No "Traveler ID" or "Traveler Step Number" field exists
  anywhere on the page** — this is intentional per the spec's "Future Work:
  eTraveler UI Integration" note; the `traveler_link` data model and API
  fields still exist but are not exposed here.
- **AS2**: a green success banner reads "NCR Created: `NCR-<year>-NNNN` has
  been submitted successfully." with a real generated NCR number. The form
  is hidden after success.
- **AS3**: the detail page shows creation date, originator name, submission
  timestamp, and all captured field values; the Event Timeline shows the
  `ncr.submitted` entry.
- **AS4**: a red error banner reads: "Description of Nonconformance must be
  at least 20 characters." No NCR is created for this attempt.

## Human Verification Checklist

- [ ] The NCR-creation page has no Traveler ID / Traveler Step Number
      fields (confirm by reading `views/ncr-create.jade` directly, not just
      the rendered page).
- [ ] AS2's success banner NCR number matches the pattern
      `NCR-<current year>-####`.
- [ ] In mongo-express (`http://localhost:8081`, adjust port per your
      `.env`), `traveler` → `ncrs`, confirm a document exists with that
      `ncr_number`, `status: "Submitted"`, and all field values from step 4.
- [ ] That document's `events` array contains `ncr.submitted` with
      `actor_id` equal to your username, `previous_status: null`,
      `new_status: "Submitted"`.
- [ ] That document has no `ce_cs_id` field set (the creation form never
      captures it — this matters for `us1.6-request-engineering-disposition.md`
      and `us2-ce-cs-disposition.md`, which require a workaround).
- [ ] AS4's attempt did **not** create a second NCR (only one document
      exists in `ncrs` with `part_number: "BA-E2E-001"`).
