# UNIT TALK PLATFORM CONSTITUTION

## Version 1.0

Status: Draft Effective Date: TBD Authority: Founder

---

## Document Control

This document defines the prescriptive architectural law governing the Unit Talk
Platform.

This Constitution is binding over all platform code, workflows, agents, and
infrastructure.

If platform implementation conflicts with this Constitution, implementation must
be modified.

This document is version-controlled in Git and may not be modified without:

1. Version increment
2. Decision log entry
3. Amendment log update

---

## Scope

This Constitution governs:

- Platform architecture
- Data architecture
- Event lifecycle
- Intelligence engine
- Risk engine
- Agent governance
- Observability requirements
- Production readiness standards
- Kill conditions

It does not govern organizational compensation or operational structure.  
Those are defined in the Operating Constitution.

---

---

# SECTION I — FOUNDATIONAL LAW

## ARTICLE 1 — PLATFORM IDENTITY

### 1.1 Mission Definition

Unit Talk is a Betting Intelligence Platform.

It is not:

- A pick-selling Discord group
- A hype-based distribution channel
- A personality-driven content brand
- An AI marketing gimmick

It is a deterministic, data-driven decision engine designed to generate
measurable edge, manage risk, and compress research time.

All systems must materially support this objective.

---

### 1.2 Core Optimization Targets

The platform optimizes for:

1. Sustained positive Closing Line Value (CLV)
2. Statistically measurable edge over baseline
3. Deterministic lifecycle execution
4. Risk-adjusted capital preservation
5. Time compression for end users
6. Transparent and reproducible performance reporting

Features that do not improve one or more of these objectives are considered
non-core.

---

## ARTICLE 2 — SYSTEM AUTHORITY

### 2.1 Constitution Supremacy

This Constitution governs all platform implementation.

If code, workflow, or operational behavior conflicts with this document,
implementation must be modified.

The Constitution does not conform to implementation.

---

### 2.2 Single Source of Truth

All authoritative state must originate from:

- Versioned database records
- Immutable snapshots
- Explicit event-driven transitions

Derived state without persisted origin is prohibited.

---

### 2.3 Single Writer Principle

For each canonical lifecycle table:

- Exactly one service may write authoritative records.
- All other services must emit events only.
- Side effects must occur exclusively through outbox processing.

Violations are architectural defects.

---

### 2.4 Outbox Enforcement Rule

No external side effect may occur unless:

1. A persisted database record exists referencing the action.
2. The action has a unique immutable identifier.
3. The external response (e.g., Discord snowflake ID) is persisted.

No message may be sent without database traceability.

---

### 2.5 Deterministic Lifecycle Requirement

Each pick must follow an explicit state machine:

Draft → Submitted → Approved → Promoted → Posted → Settled → Archived

State transitions must:

- Be logged
- Be idempotent
- Be replayable
- Produce identical outcomes on replay

## Implicit state is prohibited.

# SECTION III — EVENT & LIFECYCLE GOVERNANCE LAW

## ARTICLE 3 — CANONICAL STATE MACHINE

### 3.1 Explicit Lifecycle States

Every pick must exist in one and only one of the following states:

- Draft
- Submitted
- Approved
- Promoted
- Posted
- Settled
- Archived

No implicit or undocumented states are permitted.

---

### 3.2 State Transition Requirements

State transitions must:

1. Be triggered by explicit event
2. Be logged with timestamp
3. Include actor (service or agent)
4. Be idempotent
5. Be replay-safe

No state transition may occur silently.

---

### 3.3 Transition Authority

Each transition must have a single authoritative service.

Example (illustrative, not binding to implementation names):

- Submission Service → Draft → Submitted
- Promotion Service → Approved → Promoted
- Discord Worker → Promoted → Posted
- Settlement Engine → Posted → Settled

Multiple writers per transition are prohibited.

---

## ARTICLE 4 — EVENT EMISSION LAW

### 4.1 Event as First-Class Artifact

All lifecycle transitions must emit an event record.

Events must include:

