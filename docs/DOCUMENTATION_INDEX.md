# Documentation Index

Status: CANONICAL Authority: Tier 1 Owner: Platform Architecture Last Verified:
2026-03-07 Sprint: SPRINT-DOCS-CANONICALIZATION-040

---

## Overview

Total markdown files in repository: 514

- `.claude/` (AI governance): 38
- Root-level docs: 30
- `docs/`: ~140
- `architecture/` (design-layer contracts): 82
- `governance/` (ratification records): 48
- `apps/` (per-app docs): ~120
- `packages/`: 7
- `infrastructure/`, `scripts/`, `tests/`, `tools/`, `legacy/`: ~20
- `.github/`: 3

---

## Classification Legend

| Classification   | Meaning                                               |
| ---------------- | ----------------------------------------------------- |
| CANONICAL        | Authoritative, actively maintained, source of truth   |
| REFERENCE        | Useful reference material, not authoritative          |
| ARCHIVE          | Historical value only, should move to archive         |
| SESSION_ARTIFACT | AI session output committed as docs, no ongoing value |
| DUPLICATE        | Content exists elsewhere in a canonical location      |
| MISPLACED        | Correct content, wrong location                       |
| EMPTY            | File exists but has no content                        |

## Action Legend

| Action               | Meaning                                     |
| -------------------- | ------------------------------------------- |
| KEEP                 | No change needed                            |
| MOVE                 | Relocate to correct canonical path          |
| ARCHIVE              | Move to `docs/archive/`                     |
| MERGE                | Consolidate into surviving canonical doc    |
| DELETE_AFTER_ARCHIVE | Archive first, then remove from active tree |

---

## 1. Root-Level Files

### Canonical (KEEP at root)

| File                           | Classification | Action | Destination |
| ------------------------------ | -------------- | ------ | ----------- |
| `README.md`                    | CANONICAL      | KEEP   | Root        |
| `CLAUDE.md`                    | CANONICAL      | KEEP   | Root        |
| `CLAUDE_EXECUTION_CONTRACT.md` | CANONICAL      | KEEP   | Root        |
| `CHANGELOG.md`                 | CANONICAL      | KEEP   | Root        |

### Move to docs/

| File                                              | Classification | Action | Destination                                                    |
| ------------------------------------------------- | -------------- | ------ | -------------------------------------------------------------- |
| `SCHEMA_MIGRATION_MAPPING.md`                     | REFERENCE      | MOVE   | `docs/database/SCHEMA_MIGRATION_MAPPING.md`                    |
| `DISCORD_SERVER_AUDIT_AND_ONBOARDING_STRATEGY.md` | REFERENCE      | MOVE   | `docs/discord/DISCORD_SERVER_AUDIT_AND_ONBOARDING_STRATEGY.md` |
| `NON_NEGOTIABLE_SHARP_GRADING_RULES.md`           | REFERENCE      | MOVE   | `docs/archive/analysis/NON_NEGOTIABLE_SHARP_GRADING_RULES.md`  |

### Archive (historical value, wrong location)

| File                                            | Classification   | Action  | Destination                        |
| ----------------------------------------------- | ---------------- | ------- | ---------------------------------- |
| `ARCHITECTURE_AUDIT_SUMMARY.md`                 | SESSION_ARTIFACT | ARCHIVE | `docs/archive/historical-plans/`   |
| `APP-LAUNCHER-README.md`                        | ARCHIVE          | ARCHIVE | `docs/archive/deprecated-systems/` |
| `CAPPER_INSIGHTS_ANALYSIS.md`                   | ARCHIVE          | ARCHIVE | `docs/archive/analysis/`           |
| `FINAL_REPORT.md`                               | MISPLACED        | ARCHIVE | `docs/archive/sprint-artifacts/`   |
| `OPERATOR_FINAL_INSTRUCTIONS.md`                | SESSION_ARTIFACT | ARCHIVE | `docs/archive/session-reports/`    |
| `PRODUCT_REQUIREMENTS_DOCUMENT.md`              | ARCHIVE          | ARCHIVE | `docs/archive/historical-plans/`   |
| `PRODUCTION_DEPLOYMENT_CHECKLIST.md`            | SESSION_ARTIFACT | ARCHIVE | `docs/archive/sprint-artifacts/`   |
| `PROFESSIONAL_SYSTEM_IMPLEMENTATION_SUMMARY.md` | SESSION_ARTIFACT | ARCHIVE | `docs/archive/sprint-artifacts/`   |
| `RADIX_UI_FIX_SUMMARY.md`                       | ARCHIVE          | ARCHIVE | `docs/archive/sprint-artifacts/`   |
| `STEP_7_ACCEPTANCE_PACKAGE.md`                  | SESSION_ARTIFACT | ARCHIVE | `docs/archive/sprint-artifacts/`   |
| `TECHNICAL_IMPLEMENTATION_PLAN.md`              | ARCHIVE          | ARCHIVE | `docs/archive/historical-plans/`   |
| `TECHNICAL_IMPLEMENTATION_PLAN_PART1.md`        | ARCHIVE          | ARCHIVE | `docs/archive/historical-plans/`   |
| `TRIAGE.md`                                     | ARCHIVE          | ARCHIVE | `docs/archive/sprint-artifacts/`   |
| `VERIFICATION_BUNDLE_v3.0.0.md`                 | SESSION_ARTIFACT | ARCHIVE | `docs/archive/sprint-artifacts/`   |
| `rules.md`                                      | DUPLICATE        | ARCHIVE | `docs/archive/deprecated-systems/` |
| `tools.md`                                      | ARCHIVE          | ARCHIVE | `docs/archive/deprecated-systems/` |

### Delete after archive (fully superseded)

| File                                        | Classification   | Action               | Destination                        |
| ------------------------------------------- | ---------------- | -------------------- | ---------------------------------- |
| `BUSINESS-LOGIC-ADJUSTMENTS-REQUIRED.md`    | SESSION_ARTIFACT | DELETE_AFTER_ARCHIVE | `docs/archive/session-reports/`    |
| `BUSINESS-LOGIC-IMPLEMENTATION-COMPLETE.md` | SESSION_ARTIFACT | DELETE_AFTER_ARCHIVE | `docs/archive/session-reports/`    |
| `DAILY_PROP_FLOW_ANALYSIS.md`               | SESSION_ARTIFACT | DELETE_AFTER_ARCHIVE | `docs/archive/session-reports/`    |
| `database-schema-migration-plan.md`         | ARCHIVE          | DELETE_AFTER_ARCHIVE | `docs/archive/historical-plans/`   |
| `label-popup-snapshot.md`                   | SESSION_ARTIFACT | DELETE_AFTER_ARCHIVE | `docs/archive/session-reports/`    |
| `notion-workspace-blueprint.md`             | ARCHIVE          | DELETE_AFTER_ARCHIVE | `docs/archive/deprecated-systems/` |
| `RELEASE_STATUS_SUMMARY.md`                 | DUPLICATE        | DELETE_AFTER_ARCHIVE | `docs/archive/session-reports/`    |
| `saas-database-architecture-plan.md`        | ARCHIVE          | DELETE_AFTER_ARCHIVE | `docs/archive/historical-plans/`   |
| `WEEK-1-IMPLEMENTATION-COMPLETE.md`         | SESSION_ARTIFACT | DELETE_AFTER_ARCHIVE | `docs/archive/session-reports/`    |

