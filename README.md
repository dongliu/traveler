# Traveler

# Instalation

For detailed deployment instructions please see https://confluence.aps.anl.gov/display/APSUCMS/Developer+Guide+for+the+Traveler+Module

**Deployment of the traveler module:**

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

**Starting the traveler module:**

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
    
**Installing docker version (not for production use, but good for development and evaluation)**

1. centos docker install (centos) https://docs.docker.com/install/linux/docker-ce/centos/ 
   * uninstall old docker versions
   ```
   sudo yum remove docker \
                  docker-client \
                  docker-client-latest \
                  docker-common \
                  docker-latest \
                  docker-latest-logrotate \
                  docker-logrotate \
                  docker-selinux \
                  docker-engine-selinux \
                  docker-engine
   ```
   * install docker CE
   ```
   sudo yum install -y yum-utils \
      device-mapper-persistent-data \
      lvm2
   sudo yum-config-manager \
      --add-repo \
      https://download.docker.com/linux/centos/docker-ce.repo
   sudo yum install docker-ce
   sudo systemctl start docker
   ```
   * test docker install
   ```
   sudo docker run hello-world
   ```
   * configure docker to start on boot
   ```
   sudo systemctl enable docker
   ```
   * install docker-compose https://docs.docker.com/compose/install/ 
   ```
   sudo curl -L "https://github.com/docker/compose/releases/download/1.23.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   sudo ln -s /usr/local/bin/docker-compose /usr/bin/docker-compose
   ```
   * test docker-compose
   ```
   sudo docker-compose --version
   ```
2. create docker network for running traveler related apps
   ```
   sudo docker network create -d bridge --subnet 172.18.1.0/24 traveler-dev
   ```
3. install dependencies
   * traveler-mongo https://github.com/dongliu/traveler-mongo 
      * clone git repo
      ```
      git clone https://github.com/dongliu/traveler-mongo.git (to e.g., ~/git/traveler)
      ```
      * run traveler-mongo
      ```
      sudo docker-compose up 
      ```
      * access mongo express at http://localhost:8081. The username is traveler, and password is travelerpass.
   * traveler-ldap https://github.com/dongliu/traveler-ldap 
      * clone git repo
      ```
      git clone https://github.com/dongliu/traveler-ldap.git
      ```
      * run
      ```
      sudo docker-compose up
      ```
      * test
         * You can check the state of the openladp service via the php ldap admin web https://localhost:6443. There is a default admin account that you can use to log in user name: cn=admin,dc=example,dc=org password: admin
4. install traveler https://github.com/AdvancedPhotonSource/traveler 
   * clone git repo
   ```
   git clone https://github.com/AdvancedPhotonSource/traveler.git
   ```
   * to run and test
      * must “sudo docker-compose up” traveler-mongo and traveler-ldap as described above first
      ```
      sudo docker-compose up
      ```
      * URL to run traveler is https://localhost:3001
      * find a user login in the ldap file traveler-ldap/seed/traveler.ldif


# Style and Lint

[prettier](https://prettier.io/) is configured in `prettier.config.js` and `.prettierignore`, and hooked with git at `package.json`. The prettier will process for js, json, css, and md files when the hooked action is triggered via husky. The prettier can be run mannually as
`./node_modules/prettier/bin-prettier.js --config ./prettier.config.js --write {.,config/**,lib/**,model/**,public/javascripts/**,public/stylesheets/**,routes/**,test/**,utilities/**}/*.{js,json,css,md}` .

Recommend to use [ESLint](http://eslint.org/) to lint the code before committing. The ESLint configuration file is `.eslintrc`.

# License

[MIT](https://github.com/dongliu/traveler/blob/master/LICENSE.md)
