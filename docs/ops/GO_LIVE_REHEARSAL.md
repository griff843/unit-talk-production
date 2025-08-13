# Go-Live Rehearsal Operations Guide

**Version**: 1.0.0  
**Owner**: Platform Operations Team  
**Last Updated**: January 2025  
**Review Frequency**: Monthly

## 🎯 Overview

The Go-Live Rehearsal Suite is a comprehensive automated testing and validation system designed to ensure production readiness for the Unit Talk platform. It orchestrates blue/green deployments, tests incident response procedures, validates rollback capabilities, and verifies disaster recovery operations.

**Purpose**: Provide confidence in production deployments through automated rehearsal of all critical go-live procedures, including canary traffic management, incident simulation, and emergency response validation.

## 🏗️ Architecture

### Core Components

```
scripts/rehearsal/
├── go-live-rehearsal.ts         # Main orchestrator (12 steps)
├── lib/
│   ├── flags.ts                 # Safety flag management
│   ├── health.ts                # Health monitoring
│   ├── traffic.ts               # Blue/green traffic control
│   ├── alerts.ts                # Alertmanager integration
│   ├── disaster-recovery.ts     # DR snapshot/restore
│   └── reporting.ts             # Report generation
├── docker-compose.blue-green.yml # Blue/green environments
└── nginx/
    └── blue-green.conf          # Traffic routing configuration
```

### Infrastructure Components

- **Docker Compose Blue/Green**: Separate blue and green environment containers
- **Nginx Load Balancer**: Traffic routing based on `ACTIVE_COLOR` environment variable
- **Database Snapshots**: Automated PostgreSQL backup/restore capabilities
- **Monitoring Integration**: Prometheus/Alertmanager for incident simulation
- **GitHub Actions**: CI/CD integration with environment-specific execution

## 📋 Rehearsal Process (12 Steps)

### Step 1: Preflight Checks ✈️
**Duration**: ~2 minutes  
**Purpose**: Validate environment readiness

- ✅ CI/CD pipeline status verification
- ✅ Database connectivity testing
- ✅ Service health validation
- ✅ Docker environment verification
- ✅ Required environment variables check

### Step 2: Safety Defaults 🛡️
**Duration**: ~1 minute  
**Purpose**: Activate safety mechanisms

- ✅ `SAFE_MODE=true` - Prevents destructive operations
- ✅ `SHADOW_MODE=true` - Disables external notifications
- ✅ `PUBLISH_TO_DISCORD=false` - Blocks Discord publishing
- ✅ `AUTO_SETTLEMENT=false` - Prevents automatic settlements

### Step 3: Build & Tag Green Images 🐳
**Duration**: ~4 minutes  
**Purpose**: Prepare green environment

- ✅ Docker image building with latest code
- ✅ Green environment tagging
- ✅ Container registry pushing
- ✅ Image integrity verification

### Step 4: Canary Warmup 🔥
**Duration**: ~3 minutes  
**Purpose**: Prepare green environment for traffic

- ✅ Green environment startup
- ✅ Health check validation
- ✅ Service connectivity testing
- ✅ Database connection verification

### Step 5: Traffic Switch (10%) 🚦
**Duration**: ~2 minutes  
**Purpose**: Route canary traffic to green

- ✅ Nginx configuration update (`ACTIVE_COLOR=green`)
- ✅ 10% traffic routing to green environment
- ✅ Traffic distribution monitoring
- ✅ Error rate tracking

### Step 6: Health Gate Validation 🏥
**Duration**: ~3 minutes  
**Purpose**: Monitor canary health

- ✅ Error rate < 0.1% validation
- ✅ Response time < 200ms verification
- ✅ CPU usage < 80% monitoring
- ✅ Memory usage < 90% checking

### Step 7: Incident Simulation 🚨
**Duration**: ~3 minutes  
**Purpose**: Test emergency response

- ✅ CPU spike simulation (95% usage)
- ✅ Critical alert triggering
- ✅ Automatic SAFE_MODE activation
- ✅ Traffic rollback to blue verification

