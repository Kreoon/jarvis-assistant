FROM node:22-alpine

# Install python3, yt-dlp, ffmpeg for social media extraction
RUN apk add --no-cache python3 py3-pip ffmpeg bash git openssh-client docker-cli
RUN python3 -m pip install --break-system-packages yt-dlp

RUN git config --global user.email "jarvis@kreoon.com" &&     git config --global user.name "Jarvis Bot"

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src/ ./src/
COPY data/ ./data/

RUN npm run build

RUN mkdir -p /app/data/memory/general /app/data/memory/conversations /app/data/tmp

EXPOSE 3000

CMD ["node", "dist/server.js"]
