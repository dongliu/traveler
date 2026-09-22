/**
 * Shared listing of public travelers, used by the web app route
 * (/publictravelers/list) and the REST API route (/apis/publictravelers/).
 * It has no dependency on a server or on a live database connection: the
 * Traveler model is passed in, so tests can pass a fake.
 *
 * See specs/004-public-traveler-dashboard/ for the design.
 */
const _ = require('lodash');
const { statusMap } = require('../model/traveler');
const { DataError } = require('./error');
const reqUtils = require('./req-utils');
const csv = require('./csv');
const logger = require('./loggers').getLogger();

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 500;
const MAX_PAGE = 100000;
const MAX_TEXT_LENGTH = 200;

const INITIALIZED_CODE = 0;
const ARCHIVED_CODE = 4;
// stored statuses that are reported as they are
const LIVE_STATUS_CODES = [1, 1.5, 2, 3];

/**
 * The status a traveler is listed, filtered, and counted under.
 * - archived (flag set, or status 4) always reads as archived, whatever its
 *   stored status, so each traveler falls under exactly one status;
 * - a status that is missing or not one of 0, 1, 1.5, 2, 3 counts as
 *   initialized, the schema default, so no traveler is ever "unknown".
 * @param  {Object} doc a traveler (document or plain object)
 * @return {{code: Number, name: String}}
 */
function effectiveStatus(doc) {
  let code = INITIALIZED_CODE;
  if (doc.archived === true || doc.status === ARCHIVED_CODE) {
    code = ARCHIVED_CODE;
  } else if (LIVE_STATUS_CODES.indexOf(doc.status) !== -1) {
    code = doc.status;
  }
  return { code, name: statusMap[String(code)] };
}

function textOf(value) {
  return typeof value === 'string' ? value : '';
}

