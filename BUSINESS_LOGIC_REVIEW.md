# Unit Talk Production – Business Logic Review  
*(version: 2025-06-19 – pre-launch QA)*  

---

## 0. Executive Summary
The Unit Talk platform is a modular, Temporal-driven sports-betting automation stack whose core revenue engine is the closed-loop workflow  

> ingestion → grading → recap/analytics → alert → dashboard/report  

This review confirms that the cleaned codebase is **functionally complete and TypeScript-clean** yet surfaces several logic-level gaps, deduplication risks, and documentation needs that must be handled before scaling to high-value investors.

---

## 1. BaseAgent (Foundation)

| Aspect | Details |
|--------|---------|
| **Purpose** | Provides life-cycle, health, metrics, and error-handling scaffolding for every other agent. |
| **Key Logic** | • Robust start/stop lifecycle<br>• Safe process loop with exponential back-off<br>• Built-in health/metrics timers.<br>• Command handler (START/STOP/STATUS/HEALTH). |
| **Integrations** | Supabase, Logger, ErrorHandler injected via `deps`. |
| **Findings** | ✅ Solid Fortune-100-grade structure.<br>⚠️ Health/metrics intervals default to seconds but some agents override manually – recommend constants. |
| **Opportunities** | • Promote common retry/back-pressure helpers to BaseAgent so all children share one implementation.<br>• Expose Prometheus counter helper here instead of per-agent. |

---

## 2. GradingAgent

| Aspect | Details |
|--------|---------|
| **Purpose** | Transforms raw `daily_picks` into graded tiers (S–D), enriches with edge score + market resistance, promotes high-tier picks to `final_picks`, publishes risk-based alerts. |
| **Workflow Inputs** | `daily_picks` (pending, no `edge_score`), EdgeConfig, SGO odds, Market data. |
| **Workflow Outputs** | Updated `daily_picks`, new `final_picks`, optional `alerts` row (`market_fade`). |
| **Critical Logic** | `finalEdgeScore` → `determineTier` → `promoteToFinalInternal` (if S/A) → optional alert. |
| **Integrations** | Supabase, OpenAI (notifications), Metrics server. |
| **Issues / Gaps** | • `determineTier` threshold constants hard-coded – move to config.<br>• EdgeScoring V2 plans noted in docs but not linked.<br>• Duplicate edge calculations exist in `logic/scoring` vs agent-local `scoring/*` (risk of drift). |
| **Recommendations** | 1. Centralise scoring engine under `logic/scoring` and import in agent.<br>2. Add unit tests for `marketResistanceEngine` edge cases (e.g., low-liquidity props).<br>3. Store grading version in DB for traceability. |
| **Competitive Angle** | PropsCash/Outlier edge seen in advanced injury-news ingestion; consider sourcing breaking-news feed for next iteration. |

---

## 3. RecapAgent

| Aspect | Details |
|--------|---------|
| **Purpose** | Generates Daily/Weekly/Monthly performance recaps, optional micro-recaps on ROI/streak thresholds, posts to Discord and optionally Notion, records Prometheus metrics. |
| **Workflow Inputs** | `final_picks`, config flags (`MICRO_RECAP`, `ROI_THRESHOLD`, etc.). |
| **Workflow Outputs** | Discord embeds, Notion pages, Prometheus gauges. |
| **Critical Logic** | • Schedule check in `process()` triggers recap functions.<br>• ROI watcher every 5 min for micro-recaps.<br>• Formatter builds Discord embeds with customizable legend. |
| **Integrations** | Discord Webhook, Notion API, Prometheus. |
| **Issues / Gaps** | • Cron schedule duplicated as inline hour checks – unify into true cron/Temporal schedule.<br>• Micro-recap cooldown stored only in memory – not crash-safe.<br>• Slash command handler relies on environment gating but lacks permission checks. |
| **Improvements** | 1. Persist last micro-recap timestamp in Supabase.<br>2. Migrate schedule to Temporal cron workflows for reliability.<br>3. Move embed template strings to config for easier brand tweaks. |
| **Competitive Angle** | Outlier offers slick ROI charts; Retool dashboard could embed sparkline pngs generated here for parity. |

---

## 4. AlertAgent

| Aspect | Details |
|--------|---------|
| **Purpose** | Emits rich Discord alerts for each high-tier `final_pick`; deduplicates, enriches via LLM (adviceEngine), logs for metrics. |
| **Workflow Inputs** | `final_picks` (pending status). |
| **Workflow Outputs** | Discord messages, `unit_talk_alerts_log`, optional Notion/Retool updates. |
| **Critical Logic** | • Deduplication via `unit_talk_alerts_log`.<br>• Rate-limiter per service.<br>• Retry with exponential back-off.<br>• Advice generation uses OpenAI (LLM). |
| **Integrations** | Discord Webhook, OpenAI, Supabase. |
| **Issues / Gaps** | • Notion & Retool calls commented-out; update or remove.<br>• Rate limits hard-coded (2 s) – move to env vars.<br>• LLM failures increment metric but no circuit-breaker – risk of quota abuse. |
| **Improvements** | 1. Implement circuit-breaker round LLM.<br>2. Store advice output for audit / UX re-use (reduces token spend).<br>3. Add sentiment classification to enhance embeds. |
| **Competitive Angle** | Linemate pushes alerts to SMS; our NotificationAgent has SMS channel but AlertAgent bypasses it – consider multi-channel alerts for whale users. |

