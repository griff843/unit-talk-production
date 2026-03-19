# Delegation Matrix

> Cross-reference of agents, skills, model tiers, and lane assignments.
> Authority: `.claude/rules/07-lane-model.md`,
> `docs/ai/CODEX_PARALLEL_AGENT_POLICY.md`

---

## Agent → Skill → Model Tier Mapping

| Agent                       | Primary Skills                                                            | Model Tier | Lane  |
| --------------------------- | ------------------------------------------------------------------------- | ---------- | ----- |
| `@sprint-manager`           | `sprint_plan`, `sprint_implement`, `sprint_verify`, `sprint_proof_bundle` | Opus       | 1 + 4 |
| `@release-engineer`         | `e2e_smoke_check`, `sprint_verify`                                        | Sonnet     | 3     |
| `@migration-auditor`        | `migration_review`                                                        | Opus       | 2     |
| `@single-writer-sheriff`    | `single_writer_audit`                                                     | Sonnet     | 2     |
| `@proof-bundler`            | `sprint_proof_bundle`                                                     | Haiku      | 3     |
| `@task-delegation-operator` | (any — admin offloading)                                                  | Sonnet     | 4     |

---

## Skill Catalog with Model Tiers

### Sprint Lifecycle

| Skill                 | Model Tier | Purpose                            |
| --------------------- | ---------- | ---------------------------------- |
| `sprint_plan`         | Opus       | Phase 1 planning, scope definition |
| `sprint_implement`    | Sonnet     | Phase 2 code changes               |
| `sprint_verify`       | Sonnet     | Phase 3 gate execution             |
| `sprint_proof_bundle` | Haiku      | Phase 4 artifact capture           |

### Diagnostic & Audit

| Skill                 | Model Tier | Purpose                           |
| --------------------- | ---------- | --------------------------------- |
| `single_writer_audit` | Sonnet     | Lifecycle adapter compliance scan |
| `migration_review`    | Opus       | Migration safety analysis         |
| `lifecycle-diagnose`  | Sonnet     | Pipeline stuck-pick diagnostics   |
| `pick-trace`          | Haiku      | Single pick lifecycle trace       |
| `grading-audit`       | Opus       | Scoring anomaly detection         |
| `scoring-audit`       | Opus       | Comprehensive scoring layer audit |

### Platform Health

| Skill             | Model Tier | Purpose                              |
| ----------------- | ---------- | ------------------------------------ |
| `pipeline-health` | Haiku      | Agent heartbeat, queue, SLO snapshot |
| `agent-health`    | Haiku      | Component operational status         |
| `system-status`   | Haiku      | Full platform position snapshot      |
| `slo-report`      | Haiku      | SLO attainment tracking              |
| `incident-triage` | Sonnet     | Production incident classification   |

### Specialized Analysis

| Skill                   | Model Tier | Purpose                             |
| ----------------------- | ---------- | ----------------------------------- |
| `intelligence-analysis` | Opus       | CLV/calibration/strategy simulation |
| `edge-check`            | Sonnet     | CLV edge and calibration validation |
| `risk-policy`           | Opus       | RiskEngine configuration audit      |
| `settlement-integrity`  | Opus       | Settlement vs outcomes audit        |

### Operations & Integration

| Skill              | Model Tier | Purpose                                  |
| ------------------ | ---------- | ---------------------------------------- |
| `discord-diagnose` | Sonnet     | Discord delivery diagnostics             |
| `linear-sync`      | Haiku      | Sprint state → Linear mirror             |
| `status-sync`      | Haiku      | Repo truth → Linear sync                 |
| `e2e_smoke_check`  | Haiku      | Quick smoke test runner                  |
| `prompt-compose`   | Sonnet     | Sprint direction → implementation prompt |

---

## Model Tier Decision Guide

| Tier       | Use When                                                            | Cost    | Latency |
| ---------- | ------------------------------------------------------------------- | ------- | ------- |
| **Haiku**  | Status reads, artifact capture, single lookups, pass/fail reporting | Lowest  | Fastest |
| **Sonnet** | Code changes, pattern scanning, diagnostics, scripted verification  | Medium  | Medium  |
| **Opus**   | Design decisions, safety analysis, complex audits, orchestration    | Highest | Slowest |

**Default rule**: Start at the lowest tier that can handle the task. Escalate
only when reasoning complexity requires it.

---

## Parallel Agent Dispatch (from Codex Policy)

| Pattern                 | Agents                 | Tiers                               | When                           |
| ----------------------- | ---------------------- | ----------------------------------- | ------------------------------ |
| 2-agent scan+verify     | Haiku + Haiku          | Read-only, bounded, non-overlapping | Audit, health check            |
| 2-agent artifact+verify | Sonnet + Haiku         | Artifact lane + verification lane   | Sprint implementation          |
| 3-agent full            | Sonnet + Haiku + Haiku | Artifact + 2 verify lanes           | Large sprint, sequential waste |

Budget caps: 2-agent <100 turns, 3-agent <150 turns. Opus reserved for authority
thread only.
