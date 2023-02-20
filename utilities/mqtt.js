const mqtt = require('mqtt');
const config = require('../config/config');
const logger = require('../lib/loggers').getLogger();

const mqttConfig = config.mqtt;

let travelerDataChangedTopic;
let travelerStatusChangedTopic;
let travelerDiscrepancyLogAddedTopic;

let mqttClient;

if (mqttConfig) {
  travelerDataChangedTopic = mqttConfig.topics.traveler_data_changed;
  travelerStatusChangedTopic = mqttConfig.topics.traveler_status_changed;
  travelerDiscrepancyLogAddedTopic =
    mqttConfig.topics.traveler_discrepancy_log_added;
  const mqttServerIp = mqttConfig.server_address;
  const mqttPort = mqttConfig.server_port;
  const mqttProtocol = mqttConfig.server_protocol;
  let mqttAddress = `${mqttProtocol}://${mqttServerIp}`;
  if (mqttPort !== undefined) {
    mqttAddress += `:${mqttPort}`;
  }

  // If disconnects try every minute
  const options = { reconnectPeriod: 60 };

  const mqttUser = mqttConfig.username;
  if (mqttUser !== undefined) {
    options.username = mqttUser;
    options.password = mqttConfig.password;
  }

  mqttClient = mqtt.connect(mqttAddress, options);

  mqttClient.on('packetsend', function(obj) {
    if (obj.cmd === 'connect') {
      logger.info(
        'Connection error occurred, check credentials or MQTT server status, reconnecting to MQTT server...'
      );
    } else if (obj.cmd === 'publish') {
      logger.info(`Sent MQTT message to: ${obj.topic}`);
    }
  });
}

function postDataEnteredMessage(topic, data) {
  if (mqttConfig) {
    const mqttMessage = JSON.stringify(data);
    mqttClient.publish(topic, mqttMessage);
  }
}

function findUDKByMapping(mapping, inputId) {
  if (mapping != null) {
    const mappings = Object.entries(mapping);

    for (let i = 0; i < mappings.length; i += 1) {
      mapping = mappings[i];
      if (mapping[1] === inputId) {
        return mapping[0];
      }
    }
  }

  return null;
}

function postTravelerDataChangedMessage(documentData, document) {
  if (mqttConfig === undefined) {
    return;
  }

  let udk = null;
  const inputId = documentData.name;

  // Attempt fetching latest mapping from form
  if (document.forms.length === 1) {
    const form = document.forms[0];
    const { mapping } = form;
    udk = findUDKByMapping(mapping, inputId);
  }
  // Try to fetch traveler mapping
  if (udk == null) {
    const { mapping } = document;
    udk = findUDKByMapping(mapping, inputId);
  }

  const dataEntered = {
    _id: documentData._id,
    traveler: documentData.traveler,
    name: documentData.name,
    value: documentData.value,
    inputType: documentData.inputType,
    inputBy: documentData.inputBy,
    inputOn: documentData.inputOn,
    userDefinedKey: udk,
  };

  postDataEnteredMessage(travelerDataChangedTopic, dataEntered);
}

function postTravelerStatusChangedMessage(document) {
  if (!mqttConfig) {
    return;
  }
  const statusChanged = {
    traveler: document.id,
    status: document.status,
    updatedBy: document.updatedBy,
    updatedOn: document.updatedOn,
  };
  postDataEnteredMessage(travelerStatusChangedTopic, statusChanged);
}

function postDiscrepancyLogAddedMessage(travelerId, log) {
  if (!mqttConfig) {
    return;
  }
  const newDiscrepancy = {
    traveler: travelerId,
    log,
  };

  postDataEnteredMessage(travelerDiscrepancyLogAddedTopic, newDiscrepancy);
}

module.exports = {
  postTravelerDataChangedMessage,
  postTravelerStatusChangedMessage,
  postDiscrepancyLogAddedMessage,
};