---

## 5. Other Key Agents (brief)

| Agent | Role | Notes |
|-------|------|-------|
| **IngestionAgent** | Pulls raw props from SGO API, de-dupes, normalizes. | Needs stronger duplicate hashing; add source latency KPI. |
| **FeedAgent** | Public feed fetcher (additional books). | test file inside `/src` should move to `/test`. |
| **NotificationAgent** | Omni-channel message dispatcher (Discord/SMS/Email/Slack). | Channels mapping is sound; ensure AlertAgent routes through here for consistency. |
| **OperatorAgent** | Monitors health & orchestrates commands. | Hook into Temporal to restart failed workflows automatically. |
| **AnalyticsAgent** | Long-running KPI aggregation. | Confirm dashboards pull from its tables, not re-query heavy views. |
| **Promo / Marketing / Contest / Referral** | Growth and gamification. | Business logic non-critical day-1; postpone advanced features. |

---

## 6. Cross-Cutting Concerns

| Topic | Status | Risk / Action |
|-------|--------|---------------|
| **Temporal Workflows** | Defined proxies; ingestion workflow file empty. | Flesh out per-agent workflow classes so retries & cron live inside Temporal rather than manual intervals. |
| **Environment Config** | `config/env.ts` validates variables. | Add schema-driven doc table in README. |
| **Tests** | Many unit tests exist; some legacy tests inside `/src`. | Move `FeedAgent/test`, `MarketingAgent/tests.ts` to `/test`; ensure they reference current APIs. |
| **Metrics & KPIs** | Prometheus implemented in key agents. | Document Tier ROI, Alert latency, Grading accuracy; set alert thresholds. |
| **Security** | Secrets via env; webhook URLs stored directly. | Transition to Vault or Supabase secrets for production. |
| **Copy-cat Resistance** | Proprietary edge scoring + LLM advice. | Additional obfuscation: server-side pick ranking model not exposed in Discord payload. |

---

## 7. Issue & Opportunity Matrix

| Area | Priority | Issue / Opportunity | Suggested Ticket |
|------|----------|---------------------|------------------|
| EdgeScoring duplication | P1 | Two scoring implementations risk drift | “Unify edge scoring engine” |
| Recap scheduling | P1 | Manual hour check vs cron | “Migrate RecapAgent schedule to Temporal cron” |
| AlertAgent LLM circuit-breaker | P1 | Prevent runaway token spend | “Implement OpenAI circuit breaker + caching” |
| Micro-recap persistence | P2 | Cooldown lost on crash | “Persist micro-recap state in Supabase” |
| Config hard-codings | P2 | Rate limits, thresholds inside code | “Parametrize via config/env” |
| Tests in src | P3 | Move stray tests | “Relocate legacy test files” |
| Notion/Retool stubs | P3 | Either implement or strip to avoid dead code | “Finalize Notion sync integration” |

---

## 8. Launch Readiness Assessment

| Dimension | Verdict | Blocking? |
|-----------|---------|-----------|
| **TypeScript Build** | Clean ✅ | No |
| **Core Workflow Connectivity** | End-to-end path functional (manual) ✅ | No |
| **Edge/Scoring Integrity** | Needs unification ⚠️ | **Yes (P1)** |
| **Recap Cron Reliability** | Manual schedule fragile ⚠️ | **Yes (P1)** |
| **Alert Cost Control** | LLM circuit-breaker missing ⚠️ | **Yes (P1)** |
| **Documentation & SOPs** | 80 % complete; missing env/KPI tables ⚠️ | No, but fix soon |
| **Copy-cat Resistance** | Moderate; edge algorithm server-side ✔️ | No |

**Conclusion:** System is **“Near-Launch”**. Resolve the three P1 tickets above to meet Fortune-100 production bar.

---

## 9. Next-Step Recommendations

1. **Edge Scoring Consolidation** – single shared module, version flag in DB.  
2. **Temporal First** – shift all agent scheduling to Temporal Cron for uptime & observability.  
3. **LLM Budget Guard** – global token quota, caching, circuit-breaker.  
4. **KPI Dashboard** – finalize Retool board with real-time Alert latency, ROI trend.  
5. **Docs Refresh** – add `.env.example` table and per-agent runbook snippets.

---

*Prepared by Factory.ai – 2025-06-19*  
*Contact: Griff (Lead Architect) / Factory DevOps*  
