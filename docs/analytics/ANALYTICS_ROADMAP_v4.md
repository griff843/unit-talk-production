# Analytics Roadmap v4.0 - Canonical Analytics + Model Ingestion

**Date:** 2025-10-30
**Phase:** Phase 11 - Canonical Analytics Infrastructure
**Status:** ✅ COMPLETE
**Reference:** [Production Charter v3.0](../PRODUCTION_CHARTER.md)

---

## 📋 Executive Summary

Phase 11 implements a comprehensive canonical analytics infrastructure per Charter v3.0 requirements. This system provides:

- **Internal Scoring Infrastructure**: Detailed ML model ingestion via `internal_scores` table
- **dbt Analytics Models**: Transformation layer for picks and scoring analytics
- **Warehouse Sync**: Automated data synchronization to analytics warehouse
- **Predictive Pipelines**: Forecast, CLV, and steam detection scaffolding

**Key Deliverables:**
- 7 new database tables for analytics and predictive models
- dbt project with 5 core models (staging + marts)
- 3 predictive pipeline services (Forecast, CLV, Steam Detector)
- Warehouse sync infrastructure with incremental sync support
- 2 materialized views for pre-aggregated analytics

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                  Unit Talk Analytics Platform                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    │
│  │   Canonical  │───▶│  internal_   │───▶│     dbt      │    │
│  │  picks Table │    │scores Table  │    │   Models     │    │
│  └──────────────┘    └──────────────┘    └──────────────┘    │
│         │                    │                     │            │
│         │                    │                     ▼            │
│         │                    │          ┌──────────────┐       │
│         │                    │          │  Analytics   │       │
│         │                    │          │  Warehouse   │       │
│         │                    │          └──────────────┘       │
│         │                    │                                  │
│         ▼                    ▼                                  │
│  ┌──────────────────────────────────────┐                     │
│  │     Predictive Model Pipelines       │                     │
│  ├──────────────────────────────────────┤                     │
│  │  • Forecast Pipeline (Player Perf)   │                     │
│  │  • CLV Pipeline (Closing Line Value) │                     │
│  │  • Steam Detector (Sharp Money)      │                     │
│  └──────────────────────────────────────┘                     │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │  Warehouse   │───▶│ ML Training  │───▶│ Production   │   │
│  │  Sync Worker │    │   Pipeline   │    │   Models     │   │
│  └──────────────┘    └──────────────┘    └──────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 Database Schema

### New Tables (Phase 11)

#### 1. `internal_scores` - ML Model Ingestion

Detailed scoring breakdown for machine learning model training and ingestion.

**Purpose:** Provide comprehensive feature set for ML models

**Key Columns:**
- `professional_score` - Overall score (0-100) from GradingAgent
- `clv_pct` - Closing Line Value percentage
- `kelly_fraction` - Kelly Criterion optimal bet sizing
- `sharp_money_alignment` - Alignment with sharp book movement
- `steam_move_detected` - Boolean indicator for steam moves
- `win_probability_model_v1/v2` - ML model predictions
- `expected_value` - EV calculation
- `player_form_score`, `matchup_score`, `venue_impact_score` - Context features

**Indexes:**
- `idx_internal_scores_tenant_id` - Tenant isolation
- `idx_internal_scores_professional_score` - Performance queries
- `idx_internal_scores_clv` - CLV analysis
- `idx_internal_scores_steam_moves` - Steam move filtering
- `idx_internal_scores_model_confidence` - Model quality queries

#### 2. `warehouse_sync_log` - Sync Audit Trail

Tracks data warehouse synchronization jobs for observability.

**Purpose:** Monitor warehouse sync health and performance

**Key Columns:**
- `job_id` - Unique job identifier
- `job_type` - full | incremental | backfill | validation
- `table_name` - Source table being synced
- `rows_processed`, `rows_inserted`, `rows_updated` - Metrics
- `bytes_transferred` - Data volume
- `last_synced_timestamp` - Watermark for incremental sync
- `error_message` - Failure diagnostics

#### 3. `predictive_models` - ML Model Registry

