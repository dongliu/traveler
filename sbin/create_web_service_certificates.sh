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
    read -p "Enter key bit length [1024]: " keysize

		export CN=`hostname -f`
    openssl genrsa -out $CN.key $keysize || exit 1
    openssl req -config $TRAVELER_ROOT_DIR/etc/openssl.default.cnf -new -key $CN.key -out $CN.csr
    openssl x509 -sha512 -req -days 365 -in $CN.csr -signkey $CN.key -out $CN.crt

		chmod 400 ./$CN.key
		chmod 400 ./$CN.csr
		chmod 400 ./$CN.crt
fi

cd $CUR_DIR