function dateOf(value) {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * The device names of the older `devices` list, joined with "/" as the rest of
 * the application shows them (see deviceColumn in table.js and traveler.jade).
 * Travelers from before the single `device` property have only this list.
 */
function devicesText(devices) {
  if (!Array.isArray(devices)) {
    return '';
  }
  return devices
    .filter(function isName(name) {
      return typeof name === 'string' && name !== '';
    })
    .join('/');
}

function countOf(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * Map a traveler to the record the listing returns. Every key is always
 * present. `owner` falls back to the creator, as the rest of the application
 * treats ownership; `archivedOn` is reported only while the traveler is marked
 * archived, since the date is not cleared when a traveler is restored, and
 * `device` falls back to the older `devices` list.
 * @param  {Object} doc a traveler (document or plain object)
 * @return {Object}     the record
 */
function toRecord(doc) {
  const status = effectiveStatus(doc);
  return {
    _id: doc._id,
    title: textOf(doc.title),
    status: status.name,
    statusCode: status.code,
    createdBy: textOf(doc.createdBy),
    createdOn: dateOf(doc.createdOn),
    updatedBy: textOf(doc.updatedBy),
    updatedOn: dateOf(doc.updatedOn),
    archivedOn: doc.archived === true ? dateOf(doc.archivedOn) : null,
    owner: textOf(doc.owner) || textOf(doc.createdBy),
    tags: Array.isArray(doc.tags) ? doc.tags.slice() : [],
    totalInput: countOf(doc.totalInput),
    finishedInput: countOf(doc.finishedInput),
    subsystem: textOf(doc.subsystem),
    device: textOf(doc.device) || devicesText(doc.devices),
    activity: textOf(doc.activity),
    machineArea: textOf(doc.machineArea),
    sector: textOf(doc.sector),
    windchillId: textOf(doc.windchillId),
  };
}

// MongoDB cannot match a regular expression that contains a null character, so
// a request that carries one is refused up front, with a message, rather than
// failing in the database
const NULL_CHARACTER = /\u0000/;

function checkText(value, name) {
  if (NULL_CHARACTER.test(value)) {
    throw new DataError(`${name} must not contain a null character`, 400);
  }
  return value;
}

/**
 * Read a query parameter that must be a single text value. Anything else,
 * such as the object Express builds from `subsystem[$ne]=x`, is rejected so
 * that no request can put an operator into a database query.
 * @param  {Object} query the parsed query string
 * @param  {String} name  the parameter name
 * @return {String}       the trimmed value, or '' when absent
 */
function readString(query, name) {
  const value = query[name];
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value !== 'string') {
    throw new DataError(`${name} must be a single text value`, 400);
  }
  return checkText(value, name).trim();
}

/**
 * Read a query parameter that is a list of text values, given as one
 * comma-separated string, as a repeated parameter, or both. Blanks are
 * dropped. Any non-text value is rejected, as in readString.
 * @param  {Object} query the parsed query string
 * @param  {String} name  the parameter name
 * @return {String[]}     the trimmed, non-blank values
 */
function readList(query, name) {
  const value = query[name];
  if (value === undefined || value === null) {
    return [];
  }
  const items = Array.isArray(value) ? value : [value];
  const values = [];
  items.forEach(function collect(item) {
    if (typeof item !== 'string') {
      throw new DataError(`${name} must be text or a list of text`, 400);
    }
    checkText(item, name)
      .split(',')
      .forEach(function addPart(part) {
        const trimmed = part.trim();
        if (trimmed) {
          values.push(trimmed);
        }
      });
  });
  return values;
}

/**
 * Read an optional integer query parameter. Absent or blank gives undefined;
 * anything that is not a whole number of digits is rejected.
 */
function readInteger(query, name, message) {
  const raw = readString(query, name);
  if (raw === '') {
    return undefined;
  }
  if (!/^[0-9]+$/.test(raw)) {
    throw new DataError(message, 400);
  }
  return Number(raw);
}

/**
 * Parse page and limit. A limit above the maximum is reduced to the maximum
 * (the response reports the limit applied); anything else invalid is a 400.
 * @param  {Object} query the parsed query string
 * @return {{page: Number, limit: Number, paged: Boolean}} `paged` is true
 *   when the caller supplied page or limit
 */
function parsePaging(query) {
  const page = readInteger(
    query,
    'page',
    `page must be an integer between 1 and ${MAX_PAGE}`
  );
  const limit = readInteger(
    query,
    'limit',
    'limit must be a whole number of 1 or more'
  );
  if (page !== undefined && (page < 1 || page > MAX_PAGE)) {
    throw new DataError(
      `page must be an integer between 1 and ${MAX_PAGE}`,
      400
    );
  }
  if (limit !== undefined && limit < 1) {
    throw new DataError('limit must be a whole number of 1 or more', 400);
  }
  return {
    page: page === undefined ? 1 : page,
    limit: limit === undefined ? DEFAULT_LIMIT : Math.min(limit, MAX_LIMIT),
    paged: page !== undefined || limit !== undefined,
  };
}

// filters that match partial text, ignoring case
const TEXT_FILTERS = [
  'subsystem',
  'device',
  'activity',
  'machineArea',
  'sector',
  'windchillId',
];
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;

// every status the listing can report, by code, in code order, and by name
const STATUS_CODES = [INITIALIZED_CODE]
  .concat(LIVE_STATUS_CODES)
  .concat([ARCHIVED_CODE]);
const STATUS_CODE_BY_NAME = {};
STATUS_CODES.forEach(function indexName(code) {
  STATUS_CODE_BY_NAME[statusMap[String(code)]] = code;
});

/**
 * Parse an updatedFrom or updatedTo value: a date (YYYY-MM-DD), taken as the
 * whole of that day in the server's local time zone (its start for a lower
 * bound, its last millisecond for an upper bound), or an ISO 8601 timestamp,
 * used exactly.
 * @param  {String} raw   the trimmed parameter value
 * @param  {String} bound 'from' or 'to'
 * @param  {String} name  the parameter name, for the message
 * @return {Date|null}    null when the value is blank
 */
function parseDateBound(raw, bound, name) {
  if (raw === '') {
    return null;
  }
  const message = `${name} must be a date (YYYY-MM-DD) or an ISO 8601 timestamp`;
  const dateOnly = DATE_ONLY.exec(raw);
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]) - 1;
    const day = Number(dateOnly[3]);
    const start = new Date(year, month, day);
    // reject a date that does not exist, such as 2026-02-30
    if (
      start.getFullYear() !== year ||
      start.getMonth() !== month ||
      start.getDate() !== day
    ) {
      throw new DataError(message, 400);
    }
    return bound === 'to' ? new Date(year, month, day, 23, 59, 59, 999) : start;
  }
  const date = new Date(raw);
  if (!ISO_TIMESTAMP.test(raw) || Number.isNaN(date.getTime())) {
    throw new DataError(message, 400);
  }
  return date;
}

