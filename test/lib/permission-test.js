require('chai').should();
var config = require('../../config/config');
var permission = require('../../lib/permission');

describe('permission', function() {
  describe('#getPermissions', function() {
    beforeEach(function() {
      config.permission = {
        user: ['read_all_forms', 'write_active_travelers'],
        manager: ['approve_travelers'],
        reviewer: ['review_forms', 'approve_travelers'],
        admin: ['review_forms', 'approve_travelers', 'manage_users'],
      };
    });

    it('returns exactly the permissions listed for a role with an entry', function() {
      permission
        .getPermissions(['manager'])
        .should.have.members(['approve_travelers']);
    });

    it('grants nothing for a role with no entry in the mapping', function() {
      permission.getPermissions(['nonexistent-role']).should.deep.equal([]);
    });

    it('filters out a configured permission that is not in PermissionList', function() {
      config.permission.manager = ['approve_travelers', 'made_up_permission'];
      permission
        .getPermissions(['manager'])
        .should.have.members(['approve_travelers']);
      permission
        .getPermissions(['manager'])
        .should.not.include('made_up_permission');
    });

    it('unions and de-duplicates permissions from multiple held roles', function() {
      var result = permission.getPermissions(['manager', 'reviewer']);
      result.should.have.members(['approve_travelers', 'review_forms']);
      result.length.should.equal(2);
    });

    it('grants the baseline permissions from the default user role alone', function() {
      permission
        .getPermissions(['user'])
        .should.have.members(['read_all_forms', 'write_active_travelers']);
    });

    it('reflects a changed mapping with no change to getPermissions itself', function() {
      permission.getPermissions(['manager']).should.not.include('review_forms');
      config.permission.manager = ['approve_travelers', 'review_forms'];
      permission
        .getPermissions(['manager'])
        .should.have.members(['approve_travelers', 'review_forms']);
    });
  });
});