### Step 8: Alert Validation 📢
**Duration**: ~1 minute  
**Purpose**: Verify notification systems

- ✅ Alertmanager integration testing
- ✅ Slack notification delivery
- ✅ Discord alert verification
- ✅ Email notification validation

### Step 9: Rollback Drill 🔄
**Duration**: ~2 minutes  
**Purpose**: Validate emergency rollback

- ✅ One-click rollback execution
- ✅ Traffic switch to blue (100%)
- ✅ Green environment shutdown
- ✅ System state restoration

### Step 10: DR Snapshot 💾
**Duration**: ~5 minutes  
**Purpose**: Create disaster recovery backup

- ✅ Database snapshot creation (`pg_dump`)
- ✅ Snapshot compression and validation
- ✅ Upload to backup storage
- ✅ Checksum verification

### Step 11: DR Restore Test 🔧
**Duration**: ~4 minutes  
**Purpose**: Validate disaster recovery

- ✅ Throwaway database creation
- ✅ Snapshot restore to isolated environment
- ✅ Smoke test execution
- ✅ Data integrity validation

### Step 12: Cleanup & Reporting 📊
**Duration**: ~1 minute  
**Purpose**: Generate results

- ✅ Temporary resource cleanup
- ✅ Comprehensive report generation
- ✅ Screenshot archiving
- ✅ Audit trail creation

## 🚀 Execution Guide

### Prerequisites

1. **Environment Access**:
   ```bash
   # Required environment variables
   export SUPABASE_URL="your-supabase-url"
   export SUPABASE_SERVICE_KEY="your-service-key"
   export ALERTMANAGER_URL="http://localhost:9093"
   export DOCKER_COMPOSE_FILE="docker-compose.blue-green.yml"
   ```

2. **Docker Environment**:
   ```bash
   # Ensure Docker and Docker Compose are running
   docker --version
   docker-compose --version
   ```

3. **Database Access**:
   ```bash
   # Test database connectivity
   npm run db:status
   npm run db:migrate
   ```

### Manual Execution

#### Staging Environment
```bash
# Execute staging rehearsal (dry-run mode)
npm run rehearsal:staging

# Or with explicit flags
npx tsx scripts/rehearsal/go-live-rehearsal.ts \
  --env=staging \
  --dry-run=true \
  --canary-percent=10 \
  --include-incident-simulation=true \
  --include-dr-testing=true \
  --include-rollback-drill=true
```

#### Production Environment
```bash
# Execute production rehearsal (CAUTION: Use dry-run first)
npm run rehearsal:production:dry-run

# Live production rehearsal (requires confirmation)
npm run rehearsal:production:live
```

### GitHub Actions Integration

#### Staging Rehearsal Workflow
```yaml
name: Staging Go-Live Rehearsal
on:
  workflow_dispatch:
    inputs:
      canary_percent:
        description: 'Canary traffic percentage'
        default: '10'
        type: choice
        options: ['5', '10', '25', '50']
      
jobs:
  staging-rehearsal:
    runs-on: ubuntu-latest
    steps:
      - name: Execute Rehearsal
        run: |
          npm run rehearsal:staging -- \
            --canary-percent=${{ inputs.canary_percent }}
```

#### Production Rehearsal Workflow
```yaml
name: Production Go-Live Rehearsal
on:
  workflow_dispatch:
    inputs:
      dry_run:
        description: 'Run in dry-run mode'
        default: true
        type: boolean
      
jobs:
  production-rehearsal:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Execute Production Rehearsal
        run: |
          npm run rehearsal:production -- \
            --dry-run=${{ inputs.dry_run }}
```

## 🎮 Command Center Integration

### Rehearsal Dashboard

Navigate to: `http://localhost:3004/dashboard/rehearsal`

