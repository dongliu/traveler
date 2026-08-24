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
 * Resolve a traveler's defined fields (from its labels/types maps) against
 * its recorded data. A field that has been submitted more than once emits
 * one row per submitted value, oldest first; a field with no submitted
 * value yet emits a single empty row. For a 'file' type field, each row's
 * value is a link to where that submission's file can be downloaded rather
 * than the raw filename.
 * @param  {Object} labels           name -> label
 * @param  {Object} types            name -> input type
 * @param  {Array} travelerDataDocs  array of {_id, name, value, inputBy, inputOn}
 * @param  {String} downloadBaseUrl  base URL used to build a 'file' field's download link
 *   (the link is `${downloadBaseUrl}/data/${travelerDataDoc._id}`)
 * @return {Array} ordered array of {name, label, type, value, inputBy, inputOn}
 *   (inputOn is a Unix timestamp in seconds, or '' when unanswered)
 */
function resolveTravelerFields(
  labels,
  types,
  travelerDataDocs,
  downloadBaseUrl
) {
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
      const value =
        type === 'file' ? `${downloadBaseUrl}/data/${entry._id}` : entry.value;
      rows.push({
        name,
        label,
        type,
        value,
        inputBy: entry.inputBy,
        inputOn: toUnixTimestamp(entry.inputOn),
      });
    });
  });
  return rows;
}

/**
 * Build the full CSV export string for a traveler: a metadata block
 * (link/id/title/status), a blank separator row, a data header row, then
 * one row per resolved field.
 * @param  {Object} params
 * @param  {String} params.link
 * @param  {String} params.id
 * @param  {String} params.title
 * @param  {String} params.statusLabel
 * @param  {Array} params.fields  array of {name, label, type, value, inputBy, inputOn}
 * @return {String}
 */
function buildTravelerCsv({ link, id, title, statusLabel, fields }) {
  const lines = [
    toCsvRow(['Traveler Link', link]),
    toCsvRow(['Traveler Id', id]),
    toCsvRow(['Traveler Title', title]),
    toCsvRow(['Traveler Status', statusLabel]),
    '',
    toCsvRow(['Field Name', 'Label', 'Type', 'Value', 'Input By', 'Input On']),
  ];
  (fields || []).forEach(function addFieldRow(field) {
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
  return lines.join('\n');
}

module.exports = {
  escapeCsvValue,
  toCsvRow,
  toUnixTimestamp,
  resolveTravelerFields,
  buildTravelerCsv,
};
