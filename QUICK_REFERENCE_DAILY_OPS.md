# Quick Reference: Daily Operations
**Dual-Track Market Props Pipeline**

---

## 🏥 Morning Health Check (2 minutes)

```bash
# Run verification gates
cd apps/api
npx tsx src/scripts/verify-gates.ts
```

**Expected Output**:
```
✅ Gate 1: raw_props_today     = 1000+ PASS
✅ Gate 2: market_props_today  = 1000+ PASS
✅ Gate 3: scored_15m          = 50+   PASS
✅ Gate 4: v_prop_read_model   = 1000+ PASS
✅ Gate 5: v_daily_board       = 50+   PASS
Overall: ✅ ALL GATES PASS
```

---

## 🔧 Troubleshooting

### Gate 2 Fails (market_props_today = 0)
**Fix**: Backfill today's props
```bash
npx tsx src/scripts/backfill-market-props.ts
```

### Gate 3 Fails (scored_15m = 0)
**Fix**: Run scoring
```bash
npx tsx src/scripts/score-market-props.ts
```

### Gate 5 Fails (v_daily_board = 0)
**Fix**: Check scored_props table
```sql
-- Via Supabase dashboard or psql:
SELECT COUNT(*) FROM scored_props WHERE updated_at >= NOW() - INTERVAL '1 hour';
```
If 0: Run scoring script above

---

## 📊 Key Queries

### Check Pipeline Health
```sql
-- Raw props today
SELECT COUNT(*) FROM raw_props WHERE game_date >= CURRENT_DATE;

-- Market props today
SELECT COUNT(*) FROM market_props WHERE game_date >= CURRENT_DATE;

-- Scored in last hour
SELECT COUNT(*) FROM scored_props WHERE updated_at >= NOW() - INTERVAL '1 hour';

-- Board rows
SELECT COUNT(*) FROM v_daily_board;
```

### Sample Data
```sql
-- Top scored props
SELECT prop_ref, professional_score, tier, edge, confidence
FROM scored_props
ORDER BY updated_at DESC
LIMIT 10;

-- Daily board preview
SELECT prop_ref, sport, market, selection, odds, professional_score, tier
FROM v_daily_board
ORDER BY tier, edge DESC
LIMIT 20;
```

---

## 🔄 Manual Workflows

### Backfill Historical Data (One-Time or Recovery)
```bash
# Backfills last 3 days
npx tsx src/scripts/backfill-market-props.ts
```

### Re-Score Props (Force Refresh)
```bash
# Scores unscored props (uses helper function)
npx tsx src/scripts/score-market-props.ts
```

### Verify Schema Status
```bash
# Shows table counts and sample data
npx tsx src/scripts/verify-gates.ts
```

---

## 📍 Important Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `raw_props` | Ingestion | game_date, sport, odds |
| `market_props` | Normalized market feed | id, player_name, line, odds, bookmaker_key, external_prop_id |
| `scored_props` | Scoring results | prop_ref, professional_score, tier, edge, confidence |
| `promotion_queue` | Approval queue | prop_ref, status, source |
| `v_prop_read_model` | Command Center feed | All props with scores |
| `v_daily_board` | Scored props only | Props ready for promotion |

---

## 🚨 Alerts & Monitoring

### Critical Alerts
- **Gate 1 fails**: Raw props ingestion broken
- **Gate 2 fails**: Normalization not running
- **Gate 3 fails**: Scoring agent stopped

### Warning Alerts
- **Gate 4 < 500**: Low prop volume
- **Gate 5 < 20**: Low scoring throughput
- **scored_15m = 0**: Scoring agent idle

---

## 🔗 Quick Links

- **Command Center**: http://localhost:3004
- **Supabase Dashboard**: https://supabase.com/dashboard/project/lxqmuzmqtnnlpfapvief
- **Migration SQL**: `supabase/overrides/20251008_market_split.sql`
- **Scripts Dir**: `apps/api/src/scripts/`

---

## 📞 Support

### Common Issues
1. **"No props to score"**: Normal if all props already scored in last hour
2. **"Duplicate key"**: Normal, handled by unique constraint
3. **"Gate 5 = 0"**: Run scoring script to populate scored_props

### Emergency Contacts
- Schema issues → Check `20251008_market_split.sql`
- Scoring issues → Check `score-market-props.ts`
- View issues → Reload schema cache: `NOTIFY pgrst, 'reload schema'`

---

**Last Updated**: 2025-10-06
**Pipeline Version**: Dual-Track v1.0
**Status**: ✅ Operational
