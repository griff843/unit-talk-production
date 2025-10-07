# Settlement Execution Guide - 2.3M Outcomes in <2 Hours

## Quick Start (TL;DR)

```bash
# 1. Create performance indexes (5 minutes)
docker-compose exec -T postgres psql -U postgres -d postgres < apps/api/migrations/029_settlement_performance_indexes.sql

# 2. Run ultra-optimized settlement (30-45 minutes expected)
docker-compose exec api npx tsx src/scripts/ml/settle-ultra-optimized.ts --workers 8

# 3. Monitor progress in separate terminal (real-time)
docker-compose exec api npx tsx src/scripts/ml/monitor-settlement-progress.ts

# 4. Validate completion (2 minutes)
docker-compose exec api npx tsx src/scripts/ml/validate-settlement-completion.ts
```

## Detailed Execution Plan

### Phase 1: Pre-Flight Checks (5 minutes)

#### 1.1 Verify Database Connection

```bash
docker-compose exec -T postgres psql -U postgres -d postgres -c "SELECT version();"
```

Expected: PostgreSQL version info

#### 1.2 Check Table Existence

```bash
docker-compose exec -T postgres psql -U postgres -d postgres -c "\dt" | grep -E "(raw_props|unified_picks|player_stats)"
```

Expected: All three tables should exist

#### 1.3 Verify Data Volume

```bash
docker-compose exec -T postgres psql -U postgres -d postgres -c "
SELECT
  'raw_props' as table_name,
  COUNT(*) as row_count,
  pg_size_pretty(pg_total_relation_size('raw_props')) as table_size
FROM raw_props
UNION ALL
SELECT
  'player_stats',
  COUNT(*),
  pg_size_pretty(pg_total_relation_size('player_stats'))
FROM player_stats
UNION ALL
SELECT
  'unified_picks',
  COUNT(*),
  pg_size_pretty(pg_total_relation_size('unified_picks'))
FROM unified_picks;
"
```

Expected:
- `raw_props`: ~1.4M rows, ~500MB-1GB
- `player_stats`: varies by collection, 10K-100K+ rows
- `unified_picks`: may be empty or partially populated

### Phase 2: Index Creation (5 minutes)

#### 2.1 Apply Settlement Indexes

```bash
docker-compose exec -T postgres psql -U postgres -d postgres < apps/api/migrations/029_settlement_performance_indexes.sql
```

Expected output:
```
CREATE INDEX
CREATE INDEX
CREATE INDEX
...
NOTICE:  Settlement performance indexes created successfully
```

#### 2.2 Verify Index Creation

```bash
docker-compose exec -T postgres psql -U postgres -d postgres -c "SELECT * FROM check_settlement_index_health();"
```

Expected: All indexes show `is_valid = true` and `notes = 'OK'`

### Phase 3: Settlement Execution (30-45 minutes)

#### 3.1 Start Settlement Job

Open Terminal 1:

```bash
docker-compose exec api npx tsx src/scripts/ml/settle-ultra-optimized.ts \
  --workers 8 \
  --batch 50000 \
  --checkpoint-interval 5000 \
  --sports MLB,NFL,NBA
```

Command options explained:
- `--workers 8`: Use 8 parallel workers (adjust based on CPU cores)
- `--batch 50000`: Process 50,000 props per batch (memory-safe)
- `--checkpoint-interval 5000`: Save progress every 5,000 props
- `--sports MLB,NFL,NBA`: Process these sports (comma-separated)

Optional parameters:
- `--start-date 2024-01-01`: Only process from this date
- `--end-date 2024-10-05`: Only process until this date
- `--out /custom/path`: Custom output directory for logs

#### 3.2 Monitor Progress (Real-Time)

Open Terminal 2:

```bash
docker-compose exec api npx tsx src/scripts/ml/monitor-settlement-progress.ts
```

You'll see a live dashboard:

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                    SETTLEMENT PROGRESS MONITOR                               ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ Job ID: settlement-1728148923456                                             ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ Progress: [████████████████████████░░░░░░░░░░░░░░░░░░░░] 45.2%             ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ Total Props:        1,399,459 ║
║ Processed:            632,487 ║
║ Settled:              589,234 (93.2%)                                        ║
║ Skipped:               43,253 ║
║ Errors:                    0  ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ Speed:                   320 props/sec ║
║ Elapsed:                12.5 min ║
║ Remaining:              15.3 min (estimated) ║
║ Est. Completion:    14:45:30 ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

