/**
 * Created by djarosz on 11/24/15.
 */
/**
 * The purpose of this file is to allow communication with the component database (CDB) used at the Advance Photon Source (APS).
 *
 * In order to integrate CDB into the traveler module the requirements below must be fullfilled:
 * Service.json file must include:
 *
 * "device_application": "cdb",
 * "cdb" : {
 *  "web_portal_url": "URL to home page of CDB",
 *  "web_service_url": "URL to the CDB web services",
 *  "component_path": "/views/component/view.xhtml?id=REPLACE_ID",
 *  "component_instance_path": "/views/componentInstance/view.xhtml?id=REPLACE_ID",
 *  "design_path": "/views/design/view.xhtml?id=REPLACE_ID",
 *  "design_element_path": "/views/designElement/view?id=REPLACE_ID"
 * }
 */

var config = require('./../../config/config.js');
var request = require('request');

var webServiceUrl = config.service.cdb.web_service_url;
var webPortalUrl = config.service.cdb.web_portal_url;

/**
 * Performs a request to an external service and calls the call back function when the request is complete/incomplete.
 * @param {string} fullUrl - The full url of the web service request.
 * @param {requestCallback} cb - The function to be executed upon successful/unsuccessful completion of the request.
 * @returns {void}
 */
function performServiceRequest(fullUrl, cb) {
  console.log('Performing API Request: ' + fullUrl);
  request({
    strictSSL: false,
    url: fullUrl
  },
      function (error, response) {
        if (response !== undefined) {
          try {
            response = JSON.parse(response.body);
          } catch (e) {
            error = 'Response from server could not be parsed.';
          }
        }
        if (error !== undefined) {
          console.error(error);
        }
        cb(response, error);
      });
}

/**
 * Generates service url for entity type of component. Performs a request using the url.
 * @param {int} id - Unique identifier of the entity
 * @param {requestCallback} cb - The function to be executed upon successful/unsuccessful completion of the request.
 * @returns {void}
 */
function getComponentById(id, cb) {
  var fullUrl = webServiceUrl + '/componentById/' + id;
  performServiceRequest(fullUrl, cb);
}

/**
 * Generates service url for entity type of component instance. Performs a request using the url.
 * @param {int} id - Unique identifier of the entity
 * @param {requestCallback} cb - The function to be executed upon successful/unsuccessful completion of the request.
 * @returns {void}
 */
function getComponentInstanceById(id, cb) {
  var fullUrl = webServiceUrl + '/componentInstanceById/' + id;
  performServiceRequest(fullUrl, cb);
}

/**
 * Generates service url for entity type of design. Performs a request using the url.
 * @param {int} id - Unique identifier of the entity
 * @param {requestCallback} cb - The function to be executed upon successful/unsuccessful completion of the request.
 * @returns {void}
 */
function getDesignById(id, cb) {
  var fullUrl = webServiceUrl + '/designs/' + id;
  performServiceRequest(fullUrl, cb);
}

/**
 * Generates service url for entity type of design element. Performs a request using the url.
 * @param {int} id - Unique identifier of the entity
 * @param {requestCallback} cb - The function to be executed upon successful/unsuccessful completion of the request.
 * @returns {void}
 */
function getDesignElementById(id, cb) {
  var fullUrl = webServiceUrl + '/designElements/' + id;
  performServiceRequest(fullUrl, cb);
}

/**
 * Gets the display value from web service for the specific entity from the Component Database(CDB) web service.
 * Generates an html <a> tag with target value to the entity in component database (CDB).
 * @param {String} valueOrig - value that is stored in the database, describes entity type and its id.
 * @param {requestCallback} cb - The function to be executed upon successful/unsuccessful completion of the request.
 * @returns {void}
 */
