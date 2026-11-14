var sinon = require('sinon');
require('chai').should();

require('../../model/user');
require('../../model/traveler');
var travelerRoutes = require('../../routes/traveler');

/**
 * Capture the middleware chain routes/traveler.js registers for a given
 * method + path, without starting a real server (no supertest in this
 * project).
 */
function captureRoute(method, path) {
  var captured;
  var fakeApp = {
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
  travelerRoutes(fakeApp);
  if (!captured) {
    throw new Error(`no ${method} ${path} route registered`);
  }
  return captured;
}

function makeReqRes(roles, permissions, doc, targetStatus) {
  var res = {
    status: sinon.stub().returnsThis(),
    send: sinon.stub().returnsThis(),
    json: sinon.stub().returnsThis(),
    locals: { roles: roles, permissions: permissions },
  };
  var req = {
    session: { userid: 'someone', roles: roles },
    params: { id: 'trav1' },
    body: { status: targetStatus },
  };
  req.trav1 = doc;
  req.res = res;
  return { req: req, res: res };
}

describe('routes/traveler.js submitted-traveler approval gate', function() {
  afterEach(function() {
    sinon.restore();
  });

  describe('PUT /travelers/:id/status', function() {
    var handler;

    beforeEach(function() {
      var handlers = captureRoute('put', '/travelers/:id/status');
      handler = handlers[handlers.length - 1];
    });

    it('allows a manager-only session to approve a submitted traveler', function() {
      var doc = { status: 1.5, save: sinon.stub().yields(null) };
      var pair = makeReqRes(['manager'], ['approve_travelers'], doc, 2);

      handler(pair.req, pair.res, function() {});

      doc.status.should.equal(2);
      pair.res.status.calledWith(403).should.be.false;
    });

    it('rejects approval for a session with none of manager/admin/reviewer', function() {
      var doc = { status: 1.5, save: sinon.stub().yields(null) };
      var pair = makeReqRes(['user'], [], doc, 2);

      handler(pair.req, pair.res, function() {});

      doc.status.should.equal(1.5);
      pair.res.status.calledWith(403).should.be.true;
    });
  });
});
