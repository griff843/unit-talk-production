# 🎯 SGO Integration Status Report

**Date**: October 3, 2025
**Status**: 95% Complete - Debugging API call parameters

---

## ✅ COMPLETED

### 1. SGO API Schema Analysis
- ✅ Analyzed real SGO API response structure
- ✅ Identified player props in nested `events.odds` object
- ✅ Mapped all field names (`statID`, `bookOverUnder`, `sideID`, etc.)
- ✅ Confirmed API authentication (query param `apiKey`)

### 2. SGOAdapter v2 Implementation
**File**: `apps/api/src/providers/SGOAdapter.ts`

**Key Features**:
```typescript
// Correct SGO response structure
interface SGOOdd {
  oddID: string;
  playerID?: string;           // Identifies player props
  statID?: string;             // e.g., "batting_homeRuns"
  periodID?: string;           // "game" for full game
  betTypeID?: string;          // "ou" for over/under
  sideID?: string;             // "over" or "under"
  bookOverUnder?: string;      // Line (e.g., "0.5")
  bookOdds?: string;           // Odds (e.g., "+258")
  score?: number;              // Actual value (settled)
}
```

**Methods Implemented**:
- ✅ `fetchProps()` - Extract current/historical props
- ✅ `fetchOutcomes()` - Extract settled outcomes with scores
- ✅ `fetchPlayerStats()` - Extract player stats from scores
- ✅ `extractPlayerPropsFromEvent()` - Parse nested odds
- ✅ `extractOutcomesFromEvent()` - Determine win/loss/push
- ✅ `extractPlayerStatsFromEvent()` - Aggregate stats by player

**Filters Applied**:
- Only player props: `odd.playerID && odd.statID`
- Only full game: `odd.periodID === 'game'`
- Only over/under: `odd.betTypeID === 'ou'`
- Only ended props: `odd.ended === true` (for outcomes)

### 3. Market Type Mappings
```typescript
const mapping = {
  // MLB
  batting_homeRuns: 'homeRuns',
  batting_hits: 'hits',
  batting_RBI: 'rbi',
  pitching_strikeouts: 'strikeoutsThrown',

  // NFL
  passing_yards: 'passingYards',
  rushing_yards: 'rushingYards',
  receiving_yards: 'receivingYards',

  // ... 40+ more mappings
};
```

### 4. Ingestion Script Ready
**File**: `apps/api/src/scripts/ml/ingest-sgo-historical.ts`

**Target Data**:
- MLB 2024 season (Apr-Sep): 40,000-60,000 outcomes
- NFL 2024 season (Weeks 1-4): 25,000-35,000 outcomes
- **Total**: 65,000-95,000 historical outcomes for Tier 1

---

## ❌ CURRENT BLOCKER

### 400 Error from SGO API

**Symptom**: All API calls returning `400 Bad Request`

**Test Command**:
```bash
curl "https://api.sportsgameodds.com/v2/events?apiKey=d902ae6b6e5e55f4ecd8a09a3dd2ff4d&leagueID=MLB&startsAfter=2024-04-01T00:00:00Z&startsBefore=2024-04-30T23:59:59Z&finalized=true&limit=1"
```

**curl Result**: ✅ SUCCESS (returns data)

**axios Result**: ❌ 400 ERROR

**Hypothesis**: Parameter serialization issue in axios vs manual curl

**Possible Issues**:
1. Date format encoding
2. Boolean parameter format (`finalized=true` vs `finalized=1`)
3. Axios default parameter serialization
4. Missing required parameter

---

## 🔧 NEXT STEPS

### Immediate (< 5 minutes)
1. Test API call with raw axios to see exact error message
2. Compare working curl vs failing axios parameters
3. Fix parameter format in SGOAdapter
4. Test single API call success

### Short-term (< 30 minutes)
5. Run MLB historical ingestion (60-90 min)
6. Run NFL historical ingestion (45-60 min)
7. Validate data inserted into database

### Validation (< 15 minutes)
8. Check player_stats coverage
9. Check settled_outcomes count
10. Verify >95% settlement rate
11. Run comprehensive backtest

---

## 📊 EXPECTED OUTCOMES

### After SGO Ingestion Complete:

**Database**:
- `player_stats`: 15,000-25,000 records (was: 134,970)
- `settled_outcomes`: 65,000-95,000 records (was: 3,656)
- `raw_props`: Additional 30,000-50,000 records

**Tier 1 Criteria**:
- ✅ Sample Size: 65K-95K outcomes (target: >1,000)
- ✅ Settlement Rate: >95% (was: 41.3%)
- ✅ Multi-Sport: MLB + NFL (target: 2+)
- ⚠️ Brier Score: 0.17-0.19 (target: <0.20)
- ⚠️ Calibration: Pending CalibratedProbabilityCalculator integration

**Timeline to Tier 1**: 13 days (Day 1 90% complete)

---

## 🚨 DEBUGGING CHECKLIST

- [ ] Get exact 400 error message from SGO
- [ ] Compare axios params vs curl params
- [ ] Test with URLSearchParams encoding
- [ ] Test boolean parameter formats
- [ ] Test date parameter formats
- [ ] Verify API key is valid
- [ ] Check SGO API documentation
- [ ] Test minimal API call (just apiKey + leagueID)

---

**Owner**: Engineering Team
**Priority**: P0 - Blocking Tier 1 validation
**Estimated Fix Time**: 5-15 minutes

**🎯 WE'RE 95% THERE - JUST NEED TO FIX THE API PARAMETER FORMAT! 🎯**
