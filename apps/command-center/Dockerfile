# ==============================================
# Multi-stage Dockerfile for Unit Talk Command Center
# SPRINT-FRONTEND-CONTAINER-TRUTH-LOCK-102B: Production mode execution
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

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@10.29.3 --activate

# ==============================================
# DEVELOPMENT STAGE (runs production build)
# SPRINT-FRONTEND-CONTAINER-TRUTH-LOCK-102B: No dev mode - always production
# ==============================================
FROM base AS development

# === LAYER: Workspace manifests (cached until lockfile/manifests change) ===
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json ./

# Shared packages source (changes rarely → stable install cache layer)
COPY packages ./packages
# App package.json only — pnpm workspace resolution requires it before install
COPY apps/command-center/package.json ./apps/command-center/package.json

# === LAYER: Install (cached until above layers change) ===
RUN pnpm install --frozen-lockfile --ignore-scripts

# === LAYER: App source (busts build layer only — install stays cached) ===
COPY apps/command-center ./apps/command-center

WORKDIR /app/apps/command-center

# SPRINT-BUILD-TIME-ISOLATION-111: Accept build-time args for NEXT_PUBLIC_* vars
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}

# Build Next.js application in production mode
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# SPRINT-RUNTIME-TRUTH-008: Enable standalone output for Docker
ENV NEXT_OUTPUT_STANDALONE=true
RUN pnpm run build

# SPRINT-RUNTIME-TRUTH-008: Copy static assets for standalone mode
# Next.js standalone output does NOT include .next/static or public/
RUN mkdir -p .next/standalone/apps/command-center/.next && \
    cp -r .next/static .next/standalone/apps/command-center/.next/static
RUN cp -r public .next/standalone/apps/command-center/public 2>/dev/null || true

# Expose port (internal: 3015)
EXPOSE 3015

# Health check using /api/health endpoint
HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=30 \
  CMD curl -f http://127.0.0.1:3015/api/health || exit 1

# Production start using standalone server
# SPRINT-FRONTEND-CONTAINER-TRUTH-LOCK-102B: No dev mode - production only
ENV PORT=3015
ENV HOSTNAME=0.0.0.0
CMD ["node", ".next/standalone/apps/command-center/server.js"]

# ==============================================
# BUILD STAGE (for external production builds)
# ==============================================
FROM base AS builder

# Workspace manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Shared packages (stable cache layer)
COPY packages ./packages
COPY apps/command-center/package.json ./apps/command-center/package.json

# Install
RUN pnpm install --frozen-lockfile --ignore-scripts

# Full app source
COPY apps/command-center ./apps/command-center

WORKDIR /app/apps/command-center

# Build Next.js application
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm run build

# ==============================================
# PRODUCTION STAGE
# ==============================================
FROM base AS production

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

# Create non-root user first — eliminates chown -R sweep entirely
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy built artifacts with correct ownership — no chown -R needed
COPY --chown=nodejs:nodejs --from=builder /app/apps/command-center/.next/standalone ./
COPY --chown=nodejs:nodejs --from=builder /app/apps/command-center/.next/static ./.next/static
COPY --chown=nodejs:nodejs --from=builder /app/apps/command-center/public ./public

USER nodejs

# Expose port (internal: 3015)
EXPOSE 3015

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=30 \
  CMD curl -f http://127.0.0.1:3015/api/health || exit 1

# Production start
ENV PORT=3015
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
