# Unit Talk Command Center - Deployment Guide

**Version**: 3.0.0 Fortune-100 Quality  
**Target Environment**: Production  
**Deployment Type**: Blue-Green with Zero Downtime  

## 🚀 Pre-Deployment Checklist

### Infrastructure Prerequisites
- [ ] Supabase PostgreSQL instance (14+) with connection pooling
- [ ] Redis instance for session management and caching
- [ ] Container registry access (Docker Hub/ECR/GCR)
- [ ] Load balancer with health check support
- [ ] SSL/TLS certificates for HTTPS termination
- [ ] Monitoring infrastructure (Prometheus/Grafana recommended)

### Access Requirements
- [ ] Database admin privileges for migrations
- [ ] Container registry push/pull permissions
- [ ] Production environment access
- [ ] DNS management access
- [ ] SSL certificate management access

### Configuration Validation
```bash
# Verify environment variables
echo $DATABASE_URL
echo $REDIS_URL
echo $NEXT_PUBLIC_SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY
```

## 📋 Database Migration

### Step 1: Backup Existing Database
```bash
# Create backup before migration
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup integrity
pg_restore --list backup_$(date +%Y%m%d_%H%M%S).sql
```

### Step 2: Apply Fortune-100 Upgrade Migration
```bash
# Navigate to migration directory
cd migrations/

# Apply the Fortune-100 upgrade migration
psql $DATABASE_URL -f 006_fortune100_slo_monitoring.sql

# Verify migration success
psql $DATABASE_URL -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('system_metrics', 'slos', 'slo_incidents', 'exposure_snapshots', 'audit_log', 'roles', 'temporal_workflow_health', 'temporal_schedule_health');"
```

### Step 3: Validate Database Schema
```sql
-- Verify all required tables exist
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'system_metrics', 'slos', 'slo_incidents', 
    'exposure_snapshots', 'audit_log', 'roles',
    'temporal_workflow_health', 'temporal_schedule_health'
  )
ORDER BY table_name;

-- Verify required views exist  
SELECT 
  table_name as view_name
FROM information_schema.views 
WHERE table_schema = 'public'
  AND table_name IN (
    'vw_queue_backlog', 'vw_grading_lag', 'vw_clv_cohorts',
    'vw_post_window_reco', 'vw_exposure_summary', 'vw_slo_status'
  );

-- Verify functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public'
  AND routine_name IN ('calculate_slo_burn_rate', 'cleanup_expired_metrics');
```

## 🏗️ Application Build & Deploy

### Step 1: Build Production Image
```dockerfile
# Dockerfile optimizations for production
FROM node:18-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm run type-check

FROM node:18-alpine AS runtime
WORKDIR /app

# Security: Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Copy built application
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build --chown=nextjs:nodejs /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package*.json ./

USER nextjs
EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000

CMD ["npm", "start"]
```

```bash
# Build production image
docker build -t unit-talk/command-center:3.0.0 .

# Tag for registry
docker tag unit-talk/command-center:3.0.0 your-registry.com/unit-talk/command-center:3.0.0

# Push to registry
docker push your-registry.com/unit-talk/command-center:3.0.0
```

### Step 2: Production Environment Configuration
```bash
# Create production .env file
cat > .env.production << 'EOF'
# Database Configuration
DATABASE_URL=postgresql://username:password@hostname:5432/database
REDIS_URL=redis://hostname:6379

# Supabase Configuration  
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Application Configuration
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://command-center.yourdomain.com
PORT=3000

# Telemetry Configuration
OTEL_SERVICE_NAME=unit-talk-command-center
OTEL_SERVICE_VERSION=3.0.0
OTEL_EXPORTER_OTLP_ENDPOINT=https://your-telemetry-endpoint

# Security Configuration
NEXTAUTH_SECRET=your-secure-random-string
NEXTAUTH_URL=https://command-center.yourdomain.com

# Feature Flags
ENABLE_TELEMETRY=true
ENABLE_RBAC=true
ENABLE_AUDIT_LOGGING=true
EOF
```

### Step 3: Docker Compose Production Deployment
```yaml
# docker-compose.production.yml
version: '3.8'

services:
  command-center:
    image: your-registry.com/unit-talk/command-center:3.0.0
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    restart: unless-stopped
    depends_on:
      - redis
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes
    restart: unless-stopped
    networks:
      - app-network

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - command-center
    restart: unless-stopped
    networks:
      - app-network

volumes:
  redis-data:

networks:
  app-network:
    driver: bridge
```

