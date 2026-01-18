# E2E Test Suite - Real-World Production Validation

## Overview

This directory contains the comprehensive E2E test suite for validating the Unit Talk platform's complete betting intelligence pipeline. The tests cover three critical Golden Path flows from Smart Form submission through Discord publishing.

**Status**: ✅ **Production Ready**
**Version**: 1.0.0
**Last Updated**: December 2025

---

## Quick Start

### Installation

1. **Install Playwright**:
   ```bash
   npx playwright install
   ```

2. **Configure Environment**:
   ```bash
   cd tests/e2e
   cp .env.example .env.local
   # Edit .env.local with your staging credentials
   ```

3. **Run Tests**:
   ```bash
   # Run all flows (staging)
   npm run test:e2e:staging

   # Run individual flows
   npm run test:e2e:flow1
   npm run test:e2e:flow2
   npm run test:e2e:flow3
   ```

---

## Test Flows

### Flow 1: Smart Form → TicketLifecycleWorkflow → Discord

**File**: `flow1-smart-form-to-discord.e2e.spec.ts`

**Validates**:
- ✅ Smart Form submission UI
- ✅ Database writes (smart_tickets, picks)
- ✅ Bridge outbox event creation
- ✅ TicketLifecycleWorkflow execution
- ✅ Pick publish record creation
- ✅ Discord publishing (staging mode)

**Duration**: ~2-3 minutes

**Command**:
```bash
npm run test:e2e:flow1
```

---

### Flow 2: Command Center Dashboard

**File**: `flow2-command-center-dashboard.e2e.spec.ts`

**Validates**:
- ✅ Dashboard UI loading
- ✅ MNF/NBA prop filtering
- ✅ Canonical name mapping
- ✅ Real-time pick feed
- ✅ Workflow controls
- ✅ No UI errors

**Duration**: ~1-2 minutes

**Command**:
```bash
npm run test:e2e:flow2
```

---

### Flow 3: Daily Recap Workflow

**File**: `flow3-daily-recap-workflow.e2e.spec.ts`

**Validates**:
- ✅ DailyRecapWorkflow execution
- ✅ Recap data completeness
- ✅ CLV bucket calculations
- ✅ Professional metrics
- ✅ API endpoint correctness
- ✅ UI recap display

**Duration**: ~2-3 minutes

**Command**:
```bash
npm run test:e2e:flow3
```

---

## Available Commands

### Core Commands

```bash
# Run all flows (staging)
npm run test:e2e:staging

# Run all flows with all browsers
npm run test:e2e:staging:all

# Run production read-only tests
npm run test:e2e:production

# Run individual flows
npm run test:e2e:flow1
npm run test:e2e:flow2
npm run test:e2e:flow3
```

### Debug Commands

```bash
# Run with browser visible
npm run test:e2e:headed

# Run in debug mode (step through)
npm run test:e2e:debug

# View test report
npm run test:e2e:report
```

---

## Test Utilities

### DatabaseHelper

Database operations for test validation:

```typescript
const dbHelper = new DatabaseHelper(supabaseUrl, supabaseKey);

// Get active capper
const capper = await dbHelper.getActiveCapper();

// Verify records
await dbHelper.verifyTicketCreated(betSlipId);
await dbHelper.verifyPicksCreated(betSlipId);
await dbHelper.verifyPickPublishCreated(betSlipId);

// Get events
const event = await dbHelper.getBridgeOutboxEvent(betSlipId);
const recap = await dbHelper.getDailyRecap(recapDate);

// Cleanup
await dbHelper.cleanupTestData(betSlipId);
```

### TemporalHelper

Temporal workflow operations:

```typescript
const temporalHelper = new TemporalHelper(temporalUrl);

// Get workflow status
const status = await temporalHelper.getWorkflowStatus(workflowId);

// Wait for completion
const completed = await temporalHelper.waitForWorkflowCompletion(
  workflowId,
  timeoutMs
);
```

### SmartFormHelper

Smart Form UI interactions:

```typescript
const formHelper = new SmartFormHelper(page);

// Fill and submit form
await formHelper.fillTicketForm(testTicket);
const betSlipId = await formHelper.submitForm();
```

### CommandCenterHelper

Command Center operations:

```typescript
const dashboardHelper = new CommandCenterHelper(page);

// Navigate and filter
await dashboardHelper.navigateToDashboard();
await dashboardHelper.filterByLeague('NFL');
await dashboardHelper.filterByDate(today);

// Verify state
const propsCount = await dashboardHelper.getVisibleProps();
const hasProperNames = await dashboardHelper.verifyCanonicalMapping();
const hasNoErrors = await dashboardHelper.verifyNoErrors();
```

---

## Configuration

### Environment Variables

Create `.env.local` from `.env.example`:

```bash
# Base URLs
E2E_BASE_URL=https://staging.unit-talk.com
E2E_STAGING_URL=https://staging.unit-talk.com
E2E_PRODUCTION_URL=https://app.unit-talk.com

# Database Configuration
E2E_SUPABASE_URL=https://your-project.supabase.co
E2E_SUPABASE_KEY=your-anon-key

# Temporal Configuration
E2E_TEMPORAL_URL=http://localhost:7233

# Test Environment
E2E_ENVIRONMENT=staging

# Shadow Mode (for Discord publishing)
SHADOW_MODE=true
```

### Playwright Configuration

Located in `playwright.config.ts`:

