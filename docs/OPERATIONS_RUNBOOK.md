# Operations Runbook

Comprehensive operational procedures for the Unit Talk Platform production environment.

## Overview

This runbook provides step-by-step procedures for common operational tasks, incident response, and system maintenance. All procedures follow Fortune 100 operational standards with proper escalation paths and safety measures.

**Last Updated**: 2025-08-12  
**Version**: 2.0.0  
**Emergency Hotline**: [Contact Information]

## 🚨 Emergency Response

### Production Launch Gatekeeper v1 Emergency Procedures

#### Kill Switch Activation (Critical Emergencies)
```bash
# 1. Via Command Center (Recommended)
# Navigate to: https://command-center.unittalk.com/dashboard
# Click the red "ACTIVATE KILL SWITCH" button
# Provide detailed reason for activation
# Confirm activation with dual verification

# 2. Via API (If Command Center unavailable)
curl -X POST https://command-center.unittalk.com/api/ops/system/freeze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $EMERGENCY_TOKEN" \
  -d '{"action": "activate", "reason": "Emergency system freeze - [detailed reason]"}'

# 3. Verify Kill Switch is active
curl https://command-center.unittalk.com/api/ops/system/freeze/status
```

#### Emergency Deployment Abort
```bash
# 1. Via Command Center Rollout Timeline
# Navigate to: https://command-center.unittalk.com/dashboard
# Find active deployment in Rollout Timeline widget
# Click "Abort Deployment" button
# Provide abort reason and confirm

# 2. Via API
curl -X POST https://command-center.unittalk.com/api/ops/deploy/abort \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $EMERGENCY_TOKEN" \
  -d '{"reason": "Emergency abort - [detailed reason]", "deploymentId": "[deployment-id]"}'

# 3. Via GitHub Actions (Direct)
# Navigate to: https://github.com/unit-talk/production/actions/workflows/rollback.yml
# Click "Run workflow"
# Set: environment=prod, emergency=true, reason="[detailed reason]"
```

#### Auto-Rollback Monitoring
```bash
# 1. Check current rollout status
curl https://command-center.unittalk.com/api/ops/deploy/status

# 2. Monitor SLO guards in real-time
# Command Center dashboard shows live guard status
# Red indicators trigger auto-rollback after 2 violations

# 3. Guard threshold validation
echo "Feed Freshness: ≤ 300s"
echo "Temporal Backlog Age: ≤ 300s" 
echo "Failure Burn Rate: Not 'red'"
echo "Canary Health: ≤ 90s since last check"
```

### Immediate Response (< 5 minutes)

#### Production Outage
```bash
# 1. Assess system health and deployment status
npm run health:check
curl -f https://api.unittalk.com/health || echo "API DOWN"

# 2. Check if deployment is in progress
curl https://command-center.unittalk.com/api/ops/deploy/status
# If deployment active, consider immediate abort

# 3. Check error budgets and SLO guards
npm run slo:status
curl https://command-center.unittalk.com/api/ops/deploy/status | jq '.guards'

# 4. Execute emergency rollback if needed
# Navigate to: https://github.com/unit-talk/production/actions/workflows/rollback.yml
# Click "Run workflow" with emergency=true
```

#### Database Issues
```bash
# 1. Check database connectivity
npm run db:status
npx supabase status

# 2. Check for active migrations
npm run db:migration:status

# 3. Emergency database recovery
npm run db:emergency:readonly  # Enable read-only mode
npm run dr:database:restore    # Restore from latest backup if needed
```

#### Security Incident
```bash
# 1. Enable safe mode immediately
npm run safe-mode:enable "Security incident - investigating"

# 2. Check for secrets exposure
npm run security:scan:emergency
git log --all --grep="password\|key\|token" --oneline -10

# 3. Revoke potentially compromised credentials
# Update environment variables in production
# Rotate API keys and database passwords
```

### Escalation Matrix

