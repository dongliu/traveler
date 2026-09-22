# Feature Specification: Public Traveler Listing API & Dashboard

**Feature Branch**: `004-public-traveler-dashboard`

**Created**: 2026-09-20

**Status**: Draft

**Input**: User description: "create an API lib that 1) can list all the public travelers with paging option sorted by update timestamp; 2) can support output of json or CSV; 3) includes the following properties: title, status, createdBy, createdOn, updatedBy, updatedOn,archivedOn, owner, tags, totalInput, finishedInput, subsystem, device, activity, machineArea, sector, windchillId; 4) support query by update timestamp range, subsystem, device, activity, machineArea, sector, windchillId, status, tags. Based on the API, the public traveler page at views/public-travelers.jade can transformed into a dashboard like views/ncr-dashboard.jade in the `upton` branch. Clarify if needed."

## Clarifications

### Session 2026-09-20

- Q: A traveler with no stored public-access value: is it listed? → A: Follow the application's configured default for new travelers. When that default is read or write, such a traveler is public (it is treated as public everywhere else in the application) and is listed. A traveler whose stored value is "none" is never listed.
- Q: A traveler with no recorded status: how is it counted? → A: As initialized, the default status for new travelers, so it is listed, filtered, and counted like any initialized traveler and totals, pages, and cards always agree.
- Q: Should the dashboard keep the Select all and Select none buttons? → A: No. Users pick rows with each row's own checkbox; Generate report and Add to binder work on the rows picked.

### Session 2026-09-21

- Q: A traveler from before the single device property has only the older list of devices. What does the listing show and filter on? → A: Its device is that list's names joined with "/", as the rest of the application shows it, in the list, the dashboard, and both CSV exports. The device filter also finds a traveler through that list, but only when the traveler has no device of its own.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Retrieve public travelers a page at a time, newest update first (Priority: P1)

An integrator, report builder, or script author requests the list of all publicly accessible travelers. The list comes back a page at a time, with the most recently updated travelers first, and each traveler carries its key descriptive, ownership, timing, and progress properties. This lets external tools consume the list without pulling every traveler at once.

**Why this priority**: This is the foundation of the whole feature. The filters, the CSV output, and the dashboard all build on a correct, ordered, paged list of public travelers. On its own it already gives external systems a usable feed.

**Independent Test**: Request the list with no filters against a data set containing public and non-public travelers. Verify that only public, non-archived travelers are returned, that they are ordered by most recent update first, that each carries every requested property, and that the paging information (page, page size, total matching) is correct.

**Acceptance Scenarios**:

1. **Given** a mix of travelers with public read access, public write access, and no public access, **When** the list is requested, **Then** only travelers with public read or write access are returned, and the reported total equals the number of public, non-archived travelers.
2. **Given** 60 public travelers and a page size of 25, **When** pages 1, 2, and 3 are requested in turn, **Then** they contain 25, 25, and 10 travelers, and together they contain every public traveler exactly once, ordered by most recent update first.
3. **Given** a page number beyond the last page, **When** it is requested, **Then** an empty page is returned together with the correct total and no error.
4. **Given** a traveler that has no subsystem, device, activity, machine area, sector, or Windchill ID, **When** it appears in the list, **Then** it is included with those properties present but empty.
5. **Given** a request with no paging options, **When** the list is requested, **Then** the default page size is applied and the response states the page, page size, and total.
6. **Given** a requester who is not signed in or has no valid API credentials, **When** the list is requested, **Then** the request is denied and no traveler data is disclosed.

---

### User Story 2 - Narrow the list with filters (Priority: P1)

A user or system narrows the public traveler list to what it needs: travelers updated within a date or time range, or those matching a given subsystem, device, activity, machine area, sector, Windchill ID, status, or tags. Any combination of filters can be applied together.

**Why this priority**: An unfiltered list of every public traveler is impractical once volumes grow. Filtering is what makes the list usable for both integrations and the dashboard, so it ships together with the base list.

**Independent Test**: Seed public travelers with varied classification values, statuses, tags, and update times. Apply each filter alone and in combinations, and verify that every returned traveler satisfies every filter and that no matching traveler is missing.

**Acceptance Scenarios**:

1. **Given** public travelers updated on various dates, **When** an update range from 2026-09-01 to 2026-09-15 is requested, **Then** only travelers updated within that range are returned, and the end date includes the entire final day.
2. **Given** an update range with only a start (or only an end), **When** it is requested, **Then** the open side is unbounded.
3. **Given** travelers whose subsystem values are "Cryogenics" and "CRYO-2", **When** the subsystem filter "cryo" is applied, **Then** both are returned regardless of letter case.
4. **Given** the same kind of matching for device, activity, machine area, sector, and Windchill ID, **When** each filter is applied, **Then** it narrows the list on that property alone.
5. **Given** a status filter given by name ("active") or by its numeric code, **When** it is applied, **Then** both forms return the same travelers, and supplying several statuses returns travelers in any of them.
6. **Given** a tag filter listing two tags, **When** it is applied, **Then** only travelers carrying both tags are returned, with tags matched as whole labels regardless of letter case.
7. **Given** several filters at once (for example, subsystem + status + tags), **When** they are applied, **Then** every returned traveler satisfies all of them.
8. **Given** filters that match nothing, **When** they are applied, **Then** an empty result with a total of zero is returned, not an error.
9. **Given** archived public travelers exist, **When** the request includes the option to include archived travelers (or filters on the "archived" status), **Then** archived travelers are returned with their archive date populated. Otherwise they are excluded.
10. **Given** filter values that are blank, **When** the request is made, **Then** blank values are ignored as if the filter were not supplied.

---

### User Story 3 - Download the list as CSV (Priority: P2)

A user or system requests the same list, with the same filters and ordering, as a CSV file. This gives analysts and report writers something they can open directly in a spreadsheet.

**Why this priority**: CSV is a second presentation of data already produced by the P1 stories. It adds real value for spreadsheet users, but the list works without it.

**Independent Test**: Request a filtered list in CSV format and open the file in a spreadsheet application. Verify the header row, one row per matching traveler in the same order as the JSON output, correct column alignment, and intact special characters.

**Acceptance Scenarios**:

1. **Given** a filtered request in CSV format, **When** it is fulfilled, **Then** the file has a header row followed by one row per matching traveler, in the same order and with the same content as the JSON output.
2. **Given** a traveler whose title contains a comma, double quote, or line break, **When** it is exported, **Then** the value stays in one cell, exactly as entered, when opened in a spreadsheet.
3. **Given** a traveler whose title (or any free-text value) begins with a character a spreadsheet would treat as a formula (such as `=`, `+`, `-`, or `@`), **When** it is exported, **Then** it displays as text and is never evaluated as a formula.
4. **Given** a CSV request with no paging options, **When** it is fulfilled, **Then** every matching traveler is included. **Given** a CSV request with paging options, **Then** only the requested page is included.
5. **Given** a CSV request with filters that match nothing, **When** it is fulfilled, **Then** the file contains only the header row.
6. **Given** a traveler with several tags, **When** it is exported, **Then** the tags appear together in a single cell, separated by semicolons.

---

### User Story 4 - Browse public travelers on a dashboard (Priority: P2)

A signed-in user opens the public travelers page and sees a dashboard modeled on the NCR dashboard: a filter bar, a paged table of public travelers, and page navigation. The user filters by any supported criterion, moves between pages, opens a traveler, and downloads what they see as CSV. The existing bulk actions (select rows, generate a report, add to a binder) keep working.

**Why this priority**: The dashboard is the visible payoff for people working in the application. It depends on the P1 stories and adds no new data, so it comes after them.

**Independent Test**: Open the dashboard against a data set larger than one page. Apply filters, page through results, open a traveler, download the CSV, and run a report and an add-to-binder on selected rows. Confirm each behaves as described.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** the dashboard opens, **Then** it shows the first page of public travelers, most recently updated first, with a range indicator (for example "1–25 of 132").
2. **Given** the filter bar, **When** the user enters filters and applies them, **Then** the table refreshes in place, without leaving the page, and returns to the first page with an updated total.
3. **Given** applied filters, **When** the user clears them, **Then** all filters reset and the unfiltered first page is shown.
4. **Given** more results than fit on a page, **When** the user moves next or previous, **Then** the adjacent page is shown. The previous control is disabled on the first page and the next control on the last.
5. **Given** a traveler in the table, **When** the user selects its title, **Then** that traveler opens.
6. **Given** applied filters, **When** the user chooses to download CSV, **Then** the file contains every traveler matching the filters, not just the current page.
7. **Given** selected rows, **When** the user chooses "Generate report" or "Add to binder", **Then** the action runs on the selected travelers exactly as it does today. Rows are selected with their own checkboxes.
8. **Given** the option to include archived travelers is turned on, **When** filters are applied, **Then** archived public travelers appear and their archive date is shown.
9. **Given** the data cannot be loaded, **When** the dashboard tries to load it, **Then** a clear message says so and the user can retry. The table is not silently left blank.
10. **Given** filters that match nothing, **When** they are applied, **Then** the dashboard shows a "no matching travelers" message.