- **Projects**: staging-chrome, staging-firefox, production-read-only
- **Timeout**: 5 minutes per test
- **Retries**: 2 on CI, 0 locally
- **Reporters**: HTML, JSON, JUnit
- **Screenshots**: On failure only
- **Video**: On failure only
- **Traces**: On first retry

---

## CI/CD Integration

### GitHub Actions

E2E tests run automatically on:
- **Push** to main/staging branches
- **Pull Requests** to main/staging
- **Schedule**: Every 6 hours
- **Manual**: Via workflow_dispatch

**Workflow File**: `.github/workflows/e2e-staging.yml`

**Results**:
- Test reports uploaded as artifacts
- PR comments with test summary
- Failure notifications (if configured)

### Running in CI

Tests execute with:
- Chrome and Firefox browsers
- Staging environment
- Shadow mode enabled
- CI-specific timeouts and retries

---

## Troubleshooting

### Common Issues

**Issue**: Test timeout
- **Cause**: Workflow taking longer than expected
- **Solution**: Increase timeout or investigate workflow performance
- **Check**: Temporal UI for workflow details

**Issue**: Database connection failure
- **Cause**: Invalid credentials or network issue
- **Solution**: Verify `.env.local` configuration
- **Check**: Test connection with Supabase dashboard

**Issue**: Workflow not found
- **Cause**: Workflow hasn't been triggered yet
- **Solution**: Manually trigger or wait for scheduled execution
- **API**: `POST /api/workflows/[name]/trigger`

**Issue**: Discord publish failure
- **Cause**: Shadow mode or Discord API issue
- **Solution**: Check `SHADOW_MODE` env var and bot status
- **Verify**: Bot token and channel permissions

### Debug Mode

**Enable detailed logging**:
```bash
DEBUG=* npm run test:e2e:debug
```

**View Playwright trace**:
```bash
npx playwright show-trace tests/e2e/test-results/[test-name]/trace.zip
```

**Inspect database state**:
```bash
psql $DATABASE_URL -c "SELECT * FROM smart_tickets WHERE bet_slip_id = '[id]'"
```

---

## Best Practices

### Writing Tests

1. **Use Test Helpers**: Leverage existing helpers for common operations
2. **Clean Up**: Always clean up test data in `afterAll`
3. **Idempotency**: Tests should be rerunnable without side effects
4. **Assertions**: Use specific assertions with clear error messages
5. **Timeouts**: Set appropriate timeouts for long-running operations
6. **Logging**: Add console.log statements for debugging

### Test Data

1. **Real Cappers**: Use actual staging cappers
2. **Valid Props**: Create realistic prop data
3. **Cleanup**: Remove test data after tests complete
4. **Isolation**: Tests should not depend on each other

### Performance

1. **Parallel**: Run independent tests in parallel where possible
2. **Selective**: Run specific flows during development
3. **Caching**: Use Playwright's network caching when appropriate
4. **Timeouts**: Balance thoroughness with speed

---

## Staging Burn-in

### 4-Week Plan

**Week 1**: Initial validation
- Run each flow daily at specific times
- Target: 95% success rate

**Week 2**: Load testing
- Submit 50 concurrent tickets
- Monitor 100 simulated users
- Generate 30-day recaps

**Week 3**: Integration validation
- Run all flows sequentially
- Monitor NFL Sunday pipeline
- Validate high-volume Discord publishing

**Week 4**: Production readiness
- Run production read-only tests
- Perform canary deployment testing
- Execute failover scenarios

---

## Production Canary

### Read-Only Tests

Run against production without modifying data:

```bash
npm run test:e2e:production
```

**Safety**:
- Read-only database user
- No write operations
- `X-Read-Only: true` header
- Separate environment indicator

### Gradual Rollout

1. **Deploy to 5%**: Run Flow 1 for small user percentage
2. **Validate Metrics**: Check errors, latency, success rates
3. **Deploy to 25%**: Expand to larger base
4. **Full Validation**: Run all flows with increased load
5. **Deploy to 100%**: Complete rollout

**Rollback Criteria**:
- Error rate > 1%
- Workflow time > 3 minutes
- Any data corruption
- Discord failures > 5%

---

## Monitoring

### Metrics

Track during test execution:
- Test success rate (target: > 95%)
- Average test duration
- Workflow completion times
- Database operation times
- API response times

### Alerts

Configure alerts for:
- Test failure (immediate)
- Success rate < 90% (warning)
- Duration > 10 minutes (warning)
- Critical errors (immediate)

---

## Contributing

### Adding New Tests

1. Create test file: `flow[N]-[description].e2e.spec.ts`
2. Add test helper methods if needed
3. Update this README
4. Add npm script to package.json
5. Update CI workflow if appropriate

### Test Template

```typescript
import { test, expect } from '@playwright/test';
import { DatabaseHelper } from './utils/test-helpers';

test.describe('Flow N: Description', () => {
  let dbHelper: DatabaseHelper;

  test.beforeAll(() => {
    // Setup
  });

  test.afterAll(async () => {
    // Cleanup
  });

  test('validates main flow', async ({ page, request }) => {
    // Test implementation
  });
});
```

---

## Resources

- **Documentation**: `docs/modernization/production_validation_plan.md`
- **Playwright Docs**: https://playwright.dev/docs/intro
- **Unit Talk API**: Internal API documentation
- **Supabase Docs**: https://supabase.com/docs

---

## Support

For questions or issues:
- **Platform Engineering Team**: [email/slack]
- **GitHub Issues**: [repository issues]
- **Documentation**: See `production_validation_plan.md`

---

**Last Updated**: December 2025
**Maintained By**: Platform Engineering Team
