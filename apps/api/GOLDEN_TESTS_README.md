# Golden Tests for Professional Grading System

## Overview

Golden tests are **critical validation tests** that lock the behavior of the professional grading pipeline. These tests ensure that core mathematical calculations, business logic, and professional betting standards remain consistent across all code changes.

**🚨 CRITICAL RULE: These tests MUST pass 100% before any production deployment.**

## Test Suites

### 1. Devigging Golden Tests (`devigging.golden.test.ts`)

**Purpose**: Lock devigging calculations that remove hidden vig from odds.

**Key Validations**:
- Standard -110/-110 market removes exactly 4.55% vig
- Favorite -150 vs Dog +130 produces 59.09% true probability
- Asymmetric markets handle vig correctly
- Player props maintain proper devigging ratios
- Extreme odds combinations are validated

**Critical Calculations**:
```typescript
// LOCKED VALUES - never modify without professional review
expect(result.totalVig).toBeCloseTo(0.0455, 4); // 4.55% total vig
expect(result.trueProb).toBeCloseTo(0.5909, 3); // 59.09% true prob
expect(result.fairOdds).toBeCloseTo(-144, 0);   // Fair odds
```

### 2. CLV Tracking Golden Tests (`clv-tracking.golden.test.ts`)

**Purpose**: Lock CLV (Closing Line Value) tracking and calculations.

**Key Validations**:
- Positive CLV from -110 to -120 shows exactly 8.33% value
- CLV categories (ELITE, EXCELLENT, GOOD, POOR) have correct thresholds
- Multi-book tracking identifies best available CLV
- Time-based trajectory analysis captures line movements
- Edge calculations match Kelly criterion inputs

**Critical Calculations**:
```typescript
// LOCKED VALUES - CLV calculation precision
expect(clvResult.clvPercentage).toBeCloseTo(8.33, 2);     // 8.33% positive CLV
expect(clvResult.clvCategory).toBe('EXCELLENT');          // >5% is excellent
expect(clvResult.expectedProfitMargin).toBeCloseTo(0.0833, 4); // 8.33% edge
```

### 3. Enhanced Scoring Golden Tests (`enhanced-scoring.golden.test.ts`)

**Purpose**: Lock the 53-point professional scoring system across all sports.

**Key Validations**:
- Elite NBA props score 85+ with proper feature contributions
- Sport-specific weights are applied correctly (NBA pace, NFL weather, MLB handedness, NHL goalie)
- Feature contributions sum exactly to final score
- Tier thresholds are enforced at exact boundaries
- Model ensemble contributes proper 10% of total score

**Critical Calculations**:
```typescript
// LOCKED VALUES - scoring thresholds and contributions
expect(result.finalScore).toBeGreaterThanOrEqual(85);     // Elite threshold
expect(result.tier).toBe('S_TIER');                       // Should achieve S-tier
expect(contributions.expectedValue).toBeGreaterThan(3.0); // EV contribution
```

### 4. Tier Assignment Golden Tests (`tier-assignment.golden.test.ts`)

**Purpose**: Lock tier thresholds and Kelly sizing calculations.

**Key Validations**:
- S-Tier requires 71+ score (NBA), 72+ (NFL), 70+ (NHL) with 21%+ edge
- Kelly sizing matches professional bankroll management standards
- Risk adjustments reduce position sizes correctly
- Portfolio heat management enforces 15% daily risk limit
- Confidence requirements gate tier upgrades

**Critical Calculations**:
```typescript
// LOCKED VALUES - tier requirements and Kelly sizing
expect(result.tier).toBe('S_TIER');                       // Tier assignment
expect(result.positionSize).toBeGreaterThanOrEqual(0.045); // Min 4.5%
expect(result.expectedROI).toBeGreaterThan(0.20);          // >20% expected ROI
```

### 5. Debug Logging Golden Tests (`debug-logging.golden.test.ts`)

**Purpose**: Lock debug log format and content validation.

**Key Validations**:
- JSON log format matches exact schema specification
- PII redaction works consistently (e.g., "lebron-james-points" → "leb***nts")
- Log size stays under 4KB limit with truncation
- Feature contributions are sorted by impact
- Processing time is captured accurately

**Critical Format**:
```typescript
// LOCKED SCHEMA - exact field structure
expect(logEntry).toMatchObject({
  trace_id: expect.stringMatching(/^[a-f0-9]{8}$/),
  prop_id: 'pro***23',  // PII redacted
  league: 'NBA',
  composite: 85.2,
  tier: 'S_TIER',
  kelly_fraction: 0.145
});
```

### 6. Integration Golden Tests (`integration.golden.test.ts`)

**Purpose**: Lock end-to-end professional pipeline behavior.

**Key Validations**:
- Complete professional pipeline executes in <3 seconds
- All professional rules are enforced (devigging, CLV, scoring, Kelly)
- Feature flag controls route to professional vs legacy path
- Sport-specific processing emphasizes correct factors
- Error handling gracefully degrades without crashing
- Quality thresholds maintain minimum standards