### Step 4: Nginx Load Balancer Configuration
```nginx
# nginx.conf
upstream command-center {
    server command-center:3000;
}

server {
    listen 80;
    server_name command-center.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name command-center.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/nginx/ssl/certificate.pem;
    ssl_certificate_key /etc/nginx/ssl/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;

    # Security Headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Health Check Endpoint
    location /health {
        proxy_pass http://command-center/api/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API Routes
    location /api/ {
        proxy_pass http://command-center;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeout Configuration
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    # Static Assets
    location /_next/static/ {
        proxy_pass http://command-center;
        proxy_cache_valid 200 1d;
        add_header Cache-Control "public, immutable";
    }

    # Application Routes
    location / {
        proxy_pass http://command-center;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket Support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## 🚀 Deployment Execution

### Blue-Green Deployment Strategy
```bash
#!/bin/bash
# deploy.sh - Blue-Green deployment script

set -e

# Configuration
NEW_VERSION="3.0.0"
CURRENT_ENV="blue"
NEW_ENV="green"
HEALTH_CHECK_URL="https://command-center.yourdomain.com/api/health"

echo "🚀 Starting Blue-Green deployment for version ${NEW_VERSION}"

# Step 1: Deploy to green environment
echo "📦 Deploying to ${NEW_ENV} environment..."
docker-compose -f docker-compose.${NEW_ENV}.yml up -d

# Step 2: Health check
echo "🏥 Running health checks..."
for i in {1..30}; do
    if curl -f "${HEALTH_CHECK_URL}"; then
        echo "✅ Health check passed"
        break
    fi
    echo "⏳ Waiting for application to start... (${i}/30)"
    sleep 10
done

# Step 3: Smoke tests
echo "🧪 Running smoke tests..."
npm run test:smoke

# Step 4: Switch traffic
echo "🔄 Switching traffic to ${NEW_ENV}..."
# Update load balancer configuration or DNS
nginx -s reload

# Step 5: Verify deployment
echo "✅ Verifying deployment..."
curl -f "${HEALTH_CHECK_URL}"

# Step 6: Cleanup old environment
echo "🧹 Cleaning up ${CURRENT_ENV} environment..."
docker-compose -f docker-compose.${CURRENT_ENV}.yml down

echo "🎉 Deployment completed successfully!"
```

### Rolling Deployment (Alternative)
```bash
#!/bin/bash
# rolling-deploy.sh - Rolling deployment for Kubernetes

kubectl set image deployment/command-center \
  app=your-registry.com/unit-talk/command-center:3.0.0

# Wait for rollout to complete
kubectl rollout status deployment/command-center

# Verify deployment
kubectl get pods -l app=command-center
```

## ✅ Post-Deployment Validation

### Step 1: Application Health Check
```bash
# Basic health check
curl -f https://command-center.yourdomain.com/api/health

# Detailed health check
curl -s https://command-center.yourdomain.com/api/health | jq .

# Expected response:
# {
#   "status": "healthy",
#   "version": "3.0.0",
#   "timestamp": "2025-01-XX...",
#   "database": "connected",
#   "redis": "connected",
#   "services": {
#     "metrics_aggregator": "running",
#     "telemetry": "active"
#   }
# }
```

### Step 2: Database Connectivity Test
```bash
# Test database connection
psql $DATABASE_URL -c "SELECT COUNT(*) FROM system_metrics;"

# Test view functionality
psql $DATABASE_URL -c "SELECT * FROM vw_slo_status LIMIT 1;"

# Test function execution
psql $DATABASE_URL -c "SELECT cleanup_expired_metrics();"
```

### Step 3: Feature Validation
```bash
# Test SLO monitoring endpoint
curl -s "https://command-center.yourdomain.com/api/monitoring/slos" | jq .success

# Test exposure tracking
curl -s "https://command-center.yourdomain.com/api/exposure/snapshot" | jq .success  

# Test temporal health
curl -s "https://command-center.yourdomain.com/api/temporal/summary" | jq .success

# Test admin controls (requires RBAC token)
curl -X POST "https://command-center.yourdomain.com/api/admin/safe-mode" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"enable": false, "reason": "Deployment validation"}'
```

### Step 4: Performance Validation
```bash
# Response time test
time curl -s https://command-center.yourdomain.com/api/health

# Load test (using Apache Bench)
ab -n 100 -c 10 https://command-center.yourdomain.com/api/health

