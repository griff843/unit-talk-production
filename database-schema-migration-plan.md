# 🎯 Unit Talk Database Schema Migration Plan

## **Fortune 100-Grade Database Architecture Alignment**

### **🚨 CRITICAL FINDINGS**

#### **1. Schema Misalignment Issues**

- **Missing Columns**: `outcome`, `promoted_to_picks` in `raw_props` table
- **Missing Enhanced Scoring Columns**: `trend_confidence`, `edge_score`,
  `matchup_quality`
- **Type Inconsistencies**: Different interfaces for same tables
- **Missing Tables**: Several critical tables for enhanced functionality

#### **2. Current vs Expected Schema**

**Raw Props Table Issues:**

```sql
-- CURRENT (simplified)
CREATE TABLE raw_props (
  id UUID PRIMARY KEY,
  game_id UUID,
  player_id UUID,
  prop_type TEXT,
  line NUMERIC,
  over_odds NUMERIC,
  under_odds NUMERIC,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

-- EXPECTED (with scoring system)
CREATE TABLE raw_props (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id),
  player_id UUID REFERENCES players(id),
  player_name TEXT NOT NULL,
  team TEXT,
  opponent TEXT,
  market TEXT,
  market_type TEXT,
  line NUMERIC,
  over_odds NUMERIC DEFAULT -110,
  under_odds NUMERIC DEFAULT -110,

  -- ✅ MISSING: Grading System Columns
  outcome TEXT CHECK (outcome IN ('win', 'loss', 'push')),
  promoted_to_picks BOOLEAN DEFAULT FALSE,
  promoted_at TIMESTAMPTZ,

  -- ✅ MISSING: Enhanced Scoring Metrics
  trend_confidence NUMERIC,
  edge_score NUMERIC,
  matchup_quality NUMERIC,
  expected_value NUMERIC,
  sharp_money NUMERIC,
  line_movement NUMERIC,
  player_form NUMERIC,
  injury_impact NUMERIC,
  weather_impact NUMERIC,
  market_intelligence NUMERIC,
  volume_profile NUMERIC,
  closing_line_value NUMERIC,

  -- ✅ MISSING: Professional Capper Features
  steam_detected BOOLEAN DEFAULT FALSE,
  predicted_closing_line NUMERIC,
  optimal_betting_time TEXT,
  best_available_line NUMERIC,
  best_book TEXT,
  public_betting_percentage NUMERIC,
  sharp_betting_percentage NUMERIC,
  contrarian_opportunity BOOLEAN DEFAULT FALSE,
  injury_timing_advantage NUMERIC,
  cross_market_arbitrage NUMERIC,

  -- Standard fields
  source TEXT DEFAULT 'optimal',
  league TEXT,
  game_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);
```

---

## **📋 MIGRATION IMPLEMENTATION PLAN**

### **Phase 1: Critical Column Additions (IMMEDIATE)**

