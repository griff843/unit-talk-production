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

# Summary

Unit Talk is built as a **modular, agent-driven intelligence platform**.

Key architectural characteristics:

- deterministic data pipelines
- contract-driven system boundaries
- centralized canonical data model
- agent-based processing architecture
- observable operational workflows
