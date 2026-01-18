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

# ==============================================
# DEVELOPMENT STAGE
# ==============================================
FROM base AS development

# Install all dependencies (including dev)
COPY package*.json ./
RUN npm install && npm cache clean --force

# Copy centralized configuration (CRITICAL for v3.0.0)
COPY ../../config/ ./config/

# Copy source code and configs
COPY . .

# Rebuild native modules for Temporal SDK
RUN npm rebuild @temporalio/core-bridge

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

# Copy package files
COPY package*.json ./

# Install all dependencies for building
RUN npm install

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# ==============================================
# PRODUCTION STAGE
# ==============================================
FROM base AS production

# Install only production dependencies
COPY package*.json ./
RUN npm install --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/config ./config

# Production mode - TODO: Add non-root user back after development testing

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Production start
CMD ["npm", "start"]