# E2E Validation — Quick Start Guide

**⏱️ Time to Complete:** 5-10 minutes  
**🎯 Purpose:** Validate production readiness across all leagues

## Prerequisites Checklist

- [ ] Docker Desktop running
- [ ] `.env` file configured with Supabase credentials
- [ ] `CAPPER_ID` set in `.env`
- [ ] Workspace at repository root

## One-Command Execution

### Windows (PowerShell)
```powershell
.\scripts\ops\industry-standard-e2e-validation.ps1
```

### Linux/macOS (Bash)
```bash
./scripts/ops/industry-standard-e2e-validation.sh
```

## Expected Runtime

| Phase | Duration | Description |
|-------|----------|-------------|
| Schema Refresh | 10-20s | Supabase cache reload |
| Stack Startup | 30-60s | Docker services initialization |
| Health Checks | 10-15s | API/Smart Form verification |
| Per-League Test | 60-90s | DRY-RUN + LIVE + Publish |
| **Total** | **5-10 min** | All 4 leagues + artifacts |

## Success Criteria

### ✅ PASS Indicators
- All 4 leagues show `✅ PASS`
- SLOs within targets
- Final decision: `🟢 GO`
- Exit code: `0`

### ❌ FAIL Indicators
- Any league shows `❌ FAIL`
- SLOs exceed targets
- Final decision: `🔴 NO-GO`
- Exit code: `1`

## Common Issues & Fixes

### Issue: "dev.sh not found"
```bash
# Solution: Navigate to workspace root
cd /path/to/unit-talk-production-main
```

### Issue: "Docker not running"
```bash
# Solution: Start Docker Desktop
# Windows: Start Docker Desktop from Start Menu
# macOS: Open Docker.app
# Linux: sudo systemctl start docker
```

### Issue: "CAPPER_ID not found"
```bash
# Solution: Add to .env
echo "CAPPER_ID=your-uuid-here" >> .env
```

### Issue: "API not detected"
```bash
# Solution: Check Docker containers
docker-compose ps
docker-compose logs api

# Restart if needed
docker-compose restart api
```

## Interpreting Results

### Console Output
```
LEAGUE RESULTS:
┌─────────┬──────────┬──────┬─────────┬─────────┬──────────┐
│ League  │ DRY-RUN  │ LIVE │ Publish │ Discord │ Overall  │
├─────────┼──────────┼──────┼─────────┼─────────┼──────────┤
│ NBA     │ ✅       │ ✅   │ ✅      │ ✅      │ ✅ PASS  │
│ NFL     │ ✅       │ ✅   │ ✅      │ ✅      │ ✅ PASS  │
│ MLB     │ ✅       │ ✅   │ ✅      │ ✅      │ ✅ PASS  │
│ NHL     │ ✅       │ ✅   │ ✅      │ ✅      │ ✅ PASS  │
└─────────┴──────────┴──────┴─────────┴─────────┴──────────┘

FINAL DECISION: 🟢 GO
```

### What Each Column Means

| Column | Meaning | Pass Criteria |
|--------|---------|---------------|
| DRY-RUN | Validation without DB writes | HTTP 204, <50ms |
| LIVE | Actual pick insertion | HTTP 201, pickId returned |
| Publish | Outbox processing | Status='sent', <60s lag |
| Discord | Message posted | external_message_id present |
| Overall | Combined result | All previous columns ✅ |

## Artifacts Location

```
out/ops/cutover/metrics/100/
├── FINAL_GO_NO_GO_20250128_123456.md
├── NBA_attestation_20250128_123456.json
├── NBA_attestation_20250128_123456.md
├── NFL_attestation_20250128_123456.json
├── NFL_attestation_20250128_123456.md
├── MLB_attestation_20250128_123456.json
├── MLB_attestation_20250128_123456.md
├── NHL_attestation_20250128_123456.json
└── NHL_attestation_20250128_123456.md
```

