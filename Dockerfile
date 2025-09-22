FROM node:24-alpine AS builder

USER node 
WORKDIR /home/node

RUN npm config set proxy $http_proxy
RUN npm config set https-proxy $https_proxy

COPY package*.json ./
RUN npm ci

COPY --chown=node:node . .

RUN npm run build && npm prune --production

FROM builder AS tj-batch

USER root
RUN apk add cmd:wpd2text

USER node

COPY --from=builder --chown=node:node /home/node/dist/tj ./dist/tj

CMD ["node", "dist/tj/index.js"]

FROM builder AS tcom-batch

USER node

COPY --from=builder --chown=node:node /home/node/dist/tcom ./dist/tcom

CMD ["node", "dist/tcom/index.js"]

FROM builder AS portalis-batch

USER node

COPY --from=builder --chown=node:node /home/node/dist/portalis ./dist/portalis

CMD ["node", "dist/portalis/index.js"]


####################
# Local development
####################
FROM node:24-alpine AS builder-local

ENV NODE_ENV=local

USER node
WORKDIR /home/node

COPY --chown=node:node . .
RUN npm i

FROM builder-local AS tj-batch-local

USER root
RUN apk add cmd:wpd2text

USER node

CMD ["npm", "run", "batch:start:tj"]

FROM builder-local AS tcom-batch-local

USER node

CMD ["npm", "run", "batch:start:tcom"]

FROM builder-local AS portalis-batch-local

USER node

CMD ["npm", "run", "batch:start:portalis"]