function parseTextFilters(query) {
  const filters = {};
  TEXT_FILTERS.forEach(function read(name) {
    const value = readString(query, name);
    if (value.length > MAX_TEXT_LENGTH) {
      throw new DataError(
        `${name} must be at most ${MAX_TEXT_LENGTH} characters`,
        400
      );
    }
    if (value) {
      filters[name] = value;
    }
  });
  return filters;
}

function parseTags(query) {
  const seen = new Set();
  const tags = [];
  readList(query, 'tags').forEach(function add(tag) {
    if (tag.length > MAX_TEXT_LENGTH) {
      throw new DataError(
        `each tag must be at most ${MAX_TEXT_LENGTH} characters`,
        400
      );
    }
    const key = tag.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      tags.push(tag);
    }
  });
  return tags;
}

/**
 * Parse the status filter: names (any case) or codes, comma-separated or
 * repeated, into a list of distinct codes.
 */
function parseStatuses(query) {
  const codes = [];
  readList(query, 'status').forEach(function add(value) {
    const normalized = value.toLowerCase().replace(/\s+/g, ' ');
    let code;
    if (Object.prototype.hasOwnProperty.call(STATUS_CODE_BY_NAME, normalized)) {
      code = STATUS_CODE_BY_NAME[normalized];
    } else if (/^[0-9]+(\.[0-9]+)?$/.test(normalized)) {
      code = Number(normalized);
    }
    if (STATUS_CODES.indexOf(code) === -1) {
      throw new DataError(
        `unknown status "${value.slice(0, 50)}"; use one of: ${STATUS_CODES.map(
          function name(c) {
            return statusMap[String(c)];
          }
        ).join(', ')} (or codes ${STATUS_CODES.join(', ')})`,
        400
      );
    }
    if (codes.indexOf(code) === -1) {
      codes.push(code);
    }
  });
  return codes;
}

function parseFormat(query) {
  const raw = readString(query, 'format').toLowerCase();
  if (raw === '' || raw === 'json') {
    return 'json';
  }
  if (raw === 'csv') {
    return 'csv';
  }
  throw new DataError('format must be json or csv', 400);
}

function parseIncludeArchived(query) {
  const raw = readString(query, 'includeArchived').toLowerCase();
  if (raw === '' || raw === 'false' || raw === '0') {
    return false;
  }
  if (raw === 'true' || raw === '1') {
    return true;
  }
  throw new DataError('includeArchived must be true or false', 400);
}

/**
 * Parse and validate a listing request's query string.
 * @param  {Object} query the parsed query string (req.query)
 * @return {Object}       params for buildItemsPipeline, buildCountsPipeline,
 *   and list; throws DataError (status 400) for an invalid request.
 *   `includeArchived` is the effective value: the option, or a status filter
 *   that asks for archived travelers.
 */
function parseListQuery(query) {
  const source = query || {};
  const paging = parsePaging(source);
  const updatedFrom = parseDateBound(
    readString(source, 'updatedFrom'),
    'from',
    'updatedFrom'
  );
  const updatedTo = parseDateBound(
    readString(source, 'updatedTo'),
    'to',
    'updatedTo'
  );
  if (updatedFrom && updatedTo && updatedFrom.getTime() > updatedTo.getTime()) {
    throw new DataError('updatedFrom must not be after updatedTo', 400);
  }
  const statuses = parseStatuses(source);
  return {
    format: parseFormat(source),
    page: paging.page,
    limit: paging.limit,
    paged: paging.paged,
    updatedFrom,
    updatedTo,
    textFilters: parseTextFilters(source),
    tags: parseTags(source),
    statuses,
    includeArchived:
      parseIncludeArchived(source) || statuses.indexOf(ARCHIVED_CODE) !== -1,
  };
}

