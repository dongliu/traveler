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

read -p "What port would you like mongodb to run on? (Default: 27017) " mongoPort 
if [ ! -z $mongoPort ]; then
    echo -e "\nexport MONGO_SERVER_PORT=$mongoPort" >> $TRAVELER_INSTALL_ETC_DIR/mongo-configuration.sh   
    export MONGO_SERVER_PORT=$mongoPort
fi 

# Start mongodb server 
$TRAVELER_ETC_INIT_DIRECTORY/traveler-mongodb startNoAuth

# Get password for the users that will be created
echo ''
read -s -p "Enter admin password for mongodb: " adminPass
echo ''
read -s -p "Enter traveler db password for mongodb(it will be stored in a config file): " travelerPass
echo ''

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