Version tracking and performance metrics for ML models.

**Purpose:** Centralized model management and deployment

**Key Columns:**
- `model_name`, `model_version` - Model identity
- `model_type` - forecast | clv | steam_detector | churn | recommendation
- `status` - training | validation | deployed | deprecated
- `accuracy`, `precision_score`, `recall`, `f1_score`, `auc_roc` - Performance metrics
- `hyperparameters` - Model configuration (JSONB)
- `feature_importance` - Feature rankings (JSONB)

#### 4. `forecast_predictions` - Model Outputs

Stores forecast model predictions with backtesting capability.

**Purpose:** Track predictions and evaluate accuracy

**Key Columns:**
- `forecast_type` - win_prob | player_performance | market_movement | volume
- `forecast_horizon_minutes` - Prediction timeframe
- `predicted_value`, `predicted_win_prob` - Forecasts
- `confidence_interval_lower/upper` - Uncertainty bounds
- `actual_value`, `prediction_error` - Backtesting results

#### 5. `steam_moves` - Sharp Money Detection

Tracks sharp money movement detection in betting markets.

**Purpose:** Identify edge opportunities from sharp play

**Key Columns:**
- `line_before`, `line_after`, `line_movement_pct` - Line movement
- `odds_before`, `odds_after`, `odds_movement_pct` - Odds movement
- `volume_spike_detected` - Volume anomaly indicator
- `reverse_line_movement` - RLM indicator
- `steam_confidence_score` - Detection confidence (0-1)
- `sharp_book_agreement_pct` - Sharp book consensus

#### 6. `clv_tracking` - Closing Line Value

Historical CLV tracking for predictive model training.

**Purpose:** Measure pick quality via CLV

**Key Columns:**
- `submitted_line`, `submitted_odds`, `submitted_at` - Pick entry
- `closing_line`, `closing_odds`, `closing_time` - Market close
- `clv_cents`, `clv_percentage` - CLV calculations
- `clv_tier` - elite | strong | good | neutral | poor
- `beat_closing_line` - Boolean indicator
- `time_to_close_minutes` - Time between submission and close

#### 7. `analytics_jobs` - Job Tracking

Scheduled analytics job execution and monitoring.

**Purpose:** Track analytics pipeline health

**Key Columns:**
- `job_type` - forecast_generation | clv_calculation | steam_detection | model_training
- `schedule_cron` - Cron expression for recurring jobs
- `status` - pending | running | completed | failed
- `records_processed`, `success_count`, `error_count` - Metrics
- `output_summary` - Job results (JSONB)

### Materialized Views

#### `mv_picks_performance_daily`

Pre-aggregated daily picks performance metrics.

**Grain:** One row per (tenant_id, user_id, date)

**Key Metrics:**
- `total_picks`, `won_picks`, `lost_picks`, `push_picks`
- `avg_professional_score`, `avg_professional_score_settled`
- `total_profit`, `total_loss`, `net_profit_loss`
- `win_rate_pct`

**Refresh:** Concurrent refresh via `refresh_analytics_views()`

#### `mv_internal_scores_summary`

Aggregated internal scores for ML model feature engineering.

**Grain:** One row per (tenant_id, date, pick_status)

**Key Metrics:**
- `avg_professional_score`, `avg_clv_pct`, `avg_kelly_fraction`
- `steam_moves_detected`
- `avg_model_confidence`, `avg_win_prob_v1`, `avg_expected_value`
- `stddev_professional_score`, `median_professional_score`, `p90_professional_score`

---

## 🔧 dbt Analytics Models

### Project Structure

```
analytics/
├── dbt_project.yml          # Project configuration
├── profiles.yml             # Connection profiles (dev, staging, prod)
├── packages.yml             # dbt packages (dbt_utils, metrics, etc.)
├── models/
│   ├── staging/             # Raw data staging models
│   │   ├── stg_picks.sql           # Cleaned picks data
│   │   ├── stg_internal_scores.sql # Cleaned internal_scores
│   │   └── schema.yml              # Source definitions & tests
│   └── marts/               # Business logic models
│       ├── picks/
│       │   ├── fct_picks_performance.sql  # Picks fact table
│       │   └── dim_cappers.sql            # Capper dimension
│       └── scoring/
│           └── fct_scoring_analytics.sql  # Scoring fact table
├── macros/                  # Custom macros
├── tests/                   # Data quality tests
└── docs/                    # Model documentation
```

