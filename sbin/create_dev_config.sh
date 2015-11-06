#!/bin/bash

MY_DIR=`dirname $0`
CUR_DIR=`pwd`

source $MY_DIR/configure_paths.sh

echo "The script will copy the default configuration files for daemons" 
DAEMON_CONFIG_DIR=$TRAVELER_ROOT_DIR/etc
if [ ! -f $TRAVELER_INSTALL_ETC_DIR/mongo-express-confiugration.sh ]; then
    cp $DAEMON_CONFIG_DIR/mongo-express-confiugration.default.sh $TRAVELER_INSTALL_ETC_DIR/mongo-express-confiugration.sh
fi
if [ ! -f $TRAVELER_INSTALL_ETC_DIR/mongo-configuration.sh ]; then
    cp $DAEMON_CONFIG_DIR/mongo-configuration.default.sh $TRAVELER_INSTALL_ETC_DIR/mongo-configuration.sh
fi
if [ ! -f $TRAVELER_INSTALL_ETC_DIR/travelerd_configuration.sh ]; then
    cp $DAEMON_CONFIG_DIR/travelerd_configuration.default.sh $TRAVELER_INSTALL_ETC_DIR/travelerd_configuration.sh
fi

echo -e "\nConfiugre MongoDB"
$MY_DIR/configure_mongo_dev.sh

read -p "Would you like to run web application using ssl? (y/n) " appSSL
read -p "Would you like to run api using ssl? (y/n) " apiSSL
read -p "Would you like to configure traveler-mongo-express-daemon to use ssl? (y/n) " mongoExpressSSL

if [ $appSSL == "y" -o $apiSSL == "y" -o $mongoExpressSSL == "y" ]; then
    if [ ! -d $TRAVELER_CONFIG_DIR/ssl ]; then 
	mkdir -p $TRAVELER_CONFIG_DIR/ssl
    fi

    echo -e '\nThe configuration for ssl will include files ssl/node.key and ssl/node.pem within the config folder'
    read -p "Would you like to run script to create self signed certificates for the configuration? (y/n): " createCerts
    if [ $createCerts == 'y' ]; then
	$MY_DIR/create_web_service_certificates.sh
	SSL_BASE_NAME=node
    else 
	echo -e "\nThe certificate and private key should be placed in: "
	echo "$TRAVELER_CONFIG_DIR/ssl/" 
	echo "Please enter the name of your crt and key file without extension (ex: node for node.crt and node.key) "
	read -p "What would you like to store the configured name of crt and key without extension: " SSL_BASE_NAME
    fi
fi

if [ $mongoExpressSSL == "y" ]; then
    mongoExpressConfigFile=$TRAVELER_INSTALL_ETC_DIR/mongo-express-confiugration.sh
    echo -e "\n\nexport MONGO_EXPRESS_SSL_ENABLED=true" >> $mongoExpressConfigFile
    echo "export MONGO_EXPRESS_SSL_CRT=$TRAVELER_CONFIG_DIR/ssl/$SSL_BASE_NAME.crt" >> $mongoExpressConfigFile
    echo "export MONGO_EXPRESS_SSL_KEY=$TRAVELER_CONFIG_DIR/ssl/$SSL_BASE_NAME.key" >> $mongoExpressConfigFile
fi


echo "Creating configuration files: " 

# Create configuration files 

# Prompt user for api information 
read -s -p "Please enter the password for the api (it will be stored in a configuration file): " apiPass
echo ''
read -p "Plase enter the port for the api (default: 3443) " apiPort
 
if [ -z $apiPort ]; then
    apiPort=3443
fi

echo $apiPort 

# API config file
apiJson="{"
apiJson="$apiJson\n   \"api\": \"$apiPass\","
apiJson="$apiJson\n   \"app_port\": \"$apiPort\""
if [ $apiSSL = "y" ]; then
    apiJson="$apiJson,\n   \"ssl_key\": \"ssl/$SSL_BASE_NAME.key\","
    apiJson="$apiJson\n   \"ssl_cert\": \"ssl/$SSL_BASE_NAME.crt\""
fi 
apiJson="$apiJson\n}"

echo "Configuration for the api has been generated"
echo -e $apiJson

# Prompt user for web application information
read -p "Plase enter the port for the web application (default: 3001) " appPort

if [ -z $appPort ]; then
    appPort=3001
fi

# APP config file 
appJson="{"
appJson="$appJson\n   \"app_port\": \"$appPort\""
if [ $appSSL = "y" ]; then
    appJson="$appJson,\n   \"ssl_key\": \"ssl/$SSL_BASE_NAME.key\","
    appJson="$appJson\n   \"ssl_cert\": \"ssl/$SSL_BASE_NAME.crt\""
fi
appJson="$appJson\n}"

echo "Configuration for the web application has been generated" 
echo -e $appJson

# Place the configuration files in the config directory 
cd $TRAVELER_CONFIG_DIR
echo -e $apiJson > api.json
echo -e $appJson > app.json

read -p "Would you like to create a simple auth file configured for ldap type authentication? (y/n): " createAuth

if [ $createAuth == "y" ]; then
    authJson="{"
    authJson="$authJson\n   \"type\": \"ldap\","
    authJson="$authJson\n   \"service\": \"\""
    authJson="$authJson\n}"
    echo -e $authJson > auth.json  
else 
	if [ -f "$TRAVELER_ROOT_DIR/config/auth_change.json" ]; then
		echo -e "\nThe auth confiuration includes authentication and proxy information"   
		echo -e "The default configuration will be copied" 
		cp "$TRAVELER_ROOT_DIR/config/auth_change.json" auth.json	
	fi
fi


if [ -f "$TRAVELER_ROOT_DIR/config/service_change.json" ]; then
    echo -e "\nThe service confiuration includes urls to external services such as devices"   
    echo -e "The default configuration will be copied" 
	cp "$TRAVELER_ROOT_DIR/config/service_change.json" service.json
fi

if [ -f "$TRAVELER_ROOT_DIR/config/ad_change.json" ]; then
    echo -e "\nThe ad confiuration includes ldap configuration"   
    echo -e "The default configuration will be copied" 
	cp "$TRAVELER_ROOT_DIR/config/ad_change.json" ad.json
fi

echo -e "\nAll of the traveler configuration is located in $TRAVELER_CONFIG_DIR"
echo -e "\nPlease edit the following configuration files before starting the application:"
echo "	ad.json" 
if [ ! $createAuth == "y" ]; then
	echo "	auth.json"
fi 

cd $CUR_DIR