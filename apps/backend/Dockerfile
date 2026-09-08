FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
COPY apps/backend/package.json apps/backend/package.json
RUN npm install
COPY apps/backend apps/backend
RUN npm run prisma:generate --workspace=@rmrp/backend && npm run build --workspace=@rmrp/backend
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
COPY apps/backend/package.json apps/backend/package.json
RUN npm install --omit=dev
COPY --from=build /app/apps/backend/dist apps/backend/dist
COPY --from=build /app/apps/backend/prisma apps/backend/prisma
COPY --from=build /app/node_modules/.prisma node_modules/.prisma
EXPOSE 3001
CMD ["sh", "-c", "npm run prisma:deploy --workspace=@rmrp/backend && npm run start --workspace=@rmrp/backend"]
