# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies and copy required assets
npm install
npm run copy:assets        # copies TinyMCE into public/

# Run the application (port 3001 web, 3002 API)
npm start                  # node app
# In Docker (preferred for local dev)
docker compose up

# Lint
npx eslint .

# Tests
npm test                   # all unit tests (mocha test-unit/**/*.test.js)
npx mocha test-unit/lib/permission.test.js   # single test file

# Unit tests require this env var when run outside Docker
TRAVELER_CONFIG_REL_PATH=docker npm test
```

## Architecture

**Traveler** is a web-based electronic traveler / work-order system (the project is called "traveler" even though the repo directory is "upton"). It runs two HTTP servers from [app.js](app.js): a session-authenticated web app (port 3001) and a Basic-Auth REST API (port 3002), both backed by the same MongoDB database via Mongoose.

### Core Data Model

The lifecycle is: **Form (template) → Released Form → Traveler (work instance) → Binder (collection)**.

| Model | File | Role |
|-------|------|------|
| Form | [model/form.js](model/form.js) | Draft/submitted/released/archived template |
| ReleasedForm | [model/released-form.js](model/released-form.js) | Approved form ready for instantiation; can combine a base form + discrepancy form |
| Traveler | [model/traveler.js](model/traveler.js) | A single work instance filled out from a released form |
| Binder | [model/binder.js](model/binder.js) | Named collection of related travelers |
| Review | [model/review.js](model/review.js) | Approval workflow (configurable policy: all / majority / any) |
| History | [model/history.js](model/history.js) | Append-only audit log for all entities |
| Share | [model/share.js](model/share.js) | Per-entity access grants to users or groups |

### Request Handling

Routes live in [routes/](routes/) and map cleanly to models (form.js, traveler.js, binder.js, review.js, …). Shared middleware and helpers are in [lib/req-utils.js](lib/req-utils.js). Permission checks use [lib/permission.js](lib/permission.js) with roles defined in [lib/role.js](lib/role.js).

### Authentication

Supports three strategies configured at deploy time: LDAP/AD ([lib/ldap-client.js](lib/ldap-client.js), [routes/ldaplogin.js](routes/ldaplogin.js)), CAS, and local session. Sessions are stored in MongoDB via `connect-mongo`.

### Frontend

Server-side rendering with **Jade/Pug** templates ([views/](views/), [builderview/](builderview/), [inputview/](inputview/)). Client-side interactivity uses **Rivets.js** for data binding, jQuery, and **TinyMCE 8** for rich-text fields. No build step — static assets are served directly from [public/](public/) (TinyMCE must be copied there with `npm run copy:assets` after install).

### Configuration

[config/config.js](config/config.js) dynamically loads JSON files from a directory controlled by the `TRAVELER_CONFIG_REL_PATH` env var (defaults to `config/`; use `docker` for the Docker dev environment). Separate JSON files configure MongoDB, API, auth, LDAP/AD, email, MQTT, and UI settings.

### Email & Messaging

Outbound email via **Nodemailer** ([lib/email.js](lib/email.js)). Optional MQTT integration for event-driven notifications.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->
