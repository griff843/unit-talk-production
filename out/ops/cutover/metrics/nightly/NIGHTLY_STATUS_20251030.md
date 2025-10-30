# Nightly Canonical Validation Report
**Date:** 20251030  
**Timestamp:** 2025-10-30T15:39:33.509Z  
**Charter Version:** 3.0  
**Overall Status:** ⚠️ WARN

---

## Validation Results

### 1. RLS Policies
**Status:** PASS

{
  "status": "PASS",
  "details": {
    "picks": {
      "accessible": true,
      "error": null
    },
    "pick_publish": {
      "accessible": true,
      "error": null
    },
    "unified_picks": {
      "accessible": true,
      "error": null
    }
  },
  "note": "RLS policies exist but are disabled by default per Charter (staged rollout required)"
}

### 2. Picks Visibility
**Status:** PASS

- **picks:** ✅ Visible
- **pick_publish:** ✅ Visible
- **unified_picks:** ✅ Visible

**Counts:**
{
  "picks": 5,
  "pick_publish": 0,
  "unified_picks": 1
}

### 3. Publish Lag (SLO: p95 < 60s)
**Status:** WARN


**Note:** No published picks in last 24 hours


### 4. Alert Status
**Status:** WARN

- **Total Agents:** 0
- **Unhealthy Agents:** 0

---

## Recommendations


⚠️ Some validations returned warnings. Review details above.


---

**Generated:** 2025-10-30T15:39:34.299Z  
**Charter Reference:** [docs/PRODUCTION_CHARTER.md](../../docs/PRODUCTION_CHARTER.md)
