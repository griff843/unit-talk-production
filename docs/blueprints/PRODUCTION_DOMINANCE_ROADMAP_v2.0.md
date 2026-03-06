# UNIT TALK — PRODUCTION ROADMAP v2.0

Status: Draft  
Derived From: MASTER_SYSTEM_BLUEPRINT_v2.0  
Purpose: Execution roadmap for building the Unit Talk platform

---

# ROADMAP STRUCTURE

The roadmap is organized into five phases.

Each phase corresponds to a major architectural capability defined in the system
blueprint.

```text
Phase 1 — Structural Foundation
Phase 2 — Market Intelligence & Modeling
Phase 3 — Risk & Portfolio Management
Phase 4 — Automation & Autopilot
Phase 5 — Enterprise & SaaS Expansion

Each phase contains:

core system milestones

UI/UX deliverables

operational readiness goals

SPRINT PLANNING MODEL

Development is executed in sprints aligned to roadmap phases.

Sprint counts are estimates and may expand if system complexity requires additional implementation or validation.

The roadmap defines Sprint Bands rather than fixed counts to avoid forcing architecture shortcuts.

Phase 1 — Structural Foundation
Estimated Sprint Range: 6–10

Phase 2 — Market Intelligence & Modeling
Estimated Sprint Range: 8–12

Phase 3 — Risk & Portfolio Management
Estimated Sprint Range: 5–8

Phase 4 — Automation & Autopilot
Estimated Sprint Range: 5–7

Phase 5 — Enterprise & SaaS Expansion
Estimated Sprint Range: 6–10

Sprints must map to:

blueprint architecture components

roadmap phase goals

Linear milestones

Every sprint must produce:

code changes

verification artifacts

telemetry validation

APPLICATION SURFACES

The Unit Talk platform includes multiple user-facing applications.

Each application evolves alongside the backend architecture.

Progress of these applications must be tracked throughout roadmap phases.

Smart Form

Purpose:

Primary interface for prop submission and manual capper entries.

Responsibilities:

prop validation

normalized submission payloads

API submission workflow

guardrails against malformed data

Command Center

Purpose:

Operational control panel for the platform.

Capabilities:

system health monitoring

workflow visibility

autopilot controls

exposure monitoring

telemetry dashboards

incident visibility

Analytics Dashboard

Purpose:

Intelligence visibility for operators and advanced subscribers.

Capabilities:

model output visualization

CLV analytics

edge distribution charts

historical performance dashboards

market analytics

capper performance surfaces

Discord Bot

Purpose:

Interactive application used by subscribers, cappers, and operators.

Capabilities:

pick embeds awareness

alert notifications

recap posts

slash command interface

subscriber tools

capper utilities

server automation

role management

onboarding

trial and upgrade flows

operator/admin tools

Admin Console

Purpose:

Administrative control interface.

Capabilities:

user management

subscription management

configuration management

system controls

tenant management

billing/admin workflows

PLATFORM SERVICES

The Unit Talk platform includes a set of internal services responsible for market intelligence, scoring, risk evaluation, lifecycle automation, and distribution.

These services operate behind the API layer and power the core intelligence pipeline.

Each service must be implemented as a modular component with clear ownership boundaries.

Market Ingestion Service

Purpose:

Ingest sportsbook market data and normalize it into canonical prop records.

Responsibilities:

sportsbook API ingestion

odds normalization

over/under pairing

market taxonomy mapping

ingestion telemetry

Outputs:

raw_props
Devig Service

Purpose:

Remove sportsbook margin and estimate fair probabilities.

Responsibilities:

two-way devig calculations

implied probability normalization

probability validation

Outputs:

devig_probability
Feature Snapshot Service

Purpose:

Generate structured feature vectors used by the scoring engine.

Responsibilities:

odds movement detection

book dispersion measurement

sharp book identification

market resistance calculation

historical feature generation

Outputs:

feature_snapshots
Feature Store Service

Purpose:

Persist and version feature snapshots and support training/evaluation datasets.

Responsibilities:

feature schema versioning

feature snapshot storage

reproducible model input datasets

historical feature retrieval

Outputs:

feature_store
Scoring Engine

Purpose:

Estimate the true probability of outcomes.

Components include:

Market Consensus Model

Sharp Consensus Model

Signal Model

Statistical Projection Layer

Blend Layer

Example blend:

p_final = 0.6 market + 0.3 sharp + 0.1 signals

Outputs:

scored_props
Pick Promotion Engine

Purpose:

Promote scored props into final betting picks.

Responsibilities:

edge threshold evaluation

model confidence validation

market stability checks

execution compatibility checks

Outputs:

unified_picks
Risk Engine

Purpose:

Control bankroll exposure and optimize bet sizing.

Responsibilities:

Kelly sizing

exposure limits

correlation detection

drawdown protection

bankroll management

portfolio optimization

Outputs:

stake_size
risk_profile
portfolio_allocation
Execution Intelligence Service

Purpose:

Measure and improve execution quality.

Responsibilities:

CLV forecasting

execution timing analysis

market movement prediction

slippage awareness

execution quality evaluation

Outputs:

execution_metrics
clv_forecast
Distribution Service

Purpose:

Coordinate governed delivery of picks and related outputs.

Responsibilities:

Discord publishing pipeline

embed generation

delivery routing

retries and idempotency

delivery receipts

recap delivery support

Outputs:

distribution_jobs
delivery_receipts
CLV Tracking Service

Purpose:

Measure execution quality using closing line value.

Responsibilities:

capture closing odds snapshots

compute CLV for each pick

maintain historical CLV records

Outputs:

clv_metrics
Backtesting Service

Purpose:

Evaluate model strategies against historical market data.

Responsibilities:

historical prop replay

strategy simulation

model comparison

Outputs:

backtest_results
Settlement Service

Purpose:

Resolve picks after events conclude.

Responsibilities:

result ingestion

pick settlement

ROI computation

performance tracking

Outputs:

pick_results
Automation Service

Purpose:

Coordinate autonomous workflows.

Includes:

AlertAgent

RecapAgent

AnalyticsAgent

NotificationAgent

Responsibilities:

automated alerts

recap generation

analytics computation

subscriber notifications

Observability Service

Purpose:

Provide system-wide monitoring, metrics, and audit visibility.

Responsibilities:

OpenTelemetry tracing

system metrics

pipeline health monitoring

automation health monitoring

command success/failure metrics

query latency tracking

reliability dashboards

Outputs:

observability_metrics
audit_events
SYSTEM LIFECYCLE

The platform lifecycle is:

Market Data
→ Prop Ingestion
→ Market Normalization
→ Feature Snapshot
→ Model Scoring
→ Pick Promotion
→ Risk Allocation
→ Distribution
→ Settlement
→ Performance Analysis
→ Learning Feedback

Every milestone and sprint should map back to one or more lifecycle stages.

DISCORD BOT WORKSTREAMS

The Discord Bot is a first-class product surface and must be tracked as an active roadmap domain.

Major workstreams include:

onboarding

slash commands

alerts

analytics commands

capper tools

operator/admin tools

monetization and upgrade flows

engagement systems

The bot must never be represented as only a passive delivery utility.

PHASE 1 — STRUCTURAL FOUNDATION

Purpose: Establish deterministic platform infrastructure and the canonical pick pipeline.

This phase ensures the system can reliably ingest, process, and publish picks.

Core System Work
Pipeline

raw prop ingestion

market normalization

devig service

feature snapshot generation

scoring engine shell

pick promotion engine shell

distribution service shell

Database

canonical tables

lifecycle state enforcement

single-writer enforcement

outbox pattern

feature storage foundations

Workflow Orchestration

Temporal workflow integration

pipeline job orchestration

retry and failure policies

Telemetry

OpenTelemetry tracing

system metrics

ingestion monitoring

workflow monitoring

observability service foundations

Infrastructure

Docker runtime truth

environment contract enforcement

CI build determinism

Discord Bot Foundations

audit bot architecture

classify real vs mock features

establish bot reliability baseline

wire roadmap ownership for onboarding, commands, alerts, and analytics

UI/UX Work
Command Center

system health dashboard

pipeline status display

ingestion monitoring panel

incident visibility starter surfaces

Smart Form

validated prop submission

API submission flow

error guardrails

Discord Bot

audit current subscriber-facing UX

identify fake vs real command experiences

baseline bot help/discovery experience

Exit Criteria

The platform must demonstrate:

deterministic prop ingestion

scoring pipeline operational

pick promotion working

distribution pipeline connected

platform telemetry visible

Discord bot represented as an application with owned workstreams

PHASE 2 — MARKET INTELLIGENCE & MODELING

Purpose: Build the intelligence engine that identifies edge.

This phase introduces the modeling layer.

Core System Work
Market Intelligence

sportsbook ingestion adapters

devig probability estimation

book dispersion measurement

sharp book identification

odds movement tracking

market resistance detection

Feature Systems

structured feature snapshots

feature versioning

model training dataset generation

feature store service

Modeling Engine

market consensus model

sharp consensus model

signal model

statistical projection layer

blended probability engine

Execution Intelligence

CLV forecasting

execution timing diagnostics

movement-based execution analysis

Evaluation Systems

CLV tracking

model accuracy tracking

signal performance analysis

Backtesting

historical prop replay

strategy simulation

model comparison

Discord Bot Product Work

eliminate mock subscriber-facing data

connect analytics commands to real services

connect recap and stats to real platform data

UI/UX Work
Analytics Dashboard

model output visualizations

edge distribution charts

CLV tracking dashboards

signal performance panels

Command Center

model health monitoring

scoring diagnostics

execution quality visibility

Discord Bot

real analytics responses

real recap responses

improved command clarity

help and discovery improvements

Exit Criteria

The system must demonstrate:

measurable edge detection

model scoring pipeline operational

CLV tracking operational

analytics dashboards available

major mock subscriber-facing bot commands replaced with real data

PHASE 3 — RISK & PORTFOLIO MANAGEMENT

Purpose: Manage bankroll exposure and optimize betting portfolios.

This phase transforms the system from pick generator to portfolio optimizer.

Core System Work
Risk Engine

Kelly sizing engine

bankroll management

exposure limits

drawdown protection

Portfolio Optimization

correlated prop detection

portfolio allocation engine

exposure balancing

Settlement Systems

automated pick settlement

ROI tracking

historical performance storage

Discord Bot Product Work

operator/admin diagnostics surface planning

bankroll / risk-aware subscriber and operator tools

capper analytics access improvements

UI/UX Work
Risk Dashboard

exposure heatmap

bankroll monitoring

portfolio risk indicators

Analytics Dashboard

capper performance metrics

market profitability analysis

portfolio risk displays

Command Center

risk state visibility

freeze / downgrade awareness

Discord Bot

improved analytics surfaces

possible bankroll / portfolio user tools where appropriate

Exit Criteria

The system must demonstrate:

controlled bankroll exposure

risk-adjusted pick sizing

automated settlement

portfolio analytics

PHASE 4 — AUTOMATION & AUTOPILOT

Purpose: Automate system workflows and operational intelligence.

This phase introduces autonomous system behavior.

Core System Work
Automation Agents
AlertAgent

line movement alerts

steam detection alerts

injury alerts

RecapAgent

daily recap generation

weekly reports

monthly performance summaries

AnalyticsAgent

automated analytics computation

performance reporting

NotificationAgent

subscriber alerts

capper notifications

Autopilot

automated pick publishing

operational automation workflows

safety downgrade mechanisms

incident-aware controls

Discord Bot Product Work

real alert preferences and delivery

onboarding completion and production lock

operator/admin bot tooling

recap UX improvements

UI/UX Work
Command Center

automation control panel

autopilot state display

incident management interface

Discord Bot

enhanced pick embeds

automated recap posts

alert preference UX

onboarding polish and completion

operator/admin utility commands

Exit Criteria

The platform must demonstrate:

automated alerting

automated recap generation

autopilot publishing

automation monitoring

onboarding system production-locked

Discord Bot alert and recap capabilities connected to real services

PHASE 5 — ENTERPRISE & SAAS EXPANSION

Purpose: Scale Unit Talk into a multi-tenant SaaS platform.

Core System Work
SaaS Infrastructure

tenant isolation

subscription management

role-based access control

Platform APIs

external API access

partner integrations

webhook support

Billing

subscription plans

usage tracking

billing integration

Discord Bot Product Work

premium entitlements

upgrade / monetization flow maturity

multi-server or white-label readiness

operator/admin scaling workflows

UI/UX Work
Admin Console

tenant management

billing dashboards

subscriber management

Subscriber Experience

improved dashboards

personalization features

analytics access controls

Discord Bot

premium feature enforcement

monetization hooks

scalable role/entitlement systems

Exit Criteria

The platform must demonstrate:

multi-tenant operation

subscription management

enterprise-grade stability

scalable infrastructure

bot and subscriber surfaces aligned with entitlements

BOT MILESTONE MODEL

The Discord Bot should be tracked with explicit milestone groups.

Recommended milestone sequence:

BOT-00 — Onboarding Completion & Production Lock

BOT-01 — Mock Data Elimination

BOT-02 — Architecture Hardening

BOT-03 — Analytics Pipeline

BOT-04 — Alert Engine

BOT-05 — AI Integration

BOT-06 — Publishing Awareness / Delivery Integration

BOT-07 — Operator Tooling

BOT-08 — Engagement & Gamification

BOT-09 — Monetization Maturity

BOT-10 — Test Coverage & CI

These should map into the phase structure, not float independently.

ROADMAP GOVERNANCE

All development must align with this roadmap.

New work must:

map to a roadmap phase

correspond to blueprint architecture

be represented in Linear issues

identify the application surface and platform service it affects

ROADMAP VERSIONING

Roadmap updates must include:

architecture impact assessment

milestone adjustment

Linear workspace update

END OF DOCUMENT
```
