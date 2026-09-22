const path = require('path');

/**
 * Escape a single value for CSV output (RFC 4180 style): wrap in double
 * quotes and double any embedded double quotes when the value contains a
 * comma, double quote, or line break.
 * @param  {*} value
 * @return {String}
 */
function escapeCsvValue(value) {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Join a list of raw values into one escaped CSV line (no trailing newline).
 * @param  {Array} values
 * @return {String}
 */
function toCsvRow(values) {
  return values.map(escapeCsvValue).join(',');
}

// characters a spreadsheet application reads as the start of a formula
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

/**
 * Stop a spreadsheet application from running user-entered text as a formula
 * (CSV injection): a string that starts with =, +, -, @, a tab, or a carriage
 * return gets a leading single quote, so it is shown as text. Anything that is
 * not a string is returned unchanged.
 * Not part of escapeCsvValue, so exports that do not need it are unaffected.
 * @param  {*} value
 * @return {*}
 */
function neutralizeFormula(value) {
  if (typeof value === 'string' && FORMULA_TRIGGER.test(value)) {
    return `'${value}`;
  }
  return value;
}

/**
 * Like toCsvRow, but neutralizes each value first (see neutralizeFormula).
 * Use it for rows that carry user-entered text.
 * @param  {Array} values
 * @return {String}
 */
function toSafeCsvRow(values) {
  return toCsvRow(values.map(neutralizeFormula));
}

/**
 * Convert a Date (or date-parseable value) to a Unix timestamp in seconds.
 * @param  {Date|String|Number} date
 * @return {Number|String} seconds since epoch, or '' when date is falsy
 */
function toUnixTimestamp(date) {
  if (!date) {
    return '';
  }
  return Math.floor(new Date(date).getTime() / 1000);
}

/**
 * The on-disk file name of an uploaded file, taken from its stored path (the
 * upload middleware saves it under a generated name, distinct from the name
 * it was uploaded with).
 * @param  {String} [filePath]
 * @return {String} '' when there is no path
 */
function fileNameFromPath(filePath) {
  return filePath ? path.basename(filePath) : '';
}

/**
 * Resolve a traveler's defined fields (from its labels/types maps) against
 * its recorded data. A field that has been submitted more than once emits
 * one row per submitted value, oldest first; a field with no submitted
 * value yet emits a single empty row.
 *
 * For a 'file' type field, a row's `value` is the id of the submitted
 * TravelerData document (its `/data/:id` download route), not the filename.
 * Such a row also carries `originalFileName` (the name the file was
 * uploaded with), `fileName` (its on-disk name, from `entry.file.path`),
 * `encoding`, and `mimetype`, for buildTravelerCsv's Files section; these
 * four are only present on a row for an actual file submission, never on a
 * field's unanswered row or on a non-file field's row.
 * @param  {Object} labels           name -> label
 * @param  {Object} types            name -> input type
 * @param  {Array} travelerDataDocs  array of {_id, name, value, inputBy, inputOn, file}
 * @return {Array} ordered array of {name, label, type, value, inputBy, inputOn}
 *   (inputOn is a Unix timestamp in seconds, or '' when unanswered)
 */
function resolveTravelerFields(labels, types, travelerDataDocs) {
  const docs = travelerDataDocs || [];
  const rows = [];
  Object.keys(labels || {}).forEach(function resolveField(name) {
    const label = labels[name];
    const type = (types && types[name]) || '';
    const matches = docs
      .filter(function matchByName(d) {
        return d.name === name;
      })
      .sort(function byInputOnAscending(a, b) {
        return a.inputOn > b.inputOn ? 1 : -1;
      });
    if (matches.length === 0) {
      rows.push({ name, label, type, value: '', inputBy: '', inputOn: '' });
      return;
    }
    matches.forEach(function addRowForEntry(entry) {
      const inputBy = entry.inputBy;
      const inputOn = toUnixTimestamp(entry.inputOn);
      if (type !== 'file') {
        rows.push({ name, label, type, value: entry.value, inputBy, inputOn });
        return;
      }
      const file = entry.file || {};
      rows.push({
        name,
        label,
        type,
        value: String(entry._id),
        inputBy,
        inputOn,
        originalFileName: entry.value,
        fileName: fileNameFromPath(file.path),
        encoding: file.encoding || '',
        mimetype: file.mimetype || '',
      });
    });
  });
  return rows;
}

/**
 * The columns that describe a traveler, in order. They are the columns of the
 * public travelers list export (lib/public-travelers.js) and the JSON keys of
 * its records.
 */
const RECORD_COLUMNS = [
  '_id',
  'title',
  'status',
  'createdBy',
  'createdOn',
  'updatedBy',
  'updatedOn',
  'archivedOn',
  'owner',
  'tags',
  'totalInput',
  'finishedInput',
  'subsystem',
  'device',
  'activity',
  'machineArea',
  'sector',
  'windchillId',
];

/**
 * The columns of the metadata section of a single traveler's export: the same
 * columns, with the traveler's link (`url`) after the identifier.
 */
const TRAVELER_COLUMNS = ['_id', 'url'].concat(RECORD_COLUMNS.slice(1));

/**
 * The value to write for one column of a record: a date as ISO 8601 UTC, tags
 * joined with semicolons, an identifier object as its text, and a missing
 * value as an empty cell.
 * @param  {Object} record a traveler record (see toRecord in public-travelers)
 * @param  {String} column one of the column names
 * @return {*}
 */
function recordCell(record, column) {
  const value = record[column];
  if (value === null || value === undefined) {
    return '';
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.join(';');
  }
  return typeof value === 'object' ? String(value) : value;
}

/**
 * A row of resolveTravelerFields' output is a file submission (rather than a
 * non-file field, or a file field with no submission yet) when it carries
 * the extra properties resolveTravelerFields only sets for one.
 * @param  {Object} field
 * @return {Boolean}
 */
function isFileSubmission(field) {
  return field.type === 'file' && field.originalFileName !== undefined;
}

/**
 * Build the full CSV export string for a traveler: a metadata section (a
 * header row of TRAVELER_COLUMNS and one row with the traveler's values), a
 * blank separator row, a data header row, one row per resolved field, a
 * blank separator row, then a Files section (a header row and one row for
 * every field submission that is a file, in the same order as the data
 * section) describing each submitted file: its data id, the name it was
 * uploaded with, its on-disk name, encoding, and mimetype.
 *
 * The metadata row and the Files section carry user-entered text, so both
 * are neutralized against spreadsheet formulas (see neutralizeFormula); the
 * data rows are written as they always were.
 * @param  {Object} params
 * @param  {Object} params.record  the traveler's record (see toRecord in
 *   public-travelers): its `status` is the status name, never a number
 * @param  {String} params.url     the link to the traveler
 * @param  {Array} params.fields  array from resolveTravelerFields
 * @return {String}
 */
function buildTravelerCsv({ record, url, fields }) {
  const metadata = Object.assign({}, record, { url });
  const allFields = fields || [];
  const lines = [
    toCsvRow(TRAVELER_COLUMNS),
    toSafeCsvRow(
      TRAVELER_COLUMNS.map(function cell(column) {
        return recordCell(metadata, column);
      })
    ),
    '',
    toCsvRow(['Field Name', 'Label', 'Type', 'Value', 'Input By', 'Input On']),
  ];
  allFields.forEach(function addFieldRow(field) {
    lines.push(
      toCsvRow([
        field.name,
        field.label,
        field.type,
        field.value,
        field.inputBy,
        field.inputOn,
      ])
    );
  });
  lines.push(
    '',
    toCsvRow(['Id', 'Original File Name', 'File Name', 'Encoding', 'Mimetype'])
  );
  allFields.filter(isFileSubmission).forEach(function addFileRow(field) {
    lines.push(
      toSafeCsvRow([
        field.value,
        field.originalFileName,
        field.fileName,
        field.encoding,
        field.mimetype,
      ])
    );
  });
  return lines.join('\n');
}

module.exports = {
  escapeCsvValue,
  toCsvRow,
  neutralizeFormula,
  toSafeCsvRow,
  RECORD_COLUMNS,
  TRAVELER_COLUMNS,
  recordCell,
  toUnixTimestamp,
  resolveTravelerFields,
  buildTravelerCsv,
};
