FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
COPY apps/frontend/package.json apps/frontend/package.json
RUN npm install
COPY apps/frontend apps/frontend
RUN npm run build --workspace=@rmrp/frontend
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY apps/frontend/package.json apps/frontend/package.json
RUN npm install --omit=dev
COPY --from=build /app/apps/frontend/.next apps/frontend/.next
COPY --from=build /app/apps/frontend/next.config.mjs apps/frontend/next.config.mjs
EXPOSE 3000
CMD ["node", "apps/frontend/.next/standalone/server.js"]
