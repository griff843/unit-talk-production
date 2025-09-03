# 📋 Scripts Reference Guide

This document provides a comprehensive overview of all scripts in the Unit Talk
platform.

## 🚀 Production & Deployment Scripts

### Core Deployment

- **`deploy.sh`** - Main deployment script for production
- **`deploy-production.sh`** - Production-specific deployment with safety checks
- **`deploy-staging.sh`** - Staging environment deployment
- **`productionDeploymentMaster.ts`** - Master deployment orchestrator with
  rollback capabilities

### Infrastructure Setup

- **`setupInfrastructure.ts`** - Complete infrastructure setup and configuration
- **`production-redis-setup.ts`** - Production Redis cluster configuration
- **`init-temporal-db.sql`** - Initialize Temporal database schema
- **`database_optimization.sql`** - Production database optimizations

## 🔍 Monitoring & Health Scripts

### Health Monitoring

- **`healthCheck.js`** - System-wide health check runner
- **`healthMonitor.ts`** - Continuous health monitoring service
- **`showMetrics.js`** - Display current system metrics
- **`productionDashboard.ts`** - Launch production monitoring dashboard

### Performance Analysis

- **`memoryProfiler.ts`** - Memory usage analysis and leak detection
- **`loadTesting.ts`** - Performance load testing suite
- **`connectionPoolOptimizer.ts`** - Database connection pool optimization
- **`databaseOptimizer.ts`** - Database performance optimization

## 🧪 Testing & Validation Scripts

### Agent Testing

- **`run-agent-tests.ts`** - Comprehensive agent testing suite
- **`testCoreAgents.ts`** - Core business agent validation
- **`testAgentIntegrations.ts`** - Agent integration testing
- **`testAIOrchestrator.ts`** - AI orchestration testing
- **`simple-agent-test.js`** - Quick agent functionality test

### System Testing

- **`comprehensiveTestRunner.ts`** - Full system test suite
- **`testAlertSystem.ts`** - Alert system validation
- **`testErrorBoundaries.ts`** - Error handling verification
- **`validateEnvironment.ts`** - Environment configuration validation
- **`validateRedis.ts`** - Redis connection and functionality validation
- **`validateSchema.ts`** - Database schema validation

## 🔧 Utilities & Maintenance Scripts

### Data Management

- **`run-ingestion.ts`** - Manual data ingestion runner
- **`run-direct-ingestion.ts`** - Direct ingestion bypass
- **`run-grading-backtest.ts`** - Historical grading validation
- **`run-games-migration.ts`** - Game data migration utility

### System Maintenance

- **`auditAgents.ts`** - Agent health and performance audit
- **`cleanup-migration-issues.ts`** - Clean up migration artifacts
- **`fixTypeSystem.ts`** - TypeScript system repairs
- **`repairTypeSystem.ts`** - Advanced TypeScript issue resolution
- **`update-logger-usage.ts`** - Update logging implementations

### Migration Scripts

- **`migrate-agents-v2.ts`** - Agent system v2 migration
- **`migrate-test-files.ts`** - Test file structure migration
- **`migrate-to-base-agent.ts`** - Convert agents to BaseAgent pattern

## 🚨 Security & Audit Scripts

### Security

- **`securityAudit.ts`** - Comprehensive security assessment
- **`track2_InfrastructureSecurity.ts`** - Infrastructure security audit
- **`check-all-services.js`** - Service security validation

### Performance Tracking

- **`track3_PerformanceOptimization.ts`** - Performance optimization tracking
- **`deploymentStatus.ts`** - Deployment status monitoring
- **`updatedStatus.ts`** - System status updates

## 🗂️ Legacy Scripts (For Reference Only)

Located in `scripts/legacy/`:

- **`feedAgentTestHarness.ts`** - Legacy feed agent testing
- **`recapAgentTestHarness.ts`** - Legacy recap agent testing
- **`sgoTestHarness.ts`** - Legacy SGO testing
- **`unifiedTestHarness.ts`** - Legacy unified testing framework

## 🛠️ Utility Scripts

### Service Management

- **`start-redis.sh`** - Start Redis service
- **`backup.sh`** - Database backup utility
- **`update.sh`** - System update script

### Development Tools

- **`fix-build-errors.js`** - Automated build error resolution
- **`cachingStrategy.ts`** - Caching strategy optimization

## 📋 Usage Guidelines

### Before Production Deployment

1. Run `validateEnvironment.ts` to verify configuration
2. Execute `healthCheck.js` to ensure system health
3. Run `comprehensiveTestRunner.ts` for full validation
4. Deploy using `productionDeploymentMaster.ts`

### For Development

1. Use `simple-agent-test.js` for quick agent validation
2. Run `run-agent-tests.ts` for comprehensive testing
3. Use `memoryProfiler.ts` to check for leaks
4. Monitor with `healthMonitor.ts`

### For Troubleshooting

1. Check `showMetrics.js` for current status
2. Run `auditAgents.ts` for agent diagnostics
3. Use `validateRedis.ts` and `validateSchema.ts` for connection issues
4. Execute `securityAudit.ts` for security concerns

## 🔄 Script Dependencies

Most scripts require:

- Node.js 18+
- Valid `.env` configuration
- Active database connection
- Redis availability (for applicable scripts)
- Temporal service (for workflow-related scripts)

## 🚀 Quick Commands

```bash
# Health check
npm run scripts:health

# Full test suite
npm run scripts:test-all

# Production deployment
npm run scripts:deploy-prod

# Agent validation
npm run scripts:validate-agents

# Performance analysis
npm run scripts:performance
```

## 📞 Support

For script-related issues or questions about usage, refer to the main project
documentation or contact the development team.
