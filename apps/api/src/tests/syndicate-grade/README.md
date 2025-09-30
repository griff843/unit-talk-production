# Syndicate-Grade Test Suite

A comprehensive testing framework for the Unit Talk platform that validates system performance, reliability, and resilience under enterprise-level loads. This test suite ensures the platform meets the stringent requirements of professional betting syndicates.

## 🎯 Overview

The Syndicate-Grade Test Suite validates:

- **High-Volume Processing**: 8,000+ props processed in <30 seconds
- **Real-Time Performance**: <1 second alert latency under full load
- **Feature Retrieval**: <50ms at 95th percentile
- **Professional Features**: All 8 advanced grading features operational
- **System Resilience**: Fault tolerance and graceful degradation
- **Data Integrity**: Zero tolerance for corruption or loss
- **Complete Integration**: End-to-end data flow validation

## 📁 Test Suite Structure

```
syndicate-grade/
├── performance/
│   └── high-volume-processing.test.ts    # 8K+ props performance validation
├── integration/
│   └── data-flow-validation.test.ts      # End-to-end integration tests
├── chaos/
│   └── fault-tolerance.test.ts           # Chaos engineering tests
├── utils/
│   ├── test-data-generator.ts            # Realistic test data generation
│   ├── chaos-inducer.ts                  # Controlled chaos injection
│   ├── fault-injector.ts                 # Advanced fault injection
│   ├── performance-monitor.ts            # Performance monitoring
│   ├── data-flow-tracker.ts              # Data flow tracking
│   ├── health-checker.ts                 # System health validation
│   └── e2e-validator.ts                  # End-to-end validation
├── run-syndicate-tests.ts                # Comprehensive test runner
└── README.md                             # This documentation
```

## 🚀 Quick Start

### Prerequisites

1. **Docker Environment**: Must be running with all services healthy
   ```bash
   ./dev.sh start
   ./dev.sh status  # Verify all services are running
   ```

2. **System Requirements**:
   - 8GB+ RAM (16GB recommended for full suite)
   - 10GB+ free disk space
   - Multi-core CPU (4+ cores recommended)

3. **Environment Setup**:
   ```bash
   # Ensure database migrations are applied
   docker-compose exec api npm run db:migrate
   
   # Verify TypeScript compilation
   docker-compose exec api npm run type-check
   
   # Confirm all health endpoints
   curl http://localhost:3000/health
   curl http://localhost:3004/api/health
   ```

### Running Tests

#### Full Syndicate-Grade Test Suite
```bash
# Run complete test suite (recommended for production validation)
docker-compose exec api npm run test:syndicate-grade

# Run with verbose output
docker-compose exec api npm run test:syndicate-grade -- --verbose
```

#### Individual Test Categories
```bash
# Performance tests only (8K+ props processing)
docker-compose exec api npm run test:syndicate-grade -- --performance

# Integration tests only (end-to-end data flow)
docker-compose exec api npm run test:syndicate-grade -- --integration

# Chaos engineering tests only (fault tolerance)
docker-compose exec api npm run test:syndicate-grade -- --chaos

# Quick validation suite (faster, essential tests only)
docker-compose exec api npm run test:syndicate-grade -- --quick
```

#### Advanced Options
```bash
# Parallel execution (faster, requires more resources)
docker-compose exec api npm run test:syndicate-grade -- --parallel

# Custom timeout (default: 10 minutes)
docker-compose exec api npm run test:syndicate-grade -- --timeout=1800000

# Custom output directory
docker-compose exec api npm run test:syndicate-grade -- --output=./custom-results

# Skip report generation
docker-compose exec api npm run test:syndicate-grade -- --no-report
```

## 📊 Performance Thresholds

### Enterprise-Grade Requirements

| Metric | Threshold | Validation |
|--------|-----------|------------|
| **Volume Processing** | 8,000+ props in <30s | 267+ props/second |
| **Alert Latency** | <1 second under load | Real-time monitoring |
| **Feature Retrieval** | <50ms at 95th percentile | High-frequency testing |
| **Agent Coordination** | <100ms overhead | Multi-agent operations |
| **Memory Growth** | <500MB during test | Resource monitoring |
| **Error Rate** | <1% under peak load | Comprehensive validation |
| **Data Consistency** | >99.9% across systems | Zero tolerance policy |
| **Recovery Time** | <30 seconds | Fault tolerance testing |

### Professional Features Validation

All 8 professional grading features must be operational:

