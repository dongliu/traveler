<!--
Sync Impact Report
- Version change: 1.0.0 → 1.1.0
- List of modified principles:
  - Enhanced: I. Automated Testing (expanded coverage and types)
  - Enhanced: II. Code Quality and Consistency (added naming, patterns, reviews)
  - Enhanced: III. Security-First Architecture (expanded security practices)
  - Added: IV. Versioning & Breaking Changes
  - Enhanced: V. Documentation (added specifics for APIs and code)
- Templates requiring updates: None for now
- Follow-up TODOs: Document testing patterns, create security checklist
-->

# traveler Constitution

## Core Principles

### I. Automated Testing

**Mandate**: All new features and bug fixes MUST include corresponding tests.
"No untested code" is the default expectation for every PR.

**Testing Levels**:

- **Unit Tests**: Required for all library logic (in `lib/`), utilities, and
  helper functions. Minimum 80% code coverage for new code.
- **Integration Tests**: Required for route-level behavior and database
  interactions. Test actual API endpoints and workflows.
- **End-to-End Tests**: Recommended for critical user journeys and workflows.

**Standards**:

- Tests MUST be descriptive and clearly indicate what is being tested.
- Use `npm run unit` for pre-commit validation.
- Every bug fix MUST include a regression test.
- Mock external services; do not make real calls to third-party APIs in tests.
- Test both success and failure paths.

### II. Code Quality and Consistency

**Linting and Formatting**:

- ESLint and Prettier rules are mandatory. All code MUST pass linting.
- Run linting automatically on commit via pre-commit hooks.
- Configuration files (`eslint.config.mjs`, `prettier.config.js`) are the source
  of truth.

**Code Style and Organization**:

- Logic SHOULD be abstracted into shared libraries (in `lib/`) rather than
  embedded in routes.
- Maintain separation of concerns: data models → business logic → presentation.
- Use consistent naming conventions: camelCase for variables/functions,
  PascalCase for classes and Jade templates.
- Avoid deeply nested callbacks; prefer async/await or promises.

**Code Review Requirements**:

- All PRs MUST be reviewed before merge.
- Reviewers MUST verify compliance with Core Principles.
- Avoid code duplication; refactor into utilities or services.
- Complexity that deviates from established patterns MUST be justified.

### III. Security-First Architecture

**Input Validation and Sanitization**:

- Input validation is MANDATORY at every system boundary (API routes,
  middleware, form inputs).
- Validate type, length, format, and range for all user inputs.
- Sanitize data before persistence (database) and presentation (HTML/views).
- Use parameterized queries to prevent SQL injection.

**Secrets Management**:

- Secrets MUST NEVER be committed to source control.
- Use environment variables (`.env`) for API keys, database credentials, and
  configuration.
- Never log sensitive data (passwords, tokens, PII).
- Rotate secrets regularly; use secure credential storage in production.

**Authentication and Authorization**:

- Implement proper authentication for all protected endpoints.
- Enforce authorization checks; users MUST only access data they own or have
  explicit permission for.
- Use secure session management (HTTPS, secure cookies, timeout).

**Security Standards**:

- Adhere to OWASP Top 10 guidelines.
- Dependencies MUST be kept up to date; run `npm audit` regularly.
- No credentials, API keys, or tokens in code or configuration files.
- Use HTTPS in production; enforce TLS 1.2 or higher.

### IV. Versioning & Breaking Changes

**Semantic Versioning**:

- Follow Semantic Versioning (MAJOR.MINOR.PATCH).
- MAJOR: Breaking changes, API incompatibilities.
- MINOR: New features, backward-compatible.
- PATCH: Bug fixes, backward-compatible.

**Breaking Changes**:

- Clearly communicate breaking changes in release notes and migration guides.
- Deprecate APIs before removal; allow a transition period.
- Update all documentation and examples when breaking changes are introduced.

### V. Documentation

**API Documentation**:

- All API endpoints MUST be documented with:
  - HTTP method, route, and description.
  - Request parameters, headers, and body schema.
  - Response format and status codes.
  - Authentication requirements and permissions.
- Use JSDoc comments for complex logic and public functions.

**Code Documentation**:

- Complex algorithms and non-obvious logic MUST be documented.
- Document WHY, not just WHAT; explain the intent and design decisions.
- Keep comments up to date with code changes.

**Architecture and README**:

- README MUST describe the project, setup, and key workflows.
- Update documentation when architectural shifts occur.
- Maintain a CHANGELOG for releases and significant changes.
- Document configuration options and environment variables.

**Documentation Standards**:

- Documentation should be accessible and reflect the current system state.
- Use clear examples and avoid jargon where possible.
- Validate that documentation is accurate during code review.

## Governance

The Constitution supersedes all other practices. All development must strictly
align with these principles. Violations of any Core Principle require
justification and review.

### Amendment Procedure

Amendments to this constitution require:

1. A version bump using Semantic Versioning.
2. A Sync Impact Report documenting all changes and their impact.
3. Review and ratification by project leads before merge.

### Compliance Review

**Mandatory in Every PR**:

- Verify compliance with all Core Principles.
- Check that tests meet the coverage and type requirements.
- Ensure code passes linting and formatting checks.
- Review for security vulnerabilities and best practices.
- Validate that documentation is accurate and complete.

**Exceptions**:

- Deviations must be explicitly justified with architectural reasoning.
- All exceptions require explicit approval from project leads.

---

**Version**: 1.1.0 | **Ratified**: 2026-03-02 | **Last Amended**: 2026-03-03