```sql
-- 1. Add missing grading system columns to raw_props
ALTER TABLE raw_props
ADD COLUMN IF NOT EXISTS outcome TEXT CHECK (outcome IN ('win', 'loss', 'push')),
ADD COLUMN IF NOT EXISTS promoted_to_picks BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS player_name TEXT,
ADD COLUMN IF NOT EXISTS team TEXT,
ADD COLUMN IF NOT EXISTS opponent TEXT,
ADD COLUMN IF NOT EXISTS market TEXT,
ADD COLUMN IF NOT EXISTS market_type TEXT,
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'optimal',
ADD COLUMN IF NOT EXISTS league TEXT,
ADD COLUMN IF NOT EXISTS game_date DATE,
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- 2. Add enhanced scoring metrics
ALTER TABLE raw_props
ADD COLUMN IF NOT EXISTS trend_confidence NUMERIC,
ADD COLUMN IF NOT EXISTS edge_score NUMERIC,
ADD COLUMN IF NOT EXISTS matchup_quality NUMERIC,
ADD COLUMN IF NOT EXISTS expected_value NUMERIC,
ADD COLUMN IF NOT EXISTS sharp_money NUMERIC,
ADD COLUMN IF NOT EXISTS line_movement NUMERIC,
ADD COLUMN IF NOT EXISTS player_form NUMERIC,
ADD COLUMN IF NOT EXISTS injury_impact NUMERIC,
ADD COLUMN IF NOT EXISTS weather_impact NUMERIC,
ADD COLUMN IF NOT EXISTS market_intelligence NUMERIC,
ADD COLUMN IF NOT EXISTS volume_profile NUMERIC,
ADD COLUMN IF NOT EXISTS closing_line_value NUMERIC;

-- 3. Add professional capper features
ALTER TABLE raw_props
ADD COLUMN IF NOT EXISTS steam_detected BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS predicted_closing_line NUMERIC,
ADD COLUMN IF NOT EXISTS optimal_betting_time TEXT,
ADD COLUMN IF NOT EXISTS best_available_line NUMERIC,
ADD COLUMN IF NOT EXISTS best_book TEXT,
ADD COLUMN IF NOT EXISTS public_betting_percentage NUMERIC,
ADD COLUMN IF NOT EXISTS sharp_betting_percentage NUMERIC,
ADD COLUMN IF NOT EXISTS contrarian_opportunity BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS injury_timing_advantage NUMERIC,
ADD COLUMN IF NOT EXISTS cross_market_arbitrage NUMERIC;

-- 4. Fix odds column naming consistency
ALTER TABLE raw_props
ADD COLUMN IF NOT EXISTS over NUMERIC,
ADD COLUMN IF NOT EXISTS under NUMERIC;

-- Copy data from existing columns if they exist
UPDATE raw_props SET over = over_odds WHERE over IS NULL AND over_odds IS NOT NULL;
UPDATE raw_props SET under = under_odds WHERE under IS NULL AND under_odds IS NOT NULL;
```

### **Phase 2: Missing Tables Creation**