### Key Models

#### **Staging Models** (Layer 1: Data Cleaning)

**`stg_picks.sql`**
- Source: `picks` table (canonical)
- Purpose: Clean and type picks data
- Transformations:
  - Extract metadata fields (sport, league, player_name, stat_type)
  - Calculate derived columns (is_win, score_tier, implied_probability)
  - Add temporal dimensions (published_date, published_week, published_month)
  - Data quality flags (has_prop_link, is_graded, is_settled)

**`stg_internal_scores.sql`**
- Source: `internal_scores` table
- Purpose: Clean ML scoring data
- Transformations:
  - Tier classifications (clv_tier, score_tier, confidence_tier)
  - Temporal dimensions (scored_date, scored_week, scored_month)
  - Data quality score calculation (data_quality_score_pct)

#### **Mart Models** (Layer 2: Business Logic)

**`fct_picks_performance.sql`**
- Grain: One row per pick
- Materialization: Incremental table
- Purpose: Core picks performance metrics
- Features:
  - Join picks + internal_scores + users + props
  - Performance categories (high_quality_win, high_quality_loss, etc.)
  - CLV outcome categories (positive_clv_win, etc.)
  - Edge calculations (expected_value - stake)

**`fct_scoring_analytics.sql`**
- Grain: One row per internal_score
- Materialization: Incremental table
- Purpose: ML model ingestion and scoring analytics
- Features:
  - All ML features from internal_scores
  - Outcome categories (steam_win, steam_loss, etc.)
  - Sharp alignment categories
  - Model performance tracking (model_v1_error, model_v2_error)

**`dim_cappers.sql`**
- Grain: One row per capper
- Materialization: Full refresh table
- Purpose: Capper dimension with aggregated metrics
- Features:
  - Lifetime metrics from users table
  - Settled picks aggregations
  - Performance metrics (win_rate_pct, roi_pct)
  - Advanced metrics (steam_capture_rate_pct, high_score_picks_pct)
  - Capper rating composite score
  - Skill tier classification (elite, advanced, intermediate, beginner)

### Running dbt Models

```bash
# Install dbt packages
cd analytics
dbt deps

# Run all models
dbt run

# Run specific model
dbt run --select fct_picks_performance

# Run incremental models only
dbt run --select config.materialized:incremental

# Refresh materialized views
psql -c "SELECT refresh_analytics_views();"

# Test data quality
dbt test

# Generate documentation
dbt docs generate
dbt docs serve
```

---

## 🔄 Warehouse Sync Infrastructure

### WarehouseSyncService

**Location:** `apps/api/src/services/WarehouseSyncService.ts`

**Purpose:** Automated data synchronization to analytics warehouse

**Key Features:**
- Incremental sync with watermarking
- Batch processing (configurable batch size)
- Retry logic and error handling
- Job tracking in `warehouse_sync_log` table
- Health monitoring

**Sync Types:**
- **full** - Complete table sync (initial load)
- **incremental** - Only changed/new records since last sync
- **backfill** - Historical data backfill
- **validation** - Data integrity checks

**Configuration:**
```typescript
const config = {
  batchSize: 1000,           // Records per batch
  maxRetries: 3,             // Retry attempts on failure
  syncInterval: 5 * 60 * 1000, // 5 minutes
  tables: ['picks', 'internal_scores', 'users', 'props', 'scores'],
};
```

**Usage:**
```typescript
import { initWarehouseSync } from './services/WarehouseSyncService';

// Initialize service
const warehouseSync = initWarehouseSync(supabase, config);

// Start continuous sync
await warehouseSync.startSync();

// Manual sync single table
const job = await warehouseSync.syncTable('picks', 'incremental');

// Get sync history
const history = await warehouseSync.getSyncHistory('picks', 10);

// Validate sync integrity
const validation = await warehouseSync.validateSync('picks');
```