## Next Steps After GO

1. **Review Artifacts**
   ```bash
   # Open consolidated report
   cat out/ops/cutover/metrics/100/FINAL_GO_NO_GO_*.md
   ```

2. **Verify Command Center**
   - Open http://localhost:3004
   - Confirm picks visible in UI
   - Check real-time updates

3. **Production Cutover**
   - Update production `.env` with validated config
   - Deploy via CI/CD pipeline
   - Monitor SLOs in production

## Next Steps After NO-GO

1. **Identify Failed League**
   ```bash
   # Check specific league attestation
   cat out/ops/cutover/metrics/100/NBA_attestation_*.md
   ```

2. **Review Error Details**
   - Check `error` field in JSON attestation
   - Review Docker logs for failed service
   - Verify database schema alignment

3. **Remediate & Retry**
   - Fix identified issues
   - Re-run validation
   - Confirm PASS before proceeding

## SLO Reference

| Metric | Target | Typical | Warning |
|--------|--------|---------|---------|
| API p95 | <150ms | 100-130ms | >200ms |
| DB p95 | <50ms | 25-40ms | >100ms |
| Error Rate | <0.5% | 0.0% | >1.0% |
| Publish Lag | <60s | 30-50s | >90s |

**Note:** Windows/Docker Desktop may show higher DB p95 (50-80ms) due to virtualization. This is expected and documented.

## Emergency Contacts

| Issue Type | Contact | Response Time |
|------------|---------|---------------|
| Script Errors | Engineering Team | <1 hour |
| Infrastructure | DevOps Team | <30 min |
| Database Issues | DBA Team | <1 hour |
| Production Blocker | On-Call Engineer | Immediate |

## Advanced Options

### Run Single League
```powershell
# Modify script to test only NBA
# (Edit LEAGUE_CONFIGS to include only NBA)
```

### Skip Schema Refresh
```powershell
# Comment out Step 1 in script
# (Use when schema is known to be current)
```

### Verbose Logging
```powershell
# Set LOG_LEVEL=debug in .env
echo "LOG_LEVEL=debug" >> .env
```

### Shadow Mode (No Discord)
```powershell
# Set SHADOW_MODE=true in .env
echo "SHADOW_MODE=true" >> .env
```

## Validation Checklist

Before running validation:
- [ ] Docker Desktop running and healthy
- [ ] `.env` file present with all required variables
- [ ] `CAPPER_ID` configured
- [ ] Supabase credentials valid
- [ ] Discord bot token present (if not using SHADOW_MODE)
- [ ] Workspace at repository root
- [ ] No other services using ports 3000-3010

After successful validation:
- [ ] All 4 leagues show PASS
- [ ] SLOs within targets
- [ ] Artifacts generated
- [ ] Command Center accessible
- [ ] Picks visible in UI
- [ ] Discord messages posted (if not SHADOW_MODE)

## FAQ

**Q: How long does validation take?**  
A: 5-10 minutes for all 4 leagues.

**Q: Can I run validation in CI/CD?**  
A: Yes, see `E2E_VALIDATION_README.md` for GitHub Actions example.

**Q: What if one league fails?**  
A: Script continues testing other leagues. Review failed league's attestation for details.

**Q: Do I need Supabase CLI?**  
A: No, it's optional. Script uses runtime header bypass as fallback.

**Q: Can I test against production Supabase?**  
A: Yes, but use `SHADOW_MODE=true` to prevent Discord spam.

**Q: What's the difference between DRY-RUN and LIVE?**  
A: DRY-RUN validates without database writes. LIVE creates actual picks.

**Q: How do I clean up test data?**  
A: Test picks are marked with `betSlipId` containing "e2e-live-{LEAGUE}-{TIMESTAMP}". Query and delete as needed.

---

**Last Updated:** 2025-01-28  
**Version:** 1.0.0  
**Maintained By:** Unit Talk Engineering

