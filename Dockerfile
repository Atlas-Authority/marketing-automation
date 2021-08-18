FROM node:16
WORKDIR /usr/src/app
COPY package*.json ./
COPY bin ./bin
COPY lib ./lib
RUN npm install --only=production
ENV NODE_ENV=production
CMD [ "node", "bin/main.js", "--downloader=live", "--uploader=live" ]
