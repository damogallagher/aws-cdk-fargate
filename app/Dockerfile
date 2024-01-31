FROM node:21-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 80
CMD [ "node", "app.js" ]