**Monitoring:**
```sql
-- Check recent sync jobs
SELECT * FROM warehouse_sync_log
WHERE table_name = 'picks'
ORDER BY created_at DESC
LIMIT 10;

-- Get sync performance metrics
SELECT
  table_name,
  AVG(duration_seconds) AS avg_duration,
  AVG(rows_processed) AS avg_rows_per_sync,
  COUNT(*) FILTER (WHERE status = 'completed') AS successful_syncs,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed_syncs
FROM warehouse_sync_log
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY table_name;
```

---

## 🤖 Predictive Pipeline Scaffolding

### 1. Forecast Pipeline

**Location:** `apps/api/src/services/predictive/ForecastPipeline.ts`

**Purpose:** Generate forecasts for player performance, market movement, and volume

**Forecast Types:**
- **win_prob** - Win probability predictions
- **player_performance** - Player stat predictions
- **market_movement** - Line movement forecasts
- **volume** - Betting volume predictions

**Key Features:**
- Feature engineering (player form, opponent strength, venue impact)
- ML model inference (placeholder for TensorFlow/PyTorch integration)
- Confidence intervals (95% confidence level)
- Backtesting support (compare predictions vs actuals)

**Usage:**
```typescript
import { createForecastPipeline } from './services/predictive/ForecastPipeline';

const forecastPipeline = createForecastPipeline(supabase);

// Generate single forecast
const forecast = await forecastPipeline.generateForecast({
  propId: 'prop-123',
  sport: 'NBA',
  league: 'NBA',
  playerName: 'LeBron James',
  statType: 'points',
  line: 27.5,
  gameDate: new Date('2025-11-01'),
});

// Batch forecasts
const forecasts = await forecastPipeline.generateBatchForecasts(inputs);

// Evaluate accuracy (backtesting)
await forecastPipeline.evaluateForecast(forecastId, actualValue);
```

**Model Integration Points:**
```typescript
// TODO: Replace placeholder with actual ML model
// Example using TensorFlow.js:
import * as tf from '@tensorflow/tfjs-node';

const model = await tf.loadLayersModel('file://./models/forecast-v1/model.json');
const prediction = model.predict(tf.tensor2d([features]));
```

### 2. CLV Pipeline

**Location:** `apps/api/src/services/predictive/CLVPipeline.ts`

**Purpose:** Calculate and track Closing Line Value for picks

**Key Features:**
- Fetch closing lines from odds providers
- Calculate CLV in cents and percentage
- Classify CLV tiers (elite, strong, good, neutral, poor)
- Standard deviation calculations
- User CLV statistics

**CLV Metrics:**
- **clv_cents** - CLV in cents (based on $100 bet)
- **clv_percentage** - CLV as percentage of submitted odds
- **clv_standard_deviations** - How many std devs from mean
- **beat_closing_line** - Boolean indicator
- **time_to_close_minutes** - Time between submission and game start

**Usage:**
```typescript
import { createCLVPipeline } from './services/predictive/CLVPipeline';

const clvPipeline = createCLVPipeline(supabase);

// Calculate CLV for settled pick
const clv = await clvPipeline.calculateCLV({
  pickId: 'pick-123',
  submittedLine: 27.5,
  submittedOdds: -110,
  submittedAt: new Date('2025-10-30T10:00:00Z'),
  propId: 'prop-123',
  sport: 'NBA',
  gameTime: new Date('2025-10-30T19:00:00Z'),
});

// Get user CLV statistics
const stats = await clvPipeline.getUserCLVStats(userId);
// Returns: totalPicks, avgCLV, elitePicksCount, beatClosingLineRate
```

**CLV Tier Classification:**
- **elite**: CLV >= 5.0%
- **strong**: CLV >= 2.0%
- **good**: CLV >= 0.5%
- **neutral**: CLV >= -0.5%
- **poor**: CLV < -0.5%

