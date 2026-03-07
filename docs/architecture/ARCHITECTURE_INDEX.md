# Architecture Index

Status: CANONICAL Authority: Tier 1 Owner: Platform Architecture Last Verified:
2026-03-07 Sprint: SPRINT-ARCHITECTURE-RATIFICATION-041D

---

## Canonical Architecture Documents

These are the authoritative, code-verified architecture documents for Unit Talk.

### Tier 1 — System Diagrams

| Document                                                     | Purpose                                                          | Format               |
| ------------------------------------------------------------ | ---------------------------------------------------------------- | -------------------- |
| [System Architecture](diagrams/SYSTEM_ARCHITECTURE.md)       | Runtime services, infrastructure, external dependencies          | Mermaid flowchart LR |
| [Pick Machine Flow](diagrams/PICK_MACHINE_FLOW.md)           | 5-stage canonical pick lifecycle (Ingestion → Analytics)         | Mermaid flowchart TD |
| [Agent Ownership](diagrams/AGENT_OWNERSHIP.md)               | Agent-to-table write authority with lifecycle adapter mapping    | Mermaid flowchart LR |
| [Database Relationships](diagrams/DATABASE_RELATIONSHIPS.md) | 18-table ER diagram with FK relationships and column definitions | Mermaid erDiagram    |
| [Workflow Orchestration](diagrams/WORKFLOW_ORCHESTRATION.md) | Temporal workflows, schedules, activity routing                  | Mermaid flowchart TD |

### Tier 1 — System Maps

| Document                                                      | Purpose                                                                       |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [Runtime Component Map](../system/RUNTIME_COMPONENT_MAP.md)   | Complete inventory: 6 services, 15 agents, 30+ workflows, 13 activity modules |
| [Canonical Runtime Path](../system/CANONICAL_RUNTIME_PATH.md) | Runtime execution path from startup to steady-state                           |
| [System Overview](../system/SYSTEM_OVERVIEW.md)               | High-level system description and service roles                               |
| [Current System Status](../system/CURRENT_SYSTEM_STATUS.md)   | Live system health and operational state                                      |

### Tier 1 — Governance

| Document                                                                  | Purpose                                                           |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [Table Classification Spec](../governance/TABLE_CLASSIFICATION_SPEC.md)   | Table tiers: CANONICAL, ACTIVE, COMPATIBILITY, SHADOW, DEPRECATED |
| [Agent Ownership Matrix](../governance/AGENT_OWNERSHIP_MATRIX.md)         | 15 agents with barrel exports, worker positions, write authority  |
| [Workflow Activity Contract](../governance/WORKFLOW_ACTIVITY_CONTRACT.md) | Workflow-to-activity binding contracts                            |
| [Provider Authority Spec](../governance/PROVIDER_AUTHORITY_SPEC.md)       | Data source routing, circuit breaker, failover rules              |

### Tier 1 — Data Contracts

| Document                                                           | Purpose                                               |
| ------------------------------------------------------------------ | ----------------------------------------------------- |
| [Pick Lifecycle Contract](../contracts/PICK_LIFECYCLE_CONTRACT.md) | Lifecycle stages: draft → promoted → posted → settled |
| [ERD Schema Reference](ERD_SCHEMA.md)                              | Entity-relationship details and migration history     |

---

## Blueprint & Design Layer (Reference Only)

These documents capture design intent and architectural decisions. They are
**not runtime-verified** — consult Tier 1 docs for ground truth.

### Constitution & Principles

| Document                  | Location                          |
| ------------------------- | --------------------------------- |
| Constitution v2           | `architecture/constitution-v2.md` |
| System Invariants         | `docs/SYSTEM_INVARIANTS.md`       |
| Claude Execution Contract | `CLAUDE_EXECUTION_CONTRACT.md`    |

### Design-Layer Contracts (48 files)

Location: `architecture/contracts/`

Key contracts:

