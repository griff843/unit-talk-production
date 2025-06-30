# Production Dockerfile for Unit Talk SaaS Platform
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY src/ ./src/
COPY scripts/ ./scripts/

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install security updates
RUN apk update && apk upgrade && apk add --no-cache curl

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S unitalk -u 1001

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=builder --chown=unitalk:nodejs /app/dist ./dist
COPY --from=builder --chown=unitalk:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=unitalk:nodejs /app/package*.json ./

# Create logs directory
RUN mkdir -p logs && chown unitalk:nodejs logs

# Switch to non-root user
USER unitalk

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "dist/index.js"]