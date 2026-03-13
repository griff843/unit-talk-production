# TELEMETRY & TRUTH AUDIT SPEC v1.0

Blueprint Type: Runtime Integrity & Drift Enforcement Contract  
Applies To: API, ScoringAgent, Execution Engine, Risk Engine, Outbox,
Settlement, Recap  
Status: RATIFIED (Phase 2A)  
Binding Over: All runtime systems, background jobs, CI gates, production
monitoring

---

# 1. PURPOSE

Ensure the system:

• Cannot silently drift  
• Cannot publish duplicates  
• Cannot mutate settled truth  
• Cannot silently degrade model quality  
• Cannot bypass exposure controls  
• Cannot operate with broken invariants

This is a fail-closed architecture.

No trust. Only verification.

---

# 2. TRUTH INVARIANTS (NON-NEGOTIABLE)

These must always be true in production.

---

## 2.1 Single Writer Invariant

Only one system component may:

• mutate bet_event state  
• write settlement  
• claim publish_job rows

All writes must be idempotent.

Violation → Auto-freeze.

---

## 2.2 Publish Idempotency Invariant

For each publish_job:

- publish_token must be unique
- publish_token set before POST
- publish_token never cleared after post
- receipt required for status=posted

If duplicate publish detected:

- Auto-freeze
- Alert operator

---

## 2.3 Settlement Immutability

After:

settlement.result != pending

Fields locked:

- final_stat_value
- settlement_version
- audit_hash

Any change requires:

- explicit override flag
- reason logged
- governance marker

---

## 2.4 Devig Integrity

Every market_snapshot must include:

- devig_method
- overround
- consensus_weights_json
- devig_fair_probabilities_json

If missing → snapshot invalid.

Invalid snapshots cannot be used for scoring.

---

## 2.5 Model Reproducibility

For each scored bet_event:

Must store:

- model_version
- feature_set_version
- feature_vector_hash
- inputs_snapshot_id

If any missing → promotion blocked.

---

# 3. TELEMETRY LAYERS

Telemetry must exist at three levels:

---

## 3.1 Event-Level Telemetry

For each bet_event lifecycle:

Track:

- ingest_timestamp
- score_timestamp
- execution_timestamp
- promotion_timestamp
- publish_timestamp
- settlement_timestamp
- recap_timestamp

This allows full timeline reconstruction.

---

## 3.2 Model Telemetry

Track per model_version:

- CLV rolling mean
- CLV rolling median
- Calibration metrics (ECE, Brier)
- Edge distribution stability
- Feature drift metrics
- Drift alarms

Stored in model_metrics table.

---

## 3.3 Execution Telemetry

Track:

- Slippage rate
- Fire-now vs wait outcomes
- Time-to-entry percentile
- CLV by execution_state
- Liquidity mismatches

---

## 3.4 Risk Telemetry

Track:

- Exposure by sport
- Exposure by participant
- Drawdown curves
- Correlation stacking events
- Freeze triggers

---

# 4. DRIFT DETECTION ENGINE

We monitor:

---

## 4.1 Feature Drift

Measure:

- Population mean shift
- Std deviation shift
- KL divergence

If:

- KL divergence > threshold for 3 consecutive windows → Flag feature drift.

---

## 4.2 Calibration Drift

If:

- ECE > threshold × 1.5 → Model enters audit mode.

---

## 4.3 CLV Drift

If:

- Rolling CLV negative beyond tolerance → Canary disable + operator alert.

---

## 4.4 Data Feed Drift

If:

- market_snapshot missing books
- overround abnormal
- data_quality_flag frequently partial/suspect

→ Suspend scoring for affected markets.

---

# 5. FREEZE PROTOCOL

Freeze types:

A) Soft Freeze

- Promotion suppressed
- Scoring continues

B) Hard Freeze

- No scoring
- No promotion
- Manual-only mode

C) Targeted Freeze

- Specific sport/market disabled

Triggers defined in Risk + Model specs.

All freeze events logged with timestamp + reason.

---

# 6. AUDIT TRAIL REQUIREMENTS

Every:

- Model release
- Risk parameter change
- Promotion threshold change
- Execution routing update

Must produce:

- Version increment
- Audit log entry
- Git commit reference
- Timestamp

No silent config changes allowed.

---

# 7. REAL-TIME ALERTING

System must alert when:

- Duplicate publish attempt
- Settlement mutation attempt
- CLV anomaly
- Massive drawdown
- Correlation threshold exceeded
- Feature drift beyond threshold
- Data quality collapse

Alerts must route to:

- Operator channel
- Logging system
- Incident log table

---

# 8. PROOF BUNDLES (RUNTIME)

Daily runtime proof must generate:

- Active model versions
- Current CLV metrics
- Current calibration metrics
- Current exposure metrics
- Freeze state
- Publish idempotency integrity check

Stored as: out/runtime/<date>/truth_snapshot.json

---

# 9. SELF-HEALING RULES

If:

- Minor feature drift → Trigger retrain suggestion

If:

- CLV negative short window but calibration stable → Reduce stake multiplier
  automatically

If:

- Data feed incomplete → Auto-switch to proportional devig fallback

System should degrade gracefully, not collapse.

---

# 10. TENANT ISOLATION ENFORCEMENT

Telemetry must be:

- Tenant-scoped
- No cross-tenant bleed
- Black label cannot impact core metrics

Isolation violations → hard freeze.

---

# 11. VERSIONING

Track:

- telemetry_version
- invariant_set_version
- freeze_protocol_version

Changes require:

- Governance marker
- Canary test
- Validation in staging

---

END.
