FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
COPY apps/discord-collector/package.json apps/discord-collector/package.json
RUN npm install
COPY apps/discord-collector apps/discord-collector
CMD ["npm", "run", "start", "--workspace=@rmrp/discord-collector"]
