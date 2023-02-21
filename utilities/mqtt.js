const config = require('../config/config.js');
const logger = require('../lib/loggers').getLogger();

mqttConfig = config.mqtt;

let travelerDataChangedTopic = undefined;
let travelerStatusChangedTopic = undefined;
let travelerDiscrepancyLogAddedTopic = undefined;

let mqttClient = undefined;

if (mqttConfig !== undefined) {
    const mqtt = require('mqtt');

    travelerDataChangedTopic = mqttConfig.topics.traveler_data_changed;
    travelerStatusChangedTopic = mqttConfig.topics.traveler_status_changed;
    travelerDiscrepancyLogAddedTopic = mqttConfig.topics.traveler_discrepancy_log_added;
    let mqttServerIp = mqttConfig.server_address;
    let mqttPort = mqttConfig.server_port;
    let mqttProtocol = mqttConfig.server_protocol;
    let mqttAddress = mqttProtocol + '://' + mqttServerIp;
    if (mqttPort !== undefined) {
        mqttAddress += ":" + mqttPort;
    }

    // If disconnects try every minute
    options = { reconnectPeriod: 60};

    mqttUser = mqttConfig.username;
    if (mqttUser !== undefined) {
        options.username = mqttUser;
        options.password = mqttConfig.password;
    }

    mqttClient = mqtt.connect(mqttAddress, options);

    mqttClient.on('packetsend', function (obj) {
        if (obj.cmd === 'connect') {
            logger.info("Connection error occurred, check credentials or MQTT server status, reconnecting to MQTT server...");
        } else if (obj.cmd === "publish") {
            logger.info("Sent MQTT message to: " + obj.topic);
        }
    })

}

function postDataEnteredMessage(topic, data) {
    if (mqttConfig !== undefined) {
        let mqttMessage = JSON.stringify(data);
        mqttClient.publish(topic, mqttMessage);
    }
}

function postTravelerDataChangedMessage(documentData) {
    postDataEnteredMessage(travelerDataChangedTopic, documentData);
}

function postTravelerStatusChangedMessage(document) {
    if (mqttConfig === undefined) {
        return;
    }
    let statusChanged = {
        traveler: document.id,
        status: document.status,
        updatedBy: document.updatedBy,
        updatedOn: document.updatedOn
    }
    postDataEnteredMessage(travelerStatusChangedTopic, statusChanged);
}

function postDiscrepancyLogAddedMessage(travelerId, log) {
    if (mqttConfig === undefined) {
        return;
    }
    let newDiscrepancy = {
        traveler: travelerId,
        log: log
    }

    postDataEnteredMessage(travelerDiscrepancyLogAddedTopic, newDiscrepancy)

}

module.exports = {
    postTravelerDataChangedMessage: postTravelerDataChangedMessage,
    postTravelerStatusChangedMessage: postTravelerStatusChangedMessage,
    postDiscrepancyLogAddedMessage: postDiscrepancyLogAddedMessage
}

