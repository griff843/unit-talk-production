# Production Deployment Runbook - Unit Talk Platform
## Fortune 100-Grade SaaS Infrastructure Deployment Guide

---

**Version**: 2.0  
**Last Updated**: September 5, 2025  
**Scope**: Complete production deployment procedures  
**Target Environment**: SaaS Production Infrastructure  

---

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Infrastructure Setup](#infrastructure-setup)
3. [Environment Configuration](#environment-configuration)
4. [Service Deployment](#service-deployment)
5. [Monitoring Stack Setup](#monitoring-stack-setup)
6. [Health Verification](#health-verification)
7. [Security Configuration](#security-configuration)
8. [Backup & Recovery Setup](#backup--recovery-setup)
9. [Rollback Procedures](#rollback-procedures)
10. [Post-Deployment Validation](#post-deployment-validation)

---

## Pre-Deployment Checklist

### Infrastructure Requirements ✅

**Server Specifications**:
```yaml
Minimum Requirements:
  CPU: 8 cores (16 recommended)
  RAM: 16GB (32GB recommended)
  Storage: 100GB SSD (500GB recommended)
  Network: 1Gbps connection

Operating System:
  - Ubuntu 20.04+ LTS
  - CentOS 8+
  - Amazon Linux 2
  - Docker-compatible Linux distribution
```

**Software Prerequisites**:
- [ ] Docker Engine 24.0+ installed
- [ ] Docker Compose 2.20+ installed
- [ ] Git 2.30+ installed
- [ ] SSL certificates prepared
- [ ] Domain DNS configured
- [ ] Firewall rules configured

### Security Prerequisites ✅

- [ ] SSL/TLS certificates obtained and validated
- [ ] Environment secrets secured (via vault or secure storage)
- [ ] Network security groups configured
- [ ] Database access controls established
- [ ] API authentication keys rotated and secured
- [ ] Backup encryption keys prepared

### Network Configuration ✅

**Required Ports**:
```yaml
Public Access:
  80: HTTP (redirect to HTTPS)
  443: HTTPS (main application traffic)

Internal Services:
  5432: PostgreSQL
  6379: Redis
  7233: Temporal
  9090: Prometheus
  9093: Alertmanager
  3005: Grafana
```

**Domain Requirements**:
- Main application: `app.unittalk.com`
- API endpoints: `api.unittalk.com`
- Monitoring: `monitoring.unittalk.com`
- Command Center: `admin.unittalk.com`

---

## Infrastructure Setup

### 1. Server Preparation

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Docker Engine
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
docker-compose --version
```

### 2. Repository Setup

```bash
# Clone production repository
git clone <production-repository-url> /opt/unit-talk
cd /opt/unit-talk

# Switch to production branch
git checkout production

# Verify repository integrity
git log --oneline -5
git status
```

### 3. Directory Structure Setup

```bash
# Create required directories
sudo mkdir -p /opt/unit-talk/{logs,data,backups,ssl}
sudo mkdir -p /opt/unit-talk/monitoring/{grafana,prometheus}

# Set ownership
sudo chown -R $USER:$USER /opt/unit-talk

# Set permissions
chmod 755 /opt/unit-talk
chmod 700 /opt/unit-talk/ssl
chmod 755 /opt/unit-talk/logs
```

---

## Environment Configuration

### 1. Production Environment File

Create `/opt/unit-talk/.env.production`:

```bash
# ==============================================
# PRODUCTION ENVIRONMENT CONFIGURATION
# ==============================================

# Environment
NODE_ENV=production
ENVIRONMENT=production

# Application URLs
NEXT_PUBLIC_APP_URL=https://app.unittalk.com
NEXT_PUBLIC_API_URL=https://api.unittalk.com

# Database Configuration
DATABASE_URL=postgresql://unit_talk_user:${DB_PASSWORD}@postgres:5432/unit_talk_prod
POSTGRES_DB=unit_talk_prod
POSTGRES_USER=unit_talk_user
POSTGRES_PASSWORD=${SECURE_DB_PASSWORD}
POSTGRES_HOST=postgres
POSTGRES_PORT=5432

# Redis Configuration
REDIS_URL=redis://redis:6379
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=${SECURE_REDIS_PASSWORD}

# Temporal Configuration
TEMPORAL_SERVER_URL=temporal:7233
TEMPORAL_NAMESPACE=unit-talk-production
TEMPORAL_POSTGRES_DB=temporal_prod
TEMPORAL_POSTGRES_USER=temporal_user
TEMPORAL_POSTGRES_PASSWORD=${SECURE_TEMPORAL_PASSWORD}

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_PROD_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_PROD_ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_PROD_SERVICE_KEY}

# API Keys
OPTIMAL_API_KEY=${PROD_OPTIMAL_API_KEY}
ODDS_API_KEY=${PROD_ODDS_API_KEY}

# Discord Configuration
DISCORD_BOT_TOKEN=${PROD_DISCORD_BOT_TOKEN}
DISCORD_CLIENT_ID=${PROD_DISCORD_CLIENT_ID}
DISCORD_GUILD_ID=${PROD_DISCORD_GUILD_ID}
DISCORD_WEBHOOK_URL=${PROD_DISCORD_WEBHOOK_URL}

# Monitoring Configuration
PROMETHEUS_ENABLED=true
PROMETHEUS_PORT=9464
GRAFANA_ADMIN_PASSWORD=${SECURE_GRAFANA_PASSWORD}

# Security Configuration
JWT_SECRET=${SECURE_JWT_SECRET}
ENCRYPTION_KEY=${SECURE_ENCRYPTION_KEY}
SESSION_SECRET=${SECURE_SESSION_SECRET}

# SSL Configuration
SSL_CERT_PATH=/opt/unit-talk/ssl/cert.pem
SSL_KEY_PATH=/opt/unit-talk/ssl/key.pem

# Logging Configuration
LOG_LEVEL=info
LOG_FORMAT=json

# Performance Configuration
MAX_CONNECTIONS=100
WORKER_CONCURRENCY=4
REQUEST_TIMEOUT=30000
```

### 2. SSL Certificate Setup

```bash
# Copy SSL certificates
sudo cp your-cert.pem /opt/unit-talk/ssl/cert.pem
sudo cp your-key.pem /opt/unit-talk/ssl/key.pem

# Set proper permissions
sudo chmod 600 /opt/unit-talk/ssl/*
sudo chown $USER:$USER /opt/unit-talk/ssl/*
```

### 3. Production Docker Compose

Create `/opt/unit-talk/docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  # ==============================================
  # REVERSE PROXY & SSL TERMINATION
  # ==============================================
  nginx:
    image: nginx:alpine
    container_name: unit-talk-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl/certs
      - ./logs/nginx:/var/log/nginx
    depends_on:
      - api
      - command-center
      - smart-form
      - dashboard
    restart: unless-stopped
    networks:
      - unit-talk-network

  # ==============================================
  # DATABASE SERVICES
  # ==============================================
  postgres:
    image: postgres:15-alpine
    container_name: unit-talk-postgres-prod
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_prod_data:/var/lib/postgresql/data
      - ./backups:/backups
    ports:
      - "127.0.0.1:5432:5432"
    restart: unless-stopped
    networks:
      - unit-talk-network
    deploy:
      resources:
        limits:
          memory: 4G
          cpus: '2.0'

  postgres-replica:
    image: postgres:15-alpine
    container_name: unit-talk-postgres-replica-prod
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_replica_prod_data:/var/lib/postgresql/data
      - ./scripts/postgres-replica-setup.sh:/docker-entrypoint-initdb.d/setup-replica.sh
    depends_on:
      - postgres
    ports:
      - "127.0.0.1:5433:5432"
    restart: unless-stopped
    networks:
      - unit-talk-network

  redis:
    image: redis:7-alpine
    container_name: unit-talk-redis-prod
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_prod_data:/data
    ports:
      - "127.0.0.1:6379:6379"
    restart: unless-stopped
    networks:
      - unit-talk-network

  # ==============================================
  # APPLICATION SERVICES
  # ==============================================
  api:
    build:
      context: .
      dockerfile: ./apps/api/Dockerfile
      target: production
    container_name: unit-talk-api-prod
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: ${REDIS_URL}
    ports:
      - "127.0.0.1:3000:3000"
      - "127.0.0.1:9464:9464"
    volumes:
      - ./logs/api:/app/logs
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    networks:
      - unit-talk-network
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.5'

  workers:
    build:
      context: .
      dockerfile: ./apps/api/Dockerfile
      target: production
    container_name: unit-talk-workers-prod
    environment:
      NODE_ENV: production
      WORKER_MODE: true
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: ${REDIS_URL}
    command: npm run worker:prod
    volumes:
      - ./logs/workers:/app/logs
    depends_on:
      - api
    restart: unless-stopped
    networks:
      - unit-talk-network

  # ==============================================
  # MONITORING SERVICES
  # ==============================================
  prometheus:
    image: prom/prometheus:latest
    container_name: unit-talk-prometheus-prod
    ports:
      - "127.0.0.1:9090:9090"
    volumes:
      - ./monitoring/prometheus.prod.yml:/etc/prometheus/prometheus.yml
      - ./monitoring/alert_rules.yml:/etc/prometheus/alert_rules.yml
      - prometheus_prod_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=30d'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--web.enable-lifecycle'
    restart: unless-stopped
    networks:
      - unit-talk-network

  alertmanager:
    image: prom/alertmanager:latest
    container_name: unit-talk-alertmanager-prod
    ports:
      - "127.0.0.1:9093:9093"
    volumes:
      - ./monitoring/alertmanager.prod.yml:/etc/alertmanager/alertmanager.yml
    environment:
      - DISCORD_WEBHOOK_URL=${DISCORD_WEBHOOK_URL}
    restart: unless-stopped
    networks:
      - unit-talk-network

  grafana:
    image: grafana/grafana:latest
    container_name: unit-talk-grafana-prod
    ports:
      - "127.0.0.1:3005:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD}
      - GF_USERS_ALLOW_SIGN_UP=false
      - GF_SERVER_DOMAIN=monitoring.unittalk.com
    volumes:
      - grafana_prod_data:/var/lib/grafana
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning
      - ./monitoring/grafana/dashboards:/var/lib/grafana/dashboards
    depends_on:
      - prometheus
    restart: unless-stopped
    networks:
      - unit-talk-network

volumes:
  postgres_prod_data:
  postgres_replica_prod_data:
  redis_prod_data:
  prometheus_prod_data:
  grafana_prod_data:

networks:
  unit-talk-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.21.0.0/16
```

---

## Service Deployment

### 1. Pre-Deployment Validation

```bash
cd /opt/unit-talk

# Validate environment configuration
./scripts/validate-env.sh production

# Validate SSL certificates
./scripts/validate-ssl.sh

# Check system resources
./scripts/check-resources.sh

# Validate database connectivity
./scripts/test-db-connection.sh
```

### 2. Database Setup

```bash
# Initialize production database
docker-compose -f docker-compose.prod.yml up -d postgres
sleep 30

# Run database migrations
docker-compose -f docker-compose.prod.yml exec postgres psql -U ${POSTGRES_USER} -d ${POSTGRES_DB} -f /migrations/init.sql

# Verify database setup
docker-compose -f docker-compose.prod.yml exec postgres psql -U ${POSTGRES_USER} -d ${POSTGRES_DB} -c "SELECT version();"
```

### 3. Application Deployment

```bash
# Build production images
docker-compose -f docker-compose.prod.yml build --no-cache

# Start infrastructure services
docker-compose -f docker-compose.prod.yml up -d postgres redis

# Wait for database readiness
./scripts/wait-for-healthy.sh postgres:5432 300

# Start application services
docker-compose -f docker-compose.prod.yml up -d api workers

# Wait for API readiness
./scripts/wait-for-healthy.sh localhost:3000/health 120

# Start frontend services
docker-compose -f docker-compose.prod.yml up -d smart-form dashboard command-center

# Start reverse proxy
docker-compose -f docker-compose.prod.yml up -d nginx
```

### 4. Service Verification

```bash
# Check all services are running
docker-compose -f docker-compose.prod.yml ps

# Verify service health
./scripts/health-check-all.sh

# Check logs for errors
docker-compose -f docker-compose.prod.yml logs --tail=50
```

---

## Monitoring Stack Setup

### 1. Prometheus Configuration

Create `monitoring/prometheus.prod.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'unit-talk-production'
    environment: 'production'

rule_files:
  - "/etc/prometheus/alert_rules.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  - job_name: 'unit-talk-api'
    static_configs:
      - targets: ['api:9464']
    scrape_interval: 5s
    metrics_path: /metrics

  - job_name: 'unit-talk-health'
    static_configs:
      - targets: ['api:3000', 'smart-form:3000', 'dashboard:3000', 'command-center:3000']
    scrape_interval: 30s
    metrics_path: /health
    
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres:5432']
    scrape_interval: 30s
    
  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']
    scrape_interval: 30s
```

### 2. Alertmanager Configuration

Create `monitoring/alertmanager.prod.yml`:

```yaml
global:
  smtp_smarthost: 'localhost:587'
  smtp_from: 'alerts@unittalk.com'

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'default'

receivers:
- name: 'default'
  webhook_configs:
  - url: '${DISCORD_WEBHOOK_URL}'
    send_resolved: true

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'dev', 'instance']
```

### 3. Deploy Monitoring Stack

```bash
# Start monitoring services
docker-compose -f docker-compose.prod.yml up -d prometheus alertmanager grafana

# Wait for services to be ready
./scripts/wait-for-healthy.sh localhost:9090 120
./scripts/wait-for-healthy.sh localhost:9093 120
./scripts/wait-for-healthy.sh localhost:3005 120

# Import Grafana dashboards
./scripts/import-grafana-dashboards.sh

# Verify monitoring stack
curl -f http://localhost:9090/targets
curl -f http://localhost:9093/api/v1/status
```

---

## Health Verification

### 1. Service Health Checks

```bash
# API Health Check
curl -f https://api.unittalk.com/health

# Expected Response:
{
  "status": "healthy",
  "timestamp": "2025-09-05T12:00:00Z",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "temporal": "healthy"
  },
  "version": "2.0.0"
}
```

### 2. Application Health Validation

```bash
# Smart Form Health
curl -f https://app.unittalk.com/api/health

# Dashboard Health  
curl -f https://dashboard.unittalk.com/api/system/health

# Command Center Health
curl -f https://admin.unittalk.com/api/health
```

### 3. Infrastructure Health Validation

```bash
# Database Connectivity
docker-compose -f docker-compose.prod.yml exec postgres pg_isready -U ${POSTGRES_USER}

# Redis Connectivity
docker-compose -f docker-compose.prod.yml exec redis redis-cli ping

# Temporal Connectivity
docker-compose -f docker-compose.prod.yml exec temporal temporal cluster health
```

### 4. Monitoring Health Validation

```bash
# Prometheus Targets
curl -f http://monitoring.unittalk.com:9090/api/v1/targets

# Alertmanager Status
curl -f http://monitoring.unittalk.com:9093/api/v1/status

# Grafana Health
curl -f http://monitoring.unittalk.com:3005/api/health
```

---

## Security Configuration

### 1. SSL/TLS Configuration

```bash
# Validate SSL certificates
openssl x509 -in /opt/unit-talk/ssl/cert.pem -text -noout

# Test SSL endpoints
curl -I https://app.unittalk.com
curl -I https://api.unittalk.com

# Verify SSL grade (external tool)
# ssllabs.com/ssltest/analyze.html?d=unittalk.com
```

### 2. Network Security

```bash
# Configure firewall rules
sudo ufw enable
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
sudo ufw deny 5432/tcp from any
sudo ufw deny 6379/tcp from any
sudo ufw status
```

### 3. Secret Management

```bash
# Rotate production secrets
./scripts/rotate-secrets.sh production

# Validate secret security
./scripts/validate-secrets.sh production

# Update environment with rotated secrets
./scripts/update-env-secrets.sh production
```

---

## Backup & Recovery Setup

### 1. Database Backup Configuration

```bash
# Create backup script
cat > /opt/unit-talk/scripts/backup-database.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/opt/unit-talk/backups/postgres_backup_${DATE}.sql"

docker-compose -f docker-compose.prod.yml exec postgres pg_dump \
  -U ${POSTGRES_USER} -d ${POSTGRES_DB} > ${BACKUP_FILE}

# Compress backup
gzip ${BACKUP_FILE}

# Upload to S3 (if configured)
aws s3 cp ${BACKUP_FILE}.gz s3://unit-talk-backups/database/

echo "Database backup completed: ${BACKUP_FILE}.gz"
EOF

chmod +x /opt/unit-talk/scripts/backup-database.sh
```

### 2. Application Data Backup

```bash
# Create application backup script
cat > /opt/unit-talk/scripts/backup-application.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/unit-talk/backups/app_backup_${DATE}"

mkdir -p ${BACKUP_DIR}

# Backup configuration
cp -r /opt/unit-talk/.env* ${BACKUP_DIR}/
cp -r /opt/unit-talk/ssl ${BACKUP_DIR}/
cp -r /opt/unit-talk/logs ${BACKUP_DIR}/

# Backup Docker volumes
docker run --rm -v unit-talk_postgres_prod_data:/data -v ${BACKUP_DIR}:/backup alpine tar czf /backup/postgres_data.tar.gz /data
docker run --rm -v unit-talk_redis_prod_data:/data -v ${BACKUP_DIR}:/backup alpine tar czf /backup/redis_data.tar.gz /data

# Compress and upload
tar czf ${BACKUP_DIR}.tar.gz -C /opt/unit-talk/backups app_backup_${DATE}
aws s3 cp ${BACKUP_DIR}.tar.gz s3://unit-talk-backups/application/

echo "Application backup completed: ${BACKUP_DIR}.tar.gz"
EOF

chmod +x /opt/unit-talk/scripts/backup-application.sh
```

### 3. Automated Backup Schedule

```bash
# Setup cron jobs for automated backups
crontab -e

# Add these lines:
# Database backup every 6 hours
0 */6 * * * /opt/unit-talk/scripts/backup-database.sh

# Application backup daily at 2 AM
0 2 * * * /opt/unit-talk/scripts/backup-application.sh

# Log rotation weekly
0 0 * * 0 /opt/unit-talk/scripts/rotate-logs.sh
```

---

## Rollback Procedures

### 1. Quick Rollback Script

```bash
# Create rollback script
cat > /opt/unit-talk/scripts/rollback.sh << 'EOF'
#!/bin/bash

ROLLBACK_VERSION=${1:-"previous"}
echo "Rolling back to version: ${ROLLBACK_VERSION}"

# Stop current services
docker-compose -f docker-compose.prod.yml down

# Switch to rollback version
git checkout ${ROLLBACK_VERSION}

# Rebuild and restart services
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to be healthy
./scripts/wait-for-healthy.sh localhost:3000/health 300

echo "Rollback completed successfully"
EOF

chmod +x /opt/unit-talk/scripts/rollback.sh
```

### 2. Database Rollback

```bash
# Create database rollback script
cat > /opt/unit-talk/scripts/rollback-database.sh << 'EOF'
#!/bin/bash

BACKUP_FILE=${1}
if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup_file>"
  exit 1
fi

echo "Rolling back database to: ${BACKUP_FILE}"

# Stop application services
docker-compose -f docker-compose.prod.yml stop api workers

# Restore database
gunzip -c ${BACKUP_FILE} | docker-compose -f docker-compose.prod.yml exec -T postgres psql -U ${POSTGRES_USER} -d ${POSTGRES_DB}

# Restart services
docker-compose -f docker-compose.prod.yml start api workers

echo "Database rollback completed"
EOF

chmod +x /opt/unit-talk/scripts/rollback-database.sh
```

---

## Post-Deployment Validation

### 1. Comprehensive System Test

```bash
# Run full system validation
./scripts/post-deployment-test.sh

# Test API endpoints
curl -f https://api.unittalk.com/health
curl -f https://api.unittalk.com/version

# Test authentication
curl -X POST https://api.unittalk.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}'

# Test data processing
curl -f https://api.unittalk.com/picks/recent

# Validate monitoring
curl -f http://monitoring.unittalk.com:9090/targets
```

### 2. Performance Validation

```bash
# Load testing (using Apache Bench)
ab -n 1000 -c 10 https://api.unittalk.com/health

# Database performance test
./scripts/test-db-performance.sh

# Memory and CPU validation
docker stats --no-stream
```

### 3. Security Validation

```bash
# SSL certificate validation
./scripts/validate-ssl-security.sh

# Port scan verification
nmap -sV localhost

# Security headers check
curl -I https://app.unittalk.com | grep -i security
```

### 4. Backup Validation

```bash
# Test backup procedures
./scripts/backup-database.sh
./scripts/backup-application.sh

# Test restore procedures (in staging)
./scripts/test-restore-procedures.sh
```

---

## Troubleshooting Guide

### Common Issues & Solutions

**Issue**: Service fails to start  
**Solution**:
```bash
# Check service logs
docker-compose -f docker-compose.prod.yml logs [service-name]

# Check resource usage
docker stats

# Verify environment variables
docker-compose -f docker-compose.prod.yml config
```

**Issue**: Database connection failures  
**Solution**:
```bash
# Check database status
docker-compose -f docker-compose.prod.yml exec postgres pg_isready

# Verify network connectivity
docker-compose -f docker-compose.prod.yml exec api ping postgres

# Check database logs
docker-compose -f docker-compose.prod.yml logs postgres
```

**Issue**: SSL certificate errors  
**Solution**:
```bash
# Verify certificate validity
openssl x509 -in /opt/unit-talk/ssl/cert.pem -text -noout

# Check certificate expiration
openssl x509 -in /opt/unit-talk/ssl/cert.pem -noout -dates

# Validate certificate chain
openssl verify -CAfile ca-bundle.pem /opt/unit-talk/ssl/cert.pem
```

### Emergency Contacts

- **Infrastructure Team**: infrastructure@unittalk.com
- **Development Team**: dev@unittalk.com  
- **Security Team**: security@unittalk.com
- **On-Call Engineer**: +1-XXX-XXX-XXXX

---

## Maintenance Procedures

### Daily Maintenance

```bash
# Check service health
./scripts/daily-health-check.sh

# Review logs for errors
./scripts/check-error-logs.sh

# Verify backup completion
./scripts/verify-backups.sh

# Update security patches (if available)
./scripts/update-security-patches.sh
```

### Weekly Maintenance

```bash
# Rotate logs
./scripts/rotate-logs.sh

# Clean up old Docker images
docker image prune -f

# Update monitoring dashboards
./scripts/update-grafana-dashboards.sh

# Performance review
./scripts/weekly-performance-review.sh
```

### Monthly Maintenance

```bash
# Security vulnerability scan
./scripts/security-scan.sh

# Performance optimization review
./scripts/performance-optimization-review.sh

# Backup retention cleanup
./scripts/cleanup-old-backups.sh

# SSL certificate renewal check
./scripts/check-ssl-expiration.sh
```

---

## Success Criteria

### Deployment Success Indicators ✅

- [ ] All services running and healthy (15/15)
- [ ] SSL certificates valid and properly configured  
- [ ] Database connectivity and performance validated
- [ ] Monitoring stack operational with all targets UP
- [ ] API endpoints responding correctly
- [ ] Frontend applications accessible
- [ ] Backup procedures tested and functional
- [ ] Security configuration validated
- [ ] Performance benchmarks met
- [ ] Rollback procedures tested

### Performance Benchmarks

- **API Response Time**: < 200ms (95th percentile)
- **Database Query Time**: < 50ms (average)
- **Service Availability**: > 99.9%
- **Error Rate**: < 0.1%
- **Resource Utilization**: < 80% CPU, < 85% Memory

---

## Conclusion

This runbook provides comprehensive procedures for deploying the Unit Talk Platform to production with Fortune 100-grade infrastructure standards. Following these procedures ensures:

- **Reliability**: Robust service orchestration with health monitoring
- **Security**: Comprehensive SSL, network, and application security
- **Observability**: Full monitoring, alerting, and logging capabilities
- **Recoverability**: Automated backup and rollback procedures
- **Maintainability**: Structured maintenance and troubleshooting procedures

**Next Steps**: After successful deployment, proceed with post-deployment monitoring and initiate the security remediation plan for identified vulnerabilities.

---

**Document Owner**: DevOps Engineering Team  
**Review Cycle**: Monthly  
**Last Validated**: September 5, 2025  
**Classification**: Internal - Operations Team