| Severity | Response Time | Primary Contact | Secondary Contact | Escalation |
|----------|---------------|-----------------|-------------------|------------|
| **P0 - Critical** | < 15 minutes | On-call Engineer | Engineering Manager | CTO |
| **P1 - High** | < 1 hour | Lead Engineer | Engineering Manager | VP Engineering |
| **P2 - Medium** | < 4 hours | Assigned Engineer | Team Lead | Engineering Manager |
| **P3 - Low** | < 24 hours | Assigned Engineer | Team Lead | - |

### Contact Information
```yaml
emergency_contacts:
  on_call_engineer: "pager-duty-integration"
  engineering_manager: "slack://engineering-alerts"  
  security_team: "security@company.com"
  infrastructure_team: "infrastructure@company.com"
  
communication_channels:
  incidents: "#incidents"
  engineering: "#engineering-alerts"
  operations: "#ops-alerts"
```

## 🔧 System Operations

### Health Monitoring

#### System Health Check
```bash
# Comprehensive system health assessment
npm run health:check:full

# Individual service checks
npm run health:api          # API endpoints
npm run health:database     # Database connectivity  
npm run health:temporal     # Temporal workflows
npm run health:discord      # Discord bot
npm run health:external     # External APIs

# Critical metrics check
npm run metrics:critical    # Response times, error rates
npm run slo:dashboard      # SLO compliance status
```

#### Performance Monitoring
```bash
# Real-time performance metrics
npm run perf:dashboard

# Load testing (staging only)
npm run test:load:staging

# Database performance
npm run db:analyze:performance
npm run db:slow:queries
```

### Deployment Operations

#### Production Deployment
```bash
# 1. Pre-deployment validation
npm run deploy:pre-check
npm run test:e2e:staging    # E2E gate validation

# 2. Deploy with monitoring
npm run deploy:production:safe
# This includes:
# - Blue-green deployment
# - Health check validation  
# - Gradual traffic rollout
# - Error budget monitoring

# 3. Post-deployment verification  
npm run deploy:verify
npm run health:check:production
npm run metrics:validate
```

#### Emergency Rollback
```bash
# Option 1: One-click rollback (GitHub Actions)
# Navigate to emergency rollback workflow
# Select rollback type and execute

# Option 2: Manual rollback
npm run rollback:prepare
npm run rollback:execute --target=<previous-version>
npm run rollback:verify

# Option 3: Database rollback
npm run db:rollback:to --migration=<migration-id>
npm run db:verify:integrity
```

### Database Operations

#### Routine Database Maintenance
```bash
# Daily maintenance
npm run db:backup:verify    # Verify backup completion
npm run db:stats:update     # Update table statistics  
npm run db:vacuum:analyze   # Database optimization

# Weekly maintenance  
npm run db:backup:test      # Test backup restoration
npm run db:performance:analyze
npm run db:cleanup:old-logs

# Monthly maintenance
npm run db:backup:archive   # Archive old backups
npm run db:security:audit   # Security review
npm run db:capacity:review  # Capacity planning
```

#### Database Recovery Procedures
```bash
# Point-in-time recovery
npm run dr:database:restore --timestamp="2025-08-12T10:00:00Z"

# Schema migration recovery
npm run db:migration:rollback --steps=3
npm run db:migration:verify

# Data corruption recovery
npm run db:integrity:check
npm run db:repair:automatic
npm run db:verify:consistency
```

### Monitoring & Alerting

#### Alert Investigation
```bash
# High error rate alert
npm run logs:errors --since=1h
npm run metrics:errors:breakdown
npm run trace:error --error-id=<error-id>

# High response time alert  
npm run metrics:latency:breakdown
npm run db:slow:queries --since=1h
npm run trace:slowest --limit=10

# Error budget exhaustion
npm run slo:budget:details
npm run slo:burn:rate:analysis
npm run incidents:correlation
```

