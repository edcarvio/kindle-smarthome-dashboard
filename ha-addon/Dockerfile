ARG BUILD_FROM=ghcr.io/hassio-addons/base:17.2.5
FROM ${BUILD_FROM}

RUN apk add --no-cache nodejs npm

WORKDIR /app

COPY websocket-proxy/package.json websocket-proxy/package-lock.json ./
RUN npm ci --omit=dev

COPY websocket-proxy/ ./

COPY run.sh /
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]
