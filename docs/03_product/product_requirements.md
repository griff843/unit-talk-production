# Unit Talk Product Requirements

Version: 1.0  
Status: Canonical  
Authority: Product Layer

This document defines the functional requirements of the Unit Talk platform.

It describes the capabilities the system must provide to deliver the product
vision.

All engineering work must ultimately support these product requirements.

---

# 1. Market Data Ingestion

The platform must ingest sportsbook market data from external providers.

Capabilities include:

- retrieving odds and lines
- ingesting player props
- ingesting game markets
- ingesting sportsbook identifiers
- retrieving updates as markets change

Ingestion must support multiple providers and normalize their data into a
unified format.

---

# 2. Data Normalization

Provider data must be normalized before entering the canonical system.

Normalization requirements include:

- consistent market identifiers
- consistent player identifiers
- consistent team identifiers
- normalized odds formats
- normalized event structures

Normalized data must be stored in canonical provider tables.

---

# 3. Pick Lifecycle Management

The platform must manage the lifecycle of betting picks.

Lifecycle stages include:

- ingestion
- scoring
- promotion evaluation
- promotion
- publication
- settlement

Each stage must be traceable and observable.

---

# 4. Scoring Engine

The platform must evaluate picks using scoring models.

Scoring capabilities include:

- expected value calculations
- model confidence scores
- statistical feature evaluation
- contextual matchup analysis
- market comparison across sportsbooks

Scoring outputs must be recorded for auditability and evaluation.

---

# 5. Promotion System

The platform must determine which picks are distributed to users.

Promotion capabilities include:

- evaluating scoring thresholds
- enforcing eligibility rules
- selecting picks for distribution
- preventing low-quality picks from being promoted

Promotion decisions must be deterministic.

---

# 6. Alert Generation

The system must detect important signals and generate alerts.

Alert types may include:

- high expected value opportunities
- unusual market movement
- model confidence triggers
- system health events

Alerts must be delivered in real time when possible.

---

# 7. Discord Distribution

The platform must distribute picks and alerts through Discord.

Distribution requirements include:

- publishing pick messages
- publishing alerts
- formatting messages using embeds
- posting to appropriate channels
- ensuring delivery reliability

Messages must pass through the outbox delivery system.

---

# 8. Settlement Processing

The platform must determine the outcome of picks once events complete.

Settlement capabilities include:

- detecting completed events
- retrieving final scores
- determining bet outcomes
- recording results

Settlement must be idempotent.

---

# 9. Historical Performance Tracking

The platform must maintain historical records of all picks.

Historical tracking includes:

- pick outcomes
- scoring outputs
- market conditions
- closing lines

Historical data must support long-term analytics.

---

# 10. Operational Interfaces

The platform must provide operational interfaces for system interaction.

These include:

### Smart Form

Capabilities include:

- entering picks
- viewing pick data
- interacting with operational workflows

### Command Center

Capabilities include:

- monitoring system health
- reviewing pipeline state
- inspecting picks and alerts
- performing operational actions

---

# 11. Analytics and Reporting

The platform must support analytics capabilities.

These may include:

- pick performance tracking
- model performance evaluation
- closing line value analysis
- historical market behavior analysis

Analytics capabilities may evolve over time.

---

# 12. System Monitoring

The platform must provide operational monitoring.

Monitoring capabilities include:

- service health checks
- ingestion monitoring
- scoring monitoring
- alert system monitoring
- Discord delivery monitoring

Operational failures must trigger alerts.

---

# 13. Scalability

The platform must support increasing market data volume.

Scalability requirements include:

- horizontal scaling of services
- scalable ingestion pipelines
- distributed background processing

The architecture must support growth without major redesign.

---

# 14. Reliability

The system must remain reliable during normal operation.

Reliability requirements include:

- retry mechanisms
- idempotent processing
- graceful failure handling
- observability

Failures must not corrupt system state.

---

# 15. Security

The platform must protect sensitive credentials and system infrastructure.

Security requirements include:

- secure credential storage
- controlled database access
- secure API integrations
- protection against credential exposure

Security requirements are defined in the security principles document.

---

# Summary

The Unit Talk platform must provide the following core capabilities:

- ingest sportsbook market data
- normalize provider data
- evaluate betting opportunities
- promote high-quality picks
- generate alerts
- distribute insights through Discord
- settle completed picks
- track historical performance
- provide operational interfaces
- support analytics and monitoring