#### Features:
- **Real-time Progress Monitoring**: Live step-by-step execution tracking
- **Active Color Badge**: Visual indicator of current active environment (Blue/Green)
- **Emergency Controls**: Immediate stop and rollback capabilities
- **Health Status Display**: Real-time system health monitoring
- **Report Downloads**: Access to generated rehearsal reports

#### Control Interface:
```typescript
// Start rehearsal from Command Center
const startRehearsal = async (environment: 'staging' | 'prod') => {
  const response = await fetch('/api/rehearsal/start', {
    method: 'POST',
    body: JSON.stringify({ environment, dryRun: true }),
  });
  return response.json();
};

// Monitor rehearsal progress
const monitorProgress = () => {
  const eventSource = new EventSource('/api/rehearsal/stream');
  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    updateRehearsalStatus(data);
  };
};
```

### Emergency Controls

#### Emergency Stop
```bash
# Immediate stop of active rehearsal
curl -X POST http://localhost:3004/api/rehearsal/emergency-stop \
  -H "Authorization: Bearer $TOKEN"
```

#### Force Rollback to Blue
```bash
# Emergency rollback to stable blue environment
curl -X POST http://localhost:3004/api/rehearsal/rollback \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"target": "blue", "emergency": true}'
```

## 📊 Monitoring & Observability

### Health Monitoring

The rehearsal suite continuously monitors:

1. **System Health**:
   - CPU usage (<80%)
   - Memory consumption (<90%)
   - Disk space availability
   - Network connectivity

2. **Application Health**:
   - Response times (<200ms)
   - Error rates (<0.1%)
   - Database connection pool
   - Service availability

3. **Business Metrics**:
   - Pick processing rates
   - Alert delivery success
   - User session stability

### Alerting Integration

#### Prometheus Metrics
```yaml
# Example alert rule
groups:
  - name: rehearsal-alerts
    rules:
      - alert: RehearsalStepFailed
        expr: rehearsal_step_success == 0
        for: 0m
        labels:
          severity: critical
        annotations:
          summary: "Rehearsal step {{ $labels.step }} failed"
```

#### Notification Channels
- **Slack**: `#ops-alerts` channel
- **Discord**: `#system-monitoring` channel
- **Email**: Platform operations team
- **PagerDuty**: Critical incident escalation

## 🔧 Troubleshooting

### Common Issues

#### 1. Docker Environment Not Ready
```bash
# Symptoms: "Docker daemon not running" error
# Resolution:
docker system info
docker-compose ps
./dev.sh start  # Start development environment
```

#### 2. Database Connection Failures
```bash
# Symptoms: "Connection timeout" or "Database unavailable"
# Resolution:
npm run db:status
npm run db:migrate
# Check Supabase service status
curl -I $SUPABASE_URL/rest/v1/
```

#### 3. Traffic Routing Issues
```bash
# Symptoms: Traffic not splitting correctly
# Resolution:
docker-compose exec nginx nginx -t  # Test nginx config
docker-compose restart nginx        # Restart load balancer
# Check ACTIVE_COLOR environment variable
echo $ACTIVE_COLOR
```

#### 4. Health Gate Failures
```bash
# Symptoms: Health checks failing repeatedly
# Resolution:
# Check individual service health
curl http://localhost:3000/health
curl http://localhost:3001/health  # Green environment
# Review service logs
docker-compose logs api
```

#### 5. Incident Simulation Not Triggering
```bash
# Symptoms: CPU spike not detected or alerts not firing
# Resolution:
# Verify Alertmanager connectivity
curl http://localhost:9093/api/v1/status
# Check alert rules configuration
curl http://localhost:9090/api/v1/rules
```

### Debug Mode

Enable detailed logging for troubleshooting:

```bash
# Enable debug mode
export DEBUG=rehearsal:*
export LOG_LEVEL=debug

# Run rehearsal with verbose output
npx tsx scripts/rehearsal/go-live-rehearsal.ts \
  --env=staging \
  --dry-run=true \
  --verbose=true
```

### Log Analysis

