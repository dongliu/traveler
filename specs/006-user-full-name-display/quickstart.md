# Quickstart: Validating "Show People's Full Names Instead of Initials or User IDs"

Prerequisites: the local docker/dev stack running per `CLAUDE.md` (`node app.js` or `npx nodemon`), signed in as a user whose session can see at least one form, traveler, and binder created or updated by a *different* account (so the fix is visibly distinguishable from "it happens to be my own name everywhere").

## 1. Unit/contract-level checks (fast, no browser)

```bash
npx mocha test/lib/user-names-test.js
npx mocha test/lib/public-travelers-test.js
npx eslint lib/user-names.js lib/public-travelers.js public/javascripts/table.js public/javascripts/public-travelers.js
```

Expected: all green. `public-travelers-test.js` must still prove the fake `Traveler` model's `aggregate` is the only Traveler method called (per research.md Decision 4) — if that assertion needed loosening to pass, the dependency-injection approach wasn't followed correctly.

## 2. Internal list views (User Story 1 / FR-001, FR-003, FR-005, FR-006)

1. Open `/forms`, `/travelers` (current travelers list), `/binders`, and `/reviews` (or their site navigation equivalents).
2. For each "Created by", "Updated by", "Released by", "Archived by", "Cloned by", "Added by", and "Reviewer" column: confirm a full name is shown as plain text, not a single-letter avatar icon.
3. Pick a row whose person has no `name` on their `User` record (or temporarily unset one in a test account) — confirm that column falls back to the bare account identifier instead of a blank cell (FR-003).
4. Type a person's full name (or part of it) into that column's filter box — confirm matching rows appear (FR-005). Click the column header to sort — confirm it sorts by name, not by the hidden id.
5. Open a form's share dialog ("shared with") and a traveler/form's review-request list — confirm each listed person shows their full name there too (data-model.md's `sharedWith[].name` / `reviewRequests[].name`).

## 3. Single-record detail pages (research.md Decision 3)

Open a traveler's detail page, its printable view, its config/edit page, a form's config page, and a binder's page/config page. Confirm the "Created by" / "Updated by" / "Owner" text shown in the page body is the full name, not the raw account id.

## 4. Public travelers dashboard (User Story 2 / FR-002)

1. Open the public travelers dashboard (`/publictravelers/list` in the web app).
2. Confirm the "Created" and "Updated" cells show the person's full name next to the relative date, exactly as described in `contracts/public-travelers-api.md`'s JSON section.

## 5. REST API backward compatibility (FR-007)

```bash
curl -u <api-user>:<api-pass> 'http://localhost:<port>/apis/publictravelers/?limit=1'
curl -u <api-user>:<api-pass> 'http://localhost:<port>/apis/travelers/'
```

Confirm:
- `createdBy`, `updatedBy`, `owner` still contain the raw account identifier, unchanged in type and value from before this feature.
- A new `createdByName`, `updatedByName`, and (for publictravelers) `ownerName` field is present on every record, matching `contracts/public-travelers-api.md`.

## 6. CSV export substitution (FR-008)

```bash
curl -u <api-user>:<api-pass> 'http://localhost:<port>/apis/publictravelers/?format=csv&limit=5' -o /tmp/public-travelers.csv
```

Open the file: the header row is unchanged (`createdBy`, `updatedBy`, ... as literal column names); the *values* in the `createdBy` and `updatedBy` columns are full names, per `contracts/public-travelers-api.md`'s CSV section. The `owner` column's values are unchanged (still the raw id) — only `createdBy`/`updatedBy` were in scope for the substitution.

## 7. No new exposure (Constitution Check / Q3 clarification)

As a user who cannot normally see a given traveler/form/binder, confirm you still cannot see it at all (401/403/omitted from the list, as today) — this feature should not have changed who can reach a record, only what its existing "created by"/"updated by"/etc. fields display once reached.
