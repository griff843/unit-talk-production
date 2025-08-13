# Test Execution Playbook

Step-by-step operational playbook for executing pre-launch readiness testing.

## Pre-Execution Checklist

### Environment Setup

- [ ] All required environment variables configured
- [ ] Docker services running and healthy
- [ ] Database migrations applied
- [ ] External service connectivity verified
- [ ] Test data properly seeded
- [ ] Monitoring and alerting configured

### Resource Verification

- [ ] Sufficient disk space (>10GB free)
- [ ] Adequate memory (>8GB available)
- [ ] Network bandwidth available
- [ ] CPU resources not constrained
- [ ] Docker daemon running smoothly

### Access and Permissions

- [ ] GitHub Actions permissions configured
- [ ] Docker registry access verified
- [ ] Database credentials functional
- [ ] External API keys valid
- [ ] Notification webhooks accessible

## Execution Scenarios

### Scenario 1: Full Pre-Launch Validation

**Use Case**: Complete readiness assessment before production deployment

**Duration**: 24-48 hours

**Steps**:

1. **Preparation** (30 minutes)
   ```bash
   # Verify environment
   docker-compose -f docker-compose.staging.yml ps
   
   # Check resource availability
   df -h
   free -h
   
   # Validate configuration
   npm run config:validate
   ```

2. **Trigger Execution** (5 minutes)
   ```bash
   gh workflow run prelaunch-readiness.yml \
     -f test_suite=all \
     -f environment=staging \
     -f intensity=medium \
     -f duration_hours=48 \
     -f notify_webhook=https://hooks.slack.com/services/...
   ```

3. **Monitor Progress** (Ongoing)
   - Check GitHub Actions dashboard
   - Monitor notification channels
   - Review artifact uploads
   - Watch resource utilization

4. **Results Analysis** (2 hours)
   - Download comprehensive report
   - Review individual test results
   - Identify any blockers
   - Document findings

### Scenario 2: Quick Smoke Test

**Use Case**: Rapid validation after minor changes

**Duration**: 2-4 hours

**Steps**:

1. **Execute E2E Only**
   ```bash
   gh workflow run prelaunch-readiness.yml \
     -f test_suite=e2e \
     -f environment=staging \
     -f intensity=low
   ```

2. **Local Load Test**
   ```bash
   k6 run --duration 10m --vus 20 scripts/performance/k6-load-test.js
   ```

3. **Quick Rehearsal**
   ```bash
   REHEARSAL_ENV=staging DRY_RUN=true \
   npx tsx scripts/rehearsal/go-live-rehearsal.ts
   ```

### Scenario 3: Stress Testing Focus

**Use Case**: Validate system limits and breaking points

**Duration**: 4-6 hours

**Steps**:

1. **High-Intensity Testing**
   ```bash
   gh workflow run prelaunch-readiness.yml \
     -f test_suite=load \
     -f environment=staging \
     -f intensity=high
   ```

2. **Chaos Engineering**
   ```bash
   CHAOS_INTENSITY=high \
   CHAOS_SAFE_MODE=true \
   npx tsx scripts/chaos/chaos-suite.ts
   ```

3. **Extended Load Test**
   ```bash
   k6 run --duration 2h --vus 100 scripts/performance/k6-load-test.js
   ```

### Scenario 4: Production Rehearsal

**Use Case**: Final validation before go-live

**Duration**: 6-8 hours

**Steps**:

1. **Complete Rehearsal**
   ```bash
   gh workflow run prelaunch-readiness.yml \
     -f test_suite=rehearsal \
     -f environment=production-dry-run \
     -f intensity=medium
   ```

2. **Shadow Mode Validation**
   ```bash
   SOAK_DURATION=24 \
   SHADOW_MODE=true \
   npx tsx scripts/soak/shadow-soak.ts
   ```

3. **Final Sign-off**
   - Review all test results
   - Validate go-live checklist
   - Obtain stakeholder approval

## Monitoring and Alerting

### Real-Time Monitoring

**GitHub Actions Dashboard**:
- Monitor workflow progress
- Check job status and logs
- Download artifacts as available

**Resource Monitoring**:
```bash
# CPU and memory usage
watch -n 5 'docker stats --no-stream'

# Disk usage
watch -n 10 'df -h'

# Network activity
nethogs

# Database performance
docker exec postgres \
  psql -U postgres -c "SELECT * FROM pg_stat_activity;"
```

