#!/bin/bash

MY_DIR=`dirname $0` 

source $MY_DIR/configuration.sh
source $MY_DIR/configure_paths.sh

cd $TRAVELER_INSTALL_ETC_DIR
source mongo-configuration.sh
source mongo-express-confiugration.sh
source travelerd_configuration.sh

execute(){
    echo "Executing: $@"
    eval "$@" 
}

if [ -d $TRAVELER_SUPPORT_DIR ]; then
    cd $TRAVELER_SUPPORT_DIR
    if [ $TRAVELER_VERSION_CONTROL_TYPE == "git" ]; then 
    	execute git pull
    fi
else 
    echo "Creating new traveler support directory $TRAVELER_SUPPORT_DIR."
    # Go to one level up from the support directory 
    cd `dirname $TRAVELER_SUPPORT_DIR` 
    if [ $TRAVELER_VERSION_CONTROL_TYPE == "git" ]; then 
		execute "git clone $TRAVELER_SUPPORT_GIT_URL `basename $TRAVELER_SUPPORT_DIR`" || exit 1
    fi
fi

#Check if no programs are running 
runInstall=1

if [ -f $MONGO_PID_DIRECTORY ]; then 
	echo "Mongo pid file exists: $MONGO_PID_DIRECTORY"
	echo "Update cannot be completed."
	runInstall=0
fi
if [ -f $TRAVELERD_PID_FILE ]; then 
	echo "Traveler pid file exists: $TRAVELERD_PID_FILE"
	echo "Update cannot be completed."
	runInstall=0
fi
if [ -f $MONGO_EXPRESS_DAEMON_PID_FILE ]; then 
	echo "Mongo-express pid file exists: $MONGO_EXPRESS_DAEMON_PID_FILE"
	echo "Update cannot be completed."
	runInstall=0
fi

if [ $runInstall -eq 1 ]; then
	execute $TRAVELER_SUPPORT_DIR/bin/install_all.sh
	cd $TRAVELER_ROOT_DIR
	source setup.sh
	npm install
else 
	execute $TRAVELER_SUPPORT_DIR/bin/install_all.sh --silent 
fi


cd $TRAVELER_ROOT_DIR