- Event ID
- Parent entity ID
- Previous state
- New state
- Timestamp
- Actor
- Version reference (if applicable)

Events must be persisted before side effects execute.

---

### 4.2 No Direct Side Effects

No service may:

- Send Discord messages
- Modify rollups
- Trigger recaps
- Trigger hedging alerts

Without first inserting an outbox record.

Direct side effects are prohibited.

---

## ARTICLE 5 — OUTBOX CONTRACT

### 5.1 Outbox as Exclusive Side-Effect Channel

All external effects must flow through a canonical outbox table.

This includes:

- Discord messages
- Recaps
- Notifications
- External alerts
- Email or SMS
- Webhook callbacks

No bypass path allowed.

---

### 5.2 Outbox Record Requirements

Each outbox entry must contain:

- Unique ID
- Event reference
- Target system
- Payload hash
- Created timestamp
- Processing status
- Retry count
- Failure reason (if applicable)

---

### 5.3 Snowflake Persistence Rule

For Discord posting:

- The returned snowflake ID must be persisted.
- The outbox row must transition from pending → sent.
- Failure to persist snowflake invalidates posting.

No message may exist in Discord without DB reference.

---

## ARTICLE 6 — SETTLEMENT FAN-OUT LAW

### 6.1 Settlement as Event Trigger

Settlement must emit an event.

Settlement must not directly:

- Update rollups
- Generate recaps
- Trigger marketing
- Modify capper statistics

Instead, settlement must:

1. Emit settlement event.
2. Insert fan-out tasks into outbox.
3. Allow deterministic workers to process downstream effects.

---

### 6.2 Deterministic Rollups

Rollups must be:

- Derived from settled records only
- Rebuildable from raw events
- Immutable once calculated per event

Manual rollup adjustment is prohibited.

---

### 6.3 Recap Artifact Law

Recaps must:

- Be generated from deterministic query or snapshot
- Be persisted as DB artifact
- Include reference to source picks
- Be versioned
- Be reproducible on replay

Recaps may not exist as ephemeral output only.

---

## ARTICLE 7 — IDEMPOTENCY & REPLAY

### 7.1 Idempotency Requirement

All workers must:

- Detect duplicate processing
- Prevent duplicate side effects
- Enforce unique constraints

Double posting is architectural failure.

---

### 7.2 Replay Guarantee

The system must support:

- Full lifecycle replay
- Outbox reprocessing
- Settlement replay
- Rollup rebuild

Replay must produce identical final state.

If replay changes output, system is non-compliant.

---

## ARTICLE 8 — FAILURE HANDLING

### 8.1 No Silent Failure

Failures must:

- Be logged
- Increment retry count
- Trigger observability alert
- Remain visible until resolved

Silent discard of event is prohibited.

---

### 8.2 Dead Letter Handling

Events that exceed retry threshold must:

- Move to dead-letter state
- Remain queryable
- Require explicit human resolution

## No event may disappear.

# SECTION IV — INTELLIGENCE ENGINE GOVERNANCE LAW

## ARTICLE 9 — EDGE DEFINITION

### 9.1 Formal Edge Definition

Edge is defined as:

Modeled Probability − Implied Market Probability.

Where:

- Modeled Probability is generated by the platform’s scoring engine.
- Implied Market Probability is derived from normalized market pricing at time
  of submission.

Edge must be:

- Quantifiable
- Version-referenced
- Reproducible
- Backtestable

Edge that cannot be reproduced from stored data is invalid.

---

### 9.2 Edge Storage Requirements

For every pick:

- Model version must be stored.
- Edge score must be persisted.
- Input features must be reconstructible.
- Implied probability must be reconstructible.

No transient scoring allowed.

---

## ARTICLE 10 — MODEL VERSIONING

### 10.1 Mandatory Versioning

Every scoring logic change must:

- Increment model version.
- Be documented in Amendment Log.
- Be backtested before activation.
- Include performance summary.

Silent formula updates are prohibited.

---

### 10.2 Version Traceability

Each pick must reference:

