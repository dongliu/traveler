var sinon = require('sinon');
require('chai').should();

require('../../model/user');
require('../../model/form');
var reviewRoutes = require('../../routes/review');

function captureRoute(method, path) {
  var captured;
  var fakeApp = {
    get: function(p, ...handlers) {
      if (p === path && method === 'get') captured = handlers;
    },
  };
  reviewRoutes(fakeApp);
  if (!captured) {
    throw new Error(`no ${method} ${path} route registered`);
  }
  return captured;
}

function makeReqRes(roles, permissions) {
  var res = {
    status: sinon.stub().returnsThis(),
    send: sinon.stub().returnsThis(),
    render: sinon.stub().returnsThis(),
    locals: { roles: roles, permissions: permissions },
  };
  var req = { session: { userid: 'someone', roles: roles } };
  req.res = res;
  return { req: req, res: res };
}

describe('routes/review.js GET /reviews/', function() {
  var handler;

  beforeEach(function() {
    var handlers = captureRoute('get', '/reviews/');
    handler = handlers[handlers.length - 1];
  });

  it('allows a reviewer-only session (default mapping grants it review_forms)', function() {
    var pair = makeReqRes(
      ['user', 'reviewer'],
      [
        'read_all_forms',
        'write_active_travelers',
        'review_forms',
        'approve_travelers',
      ]
    );
    handler(pair.req, pair.res, function() {});
    pair.res.status.calledWith(403).should.be.false;
    pair.res.render.calledOnce.should.be.true;
  });

  it('rejects a manager-only session (default mapping does not grant it review_forms)', function() {
    var pair = makeReqRes(
      ['user', 'manager'],
      ['read_all_forms', 'write_active_travelers', 'approve_travelers']
    );
    handler(pair.req, pair.res, function() {});
    pair.res.status.calledWith(403).should.be.true;
    pair.res.render.called.should.be.false;
  });
});