#### Log Analysis
```bash
# Application logs
npm run logs:app --level=error --since=1h
npm run logs:search --query="database timeout"
npm run logs:correlation --trace-id=<trace-id>

# System logs
npm run logs:system --service=api
npm run logs:database --type=error
npm run logs:temporal --workflow=<workflow-id>

# Security logs
npm run logs:security --since=1h  
npm run logs:audit --user=<user-id>
npm run logs:access --ip=<ip-address>
```

## 🛠️ Maintenance Procedures

### Scheduled Maintenance

#### Weekly Maintenance Window (Sunday 2-4 AM UTC)
```bash
# 1. Enable maintenance mode
npm run maintenance:enable --duration=2h --reason="Weekly maintenance"

# 2. System updates
npm run updates:security:apply
npm run dependencies:update:patch
npm run system:cleanup

# 3. Performance optimization
npm run db:vacuum:full
npm run cache:clear:expired  
npm run metrics:reset:counters

# 4. Backup verification
npm run dr:test:recovery --type=database
npm run backup:verify:integrity

# 5. Disable maintenance mode
npm run maintenance:disable
npm run health:check:full
```

#### Monthly Major Maintenance
```bash
# 1. Capacity planning review
npm run capacity:analyze:trends
npm run capacity:forecast --months=3
npm run capacity:recommend:scaling

# 2. Security review
npm run security:audit:full
npm run dependencies:audit:security
npm run secrets:rotation:check

# 3. Performance review
npm run performance:benchmark
npm run performance:compare --baseline=last-month
npm run performance:optimization:recommend

# 4. Documentation updates
npm run docs:generate:api
npm run docs:update:runbooks
npm run docs:verify:accuracy
```

### Configuration Management

#### Environment Configuration
```bash
# Production environment updates
npm run config:validate --env=production
npm run config:backup --env=production  
npm run config:apply --env=production --config=<config-file>
npm run config:verify --env=production

# Feature flag management
npm run flags:list --env=production
npm run flags:enable --flag=<flag-name> --env=production
npm run flags:disable --flag=<flag-name> --env=production
npm run flags:audit --since=1week
```

#### Secrets Management
```bash
# Secrets rotation (quarterly)
npm run secrets:audit:expiring --days=30
npm run secrets:rotate --type=database
npm run secrets:rotate --type=api-keys
npm run secrets:verify:rotation

# Emergency secrets revocation
npm run secrets:revoke --secret=<secret-name>
npm run secrets:emergency:rotate --all
npm run secrets:audit:access
```

## 📊 Data Operations

### Data Pipeline Management

#### Pipeline Monitoring
```bash
# Pipeline health
npm run pipeline:health --all
npm run pipeline:backlog --service=ingestion
npm run pipeline:latency --service=processing

# Data quality checks
npm run data:quality:check --date=today
npm run data:correctness:monitor
npm run data:integrity:verify

# Pipeline recovery
npm run pipeline:restart --service=<service-name>
npm run pipeline:replay --start-time="2025-08-12T10:00:00Z"
npm run pipeline:verify:processing
```

#### Data Backup and Recovery
```bash
# Regular data backup
npm run data:backup:create --type=incremental
npm run data:backup:verify --backup-id=<backup-id>
npm run data:backup:test:restore --dry-run

# Data recovery procedures  
npm run data:restore --backup-id=<backup-id> --target-time=<timestamp>
npm run data:verify:restore
npm run data:consistency:check
```

### Analytics Operations
```bash
# Analytics health
npm run analytics:health
npm run analytics:backlog:check
npm run analytics:performance:monitor

# Data refresh
npm run analytics:refresh:daily
npm run analytics:materialized:refresh
npm run analytics:cache:warm

# Reporting
npm run reports:generate:daily
npm run reports:sla:compliance  
npm run reports:usage:summary
```

## 🔐 Security Operations

### Security Monitoring

#### Daily Security Checks
```bash
# Access monitoring
npm run security:access:review --since=1d
npm run security:failed:logins --since=1d
npm run security:privilege:escalation:check

# Vulnerability scanning
npm run security:scan:dependencies
npm run security:scan:containers
npm run security:secrets:check

# Audit log review
npm run audit:review --since=1d --severity=high
npm run audit:anomaly:detection
npm run audit:compliance:check
```

