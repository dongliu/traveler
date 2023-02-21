#!/bin/bash

MY_DIR=`dirname $BASH_SOURCE`

# Run source setup.sh before running this script. 

export MONGO_EXPRESS_DAEMON_SOURCE_DIR=$TRAVELER_SUPPORT_DIR/nodejs/node_modules/mongo-express
export MONGO_EXPRESS_DAEMON_WORKING_DIR=$MONGO_EXPRESS_DAEMON_SOURCE_DIR
export MONGO_EXPRESS_DAEMON_PID_FILE=$TRAVELER_VAR_DIR/run/mongo-express.pid
export MONGO_EXPRESS_FOREVER_PATH=$TRAVELER_VAR_DIR
export MONGO_EXPRESS_DAEMON_LOG=$TRAVELER_VAR_DIR/logs/mongo-express.log
export MONGO_EXPRESS_DAEMON_OUT=$TRAVELER_VAR_DIR/logs/mongo-express.out.log
export MONGO_EXPRESS_DAEMON_ERR=$TRAVELER_VAR_DIR/logs/mongo-express.err.log
export MONGO_EXPRESS_DAEMON_APP_DIR=$MONGO_EXPRESS_DAEMON_SOURCE_DIR/app.js
export MONGO_EXPRESS_DAEMON_KILSIG=SIGTERM

export MONGO_EXPRESS_DAEMON_USERNAME=admin
export MONGO_EXPRESS_DAEMON_PASSWD_FILE=$TRAVELER_INSTALL_ETC_DIR/mongo-express.passwd

export FOREVER_BIN=$TRAVELER_SUPPORT_DIR/nodejs/node_modules/forever/bin

# To configure SSL in mongo-express, set the variables below. 
#export MONGO_EXPRESS_SSL_ENABLED=true
#export MONGO_EXPRESS_SSL_CRT=$TRAVELER_ROOT_DIR/config/ssl/node.crt
#export MONGO_EXPRESS_SSL_KEY=$TRAVELER_ROOT_DIR/config/ssl/node.key