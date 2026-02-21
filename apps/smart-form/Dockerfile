# ==============================================
# Multi-stage Dockerfile for Unit Talk Smart Form
# Next.js application with development support
# ==============================================

# Base image
FROM node:18-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    curl \
    bash \
    git \
    && rm -rf /var/cache/apk/*

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
COPY apps/smart-form ./apps/smart-form

# Install all workspace dependencies (ignore-scripts skips husky)
# This runs AFTER copying source to create correct symlinks
RUN pnpm install --frozen-lockfile --ignore-scripts

WORKDIR /app/apps/smart-form

# Note: Development stage runs as root for volume mount compatibility
# Production stage uses non-root user (see below)

# Expose port
EXPOSE 3021

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3021/api/health || exit 1

# Development start
CMD ["npm", "run", "dev"]

# ==============================================
# BUILD STAGE
# ==============================================
FROM base AS builder

# Copy monorepo root pnpm files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy all source code first
COPY packages ./packages
COPY apps/smart-form ./apps/smart-form

# Install all workspace dependencies
RUN pnpm install --frozen-lockfile --ignore-scripts

WORKDIR /app/apps/smart-form

# Build Next.js application
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm run build

# ==============================================
# PRODUCTION STAGE
# ==============================================
FROM base AS production

# Copy monorepo root pnpm files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy workspace source (needed for pnpm install to work)
COPY packages ./packages
COPY apps/smart-form ./apps/smart-form

# Install only production dependencies
RUN pnpm install --frozen-lockfile --ignore-scripts --prod

WORKDIR /app/apps/smart-form

# Copy built application (overwrites source with optimized build)
COPY --from=builder /app/apps/smart-form/.next/standalone ./
COPY --from=builder /app/apps/smart-form/.next/static ./.next/static
COPY --from=builder /app/apps/smart-form/public ./public

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Production start
CMD ["node", "server.js"]