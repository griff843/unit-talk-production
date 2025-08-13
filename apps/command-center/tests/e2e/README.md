# Command Center E2E Tests

Comprehensive end-to-end test suite for the Unit Talk Command Center application using Playwright.

## 📋 Test Coverage

This E2E test suite covers all critical Command Center functionality:

### 🔒 Safety Toggles Tests
- **Toggle Display**: All 5 safety toggles are visible and accessible
- **State Persistence**: Toggle states persist across page refreshes  
- **Loading States**: Loading spinners appear during toggle operations
- **Error Handling**: Graceful handling of API failures
- **Real-time Updates**: Toggle changes reflect immediately in UI

**Test Files**: `command-center.spec.ts` (Safety Toggles section)

### 🏥 Health Monitoring Tests
- **Tile Display**: All 6 health monitoring tiles display correctly
- **Real-time Updates**: Health data updates automatically
- **Status Indicators**: Color-coded status indicators (green/yellow/red)
- **Data Formatting**: Proper formatting of time durations and percentages

**Test Files**: `command-center.spec.ts` (Health Monitoring Tiles section)

### 🚨 Incident Management Tests
- **Navigation**: Proper routing to incidents page
- **Incident Display**: List view with filtering capabilities
- **Resolution Workflow**: Complete incident resolution with notes
- **Status Updates**: Real-time incident status changes

**Test Files**: `command-center.spec.ts` (Incident Management section)

### 🔄 Recovery Operations Tests
- **Navigation**: Access to recovery page
- **Workflow Replay**: Single and bulk workflow replay functionality
- **Deployment Rollback**: Rollback operations with confirmations
- **Form Validation**: Proper validation of recovery operation forms

**Test Files**: `command-center.spec.ts` (Recovery Operations section)

### 🔐 RBAC Enforcement Tests
- **Admin Role**: Full access to all features and operations
- **Ops Role**: Access to toggles and incident resolution, blocked from rollbacks
- **Viewer Role**: Read-only access, all modifications blocked
- **Permission Boundaries**: Strict enforcement of role-based permissions
- **Cross-Page Consistency**: RBAC enforcement across all pages

**Test Files**: `rbac-enforcement.spec.ts`

### 🛡️ System Flags Enforcement Tests
- **Safe Mode**: Blocks promotions and publishing operations
- **System Freeze**: Blocks all operations (ingestion, promotions, publishing)
- **Shadow Mode**: Prevents real publishing while allowing other operations
- **Publishing Flags**: Individual control over Discord and Notion publishing
- **Flag Combinations**: Proper precedence and interaction between flags
- **Cache Management**: Flag state caching and invalidation

**Test Files**: `system-flags-enforcement.spec.ts`

### 📊 Data Trust Widgets Tests
- **Immutability Checks**: Display and manual triggering of immutability validation
- **Shadow Diff Analysis**: Real-time comparison of shadow vs live publishing
- **Status Indicators**: Visual representation of data integrity status
- **Manual Operations**: User-initiated trust validation operations

**Test Files**: `command-center.spec.ts` (Data Trust Widgets section)

### 🔗 Alertmanager Integration Tests
- **Webhook Processing**: Receipt and processing of critical alerts
- **Auto-Incident Creation**: Automatic incident creation from alerts
- **Safe Mode Triggering**: Automatic Safe Mode activation on critical alerts
- **Alert Routing**: Proper categorization and handling of different alert types

**Test Files**: `command-center.spec.ts` (Alertmanager Integration section)

### ⚡ Performance & Reliability Tests
- **Load Performance**: Dashboard loads within 3-second performance budget
- **Network Resilience**: Graceful handling of network failures
- **State Management**: Consistent state across navigation and page refreshes
- **Error Boundaries**: Proper error boundary handling and recovery

**Test Files**: `command-center.spec.ts` (Performance and Reliability section)

## 🏗️ Test Architecture

### Test Structure
```
tests/e2e/
├── command-center.spec.ts          # Main Command Center functionality
├── rbac-enforcement.spec.ts        # Role-based access control tests
├── system-flags-enforcement.spec.ts # System flags behavior tests
├── test-helpers.ts                 # Shared utilities and helpers
├── global-setup.ts                 # Global test setup
├── global-teardown.ts              # Global test cleanup
└── README.md                       # This documentation
```

### Test Helpers
- **Authentication**: `authenticateAs()` - Mock different user roles
- **API Mocking**: `mockSystemConfigAPI()`, `mockRBACAPI()`, `mockHealthMonitoringAPI()`
- **System Flags**: `mockSystemFlagsEnforcement()` - Test flag enforcement
- **UI Interactions**: `waitForToast()`, `clickToggleAndWait()`, `assertToggleState()`
- **Navigation**: `navigateToCommandCenter()`, `navigateToSubPage()`