**Application Monitoring**:
```bash
# API health
watch -n 30 'curl -s http://localhost:3000/health | jq'

# Service logs
docker-compose logs -f --tail=100

# Error rates
docker exec api \
  grep -c ERROR /var/log/app.log
```

### Alert Conditions

**Critical Alerts**:
- Workflow failure
- Critical test failures
- Resource exhaustion (>90%)
- Service outages
- Data integrity issues

**Warning Alerts**:
- Performance degradation (>20%)
- Memory growth (>1GB/hour)
- Error rate increase (>2%)
- External service issues

### Notification Channels

**Slack Integration**:
```json
{
  "text": "Pre-launch readiness alert",
  "attachments": [{
    "color": "danger",
    "title": "Test Failure",
    "text": "E2E grading tests failed - 3 scenarios",
    "fields": [{
      "title": "Environment",
      "value": "staging",
      "short": true
    }]
  }]
}
```

**Email Notifications**:
- Test completion summaries
- Critical failure alerts
- Weekly test reports

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. E2E Test Timeouts

**Symptoms**:
- Playwright tests hanging
- Browser crashes
- Element not found errors

**Solutions**:
```bash
# Increase timeout
PLAYWRIGHT_TIMEOUT=60000 npx playwright test

# Use headed browser for debugging
npx playwright test --headed

# Enable verbose logging
DEBUG=pw:api npx playwright test
```

#### 2. Load Test Performance Issues

**Symptoms**:
- High response times
- Connection timeouts
- Resource exhaustion

**Solutions**:
```bash
# Scale down test intensity
k6 run --vus 10 --duration 5m scripts/performance/k6-load-test.js

# Check resource limits
docker exec api cat /proc/meminfo
docker exec api cat /proc/cpuinfo

# Optimize database connections
docker exec postgres \
  psql -U postgres -c "SHOW max_connections;"
```

#### 3. Soak Test Memory Leaks

**Symptoms**:
- Continuous memory growth
- Out of memory errors
- Process crashes

**Solutions**:
```bash
# Enable garbage collection
node --expose-gc scripts/soak/shadow-soak.ts

# Monitor heap snapshots
node --inspect scripts/soak/shadow-soak.ts

# Reduce check frequency
CHECK_INTERVAL=30 npx tsx scripts/soak/shadow-soak.ts
```

#### 4. Chaos Test Environment Issues

**Symptoms**:
- Permission denied errors
- Network manipulation failures
- Service recovery issues

**Solutions**:
```bash
# Check Docker privileges
docker exec api whoami
docker exec api capabilities

# Verify network tools
docker exec api which tc
docker exec api which iptables

# Enable privileged mode
docker run --privileged ...
```

#### 5. Database Connection Issues

**Symptoms**:
- Connection refused
- Timeout errors
- Migration failures

**Solutions**:
```bash
# Verify database status
docker-compose exec postgres pg_isready

# Check connection limits
docker exec postgres \
  psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"

# Reset connections
docker-compose restart postgres
```

### Debug Commands

**Service Health**:
```bash
# Check all service status
docker-compose ps

# View service logs
docker-compose logs [service_name]

# Execute commands in containers
docker-compose exec api bash
```

**Performance Analysis**:
```bash
# API response time analysis
curl -w "@curl-format.txt" -s -o /dev/null http://localhost:3000/api/health

# Database query analysis
docker exec postgres \
  psql -U postgres -c "SELECT query, calls, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# Resource utilization
docker exec api top -bn1
```

**Network Diagnostics**:
```bash
# Container networking
docker network ls
docker network inspect [network_name]

# Port connectivity
docker exec api netstat -tulpn
docker exec api ss -tulpn
```

## Recovery Procedures

### Test Failure Recovery

#### 1. Identify Root Cause
```bash
# Check workflow logs
gh run view [run_id] --log

# Download artifacts
gh run download [run_id]

# Analyze failure patterns
grep -r "ERROR\|FAIL" test-artifacts/
```

#### 2. Environment Reset
```bash
# Stop all services
docker-compose down -v

# Clean up resources
docker system prune -f
docker volume prune -f

# Restart clean environment
docker-compose up -d
```

