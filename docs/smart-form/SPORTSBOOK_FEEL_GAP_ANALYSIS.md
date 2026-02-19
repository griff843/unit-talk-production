# SPORTSBOOK FEEL GAP ANALYSIS

**Date**: 2026-02-19 **Sprint**: SMARTFORM-CATALOG-PLUMBING-058 **Benchmark**:
DraftKings, FanDuel, BetMGM player prop flows

---

## 1. Executive Summary

The Smart Form has solid architectural foundations but falls short of "elite
sportsbook feel" due to:

1. **Data gaps** - No actual player/prop data flowing through
2. **UX friction** - Manual entry required instead of search-driven selection
3. **Missing conveniences** - No line auto-fill, no recent picks, no favorites

**Current State**: Functional but "amateur grade" **Target State**:
Indistinguishable from professional sportsbook apps

---

## 2. Sportsbook UX Benchmark

### What Elite Apps Do

| Feature            | DraftKings            | FanDuel        | Current Smart Form |
| ------------------ | --------------------- | -------------- | ------------------ |
| Player typeahead   | <100ms, typo-tolerant | <100ms         | ❌ Returns 404     |
| Stat type dropdown | Pre-populated         | Pre-populated  | ❌ Empty/limited   |
| Line auto-fill     | From live odds        | From live odds | ❌ Manual only     |
| Odds display       | -110, +150 format     | Same           | ✅ Works           |
| Bet slip preview   | Real-time             | Real-time      | ⚠️ Static          |
| Recent picks       | Persistent            | Persistent     | ❌ None            |
| Favorites          | Star players          | Star players   | ❌ None            |
| Game context       | Shows matchup         | Shows matchup  | ✅ Basic           |

### The "Magic Moments"

1. **Instant player search**: Type "Jay" → See "Jaylen Brown (BOS)" immediately
2. **Contextual props**: Select Jaylen → See PTS 24.5, AST 5.5, REB 6.5
   automatically
3. **One-tap selection**: Tap "Over 24.5 PTS" → Bet slip updates instantly
4. **Smart defaults**: System knows you usually bet PTS → Pre-selects it

---

## 3. Gap Analysis

### GAP-1: Player Search Broken

**Expected Flow**:

```
User types "brown" → API returns Jaylen Brown, Marcus Smart, etc.
                   → User selects Jaylen Brown
                   → Team auto-locks to "Boston Celtics"
```

**Current Flow**:

```
User types "brown" → 404 error (MV fallback fails on column name)
                   → User must use Manual Mode
                   → No team lock, no validation
```

**Impact**: ⭐⭐⭐⭐⭐ Critical - Core sportsbook feel broken

**Fix**: Update players API fallback to use `full_name`

### GAP-2: Stat Types Empty

**Expected Flow**:

```
Sport = NBA → Dropdown shows: PTS, AST, REB, 3PM, PRA, etc.
            → User selects PTS
            → Line options appear (if props data exists)
```

**Current Flow**:

```
Sport = NBA → Dropdown shows: "rebounds" only (or empty)
            → User confused, switches to Manual Mode
```

**Impact**: ⭐⭐⭐⭐⭐ Critical - Breaks the entire prop selection flow

**Fix**: Create `stat_types` reference table with seed data

### GAP-3: No Line Auto-Fill

**Expected Flow**:

```
Player = Jaylen Brown, Stat = PTS
  → System shows: "24.5 (-110/-110)" as default
  → User can adjust if betting different line
```

**Current Flow**:

```
Player = manual entry, Stat = manual entry
  → Line field is blank
  → User must know the line from elsewhere
```

**Impact**: ⭐⭐⭐⭐ High - Forces users to reference external sources

**Fix**: Populate `raw_props` with live lines OR show "current line unavailable"

### GAP-4: No Props Cascade

**Expected Flow**:

```
Select Jaylen Brown → Props API returns available markets:
  - PTS O/U 24.5
  - AST O/U 5.5
  - REB O/U 6.5
  - 3PM O/U 2.5
→ Stat type dropdown populated with these options
```

**Current Flow**:

