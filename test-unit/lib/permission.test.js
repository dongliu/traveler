/*global describe, it, before, after*/
require('chai').should();
// var sinon = require('sinon');

describe('permission', () => {
  let permissionLib;
  before(() => {
    process.env.TRAVELER_CONFIG_REL_PATH = 'docker';
    const config = require('../../config/config.js');
    config.load();
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
  after(() => {
    process.env.TRAVELER_CONFIG_REL_PATH = '';
  });
});
