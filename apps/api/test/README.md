# Unit Talk Testing Suite

## Overview

This testing suite provides comprehensive coverage across multiple testing
phases:

- Integration Testing
- End-to-End Testing
- Performance Testing
- Security Testing
- Recovery Testing

## Setup

### Prerequisites

- Node.js 16+
- Discord Test Bot Token
- Supabase Test Environment
- Test Guild (Discord Server)

### Environment Variables

Create a `.env.test` file in the root directory:

```env
# Discord
DISCORD_TEST_TOKEN=your_test_bot_token
TEST_GUILD_ID=your_test_guild_id
TEST_CHANNEL_ID=your_test_channel_id

# Supabase
SUPABASE_URL=your_test_supabase_url
SUPABASE_ANON_KEY=your_test_anon_key

# Test Users
TEST_USERNAME=test_user
TEST_PASSWORD=test_password
TEST_API_KEY=test_api_key
ADMIN_TOKEN=test_admin_token

# API
APP_URL=http://localhost:3000
WS_URL=ws://localhost:3000
```

### Installation

```bash
npm install
```

## Running Tests

### All Tests

```bash
npm test
```

### Specific Test Suites

```bash
# Integration Tests
npm run test:integration

# End-to-End Tests
npm run test:e2e

# Performance Tests
npm run test:performance

# Security Tests
npm run test:security

# Recovery Tests
npm run test:recovery
```

### Test Configuration

Test configurations can be modified in:

- `jest.config.js` - Unit/Integration tests
- `playwright.config.ts` - E2E tests
- `test/performance/config.ts` - Performance tests

## Test Structure

### Integration Tests

- `test/integration/`
  - Database operations
  - Discord integration
  - AI services
  - Notifications
  - Monitoring
  - Third-party integrations

### End-to-End Tests

- `test/e2e/`
  - User onboarding
  - Daily workflows
  - Advanced features

### Performance Tests

- `test/performance/`
  - Load tests
  - Feature-specific load
  - Benchmarks
  - Stress tests
  - Endurance tests

### Security Tests

- `test/security/`
  - Authentication/Authorization
  - Data protection
  - API security
  - Infrastructure security
  - Penetration testing

### Recovery Tests

- `test/recovery/`
  - Bot recovery
  - Database recovery
  - Data corruption
  - State synchronization

## Common Test Scenarios

### User Onboarding

```bash
npm run test:e2e -- --grep "onboarding"
```

Tests the complete user onboarding flow including:

- Discord OAuth
- Role assignment
- Initial setup
- Welcome messages

### Pick Submission

```bash
npm run test:e2e -- --grep "pick submission"
```

Tests the pick submission workflow including:

- Single picks
- Parlays
- Validation
- Notifications

### VIP Features

```bash
npm run test:e2e -- --grep "VIP"
```

Tests VIP-specific features including:

- Premium content access
- Advanced analytics
- Priority support

## Troubleshooting

### Common Issues

1. **Discord Rate Limits**
   - Error: 429 Too Many Requests
   - Solution: Increase delays between Discord API calls in tests

   ```ts
   await new Promise(resolve => setTimeout(resolve, 1000));
   ```

2. **Database Connection Issues**
   - Error: Connection pool exhausted
   - Solution: Check `poolConfig` in test setup

   ```ts
   const supabase = createClient(url, key, {
     db: { poolSize: 20 },
   });
   ```

3. **Test Timeouts**
   - Error: Test timeout exceeded
   - Solution: Adjust timeout in test config
   ```ts
   test.setTimeout(30000);
   ```

### Debug Logging

Enable debug logs by setting:

```env
DEBUG=test:*
```

### Test Data Cleanup

Tests automatically clean up test data, but you can manually clean up using:

```bash
npm run test:cleanup
```

## CI/CD Integration

### GitHub Actions

Tests are automatically run on:

- Pull requests to main
- Push to main
- Daily scheduled runs

Configuration: `.github/workflows/test.yml`

### Test Reports

Test reports are generated in:

- `test-results/` - Test results and logs
- `playwright-report/` - E2E test reports
- `coverage/` - Code coverage reports

## Contributing

### Adding New Tests

1. Create test file in appropriate directory
2. Follow existing test patterns
3. Update test documentation
4. Add to CI/CD pipeline if needed

### Test Guidelines

- Use descriptive test names
- Include setup and cleanup
- Mock external services
- Handle asynchronous operations
- Add appropriate assertions
- Document test data requirements
