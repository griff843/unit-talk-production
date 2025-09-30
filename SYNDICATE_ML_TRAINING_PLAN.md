# 🎯 SYNDICATE-LEVEL ML SYSTEM TRAINING PLAN

## Executive Summary
Transform Unit Talk into a syndicate-level betting intelligence platform using 142,184 settled props as training data. Target 55-58% win rate through advanced ML models, professional betting features, and systematic risk management.

## 📊 Current Assets
- **Training Data**: 142,184 settled props with outcomes
- **Distribution**: 35.2% won, 36.7% lost, 14.2% cancelled
- **Sports Coverage**: NBA, NFL, MLB, NHL, NCAAF, NCAAB, WNBA
- **Infrastructure**: PostgreSQL database, Docker environment, TypeScript/Node.js platform

## 🎯 Performance Targets
| Metric | Target | Current Baseline |
|--------|--------|------------------|
| Win Rate | 55-58% | 35.2% (raw data) |
| ROI | 5-8% | N/A |
| CLV (Closing Line Value) | +2-3% | Not tracked |
| Daily Volume | 500+ picks | 0 |
| Maximum Drawdown | <20% | N/A |
| Sharpe Ratio | >1.5 | N/A |

## 🏗️ System Architecture

### Core ML Pipeline
```
Raw Props → Feature Engineering → Model Training → Ensemble → Risk Management → Production Picks
   ↓              ↓                    ↓              ↓             ↓                ↓
142K props    150+ features      7 sport models   Meta-model   Kelly sizing    Discord/API
```

### Technology Stack
- **Current Setup**: TypeScript, PostgreSQL, Docker, Temporal workflows
- **New Requirements**:
  - Python ML environment (scikit-learn, XGBoost, TensorFlow)
  - Jupyter notebooks for experimentation
  - MLflow for model tracking
  - Redis for feature caching
  - Apache Kafka for real-time streaming (optional)

## 📋 MASTER TODO LIST

### ✅ Completed
- [x] SGO data backfill (742K props)
- [x] Settlement data extraction (142K props with results)
- [x] Database structure validated

### 🚀 Phase 1: Data Foundation (Week 1-2)
- [ ] Export 142K settled props to CSV/Parquet format
- [ ] Create train/validation/test splits (60/20/20)
- [ ] Build data quality checks and cleaning pipeline
- [ ] Set up Python ML environment with Docker
- [ ] Create Jupyter notebook infrastructure
- [ ] Document data schema and statistics

### 🔧 Phase 2: Feature Engineering (Week 3-4)
- [ ] Build player performance features (rolling averages, trends)
- [ ] Create team dynamics features (home/away, rest, travel)
- [ ] Extract matchup features (H2H history, position vs position)
- [ ] Calculate market features (line movement, public betting %)
- [ ] Add environmental features (weather, venue, time)
- [ ] Implement feature store in PostgreSQL
- [ ] Create feature importance analysis

### 🤖 Phase 3: Model Development (Week 5-6)
- [ ] Train NBA-specific model (XGBoost baseline)
- [ ] Train NFL-specific model
- [ ] Train MLB-specific model
- [ ] Train NHL-specific model
- [ ] Train NCAAF/NCAAB models
- [ ] Train WNBA model
- [ ] Implement cross-validation framework
- [ ] Hyperparameter optimization with Optuna

### 🎭 Phase 4: Ensemble System (Week 7-8)
- [ ] Build weighted average ensemble
- [ ] Implement stacking with meta-learner
- [ ] Create Bayesian model averaging
- [ ] Add confidence calibration layer
- [ ] Build prediction explanation system
- [ ] Implement A/B testing framework

### 💎 Phase 5: Professional Features (Week 9-10)
- [ ] Steam detection algorithm
- [ ] CLV tracking system
- [ ] Optimal timing calculator
- [ ] Line shopping optimizer
- [ ] Sharp vs public analyzer
- [ ] Market making engine
- [ ] Injury news processor
- [ ] Cross-market arbitrage detector

### 📈 Phase 6: Backtesting & Validation (Week 11)
- [ ] Build historical backtesting engine
- [ ] Simulate full seasons with betting constraints
- [ ] Calculate performance metrics (ROI, Sharpe, drawdown)
- [ ] Validate against different time periods
- [ ] Test robustness with Monte Carlo simulation
- [ ] Generate performance reports

### 💰 Phase 7: Risk Management (Week 12)
- [ ] Implement Kelly criterion calculator
- [ ] Build correlation matrix system
- [ ] Create position sizing algorithm
- [ ] Add stop-loss rules
- [ ] Implement bankroll management
- [ ] Create variance calculator
- [ ] Build psychological capital tracker

