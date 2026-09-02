# Feature Specification: WBS YAML Config File

**Feature Branch**: `120-wbs-yaml-config`

**Created**: 2026-08-24

**Status**: Draft

**Input**: User description: "The manual input of wbs number on admin page can be time consuming and error prone. Instead, the system admin will add a wbs.yaml at the `config` directory. for docker, it is the `docker` directory.  The yaml file has lines of the mapping, e.g. 1.2: test12@example.com. The application load the yaml file when starting. This file is an optional config for the application."

## Clarifications

### Session 2026-08-24

- Q: Should the existing admin page WBS management (manual add/edit/delete) be kept alongside the YAML approach, or removed entirely? → A: The admin page WBS approach should be cleaned out entirely — YAML becomes the sole mechanism for managing WBS-to-email mappings.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin Configures WBS Mappings via File (Priority: P1)

A system administrator wants to configure WBS-to-email notification mappings by placing a `wbs.yaml` file in the application's config directory. The admin adds one line per WBS-to-email mapping, and restarts the application. The application reads the file at startup and all mappings become active. The previously existing manual-entry admin page for WBS mappings is removed.

**Why this priority**: This is the core value of the feature — replacing a manual, error-prone admin page process with a file-based configuration that is easier to maintain, version-control, and bulk-edit.

**Independent Test**: Can be fully tested by placing a `wbs.yaml` file with several WBS mappings, restarting the application, and verifying that the mappings are active and NCR notifications resolve to the correct email addresses.

**Acceptance Scenarios**:

1. **Given** a `wbs.yaml` file exists in the config directory with valid mappings, **When** the application starts, **Then** all mappings defined in the file are loaded and active.
2. **Given** a `wbs.yaml` file with multiple mappings (e.g., `1.1: a@example.com`, `1.2: b@example.com`), **When** the application starts, **Then** each WBS number is associated with its corresponding email address.
3. **Given** the application has started with a `wbs.yaml` file, **When** the admin views the WBS notification settings, **Then** only the file-loaded mappings are shown (read-only; no add/edit/delete controls are present).

---

### User Story 2 - Application Starts Without Config File (Priority: P2)

The `wbs.yaml` file is optional. If no file is present, the application starts normally. WBS notification resolution simply finds no matches, which is the expected behavior for a deployment that has not yet configured any WBS mappings.

**Why this priority**: Prevents the application from failing to start in environments where a `wbs.yaml` has not been set up yet.

**Independent Test**: Can be fully tested by ensuring the `wbs.yaml` file is absent, confirming the application starts with no errors related to this feature, and confirming WBS notification resolution returns no match (no email sent) for any WBS number.

**Acceptance Scenarios**:

1. **Given** no `wbs.yaml` file exists in the config directory, **When** the application starts, **Then** it starts successfully with no errors or warnings related to the missing file.
2. **Given** no `wbs.yaml` file exists, **When** WBS notification resolution is triggered for any WBS number, **Then** no match is found and no notification email is sent.

---

### User Story 3 - Application Reports Config File Problems Clearly (Priority: P3)

If a `wbs.yaml` file is present but contains invalid content (malformed YAML, invalid email addresses, unrecognized WBS format), the application provides a clear startup message identifying the problem so the admin can fix it quickly.

**Why this priority**: Reduces debugging time — silent failures or cryptic errors would undermine the benefit of file-based configuration.

**Independent Test**: Can be fully tested by providing a `wbs.yaml` with known invalid content and verifying that the startup output includes a clear, actionable message identifying the issue.

**Acceptance Scenarios**:

1. **Given** a `wbs.yaml` file with invalid YAML syntax, **When** the application starts, **Then** a clear error message is logged identifying the file and the nature of the problem, and the application continues without applying partial mappings.
2. **Given** a `wbs.yaml` file with an invalid email address for one entry, **When** the application starts, **Then** a warning is logged for the invalid entry and all valid entries are still loaded.

---

### Edge Cases