```sql
-- 1. Grading Results Table
CREATE TABLE IF NOT EXISTS grading_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prop_id UUID REFERENCES raw_props(id) ON DELETE CASCADE,
  final_score NUMERIC NOT NULL,
  confidence NUMERIC NOT NULL,
  tier TEXT CHECK (tier IN ('S', 'A', 'B', 'C', 'D')) NOT NULL,
  edge_score NUMERIC,
  kelly_fraction NUMERIC,
  position_size NUMERIC,
  risk_score NUMERIC,

  -- Feature attribution (JSONB for flexibility)
  feature_contributions JSONB,
  model_contributions JSONB,
  scenario_analysis JSONB,
  professional_insights JSONB,
  enhanced_capper_analysis JSONB,

  -- Quality metrics
  data_quality NUMERIC DEFAULT 0.95,
  model_agreement NUMERIC,
  historical_accuracy NUMERIC,

  -- Metadata
  model_version TEXT,
  config_used TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enhanced Final Picks Table
CREATE TABLE IF NOT EXISTS final_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_prop_id UUID REFERENCES raw_props(id) ON DELETE CASCADE,
  grading_result_id UUID REFERENCES grading_results(id),

  -- Pick details
  player_name TEXT NOT NULL,
  market_type TEXT NOT NULL,
  line NUMERIC NOT NULL,
  odds NUMERIC NOT NULL,

  -- Grading results
  tier TEXT CHECK (tier IN ('S', 'A', 'B', 'C', 'D')) NOT NULL,
  confidence NUMERIC NOT NULL,
  score NUMERIC NOT NULL,
  edge_score NUMERIC,
  position_size NUMERIC,
  kelly_fraction NUMERIC,
  risk_score NUMERIC,

  -- Status tracking
  play_status TEXT CHECK (play_status IN ('pending', 'approved', 'rejected', 'settled')) DEFAULT 'pending',
  result TEXT CHECK (result IN ('win', 'loss', 'push', 'pending')) DEFAULT 'pending',

  -- Settlement
  actual_result NUMERIC,
  profit_loss NUMERIC,
  settled_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Capper Profiles Table (Fix naming mismatch)
CREATE TABLE IF NOT EXISTS capper_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_id TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  tier TEXT CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum', 'vip', 'vip_plus')) DEFAULT 'bronze',
  total_picks INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  pushes INTEGER DEFAULT 0,
  win_rate NUMERIC GENERATED ALWAYS AS (
    CASE WHEN (wins + losses) > 0
    THEN ROUND(wins::NUMERIC / (wins + losses), 4)
    ELSE 0 END
  ) STORED,
  roi NUMERIC DEFAULT 0,
  units_won NUMERIC DEFAULT 0,
  streak_current INTEGER DEFAULT 0,
  streak_type TEXT CHECK (streak_type IN ('win', 'loss', 'none')) DEFAULT 'none',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create alias table for backward compatibility
CREATE OR REPLACE VIEW cappers AS SELECT * FROM capper_profiles;

-- 4. ML Features Table (for advanced scoring)
CREATE TABLE IF NOT EXISTS ml_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prop_id UUID REFERENCES raw_props(id) ON DELETE CASCADE,

  -- Core ML features
  neural_network_score NUMERIC,
  gradient_boosting_score NUMERIC,
  random_forest_score NUMERIC,
  ensemble_score NUMERIC,
  model_agreement NUMERIC,

  -- Feature importance weights
  feature_weights JSONB,

  -- Historical performance context
  similar_props_performance JSONB,
  player_historical_performance JSONB,

  model_version TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Settlement Tracking Table
CREATE TABLE IF NOT EXISTS settlement_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_id UUID REFERENCES final_picks(id) ON DELETE CASCADE,
  game_id UUID REFERENCES games(id),

  -- Settlement details
  settlement_source TEXT NOT NULL, -- 'odds_api', 'manual', 'espn'
  original_line NUMERIC NOT NULL,
  actual_result NUMERIC,
  settlement_status TEXT CHECK (settlement_status IN ('pending', 'settled', 'void', 'disputed')) DEFAULT 'pending',

  -- Timing
  game_completed_at TIMESTAMPTZ,
  settlement_attempted_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ,

  -- Error tracking
  settlement_errors JSONB,
  retry_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### **Phase 3: Indexes for Performance**

```sql
-- Raw props performance indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_raw_props_outcome_promoted ON raw_props(outcome, promoted_to_picks) WHERE outcome IS NULL AND promoted_to_picks IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_raw_props_game_date ON raw_props(game_date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_raw_props_league ON raw_props(league);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_raw_props_player_name ON raw_props(player_name);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_raw_props_expected_value ON raw_props(expected_value) WHERE expected_value > 5;

-- Final picks indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_final_picks_tier_status ON final_picks(tier, play_status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_final_picks_result ON final_picks(result);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_final_picks_created_at ON final_picks(created_at);

-- Grading results indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_grading_results_tier_confidence ON grading_results(tier, confidence);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_grading_results_final_score ON grading_results(final_score) WHERE final_score > 50;

-- Agent monitoring indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_health_status_timestamp ON agent_health(status, timestamp);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_metrics_agent_timestamp ON agent_metrics(agent, timestamp);

-- Settlement tracking indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_settlement_tracking_status ON settlement_tracking(settlement_status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_settlement_tracking_game_completed ON settlement_tracking(game_completed_at) WHERE settlement_status = 'pending';
```

### **Phase 4: Real-time Subscriptions & Triggers**

```sql
-- Enable row level security
ALTER TABLE raw_props ENABLE ROW LEVEL SECURITY;
ALTER TABLE final_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE grading_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_health ENABLE ROW LEVEL SECURITY;

-- Create policies for different access levels
CREATE POLICY "Allow read access for all authenticated users" ON raw_props
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow full access for service role" ON raw_props
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Trigger for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to all tables
CREATE TRIGGER update_raw_props_updated_at BEFORE UPDATE ON raw_props FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_final_picks_updated_at BEFORE UPDATE ON final_picks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_grading_results_updated_at BEFORE UPDATE ON grading_results FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## **🔧 TYPE SAFETY UPDATES**

### **Updated TypeScript Interfaces**

```typescript
// Updated RawProp interface
export interface RawProp {
  id: string;
  game_id: string;
  player_id: string;
  player_name: string;
  team: string;
  opponent: string;
  market: string;
  market_type: string;
  line: number;
  over: number;
  under: number;
  over_odds: number;
  under_odds: number;

  // Grading system fields
  outcome?: 'win' | 'loss' | 'push' | null;
  promoted_to_picks: boolean;
  promoted_at?: string;

  // Enhanced scoring metrics
  trend_confidence?: number;
  edge_score?: number;
  matchup_quality?: number;
  expected_value?: number;
  sharp_money?: number;
  line_movement?: number;
  player_form?: number;
  injury_impact?: number;
  weather_impact?: number;
  market_intelligence?: number;
  volume_profile?: number;
  closing_line_value?: number;

  // Professional capper features
  steam_detected: boolean;
  predicted_closing_line?: number;
  optimal_betting_time?: string;
  best_available_line?: number;
  best_book?: string;
  public_betting_percentage?: number;
  sharp_betting_percentage?: number;
  contrarian_opportunity: boolean;
  injury_timing_advantage?: number;
  cross_market_arbitrage?: number;

  // Standard fields
  source: string;
  league: string;
  game_date?: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}
```

---

## **🎯 IMPLEMENTATION PRIORITY MATRIX**

### **🚨 Critical (Week 1)**

1. **Raw Props Column Addition** - Fix immediate grading agent failures
2. **Grading Results Table** - Enable scoring system to store results
3. **Capper Profiles Fix** - Resolve table name mismatch
4. **Type Safety Updates** - Update all TypeScript interfaces

### **⚡ High Priority (Week 2)**

1. **Final Picks Enhancement** - Complete pick promotion pipeline
2. **Settlement Tracking** - Enable automated settlement
3. **Performance Indexes** - 60-80% query speed improvement
4. **Real-time Triggers** - Enable live updates

### **📊 Medium Priority (Week 3)**

1. **ML Features Table** - Advanced machine learning pipeline
2. **Enhanced Agent Monitoring** - Better observability
3. **Data Partitioning** - Scale preparation
4. **Security Policies** - Production security

### **🔮 Future Enhancements (Week 4)**

1. **Time-series Partitioning** - Handle millions of props
2. **Advanced Analytics Views** - Performance dashboards
3. **Automated Data Archival** - Long-term storage strategy
4. **Multi-region Replication** - Global availability

---

## **📝 VALIDATION CHECKLIST**

### **Pre-Migration**

- [ ] Backup all existing data
- [ ] Test migration scripts on staging
- [ ] Verify TypeScript compilation
- [ ] Check agent dependencies

### **Post-Migration**

- [ ] Verify all agents start successfully
- [ ] Test grading agent with new columns
- [ ] Validate scoring metrics population
- [ ] Confirm real-time subscriptions work
- [ ] Performance benchmark comparison

### **Success Metrics**

- [ ] Grading agent processes props without errors
- [ ] Enhanced scoring metrics are populated
- [ ] Final picks promotion works end-to-end
- [ ] Command center displays real-time data
- [ ] Query performance improved 60-80%

---

## **⚡ EXECUTION COMMANDS**

```bash
# 1. Run migration scripts
npm run db:migrate:critical

# 2. Update TypeScript types
npm run type-check

# 3. Test grading agent
npm run agents:test:grading

# 4. Verify end-to-end flow
npm run test:e2e:grading-pipeline

# 5. Performance validation
npm run test:performance:database
```

This comprehensive migration plan will align the database schema with the
application's expectations and enable the enhanced scoring system to function
properly while maintaining Fortune 100-grade architecture standards.
