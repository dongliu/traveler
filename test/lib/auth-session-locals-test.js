var sinon = require('sinon');
require('chai').should();
var config = require('../../config/config');
require('../../model/user');
var auth = require('../../lib/auth');

describe('lib/auth/index.js #sessionLocals', function() {
  beforeEach(function() {
    config.permission = {
      user: ['read_all_forms', 'write_active_travelers'],
      manager: ['approve_travelers'],
    };
  });

  it('always includes the default user role and its baseline permissions, with no optional roles', function() {
    var req = { session: { userid: 'alice', roles: [] } };
    var res = {};
    auth.sessionLocals(req, res, sinon.stub());

    res.locals.roles.should.deep.equal(['user']);
    res.locals.permissions.should.have.members([
      'read_all_forms',
      'write_active_travelers',
    ]);
  });

  it('still includes the baseline when req.session.roles is undefined', function() {
    var req = { session: { userid: 'alice' } };
    var res = {};
    auth.sessionLocals(req, res, sinon.stub());

    res.locals.roles.should.deep.equal(['user']);
    res.locals.permissions.should.have.members([
      'read_all_forms',
      'write_active_travelers',
    ]);
  });

  it('unions the baseline with whatever optional roles are held', function() {
    var req = { session: { userid: 'alice', roles: ['manager'] } };
    var res = {};
    auth.sessionLocals(req, res, sinon.stub());

    res.locals.roles.should.deep.equal(['user', 'manager']);
    res.locals.permissions.should.have.members([
      'read_all_forms',
      'write_active_travelers',
      'approve_travelers',
    ]);
  });

  it('does not compute roles/permissions for an unauthenticated session', function() {
    var req = { session: {} };
    var res = {};
    auth.sessionLocals(req, res, sinon.stub());

    (res.locals.roles === undefined).should.be.true;
    (res.locals.permissions === undefined).should.be.true;
  });
});
