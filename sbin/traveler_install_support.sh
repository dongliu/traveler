#!/bin/bash

MY_DIR=`dirname $0` 

source $MY_DIR/configuration.sh
source $MY_DIR/configure_paths.sh

echo 'INFO: Ignore the path warning messages above. This script will create the directories' 

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

cd $TRAVELER_SUPPORT_DIR
echo "Building support in `pwd`"

execute $TRAVELER_SUPPORT_DIR/bin/clean_all.sh
execute $TRAVELER_SUPPORT_DIR/bin/install_all.sh

if [ ! -d $TRAVELER_DATA_DIR ]; then
    echo "Creating data directories in $TRAVELER_DATA_DIR" 
    mkdir -p $TRAVELER_DATA_DIR/mongodb
    mkdir -p $TRAVELER_DATA_DIR/traveler-uploads
fi

if [ ! -d $TRAVELER_VAR_DIR ]; then 
    echo "Creating data directories in $TRAVELER_VAR_DIR"
    mkdir -p $TRAVELER_VAR_DIR/logs
    mkdir -p $TRAVELER_VAR_DIR/run
fi

if [ ! -d $TRAVELER_INSTALL_ETC_DIR ]; then
    echo "Creating data directories in $TRAVELER_INSTALL_ETC_DIRECTORY"
    mkdir -p $TRAVELER_INSTALL_ETC_DIR
fi

# Higher directory must rerun source setup 
cd $TRAVELER_ROOT_DIR
source setup.sh

if [ ! -d $TRAVELER_CONFIG_DIR ]; then
	echo "Creating data directories in $TRAVELER_CONFIG_DIR"
	mkdir -p $TRAVELER_CONFIG_DIR
fi 

# Install traveler dependecies 
npm install


cd $TRAVELER_ROOT_DIR