- Model version used
- Feature set version
- Scoring parameters version (if applicable)

Historical picks must not be re-scored retroactively without explicit
versioning.

---

## ARTICLE 11 — BACKTESTING LAW

### 11.1 Baseline Comparison Requirement

Every model must be tested against:

- Flat baseline (randomized control)
- Market implied probability baseline
- Historical average baseline (if applicable)

Deployment is prohibited if model fails to outperform baseline over
statistically meaningful sample size.

---

### 11.2 Overfitting Protection

Backtests must include:

- Out-of-sample validation
- Rolling window validation
- Sensitivity analysis
- Variance stress testing

Overfit models are banned from production.

---

### 11.3 Backtest Artifact Storage

All backtests must generate:

- Summary performance report
- Raw backtest dataset
- Model version reference
- Test period
- Assumptions declared

Backtest artifacts must be stored in version-controlled directory under
governance/artifacts.

---

## ARTICLE 12 — CLV GOVERNANCE

### 12.1 CLV as Primary Health Metric

The platform must track:

- Open line
- Closing line
- Delta
- Aggregate CLV by capper
- Aggregate CLV by sport
- Aggregate CLV by market
- Rolling windows

CLV performance must be visible internally at all times.

---

### 12.2 Sustained Negative CLV

If rolling CLV falls below threshold defined in Metrics Charter:

- System expansion halts.
- Model review required.
- Deployment of new models paused.

Negative CLV is a structural warning, not a marketing inconvenience.

---

## ARTICLE 13 — CAPER WEIGHTING & PERFORMANCE GOVERNANCE

### 13.1 Capper Performance Tracking

For each capper:

- ROI
- CLV
- Sample size
- Variance band
- Rolling performance window

Must be calculated and stored.

---

### 13.2 Capper Promotion Policy

Capper weighting within platform (if used) must:

- Be formula-based
- Be documented
- Be versioned
- Be immune to manual favoritism

Manual adjustment without audit trail is prohibited.

---

## ARTICLE 14 — MODEL DRIFT DETECTION

### 14.1 Drift Monitoring

The system must detect:

- Declining CLV trends
- Edge compression
- Market adaptation patterns
- Performance deviation beyond variance expectations

Drift must trigger review event.

---

### 14.2 Deployment Gate

No new model may be deployed unless:

- Backtest artifacts exist
- Out-of-sample validation passes
- Risk review completed
- Metrics Charter thresholds satisfied

---

# SECTION V — RISK ENGINE GOVERNANCE LAW

## ARTICLE 15 — CAPITAL PRESERVATION PRINCIPLE

### 15.1 Risk Supremacy Rule

Capital preservation takes precedence over short-term profit maximization.

The platform must prioritize:

- Controlled exposure
- Sustainable growth
- Drawdown mitigation
- Variance management

Profit without risk discipline is considered structural failure.

---

## ARTICLE 16 — STAKING GOVERNANCE

### 16.1 Staking Models

The platform may support:

- Flat staking
- Kelly criterion (fractional)
- Custom user-defined models

All staking calculations must be:

- Deterministic
- Reproducible
- Versioned
- Transparent

---

### 16.2 Kelly Implementation Controls

If Kelly staking is used:

- Fractional Kelly must be default.
- Maximum allocation cap must exist.
- Volatility adjustments must be documented.

Full Kelly without cap is prohibited.

---

### 16.3 Unit Integrity

Unit size recommendations must:

- Reference bankroll amount
- Reference risk percentage
- Be traceable to model output
- Be reproducible from stored state

No arbitrary unit sizing allowed.

---

## ARTICLE 17 — EXPOSURE CONTROL

### 17.1 Exposure Tracking

The platform must track:

- Total exposure per event
- Exposure per sport
- Exposure per capper
- Exposure per correlated market

Exposure must be visible internally at all times.

---

### 17.2 Overexposure Prevention

The system must:

- Detect correlated picks
- Detect stacking of same outcome paths
- Flag excessive exposure
- Block recommendations exceeding threshold defined in Metrics Charter