---

### User Story 5 - See status totals at a glance (Priority: P3)

Above the table, the dashboard shows a summary card for "All" and for each traveler status, each with a count. Selecting a card narrows the table to that status.

**Why this priority**: Summary cards are quick orientation and one-click filtering. They are convenient but not required to find or export travelers.

**Independent Test**: With a known mix of travelers across statuses, open the dashboard and verify each card's count. Select a card and confirm the table narrows to that status. Change another filter and confirm the counts update.

**Acceptance Scenarios**:

1. **Given** public travelers in several statuses, **When** the dashboard opens, **Then** there is an "All" card and one card per status, each showing the number of matching travelers.
2. **Given** a status card, **When** the user selects it, **Then** the table narrows to that status, returns to the first page, and the selected card is visibly highlighted.
3. **Given** a status card is selected and other filters change, **When** the filters are applied, **Then** all cards still show their counts for the other filters, so the user can see the other statuses' totals and switch between them.
4. **Given** any set of filters, **When** the cards are displayed, **Then** the per-status counts add up to the "All" count.

---

### Edge Cases

- **No public travelers at all**: the list, CSV, and dashboard each show a valid empty result, not an error.
- **Page beyond the end**: an empty page with the correct total.
- **Invalid paging values** (page zero, negative, or non-numeric): the request is rejected with a message naming the problem. A page size above the maximum is reduced to the maximum, and the response reports the page size actually applied.
- **Invalid filter values** (unparseable date, start later than end, unknown status name or code, unknown output format): the request is rejected with a message naming the problem, and no data is returned.
- **Special characters in filter text** (parentheses, asterisks, brackets, and similar): treated as ordinary text, never causing an error or unexpected matches.
- **Travelers with identical update times**: ordering between them is fixed and repeatable, so paging never repeats or skips a traveler when the data is unchanged.
- **Traveler with no update timestamp**: sorted using its creation timestamp.
- **Traveler updated while someone is paging**: the user may see it move between pages on later requests. This is expected, and no error occurs.
- **Traveler with no total inputs**: its progress shows as not applicable rather than a divide-by-zero or a misleading percentage.
- **Traveler with no recorded status**: listed, filtered, and counted as initialized, so totals, pages, and cards always agree.
- **Filtering on a property a traveler has left blank**: that traveler does not match a filter on that property.
- **Public access removed from a traveler**: the traveler no longer appears in any later request.
- **Archived card with archived travelers excluded**: the dashboard's "archived" summary card is shown only when archived travelers are included, so a card never shows a count that its own selection would contradict.

## Requirements *(mandatory)*

### Functional Requirements

**Listing**

- **FR-001**: The system MUST provide a public traveler listing capability that returns only travelers whose public access is read or write. Travelers with no public access MUST never be returned, whoever asks.
- **FR-002**: By default the listing MUST exclude archived travelers. It MUST offer an option to include them, and filtering by the "archived" status MUST also return them.
- **FR-003**: Results MUST be ordered by update timestamp, most recent first. Ties MUST be broken in a fixed, repeatable way, and a traveler without an update timestamp MUST be ordered by its creation timestamp.
- **FR-004**: The listing MUST support paging through a page number and a page size, with a default page size and a maximum page size. A page size above the maximum MUST be reduced to the maximum, and the response MUST report the size actually applied.
- **FR-005**: Every listing response MUST report the total number of matching travelers, the page returned, and the page size applied, so a consumer can tell whether more pages exist.
- **FR-006**: Every listed traveler MUST include a stable identifier plus these properties: title, status, createdBy, createdOn, updatedBy, updatedOn, archivedOn, owner, tags, totalInput, finishedInput, subsystem, device, activity, machineArea, sector, and windchillId. A property with no value MUST still be present, and empty.
- **FR-007**: Status MUST be presented as its human-readable name (initialized, active, submitted for completion, completed, frozen, archived). The JSON output MUST also carry the status's numeric code.

**Output formats**

- **FR-008**: The requester MUST be able to choose JSON or CSV output, with JSON as the default. An unsupported format MUST be rejected with a clear message.
- **FR-009**: The JSON output MUST contain the list of travelers plus the paging information from FR-005.
- **FR-010**: The CSV output MUST contain a header row followed by one row per traveler, with a fixed column order (identifier, then the properties in the order listed in FR-006). It MUST follow the same filters and ordering as the JSON output.
- **FR-011**: The CSV output MUST keep values intact when they contain commas, double quotes, line breaks, or non-English characters.
- **FR-012**: The CSV output MUST prevent user-entered text from being executed as a spreadsheet formula.
- **FR-013**: In the CSV output, a request with no paging options MUST return every matching traveler, and a request with paging options MUST return only the requested page. When nothing matches, the file MUST contain only the header row.
- **FR-014**: In both formats, tags MUST be listed as separate items in JSON and joined with semicolons in one CSV cell. Timestamps MUST use one unambiguous standard format including time zone.

