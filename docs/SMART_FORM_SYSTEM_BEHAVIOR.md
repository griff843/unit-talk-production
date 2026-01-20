# Smart Form System Behavior Report

**PR**: PR #36 Go-Live Hardening **Date**: 2026-01-20 **Author**: Release
Integrity Engineer **Status**: E2E Discovery Complete

---

## Overview

This report documents the **discovered** (not assumed) system behavior for the
Smart Form to Discord pipeline. All findings are based on repository code
analysis with file:line evidence.

---

## E2E Goal Validation

### Target Goal

> A manual Smart Form submission MUST process E2E to Discord posting with proper
> formatting and channel routing.

### PASS/FAIL Matrix

| Requirement                          | Status   | Evidence                                                |
| ------------------------------------ | -------- | ------------------------------------------------------- |
| **Smart Form accepts submission**    | **PASS** | `apps/smart-form/app/api/submit-ticket/route.ts`        |
| **Ticket stored in smart_tickets**   | **PASS** | Same file, Supabase insert                              |
| **Picks stored in unified_picks**    | **PASS** | Same file, legs mapping                                 |
| **Event published to bridge_outbox** | **PASS** | `apps/smart-form/bridge/publish.ts:25-35`               |
| **BridgeWorker consumes events**     | **PASS** | `apps/api/src/workers/BridgeWorker.ts`                  |
| **Grading workflow executes**        | **PASS** | `apps/api/src/workflows/event-driven-grading-simple.ts` |
| **pick_publish record created**      | **FAIL** | No production code writes to this table                 |
| **Discord message posted**           | **PASS** | `apps/api/src/agents/AlertAgent/index.ts:583-585`       |
| **Channel routing correct**          | **PASS** | `apps/api/src/agents/AlertAgent/index.ts:642-657`       |
| **Message formatting correct**       | **PASS** | `apps/api/src/services/EnhancedDiscordFormatter.ts`     |
| **posted_to_discord flag updated**   | **PASS** | `apps/api/src/agents/AlertAgent/index.ts:694-695`       |
| **Idempotency enforced**             | **PASS** | `bet_slip_id` as unique_key                             |
| **AutopilotGuard integration**       | **PASS** | All Discord paths use guard                             |

### Overall Result

| Category                              | Status                       |
| ------------------------------------- | ---------------------------- |
| **Functional E2E Flow**               | **PASS**                     |
| **Canonical Architecture Compliance** | **PARTIAL FAIL**             |
| **Rollout Ready**                     | **YES** (with documentation) |

---

## Discovered System Behaviors

### 1. Multiple Discord Publishing Paths

The system has **THREE** parallel paths for Discord publishing:

| Path                      | Trigger          | Query Target    | Method               | File                             |
| ------------------------- | ---------------- | --------------- | -------------------- | -------------------------------- |
| **AlertAgent**            | Polling interval | `unified_picks` | `sendDiscordAlert()` | `AlertAgent/index.ts`            |
| **DiscordPromotionAgent** | Script execution | `unified_picks` | Webhook POST         | `DiscordPromotionAgent/index.ts` |
| **DailyPickPublisher**    | Manual/Scheduled | `capperService` | Discord.js client    | `dailyPickPublisher.ts`          |

**Implication**: Multiple paths may attempt to post the same pick if
coordination is not properly managed.

**Coordination Mechanism**: `posted_to_discord = false` flag used by all paths.

---

### 2. Channel Routing Configuration

**Discovery**: Channel routing is configured via environment variables, NOT
database.

**Configuration Source**: `apps/api/src/config/env.ts:93-109`

```typescript
capperThreads: {
  Griff843: process.env.CAPPER_THREAD_GRIFF843,
  Vicgo: process.env.CAPPER_THREAD_VICGO,
  Sauced: process.env.CAPPER_THREAD_SAUCED,
  MoneyReef: process.env.CAPPER_THREAD_MONEYREEF,
  Squirrel: process.env.CAPPER_THREAD_SQUIRREL,
},
systemAlertsThreadId: process.env.SYSTEM_ALERTS_THREAD_ID,
alertsChannelId: process.env.ALERTS_CHANNEL_ID
```

**Routing Logic** (`DiscordAlertRouter.ts:84-107`): | Alert Type | Channel |
|------------|---------| | `pick_post` | `env.capperThreads[capper]` | |
`hedge_opportunity` | `env.alertsChannelId` | | `middle_opportunity` |
`env.alertsChannelId` | | `injury_impact` | `env.alertsChannelId` | |
`steam_move` | `env.alertsChannelId` | | `system_error` |
`env.systemAlertsThreadId` |

