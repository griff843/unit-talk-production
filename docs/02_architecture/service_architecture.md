# Unit Talk Service Architecture

Version: 1.0  
Status: Canonical  
Authority: Architecture Layer

This document defines the runtime service architecture of the Unit Talk
platform.

It describes the services responsible for executing system workflows and how
they interact.

Each service has clearly defined responsibilities and ownership boundaries.

---

# 1. Service Architecture Philosophy

Unit Talk is built using a **modular service architecture**.

Key principles:

- services must be independent
- services must follow single-responsibility design
- services must communicate through defined contracts
- services must not bypass system boundaries

Services should remain stateless whenever possible.

State must be persisted in the database.

---

# 2. Core Runtime Services

The platform is composed of several primary runtime services.

| Service         | Responsibility                                 |
| --------------- | ---------------------------------------------- |
| API Service     | Provides system APIs and operational endpoints |
| FeedAgent       | Ingests sportsbook and market data             |
| ScoringAgent    | Evaluates picks and calculates model outputs   |
| PromotionEngine | Determines which picks are promoted            |
| AlertAgent      | Generates alerts and market signals            |
| SettlementAgent | Processes game results and settles picks       |
| Discord Worker  | Publishes messages to Discord                  |
| Command Center  | Operational monitoring interface               |
| Smart Form      | Primary operational user interface             |

Each service operates within defined authority boundaries.

---

# 3. API Service

The API service acts as the primary backend interface.

Responsibilities include:

- exposing platform APIs
- serving Smart Form requests
- supporting Command Center operations
- providing system health endpoints
- managing authentication and access control

The API service must not contain heavy background processing logic.

Long-running tasks should be delegated to worker services.

---

# 4. FeedAgent

FeedAgent is responsible for data ingestion.

Responsibilities include:

- pulling sportsbook market data
- normalizing provider formats
- storing provider offers
- inserting picks into the canonical pipeline

FeedAgent is the **only service allowed to write ingestion data**.

---

# 5. ScoringAgent

ScoringAgent evaluates betting opportunities.

Responsibilities include:

- calculating model scores
- evaluating expected value
- assigning confidence levels
- writing scoring outputs

ScoringAgent must only operate on data produced by the ingestion pipeline.

---

# 6. PromotionEngine

PromotionEngine determines which picks become visible to users.

Responsibilities include:

- evaluating promotion rules
- enforcing eligibility conditions
- updating promotion state
- triggering downstream alerts

Promotion decisions must remain deterministic and traceable.

---

# 7. AlertAgent

AlertAgent monitors the system for meaningful signals.

Examples include:

- market movement
- high-edge opportunities
- model confidence thresholds
- system health events

AlertAgent generates notifications and writes alert records.

---

# 8. SettlementAgent

SettlementAgent processes event outcomes.

Responsibilities include:

- detecting game completion
- retrieving result data
- updating pick outcomes
- recording settlement information

Settlement processing must be idempotent.

Running settlement multiple times must not corrupt system state.

---

# 9. Discord Worker

The Discord worker is responsible for publishing content.

Publishing pipeline:

PromotionEngine ↓ Discord Outbox Table ↓ Discord Worker ↓ Discord Channels

Direct publishing from services is forbidden.

All Discord communication must pass through the outbox system.

---

# 10. Command Center

Command Center is the operational dashboard.

Capabilities include:

- monitoring system health
- reviewing picks and promotions
- managing operational workflows
- inspecting data pipeline state

Command Center interacts with the system through the API service.

---

# 11. Smart Form

Smart Form is the operational interface used for:

- pick entry
- data inspection
- operational workflows
- administrative tasks

Smart Form communicates exclusively through the API service.

It must not interact directly with the database.

---

# 12. Background Processing

Background processing handles asynchronous tasks.

Examples include:

- ingestion jobs
- scoring runs
- alert generation
- settlement processing
- Discord delivery

Background workers must be designed for:

- idempotency
- retry safety
- observability

---

# 13. Service Communication

Services communicate through shared system contracts.

Common mechanisms include:

- database state transitions
- job queues
- event triggers
- API endpoints

Direct coupling between services should be avoided.

---

# 14. Scalability Model

Services must support horizontal scaling.

Scalability strategies include:

- stateless service design
- distributed workers
- queue-based processing
- caching layers

Scaling should not require major architectural changes.

---

# 15. Service Observability

All services must provide operational visibility.

Required capabilities include:

- health endpoints
- structured logging
- error reporting
- runtime metrics

Critical failures must trigger alerts.

---

# Summary

The Unit Talk platform operates using a **service-oriented architecture** built
around specialized agents and runtime services.

Key characteristics:

- modular service boundaries
- deterministic processing workflows
- contract-driven service interactions
- scalable background processing
- centralized operational monitoring
