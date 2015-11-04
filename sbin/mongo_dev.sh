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

# Connect to mongodb 
$MONGO_BIN_DIRECTORY/mongo --port $MONGO_SERVER_PORT
