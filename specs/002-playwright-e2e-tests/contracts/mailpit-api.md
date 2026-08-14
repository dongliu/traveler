# Contract: Mailpit API Dependency

**Feature**: `002-playwright-e2e-tests` | **Consumers**: Playwright test/helper code only

The suite depends on the Mailpit mail-catcher service (`traveler-mail`
Docker service, already running as a prerequisite per `test-e2e/README.md`)
for all outbound-email verification (spec User Story 1). This documents the
exact external API surface relied upon, so a future Mailpit upgrade's impact
is easy to assess.

**Base URL**: `http://localhost:${MAIL_PORT}` (default `8025`), resolved from
`.env` at run time per FR-002 — never hardcoded.

## Endpoints used

### `DELETE /api/v1/messages`

Clears all captured messages. Called once per suite run (or per scenario, if
scenarios don't rely on `runId`-scoped search filtering strongly enough to
share a single clear) to avoid stale messages from a previous manual session
being mistaken for this run's output.

- Verified reachable directly from the host shell during planning
  (`curl -X DELETE http://localhost:8025/api/v1/messages` → `200 ok`).

### `GET /api/v1/search?query=<mailpit-query-syntax>`

Searches captured messages. Used to find a scenario's expected email(s) by
recipient and/or subject substring, scoped by the scenario's `runId`-tagged
NCR number to avoid matching another concurrently-running scenario's mail.

- Expected response shape: `{ "total": <int>, "messages": [ { "ID": "...", "To": [...], "Cc": [...], "Subject": "...", ... } ] }`

### `GET /api/v1/message/{ID}`

Fetches a single message's full content (including HTML/text body), used for
`bodyContains` substring assertions (per data-model.md's Notification
Verification entity).

- Expected response shape includes `HTML`/`Text` body fields alongside the
  same header fields as the search result.

## Retry policy

Because SMTP delivery from the app to Mailpit is asynchronous relative to the
triggering browser action (form submission), every lookup against `/search`
or `/message/{ID}` MUST be wrapped in a bounded poll (e.g. retry every 500ms
up to a total ceiling of ~10s) rather than a single immediate check or a fixed
`sleep` — see spec Edge Cases ("What happens when an outbound notification
email has not yet arrived...").

## Non-goals

The suite does not depend on Mailpit's web UI (`/` HTML page) for any
assertion — only the JSON API endpoints above. If Mailpit is swapped for a
different mail catcher in the future, only these three endpoints' equivalents
need to be re-mapped.
