# Unit Talk Production Database Schema - Command Center

**Last Updated**: 2025-08-04  
**Database**: Supabase PostgreSQL (lxqmuzmqtnnlpfapvief.supabase.co)  
**Status**: ✅ PRODUCTION READY with 514,940+ raw props

## 🎯 Key Tables for Command Center

### `games` Table ✅ (467 records)

```sql
CREATE TABLE games (
  id UUID PRIMARY KEY,
  game_id UUID,
  sport TEXT,
  season TEXT,
  date TIMESTAMPTZ,
  start_time TIMESTAMPTZ,
  status TEXT,
  home_team TEXT,
  away_team TEXT,
  home_score INTEGER,
  away_score INTEGER,
  venue TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  -- Additional columns
  matchup TEXT,
  game_date DATE,
  event_id UUID,
  source TEXT,
  home_odds INTEGER,
  away_odds INTEGER,
  spread DECIMAL,
  total DECIMAL,
  commence_time TIMESTAMPTZ,
  sport_key TEXT,
  source_event_id TEXT,
  external_id TEXT,
  league TEXT,
  home_team_meta JSONB,
  away_team_meta JSONB,
  external_game_id TEXT,
  moneyline_home TEXT,
  moneyline_away TEXT,
  total_under_odds TEXT,
  spread_odds TEXT,
  total_over_odds TEXT
);
```

### `players` Table ✅ (6,990 records)

```sql
CREATE TABLE players (
  id INTEGER PRIMARY KEY,
  player_name TEXT,
  sport TEXT,
  team TEXT,
  team_id UUID,
  player_id TEXT,
  photo_url TEXT,
  position TEXT,
  status TEXT,
  is_injured BOOLEAN,
  jersey_number INTEGER,
  nationality TEXT,
  team_name TEXT,
  player_slug TEXT,
  height_cm INTEGER,
  weight_kg INTEGER,
  birthday DATE
);
```

### `raw_props` Table ✅ (514,940 records) - **CRITICAL FOR COMMAND CENTER**

```sql
CREATE TABLE raw_props (
  id UUID PRIMARY KEY,

  -- Core Prop Information
  player_name TEXT,
  sport TEXT,
  team TEXT,
  stat_type TEXT,  -- 🔥 KEY: This is NOT prop_type!
  outcome TEXT,
  line DECIMAL,
  odds DECIMAL,
  over_odds DECIMAL,  -- Available
  under_odds DECIMAL, -- Available

  -- Game Information
  game_date DATE,
  matchup TEXT,
  game_id UUID,
  external_game_id TEXT,
  sport_key TEXT,
  league TEXT,
  opponent TEXT,
  start_time TIMESTAMPTZ,
  game_time TIMESTAMPTZ,
  home_team TEXT,
  home_team_id UUID,
  away_team TEXT,
  away_team_id UUID,

  -- Player Information
  player_id TEXT,
  player_slug TEXT,

  -- Scoring and Analytics (63+ columns)
  trend_confidence DECIMAL,
  matchup_quality DECIMAL,
  line_value_score DECIMAL,
  role_stability DECIMAL,
  confidence_score DECIMAL,
  edge_score DECIMAL,
  expected_value DECIMAL,
  sharp_money DECIMAL,
  line_movement DECIMAL,
  player_form DECIMAL,
  injury_impact DECIMAL,
  weather_impact DECIMAL,
  market_intelligence DECIMAL,
  volume_profile DECIMAL,
  closing_line_value DECIMAL,

  -- Additional Analytics
  trend_score DECIMAL,
  matchup_score DECIMAL,
  line_score DECIMAL,
  role_score DECIMAL,
  ev_percent DECIMAL,
  steam_detected BOOLEAN,
  best_available_line DECIMAL,
  best_book TEXT,
  public_betting_percentage DECIMAL,
  sharp_betting_percentage DECIMAL,
  volatility DECIMAL,
  correlation_risk DECIMAL,
  bid_ask_spread DECIMAL,
  predicted_closing_line DECIMAL,
  optimal_betting_time TIMESTAMPTZ,
  contrarian_opportunity BOOLEAN,
  injury_timing_advantage DECIMAL,
  cross_market_arbitrage DECIMAL,
  player_fatigue DECIMAL,
  venue_advantage DECIMAL,
  referee_impact DECIMAL,
  pace_impact DECIMAL,
  motivational_factors DECIMAL,
  data_completeness DECIMAL,
  outlier_score DECIMAL,
  consistency_score DECIMAL,
  data_validation_score DECIMAL,
  portfolio_impact DECIMAL,

  -- Metadata
  metadata JSONB,
  tier_tag TEXT,
  auto_approved BOOLEAN,
  context_flag BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  source TEXT,
  promoted_to_picks BOOLEAN,
  promoted_at TIMESTAMPTZ,
  promoted BOOLEAN,
  is_promoted BOOLEAN,
  unit_size DECIMAL,
  tier TEXT,
  direction TEXT,
  unique_key TEXT,
  event_id UUID,
  book TEXT,
  is_alt_line BOOLEAN,
  is_primary BOOLEAN,
  is_valid BOOLEAN,
  external_id UUID,
  market TEXT,
  provider TEXT,
  scraped_at TIMESTAMPTZ,
  fair_odds TEXT,
  bet_type TEXT,
  market_type TEXT,
  outcomes JSONB,
  over DECIMAL,
  under DECIMAL,
  confidence DECIMAL
);
```

