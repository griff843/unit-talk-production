# Production Readiness Checklist — Test Harness Addendum

This addendum documents the new repository-wide Jest + seeds test harness.

## Test Structure
- tests/seeds/*.json — JSON fixtures for integration seeds
- tests/agents/*.test.ts — Jest tests invoking ScoringAgent/PromotionAgent
- tests/setup/globalSetup.ts — DB reset before suite
- scripts/db/reset-test.ts — standalone reset (ts-node)
- jest.config.js — root Jest config (ts-jest)

## Commands
- npm run test → runs full suite
- npm run test:seeds → runs only ScoringAgent seed tests
- npm run db:reset:test → manual DB reset using ts-node

## Notes
- Windows-safe paths only (path.join in tests)
- Uses Supabase client from apps/api/src/services/supabaseClient
- Does not modify agent logic
- 30s test timeout
- Skips gracefully if Supabase env is not configured

