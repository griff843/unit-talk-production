# Advanced Features Integration Rollback Procedures

**Document Version:** 1.0
**Date:** 2025-09-23
**Scope:** Complete rollback procedures for all integrated advanced features
**Criticality:** HIGH - Production safety procedures

## 🚨 Emergency Rollback Overview

This document provides step-by-step rollback procedures for all newly integrated advanced features in the Unit Talk platform. Each rollback procedure is designed to restore system functionality to the previous working state while minimizing downtime.

### **Quick Rollback Summary**
| Component | Rollback Time | Risk Level | Dependencies |
|-----------|---------------|------------|--------------|
| Database Schema | 5-10 minutes | LOW | Supabase access |
| Steam Detection Engine | 2-3 minutes | LOW | AlertAgent restart |
| Line Shopping Engine | 2-3 minutes | LOW | FeedAgent restart |
| Enhanced Injury Analysis | 2-3 minutes | LOW | AlertAgent restart |
| Settlement Automation | 3-5 minutes | MEDIUM | Temporal workflows |
| API Quota Coordinator | 2-3 minutes | LOW | Service restart |
| Discord Integration | 1-2 minutes | LOW | Code deployment |
| Health Monitoring | 1-2 minutes | LOW | Service restart |

---

## 1. 🗄️ Database Schema Rollback

**Rollback Target:** Remove advanced features schema (steam_moves, best_odds, injury_impacts, etc.)
**Risk Level:** LOW
**Estimated Time:** 5-10 minutes

### **Prerequisites**
```bash
# Verify database connection
docker-compose exec api npm run db:status
```

### **Step-by-Step Rollback**

#### **1.1 Execute Schema Rollback Migration**
```sql
-- File: apps/api/migrations/rollback_024_advanced_features_schema.sql

BEGIN;

-- Drop advanced features tables in reverse dependency order
DROP TABLE IF EXISTS arbitrage_opportunities CASCADE;
DROP TABLE IF EXISTS injury_impacts CASCADE;
DROP TABLE IF EXISTS best_odds CASCADE;
DROP TABLE IF EXISTS steam_moves CASCADE;
DROP TABLE IF EXISTS players CASCADE;

-- Drop API quota management tables
DROP TABLE IF EXISTS api_emergency_states CASCADE;
DROP TABLE IF EXISTS api_quota_usage CASCADE;
DROP TABLE IF EXISTS api_quota_configs CASCADE;

-- Drop views
DROP VIEW IF EXISTS daily_quota_usage CASCADE;
DROP VIEW IF EXISTS monthly_quota_usage CASCADE;
DROP VIEW IF EXISTS current_quota_status CASCADE;

COMMIT;
```

#### **1.2 Apply Rollback Migration**
```bash
# Execute rollback migration
docker-compose exec api npx supabase migration up --db-url $DATABASE_URL --file rollback_024_advanced_features_schema.sql

# Verify rollback completed
docker-compose exec api npm run db:status
```

#### **1.3 Validation**
```bash
# Verify tables are removed
docker-compose exec postgres psql -U postgres -d unittalk -c "
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('steam_moves', 'best_odds', 'injury_impacts', 'arbitrage_opportunities', 'api_quota_configs');"
```

**Expected Result:** No rows returned (tables removed)

---

## 2. 🌊 Steam Detection Engine Rollback

**Rollback Target:** Remove SteamDetectionIntegrator from AlertAgent
**Risk Level:** LOW
**Estimated Time:** 2-3 minutes

### **Step-by-Step Rollback**

#### **2.1 Remove Steam Detection Integration**
```bash
# Remove SteamDetectionIntegrator file
rm apps/api/src/agents/AlertAgent/SteamDetectionIntegrator.ts

# Restore original AlertAgent index.ts
git checkout HEAD^ -- apps/api/src/agents/AlertAgent/index.ts
```

#### **2.2 Clean Steam Detection Imports**
Edit `apps/api/src/agents/AlertAgent/index.ts`:
```typescript
// Remove these lines:
// import { SteamDetectionIntegrator } from './SteamDetectionIntegrator';
// private steamDetectionIntegrator?: SteamDetectionIntegrator;

// Remove from initializeSophisticatedComponents():
// this.steamDetectionIntegrator = new SteamDetectionIntegrator(this.supabase!, this.logger);

// Remove from metrics:
// steamMovesDetected: 0,
// steamAlertsGenerated: 0,
// steamDetectionLatency: 0,
```

#### **2.3 Restart AlertAgent**
```bash
# Restart services to apply changes
docker-compose restart api
```

#### **2.4 Validation**
```bash
# Check AlertAgent logs for clean startup
docker-compose logs api | grep "AlertAgent" | tail -10
```

**Expected Result:** No steam detection related errors or mentions

---

## 3. 🛒 Line Shopping Engine Rollback

