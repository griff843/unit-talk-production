# Unit Talk User Workflows

Version: 1.0  
Status: Canonical  
Authority: Product Layer

This document defines the primary workflows executed by users and the system
within the Unit Talk platform.

Workflows describe how system capabilities interact to deliver product value.

These workflows combine the system architecture, data pipeline, and product
features.

---

# 1. Market Monitoring Workflow

The platform continuously monitors sportsbook markets for opportunities.

Workflow:

Provider APIs ↓ FeedAgent ingestion ↓ provider_offers table updated ↓ potential
picks identified ↓ unified_picks created

Outcome:

- markets are continuously tracked
- betting opportunities enter the platform pipeline

---

# 2. Pick Evaluation Workflow

Once potential picks exist, they are evaluated by the scoring engine.

Workflow:

unified_picks ↓ ScoringAgent retrieves feature data ↓ feature_snapshots
generated ↓ scoring model evaluates opportunity ↓ scored_legs created

Outcome:

- picks receive edge scores
- confidence metrics are assigned
- model inputs are recorded

---

# 3. Promotion Workflow

The system determines whether a pick should be promoted.

Workflow:

scored_legs ↓ PromotionEngine evaluates promotion criteria ↓ promotion status
updated ↓ eligible picks selected

Outcome:

- high-quality picks are promoted
- low-quality picks remain internal

---

# 4. Alert Workflow

Important signals trigger alerts.

Workflow:

promotion or scoring signals detected ↓ AlertAgent evaluates alert rules ↓ alert
record generated ↓ alert queued for distribution

Outcome:

- users receive notifications about important opportunities

---

# 5. Discord Distribution Workflow

Promoted picks and alerts are delivered to users via Discord.

Workflow:

PromotionEngine ↓ Discord Outbox record created ↓ Discord Worker processes
outbox ↓ Discord message sent ↓ delivery recorded

Outcome:

- users receive picks and alerts in Discord channels
- delivery is tracked and observable

---

# 6. Settlement Workflow

After an event finishes, the system determines the outcome of the pick.

Workflow:

event completion detected ↓ SettlementAgent retrieves final results ↓ pick
outcome determined ↓ unified_picks updated with settlement result

Outcome:

- picks are marked as win, loss, or push
- historical performance data is updated

---

# 7. Historical Performance Workflow

The system tracks long-term performance metrics.

Workflow:

settled picks ↓ historical records updated ↓ analytics queries executed ↓
performance reports generated

Outcome:

- long-term system performance can be analyzed
- model effectiveness can be evaluated

---

# 8. Capper Pick Entry Workflow

Professional cappers may submit picks through operational interfaces.

Workflow:

capper submits pick via Smart Form ↓ API service validates input ↓ pick inserted
into unified_picks ↓ scoring pipeline executed ↓ promotion workflow triggered

Outcome:

- submitted picks enter the same pipeline as system-generated picks

---

# 9. Operator Monitoring Workflow

Operators monitor system health through the Command Center.

Workflow:

Command Center dashboard ↓ system health metrics retrieved ↓ pipeline status
displayed ↓ operators review alerts or issues

Outcome:

- operators maintain platform reliability
- system issues are detected early

---

# 10. Alert Investigation Workflow

Operators may investigate system alerts.

Workflow:

alert generated ↓ operator reviews alert in Command Center ↓ related picks
inspected ↓ system logs reviewed ↓ issue resolved if necessary

Outcome:

- system integrity maintained
- operational issues resolved

---

# 11. Model Evaluation Workflow

Historical data enables model evaluation.

Workflow:

historical picks retrieved ↓ model predictions compared to outcomes ↓
performance metrics calculated ↓ model improvements identified

Outcome:

- scoring models improve over time
- long-term system intelligence increases

---

# 12. End-to-End Platform Workflow

The full lifecycle of the platform can be summarized as:

market ingestion ↓ pick evaluation ↓ promotion decision ↓ alert generation ↓
Discord distribution ↓ event settlement ↓ historical analysis

This lifecycle represents the core operation of the Unit Talk platform.

---

# Summary

Unit Talk workflows combine automated intelligence with operational oversight.

The platform executes the following core workflows:

- market monitoring
- pick evaluation
- promotion decisions
- alert generation
- Discord distribution
- settlement processing
- historical analytics
- operational monitoring

These workflows enable the system to continuously identify and distribute
betting opportunities.
