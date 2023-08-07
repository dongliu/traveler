This document describes the steps to install the traveler application. These steps can be automated in a puppet or docker platform. 

## Install node.js LTS

Check OS release
```shell
cat /etc/os-release
```

Check if yum is available. Install if not.

```shell
which yum
```
Check available node.js from the default yum repo. 

```shell
yum list nodejs
```
Check https://nodejs.org/en/about/releases/ for the current LTS node version. 

You will need `curl` to install. 
```shell
which curl
```

E.g. in order to install node v14. 
```shell
curl -sL https://rpm.nodesource.com/setup_14.x | sudo bash -
sudo yum install -y nodejs
```

Check https://github.com/nodesource/distributions for the current LTS. 

After install, verify the `node` and `npm` version. 
```shell
which node
node --version
which npm
npm --version
```

## Install mongodb 3.4 

Following https://www.digitalocean.com/community/tutorials/how-to-install-mongodb-on-centos-7 to install on centos 7. 
```shell
sudo nano /etc/yum.repos.d/mongodb-org.repo
```
Add the following
```
[mongodb-org-3.4]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/$releasever/mongodb-org/3.4/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-3.4.asc
```
```shell
yum repolist
sudo yum install mongodb-org
```
Check `mongod` with `systemctl` after installation. 
```shell
sudo systemctl stop mongod
sudo systemctl status mongod
```
### Optimize mongodb

See https://docs.mongodb.com/manual/tutorial/transparent-huge-pages/ for how to disable THP. 


## Install the traveler application and config

Add a `traveler` user to run the application on the box with node.js. 
```shell
useradd -m -d /home/traveler traveler
sudo passwd traveler
```

At `/home/traveler`,
```shell
git clone https://github.com/dongliu/traveler.git 
```

Copy the `config` directory from the repo root to `/home/traveler/traveler-config/`. Update the configuration files according to the installation. See the `docker` directory for example. 

## Install PM2 and config

As an admin user
```shell
sudo npm install pm2@latest -g
which pm2
```

As the `traveler` user
```shell
pm2 install pm2-logrotate
```

Start the traveler application with pm2. This requires the application is properly configured. 
```shell
NODE_ENV=production TRAVELER_CONFIG_REL_PATH=../traveler-config/ pm2 start --name traveler app.js
```

### Save the pm2 script 
```shell
pm2 save
```
pm2 files will be created at `/home/traveler/.pm2`.

As the admin user
```shell
sudo env PATH=$PATH:/usr/bin pm2 startup centos -u traveler --hp /home/traveler
```

Check if traveler script is properly created by
```shell
cat /etc/systemd/system/pm2-traveler.service
```
Reboot the box and the traveler application should start. 