### 🚀 Phase 8: Production Deployment (Week 13)
- [ ] Create real-time scoring API
- [ ] Build model serving infrastructure
- [ ] Implement monitoring dashboard
- [ ] Set up alerting system
- [ ] Create automated retraining pipeline
- [ ] Build failover mechanisms
- [ ] Deploy to production environment

### 🧪 Phase 9: Live Testing (Week 14-15)
- [ ] Paper trading simulation
- [ ] Small stakes validation ($1 units)
- [ ] Performance tracking system
- [ ] Model drift detection
- [ ] User feedback integration
- [ ] Discord bot integration
- [ ] Command center updates

### 🏆 Phase 10: Scale to Production (Week 16+)
- [ ] Full stake deployment
- [ ] 24/7 monitoring system
- [ ] Automated model updates
- [ ] Performance reporting
- [ ] Continuous improvement cycle
- [ ] Syndicate-level operations

## 🛠️ Additional Tools Needed

### Required New Components
1. **Python ML Service**
   ```python
   # New directory structure needed:
   ml-training/
   ├── notebooks/           # Jupyter notebooks
   ├── models/             # Trained model files
   ├── features/           # Feature engineering
   ├── training/           # Training scripts
   ├── backtesting/        # Backtest engine
   └── serving/            # Model serving API
   ```

2. **Feature Store Database**
   ```sql
   -- New tables needed:
   CREATE TABLE feature_store (
     prop_id UUID,
     feature_vector JSONB,
     computed_at TIMESTAMP
   );

   CREATE TABLE model_predictions (
     prediction_id UUID PRIMARY KEY,
     prop_id UUID,
     model_version VARCHAR,
     prediction FLOAT,
     confidence FLOAT,
     created_at TIMESTAMP
   );
   ```

3. **MLOps Infrastructure**
   - MLflow for experiment tracking
   - DVC for data versioning
   - Weights & Biases for monitoring
   - Prefect/Airflow for pipeline orchestration

4. **Real-time Processing**
   - Redis for caching features
   - Kafka for event streaming (optional)
   - WebSocket for live updates

## 📊 Data Export Script

```typescript
// apps/api/scripts/export-training-data.ts
import { Pool } from 'pg';
import * as fs from 'fs';
import { parse } from 'json2csv';

async function exportTrainingData() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  const query = `
    SELECT
      r.sport,
      r.stat_type,
      r.player_name,
      r.line,
      r.over_odds,
      r.under_odds,
      r.actual_value,
      r.result,
      r.start_time,
      g.home_team,
      g.away_team
    FROM raw_props r
    JOIN games g ON r.game_id = g.id
    WHERE r.source = 'sgo'
    AND r.result IS NOT NULL
  `;

  const result = await pool.query(query);
  const csv = parse(result.rows);

  fs.writeFileSync('training_data.csv', csv);
  console.log(`Exported ${result.rows.length} training samples`);
}
```

## 🚦 Go/No-Go Criteria

### Phase Gate Reviews
- **After Phase 3**: Models must achieve >52.38% accuracy (break-even)
- **After Phase 6**: Backtesting must show >54% win rate
- **After Phase 9**: Live testing must show positive ROI over 100+ bets

## 📈 Success Metrics

### Week-by-Week Targets
- Week 2: Data pipeline complete
- Week 4: 150+ features engineered
- Week 6: Base models >53% accuracy
- Week 8: Ensemble >54% accuracy
- Week 10: Professional features integrated
- Week 12: Backtesting shows 5%+ ROI
- Week 14: Live testing profitable
- Week 16: Production ready

## 🎯 Immediate Actions

1. **Create ML directory structure**
   ```bash
   mkdir -p apps/ml-training/{notebooks,models,features,training,backtesting,serving}
   ```

2. **Set up Python environment**
   ```dockerfile
   # Add to docker-compose.yml
   ml-training:
     build: ./apps/ml-training
     volumes:
       - ./apps/ml-training:/app
     environment:
       - DATABASE_URL=${DATABASE_URL}
   ```

3. **Export first training batch**
   ```bash
   docker-compose exec api npx tsx scripts/export-training-data.ts
   ```

4. **Start feature engineering**
   - Begin with simple features
   - Progressively add complexity
   - Validate each feature's predictive power

## 🏁 Let's Begin!

**Next Step**: Execute the data export script to create our training dataset, then set up the Python ML environment for model development.

---

*Last Updated: Current Date*
*Target Completion: 16 weeks*
*Success Probability: High (with 142K training samples)*