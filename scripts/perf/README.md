# Performance Testing Suite

**Phase 13 - Performance and Reliability Hardening**  
**Date:** 2025-01-25

## Overview

Comprehensive k6-based load testing suite for the Unit Talk SaaS platform. This suite validates performance under various load conditions and ensures SLO compliance.

## Prerequisites

### Install k6

**macOS:**
```bash
brew install k6
```

**Linux:**
```bash
wget https://github.com/grafana/k6/releases/download/v0.47.0/k6-v0.47.0-linux-amd64.tar.gz
tar -xzf k6-v0.47.0-linux-amd64.tar.gz
sudo mv k6 /usr/local/bin/
```

**Windows:**
```powershell
choco install k6
```

**Docker:**
```bash
docker pull grafana/k6:latest
```

### Environment Variables

Create a `.env` file or export variables:

```bash
export BASE_URL="https://api.unit-talk.com"
export API_KEY="your-api-key-here"
export SCENARIO="ramp"  # ramp, soak, spike, stress
```

## Test Scenarios

### 1. Ramp Test (Default)

Gradually increases load from 1k to 5k RPS over 13 minutes.

**Purpose:** Validate gradual scaling behavior and identify performance degradation points.

**Duration:** 13 minutes

**Stages:**
- Warm-up: 2 min @ 1k RPS
- Ramp: 5 min → 3k RPS
- Peak: 3 min @ 5k RPS
- Cool down: 2 min → 2k RPS
- Shutdown: 1 min → 0 RPS

**Run:**
```bash
k6 run scripts/perf/k6-load-tests.js
# or
k6 run --scenario ramp_test scripts/perf/k6-load-tests.js
```

### 2. Soak Test

Sustained load at 2k RPS for 1 hour.

**Purpose:** Identify memory leaks, resource exhaustion, and long-term stability issues.

**Duration:** 60 minutes

**Run:**
```bash
k6 run --scenario soak_test scripts/perf/k6-load-tests.js
```

### 3. Spike Test

Sudden traffic spike from 1k to 10k RPS.

**Purpose:** Validate auto-scaling response and graceful degradation under sudden load.

**Duration:** 2 minutes

**Run:**
```bash
k6 run --scenario spike_test scripts/perf/k6-load-tests.js
```

### 4. Stress Test

Gradually increase load to find breaking point.

**Purpose:** Determine maximum capacity and identify bottlenecks.

**Duration:** 17 minutes

**Run:**
```bash
k6 run --scenario stress_test scripts/perf/k6-load-tests.js
```

## Running Tests

### Basic Usage

```bash
# Run all scenarios sequentially
k6 run scripts/perf/k6-load-tests.js

# Run specific scenario
k6 run --scenario ramp_test scripts/perf/k6-load-tests.js

# Run with custom base URL
BASE_URL=https://staging.unit-talk.com k6 run scripts/perf/k6-load-tests.js

# Run with custom duration
k6 run --duration 30m scripts/perf/k6-load-tests.js
```

### Docker Usage

```bash
# Run with Docker
docker run --rm -i \
  -e BASE_URL=https://api.unit-talk.com \
  -e API_KEY=your-api-key \
  -v $(pwd)/scripts/perf:/scripts \
  -v $(pwd)/out/ops/perf:/out \
  grafana/k6:latest run /scripts/k6-load-tests.js

# Run specific scenario
docker run --rm -i \
  -e BASE_URL=https://api.unit-talk.com \
  grafana/k6:latest run --scenario soak_test /scripts/k6-load-tests.js
```

### Advanced Options

```bash
# Run with custom VUs
k6 run --vus 100 --duration 10m scripts/perf/k6-load-tests.js

# Run with output to InfluxDB
k6 run --out influxdb=http://localhost:8086/k6 scripts/perf/k6-load-tests.js

# Run with JSON output
k6 run --out json=out/ops/perf/results.json scripts/perf/k6-load-tests.js

# Run with CSV output
k6 run --out csv=out/ops/perf/results.csv scripts/perf/k6-load-tests.js

# Run with Prometheus remote write
k6 run --out experimental-prometheus-rw scripts/perf/k6-load-tests.js
```

## Metrics and Thresholds

### SLO Thresholds

The test suite enforces the following SLO thresholds:

| Metric | Threshold | Description |
|--------|-----------|-------------|
| `api_latency` | p95 < 150ms, p99 < 500ms | API response time |
| `error_rate` | < 0.5% | HTTP 5xx error rate |
| `db_latency` | p95 < 50ms, p99 < 100ms | Database query time |
| `http_req_duration` | p95 < 150ms, p99 < 500ms | Total request duration |
| `http_req_failed` | < 0.5% | Failed request rate |
| `checks` | > 99.5% | Check success rate |

### Custom Metrics

- **api_latency**: API endpoint response time
- **db_latency**: Estimated database query time
- **error_rate**: Rate of errors (4xx/5xx)
- **queue_depth**: Temporal workflow queue depth
- **successful_requests**: Count of successful requests
- **failed_requests**: Count of failed requests

## Reports

### HTML Report

Generated automatically after each test run:

```
out/ops/perf/k6-report-{timestamp}.html
```

Open in browser to view:
- Summary statistics
- Response time graphs
- Error rate charts
- Throughput metrics

### JSON Summary

Detailed metrics in JSON format:

```
out/ops/perf/k6-summary-{timestamp}.json
```

Use for:
- Automated analysis
- CI/CD integration
- Historical comparison

### Console Output

Real-time summary with color-coded results displayed in terminal.

## Interpreting Results

### Success Criteria

✅ **PASS** if:
- All thresholds are met
- p95 latency < 150ms
- Error rate < 0.5%
- No crashes or timeouts

❌ **FAIL** if:
- Any threshold is violated
- Error rate > 0.5%
- Service becomes unavailable

### Common Issues

#### High Latency

**Symptoms:**
- p95 > 150ms
- p99 > 500ms

**Possible Causes:**
- Database slow queries
- Insufficient pod replicas
- Network congestion
- External API delays

**Actions:**
1. Check database query performance
2. Review HPA scaling behavior
3. Analyze slow endpoints
4. Optimize database indexes

#### High Error Rate

**Symptoms:**
- Error rate > 0.5%
- HTTP 5xx responses

**Possible Causes:**
- Database connection pool exhaustion
- Redis connection failures
- Memory/CPU limits reached
- Application bugs

**Actions:**
1. Check pod logs for errors
2. Review connection pool settings
3. Verify resource limits
4. Check external service health

#### Failed Auto-Scaling

**Symptoms:**
- Latency increases under load
- CPU/Memory at 100%
- Pods not scaling up

**Possible Causes:**
- HPA misconfiguration
- Resource quota limits
- Metrics server issues

**Actions:**
1. Check HPA status: `kubectl get hpa`
2. Review HPA events: `kubectl describe hpa`
3. Verify metrics server: `kubectl top pods`
4. Check resource quotas

## Integration with CI/CD

### GitHub Actions

```yaml
name: Performance Tests

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
  workflow_dispatch:

jobs:
  performance-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install k6
        run: |
          wget https://github.com/grafana/k6/releases/download/v0.47.0/k6-v0.47.0-linux-amd64.tar.gz
          tar -xzf k6-v0.47.0-linux-amd64.tar.gz
          sudo mv k6 /usr/local/bin/
      
      - name: Run performance tests
        env:
          BASE_URL: ${{ secrets.API_BASE_URL }}
          API_KEY: ${{ secrets.API_KEY }}
        run: |
          k6 run scripts/perf/k6-load-tests.js
      
      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: performance-results
          path: out/ops/perf/
```

### GitLab CI

```yaml
performance-test:
  stage: test
  image: grafana/k6:latest
  script:
    - k6 run scripts/perf/k6-load-tests.js
  artifacts:
    paths:
      - out/ops/perf/
    expire_in: 30 days
  only:
    - schedules
```

## Best Practices

### Before Running Tests

1. **Notify team**: Inform team about upcoming load tests
2. **Check production**: Ensure production is healthy
3. **Backup data**: Take database snapshot if testing on staging
4. **Monitor dashboards**: Open Grafana dashboards
5. **Set alerts**: Configure Slack/PagerDuty notifications

### During Tests

1. **Monitor metrics**: Watch Grafana dashboards
2. **Check logs**: Monitor pod logs for errors
3. **Watch auto-scaling**: Observe HPA behavior
4. **Track costs**: Monitor cloud resource usage
5. **Be ready to abort**: Have kill switch ready

### After Tests

1. **Review results**: Analyze HTML reports
2. **Check SLO compliance**: Verify all thresholds met
3. **Document issues**: Record any problems found
4. **Update baselines**: Adjust thresholds if needed
5. **Share findings**: Post results to team

## Troubleshooting

### Test Won't Start

```bash
# Check k6 installation
k6 version

# Verify script syntax
k6 inspect scripts/perf/k6-load-tests.js

# Check environment variables
echo $BASE_URL
echo $API_KEY
```

### High Error Rate During Test

```bash
# Check API health
curl $BASE_URL/health

# Check pod status
kubectl get pods -n unit-talk

# Check pod logs
kubectl logs -n unit-talk -l app=unit-talk-api --tail=100

# Check HPA status
kubectl get hpa -n unit-talk
```

### Test Hangs or Crashes

```bash
# Kill k6 process
pkill k6

# Check system resources
top
df -h

# Reduce load
k6 run --vus 10 --duration 1m scripts/perf/k6-load-tests.js
```

## Support

- **Documentation**: `docs/ops/PHASE13_PERF_HARDENING.md`
- **Slack**: #platform-sre
- **Email**: sre@unit-talk.com
- **On-Call**: PagerDuty rotation

## References

- [k6 Documentation](https://k6.io/docs/)
- [k6 Examples](https://k6.io/docs/examples/)
- [Grafana k6 Cloud](https://k6.io/cloud/)
- [Phase 13 Documentation](../../docs/ops/PHASE13_PERF_HARDENING.md)

---

**Last Updated:** 2025-01-25  
**Maintained By:** Platform SRE Team

