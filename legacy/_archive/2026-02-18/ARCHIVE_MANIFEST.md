# Archive Manifest

**Audit:** REPO-HYGIENE-001
**Archived:** 2026-02-18

---

## Archived Items

### Apps

| Original Location | Reason | Restore Command |
|-------------------|--------|-----------------|
| `apps/shared/` | Not imported by any code | `mv legacy/_archive/2026-02-18/apps/shared apps/shared` |
| `apps/out/` | Stray build output | `mv legacy/_archive/2026-02-18/apps/out apps/out` |
| `apps/final-production-readiness/` | Legacy bundle (Sep 2024) | `mv legacy/_archive/2026-02-18/apps/final-production-readiness apps/` |
| `apps/production-readiness-bundle/` | Legacy bundle (Sep 2024) | `mv legacy/_archive/2026-02-18/apps/production-readiness-bundle apps/` |

### Root Folders

| Original Location | Reason | Restore Command |
|-------------------|--------|-----------------|
| `qa-framework/` | QA suite not in CI | `mv legacy/_archive/2026-02-18/root-folders/qa-framework qa-framework` |
| `migrations/` | Canonical: supabase/migrations | `mv legacy/_archive/2026-02-18/root-folders/migrations migrations` |
| `analytics/` | dbt models not in use | `mv legacy/_archive/2026-02-18/root-folders/analytics analytics` |
| `runtime_config/` | Runtime state not referenced | `mv legacy/_archive/2026-02-18/root-folders/runtime_config runtime_config` |

### Tool Configs

| Original Location | Tool | Restore Command |
|-------------------|------|-----------------|
| `.augment/` | Augment Code | `mv legacy/_archive/2026-02-18/tool-configs/augment .augment` |
| `.clinerules/` | Unknown | `mv legacy/_archive/2026-02-18/tool-configs/clinerules .clinerules` |
| `.swarm/` | Unknown | `mv legacy/_archive/2026-02-18/tool-configs/swarm .swarm` |
| `.claude-flow/` | Claude Flow (old) | `mv legacy/_archive/2026-02-18/tool-configs/claude-flow .claude-flow` |

---

## Deleted Items (Not Recoverable from Archive)

| Item | Reason | Recovery |
|------|--------|----------|
| `unit-talk-production/` (nested) | Full duplicate clone (81,934 files) | Re-clone if needed |

---

## Consolidations

| From | To | Action |
|------|-----|--------|
| `infra/observability/` | `infrastructure/observability/` | Moved contents |
| `infra/` | (deleted) | Empty folder removed |

---

## Verification

After archiving, these builds passed:
- [ ] `npm run type-check`
- [ ] `npm run build`
- [ ] All apps compile

---

## Rollback

To fully rollback this archive:

```bash
# Restore all apps
mv legacy/_archive/2026-02-18/apps/* apps/

# Restore root folders
mv legacy/_archive/2026-02-18/root-folders/* ./

# Restore tool configs
mv legacy/_archive/2026-02-18/tool-configs/augment .augment
mv legacy/_archive/2026-02-18/tool-configs/clinerules .clinerules
mv legacy/_archive/2026-02-18/tool-configs/swarm .swarm
mv legacy/_archive/2026-02-18/tool-configs/claude-flow .claude-flow

# Restore infra (reverse consolidation)
mkdir infra
mv infrastructure/observability infra/observability
```
