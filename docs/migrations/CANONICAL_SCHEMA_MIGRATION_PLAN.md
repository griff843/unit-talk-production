# Canonical Schema V2 Migration Plan

> **Version**: 1.0.0 **Status**: DRAFT - Pending Canonical Schema Decision
> **Source**:
> `out/audits/CANONICAL_SCHEMA_DECISION/2026-02-20/CANONICAL_SCHEMA_AUDIT.md`

---

## 1. Executive Summary

This document outlines the migration strategy from the current
`unified_picks`-based schema to the normalized Canonical Schema V2. The
migration uses a **dual-write bridge** pattern to ensure zero downtime and safe
rollback capability.

### Key Principles

1. **Additive First**: New tables deployed alongside existing
2. **Dual-Write Bridge**: V2 writes sync to V1 during transition
3. **Gradual Cutover**: One consumer at a time
4. **Safe Rollback**: V1 remains canonical until V2 proven
5. **Legacy Removal**: V1 deprecated only after verification period

---

## 2. Migration Phases

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Phase 1: Deploy V2 Tables (Additive)                                   │
│  - Create participants, events, segments, markets, tickets, ticket_legs│
│  - Create contract views (catalog_*_v2)                                 │
│  - Load seed data (sports, segments, markets)                           │
├─────────────────────────────────────────────────────────────────────────┤
│  Phase 2: Dual-Write Infrastructure                                     │
│  - Deploy atomic_submit_ticket_v2 RPC                                   │
│  - Add dual-write trigger: V2 → unified_picks                           │
│  - Lifecycle adapter V2 with dual-write                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  Phase 3: Smart Form Migration                                          │
│  - Switch Smart Form to V2 views + RPC                                  │
│  - Verify submissions flow through V2 → V1 bridge                       │
├─────────────────────────────────────────────────────────────────────────┤
│  Phase 4: Agent Migration (One at a Time)                               │
│  - BridgeWorker → reads V2                                              │
│  - GradingAgent → reads/writes V2                                       │
│  - DiscordPromotionAgent → reads/writes V2                              │
│  - SettlementAgent → reads/writes V2                                    │
│  - RecapAgent → reads V2                                                │
├─────────────────────────────────────────────────────────────────────────┤
│  Phase 5: Dual-Write Removal                                            │
│  - Disable V2 → V1 sync trigger                                         │
│  - V2 becomes sole source of truth                                      │
├─────────────────────────────────────────────────────────────────────────┤
│  Phase 6: Legacy Deprecation                                            │
│  - Deprecate V1 RPCs (atomic_submit_ticket)                             │
│  - Deprecate V1 views (catalog_*_v1)                                    │
│  - unified_picks marked read-only (historical)                          │
├─────────────────────────────────────────────────────────────────────────┤
│  Phase 7: Legacy Removal (After Verification Period)                    │
│  - Archive unified_picks data                                           │
│  - Drop deprecated views                                                │
│  - Drop deprecated RPCs                                                 │
│  - Clean up lifecycle adapter V1 code                                   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Sprint Sequence

### Sprint 1: Foundation Tables

**Objective**: Deploy V2 tables and seed data

**Migrations**:

```sql
-- 20260301000000_canonical_v2_participants.sql
CREATE TABLE participants (...);
CREATE TABLE participant_memberships (...);

-- 20260301000001_canonical_v2_events.sql
CREATE TABLE events (...);
CREATE TABLE event_segments (...);

-- 20260301000002_canonical_v2_markets.sql
CREATE TABLE markets (...);

-- 20260301000003_canonical_v2_tickets.sql
CREATE TABLE tickets (...);
CREATE TABLE ticket_legs (...);
```

**Seed Data**:

- Load `seed_pack/sports.json`
- Load `seed_pack/segments.json`
- Load `seed_pack/markets.json`

**Verification**:

```bash
# Check all tables created
psql -c "\dt participants events event_segments markets tickets ticket_legs"

# Check seed data loaded
psql -c "SELECT COUNT(*) FROM markets"
```

