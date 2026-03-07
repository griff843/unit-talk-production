# DOCUMENTATION vs RUNTIME CONFORMANCE AUDIT

**Sprint**: SPRINT-RUNTIME-TRUTH-AUDIT-035A
**Date**: 2026-03-06
**Purpose**: Pipeline-by-pipeline comparison of governing docs against actual code and runtime behavior

---

## Documentation Precedence (highest to lowest)

When two documents conflict, the higher-precedence document wins. The conflict itself is flagged as **DOC DANGEROUS**.

| Level | Document | Authority | Status |
|-------|----------|-----------|--------|
| 1 | `CLAUDE_EXECUTION_CONTRACT.md` | HARD LAW — non-negotiable invariants | Active, enforced by CI |
| 2 | `docs/SYSTEM_INVARIANTS.md` | 11 permanent operating rules | Active, partially enforced |
| 3 | `docs/contracts/PICK_LIFECYCLE_CONTRACT.md` | Pick state machine, immutability, idempotency | Active, partially enforced |
| 3 | `docs/contracts/PROMOTION_AUTHORITY_BOUNDARY.md` | Stage 1 vs Stage 2 promotion separation | Active, code conforms |
| 3 | `docs/contracts/DISCORD_EMBED_CONTRACT.md` | Discord message format, CI-locked | Active, CI-enforced |
| 4 | `CLAUDE.md` (root) | Sprint governance, canonical tables, service boundaries | Active, reviewed frequently |
| 5 | `apps/api/CLAUDE.md` | API service contract, agent listing, write authority | Active, some stale entries |
| 6 | `docs/ENV_CONTRACT.md` | Environment variable governance | Active, Zod-enforced at boot |
| 7 | Agent `README.md` files | Aspirational capability docs — NOT binding | **DOC DANGEROUS** — describe unbuilt features |
| 8 | `docs/COMPREHENSIVE_SYSTEM_AUDIT_2025.md` | Point-in-time snapshot (2025) | **DOC STALE** — may not reflect current state |
| 9 | `docs/PROFESSIONAL_GRADING_SYSTEM_v2025.md` | Feature spec — aspirational | **DOC DANGEROUS** — describes unbuilt ensemble |

**Resolution rule**: When two docs conflict, the higher-precedence doc wins.

---

## Classification System

| Classification | Meaning |
|---------------|---------|
| **MATCH** | Docs, code, and runtime agree |
| **DOC STALE** | Docs describe something outdated; the description is harmless — update at leisure |
| **DOC DANGEROUS** | Docs describe behavior that contradicts actual runtime and could mislead an operator into breaking changes |
| **CODE DRIFT** | Code exists but doesn't match docs or isn't wired to runtime |
| **RUNTIME BROKEN** | Code is referenced at runtime but fails — includes concrete evidence |

---

## Pipeline A: Ingestion

### Doc Claims

| Source (Level) | Claim |
|----------------|-------|
| `apps/api/CLAUDE.md` (L5) | Lists both **IngestionAgent** and **FeedAgent** as production agents under "Data Pipeline" category |
| `CLAUDE.md` (L4) | Does NOT list `raw_props` in canonical tables |
| `ENV_CONTRACT.md` (L6) | `ODDS_API_KEY`, `OPTIMAL_API_KEY`, `SGO_API_KEY` all listed as optional |
| `types/activities.ts` | `FeedAgentActivities` defines 9 methods including `ingestOptimalProps`, `ingestFallbackProps(provider: 'SGO' | 'OddsAPI')` |

### Runtime Reality

- **FeedAgent** is the sole ingestion agent. `IngestionAgent` exists as a module (`agents/IngestionAgent/fetchRawProps.ts`) but is ONLY imported by FeedAgent — never registered as a worker activity.
- `raw_props` is the primary ingestion target table. FeedAgent writes directly: `supabaseClient.from('raw_props').insert(batch)` at `FeedAgent/activities/index.ts:256`.
- Optimal API is configured as primary for MLB/NBA/NFL/NHL via `dataSourceRouter.ts` but returns 503 at runtime. OddsAPI is the only functional provider.
- `ingestFallbackProps` references SGO provider but no SGO implementation exists.

### Findings

| Finding | Classification | Detail |
|---------|---------------|--------|
| `apps/api/CLAUDE.md` lists IngestionAgent as production | **DOC STALE** | IngestionAgent is a utility module imported by FeedAgent, not a standalone agent. Harmless but misleading. |
| `raw_props` not in CLAUDE.md canonical tables | **DOC DANGEROUS** | `raw_props` is the primary ingestion table with active writes. An operator reading CLAUDE.md would not know it exists and could make destructive changes to it. Must be classified and added. |
| `ingestFallbackProps` references `'SGO'` provider | **CODE DRIFT** | No SGO API client exists. The type contract defines it, syndicate-scheduler calls it, but no implementation. Dead reference. |
| Optimal API configured as primary, returns 503 | **CODE DRIFT** | `dataSourceRouter.ts` routes 4 major leagues to Optimal first, but Optimal is non-functional. OddsAPI serves all traffic. Runtime works but does not match configured routing. |
| `ingestOptimalProps` in type contract | **DOC STALE** | Type-only definition. No implementation, no workflow caller. Harmless dead type. |

