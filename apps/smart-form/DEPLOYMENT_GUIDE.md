# Smart Form Production Deployment Guide

**Version**: 3.0 Production Hardened  
**Target Environment**: Production  
**Deployment Type**: Zero-downtime rolling deployment  

## 🎯 Pre-Deployment Checklist

### ✅ Environment Preparation

- [ ] Production environment variables configured in `.env.local`
- [ ] Database migration `2025-08-bridge-constraints.sql` reviewed
- [ ] Required dependencies installed (pino, pino-pretty, zod, uuid)
- [ ] SSL certificates valid and configured
- [ ] DNS records pointing to production infrastructure
- [ ] Load balancer health checks configured

### ✅ Security Validation

- [ ] No hardcoded credentials in source code
- [ ] `SUPABASE_SERVICE_ROLE_KEY` only in server environment
- [ ] `OPTIMAL_API_KEY` secured server-side
- [ ] Client-side Supabase access completely removed
- [ ] All API routes use Zod validation
- [ ] Bridge outbox table created with constraints

### ✅ Quality Assurance

- [ ] All TypeScript compilation errors resolved
- [ ] API routes respond correctly with test data
- [ ] Bridge integration tested in staging
- [ ] Capper UUID mapping verified
- [ ] Form submissions work end-to-end
- [ ] Structured logging outputs properly formatted JSON

## 🚀 Deployment Steps

### Step 1: Pre-Deployment Backup

```bash
# Backup current production database
pg_dump $DATABASE_URL > "smart-form-backup-$(date +%Y%m%d_%H%M%S).sql"

# Backup environment configuration  
cp .env.local .env.backup

# Tag current release
git tag -a v3.0-pre-hardening -m "Pre-hardening production state"
git push origin v3.0-pre-hardening
```

### Step 2: Database Migration

```bash
# Connect to production database
psql $DATABASE_URL

# Run the migration (idempotent)
\i sql/2025-08-bridge-constraints.sql

# Verify migration success
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'bridge_outbox';

# Check constraints are in place
SELECT conname, confrelid::regclass, af.attname, 
       confkey, afnum.attname as fkeyname
FROM pg_constraint pgc
JOIN pg_attribute af ON af.attnum = ANY(pgc.conkey) AND af.attrelid = pgc.conrelid
JOIN pg_attribute afnum ON afnum.attnum = ANY(pgc.confkey) AND afnum.attrelid = pgc.confrelid
WHERE contype = 'f' 
AND confrelid::regclass::text = 'users';
```

### Step 3: Application Deployment

```bash
# Build production assets
npm run build

# Verify build success
ls -la .next/

# Install production dependencies only
npm ci --only=production

# Run final type check
npm run type-check

# Start application with PM2 (zero downtime)
pm2 start ecosystem.config.js --env production
pm2 save
```

### Step 4: Health Check Validation

```bash
# Wait for application startup
sleep 30

# Test critical endpoints
curl -f "http://localhost:3021/api/cappers" | jq '.'
curl -f "http://localhost:3021/api/games?sport=NBA" | jq '.'
curl -f "http://localhost:3021/api/props?sport=NBA" | jq '.'

# Test form page loads
curl -f "http://localhost:3021/submit-ticket" | grep "Submit Sports Betting Ticket"

# Test structured logging output
tail -f /var/log/smart-form.log | head -5
```

### Step 5: Production Validation

```bash
# Test ticket submission with valid data
curl -X POST "http://localhost:3021/api/submit-ticket" \
  -H "Content-Type: application/json" \
  -d '{
    "capper_id": "550e8400-e29b-41d4-a716-446655440000",
    "sport": "NBA", 
    "ticket_type": "single",
    "selections": [{
      "sport": "NBA",
      "stat_type": "points", 
      "line": 25.5,
      "leg_odds": -110,
      "source": "manual",
      "selection": "over"
    }],
    "total_units": 1
  }'

# Verify bridge event creation
psql $DATABASE_URL -c "SELECT COUNT(*) FROM bridge_outbox WHERE status = 'pending';"

# Test bridge simulation (if development mode)
if [ "$NODE_ENV" = "development" ]; then
  curl "http://localhost:3021/api/dev/simulate-bridge?id=<bet_slip_id>"
fi
```

## 🔧 Environment Configuration

### Production Environment Variables

```bash
# Create production .env.local
cat > .env.local << EOF
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# External API Keys (Server-side only)
OPTIMAL_API_KEY=your_optimal_api_key_here
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your_webhook

# Application Configuration  
NODE_ENV=production
NEXT_PUBLIC_DEV_DIRECT_DB=false
EOF

# Secure the environment file
chmod 600 .env.local
```

### PM2 Ecosystem Configuration

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'smart-form-prod',
    script: 'npm',
    args: 'start',
    cwd: '/path/to/smart-form',
    instances: 2,
    exec_mode: 'cluster',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3021,
    },
    error_file: '/var/log/smart-form-error.log',
    out_file: '/var/log/smart-form-out.log',
    log_file: '/var/log/smart-form.log',
    time: true,
    merge_logs: true,
    max_memory_restart: '1G',
    node_args: '--max_old_space_size=1024',
    kill_timeout: 5000,
    listen_timeout: 10000,
    health_check_grace_period: 10000,
  }]
};
```

## 🔍 Post-Deployment Monitoring

### Critical Metrics to Watch (First 30 Minutes)

```bash
# Application health
pm2 status
pm2 logs smart-form-prod --lines 50

