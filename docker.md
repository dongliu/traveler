# use docker to set up traveler development environment

## install docker

See <https://docs.docker.com/get-docker/> for instructions.

After installation finished, start the docker desktop, configure it for CPU, memory, and storage that you want it to use on your machine.

Check if the docker desktop has `docker-compose` installed on your machine. If not, you need to install docker compose, see <https://docs.docker.com/compose/install/>.

## create development network

Clone this repo to your local environment. Make sure you have the `traveler-dev` network in the docker.
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

## build and run the application

The traveler application can be run by running

```
docker-compose up
```

The traveler application can be accessed at <http://localhost:3001>

If you want to server the application or the api on https, add `ssl_key` and `ssl_cert` configurations in the `app.json` and `api.json` files. You will need valid key and cert files in the `docker` directory, and set the values of `ssl_key` and `ssl_cert` to the name of the files.

When you run for the first time, docker will build the image for you. If the application does not start successfully, try

```
docker-compose --verbose up
```

for detailed information. You should also check the logs of mongodb and open ldap service to see if there is an issue with those services. You can ssh into the running container with `docker exec -it traveler_web_1 /bin/sh`, where `traveler_web_1` is the running container name.

`docker container list` shows all the containers running on your local.

Run

```
docker-compose down
```

to stop the appplication.

You can run with `docker-compose up -d` in a detached mode. Then you can run `docker-compose logs -f` to check the application log.

## rebulid without cache

```
docker-compose build --no-cache
```

## clean the traveler docker image

Run `docker image list` to see the images on your local. `docker image remove image_name` to clean the image from yoru local.