---

## Pipeline B: Scoring / Grading

### Doc Claims

| Source (Level) | Claim |
|----------------|-------|
| GradingAgent `README.md` (L7) | "Multi-model ensemble scoring" with XGBoost, Neural Networks, Poisson, Monte Carlo, expert system rules. Tier 1-4 classification. |
| `PROFESSIONAL_GRADING_SYSTEM_v2025.md` (L9) | Describes professional-grade multi-model grading pipeline |
| `types/activities.ts` | `GradingAgentActivities` defines 5 methods: `gradeNewProps`, `scoreTopTierPicks`, `updateUnifiedPicks`, `getNewUnifiedPicks`, `gradeSubmission` |
| `apps/api/CLAUDE.md` (L5) | Lists GradingAgent under "Business Intelligence" category |

### Runtime Reality

- `GradingAgentActivitiesImpl` class exists with all 5 methods implemented at `GradingAgent/activities/activities.ts`
- The barrel export (`GradingAgent/activities/index.ts`) exports factory functions with wrong signatures — NOT the class methods the workflow needs
- **None of the 5 workflow-needed activities are registered on the worker**
- The entire grading pipeline is non-functional

### Findings

| Finding | Classification | Detail |
|---------|---------------|--------|
| GradingAgent README claims multi-model ensemble | **DOC DANGEROUS** | The README describes XGBoost, Neural Networks, Poisson, Monte Carlo models. These are aspirational — the class delegates to `agent.gradeNewProps()` which may or may not implement these models, but THE ACTIVITY IS NOT EVEN REGISTERED. An operator reading the README would believe sophisticated scoring is running. It is not. |
| `PROFESSIONAL_GRADING_SYSTEM_v2025.md` describes pipeline | **DOC DANGEROUS** | This is a feature spec that was never fully wired to runtime. Misleading because it implies a working professional grading system. |
| GradingAgent barrel exports factory functions | **CODE DRIFT** | The barrel exports `gradeProp(config, deps)` etc. — factory pattern incompatible with Temporal. The class methods exist but are not exported in a Temporal-callable form. |
| `gradeNewProps` activity not registered | **RUNTIME BROKEN** | Evidence: `2026-03-07T00:38:55.457Z [ERROR] Activity function gradeNewProps is not registered on worker` |

---

## Pipeline C: Promotion (Stage 1 → Stage 2)

### Doc Claims

| Source (Level) | Claim |
|----------------|-------|
| `PROMOTION_AUTHORITY_BOUNDARY.md` (L3) | Stage 1 = eligibility gate (`promotionPolicy.ts`). Stage 2 = band assignment (`analysis/promotion/`). Neither stage writes to `unified_picks` directly. |
| `CLAUDE_EXECUTION_CONTRACT.md` (L1) | `promoter` role writes promotion fields via lifecycle adapters |
| `CLAUDE.md` (L4) | `promoter` role has authority over "Queue/promote picks" |

### Runtime Reality

- Stage 1 (`promotionPolicy.ts`) and Stage 2 (`analysis/promotion/`) code exists and follows the documented boundary
- **However**: The upstream grading pipeline is broken (gradeNewProps not registered), so no scored picks ever reach the promotion stage
- `GradingAgent.ts:757` has a direct `.insert()` on `unified_picks` in the `promoteToUnifiedPicks` method — bypasses lifecycle adapters

### Findings

| Finding | Classification | Detail |
|---------|---------------|--------|
| Promotion architecture docs match code | **MATCH** | Stage 1 and Stage 2 separation is correctly implemented in code. The `PROMOTION_AUTHORITY_BOUNDARY.md` accurately describes the code. |
| Promotion pipeline unreachable due to broken grading | **RUNTIME BROKEN** | No picks flow through promotion because `gradeNewProps` is not registered. The promotion code is correct but unreachable. |
| `GradingAgent.ts:757` direct insert to `unified_picks` | **CODE DRIFT** | The `promoteToUnifiedPicks` method bypasses lifecycle adapters. Violates Level 1 doc (`CLAUDE_EXECUTION_CONTRACT.md`). |

---

## Pipeline D: Discord Posting

### Doc Claims