Risk stacking is prohibited.

---

## ARTICLE 18 — CORRELATION GOVERNANCE

### 18.1 Correlated Outcome Detection

The system must detect:

- Same-game correlated props
- Same-event stacking
- Market dependency overlaps

Correlation detection must be systematic, not heuristic guesswork.

---

### 18.2 Correlated Risk Disclosure

If correlated bets are allowed:

- Correlation must be disclosed.
- Combined risk must be calculated.
- Effective variance must be adjusted.

Opaque correlation exposure is prohibited.

---

## ARTICLE 19 — DRAWDOWN CONTROL

### 19.1 Drawdown Monitoring

The system must monitor:

- Rolling bankroll drawdown
- Capper-specific drawdown
- Model-specific drawdown

Drawdown thresholds must be defined in Metrics Charter.

---

### 19.2 Drawdown Intervention

If drawdown exceeds threshold:

- Deployment of new picks may be reduced.
- Stake size may be auto-adjusted.
- Model review triggered.

Uncontrolled drawdown escalation is prohibited.

---

## ARTICLE 20 — HEDGE & MIDDLE GOVERNANCE

### 20.1 Hedge Recommendations

Hedge suggestions must:

- Be mathematically justified.
- Consider transaction cost.
- Consider line movement.
- Reference exposure.

Hedges must not be emotionally triggered.

---

### 20.2 Middle Opportunity Detection

Middle alerts must:

- Identify entry line.
- Identify exit line.
- Calculate probability window.
- Estimate expected value.

## Speculative middling without probability modeling is prohibited.

# SECTION VI — AGENT GOVERNANCE LAW

## ARTICLE 21 — AGENT CLASSIFICATION

Agents are categorized as:

- Intelligence Agents
- Operational Agents
- Risk Agents
- Monitoring Agents
- Distribution Agents

Each agent must have defined scope and authority boundary.

---

## ARTICLE 22 — AGENT AUTHORITY BOUNDARIES

### 22.1 Permitted Actions

Agents may:

- Read structured data
- Emit events
- Insert outbox records
- Generate artifacts
- Log decisions

---

### 22.2 Prohibited Actions

Agents may not:

- Modify settled records
- Override immutable snapshots
- Change scoring formula
- Alter Constitution
- Post without outbox record
- Bypass audit logging

Violation constitutes governance breach.

---

## ARTICLE 23 — AGENT LOGGING REQUIREMENT

Every agent action must log:

- Agent ID
- Version
- Trigger event
- Action performed
- Timestamp
- Outcome

Agent invisibility is prohibited.

---

## ARTICLE 24 — AGENT VERSIONING

Agent logic must:

- Be versioned
- Be documented
- Be replayable
- Be backward compatible when possible

Agent upgrades require version reference.

---

## ARTICLE 25 — HUMAN OVERRIDE PROTOCOL

Human override must:

- Require explicit authority
- Log reason code
- Be timestamped
- Be reviewable

## Silent human override is prohibited.

# SECTION VII — OBSERVABILITY & OPERATIONAL MATURITY LAW

## ARTICLE 26 — NO SILENT FAILURE

All critical subsystems must expose:

- Health endpoint
- Error count
- Retry count
- Processing lag
- Backlog size

Silent failure is prohibited.

---

## ARTICLE 27 — SERVICE LEVEL OBJECTIVES

The platform must define SLOs for:

- Ingestion latency
- Promotion latency
- Discord delivery latency
- Settlement lag
- Outbox processing time

Numeric thresholds are defined in Metrics Charter.

---

## ARTICLE 28 — INCIDENT RESPONSE

Incidents must:

- Be logged
- Be classified
- Have root cause analysis
- Produce corrective action
- Update Decision Log if structural

Recurring incident without structural fix is governance failure.

---

## ARTICLE 29 — REPLAY & RECOVERY

The platform must support:

- Full lifecycle replay
- Rollup rebuild
- Settlement rebuild
- Outbox reprocessing

Recovery must produce deterministic results.

---

## ARTICLE 30 — CHAOS & STRESS TESTING