# Expected: <200ms average response time
```

### Step 5: Security Validation
```bash
# SSL/TLS check
ssllabs-scan --host=command-center.yourdomain.com

# Security headers check
curl -I https://command-center.yourdomain.com | grep -E "(X-Frame-Options|X-Content-Type-Options|Strict-Transport-Security)"

# RBAC test (should fail without proper authentication)
curl -X POST https://command-center.yourdomain.com/api/admin/freeze \
  -H "Content-Type: application/json" \
  -d '{"enable": true}'
# Expected: 403 Forbidden
```

## 📊 Monitoring Setup

### Step 1: Initialize Metrics Collection
```bash
# Start the metrics aggregator service
curl -X POST "https://command-center.yourdomain.com/api/admin/services/start" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"service": "metrics_aggregator"}'

# Verify metrics collection
sleep 60
curl -s "https://command-center.yourdomain.com/api/monitoring/metrics" | jq .
```

### Step 2: Configure Alerting
```yaml
# alerting.yml - Prometheus alerting rules
groups:
  - name: unit-talk-command-center
    rules:
      - alert: SLOBurnRateHigh
        expr: slo_burn_rate > 14.4
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "SLO burn rate is critically high"
          
      - alert: ExposureRiskHigh
        expr: kelly_at_risk > 20
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Kelly at risk exposure is high"

      - alert: TemporalWorkflowFailed
        expr: temporal_failed_workflows_1h > 5
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "Multiple Temporal workflows have failed"
```

### Step 3: Dashboard Import
```bash
# Import Grafana dashboard
curl -X POST "http://grafana:3000/api/dashboards/db" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GRAFANA_TOKEN" \
  -d @grafana-dashboard.json
```

## 🔄 Rollback Procedures

### Emergency Rollback
```bash
#!/bin/bash
# emergency-rollback.sh

echo "🚨 Starting emergency rollback..."

# Step 1: Switch back to previous version
docker-compose -f docker-compose.blue.yml up -d

# Step 2: Health check
for i in {1..10}; do
    if curl -f "${HEALTH_CHECK_URL}"; then
        echo "✅ Rollback successful"
        break
    fi
    sleep 5
done

# Step 3: Database rollback (if needed)
# psql $DATABASE_URL -f rollback_migration.sql

echo "🔄 Rollback completed"
```

### Kubernetes Rollback
```bash
# Rollback to previous version
kubectl rollout undo deployment/command-center

# Check rollback status  
kubectl rollout status deployment/command-center

# Verify pods are healthy
kubectl get pods -l app=command-center
```

## 🚨 Troubleshooting

### Common Issues

**1. Database Connection Failures**
```bash
# Check connection string
echo $DATABASE_URL | sed 's/:[^:]*@/:PASSWORD@/'

# Test connectivity
pg_isready -d $DATABASE_URL

# Check connection limits
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"
```

**2. Memory Issues**
```bash
# Check container memory usage
docker stats command-center

# Increase memory limits in docker-compose
services:
  command-center:
    deploy:
      resources:
        limits:
          memory: 2G
```

**3. SSL Certificate Issues**
```bash
# Check certificate expiry
openssl x509 -in certificate.pem -text -noout | grep "Not After"

# Renew certificate
certbot renew --nginx
```

### Debugging Commands
```bash
# Application logs
docker logs command-center --tail 100 --follow

# Container inspection
docker inspect command-center

# Network connectivity
docker exec command-center ping database-host

# Database queries
docker exec command-center psql $DATABASE_URL -c "SELECT version();"
```

## 📋 Post-Deployment Checklist

### Immediate (0-15 minutes)
- [ ] Application health check passes
- [ ] Database connectivity confirmed
- [ ] All API endpoints responding
- [ ] SSL certificate valid
- [ ] Load balancer routing correctly

### Short-term (15 minutes - 1 hour)
- [ ] Metrics collection started
- [ ] SLO monitoring active
- [ ] Admin controls functional
- [ ] Audit logging working
- [ ] Error rates within normal ranges

### Long-term (1-24 hours)
- [ ] Performance metrics stable
- [ ] No memory leaks detected
- [ ] Background jobs running
- [ ] Alerting configured
- [ ] Monitoring dashboards updated

---

**Document Owner**: DevOps Team  
**Last Updated**: January 2025  
**Next Review**: After each major deployment  
**Emergency Contact**: [Your on-call phone/email]