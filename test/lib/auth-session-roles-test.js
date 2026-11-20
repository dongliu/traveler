var sinon = require('sinon');
require('chai').should();

var config = require('../../config/config');
require('../../model/user');
var { User, Group } = require('../../model/user');
var ldapClient = require('../../lib/ldap-client');
var auth = require('../../lib/auth');

describe('lib/auth/index.js #sessionRolesFor', function() {
  var originalAuth;

  beforeEach(function() {
    originalAuth = config.auth;
    config.permission = {
      user: ['read_all_forms'],
      manager: ['approve_travelers'],
      admin: ['manage_users'],
    };
  });

  afterEach(function() {
    config.auth = originalAuth;
  });

  it('keeps an assigned role that is a configured permission.json key', function() {
    auth.sessionRolesFor(['manager']).should.deep.equal(['manager']);
  });

  it('drops an assigned role that is not a configured permission.json key', function() {
    // 'read_all_forms' is a permission name, not a role - e.g. a legacy
    // default_roles value from before the Ernest permission refactor.
    auth
      .sessionRolesFor(['manager', 'read_all_forms', 'bogus-role'])
      .should.deep.equal(['manager']);
  });

  it('returns an empty array for no assigned roles', function() {
    auth.sessionRolesFor([]).should.deep.equal([]);
  });

  it('de-duplicates repeated roles', function() {
    auth.sessionRolesFor(['manager', 'manager']).should.deep.equal(['manager']);
  });

  it('unions configured default roles into the result when default_roles is non-empty', function() {
    config.auth = { default_roles: ['user'] };
    auth.sessionRolesFor(['manager']).should.have.members(['manager', 'user']);
  });

  it('drops a configured default role that is not a permission.json key', function() {
    config.auth = { default_roles: ['user', 'removed-role'] };
    auth.sessionRolesFor([]).should.deep.equal(['user']);
  });

  it('de-duplicates a default role that is also assigned', function() {
    config.auth = { default_roles: ['user'] };
    auth.sessionRolesFor(['user']).should.deep.equal(['user']);
  });
});

describe('lib/auth/index.js #setSessionRoles', function() {
  beforeEach(function() {
    config.permission = {
      user: ['read_all_forms'],
      manager: ['approve_travelers'],
      admin: ['manage_users'],
    };
  });

  it('sets both req.session.roles and req.session.permissions', function() {
    var req = { session: {} };
    auth.setSessionRoles(req, ['manager']);

    req.session.roles.should.deep.equal(['manager']);
    req.session.permissions.should.have.members([
      'read_all_forms',
      'approve_travelers',
    ]);
  });

  it('includes the implicit user role\'s permissions even with no assigned roles', function() {
    var req = { session: {} };
    auth.setSessionRoles(req, []);

    req.session.roles.should.deep.equal([]);
    req.session.permissions.should.deep.equal(['read_all_forms']);
  });

  it('computes permissions only from roles that survive the permission.json filter', function() {
    var req = { session: {} };
    auth.setSessionRoles(req, ['manager', 'stale-role']);

    req.session.roles.should.deep.equal(['manager']);
    req.session.permissions.should.have.members([
      'read_all_forms',
      'approve_travelers',
    ]);
  });
});

describe('lib/auth/index.js #getCurrentUser roles on login', function() {
  afterEach(function() {
    sinon.restore();
  });

  beforeEach(function() {
    config.permission = {
      user: ['read_all_forms'],
      manager: ['approve_travelers'],
      admin: ['manage_users'],
    };
  });

  it('filters a returning user\'s stored roles down to configured permission.json keys', function(done) {
    sinon.stub(ldapClient, 'searchForUser').yields(null, {
      displayName: 'Existing Person',
      memberOf: [],
    });
    sinon.stub(Group, 'find').yields(null, []);
    sinon.stub(User, 'findOne').returns({
      exec: sinon
        .stub()
        .yields(null, { _id: 'existingperson', roles: ['manager', 'stale-role'] }),
    });
    sinon.stub(User, 'findByIdAndUpdate').yields(null);

    var req = { session: {} };
    var res = {};

    auth.getCurrentUser('existingperson', req, res, function() {
      req.session.roles.should.deep.equal(['manager']);
      done();
    });
  });

  it('also sets req.session.permissions to match the roles granted on login, not just req.session.roles', function(done) {
    sinon.stub(ldapClient, 'searchForUser').yields(null, {
      displayName: 'Existing Person',
      memberOf: [],
    });
    sinon.stub(Group, 'find').yields(null, []);
    sinon.stub(User, 'findOne').returns({
      exec: sinon.stub().yields(null, { _id: 'existingperson', roles: ['manager'] }),
    });
    sinon.stub(User, 'findByIdAndUpdate').yields(null);

    var req = { session: {} };
    var res = {};

    auth.getCurrentUser('existingperson', req, res, function() {
      req.session.permissions.should.have.members([
        'read_all_forms',
        'approve_travelers',
      ]);
      done();
    });
  });

  it('sets req.session.permissions for a brand-new user too', function(done) {
    sinon.stub(ldapClient, 'searchForUser').yields(null, {
      displayName: 'New Person',
      mail: 'new.person@example.com',
      physicalDeliveryOfficeName: 'Building 1',
      telephoneNumber: '555-0100',
      mobile: '555-0101',
      memberOf: [],
    });
    sinon.stub(Group, 'find').yields(null, []);
    sinon.stub(Group, 'findOne').returns({
      lean: sinon.stub().returnsThis(),
      exec: sinon.stub().yields(null, { name: 'existing-group' }),
    });
    sinon.stub(User, 'findOne').returns({
      exec: sinon.stub().yields(null, null),
    });
    sinon.stub(User.prototype, 'save').callsFake(function(cb) {
      cb(null, this);
    });

    var req = { session: {} };
    var res = {
      status: sinon.stub().returnsThis(),
      send: sinon.stub().returnsThis(),
    };

    auth.getCurrentUser('newperson', req, res, function() {
      req.session.permissions.should.deep.equal(['read_all_forms']);
      done();
    });
  });
});
