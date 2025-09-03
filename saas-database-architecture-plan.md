# 🏗️ SaaS-Level Database Architecture Plan

## Unit Talk Production Platform

### 📊 EXECUTIVE SUMMARY

**Current State**: 18 tables, 523K+ rows, fragmented architecture **Target
State**: Enterprise-grade, normalized, scalable SaaS database **Priority**: Fix
critical relationships, consolidate redundancy, add missing core tables

---

## 🎯 CORE BUSINESS TABLES (Tier 1 - Critical)

### 1. **USERS & IDENTITY**

```sql
-- Consolidate: user_profiles + cappers → users (single source of truth)
users (PRIMARY)
├── id (UUID, PK)
├── discord_id (TEXT, UNIQUE)
├── username, display_name
├── tier (bronze|silver|gold|platinum|vip|vip_plus)
├── subscription_status (active|inactive|cancelled|trial)
├── subscription_tier (free|premium|vip|enterprise)
├── created_at, updated_at, last_active
├── total_picks, wins, losses, pushes
├── win_rate (computed), roi, units_won
├── streak_current, streak_type
└── metadata (JSONB)

-- Remove: user_profiles, cappers (redundant)
```

### 2. **SPORTS DATA FOUNDATION**

```sql
-- Keep & enhance existing structure
games (EXISTING - 467 rows) ✅
├── Enhanced with timezone support
├── Better relationship to props
└── Live status tracking

teams (EXISTING - 125 rows) ✅
├── Conference, division data
└── Historical performance

players (EXISTING - 6,990 rows) ✅
├── Enhanced with injury status
├── Performance metrics
└── Position-specific data
```

### 3. **PROPS & BETTING DATA**

```sql
-- Keep enhanced raw_props as primary
raw_props (EXISTING - 514,940 rows) ✅
├── Fix: 100% linking to games (currently 0.2%)
├── Add: Enhanced scoring columns (42+ fields)
├── Add: ML features integration
└── Add: Real-time odds tracking

-- Remove: props table (if exists - redundant)
```

### 4. **PICKS CONSOLIDATION**

```sql
-- Consolidate: picks + daily_picks + final_picks → unified_picks
unified_picks (NEW - replaces 3 tables)
├── id (UUID, PK)
├── user_id (FK → users)
├── prop_id (FK → raw_props)
├── game_id (FK → games)
├── pick_type (single|parlay|system)
├── status (pending|won|lost|push|void)
├── confidence (1-10)
├── stake, odds, potential_payout
├── actual_payout, profit_loss
├── placed_at, settled_at
├── analysis, reasoning
├── tier_when_placed
├── settlement_source
└── metadata (JSONB)

-- Migration: Merge data from existing picks tables
-- Remove: picks, daily_picks, final_picks
```

---

## 🤖 AGENT & ML INFRASTRUCTURE (Tier 2 - Core)

### 5. **AGENT MANAGEMENT**

```sql
agents (NEW)
├── id (UUID, PK)
├── name, type, version
├── status (active|inactive|error|maintenance)
├── config (JSONB)
├── last_run, next_run
├── success_rate, error_count
└── performance_metrics (JSONB)

agent_executions (NEW)
├── id (UUID, PK)
├── agent_id (FK → agents)
├── execution_type, status
├── started_at, completed_at, duration
├── input_data, output_data (JSONB)
├── error_details, logs
└── performance_stats (JSONB)

-- Remove: agent_logs (replace with agent_executions)
```

### 6. **ML & ANALYTICS**

```sql
grading_results (NEW - from migration)
├── prop_id (FK → raw_props)
├── final_score, confidence, tier
├── edge_score, kelly_fraction
├── feature_contributions (JSONB)
├── model_version, created_at
└── performance_tracking

ml_features (NEW - from migration)
├── prop_id (FK → raw_props)
├── neural_network_score, ensemble_score
├── feature_weights (JSONB)
├── historical_performance (JSONB)
└── model_metadata

analytics_summary (NEW)
├── date, metric_type
├── user_id (optional FK → users)
├── value, trend, comparison
├── breakdown (JSONB)
└── generated_at
```

---

## 💬 DISCORD & COMMUNICATION (Tier 3 - Platform)

### 7. **DISCORD INTEGRATION**

```sql
discord_guilds (NEW)
├── id (UUID, PK)
├── guild_id (TEXT, Discord ID)
├── name, settings (JSONB)
├── active_channels, bot_permissions
└── created_at, updated_at

discord_threads (NEW)
├── id (UUID, PK)
├── guild_id (FK → discord_guilds)
├── thread_id (TEXT, Discord thread ID)
├── game_id (FK → games)
├── pick_id (FK → unified_picks)
├── status, participant_count
└── metadata (JSONB)

-- Keep: discord_messages, bot_commands (low volume)
```

### 8. **NOTIFICATIONS & ENGAGEMENT**

```sql
notifications (EXISTING - enhance)
├── Add: delivery_status, retry_count
├── Add: user preferences integration
└── Add: analytics tracking

user_preferences (NEW)
├── user_id (FK → users)
├── notification_types (JSONB)
├── timezone, language
├── communication_channels
└── privacy_settings (JSONB)
```

---

## 🎮 GAMIFICATION & ENGAGEMENT (Tier 4 - Growth)

### 9. **CONTESTS & CAMPAIGNS**

