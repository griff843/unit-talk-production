# Pre-Launch Readiness Testing Guide

Complete guide for executing comprehensive pre-launch readiness testing for the Unit Talk platform.

## Overview

The pre-launch readiness testing suite ensures production deployment confidence through systematic validation of all platform components, performance characteristics, and operational procedures.

### Testing Categories

1. **E2E Agent/App Testing** - Functional validation of all system components
2. **Shadow Mode Soak Testing** - 48-72 hour continuous operation validation
3. **Performance & Load Testing** - Scalability and performance validation
4. **Chaos Engineering** - Resilience and failure recovery testing
5. **Go-Live Rehearsal** - Complete deployment procedure validation

## Quick Start

### Via GitHub Actions (Recommended)

```bash
# Trigger via GitHub UI or API
gh workflow run prelaunch-readiness.yml \
  -f test_suite=all \
  -f environment=staging \
  -f intensity=medium \
  -f duration_hours=24 \
  -f notify_webhook=https://your-webhook.com/notify
```

### Local Execution

```bash
# Prerequisites
npm install
docker-compose up -d

# Run individual test suites
npm run test:e2e           # E2E testing
npm run test:soak          # Soak testing
npm run test:load          # Load testing
npm run test:chaos         # Chaos testing
npm run test:rehearsal     # Go-live rehearsal

# Run complete suite
npm run test:prelaunch
```

## Detailed Test Suites

### 1. E2E Agent/App Testing

**Purpose**: Validate end-to-end functionality of all platform components.

**Location**: `tests/e2e/`

**Test Files**:
- `e2e-feed.test.ts` - Feed agent functionality
- `e2e-grading.test.ts` - Grading agent accuracy  
- `e2e-promoter.test.ts` - Promotion logic validation
- `e2e-alerts.test.ts` - Alert system functionality
- `e2e-recaps.test.ts` - Recap generation
- `e2e-bot.test.ts` - Discord bot interactions
- `e2e-frontend.test.ts` - Frontend application flows
- `e2e-safemode.test.ts` - Safe mode triggering and behavior

**Execution**:
```bash
# Run all E2E tests
npx playwright test tests/e2e/

# Run specific test suite
npx playwright test tests/e2e/e2e-grading.test.ts

# Run with UI mode
npx playwright test --ui tests/e2e/
```

**Success Criteria**:
- All agent workflows complete successfully
- Data flows correctly through pipeline stages
- UI components respond appropriately
- Safe mode triggers activate correctly
- No data corruption or integrity issues

### 2. Shadow Mode Soak Testing

**Purpose**: Validate system stability over extended periods without affecting production.

**Location**: `scripts/soak/shadow-soak.ts`

**Features**:
- Continuous monitoring for 48-72 hours
- Memory leak detection
- Performance degradation monitoring
- Data integrity validation
- Shadow mode compliance verification

**Execution**:
```bash
# Standard 48-hour soak test
SOAK_DURATION=48 npx tsx scripts/soak/shadow-soak.ts

# Custom duration with alerts
SOAK_DURATION=72 \
ALERT_WEBHOOK_URL=https://hooks.slack.com/... \
npx tsx scripts/soak/shadow-soak.ts
```

**Monitoring Metrics**:
- Memory usage trends
- API response time stability
- Database query performance
- Error rate consistency
- Discord publication blocking (shadow mode)

**Success Criteria**:
- No memory leaks (>1GB growth per hour)
- API performance within 20% of baseline
- Zero Discord publications in shadow mode
- Data integrity maintained throughout
- Automatic recovery from minor issues

### 3. Performance & Load Testing

**Purpose**: Validate system performance under various load conditions.

**Location**: `scripts/performance/`

**Tools**:
- **k6**: JavaScript-based load testing (`k6-load-test.js`)
- **Artillery**: YAML-configured scenarios (`artillery-scenarios.yml`)

**Test Scenarios**:
- **Baseline**: Normal daily operations (10 VUs)
- **Peak**: Game-time traffic surge (30 VUs)
- **Stress**: Breaking point identification (200 VUs)
- **Spike**: Sudden traffic burst (5→200→5 VUs)

**Execution**:
```bash
# k6 load testing
k6 run scripts/performance/k6-load-test.js

# Artillery testing
artillery run scripts/performance/artillery-scenarios.yml

# Specific environment
API_URL=https://staging.unit-talk.com \
k6 run scripts/performance/k6-load-test.js
```

**Performance Targets**:
- **API Response Time**: P95 < 500ms, P99 < 1000ms
- **Database Queries**: P95 < 50ms
- **Error Rate**: < 1% under normal load
- **Throughput**: > 100 RPS sustained
- **Grading Performance**: < 800ms per pick