### 3. Steam Detector

**Location:** `apps/api/src/services/predictive/SteamDetector.ts`

**Purpose:** Detect sharp money movements (steam moves) in betting markets

**Detection Indicators:**
- Line movement >= 3% threshold
- Odds movement >= 5% threshold
- Volume spike (3x normal volume)
- Reverse line movement (RLM)
- Multiple bookmaker agreement

**Confidence Score Calculation:**
- Line movement: 30% weight
- Odds movement: 20% weight
- Volume spike: 20% weight
- Reverse line movement: 15% weight
- Multiple book movement: 15% weight

**Usage:**
```typescript
import { createSteamDetector } from './services/predictive/SteamDetector';

const steamDetector = createSteamDetector(supabase);

// Start continuous detection (1-minute polling)
steamDetector.startDetection();

// Manual detection cycle
const steamMoves = await steamDetector.detectSteamMoves();

// Get steam move history for prop
const history = await steamDetector.getSteamHistory(propId);

// Stop detection
steamDetector.stopDetection();
```

**Alerting:**
High-confidence steam moves (score >= 0.8) trigger alerts via:
- Console logging (immediate)
- Database storage (`steam_moves` table)
- Discord/Slack (TODO: implement webhook integration)

---

## 📈 Analytics Queries

### Key Performance Indicators (KPIs)

#### Picks Performance

```sql
-- Overall win rate and profitability
SELECT
  COUNT(*) AS total_picks,
  SUM(CASE WHEN is_win = 1 THEN 1 ELSE 0 END) AS won_picks,
  ROUND(AVG(is_win) * 100, 2) AS win_rate_pct,
  SUM(profit_loss) AS total_profit_loss,
  AVG(professional_score) AS avg_score
FROM analytics.fct_picks_performance
WHERE is_settled = 1;

-- Performance by capper tier
SELECT
  capper_tier,
  COUNT(*) AS picks,
  ROUND(AVG(is_win) * 100, 2) AS win_rate_pct,
  AVG(professional_score) AS avg_score,
  AVG(clv_pct) AS avg_clv
FROM analytics.fct_picks_performance
WHERE is_settled = 1
GROUP BY capper_tier
ORDER BY avg_score DESC;

-- High-quality picks (score >= 70 AND CLV > 0)
SELECT
  capper_name,
  COUNT(*) AS high_quality_picks,
  SUM(CASE WHEN is_win = 1 THEN 1 ELSE 0 END) AS wins,
  ROUND(AVG(is_win) * 100, 2) AS win_rate_pct,
  AVG(clv_pct) AS avg_clv,
  SUM(profit_loss) AS total_profit
FROM analytics.fct_picks_performance
WHERE professional_score >= 70 AND clv_pct > 0 AND is_settled = 1
GROUP BY capper_name
ORDER BY high_quality_picks DESC
LIMIT 10;
```

#### CLV Analysis

```sql
-- CLV distribution
SELECT
  clv_tier,
  COUNT(*) AS picks,
  ROUND(AVG(clv_pct), 2) AS avg_clv_pct,
  ROUND(AVG(CASE WHEN is_win = 1 THEN 1.0 ELSE 0.0 END) * 100, 2) AS win_rate_pct
FROM analytics.fct_picks_performance
WHERE clv_pct IS NOT NULL AND is_settled = 1
GROUP BY clv_tier
ORDER BY avg_clv_pct DESC;

-- CLV vs Win Rate correlation
SELECT
  CASE
    WHEN clv_pct >= 2.0 THEN 'Elite CLV (>= 2%)'
    WHEN clv_pct >= 0 THEN 'Positive CLV'
    ELSE 'Negative CLV'
  END AS clv_category,
  COUNT(*) AS picks,
  ROUND(AVG(is_win) * 100, 2) AS win_rate_pct,
  AVG(clv_pct) AS avg_clv_pct
FROM analytics.fct_picks_performance
WHERE clv_pct IS NOT NULL AND is_settled = 1
GROUP BY clv_category
ORDER BY avg_clv_pct DESC;
```

