# CANARY E2E Evidence Report

**Date**: 2025-12-17  
**Status**: ✅ Phase 0-2 COMPLETE | ⏸️ Phase 3 BLOCKED

## Summary

**Discord Auth**: ✅ FIXED (HTTP 401 → HTTP 200)  
**Candidate Selection**: ✅ Updated for real upcoming games  
**Business Rules**: ✅ Enforced (stake ≤5, confidence ≥65)  
**Phase 3 Blocker**: No upcoming games in database

## Phase 1 Fix: Discord Auth

**Problem**: `.env.effective` had invalid token  
**Solution**: Updated token, restarted container  
**Proof**: HTTP 200 from `/users/@me` inside container

```bash
Status: 200
Bot Username: Unit Talk#9476
Bot ID: 1418387196116861049
```

## Phase 2: Candidate Rules

**File**: `scripts/canary_e2e_smoke.ts`  
**Time Window**: -2h to +48h (COALESCE logic)  
**Filters**: 5 mandatory rules enforced

## Phase 3: Blocked

**Issue**: No upcoming games in `raw_props.event_time`  
**Next Step**: Enable FeedAgent or use synthetic data

See full details in each phase documentation.