---

### 3. AutopilotGuard as Single Choke-Point

**Discovery**: ALL Discord side effects MUST go through AutopilotGuard.

**File**: `apps/api/src/lib/AutopilotGuard.ts`

**Implementation Pattern**:

```typescript
const guardResult = await autopilotGuard.assertMayPerformSideEffect({
  action: 'DISCORD_POST',
  agent_name: 'AlertAgent',
  pick_id: pick.id,
  metadata: { tier: pick.tier },
});

if (!guardResult.allowed) {
  logger.info('Blocked by AutopilotGuard', { reason: guardResult.reason });
  return; // Do not post
}
```

**Mode Determination** (env-based):

```typescript
private determineMode(): AutopilotMode {
  const envMode = process.env.AUTOPILOT_MODE?.toLowerCase();
  // Valid: 'off', 'log_only', 'canary', 'prod'
  // Default: 'off' (fail-closed)
}
```

**Audit Trail**: Every decision logged to `autopilot_decisions` table.

---

### 4. Grading System Integration

**Discovery**: Grading uses `ProfessionalPropProcessor` with 8 features.

**Features** (`event-driven-grading-simple.ts:69-78`):

1. `steamDetection` - Steam move detection
2. `closingLinePrediction` - CLV prediction
3. `optimalTiming` - Hour-to-game edge
4. `lineShoppingEdge` - Multi-book best line
5. `publicSharpSplit` - Contrarian detection
6. `marketTimingAdvantage` - Time-decay edge
7. `injuryTimingEdge` - News break timing
8. `crossMarketDiscrepancy` - Related prop arbitrage

**Tier Assignment**: | Edge Score | Tier | |------------|------| | > 80 | S-tier
| | > 65 | A-tier | | > 50 | B-tier | | > 35 | C-tier | | ≤ 35 | D-tier |

---

### 5. Message Formatting Standards

**Discovery**: `EnhancedDiscordFormatter` provides Fortune 100-grade embeds.

**Color Coding** (`EnhancedDiscordFormatter.ts:23-28`): | Tier | Regular | Live
| |------|---------|------| | S-tier | Gold (0xFFD700) | Red (0xFF0000) | |
A-tier | Green (0x00FF00) | OrangeRed (0xFF4500) | | B-tier | Blue (0x1E90FF) |
Tomato (0xFF6347) | | C-tier | Purple (0x9370DB) | Hot Pink (0xFF69B4) |

**Embed Fields**:

- Selection with odds
- System Grade with emoji
- Units with visual indicator
- Confidence bar
- AI Analysis (if available)
- Edge Score, EV, Kelly % (if available)
- Risk Assessment badge

---

### 6. Idempotency Mechanisms

**Discovery**: Multiple idempotency layers exist.

| Layer                 | Key                        | File                                |
| --------------------- | -------------------------- | ----------------------------------- |
| Smart Form submission | `bet_slip_id`              | `submit-ticket/route.ts`            |
| Bridge outbox         | `unique_key = bet_slip_id` | `bridge/publish.ts:30`              |
| Grading workflow      | `idempotencyKey`           | `event-driven-grading-simple.ts:18` |
| Discord posting       | `posted_to_discord` flag   | `unified_picks` table               |

**Duplicate Handling** (`bridge/publish.ts:39-44`):

```typescript
if (error.code === '23505') {
  log.info('Ticket submission event already exists (idempotent)');
  return true; // Success - already processed
}
```

---

### 7. Circuit Breaker Patterns

**Discovery**: Circuit breakers protect external service calls.

**AlertAgent Circuit Breaker** (`AlertAgent/index.ts:583-592`):

```typescript
const messageId = await withCircuitBreaker.discord(
  async () => {
    await sendDiscordAlert(embed);
    return `alert-${Date.now()}`;
  },
  async () => {
    this.alertMetrics.fallbacksUsed++;
    await this.logPickForManualPosting(pickData);
    return null;
  }
);
```

**Fallback Behavior**: Log pick for manual posting when circuit is open.

---

### 8. Missing pick_publish Integration

**Discovery**: The canonical `pick_publish` table is defined but NOT used.

**Schema Exists**
(`supabase/migrations/20260120_pr10_canonical_schema_alignment.sql:149-169`):

