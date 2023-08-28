FROM node:16-alpine AS builder1
RUN apk add --no-cache python3 py3-pip make g++
RUN apk add linux-headers --repository=http://dl-cdn.alpinelinux.org/alpine/edge/main

FROM builder1 AS builder2
WORKDIR /app
COPY ./package*.json ./
RUN npm install

FROM builder2
WORKDIR /app
COPY ./src ./src
COPY ./lnd/*.proto ./lnd/

CMD ["npm", "start"]