**Rollback Target:** Remove database persistence and API quota integration
**Risk Level:** LOW
**Estimated Time:** 2-3 minutes

### **Step-by-Step Rollback**

#### **3.1 Restore Original LineShoppingEngine**
```bash
# Restore original LineShoppingEngine
git checkout HEAD^ -- apps/api/src/services/LineShoppingEngine.ts
```

#### **3.2 Remove API Quota Integration from FeedAgent**
Edit `apps/api/src/agents/FeedAgent/activities/fetchFromProvider.ts`:
```typescript
// Remove quota coordinator import:
// import { apiQuotaCoordinator } from '../../../services/APIQuotaCoordinator';

// Remove quota check logic:
// const quotaCheck = await apiQuotaCoordinator.requestAPIAccess(...);
// if (!quotaCheck.allowed) { ... }

// Restore direct fetch without quota checking
```

#### **3.3 Validation**
```bash
# Restart and test
docker-compose restart api
docker-compose logs api | grep "LineShoppingEngine" | tail -5
```

**Expected Result:** Line shopping works without database persistence

---

## 4. 🏥 Enhanced Injury Analysis Rollback

**Rollback Target:** Remove injury impact database storage
**Risk Level:** LOW
**Estimated Time:** 2-3 minutes

### **Step-by-Step Rollback**

#### **4.1 Restore Original AlertAgent Activities**
```bash
# Restore original activities/index.ts
git checkout HEAD^ -- apps/api/src/agents/AlertAgent/activities/index.ts
```

#### **4.2 Remove Enhanced Injury Analysis**
Remove from `apps/api/src/agents/AlertAgent/activities/index.ts`:
```typescript
// Remove function:
// export async function storeInjuryImpact(...)

// Remove enhanced injury analysis logic from existing functions
```

#### **4.3 Validation**
```bash
# Restart and verify
docker-compose restart api
docker-compose logs api | grep "injury" | tail -5
```

**Expected Result:** Injury analysis works without database persistence

---

## 5. ✅ Settlement Automation Rollback

**Rollback Target:** Remove settlement workflow integration
**Risk Level:** MEDIUM
**Estimated Time:** 3-5 minutes

### **Step-by-Step Rollback**

#### **5.1 Restore Original Temporal Workflows**
```bash
# Restore original workflows index
git checkout HEAD^ -- apps/api/src/workflows/index.ts

# Remove settlement activities file
rm -f apps/api/src/activities/settlementActivities.ts
```

#### **5.2 Clean Settlement Integration**
Remove from `apps/api/src/workflows/index.ts`:
```typescript
// Remove settlementActivities import and proxy
// const settlementActivities = proxyActivities<typeof settlement>({...});
```

#### **5.3 Restart Temporal Workers**
```bash
# Restart to clear settlement workflows
docker-compose restart api
docker-compose exec api npm run temporal:worker:restart
```

#### **5.4 Validation**
```bash
# Check Temporal workflows
docker-compose logs api | grep "temporal" | tail -10
```

**Expected Result:** Settlement workflows removed from Temporal

---

## 6. 📊 API Quota Coordinator Rollback

**Rollback Target:** Remove centralized API quota management
**Risk Level:** LOW
**Estimated Time:** 2-3 minutes

### **Step-by-Step Rollback**

#### **6.1 Remove API Quota Coordinator**
```bash
# Remove APIQuotaCoordinator service
rm apps/api/src/services/APIQuotaCoordinator.ts

# Remove API quota management migration
rm apps/api/migrations/025_api_quota_management.sql
```

#### **6.2 Clean FeedAgent Integration**
Edit `apps/api/src/agents/FeedAgent/activities/fetchFromProvider.ts`:
```typescript
// Remove import:
// import { apiQuotaCoordinator } from '../../../services/APIQuotaCoordinator';

// Remove quota check and restore direct API calls
```

#### **6.3 Validation**
```bash
# Restart and test API calls work directly
docker-compose restart api
docker-compose logs api | grep -i "quota" | tail -5
```

**Expected Result:** No quota management references in logs

---

## 7. 🎮 Discord Integration Rollback

**Rollback Target:** Remove advanced alert type support
**Risk Level:** LOW
**Estimated Time:** 1-2 minutes

### **Step-by-Step Rollback**

#### **7.1 Restore Original embedBuilder**
```bash
# Restore original embedBuilder.ts
git checkout HEAD^ -- apps/api/src/agents/AlertAgent/embedBuilder.ts
```

#### **7.2 Validation**
```bash
# Test Discord integration still works
docker-compose restart api
```

**Expected Result:** Discord works with standard pick alerts only

---

## 8. 🏥 Health Monitoring Rollback

**Rollback Target:** Remove advanced features health checks
**Risk Level:** LOW
**Estimated Time:** 1-2 minutes

### **Step-by-Step Rollback**

