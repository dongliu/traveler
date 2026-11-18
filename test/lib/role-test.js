require('chai').should();
var role = require('../../lib/role');

describe('role', function() {
  it('exports exactly the three assignable roles', function() {
    role.Roles.should.have.members(['manager', 'admin', 'reviewer']);
    role.Roles.length.should.equal(3);
  });

  it('does not export anything permission-shaped', function() {
    role.should.not.have.property('Read_all_forms');
    role.should.not.have.property('Write_active_travelers');
    role.should.not.have.property('Permissions');
  });
});
