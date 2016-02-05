#!/bin/bash

MY_DIR=`dirname $0`

source $MY_DIR/configure_paths.sh

# import local traveler-mongo settings
mongoConfigurationFile=$TRAVELER_INSTALL_ETC_DIR/mongo-configuration.sh
if [ -f $mongoConfigurationFile ]; then
  source $mongoConfigurationFile
else
  >&2 echo "ERROR $mongoConfigurationFile does not exist."
  exit 1
fi
if [ ! -f $MONGO_ADMIN_PASSWD_FILE ]; then
  >&2 echo "ERROR $MONGO_ADMIN_PASSWD_FILE does not exist."
  exit 1
fi
if [ -z $MONGO_ADMIN_USERNAME ]; then
  >&2 echo "ERROR: missing administration username in configuration - $mongoConfigurationFile."
  exit 1
fi
if [ -z $MONGO_SERVER_PORT ]; then
  >&2 echo "ERROR: missing server port in configuration - $mongoConfigurationFile."
  exit 1
fi
if [ -z $MONGO_SERVER_ADDRESS ]; then
  >&2 echo "ERROR: missing server address in configuration - $mongoConfigurationFile."
  exit 1
fi

# perform backup
if [ ! -d $TRAVELER_BACKUP_DIRECTORY ]; then
  mkdir -p $TRAVELER_BACKUP_DIRECTORY
fi

cd $TRAVELER_BACKUP_DIRECTORY

datestamp=`date +%Y%m%d`
timestamp=`date +%H-%M`

if [ ! -d $datestamp ]; then
    mkdir $datestamp
fi

cd $datestamp

if [ ! -d $timestamp ]; then
  mkdir $timestamp
fi
cd $timestamp

echo "Performing mongo dump for date: $datestamp - $timestamp"

adminPassword=`cat $MONGO_ADMIN_PASSWD_FILE`

output=$($MONGO_BIN_DIRECTORY/mongodump \
--host $MONGO_SERVER_ADDRESS \
--port $MONGO_SERVER_PORT \
--username $MONGO_ADMIN_USERNAME \
--password $adminPassword 2>&1)

# All output from mongodump is stderr
error=`echo "$output" | grep -i error`
if [ ! -z "$error" ]; then
  >&2 echo $output
  cd $TRAVELER_BACKUP_DIRECTORY/$datestamp
  rm -R $timestamp
else
  echo -e $output
fi