#### 3.3 Expected Timeline

| Phase | Duration | Cumulative | Activity |
|-------|----------|------------|----------|
| Load settled IDs | 10s | 10s | Loading existing settlements into memory |
| MLB Processing | 12-15 min | 13-16 min | 8 workers processing MLB props in parallel |
| NFL Processing | 8-10 min | 21-26 min | Processing NFL props |
| NBA Processing | 6-8 min | 27-34 min | Processing NBA props |
| Final checkpoint | 30s | 28-35 min | Writing final report |

**Total Expected: 28-35 minutes**

**With safety margin: 30-45 minutes**

#### 3.4 Handling Issues

**If settlement appears stalled:**

1. Check monitor for activity:
   - If "No progress since last check" appears, check logs
   - Look for error messages in Terminal 1

2. Check system resources:
   ```bash
   docker stats
   ```
   - CPU should be high (60-80%)
   - Memory should be stable (<2GB for API container)

3. Check database connections:
   ```bash
   docker-compose exec -T postgres psql -U postgres -d postgres -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'postgres';"
   ```
   - Should be <20 connections

**If errors exceed 5%:**

1. Check error log:
   ```bash
   cat apps/api/out/ops/settlement-ultra/errors.ndjson | head -20
   ```

2. Common issues:
   - Missing stat mappings → Add to MLB_STAT_MAPPINGS or NFL_STAT_MAPPINGS
   - Missing player_stats → Run data collection first
   - Database timeout → Reduce workers or batch size

**To resume after interruption:**

The script is idempotent - just re-run the same command:
```bash
docker-compose exec api npx tsx src/scripts/ml/settle-ultra-optimized.ts --workers 8
```

It will skip already-settled props automatically.

### Phase 4: Validation (2 minutes)

#### 4.1 Run Validation Script

```bash
docker-compose exec api npx tsx src/scripts/ml/validate-settlement-completion.ts
```

Expected output:

```
🔍 SETTLEMENT VALIDATION
================================================================================

📊 Overall Statistics...
   Total Props: 1,399,459
   Settled: 1,337,486
   Unsettled: 61,973
   Settlement Rate: 95.57%
   Passes >95% Target: ✅ YES

🏈 Settlement by Sport...
   MLB: 856,234/892,103 (96.0%)
   NFL: 412,567/432,891 (95.3%)
   NBA: 68,685/74,465 (92.2%)

... (more details)

================================================================================
🎉 SETTLEMENT VALIDATION PASSED!
   Settlement rate 95.57% exceeds 95% target.
================================================================================

📄 Full report saved to: apps/api/out/ops/settlement-ultra/validation-report.json
```

#### 4.2 Analyze Validation Report

```bash
cat apps/api/out/ops/settlement-ultra/validation-report.json | jq '.overall'
```

Key metrics to check:
- `settlementRate` >= 95.0
- `passesTarget` = true
- `unsettledProps` < 5% of total

#### 4.3 Investigate Failures (if <95%)

If settlement rate is below target, check unsettled reasons:

```bash
cat apps/api/out/ops/settlement-ultra/validation-report.json | jq '.unsettledReasons[] | select(.count > 100)'
```

Common causes:
1. **Missing player_stats**: Sport not collected yet
   - Solution: Run `collect-{sport}-season.ts` scripts first

2. **Unmapped stat types**: New market types not in mappings
   - Solution: Add to stat mappings in `settle-ultra-optimized.ts`

3. **Name mismatches**: Player name formatting differences
   - Solution: Improve fuzzy matching logic

### Phase 5: Post-Settlement Actions (5 minutes)

#### 5.1 Verify Database State

```bash
docker-compose exec -T postgres psql -U postgres -d postgres -c "
SELECT
  sport,
  COUNT(*) as total_settled,
  COUNT(*) FILTER (WHERE outcome = 'win') as wins,
  COUNT(*) FILTER (WHERE outcome = 'loss') as losses,
  COUNT(*) FILTER (WHERE outcome = 'push') as pushes,
  ROUND(AVG(actual_value), 2) as avg_actual_value
FROM unified_picks
WHERE settled_at IS NOT NULL
GROUP BY sport
ORDER BY total_settled DESC;
"
```

