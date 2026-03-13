# AUTOPILOT GOVERNANCE SPEC v1.0

Blueprint Type: Autonomous Operation & Kill-Switch Contract  
Applies To: All Agents (Scoring, Execution, Risk, Promotion, Settlement,
Recap)  
Status: RATIFIED (Phase 2A)  
Binding Over: Automation privileges, overrides, freeze authority, and escalation
protocol

---

# 1. PURPOSE

Define:

• When the system is allowed to operate autonomously  
• When it must throttle  
• When it must freeze  
• Who can override  
• How overrides are audited  
• How incidents are escalated

Autopilot is a privilege — not a default right.

---

# 2. AUTOPILOT STATES

System-wide state must always be explicitly defined:

1. FULL_AUTOPILOT
2. GUARDED_AUTOPILOT
3. SHADOW_MODE
4. MANUAL_ONLY
5. HARD_FREEZE

No undefined states allowed.

---

# 3. STATE DEFINITIONS

## 3.1 FULL_AUTOPILOT

- Scoring active
- Promotion active
- Risk allocation active
- Publishing active
- Settlement active
- Recaps active

All invariants must be green.

---

## 3.2 GUARDED_AUTOPILOT

- Scoring active
- Promotion active with stake throttling
- Execution conservative
- Risk multiplier reduced
- Alerts elevated

Triggered by:

- Minor calibration drift
- Short-term CLV softness
- Elevated volatility

---

## 3.3 SHADOW_MODE

- Scoring active
- No public promotion
- No capital allocation
- Logging only

Used for:

- New model version
- Feature experiments
- Routing changes

---

## 3.4 MANUAL_ONLY

- Scoring active
- Promotion disabled
- Operator must approve each pick
- Risk still enforced

Used for:

- Elevated drawdown
- Data instability
- Provider inconsistencies

---

## 3.5 HARD_FREEZE

- No scoring
- No promotion
- No publish
- Settlement only allowed
- Recaps continue

Used for:

- Integrity breach
- Duplicate publish event
- Settlement mutation attempt
- Severe model drift
- Data feed corruption

---

# 4. STATE TRANSITION RULES

State transitions must be deterministic.

---

## 4.1 Auto-Downgrade Triggers

FULL_AUTOPILOT → GUARDED_AUTOPILOT if:

- Rolling CLV < threshold
- ECE increases by 50%
- Slippage exceeds threshold
- 7-day drawdown > defined %

GUARDED_AUTOPILOT → MANUAL_ONLY if:

- CLV negative sustained
- Drawdown > secondary threshold
- Feature drift persistent

ANY STATE → HARD_FREEZE if:

- Publish idempotency violated
- Settlement immutability violated
- Cross-tenant contamination detected
- Major data outage confirmed

---

## 4.2 Recovery Rules

HARD_FREEZE → MANUAL_ONLY requires:

- Operator review
- Incident report
- Validation checks passed
- Explicit unfreeze flag

MANUAL_ONLY → GUARDED_AUTOPILOT requires:

- Stability window satisfied
- Drift metrics normalized

GUARDED_AUTOPILOT → FULL_AUTOPILOT requires:

- CLV restored
- Calibration restored
- Exposure stable

No instant return to FULL_AUTOPILOT allowed.

---

# 5. OPERATOR OVERRIDE PROTOCOL

Operator may:

- Approve suppressed pick
- Override band classification
- Adjust stake within caps
- Transition system state

Operator may NOT:

- Bypass exposure caps
- Modify settled results without audit flag
- Clear publish_token
- Disable telemetry

Every override must log:

- operator_id
- reason_code
- timestamp
- before_state
- after_state

Overrides audited monthly.

---

# 6. INCIDENT PROTOCOL

An incident is triggered by:

- Duplicate publish
- Data corruption
- Extreme drift
- Unexpected model behavior
- Major financial drawdown

Incident steps:

1. Auto state downgrade
2. Alert to operator channel
3. Log incident_id
4. Freeze if required
5. Root cause analysis
6. Postmortem entry
7. Governance marker if structural change required

No silent incident handling.

---

# 7. DEPLOYMENT GOVERNANCE

No model, risk, or execution update may:

- Be deployed directly to FULL_AUTOPILOT
- Skip SHADOW_MODE

Deployment sequence:

1. Shadow mode
2. Canary routing (10–20%)
3. Guarded autopilot
4. Full autopilot

Rollback must be instant and deterministic.

---

# 8. THRESHOLD VERSIONING

Track:

- autopilot_state_version
- freeze_rule_version
- drift_threshold_version
- override_policy_version

Any threshold change requires:

- Walk-forward validation
- Governance closeout marker

---

# 9. TRANSPARENCY & AUDIT

System must expose:

- Current autopilot state
- Last state transition
- Reason for current state
- Active model versions
- Active risk profile
- Freeze status

Accessible via:

- Command Center
- Operator dashboard
- API endpoint

---

# 10. SELF-LIMITING BEHAVIOR

The system must prefer:

- Under-allocation to over-allocation
- Freeze over silent degradation
- Conservative scaling during volatility
- Transparent alerts over silent drift

---

# 11. TENANT-SPECIFIC AUTOPILOT

Black label tenants may:

- Have independent autopilot states
- Have independent risk profiles

But:

Core invariants are global.

A tenant cannot operate if core system is HARD_FREEZE.

---

# 12. VERSIONING

autopilot_governance_version = v1.0

Any change requires:

- Governance closeout
- Canary
- Incident test simulation

---

END.
