var sinon = require('sinon');
require('chai').should();

require('../../model/user');
var { User, Group } = require('../../model/user');
var ldapClient = require('../../lib/ldap-client');
var auth = require('../../lib/auth');

describe('lib/auth/index.js #getCurrentUser', function() {
  afterEach(function() {
    sinon.restore();
  });

  it('persists an empty roles array for a brand-new user on first login', function(done) {
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
    var saveStub = sinon.stub(User.prototype, 'save').callsFake(function(cb) {
      cb(null, this);
    });

    var req = { session: {} };
    var res = {
      status: sinon.stub().returnsThis(),
      send: sinon.stub().returnsThis(),
    };

    auth.getCurrentUser('newperson', req, res, function() {
      saveStub.calledOnce.should.be.true;
      var savedUser = saveStub.firstCall.thisValue;
      savedUser.roles.should.be.an('array').that.is.empty;
      done();
    });
  });
});