**Filtering**

- **FR-015**: The listing MUST support filtering by an update timestamp range, with an optional start and an optional end, both inclusive. An end given as a date alone MUST include that entire day.
- **FR-016**: The listing MUST support filtering by subsystem, device, activity, machine area, sector, and Windchill ID, each matching partial text regardless of letter case.
- **FR-017**: The listing MUST support filtering by status, given as a name or a numeric code, with one or more statuses allowed. A traveler matches if it is in any of the given statuses.
- **FR-018**: The listing MUST support filtering by tags, matching whole tag labels regardless of letter case. When several tags are given, a traveler MUST carry all of them to match.
- **FR-019**: When several filters are given, a traveler MUST satisfy all of them to be returned. Blank or omitted filters MUST NOT restrict the result.
- **FR-020**: Filter text MUST be treated literally. Special characters MUST NOT cause errors or unintended matches.
- **FR-021**: Invalid paging values, filter values, or formats MUST be rejected with a clear message identifying the problem. Nothing partial may be returned, and the system MUST NOT fail with an unexplained error.
- **FR-022**: The listing MUST report, for the current filters but ignoring the status filter, how many matching travelers are in each status, so a dashboard can show status totals without retrieving every traveler. The "archived" count MUST be reported only when archived travelers are included.

**Access**

- **FR-023**: The listing MUST require authentication. Signed-in application users and consumers with valid API credentials MUST be served, and everyone else MUST be denied without any traveler data being disclosed. The two kinds of requester MUST get the same travelers, in the same order, with the same values, for identical requests. (The only permitted difference is that a CSV downloaded from the dashboard may carry a leading encoding marker so spreadsheet applications read international characters correctly.)
- **FR-024**: The listing MUST be read-only. It MUST NOT change any traveler.

**Dashboard**

- **FR-025**: The public travelers page MUST become a dashboard at the same address as today's page, so existing links and bookmarks keep working. The dashboard MUST obtain all traveler data through the listing capability described above, not through a separate data path.
- **FR-026**: The dashboard MUST provide a filter bar with an update-from and update-to date, subsystem, device, activity, machine area, sector, Windchill ID, tags, and an "include archived" option, together with Apply and Clear actions. Applying filters MUST refresh the results in place and return to the first page.
- **FR-027**: The dashboard MUST show a paged table with previous and next controls, a range indicator (such as "26–50 of 132"), and a choice of page sizes. The table MUST show the title as a link to the traveler, status, progress (finished of total inputs), subsystem, device, activity, machine area, sector, Windchill ID, tags, owner, created by/on, and updated by/on, plus the archive date when archived travelers are included.
- **FR-028**: The dashboard MUST show summary cards for "All" and each status, with counts per FR-022. Selecting a card MUST filter the table to that status and highlight the card. The other filters MUST keep updating all the cards. The "archived" card MUST appear only when archived travelers are included.
- **FR-029**: The dashboard MUST offer a CSV download of every traveler matching the current filters, not only the current page.
- **FR-030**: The dashboard MUST keep the existing bulk actions on rows the user selects with their checkboxes: generate a report for the selected travelers, and add the selected travelers to a binder. It does not need Select all or Select none buttons.
- **FR-031**: The dashboard MUST show a loading indicator while data loads, a clear message with a retry option when loading fails, and a "no matching travelers" message when nothing matches.

### Key Entities

