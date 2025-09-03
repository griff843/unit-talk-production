# ==============================================
# Multi-stage Dockerfile for Unit Talk API
# Fortune 100-grade production & development
# ==============================================

# ==============================================
# Multi-stage Dockerfile for Unit Talk API (Monorepo-aware)
# ==============================================

# Use Debian-based image to support glibc (required by Temporal core-bridge)
FROM node:20-bookworm-slim AS base
WORKDIR /app

# Common: install minimal build tools only when needed
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ bash curl git \
  && rm -rf /var/lib/apt/lists/*

# ==============================================
# deps: install workspace dependencies at root
# ==============================================
FROM base AS deps
WORKDIR /app

# Copy root and workspace package manifests only
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/*/package.json ./packages/*/

# Install all workspace dependencies (dev included for build)
# Using npm install to tolerate lockfile updates due to new packages
RUN npm install --no-audit --no-fund

# ==============================================
# development: hot-reload dev target used by docker-compose
# ==============================================
FROM base AS development
WORKDIR /app

# Bring in node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy only workspace manifests required to run npm scripts in dev
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/*/package.json ./packages/*/

# Expose ports (app, debug, metrics)
EXPOSE 3000 9229 9464

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Dev start (workspace script)
WORKDIR /app/apps/api
CMD ["npm", "run", "start:dev"]

# ==============================================
# build: build database then api
# ==============================================
FROM base AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build packages in correct order
RUN npm run -w @unit-talk/database build && npm run -w @unit-talk/api build

# ==============================================
# production: minimal runtime image
# ==============================================
FROM node:20-bookworm-slim AS production
ENV NODE_ENV=production

# Create app directory and copy runtime files
WORKDIR /app/apps/api

# Copy production node_modules and built artifacts
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/migrations ./migrations
COPY --from=build /app/config /app/config

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["npm", "start"]