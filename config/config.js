/**
 * Created by djarosz on 11/3/15.
 */
/* The purpose of this file is to load the correct directories for various project files
 *
 * The desired directory structure is as follows
 * -> Project Root Directory
 * ----> Distribution (This traveler module)
 * ----> etc
 * -------->traveler-config (directory with edited config files)
 * ----> data
 * --------> uploads (directory with uploaded data by users)
 *
 * The default directory structure if the above directory structure is as follows
 * -> Project Root Directory
 * ----> Distribution (This traveler module)
 * --------> config (directory with edited config files)
 * --------> traveler-uploads (directory with uploaded data by users)
 *
 * Specifying environment variables could also set the directories:
 * --TRAVELER_CONFIG_DIRECTORY
 * --TRAVELER_UPLOAD_DIRECTORY
 *
 * */

const fs = require('fs');
const optionalRequire = require("optional-require")(require)

module.exports.configPath = '';
module.exports.uploadPath = '';
module.exports.viewConfig = '';
module.exports.ad = '';
module.exports.api = '';
module.exports.app = '';
module.exports.auth = '';
module.exports.alias = '';
module.exports.mongo = '';
module.exports.service = '';
module.exports.travelerPackageFile = '';
module.exports.ui = '';

function getPath(desiredPath, defaultPath) {
  // Check to see that desired path exists.
  try {
    var stat = fs.statSync(desiredPath);
    if (stat !== null) {
      return desiredPath;
    }
  } catch (err) {
    // Desired path was not found -- default
    return defaultPath;
  }
}

module.exports.load = function() {
  // Load Paths
  if (process.env.TRAVELER_CONFIG_REL_PATH) {
    module.exports.configPath = process.env.TRAVELER_CONFIG_REL_PATH;
  } else {
    module.exports.configPath = getPath('../etc/traveler-config', 'config');
  }

  // Load configuration files
  var configPath = this.configPath;
  module.exports.ad = require('../' + configPath + '/ad.json');
  module.exports.api = require('../' + configPath + '/api.json');
  module.exports.app = require('../' + configPath + '/app.json');
  module.exports.auth = require('../' + configPath + '/auth.json');
  module.exports.alias = require('../' + configPath + '/alias.json');
  module.exports.mongo = require('../' + configPath + '/mongo.json');
  module.exports.service = require('../' + configPath + '/service.json');
  module.exports.ui = require('../' + configPath + '/ui.json');
  module.exports.mqtt = optionalRequire('../' + configPath + '/mqtt.json',
      "To configure copy and edit: `cp config/mqtt_optional-change.json " + configPath + '/mqtt.json`');
  module.exports.travelerPackageFile = require('../package.json');

  if (process.env.TRAVELER_UPLOAD_REL_PATH) {
    module.exports.uploadPath = process.env.TRAVELER_UPLOAD_REL_PATH;
  } else if (module.exports.app.upload_dir) {
    module.exports.uploadPath = module.exports.app.upload_dir;
  } else {
    module.exports.uploadPath = getPath('../data/traveler-uploads', 'uploads');
  }

  // Load view configuration
  var viewConfig = {};
  viewConfig.showDevice = false;
  viewConfig.shareUsers = true;
  viewConfig.shareGroups = true;
  viewConfig.transferOwnership = true;
  viewConfig.linkTarget = '_blank';
  viewConfig.showBinderValue = false;
  viewConfig.showCCDB = this.service.device_application === 'devices';

  if (this.service.device !== undefined) {
    viewConfig.showDevice = true;
  }
  if (this.ad.shareUsers !== undefined) {
    viewConfig.shareUsers = this.ad.shareUsers;
  }
  if (this.ad.shareGroups !== undefined) {
    viewConfig.shareGroups = this.ad.shareGroups;
  }
  if (this.ad.transferOwnership !== undefined) {
    viewConfig.transferOwnership = this.ad.transferOwnership;
  }
  if (this.app.top_bar_urls) {
    viewConfig.topBarUrls = this.app.top_bar_urls;
  }
  if (this.app.deployment_name) {
    viewConfig.deploymentName = this.app.deployment_name;
  }
  if (this.app.link_target) {
    viewConfig.linkTarget = this.app.link_target;
  }
  if (
    this.travelerPackageFile.repository &&
    this.travelerPackageFile.repository.release
  ) {
    viewConfig.appVersion = this.travelerPackageFile.repository.release;
  } else {
    viewConfig.appVersion = this.travelerPackageFile.version;
  }
  viewConfig.terminology = this.ui.terminology;

  module.exports.viewConfig = viewConfig;
};