#### **8.1 Restore Original Health Checks**
```bash
# Restore original enhanced-health-checks.ts
git checkout HEAD^ -- apps/api/src/monitoring/enhanced-health-checks.ts

# Restore original health routes
git checkout HEAD^ -- apps/api/src/routes/health.ts
```

#### **8.2 Validation**
```bash
# Test health endpoints
curl http://localhost:3000/health
curl http://localhost:3000/health/enhanced
```

**Expected Result:** Health checks work without advanced features monitoring

---

## 🚀 Complete System Rollback Procedure

**Use this when rolling back ALL advanced features simultaneously**
**Total Time:** 15-20 minutes
**Risk Level:** MEDIUM

### **Emergency Full Rollback Script**
```bash
#!/bin/bash
# File: rollback-advanced-features.sh

set -e
echo "🚨 Starting complete advanced features rollback..."

# 1. Database schema rollback
echo "📊 Rolling back database schema..."
docker-compose exec api npx supabase migration up --db-url $DATABASE_URL --file rollback_024_advanced_features_schema.sql

# 2. Code rollbacks
echo "🔄 Rolling back code changes..."
git checkout HEAD^ -- apps/api/src/agents/AlertAgent/index.ts
git checkout HEAD^ -- apps/api/src/services/LineShoppingEngine.ts
git checkout HEAD^ -- apps/api/src/agents/AlertAgent/activities/index.ts
git checkout HEAD^ -- apps/api/src/workflows/index.ts
git checkout HEAD^ -- apps/api/src/agents/AlertAgent/embedBuilder.ts
git checkout HEAD^ -- apps/api/src/monitoring/enhanced-health-checks.ts
git checkout HEAD^ -- apps/api/src/routes/health.ts

# 3. Remove new files
echo "🗑️ Removing integration files..."
rm -f apps/api/src/agents/AlertAgent/SteamDetectionIntegrator.ts
rm -f apps/api/src/services/APIQuotaCoordinator.ts
rm -f apps/api/src/activities/settlementActivities.ts
rm -f apps/api/migrations/025_api_quota_management.sql

# 4. Restart services
echo "♻️ Restarting services..."
docker-compose restart api
docker-compose exec api npm run temporal:worker:restart

# 5. Validation
echo "✅ Validating rollback..."
sleep 10
curl -f http://localhost:3000/health || echo "❌ Health check failed"

echo "✅ Advanced features rollback completed"
```

### **Execute Full Rollback**
```bash
chmod +x rollback-advanced-features.sh
./rollback-advanced-features.sh
```

---

## 🔍 Post-Rollback Validation Checklist

### **System Health Validation**
- [ ] API responds at http://localhost:3000/health
- [ ] Database connectivity restored
- [ ] AlertAgent starts without errors
- [ ] FeedAgent processes props normally
- [ ] ScoringAgent (Enhanced45FactorEngine) works normally
- [ ] Discord integration functional
- [ ] No advanced features tables exist in database
- [ ] No advanced features errors in logs

### **Performance Validation**
- [ ] Response times back to baseline
- [ ] Memory usage normalized
- [ ] No quota management overhead
- [ ] Temporal workflows clean

### **Validation Commands**
```bash
# Health check
curl http://localhost:3000/health

# Database validation
docker-compose exec postgres psql -U postgres -d unittalk -c "SELECT COUNT(*) FROM raw_props;"

# Log validation (should show no advanced features errors)
docker-compose logs api --tail=100 | grep -i "error\|warn\|steam\|quota\|injury"

# Performance check
docker stats --no-stream
```

---

## 📞 Emergency Contacts & Escalation

### **Rollback Escalation Procedures**
1. **Level 1 (0-5 min)**: Execute automated rollback scripts
2. **Level 2 (5-15 min)**: Manual component-by-component rollback
3. **Level 3 (15+ min)**: Full system restore from backup

### **Emergency Contacts**
- **Platform Engineering Team**: Primary escalation
- **DevOps Team**: Infrastructure issues
- **Database Team**: Schema rollback issues

### **Backup Procedures**
- **Database Backup**: Automatic daily backups available
- **Code Repository**: Git history preserved
- **Configuration Backup**: Docker compose and environment files

---

## 📝 Rollback Documentation Requirements

### **Post-Rollback Documentation**
1. **Incident Report**: Document what triggered rollback
2. **Rollback Log**: Record which procedures were executed
3. **Validation Results**: Confirm system health post-rollback
4. **Lessons Learned**: Identify improvements for future deployments

### **Rollback Success Criteria**
- ✅ System returns to previous functional state
- ✅ No data loss or corruption
- ✅ Performance metrics return to baseline
- ✅ All core functionality operational
- ✅ Zero customer impact post-rollback

---

**END OF DOCUMENT**

*This rollback guide ensures safe and systematic removal of all advanced features integrations while preserving core Unit Talk platform functionality.*