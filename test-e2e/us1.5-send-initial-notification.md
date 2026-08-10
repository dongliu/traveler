# Test E2E — User Story 1.5: Send CE/CS Disposition Request and QA Admin Initial Notification

**Spec reference**: `specs/001-ncr-workflow/spec.md`, "User Story 1.5 - Send
CE/CS Disposition Request and QA Admin Initial Notification" (Priority: P1)
**Files under test**: `lib/ncr-service.js` (`createNcr`), `lib/ncr-email.js`
(`sendDispositionRequest`, `sendInitialNotification`)

This story has no dedicated page — it is a side effect of NCR creation
(User Story 1). Email delivery is verified directly in the mail catcher UI at
`http://localhost:<MAIL_PORT>/` (Mailpit, part of the `traveler-mail` Docker
service), which captures all outbound SMTP traffic from the app (SMTP host
`mail-service`, port 1025). The NCR's recorded `events[]` is checked as a
secondary source for delivery status and CC tracking.

> **Scope note**: Upon NCR submission two emails are sent:
> 1. **Email 1** — TO the designated CE/CS, CC the NCR Originator:
>    engineering disposition request per emais.md template 1.
> 2. **Email 2** — TO all members of the ncr-qa QA Admin group, CC the NCR
>    Originator: initial FYI notification per emais.md template 2.
>
> The Originator receives no standalone confirmation email — they are CC'd on
> both outbound messages. Notifications to Cognizant Group Leader and Division
> Director/PM are **deferred**. See the spec's "Future Work: Group Leader and
> Director Notifications" section for context.

## Setup

- Create a fresh NCR via `http://localhost:<WEB_PORT>/ncrs/new` (same steps as
  `us1-create-and-submit-ncr.md` Acceptance Scenario 2), ensuring a CE/CS is
  designated in the form. Record the NCR id, the CE/CS email selected, and the
  logged-in user's email (the Originator).
- Confirm the `ncr-qa` group exists and has at least one member with a valid
  email address (check via mongo-express or `GET /groups/ncr-qa/members/json`).
- No special role required to create the NCR (any authenticated user).

## Test Steps for Claude in Chrome

### Session Setup — Environment and Recording

0. Read the project's `.env` file (at the repo root, relative to this
   file: `../.env`; gitignored; falls back to the defaults below for any var
   that is unset) to resolve the actual ports for this run: `WEB_PORT`
   (default `3001`), `API_PORT` (default `3002`), `MONGO_EXPRESS_PORT`
   (default `8081`), `MAIL_PORT` (default `8025`), and the app login
   credentials `E2E_USER` and `E2E_PASS`. Mongo Express basic-auth credentials
   are `traveler` / `travelerpass` (defined in `docker-compose.yml`, not in
   `.env`). Use the resolved ports for every `localhost`-style URL referenced
   below — substitute real ports, don't assume the placeholders.
0. Navigate to `http://localhost:<MAIL_PORT>/` and confirm the Mailpit inbox
   loads. If it does not, the Docker stack is not running — stop here. All
   services from `docker-compose.yml` must be running before executing this
   test; do not start new Docker instances during a test run.
0. Clear all existing messages in Mailpit (use the "Delete all" / trash button)
   so that emails captured during this test are easy to identify.
0. Navigate to `http://localhost:<WEB_PORT>/login`. If the page redirects to
   the app (already authenticated), skip to the next step. Otherwise, enter
   the value of `E2E_USER` as the username and `E2E_PASS` as the password and
   submit the login form.
0. Begin a GIF recording of the browser session before proceeding to the
   first numbered test step below.

### Acceptance Scenario 1 — CE/CS disposition request sent TO CE/CS, CC Originator

1. Create the NCR as described in Setup, recording its id, the CE/CS email,
   and the Originator's email (the logged-in user's email).
