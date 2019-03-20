FROM node:8
RUN apt-get update && \
    apt-get install -y openssl

# Add Tini, see https://github.com/krallin/tini for why
ENV TINI_VERSION v0.18.0
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini /tini
RUN chmod +x /tini
ENTRYPOINT ["/tini", "--"]
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
RUN npm install
# RUN bower install
CMD ["node", "app.js"]
