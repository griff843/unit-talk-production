# Fortune 100 Syndicate - Production Operations Guide
## Comprehensive Deployment & Management Manual

**Version:** 1.0  
**Last Updated:** December 2024  
**Target Audience:** DevOps, SRE, Operations Teams  

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Deployment Procedures](#deployment-procedures)
4. [Configuration Management](#configuration-management)
5. [Monitoring & Alerting](#monitoring--alerting)
6. [Maintenance Procedures](#maintenance-procedures)
7. [Troubleshooting Guide](#troubleshooting-guide)
8. [Performance Optimization](#performance-optimization)
9. [Security Operations](#security-operations)
10. [Disaster Recovery](#disaster-recovery)
11. [Scaling Procedures](#scaling-procedures)
12. [Appendices](#appendices)

---

## System Overview

### Architecture Components

The Fortune 100 Syndicate system consists of the following core components:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Dashboard     │    │   API Gateway   │    │   Database      │
│   Frontend      │◄──►│   (Express.js)  │◄──►│   (PostgreSQL)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Grading Engine Core                          │
├─────────────────┬─────────────────┬─────────────────┬───────────┤
│  Feature        │  ML Model       │  Risk           │  Performance│
│  Engineer       │  Manager        │  Manager        │  Analyzer  │
└─────────────────┴─────────────────┴─────────────────┴───────────┘
```

### Key Services
- **GradingEngine:** Core prop evaluation and scoring
- **RiskManager:** Portfolio risk assessment and position sizing
- **PerformanceAnalyzer:** Real-time performance tracking
- **DashboardAPI:** Data aggregation and visualization
- **BacktestingSystem:** Historical performance validation

---

## Pre-Deployment Checklist

### Infrastructure Requirements

#### Server Specifications
```yaml
Production Environment:
  CPU: 8 cores minimum (16 recommended)
  RAM: 16GB minimum (32GB recommended)
  Storage: 500GB SSD minimum
  Network: 1Gbps connection
  OS: Ubuntu 20.04 LTS or CentOS 8

Staging Environment:
  CPU: 4 cores minimum
  RAM: 8GB minimum
  Storage: 200GB SSD
  Network: 100Mbps connection
```

#### Database Requirements
```yaml
PostgreSQL:
  Version: 13.x or higher
  Memory: 8GB dedicated
  Storage: 1TB SSD with RAID 1
  Connections: 200 max concurrent
  Backup: Automated daily backups
```

#### External Dependencies
- [ ] Redis Cache Server (6.x)
- [ ] Node.js Runtime (18.x LTS)
- [ ] PM2 Process Manager
- [ ] Nginx Reverse Proxy
- [ ] SSL Certificates
- [ ] Monitoring Stack (Prometheus/Grafana)

### Environment Setup

#### 1. System Dependencies
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Install Redis
sudo apt install redis-server

# Install Nginx
sudo apt install nginx
```

#### 2. Application Setup
```bash
# Clone repository
git clone <repository-url>
cd unit-talk-production

# Install dependencies
npm install

# Build application
npm run build

# Set up environment variables
cp .env.example .env.production
# Edit .env.production with production values
```

#### 3. Database Setup
```sql
-- Create database and user
CREATE DATABASE syndicate_production;
CREATE USER syndicate_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE syndicate_production TO syndicate_user;

-- Run migrations
npm run migrate:production
```

---

## Deployment Procedures

### Standard Deployment Process

#### 1. Pre-Deployment Validation
```bash
#!/bin/bash
# pre-deploy-check.sh

echo "🔍 Running pre-deployment checks..."

# Check Node.js version
node_version=$(node -v)
echo "Node.js version: $node_version"

# Check database connectivity
npm run db:check

# Run tests
npm run test:production

# Check environment variables
npm run env:validate

# Build application
npm run build

echo "✅ Pre-deployment checks completed"
```

#### 2. Blue-Green Deployment
```bash
#!/bin/bash
# deploy.sh

set -e

ENVIRONMENT=${1:-production}
DEPLOYMENT_ID=$(date +%Y%m%d_%H%M%S)

echo "🚀 Starting deployment: $DEPLOYMENT_ID"

# Create deployment directory
sudo mkdir -p /opt/syndicate/releases/$DEPLOYMENT_ID
sudo chown $USER:$USER /opt/syndicate/releases/$DEPLOYMENT_ID

# Copy application files
cp -r dist/* /opt/syndicate/releases/$DEPLOYMENT_ID/
cp package.json /opt/syndicate/releases/$DEPLOYMENT_ID/
cp .env.production /opt/syndicate/releases/$DEPLOYMENT_ID/.env

# Install production dependencies
cd /opt/syndicate/releases/$DEPLOYMENT_ID
npm install --production

# Update symlink
sudo ln -sfn /opt/syndicate/releases/$DEPLOYMENT_ID /opt/syndicate/current

# Restart services
sudo pm2 reload ecosystem.config.js --env production

# Health check
sleep 10
curl -f http://localhost:3000/health || exit 1

echo "✅ Deployment completed: $DEPLOYMENT_ID"
```

#### 3. Rollback Procedure
```bash
#!/bin/bash
# rollback.sh

PREVIOUS_RELEASE=$(ls -t /opt/syndicate/releases | sed -n '2p')

if [ -z "$PREVIOUS_RELEASE" ]; then
    echo "❌ No previous release found"
    exit 1
fi

echo "🔄 Rolling back to: $PREVIOUS_RELEASE"

# Update symlink to previous release
sudo ln -sfn /opt/syndicate/releases/$PREVIOUS_RELEASE /opt/syndicate/current

# Restart services
sudo pm2 reload ecosystem.config.js --env production

# Health check
sleep 10
curl -f http://localhost:3000/health || exit 1

echo "✅ Rollback completed"
```

---

## Configuration Management

### Environment Variables

#### Production Configuration (.env.production)
```bash
# Application
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Database
DATABASE_URL=postgresql://syndicate_user:password@localhost:5432/syndicate_production
DATABASE_POOL_SIZE=20
DATABASE_TIMEOUT=30000

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=secure_redis_password

# Security
JWT_SECRET=your_jwt_secret_here
ENCRYPTION_KEY=your_encryption_key_here
API_RATE_LIMIT=1000

# External APIs
SPORTSBOOK_API_KEY=your_api_key
ODDS_API_KEY=your_odds_api_key

# Monitoring
PROMETHEUS_PORT=9090
GRAFANA_URL=http://localhost:3001

# Alerts
SLACK_WEBHOOK_URL=your_slack_webhook
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
```

### PM2 Configuration (ecosystem.config.js)
```javascript
module.exports = {
  apps: [
    {
      name: 'syndicate-api',
      script: './dist/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/var/log/syndicate/error.log',
      out_file: '/var/log/syndicate/out.log',
      log_file: '/var/log/syndicate/combined.log',
      time: true,
      max_memory_restart: '2G',
      node_args: '--max-old-space-size=4096'
    },
    {
      name: 'syndicate-worker',
      script: './dist/worker.js',
      instances: 2,
      env_production: {
        NODE_ENV: 'production'
      }
    }
  ]
};
```

### Nginx Configuration
```nginx
# /etc/nginx/sites-available/syndicate
upstream syndicate_backend {
    server 127.0.0.1:3000;
    server 127.0.0.1:3001 backup;
}

server {
    listen 80;
    server_name api.syndicate.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.syndicate.com;

    ssl_certificate /etc/ssl/certs/syndicate.crt;
    ssl_certificate_key /etc/ssl/private/syndicate.key;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;

    location / {
        proxy_pass http://syndicate_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    location /health {
        access_log off;
        proxy_pass http://syndicate_backend;
    }
}
```

---

## Monitoring & Alerting

### Health Check Endpoints

#### Application Health
```typescript
// Health check implementation
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    checks: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      external_apis: await checkExternalAPIs()
    }
  };
  
  const isHealthy = Object.values(health.checks).every(check => check.status === 'ok');
  res.status(isHealthy ? 200 : 503).json(health);
});
```

#### Database Health Check
```bash
#!/bin/bash
# db-health-check.sh

DB_HOST="localhost"
DB_NAME="syndicate_production"
DB_USER="syndicate_user"

# Check database connectivity
pg_isready -h $DB_HOST -d $DB_NAME -U $DB_USER

if [ $? -eq 0 ]; then
    echo "✅ Database is healthy"
    exit 0
else
    echo "❌ Database is unhealthy"
    exit 1
fi
```

### Prometheus Metrics

#### Custom Metrics Configuration
```typescript
// metrics.ts
import { register, Counter, Histogram, Gauge } from 'prom-client';

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
});

export const gradingRequestsTotal = new Counter({
  name: 'grading_requests_total',
  help: 'Total number of grading requests',
  labelNames: ['tier', 'sport']
});

export const activeConnections = new Gauge({
  name: 'active_database_connections',
  help: 'Number of active database connections'
});

export const modelAccuracy = new Gauge({
  name: 'model_accuracy_percentage',
  help: 'Current model accuracy percentage',
  labelNames: ['model_type']
});
```

### Alert Rules

#### Prometheus Alert Rules (alerts.yml)
```yaml
groups:
  - name: syndicate_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} errors per second"

      - alert: DatabaseConnectionsHigh
        expr: active_database_connections > 80
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "High database connection usage"

      - alert: ModelAccuracyLow
        expr: model_accuracy_percentage < 70
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Model accuracy below threshold"

      - alert: DiskSpaceHigh
        expr: (node_filesystem_avail_bytes / node_filesystem_size_bytes) < 0.1
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Disk space critically low"
```

---

## Maintenance Procedures

### Daily Operations

#### 1. System Health Check
```bash
#!/bin/bash
# daily-health-check.sh

echo "📊 Daily Health Check - $(date)"

# Check system resources
echo "=== System Resources ==="
free -h
df -h
top -bn1 | head -20

# Check application status
echo "=== Application Status ==="
pm2 status

# Check database performance
echo "=== Database Performance ==="
psql -d syndicate_production -c "
SELECT 
    schemaname,
    tablename,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes
FROM pg_stat_user_tables 
ORDER BY n_tup_ins DESC 
LIMIT 10;"

# Check error logs
echo "=== Recent Errors ==="
tail -50 /var/log/syndicate/error.log | grep ERROR

echo "✅ Health check completed"
```

#### 2. Performance Monitoring
```bash
#!/bin/bash
# performance-monitor.sh

# API response times
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3000/api/grading/health

# Database query performance
psql -d syndicate_production -c "
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements 
ORDER BY total_time DESC 
LIMIT 10;"

# Memory usage by process
ps aux --sort=-%mem | head -10
```

### Weekly Maintenance

#### 1. Database Maintenance
```sql
-- Weekly database maintenance
-- Run during low-traffic hours

-- Update table statistics
ANALYZE;

-- Rebuild indexes if needed
REINDEX DATABASE syndicate_production;

-- Clean up old data (older than 90 days)
DELETE FROM bet_results WHERE created_at < NOW() - INTERVAL '90 days';
DELETE FROM performance_logs WHERE created_at < NOW() - INTERVAL '90 days';

-- Vacuum tables
VACUUM ANALYZE;
```

#### 2. Log Rotation
```bash
#!/bin/bash
# log-rotation.sh

LOG_DIR="/var/log/syndicate"
BACKUP_DIR="/var/log/syndicate/archive"

# Create archive directory
mkdir -p $BACKUP_DIR

# Compress and archive logs older than 7 days
find $LOG_DIR -name "*.log" -mtime +7 -exec gzip {} \;
find $LOG_DIR -name "*.log.gz" -exec mv {} $BACKUP_DIR/ \;

# Remove archives older than 30 days
find $BACKUP_DIR -name "*.log.gz" -mtime +30 -delete

# Restart PM2 to create new log files
pm2 flush
```

### Monthly Maintenance

#### 1. Security Updates
```bash
#!/bin/bash
# security-updates.sh

# Update system packages
sudo apt update
sudo apt list --upgradable

# Update Node.js dependencies
npm audit
npm audit fix

# Update PM2
sudo npm update -g pm2

# Restart services after updates
sudo systemctl restart nginx
pm2 restart all
```

#### 2. Performance Optimization
```bash
#!/bin/bash
# performance-optimization.sh

# Analyze slow queries
psql -d syndicate_production -c "
SELECT 
    query,
    calls,
    total_time,
    mean_time
FROM pg_stat_statements 
WHERE mean_time > 1000 
ORDER BY mean_time DESC;"

# Check index usage
psql -d syndicate_production -c "
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE idx_scan = 0;"

# Optimize database configuration
sudo -u postgres psql -c "SELECT name, setting FROM pg_settings WHERE name IN ('shared_buffers', 'effective_cache_size', 'work_mem');"
```

---

## Troubleshooting Guide

### Common Issues

#### 1. High Memory Usage
**Symptoms:**
- Application becomes slow
- PM2 restarts processes frequently
- System swap usage increases

**Diagnosis:**
```bash
# Check memory usage
free -h
ps aux --sort=-%mem | head -10

# Check PM2 processes
pm2 monit

# Check for memory leaks
node --inspect dist/server.js
```

**Resolution:**
```bash
# Increase PM2 memory limit
pm2 restart all --max-memory-restart 4G

# Optimize Node.js garbage collection
pm2 restart all --node-args="--max-old-space-size=4096"

# Scale down instances if needed
pm2 scale syndicate-api 2
```

#### 2. Database Connection Issues
**Symptoms:**
- "Connection pool exhausted" errors
- Slow query responses
- Connection timeouts

**Diagnosis:**
```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity;

-- Check long-running queries
SELECT 
    pid,
    now() - pg_stat_activity.query_start AS duration,
    query 
FROM pg_stat_activity 
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';
```

**Resolution:**
```bash
# Increase connection pool size
# Edit .env.production
DATABASE_POOL_SIZE=50

# Kill long-running queries
psql -d syndicate_production -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid = <pid>;"

# Restart application
pm2 restart all
```

#### 3. API Rate Limiting Issues
**Symptoms:**
- 429 "Too Many Requests" errors
- Legitimate users blocked
- Uneven traffic distribution

**Diagnosis:**
```bash
# Check Nginx access logs
tail -f /var/log/nginx/access.log | grep "429"

# Check rate limit status
nginx -T | grep limit_req
```

**Resolution:**
```nginx
# Adjust rate limits in Nginx config
limit_req_zone $binary_remote_addr zone=api:10m rate=20r/s;
limit_req zone=api burst=50 nodelay;

# Reload Nginx
sudo nginx -s reload
```

### Emergency Procedures

#### 1. Service Outage Response
```bash
#!/bin/bash
# emergency-response.sh

echo "🚨 Emergency Response Activated"

# Check system status
systemctl status nginx
pm2 status

# Check resource usage
df -h
free -h

# Check recent logs
tail -100 /var/log/syndicate/error.log

# Attempt automatic recovery
pm2 restart all
sudo systemctl restart nginx

# If still failing, rollback
if ! curl -f http://localhost:3000/health; then
    echo "🔄 Initiating rollback"
    ./rollback.sh
fi
```

#### 2. Database Recovery
```bash
#!/bin/bash
# db-recovery.sh

# Check database status
sudo systemctl status postgresql

# If database is down, start it
sudo systemctl start postgresql

# Check for corruption
sudo -u postgres pg_checksums -D /var/lib/postgresql/13/main

# Restore from backup if needed
sudo -u postgres pg_restore -d syndicate_production /backup/latest.dump
```

---

## Performance Optimization

### Application Optimization

#### 1. Caching Strategy
```typescript
// Redis caching implementation
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export class CacheManager {
  async get<T>(key: string): Promise<T | null> {
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    await redis.setex(key, ttl, JSON.stringify(value));
  }

  async invalidate(pattern: string): Promise<void> {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
}

// Usage in grading engine
export class GradingEngine {
  private cache = new CacheManager();

  async gradeProps(props: Prop[]): Promise<GradingResult[]> {
    const cacheKey = `grading:${this.generateCacheKey(props)}`;
    
    // Try cache first
    const cached = await this.cache.get<GradingResult[]>(cacheKey);
    if (cached) return cached;

    // Process and cache result
    const results = await this.processGrading(props);
    await this.cache.set(cacheKey, results, 1800); // 30 minutes
    
    return results;
  }
}
```

#### 2. Database Optimization
```sql
-- Index optimization
CREATE INDEX CONCURRENTLY idx_bet_results_timestamp ON bet_results(timestamp);
CREATE INDEX CONCURRENTLY idx_bet_results_tier ON bet_results(tier);
CREATE INDEX CONCURRENTLY idx_bet_results_sport ON bet_results(sport);

-- Partial indexes for common queries
CREATE INDEX CONCURRENTLY idx_bet_results_recent 
ON bet_results(timestamp) 
WHERE timestamp > NOW() - INTERVAL '30 days';

-- Composite indexes
CREATE INDEX CONCURRENTLY idx_bet_results_sport_tier 
ON bet_results(sport, tier, timestamp);
```

#### 3. Connection Pooling
```typescript
// Database connection pool configuration
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum connections
  min: 5,  // Minimum connections
  idle: 10000, // 10 seconds
  acquire: 60000, // 60 seconds
  evict: 1000, // 1 second
  handleDisconnects: true,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Connection health monitoring
pool.on('connect', () => {
  console.log('Database connection established');
});

pool.on('error', (err) => {
  console.error('Database connection error:', err);
});
```

---

## Security Operations

### Security Monitoring

#### 1. Access Log Analysis
```bash
#!/bin/bash
# security-analysis.sh

LOG_FILE="/var/log/nginx/access.log"

echo "🔒 Security Analysis Report - $(date)"

# Check for suspicious IPs
echo "=== Top IPs by Request Count ==="
awk '{print $1}' $LOG_FILE | sort | uniq -c | sort -nr | head -20

# Check for failed authentication attempts
echo "=== Failed Authentication Attempts ==="
grep "401\|403" $LOG_FILE | awk '{print $1}' | sort | uniq -c | sort -nr

# Check for potential attacks
echo "=== Potential Attack Patterns ==="
grep -E "(SELECT|UNION|DROP|INSERT|UPDATE|DELETE)" $LOG_FILE
grep -E "(<script|javascript:|onload=)" $LOG_FILE

# Check rate limiting effectiveness
echo "=== Rate Limited Requests ==="
grep "429" $LOG_FILE | wc -l
```

#### 2. SSL Certificate Management
```bash
#!/bin/bash
# ssl-management.sh

CERT_PATH="/etc/ssl/certs/syndicate.crt"

# Check certificate expiration
openssl x509 -in $CERT_PATH -noout -dates

# Check certificate validity
openssl x509 -in $CERT_PATH -noout -text | grep -A2 "Validity"

# Auto-renewal with Let's Encrypt (if using)
certbot renew --dry-run
```

### Incident Response

#### 1. Security Incident Checklist
```bash
#!/bin/bash
# incident-response.sh

echo "🚨 Security Incident Response"

# 1. Isolate affected systems
echo "Step 1: System isolation"
# Block suspicious IPs
iptables -A INPUT -s <suspicious_ip> -j DROP

# 2. Preserve evidence
echo "Step 2: Evidence preservation"
cp /var/log/nginx/access.log /tmp/incident_$(date +%Y%m%d_%H%M%S).log

# 3. Assess damage
echo "Step 3: Damage assessment"
# Check for unauthorized access
grep "POST\|PUT\|DELETE" /var/log/nginx/access.log | tail -100

# 4. Contain threat
echo "Step 4: Threat containment"
# Reset API keys if compromised
# Rotate JWT secrets
# Force password resets if needed

# 5. Notify stakeholders
echo "Step 5: Stakeholder notification"
# Send alerts to security team
curl -X POST $SLACK_WEBHOOK_URL -d '{"text":"Security incident detected"}'
```

---

## Disaster Recovery

### Backup Procedures

#### 1. Database Backup
```bash
#!/bin/bash
# backup-database.sh

BACKUP_DIR="/backup/database"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="syndicate_production"

# Create backup directory
mkdir -p $BACKUP_DIR

# Full database backup
pg_dump -h localhost -U syndicate_user -d $DB_NAME > $BACKUP_DIR/full_backup_$DATE.sql

# Compressed backup
pg_dump -h localhost -U syndicate_user -d $DB_NAME | gzip > $BACKUP_DIR/full_backup_$DATE.sql.gz

# Upload to cloud storage (AWS S3 example)
aws s3 cp $BACKUP_DIR/full_backup_$DATE.sql.gz s3://syndicate-backups/database/

# Clean up old backups (keep last 30 days)
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "✅ Database backup completed: $DATE"
```

#### 2. Application Backup
```bash
#!/bin/bash
# backup-application.sh

BACKUP_DIR="/backup/application"
DATE=$(date +%Y%m%d_%H%M%S)
APP_DIR="/opt/syndicate/current"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup application files
tar -czf $BACKUP_DIR/app_backup_$DATE.tar.gz -C $APP_DIR .

# Backup configuration files
tar -czf $BACKUP_DIR/config_backup_$DATE.tar.gz /etc/nginx/sites-available/syndicate /opt/syndicate/ecosystem.config.js

# Upload to cloud storage
aws s3 cp $BACKUP_DIR/app_backup_$DATE.tar.gz s3://syndicate-backups/application/
aws s3 cp $BACKUP_DIR/config_backup_$DATE.tar.gz s3://syndicate-backups/config/

echo "✅ Application backup completed: $DATE"
```

### Recovery Procedures

#### 1. Database Recovery
```bash
#!/bin/bash
# recover-database.sh

BACKUP_FILE=$1
DB_NAME="syndicate_production"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file>"
    exit 1
fi

echo "🔄 Starting database recovery from: $BACKUP_FILE"

# Stop application
pm2 stop all

# Drop and recreate database
sudo -u postgres dropdb $DB_NAME
sudo -u postgres createdb $DB_NAME

# Restore from backup
if [[ $BACKUP_FILE == *.gz ]]; then
    gunzip -c $BACKUP_FILE | psql -h localhost -U syndicate_user -d $DB_NAME
else
    psql -h localhost -U syndicate_user -d $DB_NAME < $BACKUP_FILE
fi

# Run migrations if needed
npm run migrate:production

# Start application
pm2 start all

echo "✅ Database recovery completed"
```

#### 2. Full System Recovery
```bash
#!/bin/bash
# full-system-recovery.sh

echo "🔄 Starting full system recovery"

# 1. Restore application files
tar -xzf /backup/application/app_backup_latest.tar.gz -C /opt/syndicate/current/

# 2. Restore configuration
tar -xzf /backup/config/config_backup_latest.tar.gz -C /

# 3. Restore database
./recover-database.sh /backup/database/full_backup_latest.sql.gz

# 4. Restart services
sudo systemctl restart nginx
pm2 restart all

# 5. Verify system health
sleep 30
curl -f http://localhost:3000/health

echo "✅ Full system recovery completed"
```

---

## Scaling Procedures

### Horizontal Scaling

#### 1. Load Balancer Configuration
```nginx
# /etc/nginx/conf.d/load-balancer.conf
upstream syndicate_cluster {
    least_conn;
    server 10.0.1.10:3000 weight=3 max_fails=3 fail_timeout=30s;
    server 10.0.1.11:3000 weight=3 max_fails=3 fail_timeout=30s;
    server 10.0.1.12:3000 weight=2 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name api.syndicate.com;

    location / {
        proxy_pass http://syndicate_cluster;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # Health checks
        proxy_next_upstream error timeout invalid_header http_500 http_502 http_503;
        proxy_connect_timeout 5s;
        proxy_send_timeout 10s;
        proxy_read_timeout 10s;
    }
}
```

#### 2. Auto-Scaling Script
```bash
#!/bin/bash
# auto-scale.sh

# Monitoring thresholds
CPU_THRESHOLD=80
MEMORY_THRESHOLD=85
RESPONSE_TIME_THRESHOLD=1000

# Get current metrics
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
MEMORY_USAGE=$(free | grep Mem | awk '{printf("%.0f", $3/$2 * 100.0)}')
RESPONSE_TIME=$(curl -w "%{time_total}" -o /dev/null -s http://localhost:3000/health | cut -d. -f1)

echo "Current metrics: CPU=${CPU_USAGE}%, Memory=${MEMORY_USAGE}%, Response=${RESPONSE_TIME}ms"

# Scale up if thresholds exceeded
if (( $(echo "$CPU_USAGE > $CPU_THRESHOLD" | bc -l) )) || 
   (( $(echo "$MEMORY_USAGE > $MEMORY_THRESHOLD" | bc -l) )) || 
   (( $RESPONSE_TIME > $RESPONSE_TIME_THRESHOLD )); then
    
    echo "🔼 Scaling up..."
    pm2 scale syndicate-api +2
    
elif (( $(echo "$CPU_USAGE < 30" | bc -l) )) && 
     (( $(echo "$MEMORY_USAGE < 40" | bc -l) )); then
    
    echo "🔽 Scaling down..."
    pm2 scale syndicate-api -1
fi
```

### Database Scaling

#### 1. Read Replica Setup
```bash
#!/bin/bash
# setup-read-replica.sh

# On master server
sudo -u postgres psql -c "CREATE USER replicator WITH REPLICATION ENCRYPTED PASSWORD 'replica_password';"

# Configure postgresql.conf
echo "wal_level = replica" >> /etc/postgresql/13/main/postgresql.conf
echo "max_wal_senders = 3" >> /etc/postgresql/13/main/postgresql.conf
echo "wal_keep_segments = 64" >> /etc/postgresql/13/main/postgresql.conf

# Configure pg_hba.conf
echo "host replication replicator 10.0.1.0/24 md5" >> /etc/postgresql/13/main/pg_hba.conf

# Restart PostgreSQL
sudo systemctl restart postgresql

# On replica server
pg_basebackup -h 10.0.1.10 -D /var/lib/postgresql/13/main -U replicator -v -P -W

# Configure recovery.conf
echo "standby_mode = 'on'" > /var/lib/postgresql/13/main/recovery.conf
echo "primary_conninfo = 'host=10.0.1.10 port=5432 user=replicator'" >> /var/lib/postgresql/13/main/recovery.conf
```

#### 2. Connection Routing
```typescript
// Database connection routing
import { Pool } from 'pg';

class DatabaseManager {
  private masterPool: Pool;
  private replicaPool: Pool;

  constructor() {
    this.masterPool = new Pool({
      connectionString: process.env.DATABASE_MASTER_URL,
      max: 20
    });

    this.replicaPool = new Pool({
      connectionString: process.env.DATABASE_REPLICA_URL,
      max: 30
    });
  }

  // Write operations go to master
  async write(query: string, params?: any[]): Promise<any> {
    return this.masterPool.query(query, params);
  }

  // Read operations go to replica
  async read(query: string, params?: any[]): Promise<any> {
    try {
      return await this.replicaPool.query(query, params);
    } catch (error) {
      // Fallback to master if replica fails
      console.warn('Replica failed, falling back to master:', error);
      return this.masterPool.query(query, params);
    }
  }
}
```

---

## Appendices

### A. Environment Variables Reference

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| NODE_ENV | Application environment | development | Yes |
| PORT | Application port | 3000 | No |
| DATABASE_URL | PostgreSQL connection string | - | Yes |
| REDIS_URL | Redis connection string | - | Yes |
| JWT_SECRET | JWT signing secret | - | Yes |
| LOG_LEVEL | Logging level | info | No |
| API_RATE_LIMIT | Requests per minute | 1000 | No |

### B. API Endpoints Reference

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| /health | GET | System health check | No |
| /api/grading/grade | POST | Grade props | Yes |
| /api/performance/metrics | GET | Performance metrics | Yes |
| /api/dashboard/data | GET | Dashboard data | Yes |
| /api/backtest/run | POST | Run backtest | Yes |

### C. Database Schema

```sql
-- Core tables
CREATE TABLE bet_results (
    id SERIAL PRIMARY KEY,
    sport VARCHAR(50),
    market_type VARCHAR(100),
    tier CHAR(1),
    actual_odds DECIMAL(10,2),
    position_size DECIMAL(10,4),
    result INTEGER,
    profit DECIMAL(10,2),
    confidence DECIMAL(5,2),
    expected_value DECIMAL(10,2),
    timestamp TIMESTAMP DEFAULT NOW(),
    model_used VARCHAR(100)
);

CREATE TABLE performance_metrics (
    id SERIAL PRIMARY KEY,
    metric_name VARCHAR(100),
    metric_value DECIMAL(15,4),
    timestamp TIMESTAMP DEFAULT NOW(),
    metadata JSONB
);
```

### D. Monitoring Queries

```sql
-- Performance monitoring queries
-- Active connections
SELECT count(*) as active_connections FROM pg_stat_activity;

-- Slow queries
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
WHERE mean_time > 1000 
ORDER BY mean_time DESC;

-- Table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

**Document Version:** 1.0  
**Last Updated:** December 2024  
**Next Review:** January 2025  
**Maintained By:** DevOps Team  
**Classification:** Internal Use Only