Important log locations:
- **Rehearsal Logs**: `./logs/rehearsal-YYYYMMDD.log`
- **Docker Logs**: `docker-compose logs [service]`
- **Nginx Logs**: `./logs/nginx/access.log`
- **Database Logs**: Check Supabase dashboard

## 📈 Performance Optimization

### Expected Performance Benchmarks

| Step | Target Duration | SLA |
|------|----------------|-----|
| Preflight Checks | 2 minutes | 3 minutes |
| Green Environment Build | 4 minutes | 6 minutes |
| Traffic Switch | 2 minutes | 3 minutes |
| Health Validation | 3 minutes | 5 minutes |
| DR Operations | 9 minutes | 15 minutes |
| **Total Rehearsal** | **30 minutes** | **45 minutes** |

### Optimization Strategies

1. **Docker Image Optimization**:
   ```dockerfile
   # Use multi-stage builds
   FROM node:18-alpine AS builder
   # Layer caching optimization
   COPY package*.json ./
   RUN npm ci --only=production
   ```

2. **Database Optimization**:
   ```sql
   -- Pre-warm critical queries
   ANALYZE unified_picks;
   ANALYZE agent_health;
   ANALYZE raw_props;
   ```

3. **Parallel Execution**:
   ```typescript
   // Execute independent steps in parallel
   await Promise.all([
     validateDatabaseHealth(),
     validateServiceHealth(),
     validateExternalAPIs()
   ]);
   ```

## 🔒 Security Considerations

### Safety Mechanisms

1. **Dry-Run Mode**: All rehearsals default to dry-run mode
2. **Environment Isolation**: Staging and production environments are completely isolated
3. **Access Control**: Role-based permissions for rehearsal execution
4. **Audit Logging**: Complete audit trail of all actions
5. **Emergency Stops**: Immediate termination capabilities

### Production Safety

- **Never run production rehearsals without explicit approval**
- **Always use dry-run mode for initial validation**
- **Verify all safety flags are properly set**
- **Confirm rollback procedures are operational**
- **Validate monitoring and alerting systems**

### Data Protection

- **Throwaway databases are isolated and automatically cleaned up**
- **Production data is never modified during dry-run rehearsals**
- **Sensitive configuration is managed via environment variables**
- **Database snapshots are encrypted and access-controlled**

## 📝 Standard Operating Procedures

### Pre-Rehearsal Checklist

- [ ] Verify environment variables are properly configured
- [ ] Confirm Docker environment is running and healthy
- [ ] Validate database connectivity and migration status
- [ ] Check that monitoring and alerting systems are operational
- [ ] Ensure adequate disk space for snapshots and logs
- [ ] Confirm backup and restore procedures are tested
- [ ] Verify that all team members are available for support

### During Rehearsal

- [ ] Monitor progress through Command Center dashboard
- [ ] Validate each step completion before proceeding
- [ ] Check health metrics continuously
- [ ] Be prepared to execute emergency stop if needed
- [ ] Document any anomalies or unexpected behaviors
- [ ] Take screenshots of critical milestones

### Post-Rehearsal

- [ ] Review complete rehearsal report
- [ ] Analyze performance metrics and timing
- [ ] Document lessons learned and improvement opportunities
- [ ] Update procedures based on findings
- [ ] Archive reports and screenshots for audit purposes
- [ ] Schedule next rehearsal based on deployment timeline

## 📞 Support & Escalation

### Support Contacts

- **Primary**: Platform Operations Team (`#ops-support`)
- **Secondary**: DevOps Engineering (`#devops-alerts`)
- **Emergency**: On-call engineer (PagerDuty)

### Escalation Matrix

| Severity | Response Time | Escalation |
|----------|--------------|------------|
| Low | 4 hours | Team lead |
| Medium | 1 hour | Operations manager |
| High | 30 minutes | Engineering manager |
| Critical | 15 minutes | VP Engineering |

### Emergency Procedures