---

## 2. `.claude/` Directory (38 files) — ALL KEEP

| File                                                     | Classification | Action | Destination |
| -------------------------------------------------------- | -------------- | ------ | ----------- |
| `.claude/agents/*.md` (24 files)                         | CANONICAL      | KEEP   | Current     |
| `.claude/rules/*.md` (6 files)                           | CANONICAL      | KEEP   | Current     |
| `.claude/skills/*.md` (7 files)                          | CANONICAL      | KEEP   | Current     |
| `.claude/commands/analysis/COMMAND_COMPLIANCE_REPORT.md` | CANONICAL      | KEEP   | Current     |
| `.claude/hooks/README.md`                                | REFERENCE      | KEEP   | Current     |

---

## 3. `.github/` Directory (3 files)

| File                               | Classification | Action               | Destination                        |
| ---------------------------------- | -------------- | -------------------- | ---------------------------------- |
| `.github/pull_request_template.md` | CANONICAL      | KEEP                 | Current                            |
| `.github/copilot-instructions.md`  | ARCHIVE        | DELETE_AFTER_ARCHIVE | `docs/archive/deprecated-systems/` |
| `.github/SETUP.md`                 | ARCHIVE        | DELETE_AFTER_ARCHIVE | `docs/archive/deprecated-systems/` |

---

## 4. `architecture/` Directory (82 files) — ROOT-LEVEL CANONICAL

Design-layer contracts. Created by DOC_TAXONOMY_LOCK sprint (2026-02-26). Stays
at root per Constitution Section 1.4.

### Active contracts — KEEP

| File                                            | Classification | Action |
| ----------------------------------------------- | -------------- | ------ |
| `architecture/CONSTITUTION_v1.0.md`             | CANONICAL      | KEEP   |
| `architecture/canonical-data-model/*.md` (2)    | CANONICAL      | KEEP   |
| `architecture/contracts/discord/*.md` (1)       | CANONICAL      | KEEP   |
| `architecture/contracts/distribution/*.md` (10) | CANONICAL      | KEEP   |
| `architecture/contracts/operational/*.md` (18)  | CANONICAL      | KEEP   |
| `architecture/contracts/repo-truth/*.md` (16)   | CANONICAL      | KEEP   |
| `architecture/data-model/*.md` (1)              | CANONICAL      | KEEP   |
| `architecture/distribution/README.md`           | REFERENCE      | KEEP   |
| `architecture/failure-model/*.md` (1)           | CANONICAL      | KEEP   |
| `architecture/phases/*.md` (3)                  | CANONICAL      | KEEP   |
| `architecture/repo-boundaries/*.md` (1)         | CANONICAL      | KEEP   |
| `architecture/stack-decision/*.md` (1)          | CANONICAL      | KEEP   |
| `architecture/state-machines/*.md` (2)          | CANONICAL      | KEEP   |

### Already archived — KEEP as-is

| File                              | Classification | Action                  |
| --------------------------------- | -------------- | ----------------------- |
| `architecture/_archive/*.md` (20) | ARCHIVE        | KEEP (already archived) |

---

## 5. `governance/` Directory (48 files) — ROOT-LEVEL CANONICAL

Governance process records. Created by GOVERNANCE-CONSOLIDATION-LOCK-002
(2026-02-27). Stays at root.

### All files — KEEP

| File                                         | Classification | Action                  |
| -------------------------------------------- | -------------- | ----------------------- |
| `governance/v1/*.md` (7)                     | CANONICAL      | KEEP                    |
| `governance/closeouts/*.md` (18)             | CANONICAL      | KEEP                    |
| `governance/ratifications/*.md` (5)          | CANONICAL      | KEEP                    |
| `governance/attestations/*.md` (1)           | CANONICAL      | KEEP                    |
| `governance/audits/*.md` (2)                 | CANONICAL      | KEEP                    |
| `governance/locks/*.md` (1)                  | CANONICAL      | KEEP                    |
| `governance/master-roadmap/*.md` (3)         | CANONICAL      | KEEP                    |
| `governance/operating-constitution/*.md` (1) | CANONICAL      | KEEP                    |
| `governance/platform-constitution/*.md` (1)  | CANONICAL      | KEEP                    |
| `governance/quality/*.md` (2)                | CANONICAL      | KEEP                    |
| `governance/release/*.md` (1)                | CANONICAL      | KEEP                    |
| `governance/system-invariants/*.md` (1)      | CANONICAL      | KEEP                    |
| `governance/decision-log/*.md` (1)           | REFERENCE      | KEEP                    |
| `governance/RATIFICATION_RECORD_v1.0.md`     | REFERENCE      | KEEP                    |
| `governance/archive/*.md` (3)                | ARCHIVE        | KEEP (already archived) |

**Note**: `governance/v1/CONSTITUTION_v1.0.md`,
`governance/v1/SYSTEM_INVARIANTS_v1.0.md`, and
`governance/v1/ENV_CONTRACT_v1.0.md` are intentional governance-headered copies
of `architecture/CONSTITUTION_v1.0.md`, `docs/SYSTEM_INVARIANTS.md`, and
`docs/ENV_CONTRACT.md` respectively. Created by
GOVERNANCE-CONSOLIDATION-LOCK-002. Drift risk exists — amendment must update
both locations.

---

## 6. `docs/` Directory

### Canonical — KEEP in place

