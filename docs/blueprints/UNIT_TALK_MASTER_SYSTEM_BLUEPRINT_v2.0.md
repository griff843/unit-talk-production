# UNIT TALK — MASTER SYSTEM BLUEPRINT v2.0

Status: Draft  
Owner: Platform Architecture  
Purpose: Canonical system architecture for Unit Talk  
Scope: Full platform — applications, pipeline, intelligence engine, risk engine,
automation, distribution, telemetry, SaaS layer

---

# 1. SYSTEM PURPOSE

Unit Talk is a sports betting intelligence platform designed to identify,
evaluate, and distribute positive expected value betting opportunities.

The platform integrates:

- market ingestion
- probabilistic modeling
- edge evaluation
- execution intelligence
- risk and portfolio management
- automation workflows
- distribution systems
- telemetry and operational controls
- subscriber-facing product surfaces

The goal is to operate at syndicate-grade intelligence and operational
reliability while delivering a scalable SaaS experience.

---

# 2. CORE DESIGN PRINCIPLES

The system is built around the following principles.

## 2.1 Single Writer Architecture

Only designated services may write to canonical tables.

This prevents:

- race conditions
- data drift
- partial lifecycle states

## 2.2 Event Driven Lifecycle

All system activity flows through deterministic events.

Examples:

- prop_ingested
- market_normalized
- feature_snapshot_created
- prop_scored
- pick_promoted
- pick_distributed
- pick_settled

## 2.3 Fail Closed Enforcement

The system never silently falls back.

Failures produce:

- alerts
- telemetry signals
- operator visibility
- degraded system states when required

## 2.4 Deterministic State Transitions

Each pick moves through a defined lifecycle:

