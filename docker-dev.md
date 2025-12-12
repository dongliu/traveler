Follow this instruction to set up a local development for traveler.

## install docker on your dev environment

Follow <https://docs.docker.com/get-started/introduction/get-docker-desktop/> for instructions.

After installation finished, start the docker desktop, configure it for CPU, memory, and storage that you want it to use on your dev machine.

Check if the docker desktop has `docker compose` installed on your environment. Compose is a default component of the docker desktop for recent releases. If not, you need to install docker compose, see <https://docs.docker.com/compose/install/>.

## create development network

Make sure you have the `traveler-dev` network in the docker.

```
docker network list
```

If not, run the following in your console to create the network.

```
docker network create -d bridge --subnet 172.18.1.0/24 traveler-dev
```

## get the dependencies

See <https://github.com/dongliu/traveler-mongo> for mongodb and mongo express.

See <https://github.com/dongliu/traveler-ldap> for open ldap and a php ldap admin web interface.

see <https://github.com/dongliu/traveler-mail> for email support.

Please follow the `README.md` in each of the repo for how to verify if the service is up and running. You can see the status containers from your docker desktop UI, and check the log if there is any issue.

## build and run the traveler application

Clone this repo to your local environment, and switch the the branch you want to test. The traveler application can be run by

```
docker compose up
```

The traveler application web UI can be accessed at <http://localhost:3001> .

See <https://github.com/dongliu/traveler-ldap/blob/master/seed/traveler.ldif> for all the users available in the local LDAP service. You can use any of those user to log into the local traveler web application. You can also add new users to the local LDAP service via its web UI.

If you want to server the application or the api on https, add `ssl_key` and `ssl_cert` configurations in the `app.json` and `api.json` files. You will need valid key and cert files in the `docker` directory, and set the values of `ssl_key` and `ssl_cert` to the name of the files.

When you run for the first time, docker will build the image for you. If the application does not start successfully, try

```
docker compose --verbose up
```

for detailed information. You should also check the logs of mongodb and open ldap service to see if there is an issue with those services. You can ssh into the running container with `docker exec -it traveler_web_1 /bin/sh`, where `traveler_web_1` is the running container name.

`docker container list` shows all the containers running on your local in console. But docker desktop is easier to use.

Run

```
docker compose down
```

to stop the application.

You can run with `docker compose up -d` in a detached mode. Then you can run `docker compose logs -f` to check the application log.

## rebuild without cache

When the `Dockerfile` is updated, e.g., using a new node.js version, or when the node prod packages are updated, run the following command to rebuild the image.

```
docker compose build --no-cache
```

## clean the traveler docker image

Run `docker image list` to see the images on your local. `docker image remove image_name` to clean the image from your local.
