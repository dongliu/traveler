FROM node:12-alpine
RUN apk update && \
    apk add openssl

# Add Tini, see https://github.com/krallin/tini for why
RUN apk add --no-cache tini
# Tini is now available at /sbin/tini
ENTRYPOINT ["/sbin/tini", "--"]
# web port
EXPOSE 3001
# api port
EXPOSE 3443

COPY . /app
# create the certification file for ssl
WORKDIR /app/docker
RUN PASSWORD=$(openssl rand -hex 16) && \
    openssl genrsa -des3 -passout "pass:${PASSWORD}" -out server.pass.key 2048 && \
    openssl rsa -passin "pass:${PASSWORD}" -in server.pass.key -out server.key && \
    rm server.pass.key && \
    openssl req -new -key server.key -out server.csr \
        -subj "/C=US/ST=WA/L=Seattle/O=Traveler/OU=Dev/CN=example.com" && \
    openssl x509 -req -days 365 -in server.csr -signkey server.key -out server.crt
WORKDIR /app
RUN npm install --only=prod
RUN npm install -g nodemon@1.18.10
# RUN bower install
CMD ["node", "app.js"]