| File                                            | Classification | Action | Destination             |
| ----------------------------------------------- | -------------- | ------ | ----------------------- |
| `docs/README.md`                                | CANONICAL      | KEEP   | Current                 |
| `docs/_index.md`                                | CANONICAL      | KEEP   | Current                 |
| `docs/CONTRIBUTING.md`                          | CANONICAL      | MOVE   | Root (per Phase 2 spec) |
| `docs/CLAUDE_OS_GOVERNANCE_CONTRACT.md`         | CANONICAL      | KEEP   | Current                 |
| `docs/SYSTEM_INVARIANTS.md`                     | CANONICAL      | KEEP   | Current                 |
| `docs/ENV_CONTRACT.md`                          | CANONICAL      | KEEP   | Current                 |
| `docs/CONTRACTS_INDEX.md`                       | CANONICAL      | KEEP   | Current                 |
| `docs/BUILD_MATRIX.md`                          | CANONICAL      | KEEP   | Current                 |
| `docs/OPS_WIRING_PLAN.md`                       | CANONICAL      | KEEP   | Current                 |
| `docs/ENVIRONMENT_CONFIGURATION.md`             | CANONICAL      | KEEP   | Current                 |
| `docs/SCRIPTS_REFERENCE.md`                     | REFERENCE      | KEEP   | Current                 |
| `docs/SHADOW_MODE.md`                           | REFERENCE      | KEEP   | Current                 |
| `docs/AGENTS.md`                                | REFERENCE      | KEEP   | Current                 |
| `docs/BASE_AGENT_SPEC.md`                       | REFERENCE      | KEEP   | Current                 |
| `docs/WORKFLOW_OVERVIEW.md`                     | REFERENCE      | KEEP   | Current                 |
| `docs/INCIDENT_RESPONSE_PLAYBOOK.md`            | CANONICAL      | KEEP   | Current                 |
| `docs/RUNBOOK_AGENT_CONTROL.md`                 | CANONICAL      | KEEP   | Current                 |
| `docs/DB_MIGRATION_WORKFLOW.md`                 | CANONICAL      | KEEP   | Current                 |
| `docs/PROMOTION_GATES.md`                       | CANONICAL      | KEEP   | Current                 |
| `docs/GAME_DAY_LIVE_SOLUTION.md`                | REFERENCE      | KEEP   | Current                 |
| `docs/database-schema-v3.md`                    | REFERENCE      | KEEP   | Current                 |
| `docs/PRODUCTION_READINESS_RELEASE_ADDENDUM.md` | CANONICAL      | KEEP   | Current                 |
| `docs/PROFESSIONAL_GRADING_SYSTEM_v2025.md`     | REFERENCE      | KEEP   | Current                 |
| `docs/PROFESSIONAL_CAPPER_FEATURES.md`          | REFERENCE      | KEEP   | Current                 |
| `docs/ELITE_SYSTEM_GUIDE.md`                    | REFERENCE      | KEEP   | Current                 |
| `docs/FORTUNE_100_COMPREHENSIVE_PRD.md`         | REFERENCE      | KEEP   | Current                 |
| `docs/FORTUNE_100_DISCORD_STRATEGY.md`          | REFERENCE      | KEEP   | Current                 |
| `docs/implementation-guide.md`                  | REFERENCE      | KEEP   | Current                 |
| `docs/zone-threat-rating.md`                    | REFERENCE      | KEEP   | Current                 |
| `docs/PLAYER_DATABASE_ANALYSIS_REPORT.md`       | REFERENCE      | KEEP   | Current                 |
| `docs/system-enhancements.md`                   | REFERENCE      | KEEP   | Current                 |

### docs/architecture/ — Mixed (updated 2026-03-13)

| File                                                          | Classification | Action   | New Location                            |
| ------------------------------------------------------------- | -------------- | -------- | --------------------------------------- |
| `docs/architecture/REPO_MAPPING.md`                           | CANONICAL      | KEEP     | Current                                 |
| `docs/architecture/SCORING_AUTHORITY.md`                      | CANONICAL      | KEEP     | Current                                 |
| `docs/architecture/CANONICAL_SCHEMA_V2.md`                    | CANONICAL      | KEEP     | Current                                 |
| `docs/architecture/PIPELINE_CONTRACT_CLEANROOM_V3.md`         | SUPERSEDED     | ARCHIVED | `docs/archive/architecture-superseded/` |
| `docs/architecture/STAT_PROJECTION_ARCHITECTURE_v2.md`        | SUPERSEDED     | ARCHIVED | `docs/archive/architecture-superseded/` |
| `docs/architecture/V3_ELITE_ROADMAP.md`                       | SUPERSEDED     | ARCHIVED | `docs/archive/architecture-superseded/` |
| `docs/architecture/DISCORD_DELIVERY_AND_FANOUT_PLAN.md`       | SUPERSEDED     | ARCHIVED | `docs/archive/architecture-superseded/` |
| `docs/architecture/UI_PROJECTION_ARCHITECTURE.md`             | SUPERSEDED     | ARCHIVED | `docs/archive/architecture-superseded/` |
| `docs/architecture/UI_PROJECTION_ARCHITECTURE_PRIORITIZED.md` | SUPERSEDED     | ARCHIVED | `docs/archive/architecture-superseded/` |
| `docs/architecture/v1/OBSERVABILITY_ARCHITECTURE_v1.0.md`     | SUPERSEDED     | ARCHIVED | `docs/archive/architecture-superseded/` |

### docs/contracts/ — Mixed (updated 2026-03-13)

| File                                                | Classification | Action   | New Location                   |
| --------------------------------------------------- | -------------- | -------- | ------------------------------ |
| `docs/contracts/PICK_LIFECYCLE_CONTRACT.md`         | CANONICAL      | KEEP     | Current                        |
| `docs/contracts/PROMOTION_AUTHORITY_BOUNDARY.md`    | CANONICAL      | KEEP     | Current                        |
| `docs/contracts/DISCORD_EMBED_CONTRACT.md`          | CANONICAL      | KEEP     | Current                        |
| `docs/contracts/SEARCH_CATALOG_CONTRACT_V1.md`      | CANONICAL      | KEEP     | Current                        |
| `docs/contracts/SMARTFORM_DATA_CONTRACT_V2.md`      | CANONICAL      | KEEP     | Current                        |
| `docs/contracts/PICK_LIFECYCLE_CONTRACT_STUB.md`    | STUB           | ARCHIVED | `docs/archive/contract-stubs/` |
| `docs/contracts/DISCORD_EMBED_CONTRACT_STUB.md`     | STUB           | ARCHIVED | `docs/archive/contract-stubs/` |
| `docs/contracts/SEARCH_CATALOG_CONTRACT_V1_STUB.md` | STUB           | ARCHIVED | `docs/archive/contract-stubs/` |
| `docs/contracts/SMARTFORM_DATA_CONTRACT_V1.md`      | SUPERSEDED     | ARCHIVED | `docs/archive/contract-stubs/` |
| `docs/contracts/SMARTFORM_DATA_CONTRACT_V1_STUB.md` | STUB           | ARCHIVED | `docs/archive/contract-stubs/` |
| `docs/contracts/SMARTFORM_DATA_CONTRACT_V2_STUB.md` | STUB           | ARCHIVED | `docs/archive/contract-stubs/` |

### docs/api/v1/ — KEEP

| File                                       | Classification | Action |
| ------------------------------------------ | -------------- | ------ |
| `docs/api/v1/ROUTES_SPEC_v1.0.md`          | CANONICAL      | KEEP   |
| `docs/api/v1/RATE_LIMITING_POLICY_v1.0.md` | CANONICAL      | KEEP   |
| `docs/api/v1/ERROR_CODES_v1.0.md`          | CANONICAL      | KEEP   |

### docs/adr/ — KEEP

| File                                 | Classification | Action |
| ------------------------------------ | -------------- | ------ |
| `docs/adr/001-agent-architecture.md` | CANONICAL      | KEEP   |

