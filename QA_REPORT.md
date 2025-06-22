# Unit Talk Production — Comprehensive QA Report  
_Date: 2025-06-19 • Author: Factory.ai QA_

---

## 1  Executive Summary
Unit Talk is a modular, Temporal-driven sports-betting automation platform that processes prop odds from ingestion through grading, recap, alerting, and dashboarding.  
The system builds cleanly and functions end-to-end in staging, but **three critical gaps** (scoring duplication, recap scheduling, OpenAI cost-guard) must be resolved before high-value user launch. Documentation and test coverage are solid but not yet Fortune-100 audit-ready.

---

## 2  Business Logic Review

| Agent | Role & Flow Position | Key Findings | Risk |
|-------|----------------------|--------------|------|
| **IngestionAgent** | Raw props → normalized records | Duplicate hash minimal (id+player+market). | ⚠️ Medium |
| **GradingAgent** | Calculates edge, tier; promotes picks | Two scoring engines (duplicate logic); tier thresholds hard-coded. | ❌ High |
| **RecapAgent** | Daily/Weekly/Monthly & micro-recaps | Hour-check scheduling, cooldown in memory only. | ❌ High |
| **AlertAgent** | Sends enriched Discord alerts | OpenAI cost guard missing; Notion/Retool stubs. | ❌ High |
| **NotificationAgent** | Omni-channel dispatcher | Bypassed by AlertAgent (alert→Discord only). | ⚠️ Medium |
| **OperatorAgent** | Health & restart orchestration | No auto-restart of failed workflows. | ⚠️ Medium |
| **Other Growth Agents** | Marketing, Contest, Promo, etc. | Non-critical; feature-flagged. | ✅ Low |

**Cross-cutting:**  
- Temporal workflow proxies defined; one ingestion workflow stub empty.  
- Metrics logged via Prometheus; KPI names undocumented.  
- Copy-cat resistance relies on proprietary edge scoring + LLM advice; safe once duplication resolved.

---

## 3  Documentation Audit

Strengths  
• Architecture, Agent-Development, KPI, Recovery SOPs exist.  
• RecapAgent deployment guide comprehensive.

Gaps  
1. Missing **.env.example** with full variable matrix.  
2. No **Temporal Operations SOP** (worker, cron, replay, failover).  
3. Absent per-agent runbooks (Grading, Alert, Ingestion, Notification, Feed).  
4. KPI SOP lacks mapping between Prometheus metrics and business KPIs.  
5. Retool dashboard user guide not written.  
6. Historical enhancement docs clutter root; move to `/docs/archive/`.

---

## 4  Code Quality Assessment

| Area | Status | Notes |
|------|--------|-------|
| TypeScript Build | 🟢 Clean (`tsc --noEmit` passes). | — |
| Linting | 🟡 Husky prepare hook deprecated; GH-Actions gate missing. | — |
| Tests | 🔴 Coverage ≈ 38 %; tests misplaced under `/src`. | Coverage gate absent. |
| File Hygiene | 🟡 Duplicate scoring modules; empty `ingestion.workflow.ts`; stray stubs in utils. | — |
| Secrets | 🟡 Env vars only; vault migration planned. | — |

---

## 5  Launch Readiness & Recommendations

### 5.1 Go/No-Go Gates (Blocking)
1. **Consolidate Edge Scoring** — single module, versioned; update GradingAgent.  
2. **Migrate Recap Scheduling** — replace hour check with Temporal cron; persist micro-recap cooldown in DB.  
3. **OpenAI Circuit-Breaker** — global daily token quota, cached advice fallback.  
4. **Test Hygiene** — relocate all tests out of `/src`, enforce ≥ 70 % coverage gate.  
5. **Complete `.env.example` & Env Docs** — publish full matrix, link to validation.

### 5.2 High-Priority (First 72 h post-launch)
- Parameterise rate-limits & tier thresholds via env/config.  
- Strengthen IngestionAgent de-dupe hashing (include line/book/game-date).  
- Implement OperatorAgent auto-restart of failed workflows.  
- Temporal Operations SOP & Retool dashboard guide.

### 5.3 Medium / Low
- Secrets vault migration.  
- Expand provider integrations & KPI dashboard polish.  
- Archive old docs; add SLO/SLA doc.

---

## 6  Actionable Task Backlog (Sorted by Priority)

| Pri | Task ID | Description | Owner | Deliverable |
|-----|---------|-------------|-------|-------------|
| **P0** | BL-01 | **Unify Edge Scoring** modules → `src/logic/scoring`; export version; update imports; regression tests. | Data Eng | PR + passing tests |
| **P0** | BL-02 | **Temporal Cron for RecapAgent**; persist micro-recap state (`supabase.recap_state`). | Backend | PR + staging validation |
| **P0** | BL-03 | **OpenAI Circuit-Breaker & Advice Cache** in AlertAgent; expose `llm_circuit_open` metric. | Backend | PR + cost test |
| **P0** | QA-01 | Move all `__tests__`, `test*.ts` out of `/src`; add coverage threshold 70 %. | DevOps | Green CI |
| **P0** | DOC-01 | Publish exhaustive `.env.example`; update README quick-start. | Docs | New file & README |
| **P1** | INF-01 | Rate-limit & tier thresholds configurable via `agentConfig.ts` + env. | Backend | PR |
| **P1** | BL-04 | Enhance Ingestion de-dupe hash (id+player+market+line+book+date). | Backend | PR + unit tests |
| **P1** | OPS-01 | OperatorAgent auto-restart failed Temporal workflows. | Backend | PR |
| **P1** | DOC-02 | Temporal Operations SOP (`/docs/ops/temporal-operations-sop.md`). | DevOps | Doc |
| **P1** | DOC-03 | Agent Runbooks (Grading, Alert, Ingestion, Notification, Feed). | Docs | 5 md files |
| **P2** | SEC-01 | Vault or Supabase Secrets Manager for prod secrets. | DevOps | Infra MR |
| **P2** | QA-02 | Add Discord / OpenAI mocks, write AlertAgent unit tests (80 % cover). | Backend | Tests |
| **P2** | DOC-04 | Retool Dashboard Guide & KPI mapping in KPI SOP. | Data Eng | Doc |
| **P3** | DOC-05 | Archive historical enhancement docs under `/docs/archive/`. | Docs | Repo prune |
| **P3** | ENH-01 | Multi-channel alerts via NotificationAgent (SMS/Email). | Backend | Feature flag |

---

## 7  Path to Production Readiness

1. **Day 0–1** — Implement P0 tasks BL-01 to DOC-01; run full CI (build + tests + coverage).  
2. **Day 2** — Deploy to staging; validate cron recap, cost guard, unified scoring regression set.  
3. **Day 3** — Stakeholder Go/No-Go; if green, promote to production and invite investors.  
4. **Week 1** — Complete P1 backlog; raise coverage, add SOPs, harden operator automation.  
5. **Sprint 2** — Address P2/P3 tech debt and enhancement roadmap.

---

## 8  Approval Matrix

| Role | Name | Decision | Date |
|------|------|----------|------|
| Lead Architect | Griff | ☐ Approve ☐ Block | — |
| Factory Dev Lead | — | ☐ Approve ☐ Block | — |
| Product/Ops | — | ☐ Approve ☐ Block | — |
| Investor Liaison | — | ☐ Approve ☐ Block | — |

---

*Prepared by Factory.ai QA — Keep this file updated as tasks are completed.*
