# use docker to set up traveler development environment

## install docker

See <https://docs.docker.com/install/> for instructions.

You will alos need to install docker compose if it does not come with docker, see <https://docs.docker.com/compose/install/#install-compose>.

## create development network

The traveler application and its dependencies will be running in the same network named `traveler-dev`. Run the following to create the network.

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

The traveler application can be accessed at <https://localhost:3001>

When you run for the first time, docker will build the image for you. If the application does not start successfully, try
```
docker-compose --verbose up
```
for detailed information. You should also check the logs of mongodb and open ldap service to see if there is an issue with those services. You can ssh into the running container with `docker exec -it traveler-aps_web_1 /bin/bash`, where `traveler-aps_web_1` is the running container name.

Run
```
docker-compose down
```
to stop the appplication.

You can run with `docker-compose up -d` in a detached mode. Then you can run `docker-compose logs -f` to check the application log.