**Success Criteria**:
- All performance targets met
- No service failures under peak load
- Graceful degradation under stress
- Quick recovery from spike events

### 4. Chaos Engineering Testing

**Purpose**: Validate system resilience through controlled failure injection.

**Location**: `scripts/chaos/chaos-suite.ts`

**Failure Scenarios**:

**Low Risk**:
- Individual service outages
- Network latency injection
- CPU stress testing

**Medium Risk**:
- Database connection failures
- Memory leak simulation
- Disk space exhaustion
- Rate limit exhaustion

**High Risk** (staging only):
- Data corruption injection
- Cascade failure simulation
- Byzantine failure scenarios
- Time skew testing

**Execution**:
```bash
# Safe chaos testing (staging)
CHAOS_INTENSITY=medium \
CHAOS_SAFE_MODE=true \
CHAOS_CONFIRM=true \
npx tsx scripts/chaos/chaos-suite.ts

# Full chaos testing (non-production)
CHAOS_INTENSITY=high \
NODE_ENV=staging \
CHAOS_CONFIRM=true \
npx tsx scripts/chaos/chaos-suite.ts
```

**Success Criteria**:
- System enters safe mode for critical failures
- Services recover within 30 seconds
- Data integrity maintained during failures
- Monitoring alerts trigger appropriately
- No cascade failures propagate

### 5. Go-Live Rehearsal

**Purpose**: Complete end-to-end validation of production deployment procedures.

**Location**: `scripts/rehearsal/go-live-rehearsal.ts`

**Rehearsal Steps**:

1. **Infrastructure Health Check**
2. **Environment Configuration Validation**
3. **Database Migration Dry-Run**
4. **Dependencies Validation**
5. **Service Build & Packaging**
6. **Service Deployment Sequence**
7. **Production Data Seeding**
8. **Integration Testing**
9. **Performance Baseline Establishment**
10. **Load Testing Execution**
11. **Security Scanning**
12. **Compliance Validation**
13. **Monitoring Setup**
14. **Alert Testing**
15. **Rollback Procedure Testing**
16. **Backup/Restore Verification**
17. **Final Health Check**
18. **Go-Live Checklist Execution**

**Execution**:
```bash
# Staging rehearsal (dry-run)
REHEARSAL_ENV=staging \
DRY_RUN=true \
npx tsx scripts/rehearsal/go-live-rehearsal.ts

# Production rehearsal (dry-run)
REHEARSAL_ENV=production-dry-run \
DRY_RUN=true \
NOTIFY_WEBHOOK=https://hooks.slack.com/... \
npx tsx scripts/rehearsal/go-live-rehearsal.ts
```

**Success Criteria**:
- All 18 rehearsal steps pass
- Zero critical failures
- All blockers resolved
- Performance targets met
- Monitoring and alerts functional

## Environment Configuration

### Required Environment Variables

```bash
# Core Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
API_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3001
COMMAND_CENTER_URL=http://localhost:3002

# Testing Configuration
NODE_ENV=test
DATABASE_URL=postgresql://user:pass@localhost:5432/test_db

# Notification Configuration
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/...
NOTIFY_WEBHOOK=https://your-monitoring-webhook.com

# Test Behavior Configuration
DRY_RUN=true
CHAOS_CONFIRM=true
CHAOS_SAFE_MODE=true
SHADOW_MODE=true
```

### Docker Compose Configurations

**Development**: `docker-compose.yml`
**Testing**: `docker-compose.test.yml`
**Staging**: `docker-compose.staging.yml`

## CI/CD Integration

### GitHub Actions Workflow

**File**: `.github/workflows/prelaunch-readiness.yml`

**Triggers**:
- Manual dispatch with configurable parameters
- Scheduled daily runs (2 AM UTC)
- Push to `prelaunch-readiness/*` branches

**Workflow Steps**:
1. **Setup** - Environment configuration and test matrix generation
2. **Build** - Docker image building and registry push
3. **E2E Tests** - Parallel execution across test suites
4. **Soak Tests** - Long-running stability validation
5. **Load Tests** - Performance validation with k6/Artillery
6. **Chaos Tests** - Resilience validation (staging only)
7. **Rehearsal** - Complete deployment procedure
8. **Report** - Comprehensive result aggregation
9. **Notify** - Stakeholder notification

### Workflow Configuration

```yaml
# Manual trigger example
gh workflow run prelaunch-readiness.yml \
  -f test_suite=all \
  -f environment=staging \
  -f intensity=medium \
  -f duration_hours=24
```

