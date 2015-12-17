#!/bin/bash

# The script will make a user an admin.
# Make sure the user has logged into the system before running this command.
MY_DIR=`dirname $0`

source $MY_DIR/configuration.sh
source $MY_DIR/configure_paths.sh

# import local traveler-mongo settings

source $TRAVELER_INSTALL_ETC_DIR/mongo-configuration.sh
# Check to see that mongo is installed
if [ ! -f $MONGO_BIN_DIRECTORY/mongo ]; then
    echo "MongoDB was not found in the local directory: $MONGO_BIN_DIRECTORY"
    echo "please run 'make support' from $TRAVELER_ROOT_DIR directory"
    exit 1
fi

# Connect to mongodb
echo 'This script will make a user an admin; make sure the user has logged into the traveler module before running this script'
read -p "Enter the username to make admin: " adminUsername
if [[ -f $MONGO_TRAVELER_PASSWD_FILE ]]; then
  travelerPassword=`cat $MONGO_TRAVELER_PASSWD_FILE`
else
  read -s -p "Enter the password for mongodb $MONGO_TRAVELER_USERNAME user: " travelerPassword
  echo ''
fi

mongoCommands="db.users.update({'_id':'$adminUsername'}, { \$push:{ 'roles':'admin'}})"
mongoCommands="$mongoCommands\ndb.users.findOne({'_id':'$adminUsername'});"
echo -e $mongoCommands | $MONGO_BIN_DIRECTORY/mongo $MONGO_SERVER_ADDRESS:$MONGO_SERVER_PORT/$MONGO_TRAVELER_DB --username $MONGO_TRAVELER_USERNAME --password $travelerPassword
