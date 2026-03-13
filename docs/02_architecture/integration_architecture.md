# Unit Talk Integration Architecture

Version: 1.0  
Status: Canonical  
Authority: Architecture Layer

This document defines how the Unit Talk platform integrates with external
systems.

External integrations include:

- sportsbook data providers
- statistics providers
- Discord APIs
- infrastructure services

External systems must always be treated as **untrusted boundaries**.

---

# 1. Integration Philosophy

External systems are outside the control of the Unit Talk platform.

Therefore integrations must be designed with the following protections:

- input validation
- rate limiting
- retry handling
- observability
- failure isolation

External failures must never corrupt internal system state.

---

# 2. Sportsbook Data Providers

Sportsbook data providers supply market information used for betting analysis.

Typical data includes:

- odds
- lines
- player props
- market availability
- sportsbook identifiers

Provider data must be normalized before entering the platform.

The ingestion pipeline is responsible for this normalization.

---

# 3. Provider Ingestion Flow

Provider data flows through the system using the following sequence.

Provider API ↓ FeedAgent ↓ Normalization Layer ↓ provider_offers ↓ unified_picks

FeedAgent is responsible for:

- fetching provider data
- transforming formats
- validating responses
- inserting normalized records

Provider APIs must never write directly to canonical tables.

---

# 4. Rate Limiting and Usage Control

External providers often enforce request limits.

The platform must implement protection mechanisms including:

- request throttling
- scheduled polling
- caching
- usage monitoring

Excessive provider usage must trigger alerts.

---

# 5. Provider Reliability Strategy

Provider APIs may experience outages or degraded performance.

Protection strategies include:

- retry logic
- timeout handling
- failure logging
- fallback scheduling

Provider failures must not cause system crashes.

Instead the ingestion system should gracefully degrade until recovery.

---

# 6. Statistics and Data Providers

In addition to sportsbook providers, the system may integrate with:

- sports statistics providers
- player data services
- injury data feeds
- advanced analytics APIs

These integrations support feature generation for scoring models.

Feature data must be captured in the feature snapshot system.

---

# 7. Discord Integration

Discord is the primary distribution platform for Unit Talk.

The system integrates with Discord using the Discord Bot API.

Capabilities include:

- sending messages
- publishing embeds
- responding to slash commands
- managing roles
- interacting with channels

All Discord interactions must pass through the **Discord Worker system**.

---

# 8. Discord Publishing Flow

The publishing pipeline follows this architecture.

PromotionEngine ↓ Discord Outbox Table ↓ Discord Worker ↓ Discord API ↓ Discord
Channels

The outbox system ensures:

- delivery retries
- message tracking
- failure visibility

Direct publishing from services is forbidden.

---

# 9. Infrastructure Integrations

The platform depends on several infrastructure services.

Typical infrastructure components include:

- PostgreSQL database (Supabase)
- Redis caching
- container runtime (Docker)
- CI/CD pipeline
- monitoring services

These systems provide operational capabilities rather than business logic.

---

# 10. Observability Integrations

Monitoring systems may include:

- logging platforms
- metrics dashboards
- alerting services
- health monitoring tools

Observability systems help detect failures before they impact users.

---

# 11. Integration Security

External integrations must follow security principles.

Requirements include:

- secure credential storage
- encrypted connections
- limited API permissions
- validation of external data

Secrets must never appear in logs or code.

---

# 12. Data Validation

External inputs must be validated before entering the system.

Validation may include:

- schema checks
- value range validation
- format normalization
- null handling

Invalid data must be rejected.

---

# 13. Integration Resilience

The system must remain stable even if external services fail.

Resilience techniques include:

- circuit breakers
- retry policies
- delayed processing
- failure alerts

External instability must not compromise internal system state.

---

# Summary

The Unit Talk platform integrates with multiple external systems to obtain
market data and distribute insights.

Key integration principles include:

- normalization of external data
- protection against provider failures
- rate-limited API usage
- secure credential handling
- controlled Discord publishing
- resilient integration boundaries
