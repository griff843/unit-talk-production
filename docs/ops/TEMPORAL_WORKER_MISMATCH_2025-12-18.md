# Temporal Worker Activity Mismatch - 2025-12-18

**Status**: ❌ **BLOCKING ISSUE** - Workflow cannot execute due to missing activity
**Priority**: **CRITICAL** - Prevents FeedAgent from running quota monitoring
**Impact**: Zero upcoming games in raw_props due to ingestion workflow failure

---

## Executive Summary

The `quotaMonitoringWorkflow` calls `checkApiQuota` activity, but this activity **is not implemented or exported** by the OperatorAgent. This causes a registration mismatch error and prevents the workflow from executing.

**Error Message**:
```
Activity function checkApiQuota is not registered on this Worker
```

---

## Root Cause Analysis

### 1. Type Definition (✅ EXISTS)

**File**: `apps/api/src/types/activities.ts:302-309`

```typescript
export interface OperatorAgentActivities {
  // API quota management
  checkApiQuota(params: { provider: string }): Promise<{
    provider: string;
    hourlyLimit: number;
    hourlyUsed: number;
    remainingCalls: number;
    resetTime: Date;
    status: 'healthy' | 'warning' | 'critical';
  }>;

  // ... other activities
}
```

**Status**: ✅ Type signature defined correctly

---

### 2. Workflow Usage (✅ EXISTS)

**File**: `apps/api/src/workflows/support-workflows.ts:188-250`

The `quotaMonitoringWorkflow` calls `checkApiQuota` on line 201:

```typescript
export async function quotaMonitoringWorkflow(): Promise<void> {
  let shouldContinue = true;
  const MAX_ITERATIONS = 1000000;
  let iteration = 0;

  while (shouldContinue && iteration < MAX_ITERATIONS) {
    try {
      const providers = ['optimal', 'odds-api', 'backup'];
      const quotaResults: QuotaStatus[] = [];

      for (const provider of providers) {
        try {
          // ❌ THIS CALL FAILS - Activity not registered
          const rawQuotaStatus = await operatorActivities.checkApiQuota({ provider });

          const quotaStatus: QuotaStatus = {
            provider: rawQuotaStatus.provider,
            used: rawQuotaStatus.hourlyUsed,
            limit: rawQuotaStatus.hourlyLimit,
            resetTime: rawQuotaStatus.resetTime.toISOString(),
            percentage: (rawQuotaStatus.hourlyUsed / rawQuotaStatus.hourlyLimit) * 100
          };

          quotaResults.push(quotaStatus);

          // Alert if quota usage is high
          if (quotaStatus.percentage > 80) {
            await alertActivities.processAlert({
              type: 'quota',
              provider,
              usage: percentage,
              severity: percentage > 95 ? 'critical' : 'warning'
            });
          }
        } catch (error) {
          await operatorActivities.logError({
            error: `Quota check failed for ${provider}: ${error}`,
            timestamp: new Date()
          });
        }
      }

      await sleep('15 minutes');
      iteration++;
    } catch (error) {
      await operatorActivities.logError({
        error: `Quota monitoring error: ${error}`,
        workflow: 'quotaMonitoringWorkflow',
        timestamp: new Date()
      });
      await sleep('5 minutes');
      iteration++;
    }
  }
}
```

**Status**: ✅ Workflow correctly expects `checkApiQuota` activity

---

### 3. Activity Implementation (❌ MISSING)

**File**: `apps/api/src/agents/OperatorAgent/activities/index.ts`

**Current exports**:
```typescript
export async function monitorSystem(): Promise<void> { ... }
export async function handleAlert(alert: any): Promise<void> { ... }
export async function performMaintenance(): Promise<void> { ... }
export async function handleCriticalError(params: ...): Promise<...> { ... }
export async function updateLiveGameStatus(params: ...): Promise<...> { ... }
export async function logUSPError(params: ...): Promise<...> { ... }
```

**Missing**:
```typescript
// ❌ NOT EXPORTED - Causes registration error
export async function checkApiQuota(params: { provider: string }): Promise<{
  provider: string;
  hourlyLimit: number;
  hourlyUsed: number;
  remainingCalls: number;
  resetTime: Date;
  status: 'healthy' | 'warning' | 'critical';
}> {
  // Implementation needed
}
```

**Status**: ❌ **Activity NOT implemented or exported**

---

### 4. Worker Registration (✅ CORRECT)

**File**: `apps/api/src/worker.ts:58-78`

```typescript
const worker = await Worker.create({
  connection,
  workflowsPath: require.resolve('./workflows'),
  activities: {
    // Register base activities
    ...baseActivities,
    ...healthMonitoringActivities,
    ...mainOperatorActivities,

    // Register Temporal activities
    ...temporalActivities,

    // Register agent-specific activities
    ...analyticsActivities,
    ...notificationActivities,
    ...feedActivities,
    ...auditActivities,
    ...gradingActivities,
    ...alertActivities,
    ...campaignActivities,
    ...contestActivities,
    ...operatorActivities,  // ← Imports from OperatorAgent/activities/index.ts
    ...playerEnrichmentActivities
  },
  taskQueue: env.TEMPORAL_TASK_QUEUE,
  maxConcurrentActivityTaskExecutions: 10,
  maxConcurrentWorkflowTaskExecutions: 10
});
```

**Status**: ✅ Worker registration code is correct, but `checkApiQuota` is not in the imported activities

---

## Impact Analysis

### Immediate Impact
1. **`quotaMonitoringWorkflow` cannot execute** - Fails immediately when calling `checkApiQuota`
2. **API quota monitoring disabled** - No alerts for quota exhaustion
3. **Potential API quota violations** - System can exceed rate limits without detection
4. **FeedAgent may fail** - Could hit quota limits without warning