**Rollback**: Drop all V2 tables (no dependencies yet)

---

### Sprint 2: Contract Views

**Objective**: Deploy V2 contract views

**Migrations**:

```sql
-- 20260302000000_canonical_v2_views.sql
CREATE VIEW catalog_participants_v2 AS ...;
CREATE VIEW catalog_events_v2 AS ...;
CREATE VIEW catalog_segments_v2 AS ...;
CREATE VIEW market_taxonomy_v2 AS ...;
CREATE VIEW tickets_full_v2 AS ...;
CREATE VIEW unified_picks_compat AS ...;
```

**Verification**:

```bash
# Check views created
psql -c "\dv catalog_*_v2"

# Test cascading filter query
psql -c "SELECT * FROM market_taxonomy_v2 WHERE sport_key = 'NBA' LIMIT 5"
```

**Rollback**: Drop views (no consumers yet)

---

### Sprint 3: Dual-Write RPC

**Objective**: Deploy atomic_submit_ticket_v2 with dual-write

**Migrations**:

```sql
-- 20260303000000_atomic_submit_ticket_v2.sql
CREATE OR REPLACE FUNCTION atomic_submit_ticket_v2(...) RETURNS JSONB AS $$
BEGIN
    -- Insert to tickets + ticket_legs
    ...

    -- DUAL-WRITE: Also insert to unified_picks
    INSERT INTO unified_picks (...)
    SELECT ... FROM ticket_legs WHERE ticket_id = p_ticket_id;

    -- Insert to bridge_outbox
    ...

    RETURN jsonb_build_object('success', true, ...);
END;
$$;
```

**Code Changes**:

```typescript
// apps/api/src/lib/lifecycle/write-adapter-v2.ts
export async function lifecycleInsertV2(...) {
    const result = await supabase.rpc('atomic_submit_ticket_v2', payload);
    // Dual-write handled in RPC
    return result;
}
```

**Verification**:

```bash
# Test RPC creates both V2 and V1 records
psql -c "SELECT * FROM atomic_submit_ticket_v2(...)"
psql -c "SELECT COUNT(*) FROM tickets WHERE bet_slip_id = 'test-123'"
psql -c "SELECT COUNT(*) FROM unified_picks WHERE bet_slip_id = 'test-123'"
```

**Rollback**: Drop RPC, keep V1 path active

---

### Sprint 4: Smart Form Cutover

**Objective**: Migrate Smart Form to V2

**Code Changes**:

```typescript
// apps/smart-form/app/api/submit-ticket/route.ts
// BEFORE:
const { data, error } = await supabase.rpc('atomic_submit_ticket', payload);

// AFTER:
const { data, error } = await supabase.rpc('atomic_submit_ticket_v2', payload);
```

```typescript
// apps/smart-form/hooks/useMarkets.ts
// BEFORE:
const { data } = await supabase.from('market_taxonomy_v1').select('*');

// AFTER:
const { data } = await supabase.from('market_taxonomy_v2').select('*');
```

**Feature Flag** (optional):

```typescript
const useV2Schema = process.env.NEXT_PUBLIC_USE_V2_SCHEMA === 'true';
const rpcName = useV2Schema
  ? 'atomic_submit_ticket_v2'
  : 'atomic_submit_ticket';
```

**Verification**:

- E2E test: Submit ticket through Smart Form
- Verify record in both `tickets` and `unified_picks`
- Verify `bridge_outbox` event created

**Rollback**: Revert code to V1 RPC call

---

### Sprint 5: Agent Migration - BridgeWorker

**Objective**: Migrate BridgeWorker to read V2

**Code Changes**:

```typescript
// apps/api/src/workers/BridgeWorker.ts
// BEFORE:
const pick = await supabase
  .from('unified_picks')
  .select('*')
  .eq('id', event.ticket_id);

// AFTER:
const ticket = await supabase
  .from('tickets_full_v2')
  .select('*')
  .eq('ticket_id', event.ticket_id);
```

