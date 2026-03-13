# ARTIFACT REGISTRY v1.0

**Sprint**: BLUEPRINT-FOUNDATION-AUDIT-001 **Date**: 2026-02-27 **Status**:
ACTIVE

---

## Purpose

This registry tracks all required system documentation artifacts for the Unit
Talk platform. Each artifact is categorized with its status, canonical location,
and any notes about equivalents or duplicates.

---

## Status Legend

| Status      | Meaning                                             |
| ----------- | --------------------------------------------------- |
| EXISTS      | Artifact exists at canonical location               |
| EQUIVALENT  | Different name/location but functionally equivalent |
| PLACEHOLDER | Stub created, content pending                       |
| MISSING     | Does not exist, placeholder needed                  |
| ARCHIVED    | Moved to governance/archive/                        |

---

## 1. Blueprints (docs/blueprints/)

| Artifact                                  | Status      | Canonical Path                                            | Notes               |
| ----------------------------------------- | ----------- | --------------------------------------------------------- | ------------------- |
| ARTIFACT_REGISTRY_v1.0.md                 | EXISTS      | docs/blueprints/ARTIFACT_REGISTRY_v1.0.md                 | This document       |
| REPO_STRUCTURE_LOCK_v1.0.md               | PLACEHOLDER | docs/blueprints/REPO_STRUCTURE_LOCK_v1.0.md               | Created this sprint |
| UNIT_TALK_MASTER_SYSTEM_BLUEPRINT_v1.0.md | PLACEHOLDER | docs/blueprints/UNIT_TALK_MASTER_SYSTEM_BLUEPRINT_v1.0.md | Created this sprint |

---

## 2. Architecture Specs (docs/architecture/v1/)

| Artifact                           | Status      | Canonical Path                                          | Notes                       |
| ---------------------------------- | ----------- | ------------------------------------------------------- | --------------------------- |
| SYSTEM_OVERVIEW_v1.0.md            | EQUIVALENT  | docs/ARCHITECTURE.md                                    | Main architecture doc       |
| DATA_FLOW_v1.0.md                  | EQUIVALENT  | docs/WORKFLOW_OVERVIEW.md                               | Workflow/data flow overview |
| COMPONENT_MAP_v1.0.md              | EQUIVALENT  | apps/command-center/docs/ARCHITECTURE_OVERVIEW.md       | Partial; app-specific       |
| OBSERVABILITY_ARCHITECTURE_v1.0.md | PLACEHOLDER | docs/architecture/v1/OBSERVABILITY_ARCHITECTURE_v1.0.md | Not found                   |
| FAILURE_MODEL_v1.0.md              | EQUIVALENT  | architecture/failure-model/FAILURE_MODEL_v1.0-DRAFT.md  | Draft exists                |

### Existing Architecture Documents

| Document                      | Location                                                        | Status     |
| ----------------------------- | --------------------------------------------------------------- | ---------- |
| ARCHITECTURE.md               | docs/ARCHITECTURE.md                                            | ACTIVE     |
| ARCHITECTURE_AUDIT_SUMMARY.md | ARCHITECTURE_AUDIT_SUMMARY.md                                   | ACTIVE     |
| UI_PROJECTION_ARCHITECTURE.md | docs/architecture/UI_PROJECTION_ARCHITECTURE.md                 | ACTIVE     |
| CANONICAL_SCHEMA_V2.md        | docs/architecture/CANONICAL_SCHEMA_V2.md                        | SUPERSEDED |
| FAIL_CLOSED_BOOT_SPEC_v1.0.md | architecture/contracts/repo-truth/FAIL_CLOSED_BOOT_SPEC_v1.0.md | ACTIVE     |
| FAILURE_MODEL_v1.0-DRAFT.md   | architecture/failure-model/FAILURE_MODEL_v1.0-DRAFT.md          | DRAFT      |

---

## 3. DB Contracts (docs/db/v1/)

| Artifact                         | Status     | Canonical Path                                              | Notes                       |
| -------------------------------- | ---------- | ----------------------------------------------------------- | --------------------------- |
| CANONICAL_SCHEMA_v3.0.md         | EQUIVALENT | docs/migrations/CANONICAL_SCHEMA_MIGRATION_PLAN.md          | V3 planning doc             |
| OUTBOX_PATTERN_SPEC_v1.0.md      | EQUIVALENT | architecture/contracts/distribution/OUTBOX_CONTRACT_v1.1.md | v1.1 active                 |
| SINGLE_WRITER_DISCIPLINE_v1.0.md | EQUIVALENT | .claude/rules/03-single-writer-and-idempotency.md           | Rule file                   |
| IDEMPOTENCY_PATTERNS_v1.0.md     | EQUIVALENT | .claude/rules/03-single-writer-and-idempotency.md           | Combined with single-writer |