The system must periodically simulate:

- Worker failure
- API outage
- Partial ingestion
- Discord outage
- Database restore

## Un-tested recovery is unacceptable.

# SECTION VIII — PRODUCTION READINESS & KILL CONDITIONS

## ARTICLE 31 — PRODUCTION READINESS REQUIREMENTS

The platform may not be declared production-ready unless:

1. Full lifecycle replay produces identical state.
2. Backtest artifacts exist for all active models.
3. CLV tracking operational and verified.
4. Outbox deterministic and audited.
5. Observability dashboards live.
6. No mock fallback exists in production path.
7. Governance invariant violations = zero.

---

## ARTICLE 32 — EXPANSION HALT CONDITIONS

Platform expansion must halt if:

- Sustained negative CLV beyond Metrics Charter threshold.
- Data ingestion incomplete or corrupted.
- Governance invariant violated.
- Silent failure detected.
- Risk engine recommends unsafe exposure.
- Model drift beyond acceptable variance.

---

## ARTICLE 33 — CONSTITUTIONAL AMENDMENT PROCESS

Amendments require:

1. Version increment.
2. Decision log entry.
3. Clear diff documentation.
4. Governance review.
5. Commit with conventional format.

No silent edits allowed.

---

## ARTICLE 34 — RATIFICATION

This Constitution becomes active upon:

- Founder approval.
- Git tag of version.
- PDF generation stored under governance/finalized.
- Entry in Ratification Record.

---

# SECTION IX — DATA GOVERNANCE & ACCESS CONTROL LAW

## ARTICLE 35 — DATA OWNERSHIP & CUSTODY

### 35.1 Data Custody Principle

All platform-generated data is:

- Immutable unless versioned
- Attributable
- Auditable
- Recoverable

No authoritative dataset may exist outside version-controlled or persisted
systems.

---

## ARTICLE 36 — PERSONAL DATA HANDLING

### 36.1 User Data Classification

User data must be categorized as:

- Public
- Internal
- Confidential
- Sensitive

Sensitive data includes:

- Payment identifiers
- Subscription records
- Personal contact information
- Bankroll tracking

---

### 36.2 Data Minimization

The platform must collect only data necessary to:

- Provide functionality
- Improve intelligence
- Ensure compliance
- Maintain subscription integrity

Unnecessary data accumulation is prohibited.

---

### 36.3 Encryption Requirement

All sensitive data must be:

- Encrypted at rest
- Encrypted in transit
- Access-restricted by role

Plaintext storage of sensitive data is prohibited.

---

## ARTICLE 37 — ACCESS CONTROL

### 37.1 Role-Based Access Control (RBAC)

The platform must enforce RBAC across:

- Database access
- Production environments
- Admin interfaces
- Agent privileges

Access must be least-privilege by default.

---

### 37.2 Production Safeguards

Production environment must:

- Be isolated from development
- Restrict write access
- Require authentication for administrative actions
- Log privileged activity

Direct production modification without audit logging is prohibited.

---

## ARTICLE 38 — BACKUP & DISASTER RECOVERY

### 38.1 Backup Policy

The system must:

- Maintain automated backups
- Store backups in geographically separate location
- Test restore procedures periodically

---

### 38.2 Recovery Objectives

Recovery must define:

- RPO (Recovery Point Objective)
- RTO (Recovery Time Objective)

## These thresholds must be defined in Metrics Charter.

# SECTION X — FEATURE GATING & ENTITLEMENT LAW

## ARTICLE 39 — TIER STRUCTURE AUTHORITY

Platform tiers may include:

- Free
- VIP
- VIP+
- Black Label

Tier definitions must be documented and versioned.

---

## ARTICLE 40 — ENTITLEMENT ENFORCEMENT

### 40.1 Deterministic Entitlements

Feature access must be:

- Derived from subscription state
- Persisted in database
- Enforced at API level
- Enforced at distribution level (Discord, dashboard, agents)

Client-side gating alone is insufficient.

---

### 40.2 Trial Integrity

