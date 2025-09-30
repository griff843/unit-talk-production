FROM node:18-alpine

WORKDIR /app

# Create data and logs directories
RUN mkdir -p data logs

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S vipbot -u 1001 -G nodejs

# Set ownership
RUN chown -R vipbot:nodejs /app
USER vipbot

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "process.exit(0)"

# Start the application
CMD ["npm", "start"]