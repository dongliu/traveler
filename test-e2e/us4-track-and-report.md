# Test E2E — User Story 4: Track and Report on Nonconformances

**Spec reference**: `specs/001-ncr-workflow/spec.md`, "User Story 4 - Track
and Report on Nonconformances" (Priority: P2)
**Files under test**: `views/ncr-dashboard.jade`, `routes/ncr.js` (`GET /api/ncrs`), `lib/ncr-service.js` (`listNcrs`)

## Setup

- Requires several NCRs already existing across different statuses from
  earlier user-story tests (Submitted, Dispositioned, Approved, Final
  Approval, Closed). If any status is missing, create a bare Submitted NCR
  via `/ncr/new` to fill the gap.
- **Escalation fixture**: in mongo-express, pick one non-Closed NCR and edit
  its `created_at` field to a date more than 30 days before today (e.g. 35
  days ago).
- Logged in as any authenticated user — this page currently has no
  role-based access restriction beyond authentication (note: the spec's
  "Outstanding Clarifications" section flags NCR visibility/access-control
  scope as still under discussion for a future iteration).

## Test Steps for Claude in Chrome

### Session Setup — Environment

0. Read the project's `.env` file (at the repo root, relative to this
   file: `../.env`; gitignored; falls back to
   the defaults below for any var that is unset) to resolve the actual
   ports for this run: `WEB_PORT` (default `3001`), `API_PORT` (default
   `3002`), `MONGO_EXPRESS_PORT` (default `8081`), and the app login
   credentials `E2E_USER` and `E2E_PASS`. Mongo Express basic-auth
   credentials are `traveler` / `travelerpass` (defined in
   `docker-compose.yml`, not in `.env`). Use the resolved web app port for
   every `localhost:3001`-style URL referenced below in this file —
   substitute the real port, don't assume the placeholder.
0. Navigate to `http://localhost:<WEB_PORT>/login`. If the page redirects to
   the app (already authenticated), skip to the next step. Otherwise, enter
   the value of `E2E_USER` as the username and `E2E_PASS` as the password and
   submit the login form.

### Acceptance Scenario 1 — dashboard shows counts by status

1. Navigate to `http://localhost:3001/ncrs`.
2. Read the status-card row at the top: All, Submitted, Dispositioned,
   Approved, Returned, Final Approval, Closed — each with a count.
3. Look for any "average time in workflow" statistic anywhere on the page.
   Report whether one exists.

### Acceptance Scenario 2 — closed NCRs excluded from open/pending metrics

4. Confirm the "Closed" status card's count matches the number of closed
   NCRs from earlier tests, and that none of those closed NCRs appear in
   the default table view (Include Closed unchecked).
5. Check "Include Closed" and click "Apply". Confirm closed NCRs now appear
   with a "Closed" status badge.

### Acceptance Scenario 3 — filter by Part Number, Spec/Drawing, Date Range, Disposition Type

6. Uncheck "Include Closed", click "Clear" to reset all filters.
7. In "Part Number", enter one specific test NCR's part number (e.g.
   `BA-E2E-001`) and click "Apply". Confirm only that NCR's row appears.
8. Click "Clear". In "Discovery From"/"Discovery To", enter a date range
   that should include at least one known NCR, click "Apply", and confirm
   the result matches expectations.
9. Click "Clear". In "Disposition" dropdown, select "Rework" and click
    "Apply". Confirm only NCRs with that parts disposition appear.

### Acceptance Scenario 4 — 30+ day aging shows Escalation Needed

10. Click "Clear" to reset filters. Find the row for the NCR you backdated
    in Setup. Confirm its "Days" cell shows a number ≥ 30 and the red text
    "Escalation Needed" next to it, with the row highlighted (pink/red
    background).


### End of Session — Save Artifacts, Report

After the final test step above:

- Output a single markdown block containing:
  - Test ID and timestamp
  - Environment URL (the resolved URL from the Session Setup step above)
  - Step results (pass/fail per numbered step or Acceptance Scenario)
  - Console errors observed during the session
  - Failed network requests observed during the session
  - Overall result (Pass / Fail / Pass with caveats)

  Also save that same markdown block to
  `test-e2e/results/US4-track-and-report-<YYYY-MM-DD>-report.md`.

## Expected Results

- Status-card counts reflect the true count of NCRs in each status,
  including Closed even when the table hides closed rows by default.
- **AS1's "average time in workflow" metric is not present anywhere on the
  dashboard** — `views/ncr-dashboard.jade` only renders per-status counts
  and a per-row "Days" column, no aggregate average. Confirm this rather
  than assuming you missed it; it's a spec/implementation gap to flag.
- Each filter (Part Number, Date Range, Disposition Type) narrows the table
  correctly. The dashboard's Root Cause Keyword filter has been removed —
  do not expect it to be present.
- The escalated row is visually distinguished and only appears for NCRs
  open ≥ 30 days and not Closed.

## Human Verification Checklist

- [ ] Manually count `ncrs` documents (mongo-express, filter by `status`)
      for at least two statuses and confirm the dashboard's status-card
      counts match exactly.
- [ ] Confirm no "average time in workflow" UI element exists — search the
      rendered page text for "average" to be sure.
- [ ] Confirm the escalated NCR's `created_at` is indeed more than 30 days
      before today, and it's the only row flagged (assuming no other NCR
      happens to also be that old).
- [ ] Confirm each of the three filter tests (Part Number, Date Range,
      Disposition Type) returned exactly the expected NCR(s), not a
      superset or empty result due to a filter bug.
