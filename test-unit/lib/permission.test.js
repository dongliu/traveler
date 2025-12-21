require('chai').should();

describe('permission', () => {
  let permissionLib;
  const configPath = require.resolve('../../config/config.js');
  const permissionPath = require.resolve('../../lib/permission.js');
  before(() => {
    process.env.TRAVELER_CONFIG_REL_PATH = 'docker';
    delete require.cache[configPath];
    delete require.cache[permissionPath];
    const config = require('../../config/config.js');
    config.load();
    console.log(config.configPath);
    permissionLib = require('../../lib/permission.js');
  });
  describe('getPermission', () => {
    it('should return an array of permissions', () => {
      const roles = ['user', 'nothing'];
      const permission = permissionLib.getPermissions(roles);
      permission.should.be.a('array');
      permission.should.include(permissionLib.Read_all_forms);
      permission.should.not.include(permissionLib.Manage_users);
    });
  });
});