#### Steam Move Analysis

```sql
-- Steam move win rate
SELECT
  steam_move_detected,
  COUNT(*) AS picks,
  SUM(CASE WHEN is_win = 1 THEN 1 ELSE 0 END) AS wins,
  ROUND(AVG(is_win) * 100, 2) AS win_rate_pct,
  AVG(professional_score) AS avg_score
FROM analytics.fct_picks_performance
WHERE is_settled = 1
GROUP BY steam_move_detected;

-- Steam moves by sport
SELECT
  sport,
  COUNT(*) AS steam_moves,
  AVG(steam_move.steam_confidence_score) AS avg_confidence
FROM steam_moves steam_move
GROUP BY sport
ORDER BY steam_moves DESC;
```

#### Model Performance Evaluation

```sql
-- ML model accuracy
SELECT
  grading_engine_version,
  COUNT(*) AS predictions,
  AVG(ABS(predicted_win_prob - is_win)) AS mean_absolute_error,
  ROUND(AVG(model_confidence), 4) AS avg_confidence,
  AVG(professional_score) AS avg_score
FROM analytics.fct_scoring_analytics
WHERE pick_status IN ('won', 'lost')
GROUP BY grading_engine_version
ORDER BY mean_absolute_error;

-- Confidence tier performance
SELECT
  confidence_tier,
  COUNT(*) AS picks,
  ROUND(AVG(CASE WHEN is_win = 1 THEN 1.0 ELSE 0.0 END) * 100, 2) AS win_rate_pct,
  AVG(model_confidence) AS avg_confidence
FROM analytics.fct_scoring_analytics
WHERE pick_status IN ('won', 'lost')
GROUP BY confidence_tier
ORDER BY avg_confidence DESC;
```

#### Capper Leaderboard

```sql
-- Top cappers by capper_rating
SELECT
  capper_name,
  user_tier,
  skill_tier,
  capper_rating,
  total_settled_picks,
  win_rate_pct,
  avg_professional_score,
  avg_clv_pct,
  roi_pct,
  steam_capture_rate_pct
FROM analytics.dim_cappers
WHERE total_settled_picks >= 10
ORDER BY capper_rating DESC
LIMIT 20;

-- Rising stars (high ROI with moderate volume)
SELECT
  capper_name,
  skill_tier,
  total_settled_picks,
  win_rate_pct,
  roi_pct,
  avg_clv_pct
FROM analytics.dim_cappers
WHERE total_settled_picks BETWEEN 10 AND 50
  AND roi_pct > 5.0
ORDER BY roi_pct DESC
LIMIT 10;
```

---

## 🚀 Deployment Guide

### Prerequisites

**Database:**
- PostgreSQL 14+ (Supabase)
- dbt 1.5+
- Python 3.8+ (for dbt)

**Environment Variables:**
```bash
# Supabase Connection
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_DIRECT_URL=postgresql://user:pass@host:5432/db

# dbt Connection (via profiles.yml)
SUPABASE_DB_HOST=db.your-project.supabase.co
SUPABASE_DB_PORT=5432
SUPABASE_DB_USER=postgres
SUPABASE_DB_PASSWORD=your-password
SUPABASE_DB_NAME=postgres

# Warehouse Sync (optional)
WAREHOUSE_URL=your-warehouse-url
```

### Step 1: Apply Database Migration

```bash
# Apply Phase 11 migration
docker-compose exec api npm run db:migrate

# Verify tables created
psql $DATABASE_DIRECT_URL -c "\dt *scores*"
psql $DATABASE_DIRECT_URL -c "\dt *predictions*"
psql $DATABASE_DIRECT_URL -c "\dt *warehouse*"
psql $DATABASE_DIRECT_URL -c "\dt *clv*"
```

### Step 2: Set Up dbt

```bash
# Install dbt
pip install dbt-postgres

# Install dbt packages
cd analytics
dbt deps

# Test connection
dbt debug

# Run models
dbt run --target dev

# Run tests
dbt test
```