```
Select player (manual) → Props API returns empty
                       → Stat type dropdown unchanged
```

**Impact**: ⭐⭐⭐⭐ High - The "smart" in Smart Form doesn't work

**Fix**: Connect sportsbook data feed to populate `raw_props`

### GAP-5: No Team Validation

**Expected Flow**:

```
Select Jaylen Brown → Team auto-locks to "Boston Celtics"
                    → Game dropdown shows only Celtics games
                    → Cannot select invalid team
```

**Current Flow**:

```
Manual player entry → Team field independent
                    → User can select wrong team
                    → No validation until submission
```

**Impact**: ⭐⭐⭐ Medium - Data quality risk

**Fix**: Enforce team-player consistency in cascading filters

### GAP-6: No Recent/Favorites

**Sportsbook Standard**:

```
Header shows: "Recent" | "Favorites" | "Trending"
  → One tap to re-submit similar pick
  → Star icon to save favorite players
```

**Smart Form**:

```
No history
No favorites
Every pick starts from scratch
```

**Impact**: ⭐⭐ Medium - Convenience, not critical

**Fix**: Future sprint - localStorage or user profile

### GAP-7: No Live Odds Badge

**Sportsbook Standard**:

```
Line shows: "24.5" with badge: "LIVE" or "2h ago"
  → User knows if odds are stale
```

**Smart Form**:

```
No freshness indicator
  → User doesn't know line age
```

**Impact**: ⭐⭐ Medium - Trust indicator

**Fix**: Add `updated_at` display from props data

---

## 4. Priority Matrix

| Gap                     | Impact     | Effort | Priority |
| ----------------------- | ---------- | ------ | -------- |
| GAP-1: Player Search    | ⭐⭐⭐⭐⭐ | Low    | **P0**   |
| GAP-2: Stat Types       | ⭐⭐⭐⭐⭐ | Low    | **P0**   |
| GAP-3: Line Auto-Fill   | ⭐⭐⭐⭐   | High   | P1       |
| GAP-4: Props Cascade    | ⭐⭐⭐⭐   | High   | P1       |
| GAP-5: Team Validation  | ⭐⭐⭐     | Medium | P2       |
| GAP-6: Recent/Favorites | ⭐⭐       | Medium | P3       |
| GAP-7: Live Odds Badge  | ⭐⭐       | Low    | P3       |

---

## 5. "Syndicate Level" Checklist

For the Smart Form to be called "syndicate level", it must pass:

### Must Have (MVP)

- [ ] **Instant player search** - <200ms response, typo-tolerant
- [ ] **Complete stat types** - All major props for NBA/NFL/MLB
- [ ] **Team-player lock** - Selecting player locks team
- [ ] **Game-aware** - Shows today's games, filters by sport
- [ ] **Clean submission** - No errors, idempotent

### Should Have (Elite)

- [ ] **Line auto-fill** - Default to current sportsbook lines
- [ ] **Props cascade** - Player → available props dropdown
- [ ] **Odds format toggle** - American/Decimal
- [ ] **Bet slip preview** - Real-time potential payout

### Nice to Have (Premium)

- [ ] **Recent picks** - Quick re-bet
- [ ] **Player favorites** - Starred for quick access
- [ ] **Line freshness** - "Updated 5m ago"
- [ ] **Trending props** - Most popular today

---

## 6. UX Flow Comparison