### Existing DB/Schema Documents

| Document                           | Location                                                    | Status |
| ---------------------------------- | ----------------------------------------------------------- | ------ |
| PICK_LIFECYCLE_CONTRACT.md         | docs/contracts/PICK_LIFECYCLE_CONTRACT.md                   | ACTIVE |
| PICK_LIFECYCLE_v1.0.md             | architecture/state-machines/PICK_LIFECYCLE_v1.0.md          | ACTIVE |
| SCHEMA_MIGRATION_MAPPING.md        | SCHEMA_MIGRATION_MAPPING.md                                 | ACTIVE |
| CANONICAL_SCHEMA_MIGRATION_PLAN.md | docs/migrations/CANONICAL_SCHEMA_MIGRATION_PLAN.md          | ACTIVE |
| OUTBOX_CONTRACT_v1.1.md            | architecture/contracts/distribution/OUTBOX_CONTRACT_v1.1.md | ACTIVE |
| DLQ_CONTRACT_v1.1.md               | architecture/contracts/distribution/DLQ_CONTRACT_v1.1.md    | ACTIVE |
| PRODUCTION_SCHEMA.md               | apps/command-center/database/PRODUCTION_SCHEMA.md           | ACTIVE |
| DATABASE-SCHEMA-REFERENCE.md       | apps/smart-form/DATABASE-SCHEMA-REFERENCE.md                | ACTIVE |

---

## 4. API Contracts (docs/api/v1/)

| Artifact                     | Status      | Canonical Path                           | Notes     |
| ---------------------------- | ----------- | ---------------------------------------- | --------- |
| ROUTES_SPEC_v1.0.md          | PLACEHOLDER | docs/api/v1/ROUTES_SPEC_v1.0.md          | Not found |
| ERROR_CODES_v1.0.md          | PLACEHOLDER | docs/api/v1/ERROR_CODES_v1.0.md          | Not found |
| RATE_LIMITING_POLICY_v1.0.md | PLACEHOLDER | docs/api/v1/RATE_LIMITING_POLICY_v1.0.md | Not found |

### Existing API Documents

| Document                      | Location                                     | Status |
| ----------------------------- | -------------------------------------------- | ------ |
| e2e-business-flow.md          | apps/api/docs/e2e-business-flow.md           | ACTIVE |
| SEARCH_CATALOG_CONTRACT_V1.md | docs/contracts/SEARCH_CATALOG_CONTRACT_V1.md | ACTIVE |
| SMARTFORM_DATA_CONTRACT_V2.md | docs/contracts/SMARTFORM_DATA_CONTRACT_V2.md | ACTIVE |

---

## 5. App Specs (docs/apps/<app>/)

### 5.1 API Worker (docs/apps/api-worker/)

| Artifact         | Status     | Canonical Path     | Notes               |
| ---------------- | ---------- | ------------------ | ------------------- |
| APP_SPEC_v1.0.md | EQUIVALENT | apps/api/CLAUDE.md | App-level CLAUDE.md |

### 5.2 Discord Bot (docs/apps/discord-bot/)

| Artifact         | Status     | Canonical Path             | Notes          |
| ---------------- | ---------- | -------------------------- | -------------- |
| APP_SPEC_v1.0.md | EQUIVALENT | apps/discord-bot/README.md | README + docs/ |

### 5.3 Smart Form (docs/apps/smart-form/)

| Artifact         | Status     | Canonical Path                                  | Notes               |
| ---------------- | ---------- | ----------------------------------------------- | ------------------- |
| APP_SPEC_v1.0.md | EQUIVALENT | apps/smart-form/SMART_FORM_PRODUCT_SPEC_V1.1.md | Product spec exists |

### 5.4 Command Center (docs/apps/command-center/)

| Artifact         | Status     | Canonical Path                                    | Notes                 |
| ---------------- | ---------- | ------------------------------------------------- | --------------------- |
| APP_SPEC_v1.0.md | EQUIVALENT | apps/command-center/docs/ARCHITECTURE_OVERVIEW.md | Architecture overview |

### Existing App Documentation

