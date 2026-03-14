FROM node:20-alpine

RUN apk add --no-cache git openssh-client

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

CMD ["node", "dist/index.js"]