### docs/analytics/ — KEEP

| File                                          | Classification | Action |
| --------------------------------------------- | -------------- | ------ |
| `docs/analytics/ANALYTICS_ROADMAP_v4.md`      | REFERENCE      | KEEP   |
| `docs/analytics/MODEL_SERVING_ROADMAP_v6.md`  | REFERENCE      | KEEP   |
| `docs/analytics/MODEL_TRAINING_ROADMAP_v5.md` | REFERENCE      | KEEP   |

### docs/audit/ — KEEP

| File                                     | Classification | Action |
| ---------------------------------------- | -------------- | ------ |
| `docs/audit/SYSTEM_CAPABILITY_MATRIX.md` | REFERENCE      | KEEP   |

### docs/blueprints/ — ARCHIVED (2026-03-13)

All 21 blueprint files moved to `docs/archive/blueprints/` by
SPRINT-DOC-CANONICALIZATION-PHASE-A. Authority:
`docs/status/CANONICAL_DOC_SET.md` (2026-03-09) classifies all as SUPERSEDED.

| File                                                                  | Previous Classification | Action   | Archive Location                                            |
| --------------------------------------------------------------------- | ----------------------- | -------- | ----------------------------------------------------------- |
| `ARTIFACT_REGISTRY_v1.0.md`                                           | CANONICAL               | ARCHIVED | `docs/archive/blueprints/`                                  |
| `REPO_STRUCTURE_LOCK_v1.0.md`                                         | CANONICAL               | ARCHIVED | `docs/archive/blueprints/`                                  |
| `UNIT_TALK_MASTER_SYSTEM_BLUEPRINT_v2.0.md`                           | CANONICAL               | ARCHIVED | `docs/archive/blueprints/`                                  |
| `PRODUCTION_DOMINANCE_ROADMAP_v2.0.md`                                | CANONICAL               | ARCHIVED | `docs/archive/blueprints/`                                  |
| `AUTOPILOT_GOVERNANCE_SPEC_v1.md`                                     | REFERENCE               | ARCHIVED | `docs/archive/blueprints/`                                  |
| `DATA_MOAT_ARCHITECTURE_v1.md`                                        | REFERENCE               | ARCHIVED | `docs/archive/blueprints/`                                  |
| `DATA_MOAT_REQUIREMENTS_v1.md`                                        | REFERENCE               | ARCHIVED | `docs/archive/blueprints/`                                  |
| `DEVIG_NORMALIZATION_SPEC_v1.md`                                      | REFERENCE               | ARCHIVED | `docs/archive/blueprints/`                                  |
| `EXECUTION_ENGINE_SPEC_v1.md`                                         | REFERENCE               | ARCHIVED | `docs/archive/blueprints/`                                  |
| `FEATURE_TAXONOMY_v1.md`                                              | REFERENCE               | ARCHIVED | `docs/archive/blueprints/`                                  |
| `INTELLIGENCE_DIFFERENTIATION_STRATEGY_v1.md`                         | REFERENCE               | ARCHIVED | `docs/archive/blueprints/`                                  |
| `MODEL_ARCHITECTURE_SPEC_v1.md`                                       | REFERENCE               | ARCHIVED | `docs/archive/blueprints/`                                  |
| `MODEL_TRAINING_PIPELINE_SPEC_v1.md`                                  | REFERENCE               | ARCHIVED | `docs/archive/blueprints/`                                  |
| `MULTI_SPORT_UNIFIED_EVENT_SCHEMA_v1.md`                              | REFERENCE               | ARCHIVED | `docs/archive/blueprints/`                                  |
| `PHASE_2A_INTELLIGENCE_SUPERIORITY_AUDIT_v1.md`                       | REFERENCE               | ARCHIVED | `docs/archive/blueprints/`                                  |
| `PROMOTION_BAND_LOGIC_SPEC_v1.md`                                     | REFERENCE               | ARCHIVED | `docs/archive/blueprints/`                                  |
| `RISK_ENGINE_SPEC_v1.md`                                              | REFERENCE               | ARCHIVED | `docs/archive/blueprints/`                                  |
| `TELEMETRY_TRUTH_AUDIT_SPEC_v1.md`                                    | REFERENCE               | ARCHIVED | `docs/archive/blueprints/`                                  |
| `WALK_FORWARD_EVAL_HARNESS_v1.md`                                     | REFERENCE               | ARCHIVED | `docs/archive/blueprints/`                                  |
| `phase-2/intelligence-utilization/CAPPER_COMMAND_CENTER_SPEC_v1.0.md` | CANONICAL               | ARCHIVED | `docs/archive/blueprints/phase-2/intelligence-utilization/` |
| `phase-2/market-data/MARKET_DATA_FOUNDATION_SPEC_v1.0.md`             | REFERENCE               | ARCHIVED | `docs/archive/blueprints/phase-2/market-data/`              |

### docs/claude/ — KEEP

| File                                      | Classification | Action |
| ----------------------------------------- | -------------- | ------ |
| `docs/claude/MERGE_POLICY.md`             | CANONICAL      | KEEP   |
| `docs/claude/SPRINT_WORKFLOW_TEMPLATE.md` | CANONICAL      | KEEP   |

### docs/migrations/ — KEEP

| File                                                 | Classification | Action |
| ---------------------------------------------------- | -------------- | ------ |
| `docs/migrations/CANONICAL_SCHEMA_MIGRATION_PLAN.md` | REFERENCE      | KEEP   |

### docs/ops/ — Mixed

