# Build TypeScript
FROM node:16 AS build
WORKDIR /usr/src/app
COPY package*.json ./
COPY tsconfig.json ./
COPY jest.config.js ./
COPY src ./src
RUN npm install
RUN npm run build

# Install deps & build image
FROM node:16
WORKDIR /usr/src/app
VOLUME /usr/src/app/data
COPY package*.json ./
RUN npm install --only=production
COPY --from=build /usr/src/app/out ./out
ENV NODE_ENV=production
CMD [ "node", "out/bin/main.js" ]
