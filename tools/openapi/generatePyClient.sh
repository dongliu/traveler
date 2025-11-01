#!/bin/bash

#
# Script used to generate the required API from the api definitions. 
#
# Usage:
#
# $0
#

MY_DIR=`dirname $0` && cd $MY_DIR && MY_DIR=`pwd`
ROOT_DIR=$MY_DIR

OPEN_API_VERSION="4.3.1"
OPEN_API_GENERATOR_JAR="openapi-generator-cli-$OPEN_API_VERSION.jar"
OPEN_API_GENERATOR_JAR_URL="https://repo1.maven.org/maven2/org/openapitools/openapi-generator-cli/$OPEN_API_VERSION/$OPEN_API_GENERATOR_JAR" 

GEN_CONFIG_FILE_PATH=$MY_DIR/ClientApiConfig.yml
GEN_OUT_DIR="pythonApi"


OPENAPI_YML_PATH="./openapi.yaml"

cd $ROOT_DIR

curl -O $OPEN_API_GENERATOR_JAR_URL

java -jar $OPEN_API_GENERATOR_JAR  generate -i "$OPENAPI_YML_PATH" -g python -o $GEN_OUT_DIR -c $GEN_CONFIG_FILE_PATH

# Clean up
rm travelerApi -rv
rm $OPEN_API_GENERATOR_JAR

# Fetch the generated Api
cd $GEN_OUT_DIR
cp -rv travelerApi ../
cd ..

# Clean up
rm -rf $GEN_OUT_DIR