**Critical Integration**:
```typescript
// LOCKED END-TO-END VALIDATION
expect(result.processingMetadata.pathUsed).toBe('PROFESSIONAL');
expect(result.deviggingResult.deviggedEdge).toBeDefined();    // Rule #1
expect(result.clvResult.trackingId).toBeDefined();           // Rule #2
expect(result.featureContributions).toBeDefined();          // Rule #3
expect(result.kellyFraction).toBeGreaterThan(0);             // Rule #4
```

## Running Golden Tests

### Individual Test Suites
```bash
# Run specific golden test suites
npm run test:golden-devigging     # Devigging calculations
npm run test:golden-clv          # CLV tracking
npm run test:golden-scoring      # Enhanced scoring
npm run test:golden-tiers        # Tier assignment
npm run test:golden-logging      # Debug logging
npm run test:golden-integration  # End-to-end integration
```

### Complete Golden Test Suite
```bash
# Run all golden tests with comprehensive reporting
npm run test:golden

# Watch mode for development
npm run test:golden-watch
```

### CI/CD Integration
```bash
# Production deployment gate - must pass 100%
npm run test:golden || exit 1  # Blocks deployment on any failures
```

## Golden Test Output

### Success Output
```
🎉 ALL GOLDEN TESTS PASSED!
============================
✅ Professional grading behavior is locked and validated
✅ System is ready for production deployment
✅ All critical calculations verified
```

### Failure Output
```
🚨 GOLDEN TEST FAILURES DETECTED
==================================
❌ CRITICAL: Professional grading behavior has regressed
❌ Production deployment is BLOCKED until all tests pass
❌ Review locked values and restore expected behavior
```

## Modifying Golden Tests

### ⚠️ CRITICAL WARNING ⚠️

**NEVER modify expected values in golden tests without:**

1. **Full Professional Review**: Get explicit approval from platform engineering team
2. **Mathematical Verification**: Prove calculations are correct using independent sources
3. **Business Justification**: Document why the change improves professional betting outcomes
4. **Regression Testing**: Verify the change doesn't break existing functionality
5. **Documentation Update**: Update this README with the change rationale

### Safe Modifications

**✅ ALLOWED:**
- Adding new test cases for edge cases
- Improving test descriptions and comments
- Adding validation for new features
- Expanding error handling tests
- Performance optimizations that don't change behavior

**❌ NEVER ALLOWED:**
- Changing locked numerical values without approval
- Relaxing precision requirements (e.g., `toBeCloseTo(0.0455, 4)` → `toBeCloseTo(0.0455, 2)`)
- Removing validation checks
- Weakening business rule enforcement
- Bypassing professional compliance requirements

## Integration with Professional System

The golden tests validate the complete professional grading pipeline:

```
Raw Prop Input
     ↓
Feature Flag Check (USE_PRO_SCORER=true)
     ↓
Professional Path Router
     ↓
Devigging Service (Golden Test #1)
     ↓
CLV Tracking Service (Golden Test #2)
     ↓
Enhanced Scoring Engine (Golden Test #3)
     ↓
Tier Assignment Service (Golden Test #4)
     ↓
Debug Logging (Golden Test #5)
     ↓
Professional Result Output (Golden Test #6)
```

Each step has locked behavior that must remain consistent for professional betting compliance.

## Monitoring and Alerts

### Production Monitoring
- Golden tests run in CI/CD before every deployment
- Any golden test failure blocks production release
- Test results are logged to monitoring system
- Alerts sent to engineering team on failures

### Performance Monitoring
- Test execution time tracked and alerted if >5 minutes
- Memory usage monitored during test execution
- Database performance during golden tests validated

## Troubleshooting

### Common Issues

**Golden Test Failure After Code Change:**
1. Review what calculations changed in your code
2. Verify the change is intentional and beneficial
3. If intentional, get professional approval to update locked values
4. If unintentional, revert the change and fix the regression

**New Feature Breaking Golden Tests:**
1. Ensure new feature doesn't modify existing calculations
2. Add new golden tests for the new feature
3. Update integration tests to include the new feature
4. Verify backwards compatibility with existing behavior

**Performance Degradation:**
1. Check if new code impacts test execution speed
2. Optimize performance-critical paths
3. Consider mocking external services in golden tests
4. Ensure tests complete within 5-minute timeout

### Getting Help

**For Golden Test Issues:**
- Review this documentation first
- Check recent code changes that might affect calculations
- Consult with platform engineering team for locked value changes
- Use `npm run test:golden -- --verbose` for detailed output

**For Professional System Changes:**
- All changes must maintain 100% golden test compatibility
- New professional features require new golden tests
- Changes to core calculations require extensive review
- Performance impacts must be validated with golden tests

---

**Remember**: Golden tests are the foundation of professional betting system reliability. They prevent regressions in critical mathematical calculations that directly impact profitability and user trust. Treat them with the highest level of care and precision.