| App            | Documents                                                                   | Location             |
| -------------- | --------------------------------------------------------------------------- | -------------------- |
| api            | CLAUDE.md, DAILY_FLOW_WITH_AGENTS.md, SHADOW_MODE_GUIDE.md, Agent READMEs   | apps/api/            |
| discord-bot    | README.md, DEPLOYMENT.md, 20+ docs, docs/ folder                            | apps/discord-bot/    |
| smart-form     | PRODUCTION_RUNBOOK.md, DEPLOYMENT_GUIDE.md, SMART_FORM_PRODUCT_SPEC_V1.1.md | apps/smart-form/     |
| command-center | docs/ARCHITECTURE_OVERVIEW.md, DEPLOYMENT_GUIDE.md, OPERATIONS_RUNBOOK.md   | apps/command-center/ |

---

## 6. Product Docs (docs/product/v1/)

| Artifact                 | Status      | Canonical Path                                               | Notes            |
| ------------------------ | ----------- | ------------------------------------------------------------ | ---------------- |
| TIER_DEFINITIONS_v1.0.md | EQUIVALENT  | apps/discord-bot/docs/TIER_SYSTEM_GUIDE.md                   | Discord-specific |
| PRICING_MODEL_v1.0.md    | PLACEHOLDER | docs/product/v1/PRICING_MODEL_v1.0.md                        | Not found        |
| ENTITLEMENTS_MAP_v1.0.md | PLACEHOLDER | docs/product/v1/ENTITLEMENTS_MAP_v1.0.md                     | Not found        |
| USER_PERSONAS_v1.0.md    | PLACEHOLDER | docs/product/v1/USER_PERSONAS_v1.0.md                        | Not found        |
| ONBOARDING_FLOW_v1.0.md  | EQUIVALENT  | apps/discord-bot/ONBOARDING_SYSTEM_COMPLETE_DOCUMENTATION.md | Discord-specific |

### Existing Product Documents

| Document                                    | Location                                                     | Status |
| ------------------------------------------- | ------------------------------------------------------------ | ------ |
| TIER_SYSTEM_GUIDE.md                        | apps/discord-bot/docs/TIER_SYSTEM_GUIDE.md                   | ACTIVE |
| ONBOARDING_SYSTEM_COMPLETE_DOCUMENTATION.md | apps/discord-bot/ONBOARDING_SYSTEM_COMPLETE_DOCUMENTATION.md | ACTIVE |
| ONBOARDING_IMPLEMENTATION.md                | apps/discord-bot/ONBOARDING_IMPLEMENTATION.md                | ACTIVE |
| BLACK_LABEL_ENHANCEMENTS.md                 | apps/discord-bot/BLACK_LABEL_ENHANCEMENTS.md                 | ACTIVE |

---

## 7. SOPs (docs/ops/sop/)

| Artifact                        | Status      | Canonical Path                               | Notes           |
| ------------------------------- | ----------- | -------------------------------------------- | --------------- |
| SOP_INCIDENT_RESPONSE_v1.0.md   | EQUIVALENT  | docs/INCIDENT_RESPONSE_PLAYBOOK.md           | Playbook exists |
| SOP_MIGRATION_CHECKLIST_v1.0.md | PLACEHOLDER | docs/ops/sop/SOP_MIGRATION_CHECKLIST_v1.0.md | Not found       |

### Existing SOP Documents

| Document                        | Location                                                           | Status |
| ------------------------------- | ------------------------------------------------------------------ | ------ |
| INCIDENT_RESPONSE_PLAYBOOK.md   | docs/INCIDENT_RESPONSE_PLAYBOOK.md                                 | ACTIVE |
| PR7_INCIDENT_ROUTING.md         | docs/ops/PR7_INCIDENT_ROUTING.md                                   | ACTIVE |
| CI_FAILURE_CLASSIFICATION.md    | docs/ops/CI_FAILURE_CLASSIFICATION.md                              | ACTIVE |
| CI_FAILURE_RESOLVER_GUIDE.md    | docs/ops/CI_FAILURE_RESOLVER_GUIDE.md                              | ACTIVE |
| INCIDENT_CLASSIFICATION_v1.0.md | architecture/contracts/operational/INCIDENT_CLASSIFICATION_v1.0.md | ACTIVE |
| ingestion.sop.md                | apps/api/src/agents/IngestionAgent/ingestion.sop.md                | ACTIVE |

---

## 8. Runbooks (docs/ops/runbooks/)

| Artifact                      | Status     | Canonical Path                | Notes                        |
| ----------------------------- | ---------- | ----------------------------- | ---------------------------- |
| RUNBOOK_GO_LIVE_v1.0.md       | EQUIVALENT | docs/ops/GO_LIVE_RUNBOOK.md   | Go-live runbook exists       |
| RUNBOOK_AGENT_CONTROL_v1.0.md | EQUIVALENT | docs/RUNBOOK_AGENT_CONTROL.md | Agent control runbook exists |

