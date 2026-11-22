# Quickstart: Admin Traveler Unarchive

## Prerequisites

- `docker compose up` (per [CLAUDE.md](../../CLAUDE.md)) — needed for both manual verification and the e2e suite.
- Two web app logins: one user holding the `admin` role, one that does not.
- `TRAVELER_CONFIG_REL_PATH=docker` for unit tests run outside Docker.

## Manual walkthrough

1. As any user with write access, create a traveler and get it to `Active` (status `1`).
2. Archive it (existing "Archive" admin bulk action on `/travelers/`, or `PUT /travelers/:id/status` with `{"status": 4}` if testing directly) → traveler now shows **Archived** and redirects to `/travelers/:id/view` (existing `redirectPreview` behavior, unchanged).
3. Confirm the trap, pre-fix: before this feature, any further `PUT /travelers/:id/status` on this traveler returns `400 invalid status change`. After this feature, that part of the status route is unchanged — it's still not how you get out of Archived.
4. Log in as the **non-admin** user, visit the traveler's view page → no "Unarchive" button is rendered (or, calling `PUT /travelers/:id/unarchive` directly, expect `403`). Traveler remains Archived.
5. Log in as the **admin** user, visit the same page → an "Unarchive" button is rendered. Click it (or `PUT /travelers/:id/unarchive` directly) → expect `200`, traveler's status is now `Active` again (the status it held before archiving).
6. Repeat starting from a traveler archived directly from `Initialized` (`0`) and from `Completed` (`2`) → each restores to its own respective prior status, not always `Active`.
7. **Legacy-fallback case**: use the e2e fixture (`e2e/fixtures/cli.js#setTravelerStatus`) to set a traveler straight to `status: 4` without going through the normal archive path (simulating a traveler archived before this feature existed, so `statusBeforeArchive` was never set). Unarchive it as admin → expect it restores to `Active` (`1`), per the resolved fallback.
8. Calling `PUT /travelers/:id/unarchive` on a traveler that is *not* currently Archived → expect `409`, no change.

## Automated verification

```bash
# Unit tests (outside Docker, set the config path env var first)
TRAVELER_CONFIG_REL_PATH=docker npx mocha tests/lib/traveler.test.js

# Full unit suite
npm run unit

# e2e (requires docker compose up and e2e/.env — see e2e/README.md)
npm run e2e -- e2e/us-traveler-ncr-gating.spec.js
```

## Where to look

- New endpoint contract: [contracts/api-traveler-unarchive.md](contracts/api-traveler-unarchive.md)
- Schema field: [data-model.md](data-model.md)
- Why each design choice was made: [research.md](research.md)
