#!/bin/bash

MY_DIR=`dirname $0`
CUR_DIR=`pwd`

source $MY_DIR/configure_paths.sh

if [ -d $TRAVELER_CONFIG_DIR ]; then
	if [ ! -d $TRAVELER_CONFIG_DIR/ssl ]; then
		mkdir -p $TRAVELER_CONFIG_DIR/ssl
	fi
    cd $TRAVELER_CONFIG_DIR/ssl
    echo "Create a self signed certifcate for the traveler web service"
    read -p "Enter key bit length (eg 1024) " keysize
    
    openssl genrsa -out node.key $keysize || exit 1
    openssl req -new -key node.key -out certreq.csr
    openssl x509 -sha512 -req -days 365 -in certreq.csr -signkey node.key -out node.crt
fi

cd $CUR_DIR