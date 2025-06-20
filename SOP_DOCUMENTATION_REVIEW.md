# Unit Talk Production – SOP & Documentation Review  
*(Version 2025-06-19 – Pre-launch QA)*  

---

## 1. Executive Summary  

The current documentation set – found primarily in `/docs`, root-level `*_SUMMARY.md` files, and scattered READMEs – covers ~70 % of the platform’s surface area. Core architectural concepts, agent-development workflow, and generic operational SOPs are solid, but **critical run-time details, environment variable matrices, and Temporal-workflow guidance are incomplete or stale.**  
A focused documentation sprint is required to hit Fortune-100 onboarding and audit standards before launch.

---

## 2. Documentation Inventory & Status  

| Doc / SOP | Located At | Coverage Scope | Last Update | Status | Key Gaps |
|-----------|-----------|----------------|-------------|--------|----------|
| README.md (root) | `/README.md` | High-level project intro | 2025-06-19 | 🟡 Partial | Missing Temporal overview, env table, quick-start script |
| ARCHITECTURE.md | `/docs/ARCHITECTURE.md` | Macro architecture | 2025-06-19 | 🟢 Good | Needs diagram of Temporal & Discord flows |
| Agent Development SOP | `/docs/agent-development-sop.md` | How to build new agents | 2025-06-19 | 🟢 Good | No sample Temporal workflow template |
| KPI Documentation SOP | `/docs/kpi-documentation-sop.md` | KPI lifecycle | 2025-06-19 | 🟢 Good | KPI definitions not wired to Prometheus metric names |
| System Health & Recovery SOP | `/docs/system-health-recovery-sop.md` | Incident procedures | 2025-06-19 | 🟢 Good | Lacks Temporal replay instructions |
| External Integration SOP | `/docs/external-integration-sop.md` | Discord/Notion/Retool | 2025-06-19 | 🟡 Partial | Supabase & SGO API sections missing |
| System Upgrade Automation SOP | `/docs/system-upgrade-automation-sop.md` | CI/CD & DB migrations | 2025-06-19 | 🟡 Partial | Husky/hot-patch flow outdated |
| RecapAgent Deployment Guide | `/docs/recap-agent-deployment.md` | Single-agent runbook | 2025-06-19 | 🟢 Good | Needs Notion token rotation guide |
| ENHANCEMENT / IMPLEMENTATION / MIGRATION summaries | root | Historical context | 2025-06-19 | 🔵 Archive | Move to `/docs/archive/` |
| **Missing** | – | Alert, Grading, Ingestion, Notification agent runbooks | – | 🔴 None | Create dedicated docs |
| **Missing** | – | Temporal workflow design & failure-handling SOP | – | 🔴 None | Create |
| **Missing** | – | `.env.example` / config matrix | – | 🔴 None | Create |
| **Missing** | – | Retool dashboard user guide | – | 🔴 None | Create |

---

## 3. Gap Analysis by Domain  

### 3.1 Core Architecture & Temporal  
* No end-to-end diagram showing Temporal worker, workflow proxies, activity scheduling.  
* Absence of a **Temporal Operations SOP** (starting worker, viewing UI, replaying failed workflows, executing “cancel / terminate / reset”).  
* Health-check SOP lacks Temporal service-down scenario.

### 3.2 Agents  
| Agent | Existing Doc | Gaps Identified |
|-------|--------------|-----------------|
| GradingAgent | None | Tier thresholds, EdgeScoring versioning, env vars (`EDGE_CONFIG_*`) |
| AlertAgent | None | Rate-limit tuning, LLM cost guardrails, multi-channel flow |
| IngestionAgent | None | SGO polling cadence, duplicate-hash algorithm, supabase schema |
| NotificationAgent | None | Channel matrix, fail-over order, Twilio/SMS env vars |
| FeedAgent & DataAgent | None | Provider contract, normalization fields |
| RecapAgent | ✅ deployment guide | Add Temporal cron usage, micro-recap cooldown persistence |
* **Action**: produce “Agent Runbook” template & instantiate per agent.

### 3.3 Integrations  
* External Integration SOP omits **Supabase role setup**, **SGO API key rotation**, **OpenAI usage limits**.  
* No document explains **Retool dashboard architecture** (tables, queries, secret storage).  
* Missing **Discord permission model** & rate-limit table.

