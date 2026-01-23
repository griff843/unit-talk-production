# ==============================================
# Multi-stage Dockerfile for Unit Talk API
# Fortune 100-grade production & development
# Reproducible builds with npm ci + lockfile
# ==============================================

# Base image with build tools (using Debian-based image for glibc compatibility)
# Using Node.js 20 as required by multiple dependencies
FROM node:20-slim AS base

# Install system dependencies including native module build tools
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    gcc \
    curl \
    bash \
    git \
    build-essential \
    libc6-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# ==============================================
# DEVELOPMENT STAGE
# ==============================================
FROM base AS development

# Copy root package files including lockfile for reproducible builds
COPY package.json package-lock.json ./

# Copy workspace package files
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY packages/database/package.json ./packages/database/
COPY packages/config/package.json ./packages/config/

# Install all dependencies using npm ci for reproducibility
RUN npm ci && npm cache clean --force

# Copy source code
COPY apps/api/ ./apps/api/
COPY packages/ ./packages/

# Set working directory to app
WORKDIR /app/apps/api

# Rebuild native modules for Temporal SDK
RUN npm rebuild @temporalio/core-bridge

# Expose ports (app, debug, metrics)
EXPOSE 3000 9229 9464

# Health check (using port 3030 to match API_PORT in .env)
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3030/api/health || exit 1

# Development start with hot reload
CMD ["npm", "run", "start:dev"]

# ==============================================
# BUILD STAGE
# ==============================================
FROM base AS builder

WORKDIR /app

# Copy root package files including lockfile
COPY package.json package-lock.json ./

# Copy workspace package files
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY packages/database/package.json ./packages/database/
COPY packages/config/package.json ./packages/config/

# Install all dependencies for building
RUN npm ci

# Copy source code
COPY apps/api/ ./apps/api/
COPY packages/ ./packages/

# Build TypeScript
WORKDIR /app/apps/api
RUN npm run build

# ==============================================
# PRODUCTION STAGE
# ==============================================
FROM base AS production

WORKDIR /app

# Copy root package files including lockfile
COPY package.json package-lock.json ./

# Copy workspace package files
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY packages/database/package.json ./packages/database/
COPY packages/config/package.json ./packages/config/

# Install only production dependencies using npm ci
RUN npm ci --omit=dev && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/migrations ./apps/api/migrations
COPY --from=builder /app/apps/api/config ./apps/api/config

# Set working directory to app
WORKDIR /app/apps/api

# Expose port
EXPOSE 3000

# Health check (using port 3030 to match API_PORT in .env)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3030/api/health || exit 1

# Production start
CMD ["npm", "start"]