## 🚨 CRITICAL MAPPING FOR COMMAND CENTER

### Column Name Corrections

| ❌ OLD (v2.x)  | ✅ NEW (v3.0 Production) | Usage                                               |
| -------------- | ------------------------ | --------------------------------------------------- |
| `prop_type`    | `stat_type`              | Type of proposition (e.g., "hitsRunsRbi", "Points") |
| `players.name` | `players.player_name`    | Player's display name                               |

### Required Views for Command Center

#### `daily_picks` View ✅ (Maps to `unified_picks` - v3.0.0)

```sql
CREATE VIEW daily_picks AS
SELECT
    id,
    user_id,
    prop_id,
    game_id,
    -- Map selection to prediction (Command Center expects 'prediction' column)
    CASE
        WHEN LOWER(selection) LIKE '%over%' THEN 'over'
        WHEN LOWER(selection) LIKE '%under%' THEN 'under'
        ELSE 'over'  -- Default fallback
    END as prediction,
    confidence,
    -- v3.0.0 Schema: Use published instead of auto_approved
    published,
    -- v3.0.0 Schema: Use grading_status instead of is_graded
    grading_status,
    -- Professional grading columns (v3.0.0)
    professional_score,
    devigged_edge,
    kelly_fraction,
    clv_pct,
    -- Map workflow_stage to status for Command Center compatibility
    CASE
        WHEN workflow_stage = 'approved' THEN 'approved'
        WHEN workflow_stage = 'published' THEN 'approved'
        WHEN workflow_stage = 'pending_review' THEN 'pending'
        ELSE 'pending'
    END as status,
    created_at,
    updated_at
FROM unified_picks;
```

### `raw_props` Table v3.0.0 Updates ✅

**Processing Gate Change**: 
- OLD: `processed` (boolean)
- NEW: `processed_at` (timestamp) - more precise processing tracking

## 🔧 Command Center Database Queries

### Working Queries ✅

```sql
-- Get raw props (514,940 records available)
SELECT id, stat_type, created_at
FROM raw_props
ORDER BY created_at DESC
LIMIT 500;

-- Get games (467 records available)
SELECT id, league, home_team, away_team
FROM games
ORDER BY created_at DESC;

-- Get players (6,990 records available)
SELECT id, player_name, sport, team
FROM players
LIMIT 100;
```

### Failing Tables ❌

- `props` - Does not exist (use `raw_props` instead)
- `events` - Does not exist (use `games` instead)

## 🎯 Command Center Integration Points

### supabase.ts Fixes Applied ✅

```typescript
// ✅ Correct column names
.select(`
  *,
  raw_props (
    stat_type,    // NOT prop_type
    line,
    over_odds,
    under_odds,
    games (
      league,
      home_team,
      away_team,
      start_time
    ),
    players (
      player_name,  // NOT name
      position
    )
  )
`)
```

## 📊 Production Data Status

**Real Production Data Available**:

- ✅ **514,940 raw_props** - Live betting propositions
- ✅ **6,990 players** - Player database
- ✅ **467 games** - Game schedules and results
- ❌ **0 unified_picks** - Needs v3.0.0 compatibility view
- ❌ **0 daily_picks** - Needs compatibility view creation

## 🚀 Next Steps for Full Production

1. **Run SQL Script**: Execute `fix-v3-compatibility-views.sql` in Supabase
2. **Verify Data**: Confirm `daily_picks` view returns data
3. **Test Command Center**: Refresh and verify real data appears
4. **Validate Buttons**: Ensure all approval/control buttons work

---

**Schema Verified**: 2025-08-04 via production database query  
**Status**: Ready for v3.0.0 compatibility deployment