### 3.4 Infrastructure / DevOps  
* CI/CD narrative in Upgrade SOP predates migration to GitHub Actions matrix; needs update.  
* `.droid.yaml` review-guideline doc not included – add pointer.  
* Husky install deprecation flagged in build output; SOP must reflect new pre-commit strategy.

### 3.5 KPIs & Monitoring  
* KPI SOP lists categories but not concrete **Prometheus metric ➜ Grafana panel ➜ Stakeholder** mapping.  
* Alert latency, Grading accuracy, Tier ROI have metric names in code (`alert_processing_time_ms`, etc.) but are undocumented.  
* No **SLO/SLA doc** (acceptable error rates, latency thresholds).

### 3.6 Incident Response & Runbooks  
* Recovery SOP thorough but lacks:  
  * **Temporal stuck workflow** playbook  
  * **Supabase permission outage** steps  
  * **LLM quota exhaustion** mitigation

---

## 4. Documentation Improvement Roadmap  

| Priority | Task | Deliverable | Owner | Target |
|----------|------|-------------|-------|--------|
| P0 | Create `.env.example` with full variable matrix and descriptions | File ready for repo | Eng | +1 day |
| P0 | Write **Temporal Operations SOP** | `/docs/temporal-operations-sop.md` | Dev Ops | +2 days |
| P0 | Produce **Agent Runbooks** (Grading, Alert, Ingestion, Notification, Feed) including diagrams & KPI tables | 5 markdown files | Lead Dev | +3 days |
| P1 | Update README with diagram, quick-start script, architecture image | README v2 | Docs | +3 days |
| P1 | Expand External Integration SOP with Supabase, SGO, OpenAI sections | Updated doc | Integrations | +4 days |
| P1 | Draft **Retool Dashboard Guide** | `/docs/retool-dashboard-guide.md` | Data Eng | +4 days |
| P2 | Map Prometheus metrics → KPIs → Grafana panels in KPI SOP | Matrix table | Analytics | +5 days |
| P2 | Add SLO/SLA document | `/docs/slo-sla.md` | Product Ops | +5 days |
| P2 | Move historical enhancement files into `/docs/archive/` | Clean tree | Docs | +2 days |
| P3 | Refactor Upgrade Automation SOP (replace Husky, add GH Actions) | Revised SOP | Dev Ops | +6 days |
| P3 | Add Discord permission & rate-limit appendix | Annex file | Support | +6 days |

*Notion/ClickUp tickets should be created using the above tasks; include code-location pointers.*

---

## 5. Suggested Structural Changes  

1. **/docs/agents/** – dedicated folder per agent (`grading.md`, `alert.md`, …).  
2. **/docs/integrations/** – one file per external system.  
3. **/docs/ops/** – temporal-operations, incident-response, health-check, upgrade-automation.  
4. Embed **Mermaid or SVG** diagrams for architecture (supported by GitHub & Notion).  

---

## 6. Documentation Quality Checklist (post-sprint)  

- [ ] Every agent has Runbook (purpose, lifecycle, env vars, KPIs, maintenance).  
- [ ] README includes quick-start + system diagram.  
- [ ] `.env.example` exhaustive & validated by `config/env.ts` schema.  
- [ ] SOPs reflect actual CI/CD tooling (GitHub Actions, ECR, k8s).  
- [ ] KPI SOP maps every Prometheus metric → dashboard panel.  
- [ ] Temporal Operations SOP tested by new engineer.  
- [ ] Incident & Recovery SOP includes LLM quota and Supabase outage scenarios.  
- [ ] Archive folder stores historical design docs to reduce root clutter.  

---

## 7. Conclusion  

Documentation maturity is **medium-high** but not yet **Fortune-100 audit-ready**. Completing the roadmap will:

* Reduce onboarding time for engineers and VAs.  
* Meet external investor diligence requirements.  
* Minimize operational risk during first production incidents.  

**Blocking for launch?**  
*Docs alone won’t block launch, but lack of Temporal & env guidance could hinder on-call recovery and investor demo. Completing P0 items is strongly recommended before inviting high-value users.*  

*Prepared by Factory.ai Documentation Audit – 2025-06-19*  
