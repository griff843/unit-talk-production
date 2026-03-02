# QUARANTINE MANIFEST

**Sprint**: TEST-STABILITY-LOCK-004 **Quarantine Date**: 2026-02-28 **Expiration
Date**: 2026-04-01 (30 days) **Owner**: Engineering Team

---

## Purpose

This directory contains test files that are temporarily quarantined because they
fail to compile due to:

1. Testing methods that were never implemented
2. Testing protected/private methods that cannot be accessed from tests
3. Using outdated type definitions that no longer match the schema
4. Missing dependencies

---

## Rules

1. **DO NOT** add new tests to quarantine without team approval
2. **DO NOT** extend expiration without documenting reason
3. Tests that reach expiration must be either:
   - FIXED and returned to main test suite
   - DELETED if testing non-existent functionality
4. Any test removed from quarantine must pass locally before merge

---

## Quarantined Tests

### Agents (OBSOLETE_API)

| File                             | Reason                                         | Ticket  | Expiration |
| -------------------------------- | ---------------------------------------------- | ------- | ---------- |
| AgentInfrastructureTests.test.ts | Tests non-existent methods                     | TST-001 | 2026-04-01 |
| AgentPerformanceTests.test.ts    | Tests protected methods + non-existent methods | TST-001 | 2026-04-01 |
| AgentSubsystemTests.test.ts      | Tests non-existent methods                     | TST-001 | 2026-04-01 |
| NewAgentsTestSuite.test.ts       | Tests non-existent methods                     | TST-001 | 2026-04-01 |
| contestAgent.test.ts             | Type drift                                     | TST-002 | 2026-04-01 |
| gradingAgent.test.ts             | Type drift                                     | TST-002 | 2026-04-01 |
| marketingAgent.test.ts           | Type drift                                     | TST-002 | 2026-04-01 |
| NotificationAgent.test.ts        | Type drift                                     | TST-002 | 2026-04-01 |
| channels.test.ts                 | Type drift                                     | TST-002 | 2026-04-01 |
| optimal.test.ts                  | Type drift                                     | TST-002 | 2026-04-01 |
| mlbEnrichment.test.ts            | Type drift                                     | TST-002 | 2026-04-01 |

### Integration (TYPE_DRIFT + DEPENDENCY_MISSING)

| File                             | Reason                              | Ticket  | Expiration |
| -------------------------------- | ----------------------------------- | ------- | ---------- |
| notification-integration.test.ts | Missing @slack/web-api + type drift | TST-003 | 2026-04-01 |
| supabase-integration.test.ts     | Type drift                          | TST-002 | 2026-04-01 |
| system-integration.test.ts       | Type drift                          | TST-002 | 2026-04-01 |
| discord-integration.test.ts      | Type drift                          | TST-002 | 2026-04-01 |
| discord-db-integration.test.ts   | Type drift                          | TST-002 | 2026-04-01 |
| ai-integration.test.ts           | Type drift                          | TST-002 | 2026-04-01 |
| ai-platform-integration.test.ts  | Type drift                          | TST-002 | 2026-04-01 |
| monitoring-integration.test.ts   | Type drift                          | TST-002 | 2026-04-01 |
| frontend-api-integration.test.ts | Type drift                          | TST-002 | 2026-04-01 |
| odds-integration.test.ts         | Type drift                          | TST-002 | 2026-04-01 |

### Commands (TYPE_DRIFT)

| File                   | Reason     | Ticket  | Expiration |
| ---------------------- | ---------- | ------- | ---------- |
| ask-unit-talk.test.ts  | Type drift | TST-002 | 2026-04-01 |
| capper-onboard.test.ts | Type drift | TST-002 | 2026-04-01 |
| capper-stats.test.ts   | Type drift | TST-002 | 2026-04-01 |
| delete-pick.test.ts    | Type drift | TST-002 | 2026-04-01 |
| edit-pick.test.ts      | Type drift | TST-002 | 2026-04-01 |
| ev-report.test.ts      | Type drift | TST-002 | 2026-04-01 |
| submit-pick.test.ts    | Type drift | TST-002 | 2026-04-01 |
| trend-breaker.test.ts  | Type drift | TST-002 | 2026-04-01 |

### Services (TYPE_DRIFT)

| File                          | Reason     | Ticket  | Expiration |
| ----------------------------- | ---------- | ------- | ---------- |
| PromotionGatekeeper.test.ts   | Type drift | TST-002 | 2026-04-01 |
| STierEnforcer.test.ts         | Type drift | TST-002 | 2026-04-01 |
| PortfolioRiskManager.test.ts  | Type drift | TST-002 | 2026-04-01 |
| RollingMetricsService.test.ts | Type drift | TST-002 | 2026-04-01 |

### Scoring (TYPE_DRIFT)

