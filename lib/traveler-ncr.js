/**
 * The rules that tie a traveler's inputs to the NCRs raised against them
 * (spec 124-traveler-input-ncr-gating).
 *
 * Every rule of that feature lives here so that no rule exists only in the UI
 * or in one route: routes, `lib/ncr-service.js`, `lib/traveler.js` and
 * `routes/api.js` all call into this module and none re-implements a rule.
 *
 * Dependency direction: this module depends on `utilities/routes.js` (for the
 * active-form label lookup it shares with `resetTouched`), never the reverse.
 * Models are `require`d lazily inside the functions that need them, so loading
 * this module has no side effects and `lib/ncr-service.js` (and its unit-test
 * stubbing order) is unaffected by requiring it.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const REFERENCE_SEPARATOR = '::';
const MAX_REFERENCE_LENGTH = 256;
// Exactly 24 hex characters. Deliberately not mongoose.isValidObjectId(),
// which also accepts any 12-character string and would then fail a query.
const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;
const BAD_REFERENCE_MESSAGE = 'Enter the reference as traveler_id::input_name.';

const HTTP_ERROR_LABEL = {
  400: 'Validation Error',
  404: 'Not Found',
  409: 'Conflict',
};

/**
 * A rule refusal that maps onto an HTTP response.
 * @param {String} code    machine-readable code, e.g. 'OPEN_NCRS'
 * @param {Number} status  the HTTP status to answer with (400, 404, 409)
 * @param {String} message the human-readable reason shown to the user
 * @param {Object} extra   more fields for the response body (e.g. open_ncrs)
 */
class TravelerNcrError extends Error {
  constructor(code, status, message, extra = {}) {
    super(message);
    this.name = 'TravelerNcrError';
    this.code = code;
    this.status = status;
    this.extra = extra;
  }
}

/**
 * The JSON body to answer a TravelerNcrError with, in the same
 * `{success, error, message}` shape the NCR API already uses.
 * @param  {TravelerNcrError} err
 * @return {Object}
 */
function errorBody(err) {
  return {
    success: false,
    error: HTTP_ERROR_LABEL[err.status] || 'Error',
    code: err.code,
    message: err.message,
    ...err.extra,
  };
}

/**
 * The display name of a traveler status, from the model's own status map
 * (e.g. 1 -> 'active', 1.5 -> 'submitted for completion').
 * @param  {Number} status
 * @return {String}
 */
function statusLabel(status) {
  const { statusMap } = require('../model/traveler');
  return statusMap[String(status)] || String(status);
}

function badReference() {
  return new TravelerNcrError('BAD_REFERENCE', 400, BAD_REFERENCE_MESSAGE);
}

/**
 * The reference that identifies one input on one traveler, in the form a user
 * copies from the traveler and pastes into the NCR form.
 * @param  {String} travelerId the traveler's id
 * @param  {String} inputName  the input's name (unique within the traveler)
 * @return {String}            `traveler_id::input_name`
 */
function formatInputRef(travelerId, inputName) {
  return `${travelerId}${REFERENCE_SEPARATOR}${inputName}`;
}

/**
 * Splits a reference into its traveler id and input name.
 *
 * Leading and trailing whitespace is ignored (copy and paste often adds some),
 * and the split is at the FIRST `::` only, so an input name may itself contain
 * `::`. The traveler id must be a real 24-hex ObjectId so that it can never
 * cause a CastError further down.
 *
 * @param  {String} ref the reference
 * @return {{travelerId: String, inputName: String}}
 * @throws {TravelerNcrError} BAD_REFERENCE (400) when it is not a reference
 */
function parseInputRef(ref) {
  if (typeof ref !== 'string') {
    throw badReference();
  }
  const trimmed = ref.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_REFERENCE_LENGTH) {
    throw badReference();
  }
  const at = trimmed.indexOf(REFERENCE_SEPARATOR);
  if (at === -1) {
    throw badReference();
  }
  const travelerId = trimmed.slice(0, at);
  const inputName = trimmed.slice(at + REFERENCE_SEPARATOR.length);
  if (!OBJECT_ID_PATTERN.test(travelerId) || inputName.length === 0) {
    throw badReference();
  }
  return { travelerId, inputName };
}