Trial access must:

- Have explicit expiration timestamp
- Automatically downgrade upon expiration
- Log entitlement transitions

Manual bypass of trial expiration is prohibited.

---

## ARTICLE 41 — SUBSCRIPTION STATE INTEGRITY

Subscription changes must:

- Emit event
- Update entitlements deterministically
- Be auditable
- Not retroactively alter historical data visibility

## Access revocation must not corrupt stored performance history.

# SECTION XI — MONETIZATION & TRANSPARENCY LAW

## ARTICLE 42 — PERFORMANCE INTEGRITY

The platform must not:

- Delete losing picks
- Retroactively modify historical lines
- Suppress negative recaps
- Hide underperforming periods

Performance history must remain intact.

---

## ARTICLE 43 — PICK FINALITY RULE

Once a pick is:

- Submitted
- Timestamped
- Promoted

It may not be modified without:

- Version record
- Public audit trail
- Explicit correction log

Silent edits are prohibited.

---

## ARTICLE 44 — RECAP COMPLETENESS

Daily, weekly, and monthly recaps must:

- Include all settled picks
- Include win/loss record
- Include ROI calculation
- Include unit totals
- Reference underlying pick IDs

Selective recap generation is prohibited.

---

## ARTICLE 45 — CONFLICT OF INTEREST DISCLOSURE

If platform operators:

- Place personal bets
- Have partnership incentives
- Receive book promotions

These relationships must not influence pick alteration or suppression.

## Transparency overrides short-term marketing incentives.

# SECTION XII — PROVIDER DEPENDENCY & DATA INTEGRITY LAW

## ARTICLE 46 — DATA SOURCE DECLARATION

All external data sources must be:

- Documented
- Version-referenced
- Monitorable
- Replaceable

Undocumented data sources are prohibited.

---

## ARTICLE 47 — INGESTION VALIDATION

All ingestion pipelines must:

- Validate schema
- Detect missing fields
- Detect abnormal values
- Reject corrupted data

Partial ingestion without validation is prohibited.

---

## ARTICLE 48 — PROVIDER OUTAGE HANDLING

If provider outage occurs:

- System must flag degraded mode
- Intelligence confidence must be adjusted
- Public alerts may be delayed if integrity compromised

Silent degraded mode is prohibited.

---

## ARTICLE 49 — DATA RECONCILIATION

If discrepancies exist between providers:

- Reconciliation rule must be defined
- Source of truth must be declared
- Override logic must be deterministic

Arbitrary manual selection is prohibited.

---

## ARTICLE 50 — CONFIDENCE SCORING

Data confidence level must:

- Influence intelligence scoring
- Influence alert generation
- Be internally visible
- Be versioned

## Confidence cannot be assumed.

# SECTION XIII — METRIC AUTHORITY & RELEASE INTEGRITY LAW

## ARTICLE 51 — METRICS CHARTER AUTHORITY

### 51.1 Metrics Charter Governance

The Metrics Charter is a binding governance artifact.

Changes to:

- CLV thresholds
- Drawdown limits
- Risk caps
- Exposure limits
- SLO targets
- Production gates
- Halt conditions

Require:

1. Version increment
2. Decision log entry
3. Amendment log entry
4. Explicit rationale
5. Effective date declaration

Silent metric threshold modification is prohibited.

---

### 51.2 Metrics Ownership

Metric definitions must:

- Be unambiguous
- Include formula definition
- Include data source declaration
- Include aggregation method
- Be reproducible from raw data

Metric ambiguity is prohibited.

---

### 51.3 Metric Freeze Protocol

If performance is deteriorating:

Metric thresholds may not be relaxed without:

- Model review
- Backtest comparison
- Explicit justification logged

Lowering standards to mask underperformance is prohibited.

---

## ARTICLE 52 — RELEASE INTEGRITY LAW

### 52.1 Timestamp Integrity

All picks must store:

- Creation timestamp
- Submission timestamp
- Promotion timestamp
- Posting timestamp

These timestamps must be:

- Immutable
- Server-generated
- Timezone standardized

Client-controlled timestamps are prohibited.

---

### 52.2 Line Capture Integrity

At time of submission:

- Market line
- Market price
- Provider reference
- Snapshot identifier

Must be persisted.

Post-submission line replacement is prohibited.

---

### 52.3 Release Timing Integrity

The platform must not:

- Delay losing picks
- Publish selectively based on outcome probability
- Publish after line moves for cosmetic CLV
- Withhold picks to manipulate recap optics

Release order must reflect submission order.

---

### 52.4 Shadow Editing Prohibition

Editing a pick after publication requires:

- Correction record
- Version increment
- Public audit trace

Silent edit is prohibited.

---

## ARTICLE 53 — COMPLEXITY ESCALATION CONTROL

### 53.1 Feature Introduction Gate

New features affecting:

- Scoring
- Risk
- Lifecycle
- Distribution
- Recaps
- Metrics

Must pass:

- Architecture review
- Governance compatibility review
- Impact assessment
- Rollback plan documentation

Experimental features may not touch production pathways without gating.

---

### 53.2 Experimental Isolation

Experimental logic must:

- Be isolated from production state
- Be clearly versioned
- Be disabled by default
- Require explicit activation

Shadow experimentation in live pipeline is prohibited.

---

### 53.3 Architectural Freeze Protocol

If:

- Incident frequency rises
- Replay fails
- Drift detected
- Metric integrity questioned

Platform enters Architectural Freeze.

During freeze:

- No new features deployed
- Only stabilization permitted
- Root cause analysis required

Freeze lifted only after documented resolution.

---

## ARTICLE 54 — CONSTITUTIONAL INTEGRITY

This Constitution supersedes:

- Marketing preference
- Revenue pressure
- Community sentiment
- Ego-driven override
- Short-term growth incentives

## Structural integrity overrides growth velocity.

# SECTION XIV — HUMAN INTEGRITY & OPERATOR ACCOUNTABILITY LAW

## ARTICLE 55 — CAPPER SUBMISSION INTEGRITY

### 55.1 Immutable Submission Rule

Once a capper submits a pick and it transitions to:

- Submitted
- Approved
- Promoted

The pick becomes immutable.

Capper may not:

- Edit line
- Edit odds
- Edit stake
- Change market
- Delete submission

Without triggering a formal correction workflow.

---

### 55.2 Correction Workflow

Corrections must:

1. Create a new version record.
2. Reference original pick ID.
3. Preserve original snapshot.
4. Log correction reason.
5. Be timestamped.

Silent overwrite is prohibited.

---

### 55.3 Backdating Prohibition

Submission timestamps must be:

- Server-generated
- Immutable
- Monotonic

Capper-controlled timestamps are prohibited.

---

### 55.4 Draft Deletion Transparency

Draft picks may be deleted.

However:

- Deletion must be logged.
- Timestamp preserved.
- Actor preserved.

Draft deletion history must remain queryable internally.

---

## ARTICLE 56 — FOUNDER & OPERATOR ACCOUNTABILITY

### 56.1 Equal Governance Principle

Founder, operator, admin, and capper activity is subject to the same governance
rules as automated systems.

No role is exempt from audit logging.

---

### 56.2 Privileged Action Logging

All privileged actions must log:

- Actor ID
- Action type
- Timestamp
- Target entity
- Reason code

Privileged activity must be reviewable.

---

### 56.3 Direct Database Modification Prohibition

Manual production database modifications are prohibited except through:

- Versioned migration
- Documented emergency procedure
- Logged intervention record

Ad-hoc direct edits are governance violations.

---

### 56.4 Audit Trail Preservation

Audit logs must be:

- Immutable
- Retained per retention policy
- Separated from operational tables

Audit history may not be deleted to improve optics.

---

### 56.5 Conflict Escalation Rule

If governance breach is detected:

- Incident must be logged.
- Decision log updated.
- Corrective control implemented.
- Root cause documented.

Repeated governance breach without corrective control constitutes structural
failure.
