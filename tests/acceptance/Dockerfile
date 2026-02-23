FROM node:24-alpine3.23

WORKDIR /app

COPY package*.json .
RUN npm install

COPY tsconfig.json jest.config.json ./

CMD ["npm", "test"]