| Source (Level) | Claim |
|----------------|-------|
| `DISCORD_EMBED_CONTRACT.md` (L3) | v2.1.0 embed format, CI-locked, specific field requirements |
| `CLAUDE_EXECUTION_CONTRACT.md` (L1) | `poster` role writes Discord fields via lifecycle adapters |
| `apps/api/CLAUDE.md` (L5) | DiscordPromotionAgent listed under "Lifecycle" agents |

### Runtime Reality

- DiscordPromotionAgent exists and uses `atomicClaimForPost` (lifecycle adapter) — **MATCH**
- The syndicate-scheduler Discord pipeline calls `buildPickEmbeds`, `sendCriticalDiscordAlerts`, `batchDiscordAlerts` — all RUNTIME BROKEN (not registered)
- The actual Discord posting path (DiscordPromotionAgent) is separate from the syndicate-scheduler path

### Findings

| Finding | Classification | Detail |
|---------|---------------|--------|
| DiscordPromotionAgent uses lifecycle adapters | **MATCH** | Code matches Level 1 and Level 3 doc requirements |
| syndicate-scheduler Discord path is broken | **RUNTIME BROKEN** | `buildPickEmbeds`, `sendCriticalDiscordAlerts`, `batchDiscordAlerts` are not registered. This is a SECOND Discord posting path that was never wired up. |
| Embed contract is CI-locked | **MATCH** | `DISCORD_EMBED_CONTRACT.md` v2.1.0 is enforced |

---

## Pipeline E: Settlement

### Doc Claims

| Source (Level) | Claim |
|----------------|-------|
| `PICK_LIFECYCLE_CONTRACT.md` (L3) | Settlement is idempotent via `settle_key = pick_id + settlement_source`. Once `settlement_result` is set, only `operator_override` can modify. |
| `CLAUDE_EXECUTION_CONTRACT.md` (L1) | `settler` role writes settlement fields via `lifecycleSettle` |
| `SYSTEM_INVARIANTS.md` (L2) | SettlementAgent is **fail-open** (non-fatal to platform) |

### Runtime Reality

- SettlementAgent exists and uses `lifecycleSettle` — **MATCH**
- Settlement is blocked because upstream grading never produces settled-ready picks
- SettlementAgent is correctly designated fail-open

### Findings

| Finding | Classification | Detail |
|---------|---------------|--------|
| SettlementAgent code matches docs | **MATCH** | Settlement uses lifecycle adapters, fail-open designation is correct |
| No picks reach settlement | **RUNTIME BROKEN** (upstream) | Blocked by grading pipeline failure, not a settlement-specific issue |

---

## Pipeline F: Recap

### Doc Claims

| Source (Level) | Claim |
|----------------|-------|
| `apps/api/CLAUDE.md` (L5) | RecapAgent listed under "Business Intelligence" agents |

### Runtime Reality

- RecapAgent activities are registered and workflow runs (**MATCH** for activity registration)
- `RecapAgent/index.ts:693` has direct `.update()` on `unified_picks` — single-writer violation
- Recap workflows are functionally a no-op because no settled picks exist to recap

### Findings

| Finding | Classification | Detail |
|---------|---------------|--------|
| RecapAgent activities match | **MATCH** | All 4 recap activities registered and callable |
| RecapAgent direct write to `unified_picks` | **CODE DRIFT** | `RecapAgent/index.ts:693` — direct `.update()` bypasses lifecycle adapters. Violates Level 1 doc. |

---

## Cross-Cutting: Single-Writer Compliance

### Doc Claims

| Source (Level) | Claim |
|----------------|-------|
| `CLAUDE_EXECUTION_CONTRACT.md` (L1) | ALL `unified_picks` writes via lifecycle adapters. HARD LAW. |
| `SYSTEM_INVARIANTS.md` (L2) | Invariant #1: Single-Writer Discipline. Enforced by CI gate. |
| `CLAUDE.md` (L4) | Single-writer policy section with adapter examples |

### Runtime Violations Found

| Location | Type | Writer | Violation |
|----------|------|--------|-----------|
| `GradingAgent/GradingAgent.ts:757` | INSERT | `supabase.from('unified_picks').insert(...)` | Direct insert in `promoteToUnifiedPicks()` |
| `RecapAgent/index.ts:693` | UPDATE | `supabase.from('unified_picks').update(...)` | Direct update in recap flow |
| `FeedAgent/activities/index.ts:256` | INSERT | `supabaseClient.from('raw_props').insert(batch)` | Direct insert to `raw_props` — **not a violation** if `raw_props` is not governed by single-writer, but table needs classification |

### Classification

| Finding | Classification | Detail |
|---------|---------------|--------|
| GradingAgent direct insert | **CODE DRIFT** | Violates Level 1 doc. The CI gate (`lifecycle:single-writer -- --strict`) should catch this — needs investigation whether the gate allowlist excludes GradingAgent |
| RecapAgent direct update | **CODE DRIFT** | Same violation. Should be caught by CI gate. |
| FeedAgent raw_props insert | **UNKNOWN** | `raw_props` is not listed in CLAUDE.md canonical tables and has no lifecycle adapter. Need truth decision: is `raw_props` governed by single-writer? |

