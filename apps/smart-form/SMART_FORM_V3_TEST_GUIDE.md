# Smart Form V3.0.0 Test Guide

## Overview

This guide provides comprehensive testing instructions for the Unit Talk Smart
Form with v3.0.0 unified database tables. The test suite validates complete
workflows from game population through prop selection to form submission.

## 🧪 Test Suite Components

### Test Files Created

1. **`v3-unified-smart-form-workflow.spec.ts`** (14KB)
   - Complete end-to-end Smart Form workflow testing
   - Game population from v3.0.0 unified tables
   - Prop population with proper game linking
   - Full 4-step form submission process
   - Success validation and ticket ID verification

2. **`v3-database-integration.spec.ts`** (13KB)
   - Games API integration with games/teams tables
   - Props API integration with raw_props/players tables
   - Cappers API integration with users table (unified_picks_user_id_fkey)
   - Foreign key relationship validation
   - Column name mapping verification (prop_type vs stat_type)
   - Submit ticket API integration with smart_tickets table

3. **`v3-performance-and-errors.spec.ts`** (16KB)
   - API performance testing with large datasets
   - Error handling for missing data scenarios
   - Network failure resilience testing
   - Form validation edge cases
   - Concurrent user simulation
   - Submission error handling and recovery

4. **`test-setup.ts`** (10KB)
   - Database connection utilities
   - Test data management and cleanup
   - V3.0.0 table structure verification
   - Helper functions for common operations

### Test Runner Scripts

1. **`run-v3-tests.js`** - Comprehensive test execution with reporting
2. **`verify-smart-form-ready.js`** - Pre-test system readiness verification

## 🚀 Getting Started

### Prerequisites

1. **Start the Smart Form development server:**

   ```bash
   cd apps/smart-form
   npm run dev
   ```

2. **Set environment variables:**

   ```bash
   export NEXT_PUBLIC_SUPABASE_URL="your_supabase_url"
   export NEXT_PUBLIC_SUPABASE_ANON_KEY="your_supabase_anon_key"
   ```

3. **Install dependencies (if needed):**
   ```bash
   npm install
   npx playwright install
   ```

### Quick Verification

Run the readiness check to ensure everything is properly configured:

```bash
node verify-smart-form-ready.js
```

Expected output when ready:

```
✅ Smart Form is ready for V3.0.0 testing!

🚀 Run tests with:
   node run-v3-tests.js
   node run-v3-tests.js --critical-only
   node run-v3-tests.js --headed --debug
```

## 🧪 Running Tests

### Full Test Suite

Run all test suites with comprehensive reporting:

```bash
node run-v3-tests.js
```

### Critical Tests Only

Run only the essential workflow and database integration tests:

```bash
node run-v3-tests.js --critical-only
```

### Debug Mode

Run tests with browser visible for debugging:

```bash
node run-v3-tests.js --headed --debug
```

### Individual Test Files

Run specific test suites:

```bash
# Main workflow tests
npx playwright test tests/v3-unified-smart-form-workflow.spec.ts

# Database integration tests
npx playwright test tests/v3-database-integration.spec.ts

# Performance and error tests
npx playwright test tests/v3-performance-and-errors.spec.ts
```

## 🔍 Test Coverage

### Workflow Testing

- **Step 1 (Essentials)**: Capper selection, sport selection, ticket type, game
  date
- **Step 2 (Configuration)**: Unit size validation, confidence level, odds
  format
- **Step 3 (Bet Details)**: Bet type selection, market type selection
- **Step 4 (Game Selection)**: Game loading, prop loading, selection validation

### Database Integration

- **Games API**: Validates games table with teams relationships
- **Props API**: Validates raw_props table with players/teams relationships
- **Cappers API**: Validates users table for unified_picks integration
- **Submit API**: Validates smart_tickets table submission

### V3.0.0 Specific Validations