#### 5.2 Archive Settlement Logs

```bash
# Create archive directory
mkdir -p apps/api/out/ops/settlement-archive

# Move logs to archive
mv apps/api/out/ops/settlement-ultra apps/api/out/ops/settlement-archive/settlement-$(date +%Y%m%d-%H%M%S)
```

#### 5.3 Notify Team

Share the validation report with the team:
- Settlement rate achieved
- Total props settled
- Any issues requiring follow-up

## Performance Tuning

### Adjust Worker Count

Based on your system:

```bash
# 4-core system
--workers 4

# 8-core system (recommended)
--workers 8

# 16-core system
--workers 12  # Leave some cores for OS
```

### Adjust Batch Size

Based on available memory:

```bash
# Low memory (<4GB available)
--batch 25000

# Standard (4-8GB available)
--batch 50000

# High memory (>8GB available)
--batch 100000
```

### Optimize Database

For maximum performance:

```sql
-- Increase work_mem for query operations
ALTER DATABASE postgres SET work_mem = '256MB';

-- Increase maintenance_work_mem for index creation
ALTER DATABASE postgres SET maintenance_work_mem = '512MB';

-- Optimize for bulk operations
ALTER DATABASE postgres SET synchronous_commit = 'off';
```

**IMPORTANT**: Reset synchronous_commit after settlement:
```sql
ALTER DATABASE postgres SET synchronous_commit = 'on';
```

## Troubleshooting

### Problem: Settlement taking longer than expected

**Diagnosis:**
```bash
# Check processing speed
cat apps/api/out/ops/settlement-ultra/checkpoint.json | jq '.propsPerSec'
```

**Expected**: >200 props/sec

**If slower:**
1. Reduce workers: `--workers 4`
2. Check database load: `docker stats postgres`
3. Verify network latency: `ping localhost`

### Problem: High error rate

**Diagnosis:**
```bash
cat apps/api/out/ops/settlement-ultra/checkpoint.json | jq '.errors'
```

**If errors > 1%:**
1. Check error samples:
   ```bash
   cat apps/api/out/ops/settlement-ultra/errors.ndjson | head -20 | jq
   ```

2. Common fixes:
   - Database connection issues → Reduce workers
   - Missing stats → Run data collection
   - Stat mapping errors → Add new mappings

### Problem: Out of memory

**Symptoms:**
- Docker container crashes
- "JavaScript heap out of memory" error

**Solutions:**
1. Reduce batch size: `--batch 25000`
2. Increase Node memory:
   ```bash
   export NODE_OPTIONS="--max-old-space-size=4096"
   ```
3. Process one sport at a time:
   ```bash
   --sports MLB  # Run separately for each sport
   ```

## Success Criteria Checklist

- [ ] All indexes created successfully
- [ ] Settlement job completes without fatal errors
- [ ] Processing speed >200 props/sec average
- [ ] Settlement rate >95%
- [ ] Total runtime <2 hours (target: 30-45 min)
- [ ] Validation report shows "PASSED"
- [ ] No NULL actual_values in settled outcomes
- [ ] Logs archived for audit trail

## Next Steps After Settlement

Once settlement is complete and validated:

1. **Update ML Training Data**
   ```bash
   docker-compose exec api npx tsx src/scripts/ml/generate-training-data-from-stats.ts
   ```

2. **Run Backtest Validation**
   ```bash
   docker-compose exec api npx tsx src/scripts/ml/run-comprehensive-backtest.ts
   ```

3. **Update Production Probability Models**
   ```bash
   docker-compose exec api npx tsx src/scripts/ml/deploy-ml-system.ts
   ```

4. **Monitor Settlement Drift**
   - Set up daily cron job to settle new outcomes
   - Monitor settlement rate trends
   - Alert if rate falls below 95%

---

**Questions or Issues?**

Check these resources:
- [SETTLEMENT_PERFORMANCE_ANALYSIS.md](./SETTLEMENT_PERFORMANCE_ANALYSIS.md) - Architecture details
- [apps/api/src/scripts/ml/settle-ultra-optimized.ts](./apps/api/src/scripts/ml/settle-ultra-optimized.ts) - Source code
- Error logs: `apps/api/out/ops/settlement-ultra/errors.ndjson`
- Progress logs: `apps/api/out/ops/settlement-ultra/checkpoint.json`
