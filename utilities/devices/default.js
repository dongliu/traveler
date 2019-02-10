/**
 * Created by djarosz on 11/24/15.
 */
/**
 * The purpose of this file is to provide the behavior that would happen normally when no controller is specified for device_application.
 *
 * Service configuration contains the configuration below.
 * "device_application": "device"
 *
 * In order to implement special functionality for application, "device"; device.js must be specified in the same directory as this file.
 */

function getDeviceValue(value, cb) {
  cb(value);
}

module.exports = {
  getDeviceValue: getDeviceValue,
  devicesRemovalAllowed: true,
};
