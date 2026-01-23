# ==============================================
# Multi-stage Dockerfile for Unit Talk Smart Form
# Next.js application with development support
# Reproducible builds with npm ci + lockfile
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

# ==============================================
# DEVELOPMENT STAGE
# ==============================================
FROM base AS development

# Copy root package files including lockfile for reproducible builds
COPY package.json package-lock.json ./

# Copy workspace package files
COPY apps/smart-form/package.json ./apps/smart-form/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY packages/database/package.json ./packages/database/
COPY packages/config/package.json ./packages/config/

# Install all dependencies using npm ci for reproducibility
RUN npm ci && npm cache clean --force

# Copy source code
COPY apps/smart-form/ ./apps/smart-form/
COPY packages/ ./packages/

# Set working directory to app
WORKDIR /app/apps/smart-form

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

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
COPY apps/smart-form/package.json ./apps/smart-form/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY packages/database/package.json ./packages/database/
COPY packages/config/package.json ./packages/config/

# Install all dependencies for building
RUN npm ci

# Copy source code
COPY apps/smart-form/ ./apps/smart-form/
COPY packages/ ./packages/

# Build Next.js application
WORKDIR /app/apps/smart-form
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ==============================================
# PRODUCTION STAGE
# ==============================================
FROM base AS production

WORKDIR /app

# Copy root package files including lockfile
COPY package.json package-lock.json ./

# Copy workspace package files
COPY apps/smart-form/package.json ./apps/smart-form/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY packages/database/package.json ./packages/database/
COPY packages/config/package.json ./packages/config/

# Install only production dependencies using npm ci
RUN npm ci --omit=dev && npm cache clean --force

# Copy built application
COPY --from=builder /app/apps/smart-form/.next/standalone ./
COPY --from=builder /app/apps/smart-form/.next/static ./apps/smart-form/.next/static
COPY --from=builder /app/apps/smart-form/public ./apps/smart-form/public

# Set working directory to app
WORKDIR /app/apps/smart-form

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
