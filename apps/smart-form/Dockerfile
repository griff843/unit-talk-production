# ==============================================
# Multi-stage Dockerfile for Unit Talk Smart Form
# SPRINT-FRONTEND-CONTAINER-TRUTH-LOCK-102B: Production mode execution
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
# DEVELOPMENT STAGE (runs production build)
# SPRINT-FRONTEND-CONTAINER-TRUTH-LOCK-102B: No dev mode - always production
# ==============================================
FROM base AS development

# Copy monorepo root pnpm files (context is repo root)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy all source code first (before pnpm install)
COPY packages ./packages
COPY apps/smart-form ./apps/smart-form
COPY config ./config

# Install all workspace dependencies (ignore-scripts skips husky)
# This runs AFTER copying source to create correct symlinks
RUN pnpm install --frozen-lockfile --ignore-scripts

WORKDIR /app/apps/smart-form

# Build Next.js application in production mode
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN pnpm run build

# Expose port (internal: 3021)
EXPOSE 3021

# Health check using /api/health endpoint
HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=30 \
  CMD curl -f http://127.0.0.1:3021/api/health || exit 1

# Production start using standalone server
# SPRINT-FRONTEND-CONTAINER-TRUTH-LOCK-102B: No dev mode - production only
CMD ["node", ".next/standalone/apps/smart-form/server.js"]

# ==============================================
# BUILD STAGE (for external production builds)
# ==============================================
FROM base AS builder

# Copy monorepo root pnpm files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy all source code first
COPY packages ./packages
COPY apps/smart-form ./apps/smart-form
COPY config ./config

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

WORKDIR /app

# Copy monorepo root pnpm files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy workspace source (needed for pnpm install to work)
COPY packages ./packages
COPY apps/smart-form ./apps/smart-form
COPY config ./config

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

# Expose port (internal: 3021)
EXPOSE 3021

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=30 \
  CMD curl -f http://127.0.0.1:3021/api/health || exit 1

# Production start
ENV PORT=3021
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
