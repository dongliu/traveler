const mongoose = require('mongoose');
const sinon = require('sinon');
const { expect } = require('chai');

process.env.TRAVELER_CONFIG_REL_PATH = 'docker';

// model/traveler.js -> model/review.js registers against `User` at require
// time, so make sure it exists whichever test file mocha loads first.
if (!mongoose.modelNames().includes('User')) {
  mongoose.model(
    'User',
    new mongoose.Schema({
      _id: String,
      name: String,
      email: String,
      roles: [String],
    })
  );
}
if (!mongoose.modelNames().includes('Group')) {
  mongoose.model(
    'Group',
    new mongoose.Schema({
      _id: String,
      members: [{ type: String, ref: 'User' }],
    })
  );
}

const { Ncr } = require('../../model/ncr');
const travelerNcr = require('../../lib/traveler-ncr');
const { TravelerNcrError, errorBody, statusLabel } = travelerNcr;

// ── helpers ──────────────────────────────────────────────────────────────────

const TRAVELER_ID = '507f1f77bcf86cd799439011';

/** A fake traveler document with one form, enough for the rules that read it. */
function makeTraveler(overrides = {}) {
  return {
    _id: TRAVELER_ID,
    title: 'Cryomodule 7',
    status: 1,
    forms: [{ labels: { field_1: 'Field One', field_2: 'Field Two' } }],
    ...overrides,
  };
}

function makeReq(overrides = {}) {
  return { session: { userid: 'user1', memberOf: [] }, ...overrides };
}

// ── shared shell ─────────────────────────────────────────────────────────────

describe('lib/traveler-ncr — shell', () => {
  describe('TravelerNcrError', () => {
    it('carries a code, an HTTP status, a message and extra fields', () => {
      const err = new TravelerNcrError('OPEN_NCRS', 409, 'blocked', {
        open_ncrs: [1],
      });
      expect(err).to.be.instanceOf(Error);
      expect(err.name).to.equal('TravelerNcrError');
      expect(err.code).to.equal('OPEN_NCRS');
      expect(err.status).to.equal(409);
      expect(err.message).to.equal('blocked');
      expect(err.extra).to.deep.equal({ open_ncrs: [1] });
    });

    it('defaults extra to an empty object', () => {
      expect(new TravelerNcrError('X', 400, 'm').extra).to.deep.equal({});
    });
  });

  describe('errorBody', () => {
    it('maps 400, 404 and 409 to the NCR API error labels', () => {
      expect(errorBody(new TravelerNcrError('A', 400, 'm')).error).to.equal(
        'Validation Error'
      );
      expect(errorBody(new TravelerNcrError('A', 404, 'm')).error).to.equal(
        'Not Found'
      );
      expect(errorBody(new TravelerNcrError('A', 409, 'm')).error).to.equal(
        'Conflict'
      );
    });

    it('produces {success:false, error, code, message} and merges extra', () => {
      const body = errorBody(
        new TravelerNcrError('OPEN_NCRS', 409, 'blocked', {
          open_ncrs: [{ ncr_number: 'N1' }],
        })
      );
      expect(body).to.deep.equal({
        success: false,
        error: 'Conflict',
        code: 'OPEN_NCRS',
        message: 'blocked',
        open_ncrs: [{ ncr_number: 'N1' }],
      });
    });

    it('falls back to a generic label for an unmapped status', () => {
      expect(errorBody(new TravelerNcrError('A', 418, 'm')).error).to.equal(
        'Error'
      );
    });
  });

  describe('statusLabel', () => {
    it('names each traveler status from the model status map', () => {
      expect(statusLabel(0)).to.equal('initialized');
      expect(statusLabel(1)).to.equal('active');
      expect(statusLabel(1.5)).to.equal('submitted for completion');
      expect(statusLabel(2)).to.equal('completed');
      expect(statusLabel(3)).to.equal('frozen');
      expect(statusLabel(4)).to.equal('archived');
    });

    it('falls back to the raw value for an unknown status', () => {
      expect(statusLabel(9)).to.equal('9');
    });
  });
});