/**
 * Resolves a reference to a traveler input the caller may link an NCR to.
 *
 * The checks run in a fixed order, and the order matters for what an answer
 * reveals: parse -> the traveler exists AND the caller can read it -> the input
 * is on the traveler's active form -> the traveler is active. A traveler the caller cannot read is
 * answered exactly like one that does not exist, so a traveler's existence is
 * never disclosed; only after the read check passes may a message name the
 * traveler's title.
 *
 * The label comes from the traveler's own form labels, never from the client.
 * A checkbox inside a checkbox set stores an empty label, so the input name
 * stands in (the traveler page already does the same).
 *
 * @param  {Object} req the request (its session decides read access)
 * @param  {String} ref the reference, `traveler_id::input_name`
 * @return {Promise<{traveler: Object, travelerId: String, inputName: String, inputLabel: String}>}
 * @throws {TravelerNcrError} BAD_REFERENCE 400, TRAVELER_NOT_FOUND 404,
 *                            INPUT_NOT_FOUND 404, TRAVELER_NOT_ACTIVE 409
 */
async function resolveInputRef(req, ref) {
  const { travelerId, inputName } = parseInputRef(ref);

  const Traveler = mongoose.model('Traveler');
  const reqUtils = require('./req-utils');
  const traveler = await Traveler.findById(travelerId);
  if (!traveler || !reqUtils.canRead(req, traveler)) {
    throw new TravelerNcrError(
      'TRAVELER_NOT_FOUND',
      404,
      'No traveler matches this reference.'
    );
  }

  const labels = require('../utilities/routes').traveler.activeFormLabels(
    traveler
  );
  if (!Object.hasOwn(labels, inputName)) {
    throw new TravelerNcrError(
      'INPUT_NOT_FOUND',
      404,
      `Traveler "${traveler.title}" has no input named "${inputName}".`
    );
  }

  // Last, so that nothing about a traveler's status is revealed to a caller who
  // cannot read it, and a missing input is reported as such. The status that
  // counts is the one at THIS moment — a form opened while the traveler was
  // active is still refused if it has since been submitted (spec FR-012).
  if (traveler.status !== 1) {
    throw new TravelerNcrError(
      'TRAVELER_NOT_ACTIVE',
      409,
      `Traveler "${traveler.title}" is ${statusLabel(
        traveler.status
      )}; an NCR can only be initiated against an active traveler.`
    );
  }

  return {
    traveler,
    travelerId: String(traveler._id),
    inputName,
    inputLabel: labels[inputName] || inputName,
  };
}

/**
 * Whether a status change puts a traveler forward for completion approval:
 * submitting it (target 1.5), or completing it straight from active (1 -> 2,
 * a route the legacy API helper allows and which would otherwise skip
 * submission). Approval itself (1.5 -> 2), sending it back (1.5 -> 1), freezing
 * and archiving are not submissions, and neither is a request that leaves the
 * status unchanged.
 *
 * The open-NCR rule is enforced at submission only — and deliberately NOT again
 * at approval: an NCR can only be initiated against an active traveler
 * (resolveInputRef), so none can be opened once a traveler has been submitted.
 *
 * @param  {Number} current the traveler's current status
 * @param  {Number} target  the status being requested
 * @return {Boolean}
 */
function isSubmissionTransition(current, target) {
  if (current === target) {
    return false; // not a change of status at all (e.g. a plain title update)
  }
  return target === 1.5 || (target === 2 && current === 1);
}

/** The selector for a traveler's linked NCRs that are not yet Closed. */
function openNcrFilter(travelerId) {
  return {
    'traveler_link.traveler_id': travelerId,
    'traveler_link.initiated_from_traveler': true,
    status: { $ne: 'Closed' },
  };
}

/**
 * The NCRs linked to any input of a traveler that are not yet Closed. "Linked"
 * is the same selector GET /travelers/:id/ncr-links/ uses.
 * @param  {String|ObjectId} travelerId
 * @return {Promise<Array>} lean NCR documents
 */
async function findOpenNcrs(travelerId) {
  const { Ncr } = require('../model/ncr');
  return Ncr.find(openNcrFilter(travelerId), {
    ncr_number: 1,
    status: 1,
    'traveler_link.input_name': 1,
    'traveler_link.input_label': 1,
  }).lean();
}

/**
 * Refuses when any NCR linked to the traveler is not Closed. Applies to every
 * role — there is no override — and lists each open NCR so the user knows what
 * to resolve.
 * @param  {String|ObjectId} travelerId
 * @throws {TravelerNcrError} OPEN_NCRS (409) with `extra.open_ncrs`
 */