| File                                        | Classification   | Action   | Destination                        |
| ------------------------------------------- | ---------------- | -------- | ---------------------------------- |
| `docs/ops/AUTO_RESOLUTION_POLICY.md`        | CANONICAL        | KEEP     | Current                            |
| `docs/ops/AUTOPILOT_FREEZE_MATRIX.md`       | CANONICAL        | KEEP     | Current                            |
| `docs/ops/AUTOPILOT_LIVE_FIRE_DRILLS.md`    | REFERENCE        | KEEP     | Current                            |
| `docs/ops/AUTOPILOT_ROLLOUT_RUNBOOK.md`     | CANONICAL        | KEEP     | Current                            |
| `docs/ops/CI_FAILURE_CLASSIFICATION.md`     | CANONICAL        | KEEP     | Current                            |
| `docs/ops/CI_FAILURE_RESOLVER_GUIDE.md`     | REFERENCE        | KEEP     | Current                            |
| `docs/ops/CONTROL_KNOBS_INVENTORY.md`       | REFERENCE        | KEEP     | Current                            |
| `docs/ops/E2E_SMOKE_AUTOMATION.md`          | REFERENCE        | KEEP     | Current                            |
| `docs/ops/FORBIDDEN_ACTIONS.md`             | CANONICAL        | KEEP     | Current                            |
| `docs/ops/GO_LIVE_RUNBOOK.md`               | CANONICAL        | KEEP     | Current                            |
| `docs/ops/PR_FAILURE_TEMPLATE.md`           | REFERENCE        | KEEP     | Current                            |
| `docs/ops/PR7_INCIDENT_ROUTING.md`          | PR_ARTIFACT      | ARCHIVED | `docs/archive/pr-artifacts/`       |
| `docs/ops/PR8_AUTO_REMEDIATION.md`          | PR_ARTIFACT      | ARCHIVED | `docs/archive/pr-artifacts/`       |
| `docs/ops/PR9_GO_LIVE_HARDENING_PR.md`      | PR_ARTIFACT      | ARCHIVED | `docs/archive/pr-artifacts/`       |
| `docs/ops/REQUIRED_CHECKS_ROLLOUT.md`       | REFERENCE        | KEEP     | Current                            |
| `docs/ops/RUNBOOK_LOCAL.md`                 | CANONICAL        | KEEP     | Current                            |
| `docs/ops/SUPABASE_CI_ENVIRONMENT_SETUP.md` | REFERENCE        | KEEP     | Current                            |
| `docs/ops/PHASE65_COMPLETION_REPORT.md`     | SESSION_ARTIFACT | ARCHIVE  | `docs/archive/sprint-artifacts/`   |
| `docs/ops/sop/*.md` (5 files)               | CANONICAL        | KEEP     | Current                            |
| `docs/ops/huly/*.md` (5 files)              | ARCHIVE          | ARCHIVE  | `docs/archive/deprecated-systems/` |

### docs/phases/ — KEEP

| File                                                   | Classification | Action |
| ------------------------------------------------------ | -------------- | ------ |
| `docs/phases/phase-4-operational-determinism/*.md` (4) | REFERENCE      | KEEP   |

### docs/phase4/ — KEEP

| File                         | Classification | Action |
| ---------------------------- | -------------- | ------ |
| `docs/phase4/policy_spec.md` | REFERENCE      | KEEP   |

### docs/product/v1/ — Mixed

| File                                                    | Classification | Action  | Destination                      |
| ------------------------------------------------------- | -------------- | ------- | -------------------------------- |
| `docs/product/v1/ENTITLEMENTS_MAP_v1.0.md`              | REFERENCE      | KEEP    | Current                          |
| `docs/product/v1/PRICING_MODEL_v1.0.md`                 | REFERENCE      | KEEP    | Current                          |
| `docs/product/v1/USER_PERSONAS_v1.0.md`                 | REFERENCE      | KEEP    | Current                          |
| `docs/product/v1/CAPPER_COMMAND_CENTER_UI_SPEC_v1.0.md` | DUPLICATE      | ARCHIVE | `docs/archive/historical-plans/` |

### docs/roadmap/ — KEEP

| File                                                 | Classification | Action |
| ---------------------------------------------------- | -------------- | ------ |
| `docs/roadmap/INTELLIGENCE_PIPELINE_SPRINT_ORDER.md` | CANONICAL      | KEEP   |

### docs/runbooks/ — KEEP

| File                               | Classification | Action |
| ---------------------------------- | -------------- | ------ |
| `docs/runbooks/DEV_ENV_WINDOWS.md` | REFERENCE      | KEEP   |
| `docs/runbooks/OPS_SHORTCUTS.md`   | REFERENCE      | KEEP   |

### docs/smart-form/ — Mixed

| File                                                  | Classification   | Action  | Destination                      |
| ----------------------------------------------------- | ---------------- | ------- | -------------------------------- |
| `docs/smart-form/SMARTFORM_DATA_CONTRACT_PROPOSAL.md` | REFERENCE        | KEEP    | Current                          |
| `docs/smart-form/SPORTSBOOK_FEEL_GAP_ANALYSIS.md`     | REFERENCE        | KEEP    | Current                          |
| `docs/smart-form/SPRINT_PLAN_SMARTFORM_PLUMBING.md`   | SESSION_ARTIFACT | ARCHIVE | `docs/archive/sprint-artifacts/` |

### docs/sprints/ — KEEP

| File                                                   | Classification | Action |
| ------------------------------------------------------ | -------------- | ------ |
| `docs/sprints/SPRINT-BRIDGEWORKER-INTEGRATION-007A.md` | REFERENCE      | KEEP   |

### docs/huly-os/ — ARCHIVE

| File                                | Classification | Action  | Destination                        |
| ----------------------------------- | -------------- | ------- | ---------------------------------- |
| `docs/huly-os/GITHUB_AUTH_TRUTH.md` | ARCHIVE        | ARCHIVE | `docs/archive/deprecated-systems/` |

### docs/ — Archive (stale reports and plans)