1. **Steam Detection** - Real-time sharp money identification
2. **CLV Tracking** - Closing line value analysis
3. **Timing Analysis** - Optimal bet timing calculation
4. **Volume Analysis** - Market volume pattern recognition
5. **Movement Tracking** - Line movement correlation
6. **Bookmaker Analysis** - Book-specific pattern analysis
7. **Market Efficiency** - Price discovery efficiency scoring
8. **Advanced Metrics** - Composite scoring algorithms

## 🧪 Test Categories

### 1. High-Volume Performance Tests

**Location**: `performance/high-volume-processing.test.ts`

**Validates**:
- Processing 8,000+ props within 30 seconds
- Concurrent batch processing with optimized throughput
- Alert latency <1 second under extreme load
- Feature store performance <50ms at 95th percentile
- Memory management under sustained load
- Database connection pooling efficiency
- Event loop responsiveness under stress

**Key Test Scenarios**:
- Enterprise volume processing with realistic data distribution
- Real-time alert generation under peak load conditions
- Feature retrieval performance with high-frequency access
- Resource management with memory pressure simulation
- Database performance with concurrent connection stress

### 2. Integration Data Flow Tests

**Location**: `integration/data-flow-validation.test.ts`

**Validates**:
- Smart Form → Bridge → BridgeWorker → Temporal workflows
- Real-time market data → Processing → Features → Alerts
- Professional grading execution across all 8 features
- Data consistency across distributed components
- Error recovery and fault isolation mechanisms

**Key Test Scenarios**:
- Complete pick submission to Discord notification flow
- Concurrent Smart Form submissions without corruption
- Real-time market data processing with sub-second latency
- Professional grading feature execution and accuracy
- System monitoring and observability validation

### 3. Chaos Engineering Tests

**Location**: `chaos/fault-tolerance.test.ts`

**Validates**:
- Network partition and connectivity failure resilience
- Database connection failure recovery mechanisms
- Memory pressure and resource exhaustion handling
- CPU starvation tolerance and event loop protection
- Circuit breaker functionality and fallback systems
- Graceful degradation under partial system failures

**Key Test Scenarios**:
- Network partition simulation with service availability
- Database failure injection with automatic recovery
- Resource exhaustion with system stability maintenance
- Progressive failure cascades with isolation effectiveness
- Recovery time validation and system restoration

## 🛠 Utility Components

### Test Data Generator

**Purpose**: Generates realistic test data for comprehensive validation

**Features**:
- Realistic market data distributions
- Temporal patterns matching real betting markets
- Edge cases and boundary conditions
- Reproducible data for consistent testing
- Professional-grade complexity scenarios

### Chaos Inducer

**Purpose**: Implements controlled chaos engineering principles

**Features**:
- Configurable fault intensity levels
- Safety limits and circuit breakers
- Network, database, and resource fault injection
- Automatic rollback mechanisms
- Comprehensive monitoring and observability

### Performance Monitor

**Purpose**: Real-time performance metrics collection and analysis

**Features**:
- CPU, memory, and event loop monitoring
- Garbage collection analysis
- Network and database performance tracking
- Threshold violation detection
- Performance baseline establishment

### Fault Injector

**Purpose**: Advanced fault injection for resilience testing

**Features**:
- Network latency and partition injection
- Database timeout and corruption simulation
- Memory pressure and leak simulation
- Process hang and crash scenarios
- Service failure and rate limiting

## 📈 Test Reports

### Report Generation

Tests automatically generate comprehensive reports:

- **JSON Report**: Machine-readable results and metrics
- **HTML Report**: Human-readable dashboard with visualizations
- **Performance Metrics**: Detailed performance analysis
- **Error Analysis**: Failure categorization and root cause analysis
- **Recommendations**: Actionable insights for optimization

### Report Location

```
test-results/
├── syndicate-test-report.json    # Detailed JSON results
├── syndicate-test-report.html    # Interactive HTML dashboard
├── performance-metrics.json      # Performance data
└── error-analysis.log            # Error details and stack traces
```

### Key Report Sections

1. **Executive Summary**: Pass/fail status and key metrics
2. **Performance Analysis**: Throughput, latency, and resource usage
3. **System Health**: Component status and availability
4. **Error Analysis**: Failure modes and impact assessment
5. **Recommendations**: Optimization and improvement suggestions

## 🔧 Configuration

### Environment Variables

```bash
# Required for test execution
SUPABASE_URL=<your-supabase-url>
SUPABASE_ANON_KEY=<your-supabase-key>
DATABASE_URL=<your-database-url>

# Optional test configuration
TEST_TIMEOUT=600000                # Test timeout in milliseconds
TEST_PARALLEL=false                # Enable parallel execution
TEST_VERBOSE=false                 # Verbose output
TEST_OUTPUT_DIR=./test-results     # Output directory
```