/**
 * The record fields read from a traveler. Nothing else is projected, so the
 * large embedded arrays (forms, data, and so on) never leave the database.
 */
const RECORD_FIELDS = [
  'title',
  'status',
  'archived',
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
  'devices',
  'activity',
  'machineArea',
  'sector',
  'windchillId',
];

/**
 * The condition for one text filter: partial text, ignoring case, taken
 * literally. The device filter also looks in the older `devices` list, but
 * only for a traveler with no device of its own, since that is the only case
 * in which the list is what the record shows as its device.
 * @param  {String} name  a name in TEXT_FILTERS
 * @param  {String} value the text to look for
 * @return {Object}       a match condition
 */
function buildTextCondition(name, value) {
  const pattern = { $regex: _.escapeRegExp(value), $options: 'i' };
  if (name !== 'device') {
    return { [name]: pattern };
  }
  return {
    $or: [
      { device: pattern },
      { device: { $in: [null, ''] }, devices: pattern },
    ],
  };
}

/**
 * The update-time range as a match on the raw fields: a traveler nobody has
 * edited has no updatedOn, so its creation time stands in for it, as in the
 * sort. Either bound may be missing; both are inclusive.
 * @param  {Date} [from] the earliest time, if any
 * @param  {Date} [to]   the latest time, if any
 * @return {Object|null} a match condition, or null with no bounds
 */
function buildRangeMatch(from, to) {
  if (!from && !to) {
    return null;
  }
  function bounds() {
    const range = {};
    if (from) {
      range.$gte = from;
    }
    if (to) {
      range.$lte = to;
    }
    return range;
  }
  // { updatedOn: null } matches a document with no updatedOn
  return {
    $or: [{ updatedOn: bounds() }, { updatedOn: null, createdOn: bounds() }],
  };
}

/**
 * The conditions every listing shares: the public tier, which no request can
 * change, and the archived exclusion unless archived travelers are included.
 * Conditions sit under $and so that any $or inside one cannot collide with
 * another.
 * @param  {Object} params from parseListQuery
 * @return {Object}        a $match expression
 */
function buildBaseMatch(params) {
  const conditions = [reqUtils.publicAccessMatch()];
  if (!params.includeArchived) {
    conditions.push({ archived: { $ne: true } });
    conditions.push({ status: { $ne: ARCHIVED_CODE } });
  }
  const range = buildRangeMatch(params.updatedFrom, params.updatedTo);
  if (range) {
    conditions.push(range);
  }
  const textFilters = params.textFilters || {};
  TEXT_FILTERS.forEach(function add(name) {
    if (textFilters[name]) {
      conditions.push(buildTextCondition(name, textFilters[name]));
    }
  });
  (params.tags || []).forEach(function add(tag) {
    conditions.push({
      tags: { $regex: `^${_.escapeRegExp(tag)}$`, $options: 'i' },
    });
  });
  return { $and: conditions };
}

/**
 * The status selection as a match on the raw fields, so that it agrees with
 * effectiveStatus: an archived traveler counts only as archived, and a
 * missing or unrecognized status counts as initialized.
 * @param  {Number[]} [codes] the requested status codes
 * @return {Object|null}      a match condition, or null when none requested
 */
function buildStatusMatch(codes) {
  if (!codes || codes.length === 0) {
    return null;
  }
  const parts = [];
  const live = codes.filter(function isLive(code) {
    return LIVE_STATUS_CODES.indexOf(code) !== -1;
  });
  if (live.length > 0) {
    parts.push({ archived: { $ne: true }, status: { $in: live } });
  }
  if (codes.indexOf(INITIALIZED_CODE) !== -1) {
    parts.push({
      archived: { $ne: true },
      status: { $nin: LIVE_STATUS_CODES.concat([ARCHIVED_CODE]) },
    });
  }
  if (codes.indexOf(ARCHIVED_CODE) !== -1) {
    parts.push({ $or: [{ archived: true }, { status: ARCHIVED_CODE }] });
  }
  return parts.length === 1 ? parts[0] : { $or: parts };
}