- What happens when `wbs.yaml` exists but is completely empty? Application treats it as having no mappings and starts normally.
- What happens when `wbs.yaml` contains duplicate WBS keys? The last definition for a given WBS number wins, consistent with standard YAML conventions.
- What happens on Docker deployments where the config directory differs? The application automatically uses the `docker/` directory when running in Docker, so the admin places the file there; no application code change is needed for this distinction.
- What happens to existing WBS mappings that were entered via the admin page before this feature is deployed? Those database records become unreachable once the admin page and DB lookup are removed; system administrators must migrate desired mappings into `wbs.yaml` before deploying this feature.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST attempt to load `wbs.yaml` from the active config directory at application startup.
- **FR-002**: The active config directory MUST be `config/` for standard deployments and `docker/` for Docker deployments, consistent with existing configuration file placement.
- **FR-003**: System MUST start successfully and operate normally when `wbs.yaml` is absent — no error, no degraded behavior; WBS resolution simply returns no match.
- **FR-004**: The `wbs.yaml` file MUST support key-value lines where each key is a WBS number (e.g., `1.2`) and each value is an email address (e.g., `test12@example.com`).
- **FR-005**: System MUST load all valid WBS-to-email mappings from the file and make them active as notification targets.
- **FR-006**: System MUST log a confirmation message at startup when `wbs.yaml` is found and successfully loaded, including the count of mappings loaded.
- **FR-007**: System MUST log a clear error message at startup when `wbs.yaml` exists but cannot be parsed, and MUST NOT apply partial results from a fatally invalid file.
- **FR-008**: System MUST log a per-entry warning when individual entries in `wbs.yaml` are invalid (e.g., malformed email), and MUST still load all other valid entries.
- **FR-009**: The admin page WBS notification management section (manual add, edit, and delete of WBS mappings) MUST be removed; the admin page MAY display active YAML-loaded mappings as a read-only informational view.
- **FR-010**: The application MUST NOT query the database for WBS notification mappings at runtime; all WBS resolution must use the in-memory YAML-loaded map exclusively.

### Key Entities

- **WBS Mapping**: A pairing of a WBS number (hierarchical dot-notation identifier) to a notification email address. Loaded from `wbs.yaml` at startup; held in memory only (not persisted to the database).
- **WBS Config File (`wbs.yaml`)**: An optional configuration file placed in the active config directory by the system administrator. Contains one or more WBS Mappings in YAML key-value format. This is now the sole authoritative source for WBS notification mappings.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can configure or update all WBS-to-email mappings by editing a single file, completing a full configuration update in under 5 minutes regardless of the number of mappings.
- **SC-002**: Application startup succeeds in 100% of test scenarios regardless of whether `wbs.yaml` is present, absent, or malformed.
- **SC-003**: All valid mappings defined in `wbs.yaml` are active and producing correct notifications within one application restart after the file is edited.
- **SC-004**: Configuration errors in `wbs.yaml` are surfaced as human-readable startup messages, enabling an admin to identify and fix the problem without examining application internals.
- **SC-005**: The admin page no longer exposes WBS mapping add/edit/delete controls; any attempt to access former WBS management API endpoints returns 404 or is removed from routing.

## Assumptions

- WBS numbers in the YAML file use the same dot-notation format previously recognized by the system (e.g., `1.2`, `3.1.4`).
- A single WBS number maps to a single email address (one-to-one per line); bulk assignment to multiple emails for one WBS is out of scope for this feature.
- The application requires a restart to pick up changes to `wbs.yaml`; live reloading without restart is out of scope.
- The `docker/` vs. `config/` directory distinction is already handled by the existing configuration loading mechanism and does not require a new runtime flag.
- Email address format validation applies the same regex rules previously used by the admin page entry validation.
- Existing WBS mappings stored in the database from the admin page era are not automatically migrated; administrators must manually copy desired mappings into `wbs.yaml` before deploying this feature. The underlying database storage for admin-entered WBS mappings may be removed as part of cleanup.
- Deployments that previously had no WBS mappings configured are unaffected by this change.
