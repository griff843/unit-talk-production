# ==============================================
# Multi-stage Dockerfile for Unit Talk Discord Bot
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
COPY apps/discord-bot/package.json ./apps/discord-bot/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY packages/database/package.json ./packages/database/
COPY packages/config/package.json ./packages/config/

# Install all dependencies using npm ci for reproducibility
RUN npm ci && npm cache clean --force

# Copy source code
COPY apps/discord-bot/ ./apps/discord-bot/
COPY packages/ ./packages/

# Set working directory to app
WORKDIR /app/apps/discord-bot

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S botuser -u 1001 && \
    chown -R botuser:nodejs /app

USER botuser

# Expose port (for health check endpoint)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('Health check')" || exit 1

# Start in development mode
CMD ["npm", "run", "dev"]

# ==============================================
# BUILD STAGE
# ==============================================
FROM base AS builder

WORKDIR /app

# Copy root package files including lockfile
COPY package.json package-lock.json ./

# Copy workspace package files
COPY apps/discord-bot/package.json ./apps/discord-bot/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY packages/database/package.json ./packages/database/
COPY packages/config/package.json ./packages/config/

# Install all dependencies for building
RUN npm ci

# Copy source code
COPY apps/discord-bot/ ./apps/discord-bot/
COPY packages/ ./packages/

# Build the application
WORKDIR /app/apps/discord-bot
RUN npm run build

# ==============================================
# PRODUCTION STAGE
# ==============================================
FROM base AS production

WORKDIR /app

# Copy root package files including lockfile
COPY package.json package-lock.json ./

# Copy workspace package files
COPY apps/discord-bot/package.json ./apps/discord-bot/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY packages/database/package.json ./packages/database/
COPY packages/config/package.json ./packages/config/

# Install only production dependencies using npm ci
RUN npm ci --omit=dev && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/apps/discord-bot/dist ./apps/discord-bot/dist

# Set working directory to app
WORKDIR /app/apps/discord-bot

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S botuser -u 1001 && \
    chown -R botuser:nodejs /app

USER botuser

# Expose port (for health check endpoint)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('Health check')" || exit 1

# Start the bot
CMD ["npm", "start"]