/**
 * The match for the items pipeline: the shared conditions plus the status
 * selection, which the counts pipeline must not apply.
 * @param  {Object} params from parseListQuery
 * @return {Object}        a $match expression
 */
function buildItemsMatch(params) {
  const base = buildBaseMatch(params);
  const status = buildStatusMatch(params.statuses);
  if (!status) {
    return base;
  }
  return { $and: base.$and.concat([status]) };
}

/**
 * The pipeline for one page (or, when params.paged is false, every match) of
 * travelers, newest update first. A traveler nobody has edited has no
 * updatedOn, so it sorts by its creation time. Ties fall back to _id so paging
 * never repeats or skips a traveler. Fields are projected before the sort so
 * the sort works on small documents.
 * @param  {Object} params from parseListQuery
 * @return {Object[]}      the aggregation pipeline
 */
function buildItemsPipeline(params) {
  const project = { _sortKey: { $ifNull: ['$updatedOn', '$createdOn'] } };
  RECORD_FIELDS.forEach(function include(field) {
    project[field] = 1;
  });
  const pipeline = [
    { $match: buildItemsMatch(params) },
    { $project: project },
    { $sort: { _sortKey: -1, _id: -1 } },
  ];
  if (params.paged !== false) {
    const skip = (params.page - 1) * params.limit;
    if (skip > 0) {
      pipeline.push({ $skip: skip });
    }
    pipeline.push({ $limit: params.limit });
  }
  return pipeline;
}

/**
 * The expression a traveler is counted under: 4 when archived (flag set, or
 * status 4), else its stored status when it is one of 1, 1.5, 2, 3, else 0.
 * Keep in step with effectiveStatus.
 */
function effectiveStatusExpression() {
  return {
    $cond: [
      {
        $or: [
          { $eq: ['$archived', true] },
          { $eq: ['$status', ARCHIVED_CODE] },
        ],
      },
      ARCHIVED_CODE,
      {
        $cond: [
          { $in: ['$status', LIVE_STATUS_CODES.slice()] },
          '$status',
          INITIALIZED_CODE,
        ],
      },
    ],
  };
}

/**
 * The pipeline that counts travelers per effective status for every filter
 * except the status filter, so a client can show every status total while one
 * status is selected.
 * @param  {Object} params from parseListQuery
 * @return {Object[]}      the aggregation pipeline
 */
function buildCountsPipeline(params) {
  return [
    { $match: buildBaseMatch(params) },
    { $group: { _id: effectiveStatusExpression(), n: { $sum: 1 } } },
  ];
}

/**
 * Turn the counts pipeline's rows into the response's total and statusCounts.
 * @param  {Object[]} groupRows       rows of {_id: status code, n: count}
 * @param  {Number[]} statuses        the requested status codes; none means all
 * @param  {Boolean}  includeArchived whether archived travelers are included
 * @return {{total: Number, statusCounts: Object}} `statusCounts` is keyed by
 *   status name, with 0 for a status nobody has; the archived key is present
 *   only when archived travelers are included
 */
function summarizeCounts(groupRows, statuses, includeArchived) {
  const codes = LIVE_STATUS_CODES.slice();
  codes.unshift(INITIALIZED_CODE);
  if (includeArchived) {
    codes.push(ARCHIVED_CODE);
  }
  const countByCode = {};
  codes.forEach(function zero(code) {
    countByCode[code] = 0;
  });
  (groupRows || []).forEach(function add(row) {
    if (Object.prototype.hasOwnProperty.call(countByCode, row._id)) {
      countByCode[row._id] += row.n;
    }
  });
  const counted = statuses && statuses.length > 0 ? statuses : codes;
  let total = 0;
  counted.forEach(function sum(code) {
    total += countByCode[code] || 0;
  });
  const statusCounts = {};
  codes.forEach(function name(code) {
    statusCounts[statusMap[String(code)]] = countByCode[code];
  });
  return { total, statusCounts };
}