## Results and Reporting

### Artifact Structure

```
test-artifacts/
├── e2e-results-*/          # Playwright test results per suite
├── soak-test-results/       # Soak test metrics and logs
├── load-test-results-*/     # k6/Artillery performance data
├── chaos-test-results/      # Chaos testing outcomes
├── rehearsal-results/       # Go-live rehearsal report
└── comprehensive-test-report.json  # Consolidated results
```

### Report Format

**JSON Report** (`comprehensive-test-report.json`):
```json
{
  "workflow_run": "123456789",
  "environment": "staging",
  "go_live_ready": true,
  "summary": {
    "total_tests": 5,
    "passed_tests": 5,
    "failed_tests": 0
  },
  "results": {
    "e2e": { "suites_run": 8, "status": "completed" },
    "load": { "avg_p95": 245.5, "max_rps": 150 },
    "rehearsal": { "go_live_ready": true, "critical_failures": 0 }
  }
}
```

**Markdown Summary** (`test-summary.md`):
```markdown
# Pre-Launch Readiness Test Report

**Environment:** staging
**Status:** ✅ GO-LIVE READY

## Summary
- **Total Test Categories:** 5
- **Passed:** 5
- **Failed:** 0

## Load Testing
- **Avg P95:** 245.50ms
- **Max RPS:** 150
- **Avg Error Rate:** 0.12%
```

## Troubleshooting

### Common Issues

**E2E Test Failures**:
```bash
# Check browser availability
npx playwright install --with-deps

# Verify test environment
docker-compose -f docker-compose.test.yml ps

# Run with debug mode
DEBUG=pw:api npx playwright test
```

**Soak Test Memory Issues**:
```bash
# Monitor memory usage
docker stats

# Check for memory leaks
node --expose-gc --inspect scripts/soak/shadow-soak.ts
```

**Load Test Performance Issues**:
```bash
# Verify baseline performance
curl -w "@curl-format.txt" http://localhost:3000/health

# Check resource utilization
docker exec api top
```

**Chaos Test Environment**:
```bash
# Verify safe mode enabled
echo $CHAOS_SAFE_MODE

# Check Docker permissions
docker exec api iptables -L
```

### Performance Debugging

**API Response Times**:
```bash
# Enable detailed logging
DEBUG=api:* npm start

# Profile specific endpoints
autocannon -c 10 -d 30s http://localhost:3000/api/picks
```

**Database Query Performance**:
```sql
-- Enable query logging
ALTER SYSTEM SET log_min_duration_statement = 100;

-- Analyze slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;
```

## Best Practices

### Test Execution

1. **Always run tests in isolation** - Use clean environments
2. **Monitor resource usage** - Prevent resource exhaustion
3. **Validate test data** - Ensure realistic test scenarios
4. **Check baseline performance** - Establish performance expectations
5. **Document failures** - Capture detailed failure information

### Environment Management

1. **Use consistent configurations** - Standardize across environments
2. **Implement proper cleanup** - Reset state between tests
3. **Monitor external dependencies** - Account for third-party services
4. **Maintain test data integrity** - Use predictable test datasets
5. **Version control test configurations** - Track changes over time

### Continuous Improvement

1. **Analyze test trends** - Monitor performance over time
2. **Update test scenarios** - Reflect production usage patterns
3. **Automate where possible** - Reduce manual intervention
4. **Review and refine thresholds** - Adjust based on operational experience
5. **Maintain documentation** - Keep guides current and accurate

## Security Considerations

### Test Data

- **No production data in tests** - Use synthetic or anonymized data
- **Secure credential management** - Use secrets management systems
- **Network isolation** - Run tests in isolated environments
- **Audit test execution** - Log all test activities

### Access Control

- **Limited test permissions** - Minimum required access
- **Separate test credentials** - Dedicated test service accounts
- **Time-limited access** - Expire test credentials regularly
- **Monitor test activities** - Alert on suspicious behavior

## Support and Escalation

### Contact Information

- **Primary Contact**: Engineering Team
- **Secondary Contact**: DevOps Team
- **Emergency Contact**: On-call Engineer

### Escalation Procedures

1. **Test Failures**: Engineering Team → DevOps Team
2. **Infrastructure Issues**: DevOps Team → Platform Team
3. **Security Concerns**: Security Team → Engineering Lead
4. **Go-Live Blockers**: Engineering Lead → CTO

### Documentation Updates

This guide should be updated:
- After major platform changes
- Following test procedure modifications
- When new test categories are added
- After performance threshold adjustments

---

**Last Updated**: 2025-01-13
**Version**: 1.0.0
**Owner**: Engineering Team