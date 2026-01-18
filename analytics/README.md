# Unit Talk Analytics - dbt Project

**Version:** 1.0.0
**Phase:** Phase 11 - Canonical Analytics + Model Ingestion
**Reference:** [ANALYTICS_ROADMAP_v4.md](../docs/analytics/ANALYTICS_ROADMAP_v4.md)

---

## 🚀 Quick Start

### Prerequisites

- Python 3.8+
- PostgreSQL 14+ (Supabase)
- dbt 1.5+

### Installation

```bash
# Install dbt
pip install dbt-postgres

# Install dbt packages
cd analytics
dbt deps

# Test connection
dbt debug
```

### Running Models

```bash
# Run all models
dbt run

# Run specific model
dbt run --select fct_picks_performance

# Run incremental models only
dbt run --select config.materialized:incremental

# Full refresh (rebuild all tables)
dbt run --full-refresh

# Run tests
dbt test

# Generate documentation
dbt docs generate
dbt docs serve  # Opens in browser
```

---

## 📁 Project Structure

```
analytics/
├── dbt_project.yml          # Project configuration
├── profiles.yml             # Connection profiles
├── packages.yml             # dbt packages
├── models/
│   ├── staging/             # Raw data staging models
│   │   ├── stg_picks.sql
│   │   ├── stg_internal_scores.sql
│   │   └── schema.yml
│   └── marts/               # Business logic models
│       ├── picks/
│       │   ├── fct_picks_performance.sql
│       │   └── dim_cappers.sql
│       └── scoring/
│           └── fct_scoring_analytics.sql
├── macros/                  # Custom macros
├── tests/                   # Data quality tests
└── docs/                    # Model documentation
```

---

## 🎯 Key Models

### Staging Models

- **stg_picks** - Cleaned picks data from canonical picks table
- **stg_internal_scores** - Cleaned internal scoring data for ML ingestion

### Mart Models

- **fct_picks_performance** - Core picks performance metrics (incremental)
- **fct_scoring_analytics** - ML model ingestion and scoring analytics (incremental)
- **dim_cappers** - Capper dimension with aggregated metrics

---

## 🔄 Deployment

### Development

```bash
# Set development target
export DBT_TARGET=dev

# Run models
dbt run --target dev
```

### Staging

```bash
# Set staging target
export DBT_TARGET=staging

# Run models
dbt run --target staging
```

### Production

```bash
# Set production target
export DBT_TARGET=prod

# Run models with full refresh
dbt run --target prod --full-refresh

# Run tests
dbt test --target prod
```

---

## 📊 Materialized Views

Refresh materialized views:

```sql
-- Run in PostgreSQL
SELECT refresh_analytics_views();
```

---

## 🔍 Data Quality Tests

dbt includes comprehensive data quality tests:

```bash
# Run all tests
dbt test

# Run tests for specific model
dbt test --select fct_picks_performance

# Run schema tests only
dbt test --schema

# Run data tests only
dbt test --data
```

---

## 📈 Monitoring

### Model Performance

```bash
# Check model run times
dbt run --profiles-dir . | grep "Completed"

# View model lineage
dbt docs generate
dbt docs serve
```

### Data Freshness

```bash
# Check source freshness
dbt source freshness

# Check specific source
dbt source freshness --select source:public.picks
```

---

## 🛠️ Troubleshooting

### Connection Issues

```bash
# Test connection
dbt debug

# Check profiles.yml syntax
cat profiles.yml
```

### Model Failures

```bash
# Run with debug mode
dbt run --select fct_picks_performance --debug

# Check compiled SQL
cat target/compiled/unit_talk_analytics/models/marts/picks/fct_picks_performance.sql
```

### Incremental Model Issues

```bash
# Full refresh incremental models
dbt run --select fct_picks_performance --full-refresh

# Check incremental logic
dbt compile --select fct_picks_performance
```

---

## 📚 Documentation

- **[Analytics Roadmap](../docs/analytics/ANALYTICS_ROADMAP_v4.md)** - Comprehensive Phase 11 documentation
- **[Production Charter](../docs/PRODUCTION_CHARTER.md)** - Charter v3.0 requirements
- **[dbt Docs](https://docs.getdbt.com/)** - Official dbt documentation

---

## 🎯 Success Criteria

- ✅ All models compile without errors
- ✅ All tests pass (100% pass rate)
- ✅ Incremental models sync correctly
- ✅ Documentation is up to date
- ✅ Model build time < 5 minutes

---

**Last Updated:** 2025-10-30
**Maintained By:** Platform Engineering Team
