const sinon = require('sinon');

require('chai').should();

require('../../model/user');
require('../../model/form');
require('../../model/released-form');
require('../../model/traveler');
const travelerMetadata = require('../../lib/traveler-metadata');
const formManagementRoutes = require('../../routes/form-management');

/**
 * Capture the middleware chain routes/form-management.js registers for a
 * given method + path, without starting a real server (no supertest in
 * this project) — same pattern as test/lib/traveler-approval-test.js.
 */
function captureRoute(method, path) {
  let captured;
  const fakeApp = {
    get: function(p, ...handlers) {
      if (p === path && method === 'get') captured = handlers;
    },
    put: function(p, ...handlers) {
      if (p === path && method === 'put') captured = handlers;
    },
    post: function(p, ...handlers) {
      if (p === path && method === 'post') captured = handlers;
    },
    delete: function(p, ...handlers) {
      if (p === path && method === 'delete') captured = handlers;
    },
  };
  formManagementRoutes(fakeApp);
  if (!captured) {
    throw new Error(`no ${method} ${path} route registered`);
  }
  return captured;
}

function makeReleasedFormDoc(fields) {
  const doc = Object.assign({}, fields);
  doc.saveWithHistory = sinon.stub().resolves();
  doc.get = function(field) {
    return this[field];
  };
  return doc;
}

describe('routes/form-management.js PUT /released-forms/:id/metadata', function() {
  let handler;
  let doc;
  let req;
  let res;

  beforeEach(function() {
    const handlers = captureRoute('put', '/released-forms/:id/metadata');
    handler = handlers[handlers.length - 1];
    doc = makeReleasedFormDoc({ subsystem: '', device: '', activity: '' });
    req = {
      params: { id: 'rf1' },
      session: { userid: 'owner1' },
      body: {
        subsystem: 'Cryogenics',
        device: 'Magnet Assembly',
        activity: 'Inspection',
      },
    };
    req.rf1 = doc;
    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub().returnsThis(),
      send: sinon.stub().returnsThis(),
    };
  });

  afterEach(function() {
    sinon.restore();
  });

  it('invokes backfillFromReleasedForm after saving and keeps the response shape unchanged', async function() {
    sinon.stub(travelerMetadata, 'backfillFromReleasedForm').resolves();

    await handler(req, res);

    doc.saveWithHistory.calledOnce.should.be.true;
    travelerMetadata.backfillFromReleasedForm.calledOnce.should.be.true;
    travelerMetadata.backfillFromReleasedForm.calledWith(doc).should.be.true;
    res.status.calledWith(200).should.be.true;
    res.json.calledWith({
      subsystem: 'Cryogenics',
      device: 'Magnet Assembly',
      activity: 'Inspection',
    }).should.be.true;
  });

  it('responds 500 and never calls backfillFromReleasedForm when the save itself fails', async function() {
    doc.saveWithHistory = sinon.stub().rejects(new Error('boom'));
    sinon.stub(travelerMetadata, 'backfillFromReleasedForm').resolves();

    await handler(req, res);

    travelerMetadata.backfillFromReleasedForm.called.should.be.false;
    res.status.calledWith(500).should.be.true;
  });
});
