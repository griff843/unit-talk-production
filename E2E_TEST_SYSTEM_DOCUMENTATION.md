# E2E TEST SYSTEM DOCUMENTATION

## 🎯 OVERVIEW

The Unit Talk E2E Test System provides comprehensive validation of the entire prop and alert pipeline, ensuring all components work together seamlessly with 2-minute maximum intervals and syndicate-level Discord performance.

## 🚀 QUICK START

### 1. Environment Setup
```bash
# Copy and configure environment file
cp config/test.env.example .env
# Edit .env with your actual API keys and configuration

# Validate environment setup
npm run test:env-validate
```

### 2. Run Tests
```bash
# Full pipeline test (recommended)
npm run test:full-pipeline

# Individual test components
npm run test:temporal          # Test Temporal workflows only
npm run test:e2e-local        # Full E2E pipeline test
```

### 3. Monitor Results
```bash
# Check test logs
ls -la logs/e2e-test/

# View test summary
cat logs/e2e-test/$(date +%Y-%m-%d)/test-summary.json
```

## 📋 TEST COMPONENTS

### 1. Environment Validator (`test:env-validate`)
**Purpose**: Validates all prerequisites before running tests
**Duration**: ~30 seconds
**Validates**:
- ✅ Environment variables (API keys, database URLs, Discord webhooks)
- ✅ Dependencies (npm packages, node_modules)
- ✅ Database connectivity (Supabase connection and table access)
- ✅ API endpoints (key format validation)
- ✅ Temporal setup (configuration and file structure)
- ✅ Discord webhooks (URL format validation)
- ✅ File system (permissions and directory structure)

**Output**: Detailed validation report with pass/fail/warning status

### 2. Temporal Test Runner (`test:temporal`)
**Purpose**: Validates Temporal workflows can execute without issues
**Duration**: ~2-3 minutes
**Tests**:
- ✅ Basic workflows (analytics, notification)
- ✅ Syndicate workflows (ingestion, USP processing, grading, alerts)
- ✅ Mock activities for safe testing
- ✅ Workflow timeouts and error handling

**Output**: Workflow execution status and timing

### 3. E2E Test Runner (`test:e2e-local`)
**Purpose**: Full end-to-end pipeline validation with real data flow
**Duration**: ~10-15 minutes
**Tests**:
- ✅ Complete ingestion → processing → alerting pipeline
- ✅ Multiple leagues (MLB, WNBA, MLS)
- ✅ 2-minute cycle timing validation
- ✅ Discord delivery performance (<30 seconds)
- ✅ API fallback mechanisms
- ✅ Error recovery and health monitoring
- ✅ Data integrity and business logic validation

**Output**: Comprehensive test report with metrics and manual review checklist

## 🎮 TEST SCENARIOS

### Basic Test (`test:e2e-basic`)
- **Duration**: ~5 minutes
- **Scope**: Single league (MLB)
- **Cycles**: 1
- **Failures**: None simulated
- **Use Case**: Quick validation, development testing

### Comprehensive Test (`test:e2e-comprehensive`)
- **Duration**: ~15 minutes
- **Scope**: Multiple leagues (MLB, WNBA, MLS)
- **Cycles**: 3
- **Failures**: API failures, fallback testing
- **Use Case**: Pre-deployment validation, CI/CD

### Stress Test (`test:e2e-stress`)
- **Duration**: ~30 minutes
- **Scope**: All leagues (MLB, WNBA, MLS, NFL)
- **Cycles**: 10
- **Failures**: Multiple failure scenarios
- **Use Case**: Performance validation, load testing

## 📊 PERFORMANCE TARGETS

### Timing Requirements
| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| Cycle Time | 90s | 110s | 120s |
| Discord Delivery (Critical) | 15s | 25s | 30s |
| Discord Delivery (High) | 30s | 45s | 60s |
| API Response | 2s | 5s | 10s |
| Database Query | 0.5s | 1s | 2s |

### Success Criteria
- ✅ **Cycle Completion Rate**: >95%
- ✅ **Discord Delivery Rate**: >99%
- ✅ **API Success Rate**: >98%
- ✅ **Data Accuracy**: >95%
- ✅ **Fallback Success**: >90%

## 🔧 CONFIGURATION