#### Security Incident Response
```bash
# Incident analysis
npm run security:incident:analyze --incident-id=<id>
npm run security:trace:user --user-id=<user-id>
npm run security:ip:analysis --ip=<ip-address>

# Containment measures
npm run security:user:disable --user-id=<user-id>
npm run security:ip:block --ip=<ip-address>
npm run security:session:revoke --user-id=<user-id>

# Recovery procedures
npm run security:audit:affected:data
npm run security:notify:users --incident-id=<id>
npm run security:report:generate --incident-id=<id>
```

### Compliance Operations
```bash
# GDPR/Privacy compliance
npm run privacy:audit:data
npm run privacy:export:user --user-id=<user-id>
npm run privacy:delete:user --user-id=<user-id>

# Regulatory reporting
npm run compliance:report:quarterly
npm run compliance:audit:access
npm run compliance:retention:enforce
```

## 🚀 Performance Operations

### Performance Monitoring

#### Real-time Performance
```bash
# System performance
npm run perf:monitor:realtime
npm run perf:alerts:active
npm run perf:bottlenecks:identify

# Application performance
npm run perf:app:breakdown
npm run perf:database:analysis
npm run perf:api:latency

# User experience metrics
npm run perf:user:journey --path=<path>
npm run perf:page:load --url=<url>
npm run perf:api:response --endpoint=<endpoint>
```

#### Performance Optimization
```bash
# Cache optimization
npm run cache:analyze:hit-rate
npm run cache:optimize:strategy
npm run cache:warm:critical

# Database optimization
npm run db:query:optimize
npm run db:index:analyze
npm run db:vacuum:selective

# Application optimization
npm run app:profile:cpu
npm run app:profile:memory
npm run app:optimize:queries
```

### Capacity Management
```bash
# Capacity monitoring
npm run capacity:current:usage
npm run capacity:trends:analyze
npm run capacity:forecast:demand

# Scaling operations
npm run scaling:evaluate --service=<service>
npm run scaling:execute --service=<service> --instances=<count>
npm run scaling:verify --service=<service>

# Resource optimization
npm run resources:analyze:waste
npm run resources:optimize:allocation
npm run resources:cost:analyze
```

## 📈 Reporting & Analytics

### Operational Reporting

#### Daily Operations Report
```bash
# Generate comprehensive daily report
npm run report:operations:daily --date=today

# Key metrics include:
# - System uptime and availability
# - Error rates and SLA compliance
# - Performance metrics and trends
# - Security events and alerts
# - Capacity utilization
# - Cost analysis
```

#### Weekly Executive Summary
```bash
# Generate executive dashboard
npm run report:executive:weekly --week=current

# Includes:
# - Business KPIs and user metrics
# - System reliability and performance
# - Security posture and incidents
# - Cost trends and optimization
# - Engineering productivity metrics
```

### SLA and Compliance Reporting
```bash
# SLA compliance
npm run sla:report:monthly --month=current
npm run sla:budget:consumption
npm run sla:breach:analysis

# Compliance reporting  
npm run compliance:report:security
npm run compliance:report:privacy
npm run compliance:report:audit
```

## 🔄 Disaster Recovery

### DR Testing and Procedures

#### Weekly DR Drill
```bash
# Automated DR drill (Sundays 3 AM)
npm run dr:drill:automated --type=database
npm run dr:drill:verify --drill-id=<drill-id>
npm run dr:report:generate --drill-id=<drill-id>

# Manual DR testing
npm run dr:test:failover --service=<service>
npm run dr:test:recovery --backup-date=<date>
npm run dr:validate:integrity
```

#### Full Disaster Recovery
```bash
# Complete system recovery
npm run dr:activate:full --incident-id=<incident-id>
npm run dr:restore:database --target-time=<timestamp>
npm run dr:restore:application --version=<version>
npm run dr:verify:recovery

# Post-recovery validation
npm run dr:validate:data
npm run dr:validate:functionality
npm run dr:report:recovery --incident-id=<incident-id>
```

