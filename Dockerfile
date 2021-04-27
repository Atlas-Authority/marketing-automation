FROM node:14
ARG git_sha
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --only=production
ENV GITSHA=$git_sha
COPY . .
ENV NODE_ENV=production
CMD [ "node", "bin/main.js", "--downloader=live", "--uploader=live" ]
