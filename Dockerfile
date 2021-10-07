FROM node:14-alpine
WORKDIR /app
COPY package.json .
COPY package-lock.json .
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
RUN npm install --only=prod
RUN npm install -g nodemon@2
COPY . .
# RUN bower install
CMD ["node", "app.js"]