- **Column Mappings**: `prop_type` (not `stat_type`), `player_name` vs `name`
- **Foreign Keys**: `unified_picks_user_id_fkey` relationship validation
- **Table Structure**: Verifies 45-table unified structure vs old 77-table
  structure

### Error Scenarios

- Missing game data handling
- Network failure resilience
- Form validation edge cases
- Invalid input handling
- Submission error recovery

### Performance Testing

- API response times (<5s for games, <3s for props)
- Large dataset handling
- Concurrent user scenarios
- Scroll performance with large lists

## 📊 Understanding Test Results

### Success Indicators

```
✅ Test completed successfully
🎫 Ticket submitted successfully with ID: bet-1234567890
📊 Found X games loaded from unified tables
🎯 Found Y props loaded from raw_props table
```

### Common Issues and Solutions

#### Server Not Running

```
❌ Server not accessible at http://localhost:3002
```

**Solution**: Start dev server with `npm run dev`

#### Database Connection Issues

```
❌ Database tables not accessible
```

**Solution**: Check Supabase environment variables and database availability

#### Test Data Missing

```
⚠️ No cappers returned - this indicates a potential issue with user data
```

**Solution**: Ensure users table has test data populated

#### API Timeout Issues

```
❌ API response timeout for /api/games
```

**Solution**: Check if feed agents have populated game/prop data

## 🗂️ Test Data Requirements

### Required Tables and Data

1. **users table**: At least 1 user record for capper selection
2. **games table**: At least 1 game record for the test date
3. **teams table**: Team records linked to games
4. **raw_props table**: Props linked to games (optional but recommended)
5. **players table**: Player records for prop associations (optional)

### Test Data Generation

The test suite includes automatic test data generation for missing records, but
real data from feed agents provides more realistic testing.

## 📈 Performance Benchmarks

### Expected Performance Thresholds

- **Games API Load Time**: < 5 seconds
- **Props API Load Time**: < 3 seconds
- **Form Step Navigation**: < 1 second
- **Submission Processing**: < 10 seconds
- **Database Queries**: < 50ms average

### Performance Monitoring

Tests include built-in performance monitoring that logs timing information:

```
📊 Games API Load Time: 1250ms ✅
🎯 Props API Load Time: 800ms ✅
⚡ Total Navigation Time: 3200ms ✅
```

## 🔧 Troubleshooting

### Common Test Failures

1. **Element not found**: Usually indicates UI component changes or timing
   issues
2. **API timeout**: Check if backend services are running and responsive
3. **Database errors**: Verify Supabase connection and table permissions
4. **Form validation failures**: May indicate business rule changes

### Debug Strategies

1. **Use headed mode**: `--headed` flag to see browser interactions
2. **Check browser logs**: Tests capture console messages for debugging
3. **Review screenshots**: Playwright captures screenshots on failures
4. **Check network requests**: Tests log API calls for debugging

### Manual Verification

If automated tests fail, you can manually verify functionality:

1. Navigate to http://localhost:3002/submit-ticket
2. Complete the 4-step form process
3. Verify data loads correctly at each step
4. Confirm successful submission with ticket ID

## 📋 Test Maintenance

### Updating Tests

When updating Smart Form functionality:

1. Update test files to match new UI components
2. Update data-testid attributes if component structure changes
3. Adjust performance thresholds if needed
4. Add new test cases for new features

### Test Data Management

- Tests automatically clean up created test records
- Use test-specific data to avoid conflicts
- Regularly verify test data requirements

## 🎯 Success Criteria

The Smart Form V3.0.0 workflow is considered fully validated when:

✅ All critical workflow tests pass ✅ Database integration tests verify v3.0.0
structure ✅ Performance tests meet established thresholds ✅ Error handling
tests demonstrate resilience ✅ Form submissions successfully create records in
smart_tickets table ✅ Integration with unified_picks table pathway is verified

---

**Last Updated**: January 2025  
**Test Suite Version**: V3.0.0  
**Compatible With**: Unit Talk Smart Form v3.0.0 unified database architecture