| Contract                       | Scope                                   |
| ------------------------------ | --------------------------------------- |
| `unified-picks-lifecycle.md`   | Pick state machine and transition rules |
| `single-writer-enforcement.md` | Writer role enforcement spec            |
| `posting-idempotency.md`       | Atomic claim and dedup rules            |
| `settlement-pipeline.md`       | Settlement flow and immutability        |
| `market-policy-engine.md`      | Market filtering and edge thresholds    |
| `data-source-routing.md`       | Provider selection and failover         |
| `discord-channel-routing.md`   | Channel mapping by sport/tier           |

### Phase Documents

Location: `architecture/phases/`

| Phase   | Focus                                          |
| ------- | ---------------------------------------------- |
| Phase 1 | Foundation — lifecycle adapters, single-writer |
| Phase 2 | Intelligence — scoring, calibration, CLV       |
| Phase 3 | Distribution — Discord posting, recaps         |
| Phase 4 | Settlement — grading, outcomes                 |

---

## Cross-Reference Map

### Service → Diagram Coverage

| Service                    | SYSTEM_ARCHITECTURE | PICK_MACHINE_FLOW | AGENT_OWNERSHIP | WORKFLOW_ORCHESTRATION |
| -------------------------- | :-----------------: | :---------------: | :-------------: | :--------------------: |
| API (port 3010)            |          x          |                   |                 |                        |
| Temporal Worker            |          x          |                   |                 |           x            |
| Discord Bot                |          x          |                   |                 |                        |
| Smart Form (port 3021)     |          x          |         x         |                 |                        |
| Command Center (port 3004) |          x          |                   |                 |                        |
| Dashboard (port 3003)      |          x          |                   |                 |                        |

### Agent → Diagram Coverage

| Agent                 | AGENT_OWNERSHIP | PICK_MACHINE_FLOW | WORKFLOW_ORCHESTRATION |
| --------------------- | :-------------: | :---------------: | :--------------------: |
| FeedAgent             |        x        |         x         |                        |
| GradingAgent          |        x        |         x         |           x            |
| DiscordPromotionAgent |        x        |         x         |           x            |
| SettlementAgent       |        x        |         x         |                        |
| RecapAgent            |        x        |         x         |           x            |
| AlertAgent            |        x        |                   |           x            |
| NotificationAgent     |        x        |                   |           x            |
| OperatorAgent         |        x        |                   |                        |
| DataAgent             |        x        |                   |                        |
| AnalyticsAgent        |        x        |                   |                        |
| AuditAgent            |        x        |                   |                        |
| PlayerEnrichmentAgent |                 |                   |                        |
| ScoringAgent          |                 |                   |                        |
| SmartFormAgent        |                 |                   |                        |

### Table → Diagram Coverage

| Table                   | DATABASE_RELATIONSHIPS | AGENT_OWNERSHIP | PICK_MACHINE_FLOW |
| ----------------------- | :--------------------: | :-------------: | :---------------: |
| unified_picks           |           x            |        x        |         x         |
| raw_props               |           x            |        x        |         x         |
| games                   |           x            |        x        |         x         |
| pick_publish            |           x            |        x        |         x         |
| prop_settlements        |           x            |        x        |         x         |
| prop_outcomes           |           x            |        x        |         x         |
| closing_snapshots       |           x            |                 |         x         |
| clv_results             |           x            |                 |         x         |
| bridge_outbox           |           x            |                 |         x         |
| market_policy           |           x            |                 |         x         |
| agent_health            |           x            |        x        |                   |
| player_game_stats       |           x            |        x        |                   |
| tickets                 |           x            |                 |                   |
| ticket_legs             |           x            |                 |                   |
| scored_legs             |           x            |                 |                   |
| events                  |           x            |                 |                   |
| markets                 |           x            |                 |                   |
| provider_offers         |           x            |                 |                   |
| participants            |           x            |                 |                   |
| participant_memberships |           x            |                 |                   |
| parlay_tickets          |           x            |                 |                   |
| users                   |           x            |                 |                   |

---

## Related Documents

- [Architecture Ratification](ARCHITECTURE_RATIFICATION.md)
- [Runtime Component Map](../system/RUNTIME_COMPONENT_MAP.md)
- [Claude OS Governance Contract](../CLAUDE_OS_GOVERNANCE_CONTRACT.md)
