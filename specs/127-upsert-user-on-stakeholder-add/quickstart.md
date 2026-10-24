# Quickstart: Guarantee Stakeholder Notification Delivery via Directory-Backed User Records

How to run and check this feature. Implementation steps are in `tasks.md`.

## Prerequisites

- Docker stack up: `docker compose up` (web on 3001, API on 3002).
- `.env` has `E2E_USER`, `E2E_PASS`, `E2E_USER2`, `E2E_PASS2` (see `.env.example`).
- First time only: `npx playwright install chromium`.
- Unit tests outside Docker need `TRAVELER_CONFIG_REL_PATH=docker`.
- A directory entry (a second e2e/LDAP test account, e.g. the fixture
  behind `E2E_USER2`) that has **never logged into the application**, so
  it has no pre-existing `User` document — delete its `User` row first if
  it has one, to reproduce the actual failure condition.

## 1. Unit tests

```bash
npm run unit
npx mocha test-unit/lib/user-directory.test.js
npx mocha test-unit/lib/ncr-service.test.js
```

Expected: `ensureUserExists` creates a `User` document from `{id, name,
email}` only when none exists for `id`; returns an existing document
unchanged (no overwrite); throws when no document exists and `email` is
missing. `createNcr`, `submitConcurrence`, `addApprover`, and
`assignDesignate` each gain a regression case where the CE/CS, Approver, or
Designate has never logged in before being added, and the add still
succeeds. `closeNcr` gains a regression case where a Preventive Action
owner has never logged in, and final distribution still reaches them via
their already-stored `owner_email`.

## 2. Manual walk-through — NCR

1. Pick a person with no `User` document (see Prerequisites).
2. Create a new NCR; select that person from the CE/CS typeahead.
   - Expect: NCR creation succeeds exactly as it does today, and the
     disposition-request email reaches them (this already worked before
     this feature — it isn't the gap being closed).
3. On that NCR, assign the same (or another never-logged-in) person as the
   Originator Designate, and add another never-logged-in person as an
   additional Approver.
   - Expect: both adds succeed exactly as they do today.
4. During disposition, enter a never-logged-in person's id/name/email as a
   Preventive Action owner.
   - Expect: the assignment succeeds exactly as it does today (this field
     is not changed by this feature — only closure's own lookup is).
5. Drive the NCR through disposition, concurrence (no additional approvers
   needed to reach Issuance quickly), and closure.
   - Expect: the Issuance email reaches the Originator and Designate; the
     Final Distribution email on closure reaches the CE/CS, Designate, the
     Approver, and the Preventive Action owner — all of them, including
     whichever has never logged in. Before this feature, whichever of them
     had never logged in would have been silently missing from at least
     one of these.

## 3. Manual walk-through — Form reviewer

1. Pick a person with no `User` document.
2. On a Form in Draft, open the review-requests tab and type that person's
   name into the reviewer typeahead; select them and click **Add**.
   - Before this feature: refused with "please add user id ... A user is
     added when s/he logs in for the first time."
   - After this feature: either succeeds (if that person's role already
     grants review permission once provisioned) or is refused with the
     accurate reason ("needs permission to review") instead of the
     misleading one above.
3. Grant that person review permission (however this app's existing role
   management already does that), then repeat step 2.
   - Expect: the add succeeds, and they receive the "New Review Request"
     notification.

## 4. End-to-end suite

```bash
npm run e2e -- e2e/us-review-request-new-user.spec.js
```

New spec. Covers: adding a never-logged-in person as a Form reviewer via
the typeahead succeeds (or fails on permission, never on "unknown user");
the add request carries the resolved email; a `User` record exists for
that person afterward.

## Acceptance

Feature is done when: unit tests pass; the e2e spec passes; both manual
walk-throughs in sections 2-3 match their expectations; and `npx eslint .`
reports no new errors.