1. **Rehearsal Failure**: Immediate rollback to blue environment
2. **System Compromise**: Activate emergency stop and isolate systems
3. **Data Issues**: Restore from last known good snapshot
4. **Communication**: Use established incident communication channels

## 📚 References

### Related Documentation

- **[System Architecture](../architecture/README.md)** - Overall platform architecture
- **[Deployment Procedures](./DEPLOYMENT.md)** - Standard deployment processes  
- **[Incident Response](./INCIDENT_RESPONSE.md)** - Emergency response procedures
- **[Monitoring Guide](./MONITORING.md)** - System monitoring and alerting

### External Resources

- **[Blue/Green Deployment Patterns](https://martinfowler.com/bliki/BlueGreenDeployment.html)**
- **[Canary Deployments](https://docs.flagger.app/usage/deployment-strategies#canary-deployment)**
- **[Disaster Recovery Best Practices](https://cloud.google.com/architecture/disaster-recovery)**

---

**Document Owner**: Platform Operations Team  
**Review Cycle**: Monthly or after significant system changes  
**Approval Authority**: VP Engineering

## Appendix A: Configuration Reference

### Environment Variables

```bash
# Core Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
ENVIRONMENT=staging|production

# Rehearsal Configuration  
ACTIVE_COLOR=blue|green
CANARY_PERCENT=10
DRY_RUN=true
INCLUDE_INCIDENT_SIMULATION=true
INCLUDE_DR_TESTING=true
INCLUDE_ROLLBACK_DRILL=true

# Safety Configuration
SAFE_MODE=true
SHADOW_MODE=true
PUBLISH_TO_DISCORD=false
AUTO_SETTLEMENT=false

# Monitoring Configuration
ALERTMANAGER_URL=http://localhost:9093
PROMETHEUS_URL=http://localhost:9090
LOG_LEVEL=info

# Storage Configuration
BACKUP_STORAGE_URL=s3://your-backup-bucket
SCREENSHOT_STORAGE=./screenshots
REPORT_STORAGE=./reports
```

### Docker Compose Configuration

```yaml
# docker-compose.blue-green.yml
version: '3.8'
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    environment:
      - ACTIVE_COLOR=${ACTIVE_COLOR:-blue}
    volumes:
      - ./nginx/blue-green.conf:/etc/nginx/conf.d/default.conf
    depends_on:
      - api-blue
      - api-green

  api-blue:
    build: .
    environment:
      - NODE_ENV=production
      - COLOR=blue
    ports:
      - "3000:3000"

  api-green:
    build: .
    environment:
      - NODE_ENV=production
      - COLOR=green  
    ports:
      - "3001:3000"
```

## Appendix B: Command Reference

### CLI Commands

```bash
# Basic execution
npm run rehearsal:staging
npm run rehearsal:production:dry-run
npm run rehearsal:production:live

# Advanced options
npx tsx scripts/rehearsal/go-live-rehearsal.ts \
  --env=staging \
  --dry-run=true \
  --canary-percent=25 \
  --skip-incident-simulation=false \
  --skip-dr-testing=false \
  --skip-rollback-drill=false \
  --output-format=markdown \
  --screenshot-dir=./screenshots \
  --report-dir=./reports

# Environment management
npm run rehearsal:switch-to-blue
npm run rehearsal:switch-to-green  
npm run rehearsal:emergency-stop
npm run rehearsal:cleanup

# Monitoring and debugging
npm run rehearsal:status
npm run rehearsal:logs
npm run rehearsal:health-check
npm run rehearsal:test-connectivity
```

### API Endpoints

```bash
# Start rehearsal
POST /api/rehearsal/start
{
  "environment": "staging",
  "dryRun": true,
  "canaryPercent": 10
}

# Get status
GET /api/rehearsal/status

# Stream progress
GET /api/rehearsal/stream (Server-Sent Events)

# Emergency controls
POST /api/rehearsal/emergency-stop
POST /api/rehearsal/rollback

# Download report
GET /api/rehearsal/reports/{id}/download
```