#### 3. Selective Re-execution
```bash
# Re-run specific test suite
gh workflow run prelaunch-readiness.yml \
  -f test_suite=e2e \
  -f environment=staging

# Local test execution
npx playwright test tests/e2e/e2e-grading.test.ts
```

### Resource Exhaustion Recovery

#### 1. Immediate Actions
```bash
# Stop resource-intensive processes
pkill -f "k6\|artillery\|chaos"

# Clean up Docker resources
docker system prune -af

# Free up disk space
docker volume prune -f
```

#### 2. Resource Scaling
```bash
# Increase Docker memory limits
echo '{"default-ulimits":{"memlock":{"Hard":67108864,"Name":"memlock","Soft":67108864}}}' | sudo tee /etc/docker/daemon.json

# Restart Docker daemon
sudo systemctl restart docker
```

#### 3. Load Balancing
```bash
# Distribute tests across runners
gh workflow run prelaunch-readiness.yml \
  -f test_suite=e2e

gh workflow run prelaunch-readiness.yml \
  -f test_suite=load
```

## Quality Gates

### Go/No-Go Criteria

#### ✅ Green Light (Proceed)
- All critical tests pass
- Performance within targets
- Zero data integrity issues
- Safe mode functions correctly
- Monitoring and alerts operational

#### ⚠️ Yellow Light (Investigate)
- Non-critical test failures
- Performance near limits
- Minor configuration issues
- Intermittent errors

#### 🛑 Red Light (Stop)
- Critical test failures
- Performance below targets
- Data corruption detected
- Safe mode not functioning
- Security vulnerabilities found

### Decision Matrix

| Component | Critical | Pass Rate | Action |
|-----------|----------|-----------|---------|
| E2E Tests | ✅ | >95% | Proceed |
| Load Tests | ✅ | >90% | Proceed |
| Soak Tests | ✅ | >99% | Proceed |
| Chaos Tests | ⚠️ | >80% | Investigate |
| Rehearsal | ✅ | 100% | Required |

## Reporting and Documentation

### Test Report Structure

```markdown
# Pre-Launch Readiness Report
**Date**: 2025-01-13
**Environment**: staging
**Duration**: 24 hours
**Status**: ✅ READY FOR GO-LIVE

## Executive Summary
All critical tests passed with performance within acceptable targets.

## Detailed Results
### E2E Testing: ✅ PASS
- Suites run: 8/8
- Pass rate: 98.5%
- Failed tests: 1 non-critical

### Performance Testing: ✅ PASS
- API P95: 245ms (target: <500ms)
- Throughput: 150 RPS (target: >100 RPS)
- Error rate: 0.12% (target: <1%)

### Go-Live Rehearsal: ✅ PASS
- Steps completed: 18/18
- Critical failures: 0
- Blockers: None

## Recommendations
1. Monitor grading performance under peak load
2. Review error handling in promoter agent
3. Update monitoring thresholds based on baseline

## Sign-off
- Engineering Lead: ✅ Approved
- DevOps Lead: ✅ Approved
- Product Owner: ✅ Approved
```

### Stakeholder Communication

**Daily Updates** (During testing):
```
Subject: Pre-Launch Testing - Day 2 Update

Status: IN PROGRESS ⏳
- E2E Tests: COMPLETE ✅
- Soak Test: RUNNING (36/48 hours) 🔄
- Load Tests: QUEUED ⏸️

No blockers identified. On track for completion tomorrow.
```

**Final Report** (Upon completion):
```
Subject: Pre-Launch Readiness - COMPLETE ✅

All tests completed successfully.
Ready for production deployment.

Next Steps:
1. Review final report (attached)
2. Schedule go-live meeting
3. Prepare deployment plan
```

## Maintenance and Updates

### Regular Maintenance

**Weekly**:
- Review test performance trends
- Update test data
- Check dependency versions
- Validate monitoring alerts

**Monthly**:
- Update performance baselines
- Review and refine test scenarios
- Update documentation
- Conduct playbook drills

**Quarterly**:
- Major test suite updates
- Performance target reviews
- Infrastructure capacity planning
- Team training updates

### Version Control

**Test Scripts**: Versioned with application code
**Configuration**: Environment-specific configurations
**Documentation**: Living documents updated with changes
**Baselines**: Performance baselines tracked over time

---

**Document Version**: 1.0.0
**Last Updated**: 2025-01-13
**Next Review**: 2025-02-13
**Owner**: Engineering Team