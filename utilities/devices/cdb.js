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
 *  "web_service_url": "URL to the CDB web services"
 * }
 */

var config = require('./../../config/config.js');
var request = require('request');

var webServiceUrl = config.service.cdb.web_service_url;
var webPortalUrl = config.service.cdb.web_portal_url;

const PORTAL_PATH_FOR_ITEM = "/views/item/view.xhtml?id=REPLACE_ID";
const PORTAL_PATH_FOR_ITEM_ELEMENT = "/views/itemElement/view.xhtml?id=REPLACE_ID";

const ITEM_INVENTORY_DOMAIN_NAME = "Inventory";
const ITEM_CATALOG_DOMAIN_NAME = "Catalog";

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
      if (error !== null && error !== undefined) {
        console.error(error);
      }
      cb(response, error);
    });
}

/**
 * Generates service url for entity type of item. Performs a request using the url.
 * @param {int} id - Unique identifier of the entity
 * @param {requestCallback} cb(resonse, error) - The function to be executed upon successful/unsuccessful completion of the request.
 * @returns {void}
 */
function getItemById(id, cb) {
  var fullUrl = webServiceUrl + '/items/' + id;
  performServiceRequest(fullUrl, cb);
}

function getItemElementById(id, cb) {
  var fullUrl = webServiceUrl + "/itemElements/" + id;
  performServiceRequest(fullUrl, cb)
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
   * Function processes the response for a item entity type from CDB.
   * @param {Object} data - response data from web service, may include error message.
   * @param {Object} error - An error that occurred on the local application server during the request.
   * @returns {void}
   */
  function processItemResponse(data, error) {
    performErrorChecking(data, error).then(function (displayValue) {
      if (displayValue === undefined) {
        switch (data.domain.name){
          case ITEM_CATALOG_DOMAIN_NAME:
            displayValue = "Catalog Item: " + data.name;
            finishItemResponse(displayValue);
            break;
          case ITEM_INVENTORY_DOMAIN_NAME:
            finishInventoryItemResponse(data);
            break;
          default:
            displayValue = 'Item: ' + data.name;
        }
      } else {
        finishItemResponse(displayValue);
      }
    });
  }

  function finishInventoryItemResponse(inventoryItem){
    function addCatalogItemInformation(data, error) {
      performErrorChecking(data, error).then(function (displayValue) {
        if (displayValue === undefined) {
          catalogItem = data;
          displayValue = catalogItem.name + " [" + inventoryItem.name + "]";
        } else {
          displayValue = displayValue + " Inventory Item: " + inventoryItem.name;
        }

        if (inventoryItem.qr_id) {
          displayValue += ' (QRID: ' + inventoryItem.qr_id + ')';
        }
        finishItemResponse(displayValue);
      });
    }
    catalogItemId = inventoryItem.derived_from_item_id;
    getItemById(catalogItemId, addCatalogItemInformation);
  }

  function finishItemResponse(displayValue) {
    constructFinalUrl(PORTAL_PATH_FOR_ITEM, displayValue);
  }

  function processItemElementResponse(data, error) {
    performErrorChecking(data, error).then(function (displayValue) {
      if (displayValue === undefined) {
        displayValue = "Element";
        if (data.parentItem) {
          displayValue += " of " + data.parentItem.name
        }
        if (data.name) {
          displayValue += ": " + data.name;
        }
      }

      constructFinalUrl(PORTAL_PATH_FOR_ITEM_ELEMENT, displayValue)
    });
  }

  switch (entityType) {
    case 'item':
      getItemById(id, processItemResponse);
      break;
    case 'itemElement':
      getItemElementById(id, processItemElementResponse);
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