### Mock Data
- **Test Users**: Admin, Ops, and Viewer roles with proper permissions
- **System Configuration**: Default and custom flag states
- **Health Monitoring**: Realistic health metrics and status indicators
- **Incidents**: Sample incidents with various severities and statuses

## 🚀 Running Tests

### Prerequisites
```bash
# Install Playwright browsers
npm run test:e2e:install
```

### Test Execution
```bash
# Run all E2E tests
npm run test:e2e

# Run with UI (interactive mode)
npm run test:e2e:ui

# Run in headed mode (visible browser)
npm run test:e2e:headed

# Debug mode with step-through
npm run test:e2e:debug

# View test report
npm run test:e2e:report
```

### Environment Variables
```bash
# Application URL (defaults to http://localhost:3015)
NEXT_PUBLIC_APP_URL=http://localhost:3015

# Test environment
NODE_ENV=test
```

## 📊 Test Configuration

### Browser Support
- **Desktop**: Chrome, Firefox, Safari, Edge
- **Mobile**: Mobile Chrome, Mobile Safari
- **Coverage**: Cross-browser compatibility testing

### Test Settings
- **Timeout**: 60 seconds per test
- **Retries**: 2 retries on CI, 0 on local
- **Parallel Execution**: Full parallelization enabled
- **Screenshots**: Captured on failure
- **Videos**: Recorded on failure
- **Traces**: Collected on retry

### Performance Budgets
- **Page Load**: <3 seconds
- **API Response**: <200ms
- **Toggle Operations**: <500ms
- **Navigation**: <1 second

## 🔧 Test Data & Mocking

### Authentication Mocking
```typescript
// Mock admin user
await authenticateAs(page, 'admin');

// Mock ops user with limited permissions
await authenticateAs(page, 'ops');

// Mock viewer with read-only access
await authenticateAs(page, 'viewer');
```

### System Configuration Mocking
```typescript
// Mock system flags
await mockSystemConfigAPI(page, {
  SAFE_MODE: true,
  SYSTEM_FREEZE: false,
  SHADOW_MODE: false,
  PUBLISH_TO_DISCORD: true,
  PUBLISH_TO_NOTION: true
});
```

### API Response Mocking
All external API calls are mocked to ensure:
- **Deterministic Tests**: Consistent results across runs
- **Offline Testing**: Tests run without external dependencies
- **Error Scenarios**: Testing of error conditions and edge cases
- **Performance**: Fast test execution without network delays

## 📈 Test Reporting

### Artifacts Generated
- **HTML Report**: Interactive test results with filtering
- **JSON Report**: Machine-readable results for CI integration
- **JUnit XML**: Compatible with CI/CD platforms
- **Screenshots**: Visual evidence of failures
- **Videos**: Recording of test execution for debugging
- **Traces**: Detailed execution traces for analysis

### CI/CD Integration
Tests are configured for seamless CI/CD integration with:
- **GitHub Actions**: Automated test execution on PRs
- **Parallel Execution**: Optimized for CI performance
- **Artifact Collection**: Screenshots and reports preserved
- **Failure Analysis**: Detailed failure reporting and traces

## 🐛 Debugging Tests

### Local Debugging
```bash
# Run specific test file
npx playwright test command-center.spec.ts

# Run specific test
npx playwright test -g "should toggle Safe Mode"

# Debug mode with browser dev tools
npx playwright test --debug

# Headed mode to see browser
npx playwright test --headed
```

### Common Issues
1. **Timing Issues**: Use `waitForLoadState()` and proper selectors
2. **Element Not Found**: Verify test IDs and selector specificity
3. **API Mocking**: Ensure proper route interception setup
4. **Authentication**: Verify user role mocking is applied correctly

### Test Development Tips
- **Use Test IDs**: Always use `data-testid` attributes for reliable element selection
- **Wait for State**: Use `waitForLoadState('networkidle')` after navigation
- **Mock Early**: Set up API mocks before page navigation
- **Isolated Tests**: Ensure tests don't depend on each other's state

## 🔄 Continuous Improvement

### Test Maintenance
- **Regular Updates**: Keep tests synchronized with feature changes
- **Performance Monitoring**: Track test execution times and optimize
- **Coverage Analysis**: Ensure comprehensive coverage of new features
- **Flake Detection**: Monitor and fix flaky tests promptly

### Adding New Tests
1. **Identify Test Scenarios**: Map out user journeys and edge cases
2. **Create Test Data**: Add necessary mocks and test helpers
3. **Write Test Cases**: Follow existing patterns and conventions
4. **Verify Coverage**: Ensure all critical paths are tested
5. **Documentation**: Update this README with new test coverage

This comprehensive E2E test suite ensures the Command Center operates reliably and securely across all user roles and system configurations.