# Multi-stage build for Discord Bot
FROM node:20-alpine AS base

# Set working directory
WORKDIR /app

# Copy app package files only (avoid root husky)
COPY apps/discord-bot/package*.json ./

# ==============================================
# DEVELOPMENT STAGE
# ==============================================
FROM base AS development

# Install all dependencies (including dev dependencies)
RUN npm install && npm cache clean --force

# Copy centralized configuration (CRITICAL for v3.0.0)
# Note: Config copied from project root during build context
COPY config/ ./config/

# Copy source code
COPY apps/discord-bot ./

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S botuser -u 1001

# Change ownership of the app directory
RUN chown -R botuser:nodejs /app
USER botuser

# Expose port (if your bot has a health check endpoint)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('Health check')" || exit 1

# Start in development mode
CMD ["npm", "run", "dev"]

# ==============================================
# PRODUCTION STAGE
# ==============================================
FROM base AS production

# Install only production dependencies
COPY apps/discord-bot/package*.json ./
RUN npm install --only=production && npm cache clean --force

# Copy source code
COPY apps/discord-bot ./

# Build the application
RUN npm run build

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S botuser -u 1001

# Change ownership of the app directory
RUN chown -R botuser:nodejs /app
USER botuser

# Expose port (if your bot has a health check endpoint)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('Health check')" || exit 1

# Start the bot
CMD ["npm", "start"]