```sql
contests (EXISTING - 1 row) ✅
├── Enhanced with leaderboards
├── Prize distribution logic
└── Participation tracking

campaigns (NEW)
├── id (UUID, PK)
├── name, type, status
├── target_audience (JSONB)
├── start_date, end_date
├── success_metrics (JSONB)
└── results (JSONB)

user_achievements (NEW)
├── user_id (FK → users)
├── achievement_type, level
├── earned_at, requirements_met
└── rewards_claimed (JSONB)
```

### 10. **ONBOARDING & SUPPORT**

```sql
-- Keep existing onboarding tables (good structure)
onboarding_config (EXISTING) ✅
onboarding_progress (EXISTING) ✅

coaching_sessions (NEW)
├── user_id (FK → users)
├── coach_id (FK → users)
├── session_type, status
├── scheduled_at, duration
├── notes, feedback (JSONB)
└── outcome_metrics
```

---

## 🔧 SYSTEM & OPERATIONS (Tier 5 - Infrastructure)

### 11. **AUDIT & COMPLIANCE**

```sql
audit_logs (NEW)
├── id (UUID, PK)
├── user_id (FK → users)
├── action, resource_type, resource_id
├── old_values, new_values (JSONB)
├── ip_address, user_agent
├── timestamp, session_id
└── compliance_flags (JSONB)

security_events (NEW)
├── event_type, severity, status
├── user_id (optional FK → users)
├── details (JSONB), ip_address
├── detected_at, resolved_at
└── response_actions (JSONB)
```

### 12. **CONFIGURATION & SETTINGS**

```sql
system_config (NEW)
├── key, value (JSONB), category
├── environment, version
├── created_at, updated_at
├── created_by (FK → users)
└── validation_schema (JSONB)

feature_flags (NEW)
├── flag_name, enabled, rollout_percentage
├── target_users (JSONB)
├── start_date, end_date
└── metrics (JSONB)
```

---

## 🗑️ TABLES TO REMOVE

### **Redundant/Obsolete Tables:**

- ❌ `user_profiles` → Merge into `users`
- ❌ `cappers` → Merge into `users`
- ❌ `picks` → Merge into `unified_picks`
- ❌ `daily_picks` → Merge into `unified_picks`
- ❌ `final_picks` → Merge into `unified_picks`
- ❌ `props` → Use `raw_props` only
- ❌ `agent_logs` → Replace with `agent_executions`

### **Empty/Unused Tables:**

- ❌ `analytics_events` (0 rows) → Replace with `analytics_summary`
- ❌ `notifications` (0 rows) → Rebuild with better structure

---

## 🔗 CRITICAL RELATIONSHIPS

### **Primary Foreign Keys:**

```sql
-- User-centric relationships
unified_picks.user_id → users.id
user_preferences.user_id → users.id
audit_logs.user_id → users.id

-- Sports data relationships
raw_props.game_id → games.id (FIX: 0.2% → 100%)
unified_picks.prop_id → raw_props.id
unified_picks.game_id → games.id

-- ML & Analytics
grading_results.prop_id → raw_props.id
ml_features.prop_id → raw_props.id

-- Discord integration
discord_threads.game_id → games.id
discord_threads.pick_id → unified_picks.id
```

---

## 📈 PERFORMANCE OPTIMIZATION

### **Critical Indexes:**

```sql
-- User lookups
CREATE INDEX idx_users_discord_id ON users(discord_id);
CREATE INDEX idx_users_tier_status ON users(tier, subscription_status);

-- Props performance
CREATE INDEX idx_raw_props_game_id ON raw_props(game_id);
CREATE INDEX idx_raw_props_expected_value ON raw_props(expected_value);
CREATE INDEX idx_raw_props_tier ON raw_props(tier);

-- Picks analytics
CREATE INDEX idx_unified_picks_user_status ON unified_picks(user_id, status);
CREATE INDEX idx_unified_picks_placed_at ON unified_picks(placed_at);

-- ML features
CREATE INDEX idx_grading_results_tier ON grading_results(tier, confidence);
```

---

## 🎯 MIGRATION STRATEGY

### **Phase 1: Critical Fixes (Week 1)**

1. Fix props-games relationship (0.2% → 100%)
2. Add enhanced scoring columns to raw_props
3. Create unified_picks table structure

### **Phase 2: Consolidation (Week 2)**

1. Migrate data from picks tables to unified_picks
2. Merge user_profiles + cappers → users
3. Remove redundant tables

### **Phase 3: Enhancement (Week 3)**

1. Add ML infrastructure (grading_results, ml_features)
2. Implement agent management system
3. Create analytics framework

### **Phase 4: Platform Features (Week 4)**

1. Discord integration tables
2. Audit & compliance system
3. Performance optimization

---

## 🏆 SUCCESS METRICS

### **Database Health KPIs:**

- **Relationship Integrity**: 100% (currently 0.2%)
- **Query Performance**: <100ms average
- **Data Consistency**: 99.9%
- **Storage Efficiency**: 30% reduction through consolidation
- **Scalability**: Support 10M+ props, 100K+ users

### **Business Impact:**

- **Faster prop loading**: 5x improvement
- **Better user experience**: Unified data model
- **ML readiness**: Advanced scoring capabilities
- **Compliance ready**: Full audit trails
- **Discord integration**: Seamless bot operations

This architecture transforms your database from a fragmented collection into a
enterprise-grade SaaS platform foundation.
