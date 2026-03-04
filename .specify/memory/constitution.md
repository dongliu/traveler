<!--
Sync Impact Report
- Version change: 0.0.0 → 1.0.0
- List of modified principles:
  - Added: I. Automated Testing (Testing Standards)
  - Added: II. Code Quality and Consistency (Code Quality)
  - Added: III. Security-First Architecture (Security Considerations)
  - Added: IV. Versioning & Breaking Changes
  - Added: V. Documentation
- Added sections: Core Principles, Governance
- Removed sections: None
- Templates requiring updates:
  - .specify/templates/plan-template.md (✅ updated)
  - .specify/templates/spec-template.md (✅ updated)
  - .specify/templates/tasks-template.md (✅ updated)
- Follow-up TODOs: None
-->

# traveler Constitution

## Core Principles

### I. Automated Testing

Tests MUST be implemented for all new features and bug fixes. Unit tests are
required for library logic, and integration tests for route-level behavior. "No
untested code" is the default expectation. Run `npm run unit` to verify.

### II. Code Quality and Consistency

Follow project-wide linting (ESLint) and formatting (Prettier) rules. Logic
SHOULD be abstracted into shared libraries (in `lib/`) rather than embedded in
routes. Maintain a clear separation between data models, business logic, and
presentation.

### III. Security-First Architecture

Input validation is mandatory at every boundary. Sanitize data before
persistence or presentation. Secrets MUST NEVER be committed to source control;
use environment variables or secure configuration. Adhere to OWASP Top 10
guidelines.

### V. Documentation

API endpoints and complex logic MUST be documented. Keep README and constitution
up to date with architectural shifts. Documentation should be accessible and
reflect the current state of the system.

## Governance

The Constitution supersedes all other practices. All development must align with
these principles.

### Amendment Procedure

Amendments to this constitution require a version bump and a Sync Impact Report.
Changes must be reviewed and ratified by the project leads.

### Compliance Review

All Pull Requests and code reviews must verify compliance with the Core
Principles. Complexity must be justified if it deviates from established
patterns.

**Version**: 1.0.0 | **Ratified**: 2026-03-02 | **Last Amended**: 2026-03-02