## 🎯 Troubleshooting Guides

### Common Issues and Solutions

#### API Performance Issues
**Symptoms**: High response times, timeouts
```bash
# Diagnosis
npm run perf:api:analyze
npm run db:connections:check
npm run cache:performance:check

# Resolution
npm run cache:clear:selective
npm run db:connections:optimize
npm run app:restart:graceful
```

#### Database Connection Issues  
**Symptoms**: Connection timeouts, pool exhaustion
```bash
# Diagnosis  
npm run db:connections:status
npm run db:pool:analyze
npm run db:locks:check

# Resolution
npm run db:connections:reset
npm run db:pool:resize --size=<new-size>
npm run db:locks:clear
```

#### Memory Issues
**Symptoms**: High memory usage, OOM errors
```bash
# Diagnosis
npm run memory:analyze --service=<service>
npm run memory:leaks:detect
npm run memory:heap:dump

# Resolution
npm run memory:gc:force
npm run app:restart:graceful --service=<service>
npm run memory:limits:adjust --service=<service>
```

#### External API Issues
**Symptoms**: External service timeouts, rate limits
```bash
# Diagnosis
npm run external:health:check --provider=<provider>
npm run external:rate:limits:check
npm run external:latency:analyze

# Resolution
npm run external:fallback:enable --provider=<provider>
npm run external:retry:configure --provider=<provider>
npm run external:circuit:breaker:reset
```

### Log Analysis Patterns

#### Error Pattern Analysis
```bash
# Common error patterns
npm run logs:pattern:analyze --pattern="database.*timeout"
npm run logs:pattern:analyze --pattern="rate.*limit.*exceeded"
npm run logs:pattern:analyze --pattern="authentication.*failed"

# Error correlation
npm run logs:correlate --error-type=<error-type>
npm run logs:timeline --incident-id=<incident-id>
npm run logs:impact:assess --error-id=<error-id>
```

## 📚 Reference Information

### Service Dependencies
```yaml
critical_dependencies:
  database: "supabase-postgresql"
  cache: "redis-cluster"
  queue: "temporal-server"
  monitoring: "prometheus-grafana"
  
external_dependencies:
  sports_data: "optimal-api, odds-api"
  messaging: "discord-api"
  notifications: "notion-api"
  
internal_services:
  api: "main-application-api"  
  bot: "discord-bot-service"
  frontend: "nextjs-dashboard"
  workers: "temporal-workers"
```

### Port and Endpoint Reference
```yaml
services:
  api:
    port: 3000
    health: "/health"
    metrics: "/metrics"
    
  database:
    port: 5432
    connection_pool: "10-50"
    
  redis:
    port: 6379
    cluster_ports: "7000-7005"
    
  temporal:
    frontend_port: 7233
    ui_port: 8080
    
  prometheus:
    port: 9090
    
  grafana:
    port: 3001
```

### Environment Variables Reference
```bash
# Database
SUPABASE_URL=<database-url>
SUPABASE_SERVICE_ROLE_KEY=<service-key>

# External APIs  
OPTIMAL_API_KEY=<api-key>
ODDS_API_KEY=<api-key>
DISCORD_BOT_TOKEN=<bot-token>

# Monitoring
PROMETHEUS_URL=<prometheus-url>
GRAFANA_URL=<grafana-url>

# Security
JWT_SECRET=<jwt-secret>
ENCRYPTION_KEY=<encryption-key>
```

---

## Emergency Contacts

**24/7 On-Call**: [Emergency Contact Information]  
**Engineering Manager**: [Contact Information]  
**Security Team**: security@company.com  
**Infrastructure Team**: infrastructure@company.com

**Last Updated**: 2025-08-12  
**Next Review**: 2025-08-19  
**Document Owner**: Engineering Operations Team