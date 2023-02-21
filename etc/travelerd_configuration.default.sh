#!/bin/bash

MY_DIR=`dirname $BASH_SOURCE`

# Run source setup.sh before running this script. 

export TRAVELERD_SOURCE_DIR=$TRAVELER_ROOT_DIR
export TRAVELERD_WORKING_DIR=$TRAVELER_ROOT_DIR
export TRAVELERD_PID_FILE=$TRAVELER_VAR_DIR/run/traveler.pid
export TRAVELERD_FOREVER_PATH=$TRAVELER_VAR_DIR
export TRAVELERD_LOG=$TRAVELER_VAR_DIR/logs/traveler.log
export TRAVELERD_OUT=$TRAVELER_VAR_DIR/logs/traveler.out.log
export TRAVELERD_ERR=$TRAVELER_VAR_DIR/logs/traveler.err.log
export TRAVELER_APP_DIR=$TRAVELER_ROOT_DIR/app.js
export TRAVELER_KILSIG=SIGTERM

export FOREVER_BIN=$TRAVELER_SUPPORT_DIR/nodejs/node_modules/forever/bin

