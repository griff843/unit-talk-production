# ==============================================
# Multi-stage Dockerfile for Unit Talk Command Center
# Next.js operational dashboard with real-time monitoring
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

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./
RUN npm install --legacy-peer-deps && npm cache clean --force

# Copy centralized configuration (CRITICAL for v3.0.0)
COPY ../../config/ ./config/

# Copy source code
COPY . .

# Development mode - run as root for simplicity during Docker troubleshooting
# TODO: Switch back to non-root user once development is stable

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

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./
RUN npm install --legacy-peer-deps

# Copy centralized configuration (CRITICAL for v3.0.0)
COPY ../../config/ ./config/

# Copy source code
COPY . .

# Build Next.js application
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ==============================================
# PRODUCTION STAGE
# ==============================================
FROM base AS production

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy built application
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

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