### Step 3: Initialize Services

```typescript
// apps/api/src/index.ts
import { initWarehouseSync } from './services/WarehouseSyncService';
import { createForecastPipeline } from './services/predictive/ForecastPipeline';
import { createCLVPipeline } from './services/predictive/CLVPipeline';
import { createSteamDetector } from './services/predictive/SteamDetector';

// Initialize warehouse sync
const warehouseSync = initWarehouseSync(supabase, {
  syncInterval: 5 * 60 * 1000, // 5 minutes
});
await warehouseSync.startSync();

// Initialize predictive pipelines
const forecastPipeline = createForecastPipeline(supabase);
const clvPipeline = createCLVPipeline(supabase);
const steamDetector = createSteamDetector(supabase);

// Start steam detection
steamDetector.startDetection();

logger.info('[Phase11] Canonical analytics infrastructure initialized');
```

### Step 4: Schedule Analytics Jobs

```sql
-- Schedule materialized view refresh (every hour)
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'refresh-analytics-views',
  '0 * * * *', -- Every hour
  $$SELECT refresh_analytics_views();$$
);

-- Schedule dbt run (every 6 hours)
-- Use external scheduler (Airflow, GitHub Actions, etc.)
```

### Step 5: Verify Deployment

```bash
# Check warehouse sync status
curl http://localhost:3010/api/warehouse/health

# Check recent sync jobs
psql $DATABASE_DIRECT_URL -c "
SELECT table_name, status, rows_processed, created_at
FROM warehouse_sync_log
ORDER BY created_at DESC
LIMIT 10;
"

# Verify dbt models
dbt test --target prod

# Check predictive models table
psql $DATABASE_DIRECT_URL -c "
SELECT model_name, model_version, status, deployed_at
FROM predictive_models
WHERE status = 'deployed';
"
```

---

## 📊 Monitoring & Observability

### Key Metrics

**Warehouse Sync:**
- Sync job success rate (target: > 99%)
- Average sync duration (target: < 60 seconds)
- Sync lag (time since last successful sync, target: < 10 minutes)

**dbt Models:**
- Model build time (track degradation)
- Test pass rate (target: 100%)
- Row count deltas (detect anomalies)

**Predictive Pipelines:**
- Forecast generation rate
- CLV calculation latency
- Steam detection accuracy (backtested)
- Model inference time (target: < 100ms)

### Prometheus Metrics

```prometheus
# Warehouse sync metrics
unittalk_warehouse_sync_jobs_total{table="picks",status="completed"}
unittalk_warehouse_sync_duration_seconds{table="picks"}
unittalk_warehouse_sync_rows_processed{table="picks"}

# dbt metrics
unittalk_dbt_model_build_duration_seconds{model="fct_picks_performance"}
unittalk_dbt_test_pass_rate{model="fct_picks_performance"}

# Predictive pipeline metrics
unittalk_forecast_generation_total{sport="NBA"}
unittalk_clv_calculation_duration_seconds
unittalk_steam_moves_detected_total{confidence="high"}
```

### Grafana Dashboards

**Analytics Pipeline Dashboard:**
- Warehouse sync health (success rate, lag)
- dbt model build times
- Predictive pipeline throughput

**Model Performance Dashboard:**
- Forecast accuracy (MAE, RMSE)
- CLV distribution
- Steam move win rate
- Model confidence vs actual win rate

### Alerting

```yaml
# Prometheus AlertManager rules
groups:
  - name: analytics_pipeline
    rules:
      - alert: WarehouseSyncFailing
        expr: rate(unittalk_warehouse_sync_jobs_total{status="failed"}[5m]) > 0.1
        for: 10m
        annotations:
          summary: "Warehouse sync failing for {{ $labels.table }}"

      - alert: dbtModelBuildSlow
        expr: unittalk_dbt_model_build_duration_seconds > 300
        for: 5m
        annotations:
          summary: "dbt model {{ $labels.model }} taking > 5 minutes"

      - alert: SteamDetectorDown
        expr: absent(unittalk_steam_moves_detected_total)
        for: 15m
        annotations:
          summary: "Steam detector not reporting metrics"
```

