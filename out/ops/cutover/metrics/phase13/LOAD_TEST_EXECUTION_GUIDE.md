# Phase 13 Load Test Execution Guide

**Generated:** 2025-10-30
**Charter Reference:** Production Charter v4.0
**Load Test Framework:** autocannon
**Test Script:** `scripts/load/inference-load-test.js`

## Overview

The Phase 13 load test validates Charter v4.0 SLO compliance under sustained production-like load using autocannon, a high-performance HTTP benchmarking tool.

## Prerequisites

### 1. Environment Setup

```bash
# Install dependencies (if not already installed)
cd C:\Users\griff\OneDrive\Desktop\unit-talk-production-main
npm install autocannon --save-dev
```

### 2. API Server Running

**Option A: Development Mode**
```bash
cd apps/api
npm run start:dev
```

**Option B: Docker**
```bash
docker-compose up api
```

**Option C: Production Build**
```bash
cd apps/api
npm run build
npm start
```

### 3. Environment Variables

Required environment variables (in `.env`):

```env
# Inference Configuration
INFERENCE_P95_LATENCY_TARGET=150
INFERENCE_P99_LATENCY_TARGET=300
ENSEMBLE_METHOD=confidence_weighted
ENSEMBLE_MIN_MODELS=3
RATE_LIMIT_QPS=1000
CIRCUIT_BREAKER_OPEN_AFTER_ERRORS=5

# Evaluator Configuration
EVALUATOR_DRIFT_THRESHOLD=0.15
EVALUATOR_ENABLE_AUTO_RETRAIN=true

# Canary Configuration
CANARY_MODE=canary
CANARY_PERCENT=5
```

### 4. Verify API Health

```bash
curl http://localhost:3000/api/inference/health
```

Expected response:
```json
{
  "status": "healthy",
  "components": {
    "inferenceGateway": "healthy",
    "ensembleCoordinator": "healthy",
    "continuousEvaluator": "healthy"
  }
}
```

## Load Test Configuration

### Default Settings

| Parameter | Default Value | Charter Target |
|-----------|--------------|----------------|
| Duration | 300s (5 min) | ≥300s |
| Connections | 50 | 50 |
| Pipelining | 10 | - |
| Endpoints | 3 (predict, ensemble, batch) | All |

### Environment Overrides

```bash
# Custom duration (e.g., 10 minutes)
export LOAD_TEST_DURATION=600

# Custom connections (e.g., 100)
export LOAD_TEST_CONNECTIONS=100

# Custom pipelining
export LOAD_TEST_PIPELINING=5

# Custom API URL
export API_BASE_URL=http://localhost:3010
```

## Execution

### Standard 5-Minute Load Test

```bash
cd scripts/load
node inference-load-test.js
```

**Expected Output:**
```
╔═══════════════════════════════════════════════════════════════════╗
║  Phase 13: Model Serving & Ensemble Layer - Load Test            ║
║  Charter v4.0 SLO Validation                                      ║
╚═══════════════════════════════════════════════════════════════════╝

Running Load Test: Single/Auto Predict
Endpoint: /api/predict
Duration: 300s, Connections: 50, Pipelining: 10

[autocannon output...]

=== SLO Compliance Analysis: Single/Auto Predict ===

P95 Latency: 142.50ms ✓ PASS (Target: < 150ms)
P99 Latency: 285.00ms ✓ PASS (Target: < 300ms)
Error Rate: 0.001% ✓ PASS (Target: < 0.5%)
Throughput: 350.00 req/s ✓ PASS (Target: > 100 req/s)

Overall Compliance: ✓ PASS
```

### Extended Load Test (Stress Testing)

```bash
# 30-minute stress test
export LOAD_TEST_DURATION=1800
node inference-load-test.js
```

### High Concurrency Test

```bash
# Test with 200 concurrent connections
export LOAD_TEST_CONNECTIONS=200
node inference-load-test.js
```

### Production Simulation

```bash
# Production-like load (10 min, 100 connections)
export LOAD_TEST_DURATION=600
export LOAD_TEST_CONNECTIONS=100
export API_BASE_URL=https://api.production.unittalk.com
node inference-load-test.js
```

## Test Phases

The load test executes three sequential phases:

### Phase 1: Single/Auto Predict
- **Endpoint:** `/api/predict`
- **Payload:** Single feature set with `ensembleMode: 'auto'`
- **Purpose:** Validate single prediction latency and throughput

### Phase 2: Ensemble Predict
- **Endpoint:** `/api/ensemble/predict`
- **Payload:** Single feature set with `includeExplanation: true`
- **Purpose:** Validate ensemble prediction with explanation overhead

### Phase 3: Batch Predict
- **Endpoint:** `/api/predict/batch`
- **Payload:** 3-item batch with `parallel: true`
- **Purpose:** Validate batch processing efficiency