```text
raw_prop
→ normalized_market
→ feature_snapshot
→ scored_prop
→ promoted_pick
→ distributed_pick
→ settled_pick

No stage may be skipped.

2.5 Reproducible Intelligence

All model outputs must be reproducible through versioned inputs, feature snapshots, and scoring logic.

2.6 Product Surfaces Are First-Class

User-facing applications are part of the platform architecture, not a cosmetic layer on top of backend systems.

3. PLATFORM APPLICATIONS

Unit Talk consists of multiple applications operating on the same core platform.

3.1 Smart Form

Purpose:
Primary interface for manual prop entry and capper submissions.

Responsibilities:

input validation

submission normalization

API submission workflow

ticket construction UX

guardrails against malformed data

Constraints:

Smart Form does not write canonical pick tables

all writes occur through the API service or approved outbox workflow

3.2 Command Center

Purpose:
Operational control panel for system health, lifecycle visibility, and operator control.

Capabilities:

pipeline status monitoring

workflow inspection

autopilot controls

exposure monitoring

telemetry dashboards

incident visibility

health and status surfaces

3.3 Analytics Dashboard

Purpose:
Intelligence visibility for operators and advanced subscribers.

Displays:

model outputs

CLV performance

ROI by market

signal performance

edge distribution

historical analytics

capper analytics

market profitability analysis

3.4 Discord Bot Application

Purpose:
Primary subscriber interaction platform and one of the most important product surfaces in Unit Talk.

Capabilities:

pick publishing awareness

alert distribution

slash commands

onboarding flows

role-based welcome journeys

trial and upgrade messaging

subscriber tools

capper tools

operator/admin tools

interactive analytics commands

recap delivery

The Discord bot consumes platform events and data, but does not own canonical writes.

Constraints:

the bot does not write to canonical betting tables

pick publishing authority remains governed through the canonical pipeline

all user-facing bot features must be honest about data freshness and implementation state

3.5 Admin Console

Purpose:
Administrative control interface for internal platform management.

Capabilities:

user management

subscription management

configuration management

system controls

tenant management

billing/admin surfaces

3.6 API Service

Purpose:
Central orchestration layer for the entire platform.

Responsibilities:

canonical writers

pipeline orchestration

event emission

automation triggers

settlement processes

distribution triggers

operator/admin actions

controlled integrations between services

The API is the orchestration shell, not the home for all domain logic.

4. SYSTEM LIFECYCLE

Unit Talk operates as a deterministic lifecycle system.

Market Data
→ Prop Ingestion
→ Market Normalization
→ Feature Snapshot Creation
→ Model Scoring
→ Pick Promotion
→ Risk Allocation
→ Distribution
→ Settlement
→ Performance Analysis
→ Learning Feedback

Each stage must have:

ownership

versioning

telemetry

validation

failure handling

5. CANONICAL PICK PIPELINE

The canonical pick pipeline converts raw market data into evaluated betting opportunities.

5.1 Ingestion

Sources:

sportsbook APIs

manual Smart Form submissions

future third-party provider feeds

Output:

raw_props

Fields include:

player

market

line

odds

sportsbook

timestamp

source metadata

5.2 Market Normalization

Processes:

over/under pairing

market taxonomy mapping

devigging preparation

sportsbook normalization

Outputs:

normalized_markets
5.3 Feature Snapshot Creation

For each market the system computes a feature vector including:

devig probability

book dispersion

sharp book direction

market resistance

odds movement

historical context

timestamped market state

Outputs:

feature_snapshots
5.4 Model Scoring

Models produce probability estimates.

Example components:

p_market
p_sharp
p_signal

Final probability:

p_final

Edge calculation:

edge = p_final − implied_probability

Outputs:

scored_props
5.5 Pick Promotion

The promotion engine evaluates:

edge thresholds

model confidence

market conditions

risk exposure

execution conditions

Qualified props become picks.

Outputs:

unified_picks
5.6 Distribution

Promoted picks move into governed distribution systems.

Outputs include:

Discord distribution payloads

dashboard/API surfaces

recap input streams

subscriber-facing notifications

5.7 Settlement

Settled picks update result stores and learning systems.

Outputs:

pick_results
6. MARKET INTELLIGENCE LAYER

This layer extracts signals from sportsbook markets.

Capabilities include:

devig probability estimation

book disagreement measurement

sharp book direction detection

odds movement tracking

steam detection

market resistance detection

closing line tracking

Outputs feed directly into the scoring system.

7. INTELLIGENCE ENGINE

The intelligence engine evaluates the true probability of an outcome.

7.1 Market Consensus Model

Baseline probability from market odds.

7.2 Sharp Consensus Model

Weighted probability using sharp books.

7.3 Signal Model

Probability adjustments using market signals.

7.4 Statistical Projection Layer

Uses historical and contextual features to estimate player- or market-level outcomes beyond pure market consensus.

7.5 Model Blending

Example blend:

p_final = 0.6 market + 0.3 sharp + 0.1 signals

The exact blend is versioned and must be adjustable through governed evaluation, not hardcoded forever.

7.6 Evaluation Outputs

The intelligence engine produces:

p_final

edge

confidence

execution hints

feature attribution

reason codes

8. EXECUTION INTELLIGENCE

Execution quality determines whether model edge becomes real profit.

Responsibilities:

CLV forecasting

market movement prediction

execution timing analysis

slippage awareness

closing line comparison

Outputs include:

execution timing signals

CLV metrics

execution quality diagnostics

9. RISK & PORTFOLIO ENGINE

The risk system manages bankroll and exposure.

Responsibilities include:

Kelly sizing

exposure limits

correlation management

drawdown protection

bankroll management

portfolio optimization

Outputs:

stake_size
portfolio_allocation
risk_profile

The risk engine must sit between scoring and distribution.

10. AUTOMATION LAYER

Automation agents perform operational workflows.

10.1 AlertAgent

Triggers alerts for:

line movement

steam signals

injury impacts

pricing events

10.2 RecapAgent

Generates:

daily recaps

weekly reports

monthly summaries

10.3 AnalyticsAgent

Computes performance and reporting metrics.

10.4 NotificationAgent

Handles subscriber and operator notifications.

10.5 Future Agents

The platform may support additional domain agents as capabilities grow, but all must conform to platform contracts and telemetry requirements.

11. DISTRIBUTION SYSTEM

Picks are delivered through multiple channels.

Primary channels:

Discord

dashboards

API endpoints

partner integrations

Delivery includes:

rich embeds

player headshots

matchup context

betting details

recap outputs

subscriber messaging

Distribution is a governed service, distinct from the Discord Bot application.

12. DISCORD SYSTEM SPLIT

Discord must be represented as two distinct architectural components.

12.1 Discord Publishing Pipeline

Platform-side publishing system responsible for:

channel routing

embed payload creation

delivery queueing

retries

idempotency

receipts and delivery confirmation

12.2 Discord Bot Application

User-facing Discord application responsible for:

slash commands

onboarding

subscriber utilities

capper tools

upgrade flows

engagement systems

operator tools

These two components are related but not identical.

13. ONBOARDING SYSTEM

The onboarding system is a dedicated product capability.

Responsibilities:

role-based welcome journeys

subscriber education

trial conversion

feature discovery

command discovery

entitlement-aware onboarding

follow-up DM sequences

Current architectural rule:

onboarding is considered a major product subsystem

onboarding must be fully tested and production-locked before being treated as complete

14. SETTLEMENT & LEARNING

After events conclude, picks are settled.

Settlement updates:

pick_results

Metrics tracked:

ROI

hit rate

CLV

model accuracy

execution quality

portfolio performance

These metrics feed back into model evaluation, product analytics, and automation systems.

15. TELEMETRY & CONTROL PLANE

The control plane monitors the entire system.

Telemetry includes:

ingestion rates

scoring latency

automation health

error rates

distribution success

command success/failure

delivery metrics

query latency

workflow health

Command Center exposes this telemetry to operators.

Control plane responsibilities include:

autopilot state visibility

incident handling

operator overrides

diagnostics

auditability

health surfaces

16. INFRASTRUCTURE

Core infrastructure components include:

Supabase / PostgreSQL

Temporal workflow orchestration

Redis for event streams and caching

Docker runtime environment

CI/CD enforcement

telemetry and metrics systems

All services run inside controlled runtime environments.

17. REPOSITORY ARCHITECTURE

The repository structure is part of the platform architecture.

17.1 Top Level Structure
apps/
packages/
docs/
architecture/
governance/
infrastructure/
supabase/
scripts/
tools/
out/
17.2 Application Boundaries
apps/api
apps/smart-form
apps/command-center
apps/dashboard
apps/discord-bot

Each application owns a distinct system surface.

17.3 Shared Packages
packages/contracts
packages/shared
packages/ui
packages/event-kit
packages/intelligence
packages/risk-engine
packages/automation
packages/distribution
packages/observability
packages/data-access

These packages provide shared functionality across apps.

17.4 Intelligence System Placement

Modeling and intelligence components live under controlled packages.

Responsibilities include:

devigging

feature generation

scoring models

CLV evaluation

historical backtesting

execution intelligence

17.5 Automation Placement

Automation workflows live under agent and workflow modules.

Examples include:

alert workflows

recap generation

analytics reporting

operational automation

17.6 Distribution Placement

Distribution-specific logic should be isolated from the Discord Bot app where reusable.

17.7 Documentation & Governance Placement

Blueprints, contracts, architecture rules, and governance laws must remain in their canonical paths and not drift into application folders.

18. SAAS PLATFORM LAYER

Unit Talk operates as a SaaS platform.

User roles include:

Free users

Trial users

VIP subscribers

VIP+ subscribers

Black Label users

Cappers

Operators

Administrators

Access control governs:

feature access

analytics visibility

pick distribution

command access

automation visibility

The architecture must support multi-tenant operation, entitlements, and future white-label capabilities.

19. FUTURE EXPANSION

The architecture supports future expansion including:

additional sportsbooks

new betting markets

richer machine learning models

enterprise partnerships

API integrations

advanced bot capabilities

white-label deployments

The platform is designed to scale horizontally while preserving deterministic lifecycle behavior.

20. NON-NEGOTIABLE ARCHITECTURAL RULES

Canonical betting data must remain single-writer governed.

Product applications must not become uncontrolled owners of domain logic.

Distribution authority and subscriber interaction surfaces must remain distinct.

Mock or simulated subscriber-facing data must never be treated as production-complete functionality.

Telemetry, observability, and auditability are part of the architecture, not optional extras.

Blueprint changes must precede roadmap and Linear changes for architecture-affecting work.

END OF DOCUMENT
```
