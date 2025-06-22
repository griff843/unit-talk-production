# TODO / Issue Tracker – Unit Talk Production  
*(Generated: 2025-06-19 – Factory.ai QA)*  

Legend – **Priority**:  
- **P0** = Launch-blocking, fix before investor demo  
- **P1** = High-impact, fix within 72 h post-launch  
- **P2** = Important, sprint within 2 weeks  
- **P3** = Nice-to-have / technical debt  

---

## ⏱ P0 – Launch-Blocking

| ✔︎ | Agent / Area | Description & Pointer | Recommendation | Owner | Track In |
|---|--------------|-----------------------|----------------|-------|---------|
| [ ] GradingAgent / Scoring | Duplicate scoring logic in `src/logic/scoring/*` **and** `src/agents/GradingAgent/scoring/*` – risk of drift | Consolidate to single module, export version constant, update imports | Data Eng | Code PR |
| [ ] RecapAgent / Scheduling | Hour-based schedule logic (inside `process()`) instead of Temporal cron | Implement Temporal cron workflow; remove manual intervals | Backend | Code PR |
| [ ] AlertAgent / LLM Cost | No circuit-breaker; potential uncontrolled OpenAI token spend | Add global quota + fallback cache; surface metric `llm_circuit_open` | Backend | Code PR |
| [ ] Tests / Folder Hygiene | Test files located under `/src` (`FeedAgent/test`, `MarketingAgent/tests.ts`, `__tests__` dirs) | Move to `/test/**`; update jest path mapping | DevOps | Repo chore |
| [ ] Docs / Env Matrix | `.env.example` missing full variable list; onboarding blocker | Generate complete matrix; link to `config/env.ts` validation | Docs | Notion |

---

## 🔥 P1 – High Priority (≤ 72 h)

| ✔︎ | Agent / Area | Description & Pointer | Recommendation | Owner | Track In |
|---|--------------|-----------------------|----------------|-------|---------|
| [ ] RecapAgent / Micro-Recap | Cool-down timestamp only in memory (`roiWatcherInterval`) | Persist last micro-recap time in Supabase `recap_state` table | Backend | Code PR |
| [ ] AlertAgent / Config | Rate-limit values hard-coded (`RATE_LIMITS`) | Move to `config/agentConfig.ts` + env override | Backend | Code PR |
| [ ] IngestionAgent / De-dupe | Duplicate hashing weak (`isDuplicate.ts` ID + player + market only) | Add line, book, game-date hash; unit test edge cases | Backend | Code PR |
| [ ] Temporal Ops SOP | No runbook for restarting stuck workflows | Create `/docs/ops/temporal-operations-sop.md` | Dev Ops | Notion |
| [ ] KPI Dashboard | Alert latency / Tier ROI metrics exist but not mapped in Grafana | Update Retool/Grafana dashboard & KPI SOP mapping | Analytics | ClickUp |
| [ ] EdgeScoring Tests | After consolidation, snapshot tests to guarantee identical output | Add Jest golden-file tests | Data Eng | Code PR |

---

## ⚙️ P2 – Medium Priority (Sprint)

| ✔︎ | Agent / Area | Description | Recommendation | Owner | Track In |
|---|--------------|-------------|----------------|-------|---------|
| [ ] NotificationAgent | AlertAgent bypasses omni-channel flow | Route alerts through NotificationAgent for SMS/email | Backend | Code PR |
| [ ] OperatorAgent | Auto-restart failed agents not implemented | Watch Temporal failures, issue `START` command | Backend | Code PR |
| [ ] Metrics / Coverage | No Jest coverage gate; current ≈ 38 % | Add `--coverage` run + 70 % threshold | DevOps | Code PR |
| [ ] Husky Deprecation | `husky install` deprecated warning | Replace with `lint-staged` & GH Action | DevOps | Repo chore |
| [ ] Discord / OpenAI Mocks | Missing in tests → AlertAgent untested | Implement nock/fetch-mock helpers | Backend | Code PR |
| [ ] Documentation / Agent Runbooks | Grading, Alert, Ingestion, Notification runbooks absent | Create docs under `/docs/agents/` | Docs | Notion |
| [ ] SLO / SLA Definition | No formal latency/uptime targets | Draft `/docs/slo-sla.md` with thresholds | Product Ops | Notion |

---

## 📦 P3 – Low Priority / Tech Debt

| ✔︎ | Agent / Area | Description | Recommendation | Owner | Track In |
|---|--------------|-------------|----------------|-------|---------|
| [ ] FeedAgent / Tests | Improve provider error-handling tests | Add failure mocks | Backend | Code |
| [ ] Promotion / Contest Agents | Legacy logic may diverge from new scoring | Review & align after edge consolidation | Growth Eng | ClickUp |
| [ ] Supabase Secrets | Webhook URLs stored as env keys | Migrate to Supabase Secrets Manager or Vault | DevOps | Infra |
| [ ] Retool Guide | No user guide for dashboard edits | Author `/docs/retool-dashboard-guide.md` | Data Eng | Notion |
| [ ] Archive Old Docs | Move `*_SUMMARY.md` & enhancement files to `/docs/archive/` | Docs cleanup | Docs | Repo chore |

---

## ✉️ Ticket Creation Tips

For each unchecked item:  
1. Create Notion/ClickUp ticket with the **same title**.  
2. Add **code pointer** (file path & line) if applicable.  
3. Include **acceptance criteria** (unit tests passing, doc updated, metric visible, etc.).  
4. Tag with `priority::P0` – `P3`, `agent::<name>`, and `type::code|doc|infra`.  

---

## Progress Tracking

- P0 items must reach ✅ before “high-value investor” launch gate.  
- Daily stand-up: report blockers on P0/P1.  
- Use `npm run test:cov && tsc --noEmit && npm run build` as green-build gate.

---

*Maintained by Factory.ai QA.  Update this file whenever a checkbox is completed or a new issue emerges.*
