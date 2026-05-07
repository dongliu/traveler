# traveler Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-10

## Active Technologies
- MongoDB via Mongoose — 2 collections: `ncrs` (with embedded `events[]`), `preventive_actions` (001-ncr-workflow)
- MongoDB via Mongoose — 1 collection: `ncrs` (embedded `events[]` + `preventive_actions[]`) (001-ncr-workflow)

- Node.js 18+, JavaScript (ES6+) + Express 4, Mongoose 5, Nodemailer 6, javascript-state-machine (FSM) (001-ncr-workflow)

## Project Structure

```text
lib/          # Business logic, state machine, email templates
model/        # Mongoose schemas
routes/       # Express route handlers
views/        # Jade templates
test-unit/    # Unit tests (mocha)
test-integ/   # Integration tests
```

## Commands

npm test && npm run lint

## Code Style

Node.js 18+, JavaScript (ES6+): Follow standard conventions

## Recent Changes
- 001-ncr-workflow: Added Node.js 18+, JavaScript (ES6+) + Express 4, Mongoose 5, Nodemailer 6, javascript-state-machine
- 001-ncr-workflow: Added Node.js 18+, JavaScript (ES6+) + Express 4, Mongoose 5, Nodemailer 6, javascript-state-machine

- 001-ncr-workflow: Added javascript-state-machine (FSM), NCR workflow module (lib/ncr*.js, model/ncr*.js, routes/ncr.js, views/ncr-*.jade)

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->