async function assertNoOpenNcrs(travelerId) {
  const rows = await findOpenNcrs(travelerId);
  if (rows.length === 0) {
    return;
  }
  const openNcrs = rows
    .map(row => ({
      ncr_id: String(row._id),
      ncr_number: row.ncr_number,
      status: row.status,
      // a legacy link may carry no input: it blocks the traveler but no input
      input_name: (row.traveler_link && row.traveler_link.input_name) || null,
      input_label: (row.traveler_link && row.traveler_link.input_label) || null,
    }))
    .sort((a, b) => String(a.ncr_number).localeCompare(String(b.ncr_number)));
  const n = openNcrs.length;
  throw new TravelerNcrError(
    'OPEN_NCRS',
    409,
    `This traveler cannot be submitted for completion approval while ${n} linked NCR${
      n === 1 ? ' is' : 's are'
    } not Closed.`,
    { open_ncrs: openNcrs }
  );
}

/**
 * The names of the inputs that have at least one open linked NCR — the inputs
 * that must not count as finished (spec 124). A legacy link with no input name
 * blocks the traveler's submission but no input, so empty names are dropped.
 * @param  {String|ObjectId} travelerId
 * @return {Promise<Array<String>>}
 */
async function openNcrInputNames(travelerId) {
  const { Ncr } = require('../model/ncr');
  const names = await Ncr.distinct(
    'traveler_link.input_name',
    openNcrFilter(travelerId)
  );
  return names.filter(Boolean);
}

/**
 * Recounts a traveler's stored finishedInput after an NCR linked to it was
 * created, closed or deleted — the three events that change whether an input
 * has an open NCR. The stored figure is what traveler lists and binders read,
 * so recounting only the traveler page would leave them wrong.
 *
 * Only `finishedInput` is set, and it is saved with `doc.save()` — both on
 * purpose:
 *  - The Traveler post-save hook re-rolls binder progress only for a save() that
 *    modified `finishedInput`; Model.updateOne would skip it and leave binders
 *    stale.
 *  - A scalar-only change is sent as a plain $set and does not bump the array
 *    version, so it cannot collide with a concurrent per-field save (which
 *    modifies `data`).
 * `updatedBy`/`updatedOn` are left alone: this is a recount, not a user edit.
 *
 * @param  {String|ObjectId} travelerId
 * @return {Promise<void>}
 */
async function refreshTravelerProgress(travelerId) {
  const Traveler = mongoose.model('Traveler');
  const traveler = await Traveler.findById(travelerId);
  if (!traveler) {
    return;
  }
  const routesUtilities = require('../utilities/routes');
  const finished = routesUtilities.traveler.finishedCount(
    traveler.touchedInputs || [],
    await openNcrInputNames(travelerId)
  );
  if (traveler.finishedInput === finished) {
    return;
  }
  traveler.finishedInput = finished;
  await traveler.save();
}

// A failure of the closure-PDF step that carries a message safe to show the
// user (never a path, a stack or a database error).
class AttachFailure extends Error {}

const ATTACH_FAILED_GENERIC = 'The PDF could not be attached.';

function logger() {
  return require('./loggers').getLogger();
}

/** Runs a step; any error becomes an AttachFailure with the given safe message. */
async function guarded(safeMessage, step) {
  try {
    return await step();
  } catch (err) {
    if (err instanceof AttachFailure) {
      throw err;
    }
    logger().error(`${safeMessage} (${err && err.message})`);
    throw new AttachFailure(safeMessage);
  }
}

function removeFile(filePath) {
  if (!filePath) {
    return Promise.resolve();
  }
  return fs.promises.unlink(filePath).catch(() => {});
}

/** Appends a system event to the NCR and saves; a failure here is only logged. */
async function logAttachEvent(ncr, eventType, payload) {
  try {
    ncr.events.push({
      event_type: eventType,
      actor_type: 'system',
      timestamp: new Date(),
      payload,
    });
    await ncr.save();
  } catch (err) {
    logger().error(
      `Could not record ${eventType} on NCR ${ncr.ncr_number}: ${err.message}`
    );
  }
}