### Test Configuration (`config/e2e-test.json`)
```json
{
  "testScenarios": {
    "basic": { "leagues": ["MLB"], "cycles": 1 },
    "comprehensive": { "leagues": ["MLB", "WNBA", "MLS"], "cycles": 3 },
    "stress": { "leagues": ["MLB", "WNBA", "MLS", "NFL"], "cycles": 10 }
  },
  "performance": {
    "targets": {
      "cycleTime": { "target": 90000, "warning": 110000 },
      "discordDelivery": { "critical": 15000, "high": 30000 }
    }
  }
}
```

### Environment Configuration (`.env`)
```bash
# Required for testing
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPTIMAL_API_KEY=your-optimal-api-key
DISCORD_APPROVED_WEBHOOK_URL=https://discord.com/api/webhooks/...
TEMPORAL_TASK_QUEUE=unit-talk-local

# Optional for enhanced testing
SGO_API_KEY=your-sgo-api-key
ODDS_API_KEY=your-odds-api-key
DISCORD_OPERATOR_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

## 🚨 FAILURE SIMULATION

The E2E test system automatically simulates various failure scenarios:

### 1. Primary API Failure
- **Scenario**: Optimal API becomes unavailable
- **Expected**: Automatic fallback to SGO API
- **Validation**: Successful data ingestion continues
- **Duration**: 60 seconds

### 2. Database Connection Issues
- **Scenario**: Temporary database connectivity problems
- **Expected**: Automatic retry and recovery
- **Validation**: No data loss, operations resume
- **Duration**: 30 seconds

### 3. Discord Webhook Failure
- **Scenario**: Discord webhook returns errors
- **Expected**: Retry mechanism activates
- **Validation**: Alerts eventually delivered
- **Duration**: 45 seconds

### 4. API Quota Exhaustion
- **Scenario**: Primary API quota reaches 95%
- **Expected**: Fallback providers activated
- **Validation**: Continuous data flow maintained
- **Duration**: Until quota resets

## 📈 MONITORING & METRICS

### Real-time Monitoring
During test execution, the system tracks:
- **Cycle Times**: Each workflow execution duration
- **Discord Delivery**: Alert delivery timestamps
- **API Response Times**: All external API calls
- **Database Performance**: Query execution times
- **Memory/CPU Usage**: System resource utilization
- **Error Rates**: Failure frequency and recovery

### Health Scoring
The system calculates a health score (0-100) based on:
- **Performance**: 40% weight (cycle times, delivery speed)
- **Reliability**: 30% weight (success rates, uptime)
- **Data Quality**: 20% weight (accuracy, completeness)
- **Recovery**: 10% weight (error handling, fallback success)

## 📋 MANUAL REVIEW CHECKLIST

After test completion, manually verify:

### 1. Discord Channels
- [ ] **#approved-picks**: Fresh S/A tier picks visible
- [ ] **#operator-alerts**: System health notifications
- [ ] **Message Timestamps**: All within delivery targets
- [ ] **Content Accuracy**: Props match database records

### 2. Database Tables
- [ ] **raw_props**: No duplicates, complete data
- [ ] **final_picks**: Only S/A tier props present
- [ ] **games**: Accurate status updates
- [ ] **raw_props**: Proper normalization and ingestion
- [ ] **final_picks**: S/A tier picks promotion

### 3. System Logs
- [ ] **Error Logs**: No critical unhandled errors
- [ ] **Performance Logs**: Cycle times within targets
- [ ] **Fallback Logs**: Successful provider switches
- [ ] **Health Logs**: Consistent health scores >70

### 4. API Quotas
- [ ] **Optimal API**: Usage tracking accurate
- [ ] **Fallback APIs**: Activated when needed
- [ ] **Rate Limiting**: No quota violations
- [ ] **Cost Tracking**: Usage within budget

## 🛠️ TROUBLESHOOTING

### Common Issues

#### Environment Validation Fails
```bash
# Check environment file
cat .env | grep -E "(SUPABASE|OPTIMAL|DISCORD)"

# Validate API keys
npm run test:env-validate
```

#### Temporal Connection Issues
```bash
# Check Temporal server
curl http://localhost:7233/api/v1/namespaces

# Restart Temporal (if using Docker)
docker-compose restart temporal
```

#### Database Connection Fails
```bash
# Test Supabase connection
curl -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
     "$SUPABASE_URL/rest/v1/raw_props?select=count"