| File                                          | Classification   | Action               | Destination                        |
| --------------------------------------------- | ---------------- | -------------------- | ---------------------------------- |
| `docs/ARCHITECTURE.md`                        | ARCHIVE          | ARCHIVE              | `docs/archive/historical-plans/`   |
| `docs/PRODUCTION_READINESS.md`                | ARCHIVE          | ARCHIVE              | `docs/archive/historical-plans/`   |
| `docs/production-readiness-status.md`         | ARCHIVE          | ARCHIVE              | `docs/archive/historical-plans/`   |
| `docs/PRODUCTION_DEPLOYMENT_MASTER.md`        | ARCHIVE          | ARCHIVE              | `docs/archive/historical-plans/`   |
| `docs/DEPLOYMENT_STATUS.md`                   | SESSION_ARTIFACT | ARCHIVE              | `docs/archive/sprint-artifacts/`   |
| `docs/E2E_SYSTEM_ANALYSIS_REPORT.md`          | SESSION_ARTIFACT | ARCHIVE              | `docs/archive/session-reports/`    |
| `docs/e2e-staging-test.md`                    | SESSION_ARTIFACT | ARCHIVE              | `docs/archive/session-reports/`    |
| `docs/scoring-system-audit.md`                | SESSION_ARTIFACT | ARCHIVE              | `docs/archive/session-reports/`    |
| `docs/scoring-system-technical.md`            | ARCHIVE          | ARCHIVE              | `docs/archive/analysis/`           |
| `docs/scoring-system-upgrade-summary.md`      | SESSION_ARTIFACT | ARCHIVE              | `docs/archive/sprint-artifacts/`   |
| `docs/SYSTEM_AUDIT_REPORT.md`                 | SESSION_ARTIFACT | ARCHIVE              | `docs/archive/session-reports/`    |
| `docs/COMPREHENSIVE_SYSTEM_AUDIT_2025.md`     | SESSION_ARTIFACT | ARCHIVE              | `docs/archive/session-reports/`    |
| `docs/TYPESCRIPT_FIX_PLAN.md`                 | SESSION_ARTIFACT | ARCHIVE              | `docs/archive/sprint-artifacts/`   |
| `docs/pr-summary.md`                          | SESSION_ARTIFACT | ARCHIVE              | `docs/archive/session-reports/`    |
| `docs/PRODUCTION_TODO_LIST.md`                | ARCHIVE          | ARCHIVE              | `docs/archive/historical-plans/`   |
| `docs/MIGRATION_SUMMARY.md`                   | SESSION_ARTIFACT | ARCHIVE              | `docs/archive/sprint-artifacts/`   |
| `docs/application-startup-test-report.md`     | SESSION_ARTIFACT | ARCHIVE              | `docs/archive/session-reports/`    |
| `docs/integration-test-report.md`             | SESSION_ARTIFACT | ARCHIVE              | `docs/archive/session-reports/`    |
| `docs/performance-baseline-report.md`         | SESSION_ARTIFACT | ARCHIVE              | `docs/archive/session-reports/`    |
| `docs/DISCORD_ARCHITECTURE_ANALYSIS.md`       | SESSION_ARTIFACT | ARCHIVE              | `docs/archive/analysis/`           |
| `docs/ALERT_SYSTEM_SUMMARY.md`                | SESSION_ARTIFACT | ARCHIVE              | `docs/archive/session-reports/`    |
| `docs/e2e-business-flow.md`                   | DUPLICATE        | DELETE_AFTER_ARCHIVE | `docs/archive/session-reports/`    |
| `docs/supabase-schema-saas.md`                | ARCHIVE          | ARCHIVE              | `docs/archive/historical-plans/`   |
| `docs/ONBOARDING_TEST_CHECKLIST.md`           | SESSION_ARTIFACT | ARCHIVE              | `docs/archive/session-reports/`    |
| `docs/ONBOARDING_TEST_SETUP.md`               | SESSION_ARTIFACT | ARCHIVE              | `docs/archive/session-reports/`    |
| `docs/STANDARD_OPERATING_PROCEDURES.md`       | ARCHIVE          | MERGE                | Consolidate into SOP index         |
| `docs/external-integration-sop.md`            | ARCHIVE          | ARCHIVE              | `docs/archive/deprecated-systems/` |
| `docs/system-health-recovery-sop.md`          | REFERENCE        | KEEP                 | Current                            |
| `docs/system-optimization-recommendations.md` | REFERENCE        | KEEP                 | Current                            |
| `docs/system-upgrade-automation-sop.md`       | REFERENCE        | KEEP                 | Current                            |
| `docs/agent-development-sop.md`               | REFERENCE        | KEEP                 | Current                            |
| `docs/kpi-documentation-sop.md`               | REFERENCE        | KEEP                 | Current                            |
| `docs/operator-command-interface-sop.md`      | REFERENCE        | KEEP                 | Current                            |
| `docs/SPRINT_VERIFICATION_RUNBOOK.md`         | REFERENCE        | KEEP                 | Current                            |

---

## 7. `apps/api/` (35 files)

### Keep

| File                                                  | Classification | Action |
| ----------------------------------------------------- | -------------- | ------ |
| `apps/api/CLAUDE.md`                                  | CANONICAL      | KEEP   |
| `apps/api/AGENT_REGISTRY.md`                          | CANONICAL      | KEEP   |
| `apps/api/DOMAIN_MAP.md`                              | CANONICAL      | KEEP   |
| `apps/api/SHADOW_MODE_GUIDE.md`                       | REFERENCE      | KEEP   |
| `apps/api/PROFESSIONAL_BETTING_SYSTEM.md`             | REFERENCE      | KEEP   |
| `apps/api/GOLDEN_TESTS_README.md`                     | REFERENCE      | KEEP   |
| `apps/api/docs/e2e-business-flow.md`                  | REFERENCE      | KEEP   |
| `apps/api/test/README.md`                             | REFERENCE      | KEEP   |
| `apps/api/test/__quarantine__/MANIFEST.md`            | REFERENCE      | KEEP   |
| `apps/api/src/workers/README.md`                      | REFERENCE      | KEEP   |
| Active agent READMEs (11 files)                       | REFERENCE      | KEEP   |
| `apps/api/src/agents/IngestionAgent/ingestion.sop.md` | REFERENCE      | KEEP   |

### Archive

| File                                             | Classification   | Action                  | Destination                     |
| ------------------------------------------------ | ---------------- | ----------------------- | ------------------------------- |
| `apps/api/DAILY_FLOW_WITH_AGENTS.md`             | SESSION_ARTIFACT | ARCHIVE                 | `docs/archive/session-reports/` |
| `apps/api/DAILY_PROP_FLOW_ANALYSIS.md`           | SESSION_ARTIFACT | ARCHIVE                 | `docs/archive/session-reports/` |
| `apps/api/HEALTH_ENDPOINT_TEST_RESULTS.md`       | SESSION_ARTIFACT | ARCHIVE                 | `docs/archive/session-reports/` |
| `apps/api/PRODUCTION_READY_SUMMARY.md`           | SESSION_ARTIFACT | ARCHIVE                 | `docs/archive/session-reports/` |
| Archived agent READMEs (5 files in `_archived/`) | ARCHIVE          | KEEP (already archived) |

---

## 8. `apps/command-center/` (14 files)

### Keep

| File                                                 | Classification | Action |
| ---------------------------------------------------- | -------------- | ------ |
| `apps/command-center/CLAUDE.md`                      | CANONICAL      | KEEP   |
| `apps/command-center/README.md`                      | CANONICAL      | KEEP   |
| `apps/command-center/docs/DEPLOYMENT_GUIDE.md`       | CANONICAL      | KEEP   |
| `apps/command-center/docs/OPERATIONS_RUNBOOK.md`     | CANONICAL      | KEEP   |
| `apps/command-center/docs/ARCHITECTURE_OVERVIEW.md`  | REFERENCE      | KEEP   |
| `apps/command-center/database/PRODUCTION_SCHEMA.md`  | REFERENCE      | KEEP   |
| `apps/command-center/src/components/cards/README.md` | REFERENCE      | KEEP   |

### Archive/Delete

| File                                                    | Classification   | Action               | Destination                        |
| ------------------------------------------------------- | ---------------- | -------------------- | ---------------------------------- |
| `apps/command-center/DEPLOYMENT_GUIDE.md`               | DUPLICATE        | DELETE_AFTER_ARCHIVE | `docs/archive/session-reports/`    |
| `apps/command-center/BUILD_STATUS.md`                   | SESSION_ARTIFACT | ARCHIVE              | `docs/archive/sprint-artifacts/`   |
| `apps/command-center/EMERGENCY_RESTART_PROCEDURE.md`    | REFERENCE        | KEEP                 | Current                            |
| `apps/command-center/FORTUNE100_ACCEPTANCE_BUNDLE.md`   | SESSION_ARTIFACT | ARCHIVE              | `docs/archive/sprint-artifacts/`   |
| `apps/command-center/UNIFIED_INTEGRATION_GUIDE.md`      | SESSION_ARTIFACT | ARCHIVE              | `docs/archive/session-reports/`    |
| `apps/command-center/VERIFICATION_RESULTS.md`           | SESSION_ARTIFACT | ARCHIVE              | `docs/archive/session-reports/`    |
| `apps/command-center/.augment/rules/byterover-rules.md` | ARCHIVE          | DELETE_AFTER_ARCHIVE | `docs/archive/deprecated-systems/` |
| `apps/command-center/.clinerules/byterover-rules.md`    | ARCHIVE          | DELETE_AFTER_ARCHIVE | `docs/archive/deprecated-systems/` |
| `apps/command-center/.github/copilot-instructions.md`   | ARCHIVE          | DELETE_AFTER_ARCHIVE | `docs/archive/deprecated-systems/` |

