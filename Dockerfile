# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/* \
  && useradd --system --uid 1001 saathi && mkdir -p /data && chown saathi /data
COPY --from=build --chown=saathi /app ./
USER saathi
ENV DATABASE_URL="file:/data/saathi.db"
EXPOSE 3000
# Create/upgrade the schema on boot, then serve. The reminder scheduler runs in-process.
CMD ["sh", "-c", "node scripts/prisma.mjs db push --skip-generate && npm run start"]