/**
 * When an NCR that is linked to a traveler input is closed, produces a PDF of it
 * and attaches it to that input (spec 124 FR-022..FR-029).
 *
 * This runs AFTER the closure has been saved and is best effort: it can never
 * throw, and a failure never undoes or blocks the closure. Every failure is
 * recorded on the NCR as a `traveler.pdf_failed` event carrying a short, safe
 * reason, and returned so the person closing the NCR can be told.
 *
 * It works whatever the traveler's status is at that moment: it writes to the
 * traveler-side TravelerNcrPdf collection, not through any traveler status guard.
 *
 * The PDF is built from the NCR as saved, so it includes the `ncr.closed` and
 * final-distribution events but not its own attach event. Attaching is
 * idempotent: a second call for the same NCR finds the record the unique
 * (traveler, ncr_id) index protects and reports it, without a second file.
 *
 * @param  {Object} ncr  the closed NCR (a Mongoose document)
 * @param  {Object} user the user who closed it ({id, name})
 * @param  {Object} [options]
 * @param  {String} [options.uploadDir] where to write the PDF (default: the app's upload path)
 * @return {Promise<{status: 'attached', pdfId: String}
 *                 |{status: 'failed', message: String}
 *                 |{status: 'not_applicable'}>}
 */
async function attachClosurePdf(ncr, user, { uploadDir } = {}) {
  const link = ncr.traveler_link;
  if (!(link && link.traveler_id && link.initiated_from_traveler === true)) {
    return { status: 'not_applicable' };
  }
  const travelerId = String(link.traveler_id);
  const eventBase = { traveler_id: travelerId, input_name: link.input_name };
  let filePath = null;

  try {
    const traveler = await mongoose
      .model('Traveler')
      .findById(link.traveler_id);
    if (!traveler) {
      throw new AttachFailure(
        'The traveler this NCR was linked to no longer exists.'
      );
    }
    const labels = require('../utilities/routes').traveler.activeFormLabels(
      traveler
    );
    if (!Object.hasOwn(labels, link.input_name)) {
      throw new AttachFailure(
        "That input is no longer on the traveler's form."
      );
    }

    const ncrPdf = require('./ncr-pdf');
    const pdf = await guarded('The PDF could not be generated.', () =>
      ncrPdf.renderNcrPdf(
        ncrPdf.buildNcrPdfModel(ncr, { travelerTitle: traveler.title })
      )
    );

    const dir = uploadDir || require('../config/config').uploadPath;
    filePath = path.join(dir, `ncr-closure-${crypto.randomUUID()}.pdf`);
    const fileName = `${ncr.ncr_number}.pdf`;

    const TravelerNcrPdf = mongoose.model('TravelerNcrPdf');
    const record = await guarded('The PDF could not be stored.', async () => {
      await fs.promises.writeFile(filePath, pdf, { flag: 'wx' });
      try {
        return await TravelerNcrPdf.create({
          traveler: travelerId,
          input_name: link.input_name,
          ncr_id: ncr._id,
          ncr_number: ncr.ncr_number,
          file_name: fileName,
          file: {
            path: filePath,
            mimetype: 'application/pdf',
            size: pdf.length,
          },
          generatedOn: new Date(),
          generatedBy: user && user.id,
        });
      } catch (err) {
        if (!(err && err.code === 11000)) {
          throw err;
        }
        // already attached (a retry, or a duplicate call): report that record
        // rather than a second file
        const existing = await TravelerNcrPdf.findOne({
          traveler: travelerId,
          ncr_id: ncr._id,
        }).lean();
        if (!existing) {
          throw err;
        }
        await removeFile(filePath);
        filePath = null;
        return { _id: existing._id, alreadyAttached: true };
      }
    });

    if (record.alreadyAttached) {
      return { status: 'attached', pdfId: String(record._id) };
    }
    await logAttachEvent(ncr, 'traveler.pdf_attached', {
      ...eventBase,
      pdf_id: String(record._id),
      file_name: fileName,
    });
    return { status: 'attached', pdfId: String(record._id) };
  } catch (err) {
    let message = ATTACH_FAILED_GENERIC;
    if (err instanceof AttachFailure) {
      message = err.message;
    } else {
      logger().error(
        `Attaching the closure PDF of NCR ${ncr.ncr_number} failed: ${err &&
          err.message}`
      );
    }
    await removeFile(filePath);
    await logAttachEvent(ncr, 'traveler.pdf_failed', {
      ...eventBase,
      reason: message,
    });
    return { status: 'failed', message };
  }
}

module.exports = {
  TravelerNcrError,
  errorBody,
  statusLabel,
  formatInputRef,
  parseInputRef,
  resolveInputRef,
  isSubmissionTransition,
  findOpenNcrs,
  assertNoOpenNcrs,
  openNcrInputNames,
  refreshTravelerProgress,
  attachClosurePdf,
};
