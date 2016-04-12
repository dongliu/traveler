#!/bin/bash

MY_DIR=`dirname $0`
CUR_DIR=`pwd`

source $MY_DIR/configure_paths.sh

echo "The script will copy the default configuration files for daemons"
DAEMON_CONFIG_DIR=$TRAVELER_ROOT_DIR/etc
if [ ! -f $TRAVELER_INSTALL_ETC_DIR/mongo-express-configuration.sh ]; then
  cp $DAEMON_CONFIG_DIR/mongo-express-configuration.default.sh $TRAVELER_INSTALL_ETC_DIR/mongo-express-configuration.sh
fi
if [ ! -f $TRAVELER_INSTALL_ETC_DIR/mongo-configuration.sh ]; then
  cp $DAEMON_CONFIG_DIR/mongo-configuration.default.sh $TRAVELER_INSTALL_ETC_DIR/mongo-configuration.sh
fi
if [ ! -f $TRAVELER_INSTALL_ETC_DIR/travelerd_configuration.sh ]; then
  cp $DAEMON_CONFIG_DIR/travelerd_configuration.default.sh $TRAVELER_INSTALL_ETC_DIR/travelerd_configuration.sh
fi

echo -e "\nConfiugre MongoDB"
$MY_DIR/configure_mongo_dev.sh

read -p "Would you like to run web application using ssl? (Y/n): " appSSL
read -p "Would you like to run api using ssl? (Y/n): " apiSSL
read -p "Would you like to configure traveler-mongo-express-daemon to use ssl? (Y/n): " mongoExpressSSL

if [[ -z $appSSL ]]; then
  appSSL="y"
fi
if [[ -z $apiSSL ]]; then
  apiSSL="y"
fi
if [[ -z $mongoExpressSSL ]]; then
  mongoExpressSSL="y"
fi

if [ $appSSL == "y" -o $apiSSL == "y" -o $mongoExpressSSL == "y" \
  -o $appSSL == "Y" -o $apiSSL == "Y" -o $mongoExpressSSL == "Y" ]; then
  if [ ! -d $TRAVELER_CONFIG_DIR/ssl ]; then
     mkdir -p $TRAVELER_CONFIG_DIR/ssl
  fi

  echo -e "\nThe configuration for ssl will include files ssl/node.key and ssl/node.pem within the config folder"
  read -p "Would you like to run script to create self signed certificates for the configuration? (Y/n): " createCerts
  if [[ -z $createCerts ]]; then
    createCerts="y"
  fi
  SSL_BASE_NAME=`hostname -f`
  if [ $createCerts == 'y' -o $createCerts == 'Y' ]; then
  	$MY_DIR/create_web_service_certificates.sh
  else
  	echo -e "\nThe certificate and private key should be placed in: "
  	echo "$TRAVELER_CONFIG_DIR/ssl/"
  	echo "Please enter the name of your crt and key file without extension (ex: node for node.crt and node.key) "
  	read -p "What would you like to store the configured name of crt and key without extension [$SSL_BASE_NAME]: " SSL_BASE_NAME
    if [[ -z $SSL_BASE_NAME ]]; then
      SSL_BASE_NAME=`hostname -f`
    fi
  fi
fi

if [ $mongoExpressSSL == "y" -o $mongoExpressSSL == "Y" ]; then
  mongoExpressConfigFile=$TRAVELER_INSTALL_ETC_DIR/mongo-express-configuration.sh
  cmd="cat $mongoExpressConfigFile | sed 's?#export MONGO_EXPRESS_SSL_ENABLED=.*?export MONGO_EXPRESS_SSL_ENABLED=true?g' > $mongoExpressConfigFile.2 && mv $mongoExpressConfigFile.2 $mongoExpressConfigFile"
  eval $cmd
  cmd="cat $mongoExpressConfigFile | sed 's?#export MONGO_EXPRESS_SSL_CRT=.*?export MONGO_EXPRESS_SSL_CRT=$TRAVELER_CONFIG_DIR/ssl/$SSL_BASE_NAME.crt?g' > $mongoExpressConfigFile.2 && mv $mongoExpressConfigFile.2 $mongoExpressConfigFile"
  eval $cmd
  cmd="cat $mongoExpressConfigFile | sed 's?#export MONGO_EXPRESS_SSL_KEY=.*?export MONGO_EXPRESS_SSL_KEY=$TRAVELER_CONFIG_DIR/ssl/$SSL_BASE_NAME.key?g' > $mongoExpressConfigFile.2 && mv $mongoExpressConfigFile.2 $mongoExpressConfigFile"
  eval $cmd
fi