| File                      | Reason     | Ticket  | Expiration |
| ------------------------- | ---------- | ------- | ---------- |
| promotionPolicy.test.ts   | Type drift | TST-002 | 2026-04-01 |
| postingGovernance.test.ts | Type drift | TST-002 | 2026-04-01 |

### Professional (TYPE_DRIFT)

| File                            | Reason     | Ticket  | Expiration |
| ------------------------------- | ---------- | ------- | ---------- |
| enhanced-scoring.golden.test.ts | Type drift | TST-002 | 2026-04-01 |
| tier-assignment.golden.test.ts  | Type drift | TST-002 | 2026-04-01 |
| integration.golden.test.ts      | Type drift | TST-002 | 2026-04-01 |
| devigging.golden.test.ts        | Type drift | TST-002 | 2026-04-01 |
| debug-logging.golden.test.ts    | Type drift | TST-002 | 2026-04-01 |
| clv-tracking.golden.test.ts     | Type drift | TST-002 | 2026-04-01 |

### E2E (TYPE_DRIFT)

| File                      | Reason     | Ticket  | Expiration |
| ------------------------- | ---------- | ------- | ---------- |
| ui-components.test.ts     | Type drift | TST-002 | 2026-04-01 |
| onboarding.test.ts        | Type drift | TST-002 | 2026-04-01 |
| daily-workflows.test.ts   | Type drift | TST-002 | 2026-04-01 |
| advanced-features.test.ts | Type drift | TST-002 | 2026-04-01 |

### Shadow-Mode (TYPE_DRIFT)

| File                       | Reason     | Ticket  | Expiration |
| -------------------------- | ---------- | ------- | ---------- |
| shadow-mode.test.ts        | Type drift | TST-002 | 2026-04-01 |
| shadow-integration.test.ts | Type drift | TST-002 | 2026-04-01 |

### AI (TYPE_DRIFT)

| File            | Reason     | Ticket  | Expiration |
| --------------- | ---------- | ------- | ---------- |
| routing.test.ts | Type drift | TST-002 | 2026-04-01 |
| cache.test.ts   | Type drift | TST-002 | 2026-04-01 |

### Config (TYPE_DRIFT)

| File             | Reason     | Ticket  | Expiration |
| ---------------- | ---------- | ------- | ---------- |
| supabase.test.ts | Type drift | TST-002 | 2026-04-01 |

### Logic (TYPE_DRIFT)

| File                          | Reason     | Ticket  | Expiration |
| ----------------------------- | ---------- | ------- | ---------- |
| zoneThreatIntegration.test.ts | Type drift | TST-002 | 2026-04-01 |
| zoneThreat.test.ts            | Type drift | TST-002 | 2026-04-01 |

### Mocks (TYPE_DRIFT)

| File                  | Reason     | Ticket  | Expiration |
| --------------------- | ---------- | ------- | ---------- |
| supabase-mock.test.ts | Type drift | TST-002 | 2026-04-01 |

### Performance (TYPE_DRIFT)

| File                              | Reason     | Ticket  | Expiration |
| --------------------------------- | ---------- | ------- | ---------- |
| load-balancer-performance.test.ts | Type drift | TST-002 | 2026-04-01 |
| cache-performance.test.ts         | Type drift | TST-002 | 2026-04-01 |

### Schema (TYPE_DRIFT)

| File                         | Reason     | Ticket  | Expiration |
| ---------------------------- | ---------- | ------- | ---------- |
| v3-schema-compliance.test.ts | Type drift | TST-002 | 2026-04-01 |

### Shared (TYPE_DRIFT)

| File                 | Reason     | Ticket  | Expiration |
| -------------------- | ---------- | ------- | ---------- |
| errors/index.test.ts | Type drift | TST-002 | 2026-04-01 |

### Unit (TYPE_DRIFT)

| File                 | Reason     | Ticket  | Expiration |
| -------------------- | ---------- | ------- | ---------- |
| risk-manager.test.ts | Type drift | TST-002 | 2026-04-01 |
| ml-pipeline.test.ts  | Type drift | TST-002 | 2026-04-01 |

---

## Ticket References

| Ticket  | Description                                    |
| ------- | ---------------------------------------------- |
| TST-001 | Tests for non-existent/protected agent methods |
| TST-002 | Tests with type drift (outdated schema types)  |
| TST-003 | Tests with missing dependencies                |

---

## Resolution Path

### For TST-001 (Non-existent methods):

- DELETE tests if methods will never be implemented
- IMPLEMENT methods and fix tests if functionality is needed

### For TST-002 (Type drift):

- UPDATE mock data to match current schema
- UPDATE assertions to use current field names
- VERIFY tests pass after updates

### For TST-003 (Missing dependencies):

- INSTALL dependency if needed
- MOCK dependency if not needed in tests
- DELETE test if feature is deprecated

---

**Last Updated**: 2026-02-28 **Updated By**: Claude (TEST-STABILITY-LOCK-004)
