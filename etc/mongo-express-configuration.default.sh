#!/bin/bash

MY_DIR=`dirname $BASH_SOURCE`

# Run source setup.sh before running this script. 
export MONGO_EXPRESS_DAEMON_SOURCE_DIR=$TRAVELER_SUPPORT_DIR/nodejs/node_modules/mongo-express
export MONGO_EXPRESS_DAEMON_APP_DIR=$MONGO_EXPRESS_DAEMON_SOURCE_DIR/app.js

export MONGO_EXPRESS_DAEMON_USERNAME=admin
export MONGO_EXPRESS_DAEMON_PASSWD_FILE=$TRAVELER_INSTALL_ETC_DIR/mongo-express.passwd

# To configure SSL in mongo-express, set the variables below. 
#export MONGO_EXPRESS_SSL_ENABLED=true
#export MONGO_EXPRESS_SSL_CRT=$TRAVELER_ROOT_DIR/config/ssl/node.crt
#export MONGO_EXPRESS_SSL_KEY=$TRAVELER_ROOT_DIR/config/ssl/node.key