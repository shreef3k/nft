FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY src ./src
COPY .env.example ./.env
EXPOSE 4000
CMD ["npm", "run", "start"]
