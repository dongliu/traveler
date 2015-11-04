#!/bin/bash

MY_DIR=`dirname $0` && cd $MY_DIR && MY_DIR=`pwd`

export TRAVELER_ETC_INIT_DIRECTORY=$TRAVELER_ROOT_DIR/etc/init.d

source $MY_DIR/../setup.sh