---

## 9. `apps/dashboard/` (5 files)

| File                                               | Classification | Action               | Destination                        |
| -------------------------------------------------- | -------------- | -------------------- | ---------------------------------- |
| `apps/dashboard/CLAUDE.md`                         | CANONICAL      | KEEP                 | Current                            |
| `apps/dashboard/README.md`                         | CANONICAL      | KEEP                 | Current                            |
| `apps/dashboard/.augment/rules/byterover-rules.md` | ARCHIVE        | DELETE_AFTER_ARCHIVE | `docs/archive/deprecated-systems/` |
| `apps/dashboard/.clinerules/byterover-rules.md`    | ARCHIVE        | DELETE_AFTER_ARCHIVE | `docs/archive/deprecated-systems/` |
| `apps/dashboard/.github/copilot-instructions.md`   | ARCHIVE        | DELETE_AFTER_ARCHIVE | `docs/archive/deprecated-systems/` |

---

## 10. `apps/discord-bot/` (35 files)

### Keep

| File                                                 | Classification | Action |
| ---------------------------------------------------- | -------------- | ------ |
| `apps/discord-bot/CLAUDE.md`                         | CANONICAL      | KEEP   |
| `apps/discord-bot/README.md`                         | CANONICAL      | KEEP   |
| `apps/discord-bot/CAPPER_INTEGRATION.md`             | REFERENCE      | KEEP   |
| `apps/discord-bot/PRODUCTION_DEPLOYMENT_GUIDE.md`    | CANONICAL      | KEEP   |
| `apps/discord-bot/ONBOARDING_SYSTEM.md`              | REFERENCE      | KEEP   |
| `apps/discord-bot/docs/ADMIN_GUIDE.md`               | REFERENCE      | KEEP   |
| `apps/discord-bot/docs/COMMAND_TESTING_CHECKLIST.md` | REFERENCE      | KEEP   |
| `apps/discord-bot/docs/QUICK_START_GUIDE.md`         | REFERENCE      | KEEP   |
| `apps/discord-bot/docs/README.md`                    | REFERENCE      | KEEP   |
| `apps/discord-bot/docs/TESTING_GUIDE.md`             | REFERENCE      | KEEP   |
| `apps/discord-bot/docs/TIER_SYSTEM_GUIDE.md`         | REFERENCE      | KEEP   |
| `apps/discord-bot/docs/USER_COMMAND_REFERENCE.md`    | REFERENCE      | KEEP   |
| `apps/discord-bot/src/services/DATABASE_README.md`   | REFERENCE      | KEEP   |

### Archive

| File                                                 | Classification   | Action  | Destination                           |
| ---------------------------------------------------- | ---------------- | ------- | ------------------------------------- |
| `apps/discord-bot/AI_COACHING_README.md`             | SESSION_ARTIFACT | ARCHIVE | `docs/archive/session-reports/`       |
| `apps/discord-bot/BLACK_LABEL_ENHANCEMENTS.md`       | SESSION_ARTIFACT | ARCHIVE | `docs/archive/analysis/`              |
| `apps/discord-bot/FAQ_SYSTEM_README.md`              | SESSION_ARTIFACT | ARCHIVE | `docs/archive/session-reports/`       |
| `apps/discord-bot/ONBOARDING_IMPLEMENTATION.md`      | SESSION_ARTIFACT | ARCHIVE | `docs/archive/session-reports/`       |
| `apps/discord-bot/ONBOARDING_TESTING.md`             | SESSION_ARTIFACT | ARCHIVE | `docs/archive/session-reports/`       |
| `apps/discord-bot/PRODUCTION_READINESS_CHECKLIST.md` | SESSION_ARTIFACT | ARCHIVE | `docs/archive/sprint-artifacts/`      |
| `apps/discord-bot/DEPLOYMENT.md`                     | DUPLICATE        | MERGE   | Into `PRODUCTION_DEPLOYMENT_GUIDE.md` |

### Delete after archive

| File                                                                | Classification   | Action               | Destination                        |
| ------------------------------------------------------------------- | ---------------- | -------------------- | ---------------------------------- |
| `apps/discord-bot/COMPETITIVE_ANALYSIS_AND_ENHANCEMENT_STRATEGY.md` | SESSION_ARTIFACT | DELETE_AFTER_ARCHIVE | `docs/archive/session-reports/`    |
| `apps/discord-bot/DATABASE_ANALYSIS_REPORT.md`                      | SESSION_ARTIFACT | DELETE_AFTER_ARCHIVE | `docs/archive/session-reports/`    |
| `apps/discord-bot/DATABASE_MIGRATION.md`                            | SESSION_ARTIFACT | DELETE_AFTER_ARCHIVE | `docs/archive/session-reports/`    |
| `apps/discord-bot/FAQ_DEPLOYMENT_GUIDE.md`                          | SESSION_ARTIFACT | DELETE_AFTER_ARCHIVE | `docs/archive/session-reports/`    |
| `apps/discord-bot/FAQ_IMPLEMENTATION_SUMMARY.md`                    | SESSION_ARTIFACT | DELETE_AFTER_ARCHIVE | `docs/archive/session-reports/`    |
| `apps/discord-bot/FORTUNE_100_IMPLEMENTATION_PLAN.md`               | SESSION_ARTIFACT | DELETE_AFTER_ARCHIVE | `docs/archive/session-reports/`    |
| `apps/discord-bot/GET_BOT_ONLINE.md`                                | SESSION_ARTIFACT | DELETE_AFTER_ARCHIVE | `docs/archive/deprecated-systems/` |
| `apps/discord-bot/IMPLEMENTATION_SUMMARY.md`                        | SESSION_ARTIFACT | DELETE_AFTER_ARCHIVE | `docs/archive/session-reports/`    |
| `apps/discord-bot/ONBOARDING_SYSTEM_COMPLETE_DOCUMENTATION.md`      | SESSION_ARTIFACT | DELETE_AFTER_ARCHIVE | `docs/archive/session-reports/`    |
| `apps/discord-bot/PERSONALIZED_ONBOARDING_SETUP.md`                 | DUPLICATE        | DELETE_AFTER_ARCHIVE | `docs/archive/session-reports/`    |
| `apps/discord-bot/PLACEHOLDER_ANALYSIS_REPORT.md`                   | SESSION_ARTIFACT | DELETE_AFTER_ARCHIVE | `docs/archive/session-reports/`    |
| `apps/discord-bot/PRODUCTION_IMPLEMENTATION_GUIDE.md`               | SESSION_ARTIFACT | DELETE_AFTER_ARCHIVE | `docs/archive/session-reports/`    |
| `apps/discord-bot/SETUP.md`                                         | DUPLICATE        | DELETE_AFTER_ARCHIVE | `docs/archive/session-reports/`    |
| `apps/discord-bot/SETUP_GUIDE.md`                                   | SESSION_ARTIFACT | DELETE_AFTER_ARCHIVE | `docs/archive/session-reports/`    |
| `apps/discord-bot/URGENT_FIX.md`                                    | SESSION_ARTIFACT | DELETE_AFTER_ARCHIVE | `docs/archive/session-reports/`    |
| `apps/discord-bot/.augment/rules/byterover-rules.md`                | ARCHIVE          | DELETE_AFTER_ARCHIVE | `docs/archive/deprecated-systems/` |
| `apps/discord-bot/.clinerules/byterover-rules.md`                   | ARCHIVE          | DELETE_AFTER_ARCHIVE | `docs/archive/deprecated-systems/` |
| `apps/discord-bot/.github/copilot-instructions.md`                  | ARCHIVE          | DELETE_AFTER_ARCHIVE | `docs/archive/deprecated-systems/` |

