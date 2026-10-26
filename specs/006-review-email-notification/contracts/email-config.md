# Config Contract: Dedicated Email Configuration File

A new required configuration file, `email.json`, sitting alongside the other per-topic files (`ad.json`, `api.json`, `app.json`, `auth.json`, `mongo.json`, `service.json`, `ui.json`) in the configured `TRAVELER_CONFIG_REL_PATH` directory (`../etc/traveler-config/` by default, `docker/` in the Docker deployment).

## Schema

```json
{
  "smtp_host": "smtp.example.com",
  "smtp_port": 25,
  "smtp_ssl": false,
  "smtp_tls": false,
  "notification_email_address": "traveler-noreply@example.com",
  "disclaimer": "This is an automated message from eTraveler. Please do not reply."
}
```

All six fields are required. The application fails to start (same as a missing `app.json`/`ad.json` today) if `email.json` is absent from the config directory.

## Loader Contract (`config/config.js`)

```js
module.exports.email = require('../' + configPath + '/email.json');
```

Added alongside the existing required `require(...)` calls in `load()` — **not** wrapped in `optionalRequire` (that remains reserved for `mqtt.json`).

## Deliverables

- `config/email_change.json` — template/example for operators to copy, following the `*_change.json` naming convention of every other required config file.
- `docker/email.json` — the actual deployed file for the Docker Compose stack, populated with the values currently in `docker/app.json`'s `smtp_*`/`notification_email_address` keys, plus a `disclaimer` value.
- `config/config.js` — add the `module.exports.email` loader line.
- `config/app_change.json` / `docker/app.json` — remove `smtp_host`, `smtp_port`, `smtp_ssl`, `smtp_tls`, `notification_email_address`.

## Migration Note for Existing Deployments

Any deployment upgrading to this feature must create `email.json` in its config directory (copying the five relocated values out of its existing `app.json` plus a new `disclaimer` value) **before** starting the upgraded application — it will not start without it.