/**
 * List public travelers. Only reads: the Traveler model is used through
 * aggregate, never to save or update.
 * @param  {Model}  Traveler the Traveler model (or a fake with aggregate)
 * @param  {Object} params   from parseListQuery
 * @return {Promise<Object>} {travelers, page, limit, total, statusCounts}
 */
function list(Traveler, params) {
  const items = Traveler.aggregate(buildItemsPipeline(params)).allowDiskUse(
    true
  );
  const counts = Traveler.aggregate(buildCountsPipeline(params)).allowDiskUse(
    true
  );
  return Promise.all([items.exec(), counts.exec()]).then(function assemble(
    results
  ) {
    const summary = summarizeCounts(
      results[1],
      params.statuses,
      params.includeArchived
    );
    return {
      travelers: results[0].map(toRecord),
      page: params.page,
      limit: params.limit,
      total: summary.total,
      statusCounts: summary.statusCounts,
    };
  });
}

/**
 * The CSV columns, in order: the identifier, then the properties. The header
 * row uses these names, which are also the JSON keys.
 */
const CSV_COLUMNS = csv.RECORD_COLUMNS.slice();

/**
 * Render records as CSV: a header row, then one row per record. Tags are
 * joined with semicolons and dates are ISO 8601 UTC. Text is escaped as RFC
 * 4180 asks and neutralized against spreadsheet formulas. There is no
 * trailing newline, as in the traveler export. No records gives the header
 * row only.
 * @param  {Object[]} records the records from toRecord
 * @param  {Object}  [options]
 * @param  {Boolean} [options.bom] start with a UTF-8 byte order mark, so that a
 *   spreadsheet application reads international characters correctly
 * @return {String}
 */
function toCsv(records, options) {
  const settings = options || {};
  const lines = [csv.toCsvRow(CSV_COLUMNS)];
  records.forEach(function addRow(record) {
    lines.push(
      csv.toSafeCsvRow(
        CSV_COLUMNS.map(function cell(column) {
          return csv.recordCell(record, column);
        })
      )
    );
  });
  return (settings.bom ? '\uFEFF' : '') + lines.join('\n');
}

function sendCsv(res, records, settings) {
  const stamp = new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '');
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set(
    'Content-Disposition',
    `attachment; filename="public-travelers-${stamp}.csv"`
  );
  return res.status(200).send(toCsv(records, settings));
}

function sendError(res, err) {
  if (err instanceof DataError) {
    return res.status(err.status).json({ error: err.message });
  }
  logger.error(err);
  return res.status(500).json({ error: 'internal error' });
}

/**
 * An Express handler for a listing route. It is mounted once on the web app
 * and once on the REST API, so both give the same data.
 * @param  {Model}  Traveler the Traveler model
 * @param  {Object} [options]
 * @param  {Boolean} [options.bom] start CSV output with a UTF-8 byte order mark
 *   (for the web app, whose downloads are opened in a spreadsheet application)
 * @return {Function}         the handler (req, res)
 */
function listHandler(Traveler, options) {
  const settings = options || {};
  return function handleList(req, res) {
    let params;
    try {
      params = parseListQuery(req.query);
    } catch (err) {
      return sendError(res, err);
    }
    const asCsv = params.format === 'csv';
    // JSON is always paged; CSV returns every match unless page or limit is given
    if (!asCsv) {
      params.paged = true;
    }
    return list(Traveler, params)
      .then(function respond(result) {
        if (asCsv) {
          return sendCsv(res, result.travelers, settings);
        }
        return res.status(200).json(result);
      })
      .catch(function fail(err) {
        return sendError(res, err);
      });
  };
}

module.exports = {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  MAX_PAGE,
  MAX_TEXT_LENGTH,
  RECORD_FIELDS,
  effectiveStatus,
  toRecord,
  readString,
  readList,
  parsePaging,
  parseDateBound,
  parseListQuery,
  buildBaseMatch,
  buildStatusMatch,
  buildItemsPipeline,
  buildCountsPipeline,
  summarizeCounts,
  CSV_COLUMNS,
  toCsv,
  list,
  listHandler,
};
