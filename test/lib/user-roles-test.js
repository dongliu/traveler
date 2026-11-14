var sinon = require('sinon');
require('chai').should();

require('../../model/user');
var { User } = require('../../model/user');
var userRoutes = require('../../routes/user');

/**
 * Capture the middleware chain routes/user.js registers for a given method
 * + path, without starting a real server (no supertest in this project).
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
  };
  userRoutes(fakeApp);
  if (!captured) {
    throw new Error(`no ${method} ${path} route registered`);
  }
  return captured;
}

function makeRes(roles, permissions) {
  var res = {
    status: sinon.stub().returnsThis(),
    send: sinon.stub().returnsThis(),
    json: sinon.stub().returnsThis(),
    locals: { roles: roles, permissions: permissions },
  };
  return res;
}

describe('routes/user.js roles management', function() {
  afterEach(function() {
    sinon.restore();
  });

  describe('PUT /users/:id', function() {
    var handlers;

    beforeEach(function() {
      handlers = captureRoute('put', '/users/:id');
    });

    it('rejects a non-admin with 403 and never touches the database', function() {
      var findStub = sinon.stub(User, 'findOneAndUpdate');
      var req = {
        session: { userid: 'plain-user', roles: [] },
        params: { id: 'bob' },
        body: { roles: ['manager'] },
        is: sinon.stub().returns(true),
      };
      var res = makeRes(['user'], []);
      req.res = res;

      // only the permission-check middleware (2nd handler) is under test here
      handlers[1](req, res, function() {});

      res.status.calledWith(403).should.be.true;
      findStub.called.should.be.false;
    });

    it("drops 'user' and any unrecognized role before persisting, for an admin caller", function() {
      var execStub = sinon.stub().yields(null);
      var findStub = sinon
        .stub(User, 'findOneAndUpdate')
        .returns({ exec: execStub });
      var req = {
        session: { userid: 'admin1', roles: ['admin'] },
        params: { id: 'bob' },
        body: { roles: ['user', 'manager', 'bogus'] },
        is: sinon.stub().returns(true),
      };
      var res = makeRes(['user', 'admin'], ['manage_users']);
      req.res = res;

      // the handler itself is the last registered function
      handlers[handlers.length - 1](req, res, function() {});

      findStub.calledOnce.should.be.true;
      var update = findStub.firstCall.args[1];
      update.roles.should.deep.equal(['manager']);
      var options = findStub.firstCall.args[2];
      options.runValidators.should.be.true;
      res.status.calledWith(204).should.be.true;
    });

    it("leaves stored roles alone when only 'user' is submitted", function() {
      var execStub = sinon.stub().yields(null);
      var findStub = sinon
        .stub(User, 'findOneAndUpdate')
        .returns({ exec: execStub });
      var req = {
        session: { userid: 'admin1', roles: ['admin'] },
        params: { id: 'bob' },
        body: { roles: ['user'] },
        is: sinon.stub().returns(true),
      };
      var res = makeRes(['user', 'admin'], ['manage_users']);
      req.res = res;

      handlers[handlers.length - 1](req, res, function() {});

      var update = findStub.firstCall.args[1];
      update.roles.should.deep.equal([]);
    });
  });
});