## SLO Validation

### Charter v4.0 Targets

| SLO | Target | Validation |
|-----|--------|------------|
| P95 Latency | < 150ms | Per-endpoint measurement |
| P99 Latency | < 300ms | Per-endpoint measurement |
| Error Rate | < 0.5% | (errors / total_requests) |
| Throughput | > 100 req/s | Average requests per second |

### Pass/Fail Criteria

✅ **PASS:** All four SLOs met on all three endpoints
❌ **FAIL:** Any SLO violation on any endpoint

## Result Artifacts

The load test automatically generates three artifacts in `out/ops/cutover/metrics/phase13/`:

### 1. JSON Results
**Filename:** `LOADTEST_RESULTS_<timestamp>.json`

```json
{
  "timestamp": "2025-10-30T15:30:00.000Z",
  "configuration": {
    "apiBaseUrl": "http://localhost:3000",
    "duration": 300,
    "connections": 50,
    "pipelining": 10
  },
  "tests": [
    {
      "testName": "Single/Auto Predict",
      "p95Latency": 142.5,
      "p99Latency": 285.0,
      "errorRate": 0.001,
      "requestsPerSecond": 350.0,
      "totalRequests": 105000,
      "errors": 1,
      "sloCompliance": {
        "p95Pass": true,
        "p99Pass": true,
        "errorRatePass": true,
        "throughputPass": true,
        "overallPass": true
      }
    }
  ],
  "summary": {
    "allP95Pass": true,
    "allP99Pass": true,
    "allErrorRatePass": true,
    "allThroughputPass": true,
    "allTestsPass": true
  }
}
```

### 2. Markdown Summary
**Filename:** `LOADTEST_SUMMARY_<timestamp>.md`

Includes:
- Executive summary (PASS/FAIL)
- Configuration details
- Test results table
- Detailed metrics per endpoint
- Charter v4.0 compliance matrix
- Recommendations

### 3. CSV Data
**Filename:** `LOADTEST_DATA_<timestamp>.csv`

```csv
Test Name,P95 Latency (ms),P99 Latency (ms),Error Rate (%),Throughput (req/s),Total Requests,Errors,P95 Pass,P99 Pass,Error Rate Pass,Throughput Pass,Overall Pass
Single/Auto Predict,142.50,285.00,0.001,350.00,105000,1,true,true,true,true,true
Ensemble Predict,145.00,290.00,0.002,320.00,96000,2,true,true,true,true,true
Batch Predict,138.00,275.00,0.000,180.00,54000,0,true,true,true,true,true
```

## Interpreting Results

### Healthy System Indicators

✅ **P95 Latency: 100-140ms**
- System is performing well below SLO
- Healthy headroom for production variability

✅ **P99 Latency: 200-280ms**
- Tail latencies under control
- Circuit breakers not triggering

✅ **Error Rate: 0.00-0.10%**
- Well below 0.5% threshold
- System is highly reliable

✅ **Throughput: 200-500 req/s**
- Exceeds minimum 100 req/s target
- System can handle production load

### Warning Indicators

⚠️ **P95 Latency: 140-150ms**
- Close to SLO boundary
- Monitor closely in production
- Consider optimization

⚠️ **P99 Latency: 280-300ms**
- Tail latencies approaching limit
- Review infrastructure resources
- Check for contention

⚠️ **Error Rate: 0.10-0.40%**
- Approaching threshold
- Investigate error patterns
- Review circuit breaker logs

⚠️ **Throughput: 100-150 req/s**
- Meeting minimum but limited headroom
- Consider horizontal scaling
- Profile bottlenecks

### Failure Indicators

❌ **P95 Latency: >150ms**
- SLO violation
- System not production-ready
- **Action:** Performance optimization required

❌ **P99 Latency: >300ms**
- Tail latency SLO violation
- **Action:** Infrastructure scaling or code optimization

❌ **Error Rate: >0.5%**
- Reliability SLO violation
- **Action:** Bug fixes or circuit breaker tuning required

❌ **Throughput: <100 req/s**
- Insufficient capacity
- **Action:** Scaling or architectural changes needed

## Troubleshooting

### High Latency (P95/P99 > target)

**Possible Causes:**
- Insufficient CPU/memory
- Database query slowness
- Model inference overhead
- Network latency

**Diagnosis:**
```bash
# Check system resources
docker stats

# Check API logs
docker logs api-container

# Profile endpoint
curl -w "@curl-format.txt" http://localhost:3000/api/predict
```

**Solutions:**
- Increase container resources
- Add database indexes
- Optimize model inference
- Enable caching

### High Error Rate (>0.5%)

**Possible Causes:**
- Input validation failures
- Model loading errors
- Circuit breaker triggering
- Dependency failures