### Existing Runbooks

| Document                       | Location                                                        | Status |
| ------------------------------ | --------------------------------------------------------------- | ------ |
| GO_LIVE_RUNBOOK.md             | docs/ops/GO_LIVE_RUNBOOK.md                                     | ACTIVE |
| RUNBOOK_AGENT_CONTROL.md       | docs/RUNBOOK_AGENT_CONTROL.md                                   | ACTIVE |
| AUTOPILOT_ROLLOUT_RUNBOOK.md   | docs/ops/AUTOPILOT_ROLLOUT_RUNBOOK.md                           | ACTIVE |
| RUNBOOK_LOCAL.md               | docs/ops/RUNBOOK_LOCAL.md                                       | ACTIVE |
| SPRINT_VERIFICATION_RUNBOOK.md | docs/SPRINT_VERIFICATION_RUNBOOK.md                             | ACTIVE |
| OPERATIONS_RUNBOOK.md          | apps/command-center/docs/OPERATIONS_RUNBOOK.md                  | ACTIVE |
| PRODUCTION_RUNBOOK.md          | apps/smart-form/PRODUCTION_RUNBOOK.md                           | ACTIVE |
| DEPLOYMENT_RUNBOOK.md          | infrastructure/kubernetes/apps/smart-form/DEPLOYMENT_RUNBOOK.md | ACTIVE |

---

## 9. Governance (governance/v1/)

| Artifact                          | Status | Canonical Path                                  | Notes  |
| --------------------------------- | ------ | ----------------------------------------------- | ------ |
| CONSTITUTION_v1.0.md              | EXISTS | governance/v1/CONSTITUTION_v1.0.md              | Tier 1 |
| SYSTEM_INVARIANTS_v1.0.md         | EXISTS | governance/v1/SYSTEM_INVARIANTS_v1.0.md         | Tier 1 |
| CLAUDE_EXECUTION_CONTRACT_v1.0.md | EXISTS | governance/v1/CLAUDE_EXECUTION_CONTRACT_v1.0.md | Tier 1 |
| ENV_CONTRACT_v1.0.md              | EXISTS | governance/v1/ENV_CONTRACT_v1.0.md              | Tier 1 |
| TAG_TRUTH_ENFORCEMENT_v1.0.md     | EXISTS | governance/v1/TAG_TRUTH_ENFORCEMENT_v1.0.md     | Tier 1 |
| GOVERNANCE_VERSIONING_RULES.md    | EXISTS | governance/v1/GOVERNANCE_VERSIONING_RULES.md    | Tier 1 |

---

## Summary Statistics

| Category      | Total  | EXISTS/EQUIVALENT | PLACEHOLDER | MISSING |
| ------------- | ------ | ----------------- | ----------- | ------- |
| Blueprints    | 3      | 1                 | 2           | 0       |
| Architecture  | 5      | 4                 | 1           | 0       |
| DB Contracts  | 4      | 4                 | 0           | 0       |
| API Contracts | 3      | 0                 | 3           | 0       |
| App Specs     | 4      | 4                 | 0           | 0       |
| Product Docs  | 5      | 2                 | 3           | 0       |
| SOPs          | 2      | 1                 | 1           | 0       |
| Runbooks      | 2      | 2                 | 0           | 0       |
| Governance    | 6      | 6                 | 0           | 0       |
| **TOTAL**     | **34** | **24**            | **10**      | **0**   |

---

## Placeholders Needed

The following placeholders will be created this sprint:

1. `docs/blueprints/REPO_STRUCTURE_LOCK_v1.0.md`
2. `docs/blueprints/UNIT_TALK_MASTER_SYSTEM_BLUEPRINT_v1.0.md`
3. `docs/architecture/v1/OBSERVABILITY_ARCHITECTURE_v1.0.md`
4. `docs/api/v1/ROUTES_SPEC_v1.0.md`
5. `docs/api/v1/ERROR_CODES_v1.0.md`
6. `docs/api/v1/RATE_LIMITING_POLICY_v1.0.md`
7. `docs/product/v1/PRICING_MODEL_v1.0.md`
8. `docs/product/v1/ENTITLEMENTS_MAP_v1.0.md`
9. `docs/product/v1/USER_PERSONAS_v1.0.md`
10. `docs/ops/sop/SOP_MIGRATION_CHECKLIST_v1.0.md`

---

**Document Owner**: Engineering Team **Created**: 2026-02-27 **Sprint**:
BLUEPRINT-FOUNDATION-AUDIT-001
