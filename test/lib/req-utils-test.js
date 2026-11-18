var reqUtils = require('../../lib/req-utils');
require('chai').should();
var sinon = require('sinon');

describe('req-utils', function() {
  describe('#sanitize', function() {
    it('should sanitize a json object', function() {
      var req = {};
      var res = {};
      req.body = {
        a_string: 'has a <script>alert()</script>',
        a_function: function() {
          console.log('inside a function');
        },
        an_object: { deep: { deep: 'has a <script>alert()</script>' } },
        an_array: ['has a <script>alert()</script>', 'text'],
      };
      var nextSpy = sinon.spy();
      reqUtils.sanitize('body', [
        'a_string',
        'a_function',
        'an_object',
        'an_array',
      ])(req, res, nextSpy);
      nextSpy.calledOnce.should.be.true;
      req.body.a_string.includes('script').should.be.false;
      (req.body.a_function === null).should.be.true;
      req.body.an_object.deep.deep.includes('script').should.be.false;
      req.body.an_array[0].includes('script').should.be.false;
    });
  });

  describe('#publicAccessMatch', function() {
    var stored = { publicAccess: { $in: [0, 1] } };
    var withMissing = {
      $or: [stored, { publicAccess: { $exists: false } }],
    };

    it('should also match a missing publicAccess when the default is public read', function() {
      reqUtils.publicAccessMatch(0).should.deep.equal(withMissing);
    });

    it('should also match a missing publicAccess when the default is public write', function() {
      reqUtils.publicAccessMatch(1).should.deep.equal(withMissing);
    });

    it('should accept a numeric string default, as a config file may hold one', function() {
      reqUtils.publicAccessMatch('0').should.deep.equal(withMissing);
    });

    it('should match stored values only when the default is no access', function() {
      reqUtils.publicAccessMatch(-1).should.deep.equal(stored);
    });

    it('should match stored values only when there is no usable default', function() {
      // an omitted argument (undefined) falls back to the configured value,
      // so the unusable defaults are passed explicitly
      reqUtils.publicAccessMatch(null).should.deep.equal(stored);
      reqUtils.publicAccessMatch('').should.deep.equal(stored);
      reqUtils.publicAccessMatch('none').should.deep.equal(stored);
    });

    it('should never match a stored -1 or null', function() {
      [0, 1, -1, null, undefined, ''].forEach(function(defaultAccess) {
        var match = reqUtils.publicAccessMatch(defaultAccess);
        var branches = match.$or || [match];
        branches.forEach(function(branch) {
          if (branch.publicAccess.$in) {
            branch.publicAccess.$in.should.deep.equal([0, 1]);
          } else {
            branch.publicAccess.should.deep.equal({ $exists: false });
          }
        });
      });
    });

    it('should return a fresh object on every call', function() {
      var first = reqUtils.publicAccessMatch(0);
      first.$or[0].publicAccess.$in.push(99);
      reqUtils.publicAccessMatch(0).should.deep.equal(withMissing);
    });

    it('should use the configured default when called without one', function() {
      var configured = require('../../config/config').app;
      var expected = reqUtils.publicAccessMatch(
        configured && configured.default_traveler_public_access
      );
      reqUtils.publicAccessMatch().should.deep.equal(expected);
    });
  });

  describe('#getAccess', function() {
    function FakeTraveler() {}
    FakeTraveler.modelName = 'Traveler';
    function FakeForm() {}
    FakeForm.modelName = 'Form';

    function makeReqRes(roles, permissions) {
      var req = {
        session: { userid: 'someone-else', roles: roles },
      };
      var res = { locals: { roles: roles, permissions: permissions || [] } };
      req.res = res;
      return req;
    }

    it('still grants full access from holding the manager role alone (unchanged by this feature - see e2e/us4-access-control.spec.js AS5)', function() {
      var doc = new FakeTraveler();
      doc.publicAccess = -1;
      var req = makeReqRes(['manager'], []);
      reqUtils.getAccess(req, doc).should.equal(1);
    });

    it('still grants full access from holding the admin role alone (unchanged by this feature)', function() {
      var doc = new FakeTraveler();
      doc.publicAccess = -1;
      var req = makeReqRes(['admin'], []);
      reqUtils.getAccess(req, doc).should.equal(1);
    });

    it('grants write access to an active traveler via the write_active_travelers permission', function() {
      var doc = new FakeTraveler();
      doc.publicAccess = -1;
      var req = makeReqRes(['manager'], ['write_active_travelers']);
      reqUtils.getAccess(req, doc).should.equal(1);
    });

    it('grants read access to a form via the read_all_forms permission', function() {
      var doc = new FakeForm();
      doc.publicAccess = -1;
      var req = makeReqRes([], ['read_all_forms']);
      reqUtils.getAccess(req, doc).should.equal(0);
    });
  });
});
