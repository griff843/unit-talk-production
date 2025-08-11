# Temporal Server - Production Docker Configuration
# Optimized for Render.com deployment

FROM temporalio/auto-setup:1.20.0

# Install netcat for health checks
RUN apk add --no-cache netcat-openbsd

# Copy dynamic configuration
COPY apps/api/config/temporal/production.yaml /etc/temporal/config/dynamicconfig/production.yaml

# Health check for Render
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD temporal operator cluster health --address localhost:7233 || exit 1

# Expose Temporal frontend port
EXPOSE 7233

# Default command (auto-setup handles schema initialization)
CMD ["temporal-server", "start"]