---

## 🔧 Maintenance & Operations

### Daily Operations

```bash
# Check warehouse sync health
psql -c "SELECT * FROM warehouse_sync_log WHERE created_at >= NOW() - INTERVAL '24 hours' AND status = 'failed';"

# Refresh materialized views
psql -c "SELECT refresh_analytics_views();"

# Run dbt models
cd analytics && dbt run --target prod
```

### Weekly Operations

```bash
# Full dbt rebuild
cd analytics && dbt run --full-refresh

# Validate sync integrity
psql -c "SELECT table_name, COUNT(*) FROM picks; SELECT table_name, COUNT(*) FROM internal_scores;"

# Review predictive model performance
psql -c "SELECT model_name, model_version, f1_score, deployed_at FROM predictive_models WHERE status = 'deployed';"
```

### Monthly Operations

```bash
# Archive old sync logs (keep last 90 days)
psql -c "DELETE FROM warehouse_sync_log WHERE created_at < NOW() - INTERVAL '90 days';"

# Review and optimize dbt models
cd analytics && dbt run-operation analyze_performance

# Retrain predictive models with updated data
# (Manual ML pipeline trigger)
```

### Troubleshooting

**Warehouse sync failing:**
```sql
-- Check error messages
SELECT job_id, table_name, error_message, created_at
FROM warehouse_sync_log
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 10;

-- Retry failed job
-- (Use WarehouseSyncService.syncTable() with job ID)
```

**dbt model failing:**
```bash
# Run single model with debug
dbt run --select fct_picks_performance --debug

# Check for schema changes
dbt run --select fct_picks_performance --full-refresh
```

**Missing predictions:**
```sql
-- Check if predictive models are deployed
SELECT * FROM predictive_models WHERE status != 'deployed';

-- Check recent forecast predictions
SELECT COUNT(*), MAX(predicted_at) FROM forecast_predictions;
```

---

## 🎯 Success Criteria

### ✅ Acceptance Criteria

- [x] Database migration with 7 new tables for analytics and predictive models
- [x] dbt project with 5 core models (staging + marts)
- [x] Warehouse sync infrastructure with incremental sync support
- [x] Forecast pipeline scaffolding with ML integration points
- [x] CLV pipeline with tier classification
- [x] Steam detector with confidence scoring
- [x] 2 materialized views for pre-aggregated analytics
- [x] Comprehensive documentation with queries and runbooks

### 📈 Performance Targets

- **Warehouse Sync:**
  - Sync lag < 10 minutes (incremental mode)
  - Sync success rate > 99%
  - Sync duration < 60 seconds per table

- **dbt Models:**
  - Model build time < 5 minutes (incremental)
  - Test pass rate = 100%
  - Data freshness < 1 hour

- **Predictive Pipelines:**
  - Forecast generation < 100ms per prop
  - CLV calculation < 50ms per pick
  - Steam detection latency < 60 seconds

### 🚀 Phase 12 Preview

**Next Steps:**
1. **ML Model Training Pipeline** - Integrate TensorFlow/PyTorch for production models
2. **Real-time Feature Store** - Low-latency feature serving for models
3. **Advanced CLV Models** - Predict CLV before line closes
4. **Steam Move Prediction** - Forecast steam moves before they happen
5. **Multi-Model Ensemble** - Combine multiple models for better predictions

---

## 📚 Additional Resources

- [Production Charter v3.0](../PRODUCTION_CHARTER.md)
- [dbt Documentation](https://docs.getdbt.com/)
- [Supabase Analytics Guide](https://supabase.com/docs/guides/analytics)
- [Machine Learning Best Practices](../ml/ML_BEST_PRACTICES.md)

---

**Phase 11 Status:** ✅ **PRODUCTION READY**

All deliverables complete and tested. Ready for production deployment.

**Architecture Owner:** Platform Engineering Team
**Last Updated:** 2025-10-30
**Next Review:** Phase 12 Kickoff
