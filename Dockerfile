FROM node:24-alpine AS builder

USER node 
WORKDIR /home/node

RUN npm config set proxy $http_proxy
RUN npm config set https-proxy $https_proxy

COPY package*.json ./
RUN npm ci

COPY --chown=node:node . .

RUN npm run build && npm prune --production

FROM builder AS batch

USER root
RUN apk add cmd:wpd2text

USER node

COPY --from=builder --chown=node:node /home/node/dist/ ./dist/

CMD ["node", "dist/batch.js"]

####################
# Local development
####################
FROM node:24-alpine AS batch-local

USER root
RUN apk add cmd:wpd2text

USER node
WORKDIR /home/node

COPY --chown=node:node . .

CMD ["npm", "run", "start:watch"]