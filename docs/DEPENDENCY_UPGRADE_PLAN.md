# Dependency Upgrade Plan
**Generated**: October 2025  
**Based on**: DEP_HEALTH.md audit report  
**Status**: Planning phase - no upgrades executed yet

---

## Overview

This document outlines the phased approach to upgrading 30+ outdated dependencies identified in the Phase 3 audit. Upgrades are prioritized by risk and impact, with breaking changes tested in staging before production deployment.

---

## Upgrade Phases

### Phase 1: Critical Security Patches (Week 1)
**Priority**: P0 (Critical)  
**Risk**: Low (patch versions only)  
**Downtime**: None

```bash
# Safe patch upgrades (no breaking changes)
npm update --save
npm audit fix
```

**Packages**:
- All patch version updates (e.g., 1.2.3 → 1.2.4)
- Security vulnerability fixes
- Bug fixes with no API changes

**Verification**:
- Run full test suite
- Verify build passes
- Check for runtime errors in staging

---

### Phase 2: OpenTelemetry Stack (Week 2-3)
**Priority**: P0 (Critical)  
**Risk**: High (162 minor versions behind)  
**Downtime**: Potential observability gaps during upgrade

**Current**: 0.45.x  
**Target**: 0.207.x  
**Gap**: 162 minor versions

**Incremental Upgrade Path**:
1. **0.45 → 0.100** (Week 2, Day 1-2)
   - Review breaking changes in 0.50-0.100 range
   - Update instrumentation code
   - Test in staging
   - Deploy to production
   - Monitor for 24 hours

2. **0.100 → 0.150** (Week 2, Day 3-4)
   - Review breaking changes in 0.100-0.150 range
   - Update exporter configurations
   - Test in staging
   - Deploy to production
   - Monitor for 24 hours

3. **0.150 → 0.207** (Week 2, Day 5-7)
   - Review breaking changes in 0.150-0.207 range
   - Update semantic conventions
   - Test in staging
   - Deploy to production
   - Monitor for 48 hours

**Affected Packages**:
```json
{
  "@opentelemetry/auto-instrumentations-node": "0.41.1 → 0.66.0",
  "@opentelemetry/exporter-prometheus": "0.48.0 → 0.207.0",
  "@opentelemetry/instrumentation": "0.45.1 → 0.207.0",
  "@opentelemetry/sdk-node": "0.45.1 → 0.207.0"
}
```

**Rollback Plan**:
- Keep previous version in `package.json.backup`
- Monitor Prometheus metrics for anomalies
- Rollback if error rate > 1% or metrics gaps detected

---

### Phase 3: Notion API Client (Week 4)
**Priority**: P1 (High)  
**Risk**: Medium (3 major versions behind)  
**Downtime**: None (feature flag controlled)

**Current**: `@notionhq/client@2.3.0`  
**Target**: `@notionhq/client@5.3.0`  
**Gap**: 3 major versions

**Migration Steps**:
1. Review Notion API v5 migration guide
2. Create feature flag: `NOTION_API_V5_ENABLED=false`
3. Update RecapAgent and NotificationAgent code
4. Test in sandbox Notion workspace
5. Enable feature flag in staging
6. Monitor for 48 hours
7. Enable in production

**Affected Agents**:
- RecapAgent (daily recap generation)
- NotificationAgent (Discord notifications)

**Breaking Changes**:
- API signature changes (likely)
- Authentication flow updates (possible)
- Rate limiting changes (possible)

---

### Phase 4: Anthropic SDK (Week 5)
**Priority**: P1 (High)  
**Risk**: Medium (12 minor versions behind)  
**Downtime**: None

**Current**: `@anthropic-ai/sdk@0.55.0`  
**Target**: `@anthropic-ai/sdk@0.67.0`  
**Gap**: 12 minor versions

