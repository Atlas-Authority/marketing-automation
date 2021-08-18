FROM node:16
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --only=production
COPY . .
ENV NODE_ENV=production
CMD [ "node", "bin/main.js", "--downloader=live", "--uploader=live" ]