### Current (Broken) Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Sport & Bet Type                                    │
│ ┌─────────────┐ ┌─────────────┐                             │
│ │ NBA     ▼   │ │ Player Prop │                             │
│ └─────────────┘ └─────────────┘                             │
├─────────────────────────────────────────────────────────────┤
│ Step 2: Player Selection                                    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Search: "jaylen brown"                     [SEARCH]     │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ❌ "No results found" (404 error)                          │
│                                                             │
│ [Switch to Manual Mode]                                     │
├─────────────────────────────────────────────────────────────┤
│ Step 3: Manual Entry (Fallback)                             │
│ ┌─────────────────┐ ┌─────────────────┐                     │
│ │ Player: _______ │ │ Team: _________ │                     │
│ └─────────────────┘ └─────────────────┘                     │
│ ┌─────────────────┐ ┌─────────────────┐                     │
│ │ Stat: rebounds▼ │ │ Line: _________ │ ← Only option!     │
│ └─────────────────┘ └─────────────────┘                     │
└─────────────────────────────────────────────────────────────┘
```

### Target (Sportsbook) Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Sport & Bet Type                                    │
│ ┌─────────────┐ ┌─────────────┐                             │
│ │ NBA     ▼   │ │ Player Prop │                             │
│ └─────────────┘ └─────────────┘                             │
├─────────────────────────────────────────────────────────────┤
│ Step 2: Player Selection                                    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🔍 Search players...                                    │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ Jaylen Brown ─────────────────────────────────────────┐ │
│ │ 🏀 SF | Boston Celtics                                 │ │
│ └────────────────────────────────────────────────────────┘ │
│ ┌─ Jayson Tatum ─────────────────────────────────────────┐ │
│ │ 🏀 SF | Boston Celtics                                 │ │
│ └────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ Step 3: Prop Selection (Auto-populated)                     │
│                                                             │
│ Selected: Jaylen Brown (BOS)                                │
│                                                             │
│ ┌─────────────────┐ ┌─────────────────┐ ┌───────────────┐  │
│ │ PTS      ▼     │ │ Line: 24.5     │ │ O -110 U -110│  │
│ └─────────────────┘ └─────────────────┘ └───────────────┘  │
│                                                             │
│ Available: PTS, REB, AST, 3PM, PRA, STL, BLK               │
│                                                             │
│ ┌───────────────────────────────────────────────────────┐  │
│ │ ✅ Over 24.5 Points (-110)                            │  │
│ └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Technical Debt Blocking Sportsbook Feel

### TD-1: Column Name Mismatch

- **Location**: `apps/smart-form/app/api/catalog/players/route.ts:125`
- **Issue**: Fallback query uses `name` but table has `full_name`
- **Effort**: 10 minutes

### TD-2: No Stat Types Seed Data

- **Location**: Database needs `stat_types` table
- **Issue**: No reference table for valid stat types
- **Effort**: 30 minutes (migration + seed)

### TD-3: raw_props Not Populated

- **Location**: Data pipeline / FeedAgent
- **Issue**: No sportsbook feed connected
- **Effort**: Separate sprint (data ingestion)

### TD-4: MV Refresh Unknown

- **Location**: Supabase cron / manual
- **Issue**: MVs may not be refreshing
- **Effort**: 1 hour (verify + setup cron)

---

## 8. Recommendations

### This Sprint (P0)

1. **Fix players API fallback** - 10 min code change
2. **Create stat_types table** - 30 min migration
3. **Verify MV refresh** - 1 hour ops check
4. **Test player search E2E** - 30 min Playwright

### Next Sprint (P1)

4. **Connect sportsbook data feed** - Multi-day effort
5. **Implement props cascade** - 2-4 hours
6. **Add line auto-fill** - 2-4 hours

### Backlog (P2+)

7. **Team-player validation** - 2 hours
8. **Recent picks localStorage** - 4 hours
9. **Live odds badge** - 2 hours

---

## 9. Success Metrics

| Metric                     | Current   | Target               |
| -------------------------- | --------- | -------------------- |
| Player search success rate | 0% (404s) | 99%+                 |
| Stat types available       | 1         | 8+ per sport         |
| Manual mode fallback rate  | 100%      | <10%                 |
| P95 search latency         | N/A       | <200ms               |
| User-reported UX score     | "Amateur" | "Sportsbook quality" |

---

## 10. Conclusion

**The Smart Form is not "syndicate level" today** due to data gaps, not
architecture flaws.

The fix is surgical:

1. Fix one column name in API
2. Seed one reference table
3. Verify MV refresh is running

With these fixes, the Smart Form will feel significantly better. Full
"sportsbook elite" requires connecting a live data feed (separate sprint).

---

**Assessment Date**: 2026-02-19 **Assessor**: Claude Code **Next Review**: After
SPRINT-SMARTFORM-CATALOG-PLUMBING-058
