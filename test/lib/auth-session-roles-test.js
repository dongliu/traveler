var sinon = require('sinon');
require('chai').should();

var config = require('../../config/config');
require('../../model/user');
var { User, Group } = require('../../model/user');
var ldapClient = require('../../lib/ldap-client');
var auth = require('../../lib/auth');

describe('lib/auth/index.js #sessionRolesFor', function() {
  beforeEach(function() {
    config.permission = {
      user: ['read_all_forms'],
      manager: ['approve_travelers'],
      admin: ['manage_users'],
    };
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
});

describe('lib/auth/index.js #getCurrentUser roles on login', function() {
  afterEach(function() {
    sinon.restore();
  });

  it('filters a returning user\'s stored roles down to configured permission.json keys', function(done) {
    config.permission = {
      user: ['read_all_forms'],
      manager: ['approve_travelers'],
      admin: ['manage_users'],
    };
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
});
