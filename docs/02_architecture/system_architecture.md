# Unit Talk System Architecture

Version: 1.0  
Status: Canonical  
Authority: Architecture Layer

This document defines the high-level architecture of the Unit Talk platform.

It describes the core system components, their responsibilities, and how data
flows through the platform.

Detailed subsystem implementations are documented in other architecture files.

---

# 1. Platform Overview

Unit Talk is a **sports intelligence platform** designed to ingest betting
market data, analyze opportunities, and distribute actionable insights.

The platform consists of several major layers:

Data Ingestion ↓ Data Processing ↓ Intelligence Layer ↓ Promotion & Alerting ↓
Distribution ↓ Settlement & Analytics

Each layer is implemented using independent services and agents.

---

# 2. Core System Components

The platform consists of the following core components.

| Component               | Responsibility                                       |
| ----------------------- | ---------------------------------------------------- |
| FeedAgent               | Ingests betting market data from external providers  |
| ScoringAgent            | Evaluates betting opportunities using scoring models |
| PromotionEngine         | Determines which picks are promoted to users         |
| AlertAgent              | Generates alerts for important market signals        |
| SettlementAgent         | Updates results once events complete                 |
| Discord Delivery System | Publishes picks and alerts to Discord                |
| Command Center          | Operational dashboard and monitoring interface       |
| Smart Form              | User interface for pick entry and system interaction |

These components communicate through the shared database and defined system
contracts.

---

# 3. Data Pipeline Overview

The core system pipeline processes betting data through multiple stages.

Provider APIs ↓ FeedAgent ↓ unified_picks (database) ↓ ScoringAgent ↓
PromotionEngine ↓ AlertAgent ↓ Discord Outbox ↓ Discord Bot Delivery ↓
SettlementAgent ↓ Historical Analytics

Each stage enriches or transforms the data.

The pipeline is designed to be deterministic and observable.

---

# 4. Agent Architecture

Unit Talk uses an **agent-based architecture** to manage system workflows.

Each agent has a clearly defined responsibility.

### FeedAgent

Responsible for:

- ingesting provider data
- normalizing odds and markets
- inserting raw data into the system

### ScoringAgent

Responsible for:

- evaluating betting opportunities
- calculating edge and confidence metrics
- assigning scoring outputs

### PromotionEngine

Responsible for:

- determining pick eligibility
- enforcing promotion rules
- controlling which picks become visible to users

### AlertAgent

Responsible for:

- detecting market signals
- generating notifications
- publishing alerts

### SettlementAgent

Responsible for:

- monitoring game results
- updating pick outcomes
- recording historical performance

Agents must follow the **Single Writer Principle** defined in system invariants.

---

# 5. Data Storage Architecture

The system uses a centralized relational database.

Primary database:

PostgreSQL (Supabase)

Key canonical tables include:

| Table             | Purpose                        |
| ----------------- | ------------------------------ |
| unified_picks     | canonical pick lifecycle table |
| provider_offers   | normalized sportsbook data     |
| feature_snapshots | model input features           |
| scored_legs       | scoring outputs                |
| closing_snapshots | closing line tracking          |

The database is the authoritative system state.

Caching layers may exist but must never become authoritative.

---

# 6. Event and Workflow Orchestration

System workflows are orchestrated using asynchronous processing.

Key orchestration mechanisms include:

- job queues
- agent workflows
- scheduled processing
- event-driven triggers

Processing must remain **idempotent and deterministic**.

---

# 7. Distribution Layer

User-facing content is distributed primarily through Discord.

The distribution pipeline:

PromotionEngine ↓ Discord Outbox Table ↓ Discord Worker ↓ Discord Channels

Direct publishing from application services is forbidden.

All messages must pass through the outbox delivery system.

---

# 8. User Interfaces

The platform provides multiple user interfaces.

### Smart Form

Used for:

- pick entry
- operational workflows
- data exploration

### Command Center

Used for:

- system monitoring
- operational control
- administrative workflows

Additional user-facing interfaces may be introduced as the platform evolves.

---

# 9. Observability and Monitoring

Operational visibility is critical.

Each service must provide:

- health endpoints
- structured logging
- metrics
- failure alerts

Critical workflows must generate verification artifacts.

---

# 10. System Boundaries

The Unit Talk platform interacts with external systems including:

- sportsbook data providers
- Discord APIs
- infrastructure services

All external integrations must follow defined contracts.

External inputs must be validated before entering the system.

---

# 11. Scalability Model

The architecture is designed to scale horizontally.

Scalability strategies include:

