# Test E2E — User Story 1.5: Send Submission Confirmation and Engineering Disposition Request

**Spec reference**: `specs/001-ncr-workflow/spec.md`, "User Story 1.5 - Send
Submission Confirmation and Engineering Disposition Request" (Priority: P1)
**Files under test**: `lib/ncr-service.js` (`createNcr`), `lib/ncr-email.js` (`sendSubmissionConfirmation`, `sendDispositionRequest`)

This story has no dedicated page — it is a side effect of NCR creation
(User Story 1). Email delivery is verified directly in the mail catcher UI at
`http://localhost:8025/` (MailHog, part of the `traveler-mail` Docker service),
which captures all outbound SMTP traffic from the app (SMTP host `mail-service`,
port 1025). The NCR's recorded `events[]` is checked as a secondary source for
delivery status.

> **Scope note**: Notifications to QA Staff, Cognizant Group Leader, and
> Cognizant Division Director/PM are **deferred** — they are not part of this
> story. Upon NCR submission, only two notifications are sent: (1) a submission
> confirmation to the NCR Originator, and (2) an engineering disposition
> request to the designated CE/CS. See the spec's "Future Work: QA and
> Management Notifications" section for context.

## Setup

- Create a fresh NCR via `http://localhost:3001/ncrs/new` (same steps as
  `us1-create-and-submit-ncr.md` Acceptance Scenario 2), ensuring a CE/CS is
  designated in the form. Record the NCR id and note the CE/CS user selected.
- No special role required to create the NCR (any authenticated user).

## Test Steps for Claude in Chrome

### Session Setup — Environment and Recording

0. Read the project's `.env` file (at the repo root, relative to this
   file: `../.env`; gitignored; falls back to
   the defaults below for any var that is unset) to resolve the actual
   ports for this run: `WEB_PORT` (default `3001`), `API_PORT` (default
   `3002`), `MONGO_EXPRESS_PORT` (default `8081`), `MAIL_PORT` (default
   `8025`), and the app login credentials `E2E_USER` and `E2E_PASS`. Mongo
   Express basic-auth credentials are `traveler` / `travelerpass` (defined
   in `docker-compose.yml`, not in `.env`). Use the resolved ports for every
   `localhost`-style URL referenced below — substitute real ports, don't
   assume the placeholders.
0. Navigate to `http://localhost:<MAIL_PORT>/` and confirm the Mailpit inbox
   loads. If it does not, the Docker stack is not running — stop here. All
   services from `docker-compose.yml` must be running before executing this
   test; do not start new Docker instances during a test run.
0. Clear all existing messages in MailHog (use the "Delete all" / trash button)
   so that emails captured during this test are easy to identify.
0. Navigate to `http://localhost:<WEB_PORT>/login`. If the page redirects to
   the app (already authenticated), skip to the next step. Otherwise, enter
   the value of `E2E_USER` as the username and `E2E_PASS` as the password and
   submit the login form.
0. Begin a GIF recording of the browser session before proceeding to the
   first numbered test step below.

### Acceptance Scenario 1 — submission confirmation sent to NCR Originator

1. Create the NCR as described in Setup, recording its id and the originator's
   email address (visible in the NCR form or from the logged-in user profile).
2. Navigate to `http://localhost:<MAIL_PORT>/` (MailHog).
3. Confirm exactly one new message appears addressed to the NCR Originator's
   email address with a subject indicating submission confirmation (e.g.
   "NCR Submitted" or similar).
4. Open that message and confirm it is **not** addressed to a QA Staff or
   management user.

### Acceptance Scenario 2 — engineering disposition request sent to CE/CS

5. In MailHog, confirm a second new message appears addressed to the CE/CS
   email address designated during NCR creation, with a subject indicating
   an engineering disposition request (e.g. "NCR Engineering Disposition
   Request" or similar).
6. Confirm this message is distinct from the originator confirmation message
   (different To address, different subject).

### Acceptance Scenario 3 — email content includes NCR summary and link

7. Open the originator confirmation message in MailHog and confirm the body
   includes: the assigned NCR number, Part Name, Part Number, Quantity, WBS,
   Description of Nonconformance, and a clickable link to the NCR in the app.
8. Open the CE/CS disposition request message and confirm the body includes
   the same NCR summary fields and a clickable link to the complete NCR.
9. Click the NCR link from each email (copy the URL into a new browser tab)
   and confirm it loads the correct NCR detail page without requiring
   re-authentication (or redirects to login then back to the NCR).

### Acceptance Scenario 4 — notification status is visible with timestamps

10. Navigate to `http://localhost:<WEB_PORT>/ncrs/<ncr-id>` and open the
    Event Timeline.
11. Confirm notification events are recorded for both the originator and CE/CS,
    each with a top-level timestamp and a `delivery_status` field (e.g.
    "Delivered") and `delivery_timestamp` per recipient.

### End of Session — Stop Recording, Save Artifacts, Report

After the final test step above:

- Stop the GIF recording.
- Save the GIF to `test-e2e/results/`
  (create this directory first if it doesn't exist) as
  `US1.5-send-initial-notification-<YYYY-MM-DD>.gif`, where `<YYYY-MM-DD>` is today's date.
- Output a single markdown block containing:
  - Test ID and timestamp
  - Environment URL (the resolved URL from the Session Setup step above)
  - Step results (pass/fail per numbered step or Acceptance Scenario)
  - Console errors observed during the session
  - Failed network requests observed during the session
  - Overall result (Pass / Fail / Pass with caveats)

  Also save that same markdown block to
  `test-e2e/results/US1.5-send-initial-notification-<YYYY-MM-DD>-report.md`.

## Expected Results (per spec) vs. What To Actually Check

- **Per spec AS1**: MailHog shows a submission confirmation email addressed to
  the NCR Originator's email, containing the assigned NCR number, submission
  timestamp, and a link to the NCR.
- **Per spec AS2**: MailHog shows a separate engineering disposition request
  email addressed to the CE/CS's email, with a link to the complete NCR.
- **Per spec AS3**: both emails include NCR summary (Part Name, Number,
  Quantity, Supplier, WBS, Description) and a direct link that resolves to
  the correct NCR detail page.
- **Per spec AS4**: the NCR's Event Timeline records delivery status and
  timestamp for each recipient (Originator and CE/CS).
- **Not in scope**: MailHog should show exactly two outbound emails. If a
  third email addressed to QA Staff, Group Leader, or Division Director/PM
  appears, flag it as an implementation/spec mismatch.

## Human Verification Checklist

- [ ] **MailHog at `http://localhost:8025/`** shows exactly two new messages
      after NCR submission — one to the Originator, one to the CE/CS.
- [ ] **Originator email To address** matches the logged-in user's email, not
      a QA or management address.
- [ ] **CE/CS email To address** matches the CE/CS selected during NCR
      creation. Cross-reference with the user's LDAP email if needed
      (visible via the LDAP admin UI or the `users` collection in mongo-express).
- [ ] **Email bodies** each contain the NCR number, key NCR fields (Part Name,
      Part Number, Quantity, WBS, Description), and a URL link to the NCR.
- [ ] **NCR link in email** resolves to the correct NCR detail page when
      opened in a browser tab (may redirect through login first).
- [ ] **No third email** addressed to QA Staff, Group Leader, or
      Division Director/PM is present in MailHog — those are deferred.
- [ ] Open the `ncrs` document in mongo-express and confirm `events[]`
      contains notification entries for both recipients, each with
      `delivery_status` and `delivery_timestamp` populated.
- [ ] If the NCR was created without a CE/CS designated, confirm no
      disposition request email appears in MailHog and no corresponding
      event is recorded.