---

## 11. `apps/smart-form/` (17 files)

### Keep

| File                                              | Classification | Action |
| ------------------------------------------------- | -------------- | ------ |
| `apps/smart-form/CLAUDE.md`                       | CANONICAL      | KEEP   |
| `apps/smart-form/SMART_FORM_PRODUCT_SPEC_V1.1.md` | CANONICAL      | KEEP   |
| `apps/smart-form/PRODUCTION_RUNBOOK.md`           | CANONICAL      | KEEP   |
| `apps/smart-form/SETUP_GUIDE.md`                  | REFERENCE      | KEEP   |
| `apps/smart-form/DATABASE-SCHEMA-REFERENCE.md`    | REFERENCE      | KEEP   |
| `apps/smart-form/DATA-SOURCE-STRATEGY.md`         | REFERENCE      | KEEP   |
| `apps/smart-form/SCHEMA-STANDARDIZATION.md`       | REFERENCE      | KEEP   |
| `apps/smart-form/SMART_FORM_V3_TEST_GUIDE.md`     | REFERENCE      | KEEP   |

### Archive/Delete

| File                                                | Classification   | Action               | Destination                        |
| --------------------------------------------------- | ---------------- | -------------------- | ---------------------------------- |
| `apps/smart-form/DEPLOYMENT_GUIDE.md`               | DUPLICATE        | MERGE                | Into `PRODUCTION_RUNBOOK.md`       |
| `apps/smart-form/ACCEPTANCE_VALIDATION.md`          | SESSION_ARTIFACT | ARCHIVE              | `docs/archive/sprint-artifacts/`   |
| `apps/smart-form/DATA_FIX_SUMMARY.md`               | SESSION_ARTIFACT | ARCHIVE              | `docs/archive/session-reports/`    |
| `apps/smart-form/GAME_POPULATION_ANALYSIS.md`       | SESSION_ARTIFACT | ARCHIVE              | `docs/archive/analysis/`           |
| `apps/smart-form/production-validation-report.md`   | SESSION_ARTIFACT | ARCHIVE              | `docs/archive/session-reports/`    |
| `apps/smart-form/smart-form-verification-report.md` | SESSION_ARTIFACT | ARCHIVE              | `docs/archive/session-reports/`    |
| `apps/smart-form/E2E_TEST_REPORT.md`                | SESSION_ARTIFACT | DELETE_AFTER_ARCHIVE | `docs/archive/session-reports/`    |
| `apps/smart-form/E2E-TESTING-SUMMARY.md`            | SESSION_ARTIFACT | DELETE_AFTER_ARCHIVE | `docs/archive/session-reports/`    |
| `apps/smart-form/.augment/rules/byterover-rules.md` | ARCHIVE          | DELETE_AFTER_ARCHIVE | `docs/archive/deprecated-systems/` |
| `apps/smart-form/.clinerules/byterover-rules.md`    | ARCHIVE          | DELETE_AFTER_ARCHIVE | `docs/archive/deprecated-systems/` |
| `apps/smart-form/.github/copilot-instructions.md`   | ARCHIVE          | DELETE_AFTER_ARCHIVE | `docs/archive/deprecated-systems/` |

---

## 12. `packages/` (7 files) — ALL KEEP

| File                             | Classification | Action |
| -------------------------------- | -------------- | ------ |
| `packages/*/CLAUDE.md` (7 files) | CANONICAL      | KEEP   |

---

## 13. `infrastructure/` (3 files) — ALL KEEP

| File                                                                  | Classification | Action |
| --------------------------------------------------------------------- | -------------- | ------ |
| `infrastructure/kubernetes/apps/smart-form/DEPLOYMENT_RUNBOOK.md`     | CANONICAL      | KEEP   |
| `infrastructure/kubernetes/apps/smart-form/PRODUCTION_OPS_SUMMARY.md` | REFERENCE      | KEEP   |
| `infrastructure/kubernetes/apps/smart-form/QUICK_START.md`            | REFERENCE      | KEEP   |

---

## 14. `legacy/` (9 files) — ALL KEEP (already archived)

| File                                        | Classification | Action                  |
| ------------------------------------------- | -------------- | ----------------------- |
| `legacy/_archive/2026-02-18/*.md` (9 files) | ARCHIVE        | KEEP (already archived) |

---

## 15. Other files

| File                                        | Classification | Action                        |
| ------------------------------------------- | -------------- | ----------------------------- |
| `scripts/chaos/README.md`                   | REFERENCE      | KEEP                          |
| `scripts/deploy-to-render.md`               | REFERENCE      | KEEP                          |
| `scripts/perf/README.md`                    | REFERENCE      | KEEP                          |
| `scripts/production-cutover/README.md`      | REFERENCE      | KEEP                          |
| `tests/e2e/README.md`                       | REFERENCE      | KEEP                          |
| `tools/huly-os/docs/REALITY_REPORT_SPEC.md` | ARCHIVE        | KEEP (in deprecated tool dir) |

---

## Summary

| Action                          | File Count |
| ------------------------------- | ---------- |
| KEEP (no change)                | ~340       |
| ARCHIVE (move to docs/archive/) | ~75        |
| DELETE_AFTER_ARCHIVE            | ~45        |
| MERGE (consolidate)             | ~3         |
| MOVE (relocate)                 | ~5         |
| **Total files affected**        | **~128**   |

After execution, the active documentation tree will contain approximately 340
files organized in canonical locations with clear authority headers. The ~128
archived/deleted files will be preserved in `docs/archive/` before removal from
active paths.
