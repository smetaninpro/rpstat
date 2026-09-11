FROM mcr.microsoft.com/playwright:v1.63.0-noble
WORKDIR /app
COPY package*.json ./
COPY apps/discord-collector/package.json apps/discord-collector/package.json
RUN npm install
COPY apps/discord-collector apps/discord-collector
CMD ["sh", "-c", "Xvfb :99 -screen 0 1440x900x24 -nolisten tcp & export DISPLAY=:99; sleep 1; exec npm run start --workspace=@rmrp/discord-collector"]