**Verification**:

- Submit ticket through Smart Form
- Verify BridgeWorker processes event
- Verify ticket promotion_status updated

**Rollback**: Revert to unified_picks read

---

### Sprint 6: Agent Migration - GradingAgent + DiscordPromotionAgent

**Objective**: Migrate grading and posting agents

**Code Changes**:

```typescript
// apps/api/src/agents/GradingAgent/GradingAgent.ts
// Read from V2
const pendingLegs = await supabase
  .from('tickets_full_v2')
  .select('*')
  .eq('promotion_status', 'pending');

// Write via lifecycle adapter V2
await lifecycleUpdateV2(
  supabase,
  ticketId,
  {
    promotion_status: 'approved',
    tier: calculatedTier,
  },
  { writerRole: 'promoter' }
);
```

```typescript
// apps/api/src/agents/DiscordPromotionAgent/index.ts
// Atomic claim V2
const claimed = await atomicClaimForPostV2(supabase, ticketId);
if (!claimed) return; // Idempotent

// Update Discord fields
await lifecycleUpdateV2(
  supabase,
  ticketId,
  {
    posted_to_discord: true,
    discord_message_id: messageId,
    discord_channel_id: channelId,
  },
  { writerRole: 'poster' }
);
```

**Verification**:

- Submit ticket, verify grading flow
- Verify Discord post, verify message ID stored

**Rollback**: Revert to V1 adapters

---

### Sprint 7: Agent Migration - SettlementAgent + RecapAgent

**Objective**: Complete agent migration

**Code Changes**:

```typescript
// apps/api/src/agents/SettlementAgent/index.ts
// Read pending settlements from V2
const pendingLegs = await supabase
  .from('ticket_legs')
  .select('*, tickets(*)')
  .eq('settlement_status', 'pending');

// Settle via V2 adapter
await lifecycleSettleV2(
  supabase,
  legId,
  {
    leg_status: result,
    actual_result: actualValue,
    closing_line: closingLine,
  },
  { writerRole: 'settler' }
);
```

```typescript
// apps/api/src/agents/RecapAgent/index.ts
// Read settled tickets from V2
const settledToday = await supabase
  .from('tickets_full_v2')
  .select('*')
  .eq('ticket_status', 'settled')
  .gte('settled_at', todayStart);
```

**Verification**:

- Full lifecycle test: Submit → Grade → Post → Settle → Recap
- Verify all data consistent in V2 tables

**Rollback**: Revert to V1 adapters

---

### Sprint 8: Dual-Write Removal

**Objective**: Remove V2 → V1 sync

**Migrations**:

```sql
-- 20260308000000_remove_dual_write.sql
-- Remove dual-write from atomic_submit_ticket_v2
CREATE OR REPLACE FUNCTION atomic_submit_ticket_v2(...) RETURNS JSONB AS $$
BEGIN
    -- Insert to tickets + ticket_legs ONLY
    -- NO unified_picks insert
    ...
END;
$$;
```

**Code Verification**:

```bash
# Run single-writer gate - should find no V1 references
npm run lifecycle:single-writer -- --strict
```

**Rollback**: Re-enable dual-write trigger

---

### Sprint 9: Legacy Deprecation

**Objective**: Deprecate V1 artifacts

**Actions**:

1. Mark `atomic_submit_ticket` as deprecated (add warning)
2. Mark `catalog_*_v1` views as deprecated
3. Add deprecation notice to `unified_picks`
4. Update documentation

**Migrations**:

```sql
-- 20260309000000_deprecate_v1.sql
COMMENT ON FUNCTION atomic_submit_ticket IS 'DEPRECATED: Use atomic_submit_ticket_v2';
COMMENT ON VIEW market_taxonomy_v1 IS 'DEPRECATED: Use market_taxonomy_v2';
COMMENT ON TABLE unified_picks IS 'DEPRECATED: Historical data only. Use tickets + ticket_legs';
```