**Migration Steps**:
1. Review Anthropic SDK changelog (0.55 → 0.67)
2. Update Enhanced45FactorEngine scoring logic
3. Test with sample props in staging
4. Compare scoring results (old vs new)
5. Deploy to production
6. Monitor scoring accuracy

**Affected Components**:
- Enhanced45FactorEngine (core scoring)
- ScoringAgent (prop evaluation)

---

### Phase 5: Minor Dependency Updates (Week 6)
**Priority**: P2 (Medium)  
**Risk**: Low  
**Downtime**: None

**Packages** (20+ minor updates):
- `discord.js` (14.x → 14.latest)
- `@supabase/supabase-js` (2.x → 2.latest)
- `next` (14.x → 14.latest)
- `react` (18.x → 18.latest)
- `typescript` (5.x → 5.latest)

**Approach**:
```bash
npm update --save
npm dedupe
npm audit fix
```

**Verification**:
- TypeScript compilation passes
- All tests pass
- No runtime errors in staging

---

## Verification Checklist

### Pre-Upgrade
- [ ] Create backup branch: `git checkout -b backup/pre-upgrade-$(date +%Y%m%d)`
- [ ] Document current versions: `npm list --depth=0 > versions-before.txt`
- [ ] Run full test suite: `npm test`
- [ ] Verify build passes: `npm run build`
- [ ] Check staging environment health

### Post-Upgrade
- [ ] Run full test suite: `npm test`
- [ ] Verify build passes: `npm run build`
- [ ] Check for TypeScript errors: `npm run type-check`
- [ ] Deploy to staging
- [ ] Monitor for 24-48 hours
- [ ] Check error rates in Prometheus
- [ ] Verify agent health (all pings < 2 min)
- [ ] Run gate verification: `npm run ops:verify`
- [ ] Deploy to production
- [ ] Monitor for 48 hours

---

## Rollback Procedures

### Immediate Rollback (Critical Failure)
```bash
# Revert to previous version
git checkout backup/pre-upgrade-YYYYMMDD
npm ci
npm run build
# Redeploy to production
```

### Partial Rollback (Single Package)
```bash
# Revert specific package
npm install package-name@previous-version
npm run build
# Redeploy to production
```

---

## Monitoring & Alerts

### Key Metrics to Monitor
- **Error Rate**: Should remain < 1%
- **Response Time**: Should not increase > 10%
- **Agent Health**: All pings < 2 minutes
- **Gate Pass Rate**: Should remain 100%
- **Build Success Rate**: Should remain 100%

### Alert Thresholds
- Error rate > 1% → Immediate investigation
- Response time > 2000ms → Review performance
- Agent stale > 2 min → Check agent health
- Gate failure → Rollback immediately

---

## Dependencies NOT to Upgrade

### Pinned Versions (Do Not Touch)
- `node` (20.x) - LTS version, stable
- `npm` (10.x) - Matches Node LTS
- `postgres` (15.x) - Database version locked

### Deprecated Packages (Remove Instead)
- None identified in current audit

---

## Post-Upgrade Actions

### Week 7: Cleanup
- [ ] Remove backup branches
- [ ] Update `DEPENDENCY_UPGRADE_PLAN.md` with results
- [ ] Document any breaking changes encountered
- [ ] Update `package-lock.json` in Git
- [ ] Run `npm dedupe` to optimize dependency tree
- [ ] Generate new `DEP_HEALTH.md` audit report
- [ ] Close Phase 4 dependency health issue

---

## References

- [DEP_HEALTH.md](../out/ops/audit/DEP_HEALTH.md) - Original audit report
- [npm update docs](https://docs.npmjs.com/cli/v10/commands/npm-update)
- [OpenTelemetry Migration Guide](https://opentelemetry.io/docs/migration/)
- [Notion API v5 Migration](https://developers.notion.com/reference/versioning)
- [Anthropic SDK Changelog](https://github.com/anthropics/anthropic-sdk-typescript/releases)

---

**Last Updated**: October 2025  
**Next Review**: After Phase 5 completion (Week 6)

