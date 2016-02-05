#!/bin/bash

MY_DIR=`dirname $0` && cd $MY_DIR && MY_DIR=`pwd`

source $MY_DIR/../setup.sh

export TRAVELER_ETC_INIT_DIRECTORY=$TRAVELER_ROOT_DIR/etc/init.d

export TRAVELER_BACKUP_DIRECTORY=$TRAVELER_INSTALL_DIR/backup