- **Public Traveler Record**: A traveler with public read or write access, as it appears in the listing. It is identified by a stable identifier and carries title, status, creation and update details (who and when), archive date, owner, tags, input progress (total and finished), and the six classification properties (subsystem, device, activity, machine area, sector, Windchill ID).
- **Listing Query**: The requester's choices: output format, page and page size, update timestamp range, the six classification filters, status filter, tag filter, and the include-archived option.
- **Listing Result**: What comes back: the page of Public Traveler Records, the total matching count, the page and page size applied, and the per-status counts for the current filters.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a collection of up to 5,000 public travelers, any page of the list, with or without filters, is returned in under 3 seconds, and the dashboard shows refreshed results within 3 seconds of applying a filter.
- **SC-002**: 100% of listed travelers, in both JSON and CSV, carry the identifier and all 17 requested properties, with empty values shown as empty rather than omitted.
- **SC-003**: Paging through a full result set returns every matching traveler exactly once, in most-recently-updated-first order, with zero duplicates and zero omissions when the data does not change.
- **SC-004**: For every filter and every filter combination in acceptance testing, 100% of returned travelers satisfy all filters and no matching traveler is missing.
- **SC-005**: Zero travelers without public access appear in any output (JSON, CSV, or dashboard), and zero unauthenticated requests receive traveler data.
- **SC-006**: A CSV file opens in common spreadsheet applications with every value in its correct column, text containing commas, quotes, and line breaks intact, and no cell interpreted as a formula from user-entered text.
- **SC-007**: A dashboard user can find a specific traveler by combining filters in under 30 seconds without leaving the page.
- **SC-008**: Both bulk actions the dashboard keeps from today's public travelers page (generate report, add to binder) remain available and work on rows selected on the dashboard.
- **SC-009**: On the dashboard, the per-status counts add up to the "All" count for every filter combination.

## Assumptions

- **What "public" means**: a traveler is public when its public access is set to read or write, the same rule the current public travelers page uses. A traveler that has no stored public-access value counts as public whenever the application's configured default for new travelers is read or write, because that is the value the rest of the application applies to it; a stored value of "none" is never public. The listing never reveals travelers with no public access, even to their owners or administrators. Those users see them through the existing traveler lists.
- **Archived travelers**: excluded by default, matching today's page, and included through an opt-in option or by filtering on the "archived" status. A traveler counts as archived if it has been marked archived or has the archived status, the same rule the existing archived-travelers list uses. An archived traveler is always reported with the status "archived", whatever status it had before, so each traveler falls under exactly one status card. Its archive date is shown only while it is marked archived, because a date left over from an earlier archive must not appear on a traveler that has since been restored. One consequence: a traveler with the archived status that is not marked archived, which today's page still lists, is hidden by default.
- **Who can call it**: signed-in application users, using the same sign-in as the rest of the application, and external systems using the existing API credentials. Anonymous access is out of scope, and "public" refers to the traveler's access setting, not to being reachable without signing in. One shared listing capability serves both audiences so the data is always identical.
- **Volume and paging defaults**: the collection is expected to stay within a few thousand public travelers. The default page size is 25 and the maximum is 500, which is enough at that volume.
- **CSV size**: a CSV request without paging returns the complete matching set, which is acceptable at the expected volume.
- **Matching rules**: the six classification filters match partial text, ignoring letter case, because these are free-text fields with no fixed vocabulary. Tags match whole labels, ignoring letter case, because they are discrete labels. All supplied filters combine as "and".
- **Date filters**: a date without a time is treated as a whole day in the server's local time zone. A full timestamp is honored exactly.
- **People properties**: createdBy, updatedBy, and owner are shown as recorded in the system (user IDs), with no lookup of display names.
- **Extra identifier property**: a stable traveler identifier is included in addition to the 17 requested properties, because the dashboard needs it to link and select travelers and because CSV consumers need a reliable key.
- **Sort order**: newest update first is the only ordering offered. Sorting by other columns is out of scope, so the dashboard drops the per-column sorting and the sharing and key columns that today's page has. That information is still available on each traveler.
- **Bulk selection**: the dashboard has no Select all or Select none buttons; users pick rows with each row's checkbox, and the report and binder actions work on the rows picked.
- **Devices from before the single device property**: a traveler that only has the older list of devices is shown with those names joined by "/", exactly as the rest of the application shows it, and its `device` in the JSON and CSV is that text. The device filter matches the names in that list, but only for a traveler with no device of its own, so a filter never finds a traveler by something the list does not show for it. Because matching is per name, a filter such as `DEV-1/DEV-2` does not match a traveler whose list holds those two names.
- **Existing traveler data**: the six classification properties come from the metadata already added to travelers (feature 003). Travelers created before that feature simply have them empty.
- **Existing endpoints**: the current public travelers data endpoint that feeds today's page is retired, since the dashboard replaces its only user. The existing API endpoint that lists travelers is unchanged.
- **Owner**: where a traveler has no explicit owner, its creator is reported as the owner, as the rest of the application treats ownership.
- **Dashboard visual design**: it follows the NCR dashboard on the `upton` branch (summary cards, filter bar, paged table, previous/next navigation) but uses the traveler status names and this application's existing look and feel. Pixel-level layout is left to design.
- **Out of scope**: changing travelers through the API, saved filters, sharing filtered views by link, scheduled or emailed exports, and per-user column choices.
