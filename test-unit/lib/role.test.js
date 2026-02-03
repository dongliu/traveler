require('chai').should();

describe('role', () => {
  let roleLib;
  const configPath = require.resolve('../../config/config.js');
  const rolePath = require.resolve('../../lib/role.js');
  before(() => {
    process.env.TRAVELER_CONFIG_REL_PATH = 'docker';
    delete require.cache[configPath];
    delete require.cache[rolePath];
    const config = require('../../config/config.js');
    config.load();
    roleLib = require('../../lib/role.js');
  });
  describe('getSupportedRoles', () => {
    it('should return only admin when loading config from docker', () => {
      const supportedRoles = roleLib.getSupportedRoles();
      supportedRoles.should.be.a('array');
      supportedRoles.should.deep.equal(['admin']);
    });
  });
});