```

#### Discord Webhooks Not Working
```bash
# Test webhook URL
curl -X POST "$DISCORD_APPROVED_WEBHOOK_URL" \
     -H "Content-Type: application/json" \
     -d '{"content": "Test message"}'
```

### Performance Issues

#### Slow Cycle Times
1. **Check Database Performance**: Query execution times
2. **Monitor API Response**: External API latency
3. **Review Resource Usage**: CPU/memory constraints
4. **Optimize Workflows**: Parallel execution opportunities

#### Discord Delivery Delays
1. **Check Webhook Status**: Discord API availability
2. **Review Batch Sizes**: Optimize alert grouping
3. **Monitor Rate Limits**: Discord API constraints
4. **Validate Network**: Connectivity issues

## 📚 EXPECTED OUTPUT SAMPLES

### Successful Test Summary
```
🎯 E2E TEST SUMMARY
================================================================================
Test Duration: 847 seconds
Overall Status: GREEN

Pipeline Results
- Props Ingested: 125
- Props Scored: 125
- Props Promoted: 23
- Alerts Sent: 23

Discord Channels
- #approved-picks

Error Summary
- Total Errors: 0
- Fallback Events: 1

Stage Results
- Environment Setup: ✅ (1234ms, 1 records)
- Prerequisites Validation: ✅ (2345ms, 8 records)
- Temporal Infrastructure: ✅ (3456ms, 1 records)
- MLB Ingestion: ✅ (45678ms, 50 records)
- MLB Filtering: ✅ (1234ms, 45 records)
- MLB Scoring: ✅ (23456ms, 45 records)
- MLB Finalizer: ✅ (1234ms, 8 records)
- MLB Alerts: ✅ (12345ms, 8 records)
```

### Manual Review Instructions
```
📋 MANUAL REVIEW CHECKLIST
==================================================

1. Discord Channels - Check for new messages:
   - #approved-picks: Look for fresh picks and alerts

2. Database Tables - Verify data integrity:
   - raw_props: Check for duplicates and missing data
   - final_picks: Verify S/A tier props are present
   - games: Check game status updates

3. Logs - Review for warnings/errors:
   - Location: ./logs/e2e-test/2024-01-15
   - Files: test-summary.json, test-report.md, test-detailed.md

4. Performance Metrics:
   - Total test duration: 847s
   - Average stage time: 12345ms
   - Success rate: 100%

5. Health Status:
   - Overall: GREEN
   - Errors: 0
   - Fallbacks: 1
```

## 🎉 SUCCESS CRITERIA

A test run is considered successful when:

### ✅ All Core Requirements Met
- **2-minute cycles**: Average <90s, maximum <110s
- **Discord delivery**: Critical alerts <15s, high priority <30s
- **Data accuracy**: >95% correct prop classification
- **System uptime**: >99.9% availability during test
- **Error recovery**: All simulated failures recovered

### ✅ Business Logic Validated
- **USP Detection**: All 7 USP types properly identified
- **Tier Assignment**: Only S/A tier props promoted
- **Fallback Activation**: Automatic provider switching
- **Quota Management**: Proper API usage tracking
- **Alert Delivery**: Timely Discord notifications

### ✅ Performance Targets Achieved
- **Cycle Performance**: 90% of cycles under target time
- **API Performance**: 95% of calls under 2 seconds
- **Database Performance**: 98% of queries under 500ms
- **Memory Usage**: Stable, no memory leaks
- **CPU Usage**: Efficient resource utilization

## 📞 SUPPORT

### Getting Help
1. **Check Logs**: Review detailed logs in `./logs/e2e-test/`
2. **Run Validation**: Use `npm run test:env-validate`
3. **Test Components**: Run individual test components
4. **Review Configuration**: Verify `config/e2e-test.json`

### Reporting Issues
When reporting test failures, include:
- **Test Scenario**: Which test was running
- **Error Logs**: Relevant log excerpts
- **Environment**: OS, Node version, dependencies
- **Configuration**: Sanitized environment variables
- **Timing**: When the issue occurred

---

**The E2E Test System ensures your Unit Talk syndicate system is production-ready with comprehensive validation of all components, performance targets, and business requirements.**