2. Navigate to `http://localhost:<MAIL_PORT>/` (Mailpit).
3. Confirm a message appears addressed TO the CE/CS email with a subject
   indicating an engineering disposition request (e.g. "Action Required —
   Engineering Disposition for NCR …").
4. Open that message and confirm:
   - The **To** field contains the CE/CS email address.
   - The **CC** field contains the Originator's email address.
   - The message is **not** addressed to a QA Admin or management user.

### Acceptance Scenario 2 — QA Admin initial notification sent TO ncr-qa members, CC Originator

5. In Mailpit, confirm one or more messages appear addressed TO the ncr-qa
   group members' email addresses with a subject indicating an initial
   notification (e.g. "NCR … Initiated — …").
6. Open one of these messages and confirm:
   - The **To** field contains a QA Admin email (a member of the ncr-qa group).
   - The **CC** field contains the Originator's email address.
   - The message is **not** addressed to the CE/CS as a primary recipient.

### Acceptance Scenario 3 — email content matches templates

7. Open the CE/CS disposition request message in Mailpit and confirm the body
   includes all of:
   - CE/CS name in the greeting line
   - The full NCR number (e.g. `NCR-2026-0001`)
   - Part Name and Supplier name
   - Originator's name
   - The phrase "Please complete the CE/CS section"
   - A clickable link to the NCR
8. Open an ncr-qa initial notification message and confirm the body includes
   all of:
   - The full NCR number
   - Part Name and Supplier name
   - Originator's name and CE/CS name
   - The phrase "forwarded to [CE/CS] for engineering disposition"
   - The initial description of the nonconformance problem
   - A clickable link to the NCR
9. Click the NCR link from each email (copy the URL into a new browser tab)
   and confirm it loads the correct NCR detail page.

### Acceptance Scenario 4 — notification log shows TO and CC with delivery status and timestamp

10. Navigate to `http://localhost:<WEB_PORT>/ncrs/<ncr-id>` and open the
    Event Timeline section.
11. Locate the `notification.disposition_request` event. Confirm:
    - A **To** row shows the CE/CS email with `delivery_status` = Delivered
      and a `delivery_timestamp`.
    - A **CC** row shows the Originator email with its own `delivery_status`
      and `delivery_timestamp`.
12. Locate the `notification.initial` event. Confirm:
    - One or more **To** rows show ncr-qa member emails, each with
      `delivery_status` and `delivery_timestamp`.
    - A **CC** row shows the Originator email with its own `delivery_status`
      and `delivery_timestamp`.

### End of Session — Stop Recording, Save Artifacts, Report

After the final test step above:

- Stop the GIF recording.
- Save the GIF to `test-e2e/results/`
  (create this directory first if it doesn't exist) as
  `US1.5-send-initial-notification-<YYYY-MM-DD>.gif`, where `<YYYY-MM-DD>` is
  today's date.
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

- **Per spec AS1**: Mailpit shows a disposition request email TO the CE/CS,
  CC the Originator. Subject contains the NCR number. Body contains CE/CS
  greeting, NCR number, Part Name, Supplier, Originator name, "Please complete
  the CE/CS section", and a link to the NCR.
- **Per spec AS2**: Mailpit shows initial notification email(s) TO each
  ncr-qa group member, CC the Originator. Subject contains the NCR number.
  Body contains NCR number, Part Name, Supplier, Originator name, CE/CS name,
  "forwarded to [CE/CS] for engineering disposition", problem description, and
  a link.
- **Per spec AS3**: NCR links in both emails resolve to the correct NCR detail
  page.
- **Per spec AS4**: The Event Timeline shows `notification.disposition_request`
  and `notification.initial` events, each with TO rows (delivery status +
  timestamp) and a CC row for the Originator (delivery status + timestamp).
- **Not in scope**: No email to Group Leader or Division Director/PM should
  appear. If one does, flag it as an implementation/spec mismatch.
- **ncr-qa not configured**: If the ncr-qa group is missing or empty, NCR
  creation must fail with a clear error message — no silent omission.

## Human Verification Checklist

- [ ] **Mailpit** shows exactly two outbound email threads after NCR
      submission — one for the CE/CS disposition request, one (or more, one
      per ncr-qa member) for the QA Admin initial notification.
- [ ] **CE/CS email To address** matches the CE/CS selected during NCR
      creation. CC address matches the logged-in Originator's email.
- [ ] **QA Admin email To address(es)** match the members of the ncr-qa
      group. CC address matches the logged-in Originator's email.
- [ ] **CE/CS email body** contains: CE/CS name greeting, NCR number, Part
      Name, Supplier name, Originator name, "Please complete the CE/CS
      section", and a URL link to the NCR.
- [ ] **QA Admin email body** contains: NCR number, Part Name, Supplier name,
      Originator name, CE/CS name, "forwarded to [CE/CS] for engineering
      disposition", initial problem description, and a URL link to the NCR.
- [ ] **NCR links** in both emails resolve to the correct NCR detail page
      when opened in a browser tab (may redirect through login first).
- [ ] **No third email** addressed to Group Leader or Division Director/PM is
      present in Mailpit — those are deferred.
- [ ] **Event Timeline on NCR detail page** shows `notification.disposition_request`
      and `notification.initial` events, each with:
      - TO row(s) showing recipient email, Delivered status, and timestamp.
      - CC row showing the Originator email, delivery status, and timestamp.
- [ ] **mongo-express**: open the `ncrs` document and confirm `events[]`
      contains both notification events, each with `recipients[]` (TO) and
      `cc[]` (CC) populated with `delivery_status` and `delivery_timestamp`.
- [ ] **ncr-qa not configured test**: temporarily remove all members from the
      ncr-qa group (or rename the group), submit an NCR, and confirm the
      response shows the error "NCR-QA group is not configured. Contact an
      administrator." Restore the group before continuing.