**Diagnosis:**
```bash
# Check error logs
grep ERROR apps/api/logs/*.log

# Check circuit breaker status
curl http://localhost:3000/api/inference/health
```

**Solutions:**
- Review input validation
- Check model registry
- Tune circuit breaker settings
- Verify dependency health

### Low Throughput (<100 req/s)

**Possible Causes:**
- Rate limiting too aggressive
- Connection pool exhaustion
- CPU bottleneck
- Synchronous blocking operations

**Diagnosis:**
```bash
# Check rate limit config
grep RATE_LIMIT .env

# Check connection pool
docker exec api-container npm run check-pools
```

**Solutions:**
- Increase RATE_LIMIT_QPS
- Increase connection pool size
- Add more workers
- Profile for blocking operations

### Load Test Crashes

**Possible Causes:**
- Out of memory
- Socket exhaustion
- API server crash
- Network timeout

**Diagnosis:**
```bash
# Check process status
ps aux | grep node

# Check available memory
free -h

# Check socket limits
ulimit -n
```

**Solutions:**
```bash
# Increase socket limit
ulimit -n 65536

# Increase Node memory
export NODE_OPTIONS="--max-old-space-size=4096"

# Restart API with more resources
docker-compose up -d --scale api=2
```

## Best Practices

### 1. Baseline Before Changes

Always run a baseline load test before making changes:

```bash
# Baseline
node inference-load-test.js > baseline.log

# Make changes...

# Comparison
node inference-load-test.js > after-changes.log
diff baseline.log after-changes.log
```

### 2. Gradual Load Increase

For first-time testing, start small and increase:

```bash
# Step 1: Light load (30s, 10 connections)
export LOAD_TEST_DURATION=30
export LOAD_TEST_CONNECTIONS=10
node inference-load-test.js

# Step 2: Medium load (60s, 25 connections)
export LOAD_TEST_DURATION=60
export LOAD_TEST_CONNECTIONS=25
node inference-load-test.js

# Step 3: Full load (300s, 50 connections)
export LOAD_TEST_DURATION=300
export LOAD_TEST_CONNECTIONS=50
node inference-load-test.js
```

### 3. Warm-Up Period

Consider a warm-up period before official load test:

```bash
# Warm-up: 30s at low load
export LOAD_TEST_DURATION=30
export LOAD_TEST_CONNECTIONS=5
node inference-load-test.js

# Wait 10s
sleep 10

# Official test
export LOAD_TEST_DURATION=300
export LOAD_TEST_CONNECTIONS=50
node inference-load-test.js
```

### 4. Monitor System Metrics

Run system monitoring during load test:

```bash
# Terminal 1: Run load test
node inference-load-test.js

# Terminal 2: Monitor resources
watch -n 1 "docker stats --no-stream"

# Terminal 3: Monitor logs
docker logs -f api-container
```

### 5. Test in Staging First

Always test in staging environment before production:

```bash
# Staging
export API_BASE_URL=https://api.staging.unittalk.com
node inference-load-test.js

# Review results, then production
export API_BASE_URL=https://api.production.unittalk.com
node inference-load-test.js
```

## Integration with E2E Tests

Recommended test sequence:

1. **E2E Tests First** (5-10 minutes)
   - Validates functional correctness
   - Ensures all endpoints work
   - Catches logic errors

2. **Load Tests Second** (5+ minutes)
   - Validates performance at scale
   - Measures SLO compliance
   - Identifies scalability issues

3. **Result Comparison**
   - E2E provides functional baseline
   - Load test validates production readiness
   - Both must PASS for deployment

## Next Steps

After successful load test:

1. ✅ Review all three result artifacts
2. ✅ Verify all SLOs met
3. ✅ Store artifacts in version control
4. ✅ Update PR summary with results
5. ✅ Proceed to canary deployment

## Appendix: Expected Performance Targets

### Target Metrics (Charter v4.0)

| Metric | Minimum | Target | Excellent |
|--------|---------|--------|-----------|
| P95 Latency | <150ms | <120ms | <100ms |
| P99 Latency | <300ms | <250ms | <200ms |
| Error Rate | <0.5% | <0.1% | <0.01% |
| Throughput | >100 req/s | >300 req/s | >500 req/s |

### Resource Utilization Targets

| Resource | Target | Warning | Critical |
|----------|--------|---------|----------|
| CPU | <60% | 60-80% | >80% |
| Memory | <70% | 70-85% | >85% |
| Network | <50% | 50-75% | >75% |
| Disk I/O | <40% | 40-70% | >70% |

---

**Status:** Ready for execution
**Prerequisites:** All met per CONFIG_VERIFICATION.md
**Exit Criteria:** All tests PASS with artifacts generated
