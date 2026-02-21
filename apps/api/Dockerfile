# ==============================================
# Multi-stage Dockerfile for Unit Talk API
# Fortune 100-grade production & development
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

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@10.29.3 --activate

# ==============================================
# DEVELOPMENT STAGE
# ==============================================
FROM base AS development

# Copy monorepo root pnpm files (context is repo root)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy all source code first (before pnpm install)
COPY packages ./packages
COPY apps/api ./apps/api

# Install all workspace dependencies (ignore-scripts skips husky)
# This runs AFTER copying source to create correct symlinks
RUN pnpm install --frozen-lockfile --ignore-scripts

WORKDIR /app/apps/api

# Rebuild native modules for Temporal SDK
RUN pnpm rebuild @temporalio/core-bridge

# Development mode - run as root for simplicity during Docker build issues
# TODO: Switch back to non-root user once build is stable

# Expose ports (app, debug, metrics)
EXPOSE 3000 9229 9464

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Development start with hot reload
CMD ["npm", "run", "start:dev"]

# ==============================================
# BUILD STAGE
# ==============================================
FROM base AS builder

# Copy monorepo root pnpm files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy all source code first
COPY packages ./packages
COPY apps/api ./apps/api

# Install all dependencies for building
RUN pnpm install --frozen-lockfile --ignore-scripts

WORKDIR /app/apps/api

# Build TypeScript
RUN pnpm run build

# ==============================================
# PRODUCTION STAGE
# ==============================================
FROM base AS production

# Copy monorepo root pnpm files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy workspace source (needed for pnpm install to work)
COPY packages ./packages
COPY apps/api ./apps/api

# Install only production dependencies
RUN pnpm install --frozen-lockfile --ignore-scripts --prod

WORKDIR /app/apps/api

# Copy built application from builder stage (overwrites source with built)
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/migrations ./migrations
COPY --from=builder /app/apps/api/config ./config

# Production mode - TODO: Add non-root user back after development testing

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Production start
CMD ["npm", "start"]