### Custom Thresholds

You can customize performance thresholds by modifying the test configuration:

```typescript
const CUSTOM_THRESHOLDS = {
  PROPS_COUNT: 10000,              // Increase volume target
  TOTAL_PROCESSING_TIME: 25000,    // Stricter time requirement
  ALERT_LATENCY: 800,              // Stricter alert latency
  FEATURE_RETRIEVAL_P95: 40,       // Stricter feature retrieval
  MAX_MEMORY_GROWTH: 400 * 1024 * 1024, // Lower memory limit
  MIN_SUCCESS_RATE: 0.995          // Higher success rate requirement
};
```

## 🚨 Troubleshooting

### Common Issues

#### 1. Tests Timing Out
```bash
# Increase timeout for resource-constrained environments
docker-compose exec api npm run test:syndicate-grade -- --timeout=1800000
```

#### 2. Memory Issues
```bash
# Check system memory and Docker allocation
docker stats
free -h

# Reduce test volume for low-memory systems
# Edit test files to reduce PROPS_COUNT
```

#### 3. Service Health Issues
```bash
# Verify all services are healthy
./dev.sh status
curl http://localhost:3000/health

# Restart services if needed
./dev.sh restart
```

#### 4. Database Connectivity
```bash
# Check database status and apply migrations
docker-compose exec api npm run db:status
docker-compose exec api npm run db:migrate
```

### Performance Optimization

#### For Resource-Constrained Environments

1. **Reduce Test Volume**:
   - Edit `PROPS_COUNT` in test files
   - Use `--quick` flag for essential tests only

2. **Increase Timeouts**:
   - Use `--timeout` flag with higher values
   - Disable parallel execution

3. **Monitor Resources**:
   - Use `docker stats` to monitor container resources
   - Close unnecessary applications

#### For High-Performance Validation

1. **Enable Parallel Execution**:
   ```bash
   docker-compose exec api npm run test:syndicate-grade -- --parallel
   ```

2. **Increase Test Volume**:
   - Modify `PROPS_COUNT` for higher loads
   - Add stress testing scenarios

3. **Enhanced Monitoring**:
   - Enable verbose output with `--verbose`
   - Monitor system metrics during execution

## 📚 Best Practices

### Before Running Tests

1. **System Preparation**:
   - Ensure adequate system resources
   - Close unnecessary applications
   - Verify Docker environment health

2. **Environment Validation**:
   - Check all services are running
   - Verify database connectivity
   - Confirm health endpoints respond

3. **Data Cleanup**:
   - Clear any existing test data
   - Reset agent states
   - Verify clean starting state

### During Test Execution

1. **Monitoring**:
   - Watch system resource usage
   - Monitor test progress logs
   - Check for early warning signs

2. **Intervention**:
   - Stop tests if system becomes unresponsive
   - Save logs for later analysis
   - Document any issues encountered

### After Test Completion

1. **Report Analysis**:
   - Review all test results thoroughly
   - Analyze performance metrics
   - Identify optimization opportunities

2. **Issue Resolution**:
   - Address any test failures before production
   - Optimize performance bottlenecks
   - Improve error handling as needed

3. **Documentation**:
   - Update test thresholds if needed
   - Document any environment-specific findings
   - Share results with development team

## 🎯 Success Criteria

### Production Readiness Gate

The platform is considered production-ready when:

✅ **All test suites pass**: 100% success rate across all categories
✅ **Performance thresholds met**: All metrics within enterprise limits
✅ **Zero data corruption**: Perfect data integrity throughout testing
✅ **Professional features operational**: All 8 features validated
✅ **Fault tolerance confirmed**: Graceful degradation under stress
✅ **Recovery mechanisms verified**: Automatic restoration capabilities

### Continuous Integration

These tests should be run:

- **Before major releases**: Full suite execution required
- **Weekly validation**: Automated execution with trend analysis
- **Performance regression**: Baseline comparison and alerting
- **Post-deployment**: Production environment validation

## 📞 Support

For issues with the test suite:

1. **Check Documentation**: Review this README and test comments
2. **Verify Environment**: Ensure all prerequisites are met
3. **Review Logs**: Check test output and error messages
4. **System Resources**: Verify adequate CPU, memory, and disk
5. **Contact Team**: Reach out with specific error details

---

**Note**: This test suite represents enterprise-grade validation standards. All tests must pass before production deployment to ensure the platform meets professional syndicate requirements.