# API response times  
curl -w "@curl-format.txt" -o /dev/null -s "http://localhost:3021/api/cappers"

# Database connectivity
psql $DATABASE_URL -c "SELECT NOW();"

# Error rates in logs
tail -f /var/log/smart-form.log | grep '"level":"error"'

# Bridge outbox processing
psql $DATABASE_URL -c "SELECT status, COUNT(*) FROM bridge_outbox GROUP BY status;"
```

### Performance Benchmarks

| Metric | Target | Alert Threshold |
|--------|--------|----------------|
| API Response Time | <100ms | >500ms |
| Database Query Time | <50ms | >200ms |  
| Form Load Time | <2s | >5s |
| Error Rate | <0.1% | >1% |
| Memory Usage | <512MB | >800MB |
| CPU Usage | <50% | >80% |

## 🚨 Rollback Procedures

### Immediate Rollback (< 5 minutes)

```bash
# Stop current application
pm2 stop smart-form-prod

# Restore previous version
git checkout v3.0-pre-hardening
npm run build
pm2 restart smart-form-prod

# Verify rollback success
curl -f "http://localhost:3021/api/cappers"
```

### Database Rollback (If Required)

```bash
# Only if migration caused issues
psql $DATABASE_URL < smart-form-backup-YYYYMMDD_HHMMSS.sql

# Drop new tables if needed
psql $DATABASE_URL -c "DROP TABLE IF EXISTS bridge_outbox CASCADE;"

# Verify rollback
psql $DATABASE_URL -c "\dt bridge*"
```

## 📊 Deployment Validation Scripts

### Automated Health Check Script

```bash
#!/bin/bash
# health-check.sh - Production deployment validation

set -e

echo "🏥 Starting Smart Form health check..."

# Check application response
if curl -f -s "http://localhost:3021/api/cappers" > /dev/null; then
  echo "✅ API endpoints responding"
else
  echo "❌ API endpoints not responding"
  exit 1
fi

# Check database connectivity
if psql $DATABASE_URL -c "SELECT 1;" > /dev/null 2>&1; then
  echo "✅ Database connectivity confirmed"  
else
  echo "❌ Database connection failed"
  exit 1
fi

# Check log format
if tail -1 /var/log/smart-form.log | jq '.' > /dev/null 2>&1; then
  echo "✅ Structured logging format validated"
else
  echo "❌ Log format validation failed"
  exit 1
fi

# Check bridge table exists
if psql $DATABASE_URL -c "SELECT COUNT(*) FROM bridge_outbox;" > /dev/null 2>&1; then
  echo "✅ Bridge integration table confirmed"
else
  echo "❌ Bridge integration table missing"
  exit 1
fi

# Check environment security
if [ -n "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "✅ Server environment variables configured"
else
  echo "❌ Server environment variables missing"
  exit 1
fi

echo "🎉 All health checks passed! Deployment successful."
```

### Load Test Script

```bash
#!/bin/bash
# load-test.sh - Basic production load testing

echo "🔥 Running production load test..."

# Test concurrent API requests
for i in {1..10}; do
  curl -s "http://localhost:3021/api/cappers" &
done
wait

echo "✅ Concurrent request test completed"

# Test form submission load  
echo "Testing ticket submission performance..."
time curl -X POST "http://localhost:3021/api/submit-ticket" \
  -H "Content-Type: application/json" \
  -d '{
    "capper_id": "550e8400-e29b-41d4-a716-446655440000",
    "sport": "NBA",
    "ticket_type": "single", 
    "selections": [{
      "sport": "NBA",
      "stat_type": "points",
      "line": 25.5,
      "leg_odds": -110,
      "source": "api",
      "selection": "over"
    }],
    "total_units": 1
  }'

echo "🎯 Load test completed"
```

## 📋 Deployment Checklist

### Pre-Deployment
- [ ] Code review completed and approved
- [ ] All tests passing in CI/CD pipeline
- [ ] Database migration tested in staging
- [ ] Performance benchmarks established
- [ ] Rollback plan documented and tested
- [ ] Monitoring alerts configured
- [ ] Stakeholders notified of deployment window

### During Deployment  
- [ ] Database backup created
- [ ] Migration applied successfully
- [ ] Application build completed without errors
- [ ] Health checks passing
- [ ] Performance metrics within targets
- [ ] Error rates remain low
- [ ] Bridge integration functioning

### Post-Deployment
- [ ] Full functional testing completed
- [ ] Performance monitoring active
- [ ] Error tracking configured
- [ ] Documentation updated
- [ ] Team notified of successful deployment
- [ ] Monitoring dashboards reviewed
- [ ] User acceptance testing scheduled

## 🎯 Success Criteria

✅ **Functional Requirements**
- All API endpoints respond correctly
- Form submissions work end-to-end
- Bridge events are created and processed
- Capper UUID system operational
- No client-side database access

✅ **Non-Functional Requirements**  
- Response times <100ms (95th percentile)
- Error rates <0.1%
- Zero security vulnerabilities
- Structured logging operational
- Environment variables secured

✅ **Operational Requirements**
- Monitoring and alerting active
- Rollback procedures validated  
- Documentation complete and current
- Support team trained on new features
- Runbook tested and verified

---

**Deployment Owner**: DevOps Team  
**Technical Lead**: Engineering Team  
**Review Required**: Security Team  
**Approval Required**: Technical Director  

**Emergency Contact**: engineering-oncall@company.com  
**Escalation Path**: [Level 1] → [Level 2] → [CTO]