- stateless services
- asynchronous processing
- distributed agents
- caching layers

The system must support increasing market data volume without architectural
redesign.

---

# 12. Architectural Evolution

The platform architecture will evolve over time.

However, all architectural changes must respect:

- engineering principles
- system invariants
- security principles

Changes that violate these foundations are considered invalid.

---

# 13. Verification & Simulation Control Plane

The Verification & Simulation Control Plane is a first-class subsystem of the
Unit Talk platform.

It exists to prove pipeline behavior without requiring live provider uptime or
wall-clock advancement.

## 13.1 Why This Layer Exists

The platform must be able to verify that its pipeline produces deterministic,
correct results. This cannot be reliably achieved using only live production
runs, because:

- live providers may be unavailable or degraded
- wall-clock time makes replays non-reproducible
- production side effects (Discord posts, notifications) cannot be triggered
  during verification runs

The Verification & Simulation Control Plane is the safety substrate that
decouples verification from live system dependencies.

## 13.2 Architecture Principle: One Pipeline, Multiple Modes

The same pipeline code runs in all execution modes. Behavior changes are
achieved by injecting different adapters:

| Mode         | Description                                                 |
| ------------ | ----------------------------------------------------------- |
| `production` | Full side effects; live providers and database              |
| `replay`     | Deterministic replay from recorded event journal            |
| `shadow`     | Pipeline runs alongside production; side effects suppressed |
| `fault`      | Controlled fault injection for resilience testing           |
| `simulation` | Fully synthetic event stream; no production data            |

## 13.3 Major Components

| Component                 | Purpose                                                                                                                                                                            | Status      |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `VirtualEventClock`       | Advances clock monotonically from event timestamps                                                                                                                                 | COMPLETE    |
| `RealClockProvider`       | Production wall-clock provider                                                                                                                                                     | COMPLETE    |
| Mode-Safe Adapters        | Route side effects based on execution mode                                                                                                                                         | COMPLETE    |
| `RunController`           | Validates mode + clock + adapter compatibility                                                                                                                                     | COMPLETE    |
| `JournalEventStore`       | JSONL-backed append-only event journal                                                                                                                                             | COMPLETE    |
| `IsolatedPickStore`       | In-memory pick store; never touches Supabase                                                                                                                                       | COMPLETE    |
| `ReplayOrchestrator`      | Dual-run deterministic replay engine                                                                                                                                               | COMPLETE    |
| `DeterminismValidator`    | SHA-256 comparison across replay runs                                                                                                                                              | COMPLETE    |
| `ProductionEventRecorder` | Records production events for later replay                                                                                                                                         | COMPLETE    |
| `ReplayProofWriter`       | Generates proof bundles in `out/replays/`                                                                                                                                          | COMPLETE    |
| Shadow Mode Pipeline      | Parallel execution with divergence detection, severity classification, PASS/PASS_WITH_WARNINGS/FAIL verdict engine, critical divergence alert capture, and proof bundle generation | COMPLETE    |
| Fault Injection Engine    | Controlled failure scenarios for resilience testing                                                                                                                                | IN PROGRESS |
| Execution Simulation      | Synthetic event streams for strategy evaluation                                                                                                                                    | DEFERRED    |

## 13.4 What This Layer Proves

- Pipeline code is deterministic: identical inputs → identical outputs
- Lifecycle transitions complete in correct order
- Agent behavior is reproducible across runs
- Proof bundles contain traceable lifecycle traces

## 13.5 What This Layer Does NOT Prove

- **Live provider truth** — replay does not equal a live provider connection.
  Live provider status is a separate proof lane.
- **Scheduler truth** — replay does not verify that the scheduler fires at
  correct wall-clock intervals.
- **Production side effects** — proof bundles from replay/shadow/fault modes do
  not confirm that Discord posts, notifications, or webhooks were delivered in
  production.

## 13.6 Phased Rollout

| Phase | Name                 | Status      |
| ----- | -------------------- | ----------- |
| R1    | Foundation           | COMPLETE    |
| R2    | Deterministic Replay | COMPLETE    |
| R3    | Shadow Mode          | COMPLETE    |
| R4    | Fault Injection      | IN PROGRESS |
| R5    | Execution Simulation | DEFERRED    |

See `docs/02_architecture/verification_architecture.md` for detailed
specification.

---

# Summary

Unit Talk is built as a **modular, agent-driven intelligence platform**.

Key architectural characteristics:

- deterministic data pipelines
- contract-driven system boundaries
- centralized canonical data model
- agent-based processing architecture
- observable operational workflows
- verification & simulation control plane for proof-backed correctness
