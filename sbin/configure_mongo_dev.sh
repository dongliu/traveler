#!/bin/bash

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

# Check to make sure there is nothing in the mongo directory yet
if [ "$(ls -A "$MONGO_DATA_DIRECTORY")" ]; then
  >&2 echo "Aborting: MongoDB has data in the data directory: $MONGO_DATA_DIRECTORY"
  exit 1
fi

read -p "What port would you like mongodb to run on? [27017]: " mongoPort
if [[ -z $mongoPort ]]; then
  mongoPort=27017
fi
if [ ! -z $mongoPort ]; then
  mongoConfigurationFile=$TRAVELER_INSTALL_ETC_DIR/mongo-configuration.sh
  cmd="cat $mongoConfigurationFile | sed 's?export MONGO_SERVER_PORT=.*?export MONGO_SERVER_PORT=$mongoPort?g' > $mongoConfigurationFile.2 && mv $mongoConfigurationFile.2 $mongoConfigurationFile"
  eval $cmd
  export MONGO_SERVER_PORT=$mongoPort
fi

# Start mongodb server
$TRAVELER_ETC_INIT_DIRECTORY/traveler-mongodb startNoAuth

# Get password for the users that will be created
echo "Admin password will be stored in a passwd file: $MONGO_ADMIN_PASSWD_FILE"
read -s -p "Enter admin password for mongodb(it will be stored in a config file) [admin]: " adminPass
echo ''
read -s -p "Enter traveler db password for mongodb(it will be stored in a config file) [traveler]: " travelerPass
echo ''

if [[ -z $adminPass ]]; then
  adminPass="admin"
fi
if [[ -z $travelerPass ]]; then
  travelerPass="traveler"
fi

echo $adminPass > $MONGO_ADMIN_PASSWD_FILE
chmod 400 $MONGO_ADMIN_PASSWD_FILE
echo $travelerPass > $MONGO_TRAVELER_PASSWD_FILE
chmod 400 $MONGO_TRAVELER_PASSWD_FILE

commandjs="use admin;"
commandjs="$commandjs \n db.createUser({ user: \"$MONGO_ADMIN_USERNAME\", pwd: \"$adminPass\", roles: [ \"root\" ] } )"
commandjs="$commandjs \n use $MONGO_TRAVELER_DB;"
commandjs="$commandjs \n db.createUser( { user: \"$MONGO_TRAVELER_USERNAME\", pwd: \"$travelerPass\", roles: [ { role: \"readWrite\", db: \"$MONGO_TRAVELER_DB\" } ] } )"

echo -e $commandjs | $MONGO_BIN_DIRECTORY/mongo --port $MONGO_SERVER_PORT

$TRAVELER_ETC_INIT_DIRECTORY/traveler-mongodb stop

# Create a JSON database configuration file
travelerMongoConfig="{"
travelerMongoConfig="$travelerMongoConfig \n   \"server_address\": \"$MONGO_SERVER_ADDRESS\","
travelerMongoConfig="$travelerMongoConfig \n   \"server_port\": \"$MONGO_SERVER_PORT\","
travelerMongoConfig="$travelerMongoConfig \n   \"traveler_db\": \"$MONGO_TRAVELER_DB\","
travelerMongoConfig="$travelerMongoConfig \n   \"username\": \"$MONGO_TRAVELER_USERNAME\","
travelerMongoConfig="$travelerMongoConfig \n   \"password\": \"$travelerPass\""
travelerMongoConfig="$travelerMongoConfig \n}"

echo "Configuration for mongoDB has been generated"
echo -e $travelerMongoConfig


# Place the configuration files in the config directory
cd $TRAVELER_CONFIG_DIR
echo -e $travelerMongoConfig > mongo.json