**Rollback**: Remove deprecation comments

---

### Sprint 10: Legacy Removal

**Objective**: Remove V1 artifacts (after 30-day verification period)

**Pre-Conditions**:

- [ ] No V1 queries in application logs for 30 days
- [ ] All agents using V2 confirmed
- [ ] Performance metrics stable
- [ ] User acceptance confirmed

**Migrations**:

```sql
-- 20260401000000_archive_unified_picks.sql
-- Archive to separate schema
CREATE SCHEMA archive;
ALTER TABLE unified_picks SET SCHEMA archive;

-- 20260401000001_drop_v1_artifacts.sql
DROP VIEW IF EXISTS market_taxonomy_v1;
DROP VIEW IF EXISTS catalog_players_v1;
DROP VIEW IF EXISTS catalog_teams_v1;
DROP VIEW IF EXISTS inventory_props_for_form_v1;
DROP FUNCTION IF EXISTS atomic_submit_ticket;
```

**Code Cleanup**:

- Remove `write-adapter.ts` V1 code
- Remove `idempotency.ts` V1 functions
- Remove feature flags

**Rollback**: Restore from archive schema

---

## 4. File Impact by Sprint

### Sprint 4 (Smart Form)

| File                                             | Change                  |
| ------------------------------------------------ | ----------------------- |
| `apps/smart-form/app/api/submit-ticket/route.ts` | RPC call → V2           |
| `apps/smart-form/app/submit-ticket/v2/page.tsx`  | Use V2 views            |
| `apps/smart-form/hooks/useMarkets.ts`            | market_taxonomy_v2      |
| `apps/smart-form/hooks/usePlayers.ts`            | catalog_participants_v2 |
| `apps/smart-form/hooks/useTeams.ts`              | catalog_participants_v2 |
| `apps/smart-form/lib/types.ts`                   | V2 type definitions     |

### Sprint 5-7 (Agents)

| File                                                 | Change               |
| ---------------------------------------------------- | -------------------- |
| `apps/api/src/workers/BridgeWorker.ts`               | Read tickets_full_v2 |
| `apps/api/src/agents/GradingAgent/GradingAgent.ts`   | Read/write V2        |
| `apps/api/src/agents/DiscordPromotionAgent/index.ts` | Read/write V2        |
| `apps/api/src/agents/SettlementAgent/index.ts`       | Read/write V2        |
| `apps/api/src/agents/RecapAgent/index.ts`            | Read V2              |
| `apps/api/src/lib/lifecycle/write-adapter.ts`        | Add V2 functions     |
| `apps/api/src/lib/lifecycle/idempotency.ts`          | Add V2 functions     |

### Sprint 8-9 (Cleanup)

| File                                          | Change                  |
| --------------------------------------------- | ----------------------- |
| `apps/api/src/lib/lifecycle/write-adapter.ts` | Remove V1 functions     |
| `apps/api/src/lib/lifecycle/idempotency.ts`   | Remove V1 functions     |
| All agent files                               | Remove V1 fallback code |
| All smart-form files                          | Remove V1 fallback code |

---

## 5. Rollback Procedures

### Quick Rollback (< 1 hour)

For any sprint, if issues detected:

```bash
# 1. Revert code changes
git revert <commit>

# 2. Deploy reverted code
npm run deploy

# 3. If migration applied, run rollback SQL
psql -f supabase/migrations/<migration>_rollback.sql
```

### Full Rollback (Phase)

If entire phase needs rollback:

```bash
# 1. Re-enable dual-write
psql -c "CREATE TRIGGER dual_write_v2_to_v1 ..."

# 2. Revert all code changes for phase
git revert <phase-start-commit>..<phase-end-commit>

# 3. Deploy
npm run deploy

# 4. Verify unified_picks receiving writes
psql -c "SELECT COUNT(*) FROM unified_picks WHERE created_at > NOW() - INTERVAL '1 hour'"
```