function getCDBEntityReference(valueOrig, cb) {
  var value = valueOrig.split(':');
  var id = value[1];
  var entityType = value[0];

  /**
   * Generates a proper displayValue depending on the data resulting from the request.
   * When connection/local error occurred, display value is db stored value.
   * When web service returns an error, the error from web service is display value.
   * When request was successful, display value is the value from web service.
   * @param {Object} data - response data from web service, may include error message.
   * @param {Object} error - An error that occurred on the local application server during the request.
   * @returns {Promise} - promise is returned once error checking is complete and display value is generated.
   */
  function performErrorChecking(data, error) {
    return new Promise(function (resolve) {
      var displayValue;
      if (error) {
        displayValue = valueOrig;
      } else if (data.errorMessage) {
        console.error(data.errorMessage);
        displayValue = 'Error: ' + data.errorMessage;
      }
      resolve(displayValue);
    });
  }

  /**
   * Using the generated display value and the configuration url path, it generates an <a> tag to display for device.
   * @param {String} urlPath - URL path stored in the configuration file for a specific entity.
   * @param {String} displayValue - The value to show on the url link that is generated to CDB.
   * @returns {void}
   */
  function constructFinalUrl(urlPath, displayValue) {
    urlPath = urlPath.replace('REPLACE_ID', id);
    var url = webPortalUrl + urlPath;
    var result = "<a target='_blank' href='" + url + "'>";
    result += displayValue;
    result += '</a>';
    cb(result);
  }

  /**
   * Function processes the response for a component entity type from CDB.
   * @param {Object} data - response data from web service, may include error message.
   * @param {Object} error - An error that occurred on the local application server during the request.
   * @returns {void}
   */
  function processComponentResponse(data, error) {
    performErrorChecking(data, error).then(function (displayValue) {
      if (displayValue === undefined) {
        displayValue = 'Component: ' + data.name;
      }
      constructFinalUrl(config.service.cdb.component_path, displayValue);
    });
  }

  /**
   * Function processes the response for a component instance entity type from CDB.
   * @param {Object} data - response data from web service, may include error message.
   * @param {Object} error - An error that occurred on the local application server during the request.
   * @returns {void}
   */
  function processComponentInstanceResponse(data, error) {
    performErrorChecking(data, error).then(function (displayValue) {
      if (displayValue === undefined) {
        displayValue = 'Component Instance: ' + data.component.name;
        if (data.qrId) {
          displayValue += ' (QRID: ' + data.qrId + ')';
        }
      }
      constructFinalUrl(config.service.cdb.component_instance_path, displayValue);
    });
  }

  /**
   * Function processes the response for a design entity type from CDB.
   * @param {Object} data - response data from web service, may include error message.
   * @param {Object} error - An error that occurred on the local application server during the request.
   * @returns {void}
   */
  function processDesignResponse(data, error) {
    performErrorChecking(data, error).then(function (displayValue) {
      if (displayValue === undefined) {
        displayValue = 'Design: ' + data.name;
      }
      constructFinalUrl(config.service.cdb.design_path, displayValue);
    });
  }

  /**
   * Function processes the response for a design element entity type from CDB.
   * @param {Object} data - response data from web service, may include error message.
   * @param {Object} error - An error that occurred on the local application server during the request.
   * @returns {void}
   */
  function processDesignElementResponse(data, error) {
    performErrorChecking(data, error).then(function (displayValue) {
      if (displayValue === undefined) {
        displayValue = 'Design Element: ' + data.name;
      }
      constructFinalUrl(config.service.cdb.design_element_path, displayValue);
    });
  }

  switch (entityType) {
  case 'component':
    getComponentById(id, processComponentResponse);
    break;
  case 'componentInstance':
    getComponentInstanceById(id, processComponentInstanceResponse);
    break;
  case 'design':
    getDesignById(id, processDesignResponse);
    break;
  case 'designElement':
    getDesignElementById(id, processDesignElementResponse);
    break;
  default:
    cb(valueOrig);
  }
}

/*
function test() {
  function showResult(data, error) {
    console.log('error: ' + JSON.stringify(error));
    console.log('data: ' + data);
  }

  getCDBEntityReference('Component:263', showResult);
  getCDBEntityReference('ComponentInstance:108', showResult);
  getCDBEntityReference('Design:24', showResult);

}
test()
*/

module.exports = {
  getDeviceValue: getCDBEntityReference,
  devicesRemovalAllowed: false
};