---

## Cross-Cutting: Agent Listing Accuracy

### `apps/api/CLAUDE.md` Agent Categories (Level 5)

| Category | Listed Agents | Runtime Status |
|----------|--------------|----------------|
| Business Intelligence | GradingAgent | **CODE DRIFT** — exists but activity barrel broken |
| Business Intelligence | ScoringAgent | **DOC STALE** — no `ScoringAgent` directory exists |
| Business Intelligence | AnalyticsAgent | **CODE DRIFT** — activity name mismatch (`runAnalyticsAgent` vs `runAnalyticsAgentActivity`) |
| Business Intelligence | AlertAgent | **CODE DRIFT** — only 4 of 13 type-defined activities implemented |
| Business Intelligence | FeedAgent | **MATCH** — functional for ingestion |
| Business Intelligence | RecapAgent | **MATCH** — activities registered |
| Operational | NotificationAgent | **CODE DRIFT** — `sendNotification` overwritten by AlertAgent name collision |
| Operational | PlayerEnrichmentAgent | **DOC STALE** — workflow disabled in start-all-workflows.ts |
| Operational | AuditAgent | **DEAD CODE** — activities registered but never called |
| Operational | DataAgent | **DOC STALE** — no `DataAgent` directory exists |
| Operational | OperatorAgent | **MATCH** — partially functional via cross-module activity sources |
| Lifecycle | DiscordPromotionAgent | **MATCH** — uses lifecycle adapters correctly |
| Lifecycle | SettlementAgent | **MATCH** — uses lifecycle adapters correctly |
| Data Pipeline | IngestionAgent | **DOC STALE** — utility module, not a standalone agent |
| Data Pipeline | BridgeWorker | **UNKNOWN** — not assessed in this audit |

### Findings

| Finding | Classification |
|---------|---------------|
| `ScoringAgent` listed in docs, does not exist | **DOC STALE** |
| `DataAgent` listed in docs, does not exist | **DOC STALE** |
| `IngestionAgent` listed as pipeline agent, is actually utility module | **DOC STALE** |

---

## Cross-Cutting: Canonical Tables

### `CLAUDE.md` Canonical Tables (Level 4)

| Table | Doc Status | Runtime Reality | Classification |
|-------|-----------|----------------|---------------|
| `unified_picks` | CANONICAL | Active, lifecycle-protected (with 2 violations) | **MATCH** (with CODE DRIFT violations) |
| `participants` | CANONICAL | Active | **MATCH** |
| `participant_memberships` | CANONICAL | Active | **MATCH** |
| `bridge_outbox` | ACTIVE | Active | **MATCH** |
| `agent_health` | ACTIVE | Active | **MATCH** |
| `prop_settlements` | ACTIVE | Active | **MATCH** |
| `daily_picks` | DEPRECATED | Unused | **MATCH** |
| `players` | DEPRECATED | Unused | **MATCH** |
| `teams` | DEPRECATED | Unused | **MATCH** |
| `raw_props` | **NOT LISTED** | Active ingestion table with 3000+ writes per cycle | **DOC DANGEROUS** |
| `games` | **NOT LISTED** | Active table, upserted by FeedAgent | **DOC DANGEROUS** |
| `agent_logs` | **NOT LISTED** | Written by BaseAgent `logActivity()` | **DOC STALE** |

---

## Audit Summary

| Classification | Count | Severity |
|---------------|-------|----------|
| **MATCH** | 12 | — |
| **DOC STALE** | 7 | Low — update at leisure |
| **DOC DANGEROUS** | 5 | High — could mislead operators |
| **CODE DRIFT** | 7 | Medium — code exists but violates contracts |
| **RUNTIME BROKEN** | 5 | Critical — pipeline non-functional |
| **UNKNOWN** | 2 | Needs investigation |

### DOC DANGEROUS items requiring immediate attention:

1. `raw_props` not in CLAUDE.md canonical tables — active table with thousands of writes
2. `games` not in CLAUDE.md canonical tables — active table with upserts
3. GradingAgent README claims multi-model ensemble running — it is not registered
4. `PROFESSIONAL_GRADING_SYSTEM_v2025.md` implies working professional grading — pipeline is broken
5. GradingAgent README Tier 1-4 system — conflates with Band A+/A/B/C/SUPPRESS from PROMOTION_AUTHORITY_BOUNDARY

---

**Generated**: 2026-03-06T20:15:00-05:00
**Sprint**: SPRINT-RUNTIME-TRUTH-AUDIT-035A
