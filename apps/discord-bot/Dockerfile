# Multi-stage build for Discord Bot
FROM node:18-alpine AS base

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# ==============================================
# DEVELOPMENT STAGE
# ==============================================
FROM base AS development

# Create non-root user before installing deps so no chown -R is needed
RUN addgroup -g 1001 -S nodejs && \
    adduser -S botuser -u 1001

# Install all dependencies (including dev dependencies)
RUN npm install && npm cache clean --force

# Copy source code with correct ownership directly (avoids expensive chown -R)
COPY --chown=botuser:nodejs . .

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

# Create non-root user before installing deps so no chown -R is needed
RUN addgroup -g 1001 -S nodejs && \
    adduser -S botuser -u 1001

# Install only production dependencies
RUN npm install --only=production && npm cache clean --force

# Copy source code with correct ownership directly
COPY --chown=botuser:nodejs . .

# Build the application
RUN npm run build

USER botuser

# Expose port (if your bot has a health check endpoint)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('Health check')" || exit 1

# Start the bot
CMD ["npm", "start"]