// A private sandbox: `sinon.restore()` would also restore the module-level
// stubs test-unit/lib/ncr-service.test.js installs on the default sandbox.
const sandbox = sinon.createSandbox();

/** Resolves to the error a promise rejects with; fails if it does not reject. */
async function rejection(promise) {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  throw new Error('expected the promise to reject');
}

// ── input references ─────────────────────────────────────────────────────────

describe('lib/traveler-ncr — input references', () => {
  const BAD_MESSAGE = 'Enter the reference as traveler_id::input_name.';

  describe('formatInputRef', () => {
    it('joins the traveler id and the input name with ::', () => {
      expect(travelerNcr.formatInputRef(TRAVELER_ID, 'field_1')).to.equal(
        `${TRAVELER_ID}::field_1`
      );
    });
  });

  describe('parseInputRef', () => {
    it('returns the traveler id and the input name', () => {
      expect(
        travelerNcr.parseInputRef(`${TRAVELER_ID}::field_1`)
      ).to.deep.equal({
        travelerId: TRAVELER_ID,
        inputName: 'field_1',
      });
    });

    it('ignores leading and trailing whitespace, including line breaks from copy and paste', () => {
      expect(
        travelerNcr.parseInputRef(`  \n${TRAVELER_ID}::field_1 \r\n`)
      ).to.deep.equal({
        travelerId: TRAVELER_ID,
        inputName: 'field_1',
      });
    });

    it('splits at the first :: only, so an input name may itself contain ::', () => {
      expect(travelerNcr.parseInputRef(`${TRAVELER_ID}::a::b`)).to.deep.equal({
        travelerId: TRAVELER_ID,
        inputName: 'a::b',
      });
    });

    const malformed = {
      undefined: undefined,
      null: null,
      'a number': 123,
      'an object': {},
      'an empty string': '',
      'only whitespace': '   ',
      'no separator': `${TRAVELER_ID}field_1`,
      'a single colon': `${TRAVELER_ID}:field_1`,
      'no traveler id': '::field_1',
      'no input name': `${TRAVELER_ID}::`,
      'a blank input name (trimmed away)': `${TRAVELER_ID}::   `,
      'a short traveler id': 'abc::field_1',
      'a 24-character id that is not hex': 'zzzzzzzzzzzzzzzzzzzzzzzz::field_1',
      // mongoose.isValidObjectId() accepts any 12-character string, so this
      // would slip through a naive check and then fail a query.
      'a 12-character traveler id': 'abcdefghijkl::field_1',
      'more than 256 characters': `${TRAVELER_ID}::${'x'.repeat(260)}`,
    };
    Object.keys(malformed).forEach(label => {
      it(`rejects ${label} with BAD_REFERENCE`, () => {
        let caught;
        try {
          travelerNcr.parseInputRef(malformed[label]);
        } catch (err) {
          caught = err;
        }
        expect(caught).to.be.instanceOf(TravelerNcrError);
        expect(caught.code).to.equal('BAD_REFERENCE');
        expect(caught.status).to.equal(400);
        expect(caught.message).to.equal(BAD_MESSAGE);
      });
    });
  });

  describe('resolveInputRef', () => {
    let findById;
    let canRead;

    beforeEach(() => {
      findById = sandbox.stub(mongoose.model('Traveler'), 'findById');
      canRead = sandbox.stub(require('../../lib/req-utils'), 'canRead');
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('rejects a malformed reference before touching the database', async () => {
      const err = await rejection(
        travelerNcr.resolveInputRef(makeReq(), 'nonsense')
      );
      expect(err.code).to.equal('BAD_REFERENCE');
      expect(findById.called).to.equal(false);
    });

    it('rejects a traveler that does not exist with TRAVELER_NOT_FOUND', async () => {
      findById.resolves(null);
      const err = await rejection(
        travelerNcr.resolveInputRef(makeReq(), `${TRAVELER_ID}::field_1`)
      );
      expect(err).to.be.instanceOf(TravelerNcrError);
      expect(err.code).to.equal('TRAVELER_NOT_FOUND');
      expect(err.status).to.equal(404);
      expect(err.message).to.equal('No traveler matches this reference.');
      expect(canRead.called).to.equal(false);
    });

    it('answers a traveler the caller cannot read exactly as it answers a nonexistent one', async () => {
      findById.resolves(null);
      const missing = await rejection(
        travelerNcr.resolveInputRef(makeReq(), `${TRAVELER_ID}::field_1`)
      );

      findById.resolves(makeTraveler());
      canRead.returns(false);
      const forbidden = await rejection(
        travelerNcr.resolveInputRef(makeReq(), `${TRAVELER_ID}::field_1`)
      );

      expect({
        code: forbidden.code,
        status: forbidden.status,
        message: forbidden.message,
      }).to.deep.equal({
        code: missing.code,
        status: missing.status,
        message: missing.message,
      });
      // and nothing about the traveler leaks into the message
      expect(forbidden.message).to.not.contain('Cryomodule 7');
    });

    it('rejects an input that is not on the traveler with INPUT_NOT_FOUND, naming the traveler', async () => {
      findById.resolves(makeTraveler());
      canRead.returns(true);
      const err = await rejection(
        travelerNcr.resolveInputRef(makeReq(), `${TRAVELER_ID}::nope`)
      );
      expect(err.code).to.equal('INPUT_NOT_FOUND');
      expect(err.status).to.equal(404);
      expect(err.message).to.equal(
        'Traveler "Cryomodule 7" has no input named "nope".'
      );
    });

    it('resolves a readable traveler and an existing input, taking the label from the traveler', async () => {
      const traveler = makeTraveler();
      findById.resolves(traveler);
      canRead.returns(true);
      const req = makeReq();

      const resolved = await travelerNcr.resolveInputRef(
        req,
        `  ${TRAVELER_ID}::field_2 `
      );

      expect(findById.calledOnceWithExactly(TRAVELER_ID)).to.equal(true);
      expect(canRead.calledOnceWithExactly(req, traveler)).to.equal(true);
      expect(resolved).to.deep.equal({
        traveler,
        travelerId: TRAVELER_ID,
        inputName: 'field_2',
        inputLabel: 'Field Two',
      });
    });

    describe('active-only initiation', () => {
      const cases = {
        0: 'initialized',
        1.5: 'submitted for completion',
        2: 'completed',
        3: 'frozen',
        4: 'archived',
      };
      Object.keys(cases).forEach(status => {
        it(`refuses a traveler that is ${cases[status]} with TRAVELER_NOT_ACTIVE, naming the status`, async () => {
          findById.resolves(makeTraveler({ status: Number(status) }));
          canRead.returns(true);
          const err = await rejection(
            travelerNcr.resolveInputRef(makeReq(), `${TRAVELER_ID}::field_1`)
          );
          expect(err).to.be.instanceOf(TravelerNcrError);
          expect(err.code).to.equal('TRAVELER_NOT_ACTIVE');
          expect(err.status).to.equal(409);
          expect(err.message).to.equal(
            `Traveler "Cryomodule 7" is ${cases[status]}; an NCR can only be initiated against an active traveler.`
          );
        });
      });

      it('resolves an active traveler', async () => {
        findById.resolves(makeTraveler({ status: 1 }));
        canRead.returns(true);
        const resolved = await travelerNcr.resolveInputRef(
          makeReq(),
          `${TRAVELER_ID}::field_1`
        );
        expect(resolved.inputName).to.equal('field_1');
      });

      it('does not reveal the status of a traveler the caller cannot read', async () => {
        findById.resolves(makeTraveler({ status: 2 }));
        canRead.returns(false);
        const err = await rejection(
          travelerNcr.resolveInputRef(makeReq(), `${TRAVELER_ID}::field_1`)
        );
        expect(err.code).to.equal('TRAVELER_NOT_FOUND');
        expect(err.message).to.not.contain('completed');
      });

      it('reports a missing input before the status (INPUT_NOT_FOUND wins over TRAVELER_NOT_ACTIVE)', async () => {
        findById.resolves(makeTraveler({ status: 2 }));
        canRead.returns(true);
        const err = await rejection(
          travelerNcr.resolveInputRef(makeReq(), `${TRAVELER_ID}::nope`)
        );
        expect(err.code).to.equal('INPUT_NOT_FOUND');
      });
    });

    it('falls back to the input name when the form stored an empty label (a checkbox inside a set has none)', async () => {
      findById.resolves(
        makeTraveler({ forms: [{ labels: { checkbox_1: '' } }] })
      );
      canRead.returns(true);
      const resolved = await travelerNcr.resolveInputRef(
        makeReq(),
        `${TRAVELER_ID}::checkbox_1`
      );
      expect(resolved.inputLabel).to.equal('checkbox_1');
    });
  });
});

// ── submission gate ──────────────────────────────────────────────────────────

describe('lib/traveler-ncr — open-NCR submission gate', () => {
  describe('isSubmissionTransition', () => {
    const yes = [
      [1, 1.5], // submitted for completion approval
      [1, 2], // the API helper's direct route, which would skip submission
    ];
    const no = [
      [1.5, 2], // approval — deliberately not gated (spec Assumptions)
      [1.5, 1], // sent back for more work
      [1, 3], // freeze
      [1, 4], // archive
      [2, 4],
      [2, 1],
      [3, 1],
      [0, 1],
      [1, 1],
      [1.5, 1.5], // a status that is not changing, e.g. a plain title update
      [2, 2],
      [1, NaN],
      [1, undefined],
      [undefined, 2],
    ];
    yes.forEach(([from, to]) => {
      it(`is true for ${from} -> ${to}`, () => {
        expect(travelerNcr.isSubmissionTransition(from, to)).to.equal(true);
      });
    });
    no.forEach(([from, to]) => {
      it(`is false for ${from} -> ${to}`, () => {
        expect(travelerNcr.isSubmissionTransition(from, to)).to.equal(false);
      });
    });
  });

  describe('findOpenNcrs / assertNoOpenNcrs', () => {
    let find;

    /** Makes Ncr.find(...).lean() resolve to `rows`. */
    function stubRows(rows) {
      find = sandbox
        .stub(Ncr, 'find')
        .returns({ lean: () => Promise.resolve(rows) });
    }

    afterEach(() => {
      sandbox.restore();
    });

    it("asks only for this traveler's linked NCRs that are not Closed", async () => {
      stubRows([]);
      await travelerNcr.findOpenNcrs(TRAVELER_ID);
      expect(find.calledOnce).to.equal(true);
      expect(find.firstCall.args[0]).to.deep.equal({
        'traveler_link.traveler_id': TRAVELER_ID,
        'traveler_link.initiated_from_traveler': true,
        status: { $ne: 'Closed' },
      });
    });

    it('resolves quietly when there is no open NCR (none linked, or all Closed)', async () => {
      stubRows([]);
      await travelerNcr.assertNoOpenNcrs(TRAVELER_ID);
    });

    it('refuses with OPEN_NCRS 409 and lists each open NCR', async () => {
      stubRows([
        {
          _id: 'id-2',
          ncr_number: 'NCR-2026-0002',
          status: 'Dispositioned',
          traveler_link: { input_name: 'field_2', input_label: 'Field Two' },
        },
        {
          _id: 'id-1',
          ncr_number: 'NCR-2026-0001',
          status: 'Submitted',
          traveler_link: { input_name: 'field_1', input_label: 'Field One' },
        },
      ]);
      const err = await rejection(travelerNcr.assertNoOpenNcrs(TRAVELER_ID));
      expect(err).to.be.instanceOf(TravelerNcrError);
      expect(err.code).to.equal('OPEN_NCRS');
      expect(err.status).to.equal(409);
      expect(err.message).to.equal(
        'This traveler cannot be submitted for completion approval while 2 linked NCRs are not Closed.'
      );
      // sorted by NCR number, and shaped for the client
      expect(err.extra.open_ncrs).to.deep.equal([
        {
          ncr_id: 'id-1',
          ncr_number: 'NCR-2026-0001',
          status: 'Submitted',
          input_name: 'field_1',
          input_label: 'Field One',
        },
        {
          ncr_id: 'id-2',
          ncr_number: 'NCR-2026-0002',
          status: 'Dispositioned',
          input_name: 'field_2',
          input_label: 'Field Two',
        },
      ]);
    });

    it('says "1 linked NCR is not Closed" in the singular', async () => {
      stubRows([
        {
          _id: 'id-1',
          ncr_number: 'NCR-2026-0001',
          status: 'Submitted',
          traveler_link: {},
        },
      ]);
      const err = await rejection(travelerNcr.assertNoOpenNcrs(TRAVELER_ID));
      expect(err.message).to.equal(
        'This traveler cannot be submitted for completion approval while 1 linked NCR is not Closed.'
      );
    });

    it('reports a legacy link that has no input as null (it blocks the traveler but no input)', async () => {
      stubRows([
        {
          _id: 'id-1',
          ncr_number: 'NCR-2026-0001',
          status: 'Submitted',
          traveler_link: {},
        },
      ]);
      const err = await rejection(travelerNcr.assertNoOpenNcrs(TRAVELER_ID));
      expect(err.extra.open_ncrs[0].input_name).to.equal(null);
      expect(err.extra.open_ncrs[0].input_label).to.equal(null);
    });

    it('serialises the response body the routes send', async () => {
      stubRows([
        {
          _id: 'id-1',
          ncr_number: 'NCR-2026-0001',
          status: 'Submitted',
          traveler_link: { input_name: 'a', input_label: 'A' },
        },
      ]);
      const err = await rejection(travelerNcr.assertNoOpenNcrs(TRAVELER_ID));
      const body = travelerNcr.errorBody(err);
      expect(body).to.include({
        success: false,
        error: 'Conflict',
        code: 'OPEN_NCRS',
      });
      expect(body.open_ncrs).to.have.length(1);
    });
  });
});

// ── input progress ───────────────────────────────────────────────────────────

describe('lib/traveler-ncr — input progress', () => {
  const routesUtilities = require('../../utilities/routes');

  afterEach(() => {
    sandbox.restore();
  });

  describe('finishedCount (the worked example in data-model.md)', () => {
    const { finishedCount } = routesUtilities.traveler;
    const rows = [
      ['A and B filled in', ['A', 'B'], [], 2],
      ['NCR-1 raised against A', ['A', 'B'], ['A'], 1],
      ['NCR-2 raised against unfilled C', ['A', 'B'], ['A', 'C'], 1],
      ['C filled in while NCR-2 is open', ['A', 'B', 'C'], ['A', 'C'], 1],
      ['NCR-1 closed', ['A', 'B', 'C'], ['C'], 2],
      ['NCR-2 deleted', ['A', 'B', 'C'], [], 3],
    ];
    rows.forEach(([event, touched, open, expected]) => {
      it(`${event}: ${touched.length} touched, open on [${open}] -> ${expected}`, () => {
        expect(finishedCount(touched, open)).to.equal(expected);
      });
    });

    it('accepts a Set and tolerates a missing open list', () => {
      expect(finishedCount(['A', 'B'], new Set(['A']))).to.equal(1);
      expect(finishedCount(['A', 'B'], undefined)).to.equal(2);
    });

    it('does not count an open input that was never touched', () => {
      expect(finishedCount(['A'], ['Z'])).to.equal(1);
    });
  });

  describe('openNcrInputNames', () => {
    it('returns the distinct input names of the open linked NCRs, dropping empty ones', async () => {
      const distinct = sandbox.stub(Ncr, 'distinct').resolves(['field_1', '', null, undefined, 'field_2']);
      const names = await travelerNcr.openNcrInputNames(TRAVELER_ID);
      expect(names).to.deep.equal(['field_1', 'field_2']);
      expect(distinct.calledOnce).to.equal(true);
      expect(distinct.firstCall.args[0]).to.equal('traveler_link.input_name');
      expect(distinct.firstCall.args[1]).to.deep.equal({
        'traveler_link.traveler_id': TRAVELER_ID,
        'traveler_link.initiated_from_traveler': true,
        status: { $ne: 'Closed' },
      });
    });
  });

  describe('refreshTravelerProgress', () => {
    let findById;

    beforeEach(() => {
      findById = sandbox.stub(mongoose.model('Traveler'), 'findById');
    });

    /** A fake traveler with a spy on save(). */
    function progressTraveler(overrides = {}) {
      const updatedOn = new Date('2026-01-01T00:00:00Z');
      return {
        _id: TRAVELER_ID,
        touchedInputs: ['a', 'b'],
        finishedInput: 2,
        updatedBy: 'someone',
        updatedOn,
        save: sandbox.stub().resolves(),
        ...overrides,
      };
    }

    it('sets ONLY finishedInput to |touched minus open| and saves once', async () => {
      const traveler = progressTraveler();
      findById.resolves(traveler);
      sandbox.stub(Ncr, 'distinct').resolves(['a']);

      await travelerNcr.refreshTravelerProgress(TRAVELER_ID);

      expect(traveler.finishedInput).to.equal(1);
      expect(traveler.save.calledOnce).to.equal(true);
      // an automatic recount is not a user edit of the traveler
      expect(traveler.updatedBy).to.equal('someone');
      expect(traveler.updatedOn.toISOString()).to.equal('2026-01-01T00:00:00.000Z');
    });

    it('does not save when the figure is already right', async () => {
      const traveler = progressTraveler({ finishedInput: 2 });
      findById.resolves(traveler);
      sandbox.stub(Ncr, 'distinct').resolves([]);

      await travelerNcr.refreshTravelerProgress(TRAVELER_ID);

      expect(traveler.save.called).to.equal(false);
    });

    it('raises the figure again once no NCR is open', async () => {
      const traveler = progressTraveler({ finishedInput: 1 });
      findById.resolves(traveler);
      sandbox.stub(Ncr, 'distinct').resolves([]);

      await travelerNcr.refreshTravelerProgress(TRAVELER_ID);

      expect(traveler.finishedInput).to.equal(2);
      expect(traveler.save.calledOnce).to.equal(true);
    });

    it('resolves quietly when the traveler no longer exists', async () => {
      findById.resolves(null);
      const distinct = sandbox.stub(Ncr, 'distinct').resolves([]);

      await travelerNcr.refreshTravelerProgress(TRAVELER_ID);

      expect(distinct.called).to.equal(false);
    });

    it('treats a traveler with no touchedInputs as having nothing finished', async () => {
      const traveler = progressTraveler({ touchedInputs: undefined, finishedInput: 0 });
      findById.resolves(traveler);
      sandbox.stub(Ncr, 'distinct').resolves(['a']);

      await travelerNcr.refreshTravelerProgress(TRAVELER_ID);

      expect(traveler.save.called).to.equal(false);
    });
  });
});

// ── closure PDF ──────────────────────────────────────────────────────────────

describe('lib/traveler-ncr — attachClosurePdf', () => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const ncrPdf = require('../../lib/ncr-pdf');
  const user = { id: 'user1', name: 'Alice' };
  let uploadDir;
  let findById;
  let create;
  let findOne;

  beforeEach(() => {
    uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ncr-closure-test-'));
    findById = sandbox.stub(mongoose.model('Traveler'), 'findById');
    create = sandbox.stub(mongoose.model('TravelerNcrPdf'), 'create');
    findOne = sandbox.stub(mongoose.model('TravelerNcrPdf'), 'findOne');
  });

  afterEach(() => {
    sandbox.restore();
    fs.rmSync(uploadDir, { recursive: true, force: true });
  });

  /** A closed, traveler-linked NCR with a spy on save(). */
  function closedNcr(overrides = {}) {
    return {
      _id: 'ncr-id-1',
      ncr_number: 'NCR-2026-0007',
      status: 'Closed',
      traveler_link: {
        traveler_id: TRAVELER_ID,
        input_name: 'field_1',
        input_label: 'Field One',
        initiated_from_traveler: true,
      },
      events: [],
      save: sandbox.stub().resolves(),
      ...overrides,
    };
  }

  function filesWritten() {
    return fs.readdirSync(uploadDir);
  }

  function lastEvent(ncr) {
    return ncr.events[ncr.events.length - 1];
  }

  it('does nothing for an NCR that is not linked to a traveler', async () => {
    const ncr = closedNcr({ traveler_link: undefined });
    const result = await travelerNcr.attachClosurePdf(ncr, user, { uploadDir });
    expect(result).to.deep.equal({ status: 'not_applicable' });
    expect(findById.called).to.equal(false);
    expect(filesWritten()).to.have.length(0);
    expect(ncr.events).to.have.length(0);
  });

  it('writes the PDF, records it against the traveler input, and logs a traveler.pdf_attached event', async () => {
    findById.resolves(makeTraveler());
    create.callsFake(async doc => ({ _id: 'pdf-id-1', ...doc }));
    const ncr = closedNcr();

    const result = await travelerNcr.attachClosurePdf(ncr, user, { uploadDir });

    expect(result).to.deep.equal({ status: 'attached', pdfId: 'pdf-id-1' });
    const files = filesWritten();
    expect(files).to.have.length(1);
    expect(files[0]).to.match(/^ncr-closure-[0-9a-f-]+\.pdf$/);
    const bytes = fs.readFileSync(path.join(uploadDir, files[0]));
    expect(bytes.slice(0, 5).toString('latin1')).to.equal('%PDF-');

    const record = create.firstCall.args[0];
    expect(record).to.include({
      traveler: TRAVELER_ID,
      input_name: 'field_1',
      ncr_id: 'ncr-id-1',
      ncr_number: 'NCR-2026-0007',
      file_name: 'NCR-2026-0007.pdf',
      generatedBy: 'user1',
    });
    expect(record.file.path).to.equal(path.join(uploadDir, files[0]));
    expect(record.file.mimetype).to.equal('application/pdf');
    expect(record.file.size).to.equal(bytes.length);
    expect(record.generatedOn).to.be.instanceOf(Date);

    expect(ncr.events).to.have.length(1);
    expect(lastEvent(ncr)).to.include({ event_type: 'traveler.pdf_attached', actor_type: 'system' });
    expect(lastEvent(ncr).payload).to.deep.equal({
      traveler_id: TRAVELER_ID,
      input_name: 'field_1',
      pdf_id: 'pdf-id-1',
      file_name: 'NCR-2026-0007.pdf',
    });
    expect(ncr.save.calledOnce).to.equal(true);
  });

  it('attaches whatever the traveler\'s status is at closure (FR-029) — a frozen traveler still gets its PDF', async () => {
    findById.resolves(makeTraveler({ status: 3 }));
    create.callsFake(async doc => ({ _id: 'pdf-id-1', ...doc }));

    const result = await travelerNcr.attachClosurePdf(closedNcr(), user, { uploadDir });

    expect(result.status).to.equal('attached');
  });

  it('fails, without writing anything, when the traveler no longer exists', async () => {
    findById.resolves(null);
    const ncr = closedNcr();

    const result = await travelerNcr.attachClosurePdf(ncr, user, { uploadDir });

    expect(result).to.deep.equal({
      status: 'failed',
      message: 'The traveler this NCR was linked to no longer exists.',
    });
    expect(create.called).to.equal(false);
    expect(filesWritten()).to.have.length(0);
    expect(lastEvent(ncr).event_type).to.equal('traveler.pdf_failed');
    expect(lastEvent(ncr).payload).to.deep.equal({
      traveler_id: TRAVELER_ID,
      input_name: 'field_1',
      reason: 'The traveler this NCR was linked to no longer exists.',
    });
  });

  it('fails when the input is no longer on the traveler\'s form', async () => {
    findById.resolves(makeTraveler({ forms: [{ labels: { other_input: 'Other' } }] }));
    const result = await travelerNcr.attachClosurePdf(closedNcr(), user, { uploadDir });
    expect(result).to.deep.equal({
      status: 'failed',
      message: 'That input is no longer on the traveler\'s form.',
    });
    expect(filesWritten()).to.have.length(0);
  });

  it('fails without leaking a path or an internal error when the PDF cannot be rendered, and leaves no file', async () => {
    findById.resolves(makeTraveler());
    sandbox.stub(ncrPdf, 'renderNcrPdf').rejects(new Error('kaboom at /secret/internal/path'));
    const ncr = closedNcr();

    const result = await travelerNcr.attachClosurePdf(ncr, user, { uploadDir });

    expect(result).to.deep.equal({ status: 'failed', message: 'The PDF could not be generated.' });
    expect(JSON.stringify(ncr.events)).to.not.contain('/secret/internal/path');
    expect(filesWritten()).to.have.length(0);
  });

  it('fails and removes the file when the record cannot be stored', async () => {
    findById.resolves(makeTraveler());
    create.rejects(new Error('connection refused to db at /var/lib/mongo'));
    const ncr = closedNcr();

    const result = await travelerNcr.attachClosurePdf(ncr, user, { uploadDir });

    expect(result).to.deep.equal({ status: 'failed', message: 'The PDF could not be stored.' });
    expect(filesWritten()).to.have.length(0);
    expect(JSON.stringify(ncr.events)).to.not.contain('/var/lib/mongo');
    expect(lastEvent(ncr).event_type).to.equal('traveler.pdf_failed');
  });

  it('treats a duplicate (traveler, NCR) record as already attached: no second file, no second event', async () => {
    findById.resolves(makeTraveler());
    create.rejects(Object.assign(new Error('E11000 duplicate key'), { code: 11000 }));
    findOne.returns({ lean: () => Promise.resolve({ _id: 'existing-pdf-id' }) });
    const ncr = closedNcr();

    const result = await travelerNcr.attachClosurePdf(ncr, user, { uploadDir });

    expect(result).to.deep.equal({ status: 'attached', pdfId: 'existing-pdf-id' });
    expect(filesWritten()).to.have.length(0);
    expect(ncr.events).to.have.length(0);
  });

  it('still reports the PDF as attached when logging the event fails afterwards', async () => {
    findById.resolves(makeTraveler());
    create.callsFake(async doc => ({ _id: 'pdf-id-1', ...doc }));
    const ncr = closedNcr({ save: sandbox.stub().rejects(new Error('save failed')) });

    const result = await travelerNcr.attachClosurePdf(ncr, user, { uploadDir });

    expect(result.status).to.equal('attached');
  });

  it('never throws — an unexpected error becomes a generic failure', async () => {
    findById.rejects(new Error('database is on fire'));
    const ncr = closedNcr();

    const result = await travelerNcr.attachClosurePdf(ncr, user, { uploadDir });

    expect(result).to.deep.equal({ status: 'failed', message: 'The PDF could not be attached.' });
    expect(JSON.stringify(ncr.events)).to.not.contain('on fire');
  });

  it('does not mistake a traveler_link that is not flagged as initiated from a traveler for a link', async () => {
    const ncr = closedNcr({ traveler_link: { traveler_id: TRAVELER_ID, initiated_from_traveler: false } });
    const result = await travelerNcr.attachClosurePdf(ncr, user, { uploadDir });
    expect(result.status).to.equal('not_applicable');
  });
});
