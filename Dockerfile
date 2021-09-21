FROM node:14-alpine
RUN apk update && \
    apk add openssl

# Add Tini, see https://github.com/krallin/tini for why
RUN apk add --no-cache tini
# Tini is now available at /sbin/tini
ENTRYPOINT ["/sbin/tini", "--"]
# web port
EXPOSE 3001
# api port if https enabled
# EXPOSE 3443

COPY . /app
WORKDIR /app
RUN npm install --only=prod
RUN npm install -g nodemon@1.18.10
# RUN bower install
CMD ["node", "app.js"]
