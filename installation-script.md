# Instalation - the one box Linux script way

For detailed deployment instructions please see https://confluence.aps.anl.gov/display/APSUCMS/Developer+Guide+for+the+Traveler+Module

**Deployment of the traveler module:**

```shell
# Make a new directory to hold the traveler module and its support
mkdir traveler
cd traveler
git clone https://github.com/AdvancedPhotonSource/traveler.git distribution
cd distribution
# Install all of the support software
make support
# Automate configuration of the application
make default-config
# Navigate to configuration directory
cd ../etc/traveler-config
# End of output from make dev-config has a list of file(s) that need to be edited
nano ad.json
```

**Starting the traveler module:**

```shell
# Navigate to the distirbution of the traveler module
# When using the support mongodb, start the mongodb part of support
./etc/init.d/traveler-mongodb start
# It is good to start the project using node to make sure everything works properly.
source setup.sh
node app.js
# When everything works, start traveler as daemon
./etc/init.d/traveler-webapp start
# Check progress of traveler-webapp
./etc/init.d/traveler-webapp status
```