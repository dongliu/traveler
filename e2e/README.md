# End-to-end tests

Playwright tests that drive the web app in the local docker stack. Each
`*.spec.js` file covers one user story from
[specs/005-playwright-e2e-tests](../specs/005-playwright-e2e-tests/); shared
helpers live in `fixtures/`.

## Docker environment

The stack is defined by [docker-compose.yml](../docker-compose.yml) in the repo
root. `docker compose up` starts three services. The LDAP login service and the
mail service run outside this repo, on the external `traveler-dev` network.

### Services in docker-compose.yml

| Service         | Image                                            | Host port                                               | Role                                                                                                                                                                                                 |
| --------------- | ------------------------------------------------ | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `web`           | built from [Dockerfile](../Dockerfile) (Node 20) | `WEB_PORT` (default 3001) and `API_PORT` (default 3002) | Runs `nodemon app.js`. `TRAVELER_CONFIG_REL_PATH=docker` makes it read `docker/*.json`. The repo is mounted at `/app`, so edits take effect without a rebuild. Starts only after `mongo` is healthy. |
| `mongo`         | `mongo:3.4`                                      | none (the port mapping is commented out)                | The `traveler` database. Seeded from `../traveler-mongo/seed`; data kept in `../${COMPOSE_PROJECT_NAME}-mongo/data`. Has a health check.                                                             |
| `mongo-express` | `mongo-express:0.54.0`                           | `MONGO_EXPRESS_PORT` (default 8081)                     | Web admin for the database. Protected with basic auth; the credentials are in `docker-compose.yml`.                                                                                                  |

Networks:

- `private` (named `${COMPOSE_PROJECT_NAME}-private`) connects `web`, `mongo`,
  and `mongo-express`.
- `infra` is the external `traveler-dev` network. `web` joins it to reach LDAP
  and SMTP.

### Dependencies outside this repo

| Dependency                                                                       | Where                                                                                        | Used for                                                       |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| OpenLDAP from the [traveler-ldap](https://github.com/dongliu/traveler-ldap) repo | `ldap://ldap-service`, base DN `dc=example,dc=org`; phpLDAPadmin at <https://localhost:6443> | Login and user/group lookups                                   |
| `mail-service` (SMTP on port 1025)                                               | `smtp_host` in `docker/app.json`                                                             | Outbound notification mail. The e2e suite does not check mail. |
| traveler-mongo                                                                   | Seed and data directories next to this repo                                                  | Database seed and storage                                      |

### Ports

`WEB_PORT` must match the URL in `docker/auth.json` (currently
`http://localhost:3301`). The login redirect breaks if they differ.

## Starting the stack

Follow [docker.md](../docker.md). In short:

1. Create the network once:
   `docker network create -d bridge --subnet 172.18.1.0/24 traveler-dev`
2. Start traveler-ldap from its own directory: `docker compose up`
3. Set the variables in `.env` (see docker.md), then from the repo root run
   `docker compose up`
4. Check the login page answers at `http://localhost:$WEB_PORT/ldaplogin/`

## Test users

Users come from `seed/traveler.ldif` in the traveler-ldap repo. Logging in binds
to LDAP as `uid=<login>,dc=example,dc=org`. The suite uses two of them:

| Role in the suite | Login (`E2E_USER`) | Display name (`E2E_USER_NAME`) | Email            | Notes                                                       |
| ----------------- | ------------------ | ------------------------------ | ---------------- | ----------------------------------------------------------- |
| Primary           | `dong`             | `Dong Liu`                     | dong@example.com | Must hold the `admin` role in the app.                      |
| Secondary         | `bob`              | `Bob Dalesio`                  | bob@example.com  | No roles needed. The suite grants and removes roles itself. |

The display names must match the LDAP `displayName` exactly. Sharing and group
lookups resolve people by this name.

The other seed users (`guobao`, `dariusz`, `joe`, `kunal`) exist but the suite
does not use them.

Passwords are the `userpassword` values in `seed/traveler.ldif`. They are not
written in this file. Put them in `.env` as `E2E_PASS` and `E2E_PASS2`.

## Settings in .env

```
WEB_PORT=3301                    # must match docker/auth.json
E2E_USER=dong
E2E_PASS=<dong's password from seed/traveler.ldif>
E2E_USER_NAME=Dong Liu
E2E_USER2=bob
E2E_PASS2=<bob's password from seed/traveler.ldif>
E2E_USER2_NAME=Bob Dalesio
```

The suite reads `.env`, and shell variables override it.

## One-time setup: admin role for dong

The suite stops at startup if `dong` lacks the admin role.

1. Run `npm run e2e` once. The first login creates `dong`'s user record and then
   stops at the admin check.
2. Open mongo-express at `http://localhost:$MONGO_EXPRESS_PORT` and log in with
   the basic-auth credentials from `docker-compose.yml`.
3. Open the `traveler` database and the `users` collection. Open the document
   with `_id` `"dong"` and add `"admin"` to its `roles` array.
4. Run `npm run e2e` again.

## Running the suite

From the repo root:

```bash
npm run e2e                                              # everything
npm run e2e -- e2e/us1-form-lifecycle.spec.js            # one file
npm run e2e -- e2e/us1-form-lifecycle.spec.js -g AS3     # one scenario
```

If the web app is unreachable, or a login fails, the run stops at once with a
message naming the failed dependency.

Failed tests leave a trace, video, and screenshot in `test-results/`. The HTML
report is in `playwright-report/`. Open a trace with
`npx playwright show-trace test-results/<test>/trace.zip`.
