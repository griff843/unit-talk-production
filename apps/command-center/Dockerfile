# ==============================================
# Multi-stage Dockerfile for Unit Talk Command Center
# Next.js operational dashboard with real-time monitoring
# Reproducible builds with npm ci + lockfile
# ==============================================

# Base image
FROM node:20-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    curl \
    bash \
    git \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# ==============================================
# DEVELOPMENT STAGE
# ==============================================
FROM base AS development

# Copy root package files including lockfile for reproducible builds
COPY package.json package-lock.json ./

# Copy workspace package files
COPY apps/command-center/package.json ./apps/command-center/
COPY apps/command-center/tsconfig*.json ./apps/command-center/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY packages/database/package.json ./packages/database/
COPY packages/config/package.json ./packages/config/

# Install all dependencies using npm ci for reproducibility
# Note: Using --legacy-peer-deps for peer dependency conflicts
RUN npm ci --legacy-peer-deps && npm cache clean --force

# Copy source code
COPY apps/command-center/ ./apps/command-center/
COPY packages/ ./packages/

# Set working directory to app
WORKDIR /app/apps/command-center

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Development start
CMD ["npm", "run", "dev"]

# ==============================================
# BUILD STAGE
# ==============================================
FROM base AS builder

WORKDIR /app

# Copy root package files including lockfile
COPY package.json package-lock.json ./

# Copy workspace package files
COPY apps/command-center/package.json ./apps/command-center/
COPY apps/command-center/tsconfig*.json ./apps/command-center/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY packages/database/package.json ./packages/database/
COPY packages/config/package.json ./packages/config/

# Install all dependencies for building
RUN npm ci --legacy-peer-deps

# Copy source code
COPY apps/command-center/ ./apps/command-center/
COPY packages/ ./packages/

# Build Next.js application
WORKDIR /app/apps/command-center
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ==============================================
# PRODUCTION STAGE
# ==============================================
FROM base AS production

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

# Copy built application from builder (standalone output)
COPY --from=builder /app/apps/command-center/.next/standalone ./
COPY --from=builder /app/apps/command-center/.next/static ./apps/command-center/.next/static
COPY --from=builder /app/apps/command-center/public ./apps/command-center/public

# Set working directory to app
WORKDIR /app/apps/command-center

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
