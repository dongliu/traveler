#!/bin/sh

# Traveler setup script for Bourne-type shells
# This file is typically sourced in user's .bashrc file

myDir=`dirname $BASH_SOURCE`
currentDir=`pwd` && cd $myDir

# TRAVELER_ROOT_DIR is not empty and the different from current directory
if [ ! -z "$TRAVELER_ROOT_DIR" -a "$TRAVELER_ROOT_DIR" != `pwd` ]; then
    echo "WARNING: Resetting TRAVELER_ROOT_DIR environment variable (old value: $TRAVELER_ROOT_DIR)"
fi 
export TRAVELER_ROOT_DIR=`pwd`


export TRAVELER_INSTALL_DIR=$TRAVELER_ROOT_DIR/..
 # it is an existant directory
if [ -d $TRAVELER_INSTALL_DIR ]; then
    cd $TRAVELER_INSTALL_DIR
    export TRAVELER_INSTALL_DIR=`pwd`
fi


# TRAVELER_DATA_DIR is not set 
export TRAVELER_DATA_DIR=$TRAVELER_INSTALL_DIR/data
if [ -d $TRAVELER_DATA_DIR ]; then
    cd $TRAVELER_DATA_DIR
    export TRAVELER_DATA_DIR=`pwd`
fi
 
# TRAVELER_VAR_DIR is not set
export TRAVELER_VAR_DIR=$TRAVELER_INSTALL_DIR/var
if [ -d $TRAVELER_VAR_DIR ]; then
    cd $TRAVELER_VAR_DIR; 
    export TRAVELER_VAR_DIR=`pwd`
fi

# TRAVELER_SUPPORT_DIR is not set
export TRAVELER_SUPPORT_DIR=$TRAVELER_INSTALL_DIR/support
if [ -d $TRAVELER_SUPPORT_DIR ]; then
    cd $TRAVELER_SUPPORT_DIR
    export TRAVELER_SUPPORT_DIR=`pwd`
fi

# TRAVELER_INSTALL_ETC_DIRECTORY is not set
export TRAVELER_INSTALL_ETC_DIR=$TRAVELER_INSTALL_DIR/etc
if [ -d $TRAVELER_INSTALL_ETC_DIR ]; then 
    cd $TRAVELER_INSTALL_ETC_DIR
    export TRAVELER_INSTALL_ETC_DIRECTORY=`pwd`
fi

export TRAVELER_CONFIG_DIR=$TRAVELER_INSTALL_ETC_DIRECTORY/traveler-config
if [ -d $TRAVELER_CONFIG_DIR ]; then 
    cd $TRAVELER_CONFIG_DIR
    export TRAVELER_CONFIG_DIR=`pwd`
fi

#Notify user of nonexistatnt directories. 
if [ ! -d $TRAVELER_SUPPORT_DIR ]; then 
    echo "Warning: $TRAVELER_SUPPORT_DIR directory does not exist. Developers should point TRAVELER_SUPPORT_DIR to desired area."
fi
if [ ! -d $TRAVELER_DATA_DIR ]; then
    echo "Warning: $TRAVELER_DATA_DIR directory does not exist. Developers should point TRAVELER_DATA_DIR to desired area."
fi
if [ ! -d $TRAVELER_VAR_DIR ]; then
    echo "Warning: $TRAVELER_VAR_DIR directory does not exist. Developers should point TRAVELER_VAR_DIR to desired area."
fi
if [ ! -d $TRAVELER_INSTALL_ETC_DIR ]; then 
    echo "Warning: $TRAVELER_INSTALL_ETC_DIR directory does not exist. Developers should point TRAVELER_INSTALL_ETC_DIR to desired area."
fi
if [ ! -d $TRAVELER_CONFIG_DIR ]; then 
    echo "Warning: $TRAVELER_CONFIG_DIR directory does not exist. Developers should point TRAVELER_CONFIG_DIR to desired area."
    echo "Specify env variable, TRAVELER_CONFIG_DIR when starting node to point to the correct directory" 
fi

# SET PATH variable 
HOST_ARCH=`uname | tr [A-Z] [a-z]`-`uname -m`

# Add to path only if directory exists.
prependPathIfDirExists() {
    _dir=$1
    if [ -d ${_dir} ]; then
        PATH=${_dir}:$PATH
    else
	echo "Warning: PATH $_dir was not added. it does not exist." 
    fi
}

prependPathIfDirExists $TRAVELER_SUPPORT_DIR/mongodb/$HOST_ARCH/bin
prependPathIfDirExists $TRAVELER_SUPPORT_DIR/nodejs/$HOST_ARCH/bin
prependPathIfDirExists $TRAVELER_SUPPORT_DIR/nodejs/node_modules/forever/bin

# Done 
cd $currentDir