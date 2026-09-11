FROM mcr.microsoft.com/playwright:v1.63.0-noble
WORKDIR /app
COPY package*.json ./
COPY apps/discord-collector/package.json apps/discord-collector/package.json
RUN npm install
COPY apps/discord-collector apps/discord-collector
CMD ["xvfb-run", "-a", "npm", "run", "start", "--workspace=@rmrp/discord-collector"]