### Cascade Effects
1. **Zero upcoming games in `raw_props`** - If FeedAgent quota is exhausted, ingestion stops
2. **CANARY E2E test blocked** - Cannot find upcoming games to promote
3. **Production risk** - Quota exhaustion could cause service outage

---

## Remediation Plan

### Option 1: Implement `checkApiQuota` Activity (RECOMMENDED)

**Add to** `apps/api/src/agents/OperatorAgent/activities/index.ts`:

```typescript
export async function checkApiQuota(params: { provider: string }): Promise<{
  provider: string;
  hourlyLimit: number;
  hourlyUsed: number;
  remainingCalls: number;
  resetTime: Date;
  status: 'healthy' | 'warning' | 'critical';
}> {
  const agent = OperatorAgent.getInstance(getDependencies());

  // Implementation would need to:
  // 1. Query API provider for current usage
  // 2. Compare against configured limits
  // 3. Calculate remaining calls and reset time
  // 4. Return status based on usage thresholds

  // Example (needs actual provider integration):
  const quotaConfig = {
    'optimal': { hourlyLimit: 1000 },
    'odds-api': { hourlyLimit: 500 },
    'backup': { hourlyLimit: 100 }
  };

  const limit = quotaConfig[params.provider]?.hourlyLimit || 100;
  const used = 0; // Would query from provider metrics
  const remaining = limit - used;
  const percentage = (used / limit) * 100;

  return {
    provider: params.provider,
    hourlyLimit: limit,
    hourlyUsed: used,
    remainingCalls: remaining,
    resetTime: new Date(Date.now() + 60 * 60 * 1000), // Next hour
    status: percentage > 95 ? 'critical' : percentage > 80 ? 'warning' : 'healthy'
  };
}
```

**Steps**:
1. Add implementation to `apps/api/src/agents/OperatorAgent/activities/index.ts`
2. Integrate with actual API provider metrics (Optimal API, Odds API, etc.)
3. Restart worker: `docker compose restart api`
4. Verify with `npx tsx scripts/ops/verify-temporal-activities.ts`

---

### Option 2: Disable `quotaMonitoringWorkflow` (TEMPORARY)

**If quota monitoring is not critical**, comment out workflow startup:

**File**: `apps/api/src/scripts/start-all-workflows.ts`

```typescript
// Comment out quotaMonitoringWorkflow
// await client.workflow.start(quotaMonitoringWorkflow, { ... });
```

**Warning**: This removes quota monitoring entirely - not recommended for production.

---

### Option 3: Replace with Stub Implementation (QUICK FIX)

**Add minimal stub** to unblock workflow:

```typescript
export async function checkApiQuota(params: { provider: string }): Promise<{
  provider: string;
  hourlyLimit: number;
  hourlyUsed: number;
  remainingCalls: number;
  resetTime: Date;
  status: 'healthy' | 'warning' | 'critical';
}> {
  console.log(`[checkApiQuota] Stub called for provider: ${params.provider}`);

  return {
    provider: params.provider,
    hourlyLimit: 1000,
    hourlyUsed: 0,
    remainingCalls: 1000,
    resetTime: new Date(Date.now() + 60 * 60 * 1000),
    status: 'healthy'
  };
}
```

**Warning**: This provides fake data - only use for development/testing.

---

## Verification

### PowerShell Commands

```powershell
# 1. Check worker logs for registration errors
docker compose logs api --since 5m | Select-String -Pattern "checkApiQuota|not registered"

# 2. Check Temporal workflows status
docker compose logs api --since 5m | Select-String -Pattern "quotaMonitoring|Workflow"

# 3. Restart API container after fix
docker compose up -d --force-recreate api

# 4. Verify activity registration
npx tsx scripts/ops/verify-temporal-activities.ts
```

### SQL Verification (Run in SQL Editor)

```sql
-- Check if FeedAgent is producing upcoming games
SELECT
  COUNT(*) FILTER (WHERE event_time >= NOW()) as upcoming_count,
  MAX(event_time) as max_event_time,
  NOW() as current_time,
  MAX(event_time) - NOW() as time_until_latest
FROM raw_props
WHERE is_valid = true;

-- Expected: upcoming_count > 0, max_event_time > NOW()
```

---

## Related Issues

1. **CANARY Publishing Blocked** - No upcoming games to publish (docs/ops/canary_e2e_evidence_2025-12-17.md)
2. **FeedAgent Not Running** - Quota monitoring failure may prevent ingestion
3. **Temporal Worker Health** - Activity registration mismatch prevents workflows

---

## Recommended Action

**Priority 1**: Implement `checkApiQuota` activity with real provider integration
**Priority 2**: Verify FeedAgent is configured to run and populate future events
**Priority 3**: Test full ingestion → grading → publishing pipeline with `npx tsx scripts/canary_e2e_smoke.ts`

---

## Documentation References

- **Type Definitions**: `apps/api/src/types/activities.ts`
- **Workflow Code**: `apps/api/src/workflows/support-workflows.ts`
- **Worker Registration**: `apps/api/src/worker.ts`
- **Activity Implementation**: `apps/api/src/agents/OperatorAgent/activities/index.ts`
- **SQL vs PowerShell Guide**: `docs/ops/SQL_VS_POWERSHELL_BOUNDARIES.md`
- **Diagnostic Script**: `scripts/ops/windows/canary-diagnose.ps1`

---

**Next Steps**: See `scripts/ops/verify-temporal-activities.ts` for automated verification after fix is applied.