---

## 6. Monitoring Requirements

### Key Metrics

| Metric                               | Threshold   | Alert     |
| ------------------------------------ | ----------- | --------- |
| atomic_submit_ticket_v2 success rate | > 99.9%     | PagerDuty |
| Cascading filter latency p95         | < 200ms     | Slack     |
| Dual-write sync lag                  | < 1 second  | Slack     |
| tickets vs unified_picks count drift | 0           | Slack     |
| Agent processing latency             | < 5 seconds | Slack     |

### Queries

```sql
-- Verify dual-write sync
SELECT
    (SELECT COUNT(*) FROM tickets) AS v2_count,
    (SELECT COUNT(*) FROM unified_picks WHERE created_at > '2026-03-01') AS v1_count;

-- Check for sync drift
SELECT t.id, t.bet_slip_id
FROM tickets t
LEFT JOIN unified_picks up ON up.bet_slip_id = t.bet_slip_id
WHERE up.id IS NULL AND t.created_at > NOW() - INTERVAL '1 hour';
```

---

## 7. Risk Mitigation

### Risk 1: Dual-Write Performance

**Mitigation**:

- Monitor transaction latency
- If >10% increase, optimize or defer

### Risk 2: View Query Performance

**Mitigation**:

- All contract views have EXPLAIN ANALYZE targets
- Add materialized views if needed

### Risk 3: Agent Compatibility

**Mitigation**:

- Feature flags per agent
- Gradual rollout (one agent at a time)
- Immediate rollback capability

### Risk 4: Data Consistency

**Mitigation**:

- Automated sync verification queries
- Daily reconciliation report
- Alert on any drift

---

## 8. Success Criteria

### Phase Completion

| Phase | Success Criteria                          |
| ----- | ----------------------------------------- |
| 1-2   | Tables + views deployed, seed data loaded |
| 3     | RPC works, dual-write verified            |
| 4     | Smart Form submitting via V2, E2E passing |
| 5-7   | All agents on V2, lifecycle tests passing |
| 8     | Dual-write removed, V2 sole source        |
| 9     | Deprecation notices in place              |
| 10    | Legacy removed, cleanup complete          |

### Full Migration Complete

- [ ] All submissions through V2
- [ ] All agents reading/writing V2
- [ ] No queries to unified_picks in logs
- [ ] Performance metrics stable
- [ ] Legacy tables archived/dropped

---

## Appendix A: Migration SQL Templates

### Create Table Template

```sql
-- Migration: YYYYMMDDHHMMSS_<description>.sql
-- Sprint: SPRINT-<NAME>-###
-- Rollback: DROP TABLE <table_name>;

CREATE TABLE <table_name> (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- columns
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_<table>_<column> ON <table>(<column>);

-- RLS (if needed)
ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;
CREATE POLICY <policy_name> ON <table_name> ...;
```

### Create View Template

```sql
-- Migration: YYYYMMDDHHMMSS_<description>.sql
-- Sprint: SPRINT-<NAME>-###
-- Rollback: DROP VIEW <view_name>;

CREATE VIEW <view_name> AS
SELECT
    -- columns
FROM <table>
JOIN ...
WHERE ...;

-- Grant access
GRANT SELECT ON <view_name> TO anon, authenticated;
```

### Create RPC Template

```sql
-- Migration: YYYYMMDDHHMMSS_<description>.sql
-- Sprint: SPRINT-<NAME>-###
-- Rollback: DROP FUNCTION <function_name>;

CREATE OR REPLACE FUNCTION <function_name>(
    p_param1 TYPE,
    p_param2 TYPE
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result RECORD;
BEGIN
    -- Implementation

    RETURN jsonb_build_object(
        'success', true,
        'data', v_result
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;

-- Grant execute
GRANT EXECUTE ON FUNCTION <function_name> TO authenticated;
```

---

**Migration Owner**: Engineering Team **Last Updated**: 2026-02-20 **Status**:
DRAFT
