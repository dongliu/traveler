# Feature Specification: Direct Disposition Link and CE/CS-Only Access Warning

**Feature Branch**: `008-disposition-direct-link-and-access-warning`

**Created**: 2026-09-13

**Status**: Draft

**Amends**: `specs/001-ncr-workflow/spec.md` — User Story 1.5 (Send CE/CS Disposition
Request and QA Admin Initial Notification) and User Story 2 (CE/CS Performs
Engineering Disposition)

## Summary of Change

Two related changes to the CE/CS disposition flow:

1. The engineering disposition request email sent to the CE/CS now links
   directly to the disposition form (`/ncrs/:id/disposition`) instead of the
   general NCR detail page (`/ncrs/:id`), so the CE/CS can act in one click
   instead of two.
2. When any user other than the assigned CE/CS opens the disposition page —
   whether via the email link, the NCR detail page's "Create Disposition"
   button, or a direct URL — the page shows a read-only summary with a
   warning banner stating that only the assigned CE/CS may open the page and
   submit the disposition. The disposition submission form itself is not
   rendered for that user. The pre-existing API-level restriction (only the
   assigned CE/CS may submit a disposition; 403 Forbidden otherwise — see
   `lib/ncr-service.js`'s `submitDisposition`) is unchanged; this is a UI
   addition that surfaces that restriction earlier and more clearly, not a
   new authorization mechanism.

---

## User Scenarios & Testing *(mandatory)*

### User Story - CE/CS-Only Disposition Page (Priority: P2)

The CE/CS named on an NCR receives the disposition-request email and, on
clicking its link, lands directly on the disposition form ready to act. Any
other user who reaches that same URL — by forwarding the email, using the
"Create Disposition" button on the NCR detail page, or typing the URL — sees
a clear warning identifying who is authorized to act, and is not shown a
disposition form they cannot successfully submit.

**Why this priority**: The email link previously required an extra click
through the general NCR page; landing directly on the form removes friction
for the common case. The access warning prevents a confusing "submit" attempt
that would silently fail (or previously, offer a full form only to reject the
PATCH with a 403 after the user filled it in).

**Independent Test**: Can be fully tested by submitting an NCR, following the
CE/CS disposition-request email's link, and confirming it opens the
disposition form directly; then loading the same URL as a different
authenticated user and confirming a warning is shown with no form.

**Acceptance Scenarios**:

1. **Given** an NCR is submitted with a designated CE/CS, **When** the
   disposition-request email is sent, **Then** its link points to
   `/ncrs/<id>/disposition`, not `/ncrs/<id>`
2. **Given** the assigned CE/CS opens the disposition page (via the email
   link or any other path) while the NCR is `Submitted`, **When** the page
   loads, **Then** no warning is shown and the disposition form is available
   for completion, unchanged from prior behavior
3. **Given** a user other than the assigned CE/CS opens
   `/ncrs/<id>/disposition` for a `Submitted` NCR, **When** the page loads,
   **Then** a warning banner naming the assigned CE/CS is shown, stating that
   only that person may open the page and submit the disposition, and the
   disposition form is not rendered
4. **Given** a user other than the assigned CE/CS submits
   `PATCH /api/ncrs/<id>/disposition` directly (bypassing the UI), **When**
   the request is processed, **Then** the system still returns 403 Forbidden
   — unchanged, pre-existing behavior that this feature's UI warning
   corroborates but does not replace

### Edge Cases

- An NCR with no `ce_cs_id` set (e.g., a document created outside the normal
  creation form) is treated as "no user is the assigned CE/CS" — every
  viewer sees the warning banner.
- The warning only applies while the NCR is in `Submitted` status; once
  dispositioned, `GET /ncrs/:id/disposition` redirects away regardless of who
  requests it (pre-existing behavior, unchanged).
- The QA Admin initial-notification email (User Story 1.5's second email) is
  unaffected — it continues to link to the general NCR detail page.

---

## Requirements *(mandatory)*

### Functional Requirements

The following requirements amend `specs/001-ncr-workflow` FR-007 and add a
new FR under "NCR Disposition (CE/CS Engineering Analysis)".

- **FR-007 (amended)**: System MUST automatically send an engineering
  disposition request email TO the designated CE/CS upon NCR submission,
  with the NCR Originator CC'd, requesting completion of the CE/CS section
  and including: the assigned NCR number, Part Name, Supplier name,
  Originator name, a link directly to the NCR's disposition form
  (`/ncrs/:id/disposition`), and any additional comments from the
  Originator.
- **FR-016a (new)**: System MUST display a warning message on the
  disposition page to any user who is not the NCR's assigned CE/CS, stating
  that only the assigned CE/CS may open the page and submit the disposition,
  and MUST NOT render the disposition submission form to that user. This
  applies regardless of how the user reached the page.

No change to FR-059 (server-side authorization) — the existing 403 on
`PATCH /api/ncrs/:id/disposition` for a non-CE/CS submitter remains the
enforced control; FR-016a only surfaces that restriction in the UI before a
submission is attempted.

### Key Entities

No schema change. `Ncr.ce_cs_id` (existing field) is compared against the
logged-in session user id server-side (`routes/ncr-view.js`'s
`GET /ncrs/:id/disposition` handler) to decide whether to render the warning
and suppress the form.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Clicking the disposition-request email's link lands the CE/CS
  on the disposition form directly — zero extra clicks from email to form.
- **SC-002**: Any authenticated user who is not the assigned CE/CS, opening
  the disposition page while the NCR is `Submitted`, sees the warning banner
  and is not shown the disposition form.
- **SC-003**: The assigned CE/CS sees no warning and the full form, exactly
  as before this change.
- **SC-004**: No change in the API's existing 403 response for a non-CE/CS
  disposition submission attempt.

---

## Assumptions

- "Open the page" is enforced as a UI warning plus form suppression, not an
  HTTP-level 403 or redirect — other users with legitimate reasons to see the
  NCR's context (e.g., QA, Originator) retain read access to this page's
  read-only summary, consistent with how `ncr-approval.jade` and
  `ncr-concurrence.jade` already show read-only content to viewers who lack
  action authority on those pages.
- No changes to the QA Admin initial-notification email or any other
  notification email in the workflow.
