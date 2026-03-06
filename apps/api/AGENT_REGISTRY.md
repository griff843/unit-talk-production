# Agent Registry

> **Sprint**: SPRINT-REPO-TRUTH-LOCK-002 **Last Updated**: 2026-03-06

Maps every active agent to its lifecycle stage and Blueprint domain.

---

## Lifecycle Stages (7-Stage Model)

1. `raw_prop` — External data, pre-validation
2. `normalized_market` — Standardized format, deduped
3. `feature_snapshot` — Features extracted, ready for scoring
4. `scored_prop` — Probability/edge assigned
5. `promoted_pick` — Tier assigned, ready for distribution
6. `distributed_pick` — Posted to Discord
7. `settled_pick` — Game result recorded, settlement computed

---

## Active Agents (15)

| Agent                 | Directory                       | Lifecycle Stage                   | Domain        | Role                                 |
| --------------------- | ------------------------------- | --------------------------------- | ------------- | ------------------------------------ |
| IngestionAgent        | `agents/IngestionAgent/`        | raw_prop                          | Data Pipeline | Fetch, validate, normalize raw props |
| FeedAgent             | `agents/FeedAgent/`             | raw_prop -> normalized_market     | Data Pipeline | Public prop normalization, dedup     |
| PlayerEnrichmentAgent | `agents/PlayerEnrichmentAgent/` | raw_prop (concurrent)             | Data Pipeline | Player metadata enrichment           |
| ScoringAgent          | `agents/ScoringAgent/`          | normalized_market -> scored_prop  | Intelligence  | Real-time edge scoring, probability  |
| GradingAgent          | `agents/GradingAgent/`          | scored_prop -> promoted_pick      | Intelligence  | Multi-model grading, tier assignment |
| DiscordPromotionAgent | `agents/DiscordPromotionAgent/` | promoted_pick -> distributed_pick | Distribution  | Discord posting, receipt tracking    |
| SettlementAgent       | `agents/SettlementAgent/`       | distributed_pick -> settled_pick  | Lifecycle     | Settlement via atomic claims         |
| AlertAgent            | `agents/AlertAgent/`            | distributed_pick (concurrent)     | Distribution  | Line movement, hedge alerts          |
| RecapAgent            | `agents/RecapAgent/`            | settled_pick (post-settlement)    | Distribution  | Daily/weekly performance recaps      |
| NotificationAgent     | `agents/NotificationAgent/`     | distributed_pick (concurrent)     | Distribution  | Multi-channel notifications          |
| AnalyticsAgent        | `agents/AnalyticsAgent/`        | settled_pick (post-settlement)    | Analytics     | ROI tracking, performance metrics    |
| DataAgent             | `agents/DataAgent/`             | Cross-stage                       | Operations    | Data sync, cache management          |
| AuditAgent            | `agents/AuditAgent/`            | All stages (observational)        | Operations    | Audit logging, compliance            |
| OperatorAgent         | `agents/OperatorAgent/`         | All stages (manual override)      | Operations    | Manual corrections, overrides        |
| BridgeWorker          | `agents/BridgeWorker/`          | raw_prop                          | Data Pipeline | Smart Form bridge processing         |

---

## Archived Agents (14)

Located in `agents/_archived/`. Zero production imports confirmed.

AutomatedOnboardingAgent, CampaignAgent, ContestAgent, DataLifecycleAgent,
EligibilityAgent, FeedbackLoopAgent, MarketingAgent,
PerformanceOptimizationAgent, PredictiveAnalyticsAgent, ProjectionAgent,
ReferralAgent, RiskManagementAgent, UserRetentionAgent, V3ScoringAdapter

---

## Pipeline Flow

```
IngestionAgent ─┐
FeedAgent ──────┤── raw_prop ──> ScoringAgent ──> GradingAgent ──> DiscordPromotionAgent ──> SettlementAgent
BridgeWorker ───┘                                                         │
                                                                 AlertAgent (concurrent)
                                                                 NotificationAgent (concurrent)
                                                                 RecapAgent (post-settlement)
                                                                 AnalyticsAgent (post-settlement)
```
