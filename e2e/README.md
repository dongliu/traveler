# End-to-end tests

Automated end-to-end tests, written with [Playwright](https://playwright.dev/).
They drive a real browser (Chromium) against the local Docker stack, read the
emails the app sends from Mailpit, and set up test data through a small fixture
CLI. **This is the way to test the app end to end.** (`test-unit/` holds the
mocha unit tests.)

The design is in [specs/002-playwright-e2e-tests/](../specs/002-playwright-e2e-tests/);
its [quickstart](../specs/002-playwright-e2e-tests/quickstart.md) covers the same
ground as this page. Later features add their own spec files here.

## Before you run

The suite never starts or stops containers, so have these running first:

- **This project's stack**: `docker compose up` (`web`, `mongo`, `mongo-express`).
  See [docker-dev.md](../docker-dev.md). The fixture CLI runs inside the `web`
  container through `docker compose exec`, so the `docker` CLI must be available
  where you run the tests.
- **LDAP and Mailpit**, on the external `traveler-dev` Docker network the compose
  file expects (they are not defined in this repo). Login goes through LDAP, and
  Mailpit's API (port `MAIL_PORT`, default `8025`) is where the tests read
  emails.

Then, once:

```bash
npm install
npx playwright install chromium
```

Copy [`.env.example`](../.env.example) to `.env` (gitignored) and set:

| Variable | Meaning |
|---|---|
| `WEB_PORT`, `API_PORT`, `MONGO_EXPRESS_PORT` | host ports of the compose stack (defaults `3001` / `3002` / `8081`) |
| `MAIL_PORT` | Mailpit's port (default `8025`) |
| `E2E_USER`, `E2E_PASS` | the **primary** test user, a real LDAP account |
| `E2E_USER2`, `E2E_PASS2` | the **secondary** test user, a second real LDAP account |

Environment variables set in your shell override `.env`.

**Test users.** Several specs use the ids `dong` and `bob` literally, so the
primary user should be `dong`, with the Admin role (the admin-deletion and
traveler-gating specs rely on it), and the secondary `bob`, who is not an admin
by default. Other
roles (QA staff, manager, CE/CS on a given NCR) are simulated by changing these
same two users' roles and group membership through the fixture CLI, not by
adding more accounts.

## Running

```bash
npm run e2e                                                  # everything
npm run e2e -- e2e/us1-create-and-submit-ncr.spec.js         # one file
npm run e2e -- e2e/us1-create-and-submit-ncr.spec.js -g AS3  # one scenario
npm run e2e -- --headed e2e/us1-create-and-submit-ncr.spec.js  # watch the browser
```

Everything after `--` goes to Playwright. If you call `npx playwright test`
yourself, either pass `--config=e2e/playwright.config.js`, or run it from inside
`e2e/`; from the repo root without the config Playwright loads no settings, so
there is no base URL and no login.

Tests in one file run in order, and a few rely on state left by an earlier test
in the same file, so `-g` is safe for most scenarios but not all. Different files
run in parallel.

If the web app or Mailpit is unreachable, or a login fails, the run stops
straight away with a message saying which one, instead of failing test by test.

## What is here

| Path | Role |
|---|---|
| `playwright.config.js` | base URL, reporters, trace/video/screenshot kept on failure |
| `global-setup.js` | checks the web app and Mailpit, logs in once as each user through `/ldaplogin/`, saves the sessions to `e2e/.auth/` (gitignored) |
| `fixtures/env.js` | reads `.env` and the ports/users above |
| `fixtures/auth-state.js` | the two saved sessions. Tests start logged in as the primary user; a test uses the secondary one with `test.use({ storageState: SECONDARY_AUTH_STATE })` |
| `fixtures/exec-cli.js`, `fixtures/cli.js` | the fixture CLI: `execFixtureCli('<command>', { ... })` runs `cli.js` in the `web` container, which writes to MongoDB through the app's own models (grant a role, create a traveler or a linked NCR, set a status, read a document back, ...). The command list is at the top of `cli.js` |
| `fixtures/mailpit.js` | Mailpit client: search, poll for a message, read it |
| `fixtures/ncr-ui.js` | shared helpers for filling and submitting the NCR and traveler forms |
| `fixtures/run-id.js` | `runId()`, a unique tag for the data a scenario creates |
| `*.spec.js` | the tests, one file per user story or feature |

| Spec file | Covers |
|---|---|
| `us1-create-and-submit-ncr` | creating and submitting an NCR, and the notification emails |
| `us2-ce-cs-disposition` | the CE/CS engineering disposition |
| `us3-qa-concurrence-and-approver-coordination` | QA concurrence and designated approvers |
| `us-originator-designate` | assigning and removing an originator designate, and what one may do |
| `us-admin-ncr-deletion` | admin-only NCR deletion |
| `us-ncr-attachments` | NCR attachment upload rules |
| `us-wbs-notification-registry` | WBS-to-email notification mappings |
| `us-wbs-hierarchical-notification-lookup` | picking notification recipients up the WBS hierarchy |
| `us-traveler-ncr-input-linking` | NCRs raised from a traveler input |
| `us-traveler-ncr-gating` | linking an NCR to an input by reference, blocking traveler submission on open NCRs, and the closure PDF |

## Writing a test

- **Tag what you create.** Put `runId()` in the part number, WBS number and so on,
  and scope queries and assertions to it. The database is shared and nothing is
  cleaned up, so scenarios and repeat runs must not depend on it being empty.
- **Use the fixture CLI for setup, the app for the behaviour.** The CLI writes
  straight to the database and skips the app's validation and state machine on
  purpose, so it is for preconditions and for reading state back. Drive the thing
  you are testing through the UI or API.
- **Put things back.** A test that changes a user's roles or group membership
  should restore them (see `withAdmin` in `us-wbs-notification-registry.spec.js`).
- **Say who plays whom.** Start the file with a comment on which user is the
  originator, CE/CS, approver and so on. Existing files show the pattern.
- **Emails**: create the client with `createMailpitClient` and poll, since
  delivery is asynchronous, rather than sleeping.
- **Name it**: `us<N>-<topic>.spec.js`, or `us-<feature>.spec.js` for later
  features, with one `test.describe` per user story.

The suite creates data and changes roles in the database behind your local stack.
Run it only against that stack, never against a shared or production database.

## Results and debugging

- `playwright-report/index.html`: a pass/fail report; failed tests link to their
  trace, video and screenshot. `playwright-report/results.json` has the same in
  machine-readable form.
- `test-results/<test>/`: the trace (`trace.zip`), video and screenshot of each
  failed test.
- Replay a failure step by step, with DOM snapshots, network calls and the
  console:

  ```bash
  npx playwright show-trace test-results/<failed-test>/trace.zip
  ```

Both folders are gitignored.