source $mongoExpressConfigFile
if [[ ! -f $MONGO_EXPRESS_DAEMON_PASSWD_FILE ]]; then
  read -s -p "Please enter password for mongo-express to create passwd file for user $MONGO_EXPRESS_DAEMON_USERNAME [admin]: " mongoExpressAdminPass
  if [[ -z $mongoExpressAdminPass ]]; then
    mongoExpressAdminPass="admin"
  fi
  echo $mongoExpressAdminPass > $MONGO_EXPRESS_DAEMON_PASSWD_FILE
  chmod 400 $MONGO_EXPRESS_DAEMON_PASSWD_FILE
fi

echo "Creating configuration files: "

# Create configuration files

# Prompt user for api information
read -s -p "Please enter the password for the api readOnly access (it will be stored in a configuration file) [readOnly]: " apiReadPass
echo ''
read -s -p "[OPTIONAL] Please enter the password for the api write access (it will be stored in a configuration file): " apiWritePass
echo ''
read -p "Please enter the port for the api [3443]: " apiPort

if [[ -z $apiReadPass ]]; then
  apiReadPass="readOnly"
fi
if [[ -z $apiPort ]]; then
  apiPort=3443
fi

# API config file
apiJson="{"
apiJson="$apiJson\n   \"api_users\": {"
apiJson="$apiJson\n       \"api_read\": \"$apiReadPass\""
if [ ! -z $apiWritePass ]; then
    apiJson="$apiJson,\n       \"api_write\": \"$apiWritePass\""
fi
apiJson="$apiJson\n    },"
apiJson="$apiJson\n   \"app_port\": \"$apiPort\""
if [ $apiSSL = "y" ]; then
  apiJson="$apiJson,\n   \"ssl_key\": \"ssl/$SSL_BASE_NAME.key\","
  apiJson="$apiJson\n   \"ssl_cert\": \"ssl/$SSL_BASE_NAME.crt\""
fi

apiJson="$apiJson\n}"

echo "Configuration for the api has been generated"
echo -e $apiJson

# Prompt user for web application information
read -p "Plase enter the port for the web application [3001]: " appPort
read -p "[OPTIONAL] Please enter the deployment name of this traveler instance: " deploymentName
if [[ -z $appPort ]]; then
  appPort=3001
fi

# APP config file
appJson="{"
appJson="$appJson\n   \"app_port\": \"$appPort\""
if [ $appSSL = "y" -o $appSSL = "Y" ]; then
  appJson="$appJson,\n   \"ssl_key\": \"ssl/$SSL_BASE_NAME.key\","
  appJson="$appJson\n   \"ssl_cert\": \"ssl/$SSL_BASE_NAME.crt\""
fi
if [ ! -z $deploymentName ]; then
  appJson="$appJson,\n   \"deployment_name\": \"$deploymentName\""
fi
appJson="$appJson\n}"

echo "Configuration for the web application has been generated"
echo -e $appJson

# Place the configuration files in the config directory
cd $TRAVELER_CONFIG_DIR
echo -e $apiJson > api.json
echo -e $appJson > app.json

read -p "Would you like to create a simple auth file configured for ldap type authentication? (Y/n): " createAuth

if [[ -z $createAuth ]]; then
  createAuth="y"
fi

if [ $createAuth == "y" -o $createAuth == "Y" ]; then
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
  echo -e "\nThe service configuration includes urls to external services such as devices or Component Database (CDB)"
  echo -e "A blank configuration will be created"
	echo "{}" >  service.json
fi

if [ -f "$TRAVELER_ROOT_DIR/config/ad_change.json" ]; then
  echo -e "\nThe ad configuration includes ldap configuration"
  echo -e "The default configuration will be copied"
	cp "$TRAVELER_ROOT_DIR/config/ad_change.json" ad.json
fi

if [ -f "$TRAVELER_ROOT_DIR/config/ui_change.json" ]; then
  echo -e "\nThe ui configuration includes web UI configuration"
  echo -e "The default configuration will be copied"
  cp "$TRAVELER_ROOT_DIR/config/ui_change.json" ui.json
fi

if [ -f "$TRAVELER_ROOT_DIR/config/alias_change.json" ]; then
  echo -e "\nThe alias configuration includes group naming configuration"
  echo -e "The default configuration will be copied"
  cp "$TRAVELER_ROOT_DIR/config/alias_change.json" alias.json
fi

echo -e "\nAll of the traveler configuration is located in $TRAVELER_CONFIG_DIR"

echo -e "\nNOTE: The app.json config file could also contain a list of top bar urls"
echo "   Please see $TRAVELER_ROOT_DIR/config/app_change.json."

echo -e "\nPlease edit the following configuration files before starting the application:"
echo "	ad.json"
if ! [ $createAuth == "y" -o $createAuth == "Y" ]; then
	echo "	auth.json"
fi

cd $CUR_DIR