```sql
CREATE TABLE IF NOT EXISTS public.pick_publish (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_id UUID REFERENCES public.unified_picks(id),
  bet_slip_id VARCHAR(255),
  embed_data JSONB,
  channel_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  ...
);
```

**Production Code**: No code writes to `pick_publish` after grading.

**Expected by E2E Test**
(`tests/e2e/flow1-smart-form-to-discord.e2e.spec.ts:154-162`):

```typescript
// Step 7: Verify pick_publish record created
const pickPublishExists = await waitForCondition(
  () => dbHelper.verifyPickPublishCreated(testBetSlipId),
  60000
);
expect(pickPublishExists).toBe(true);
```

**Gap Impact**: E2E test will FAIL at Step 7 because no production code creates
`pick_publish` records.

---

## Behavior vs Expectation Analysis

### What E2E Test Expects

```
1. Submit → smart_tickets, unified_picks, bridge_outbox ✓
2. bridge_outbox → BridgeWorker → grading workflow ✓
3. grading workflow → pick_publish record ✗ MISSING
4. DiscordPublishingWorker → consumes pick_publish ✗ MISSING
5. Discord message posted via pick_publish worker ✗ MISSING
```

### What Actually Happens

```
1. Submit → smart_tickets, unified_picks, bridge_outbox ✓
2. bridge_outbox → BridgeWorker → grading workflow ✓
3. (No pick_publish write)
4. AlertAgent polls unified_picks (posted_to_discord=false) ✓
5. AlertAgent posts to Discord via sendDiscordAlert() ✓
6. AlertAgent updates posted_to_discord=true ✓
```

### Gap Summary

| Expected Component               | Actual Status                                 |
| -------------------------------- | --------------------------------------------- |
| `TicketLifecycleWorkflow`        | NOT IMPLEMENTED (referenced in E2E test only) |
| Write to `pick_publish`          | NOT IMPLEMENTED                               |
| `DiscordPublishingWorker`        | NOT IMPLEMENTED                               |
| Direct `unified_picks` → Discord | IMPLEMENTED (via AlertAgent)                  |

---

## Recommendations

### Immediate (PR #36)

1. **Update E2E test** to match actual flow:
   - Remove Step 7 (pick_publish verification) OR
   - Add code to write to pick_publish from grading workflow

2. **Document current behavior** as the accepted flow for go-live

3. **Ensure AutopilotGuard mode** is properly set for staging/production

### Future Enhancement

1. **Implement pick_publish flow** for:
   - Better audit trail
   - Retry queue with visibility
   - Decoupled Discord publishing
   - Status tracking per message

2. **Create DiscordPublishingWorker** that:
   - Consumes from `pick_publish` where `status = 'pending'`
   - Posts to Discord
   - Updates `status = 'published'` with `discord_message_id`

---

## Configuration Requirements

### Required Environment Variables

| Variable                  | Required | Default | Description                     |
| ------------------------- | -------- | ------- | ------------------------------- |
| `AUTOPILOT_MODE`          | Yes      | `off`   | Must be `prod` for live posting |
| `CAPPER_THREAD_GRIFF843`  | Yes      | -       | Discord thread ID               |
| `CAPPER_THREAD_VICGO`     | Yes      | -       | Discord thread ID               |
| `CAPPER_THREAD_SAUCED`    | Yes      | -       | Discord thread ID               |
| `ALERTS_CHANNEL_ID`       | Yes      | -       | Main alerts channel             |
| `SYSTEM_ALERTS_THREAD_ID` | Yes      | -       | System error thread             |
| `DISCORD_WEBHOOK_URL`     | Optional | -       | For DiscordPromotionAgent       |

### Verification Commands

```bash
# Check AutopilotGuard mode
echo $AUTOPILOT_MODE

# Verify capper threads configured
env | grep CAPPER_THREAD

# Test database connectivity
npx tsx scripts/phase6-e2e-validation.ts
```

---

## Conclusion

The Smart Form to Discord flow is **FUNCTIONAL** through the AlertAgent path.
However, the **canonical `pick_publish` architecture is not implemented**,
creating a discrepancy between:

- The documented/expected flow
- The actual production behavior

**Go-Live Recommendation**: PROCEED with current flow, document the gap, and
plan pick_publish integration as a follow-up enhancement.

---

_Report generated from repository evidence discovery. All findings verified
against source code._
