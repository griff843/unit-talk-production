# UNIT TALK — MASTER ROADMAP

Version: 1.0  
Status: Draft  
Authority: Founder  
Binding Over: All implementation and sprint activity

This document defines the structural maturity sequence required before the
platform may be declared production-certified.

It governs architectural progression. It does not describe features.

All phases must pass binary acceptance criteria before advancing. No expansion
may occur during invariant instability. No phase may be partially accepted.

---

# PHASE 0 — GOVERNANCE LOCK

## Objective

Establish constitutional supremacy before architectural progression.

## Acceptance Criteria (Binary)

- Operating Constitution ratified and version-tagged.
- Platform Constitution ratified and version-tagged.
- Decision Log exists in governance directory.
- Amendment Log exists in governance directory.
- Architectural Freeze protocol documented.

## Gate

Governance baseline git tag exists.

## Kill Condition

Any unversioned governance artifact invalidates progression.

---

# PHASE 1 — RUNTIME & ENVIRONMENT TRUTH

## Objective

Enforce Docker-only runtime truth with fail-closed environment enforcement.

## Acceptance Criteria

- Production services boot exclusively via Docker Compose.
- Missing required environment variable causes immediate process termination.
- No production profile permits warn-pass configuration.
- Health endpoints are deterministic and machine-validated.

## Required Proof

- proof_docker_ps.txt
- proof_env_fail_closed.txt
- proof_healthcheck_scan.txt

## Kill Conditions

- Any service boots without required env.
- Any warn-pass configuration exists in production profile.
- Production-like service runs outside Docker.

---

# PHASE 2 — CANONICAL STATE ENFORCEMENT

## Objective

Guarantee single-writer lifecycle authority and settlement immutability.

## Acceptance Criteria

- Exactly one lifecycle writer exists.
- Exactly one settlement writer exists.
- Database-level write privilege enforcement implemented.
- Lifecycle transitions idempotent and logged.
- Settlement records immutable post-finalization.

## Required Proof

- proof_write_surface_map.md
- proof_db_privilege_contract.txt
- proof_settlement_immutability.txt
- proof_lifecycle_transition_test.txt

## Kill Conditions

- Competing writer exists.
- Settlement mutation possible post-finalization.
- Lifecycle stage can be skipped.

---

# PHASE 3 — OUTBOX DETERMINISM

## Objective

Guarantee deterministic external side effects.

## Acceptance Criteria

- All side effects originate exclusively from outbox.
- Retry cap enforced.
- Max pending age threshold defined.
- Dead-letter state exists.
- Backlog age continuously monitored.

## Required Proof

- proof_outbox_schema.md
- proof_retry_simulation.txt
- proof_dead_letter_log.txt
- proof_backlog_age_metric.txt

## Kill Conditions

- Silent event drop.
- Unbounded retry.
- Pending event beyond threshold without alert.

---

# PHASE 4 — DISTRIBUTION & DISCORD INTEGRITY

## Objective

Enforce Discord as rendering surface only.

## Acceptance Criteria

- No manual premium post path exists.
- Discord-originated state mutation prohibited.
- Snowflake IDs persisted.
- Posting authority centralized.
- Entitlement verified before dispatch.

## Required Proof

- proof_posting_authority_map.md
- proof_snowflake_persistence.txt
- proof_entitlement_trace.txt

## Kill Conditions

- Message exists without DB reference.
- Multiple posting authorities.
- Canonical mutation via Discord.

---

# PHASE 5 — BILLING & ENTITLEMENT HARDENING

## Objective

Guarantee deterministic entitlement derivation from billing truth.

## Acceptance Criteria

- Subscription state is single source of truth.
- Entitlements derived exclusively from subscription state.
- Auto-revocation enforced on cancellation/failure.
- Reconciliation job scheduled and monitored.
- No manual role override grants premium.

## Required Proof

- proof_entitlement_derivation.txt
- proof_auto_revocation.txt
- proof_reconciliation_log.txt

## Kill Conditions

- Access without billing truth.
- Duplicate subscription states.
- Refund alters canonical lifecycle history.

---

# PHASE 6 — SETTLEMENT & RECAP TRUTH

## Objective

Guarantee immutable settlement and deterministic recap generation.

## Acceptance Criteria

- Settlement writer singular and enforced.
- Settlement immutable after finalization.
- Recaps derived exclusively from canonical data.
- Historical recap reproducible on replay.

## Required Proof

- proof_settlement_writer_map.md
- proof_recap_reproducibility.txt
- proof_no_manual_recap_path.txt

## Kill Conditions

- Settlement altered post-finalization.
- Recap constructed outside canonical pipeline.

---

# PHASE 7 — INTELLIGENCE & RISK VALIDATION

## Objective

Enforce model versioning, edge reproducibility, and exposure governance.

## Acceptance Criteria

- Model version stored per pick.
- Backtest artifacts exist for active models.
- CLV tracking operational.
- Drift detection operational.
- Exposure tracking enforced.
- Risk caps defined in Metrics Charter.

## Required Proof

- proof_model_version_trace.txt
- proof_backtest_artifacts.md
- proof_clv_monitoring.txt
- proof_exposure_limits.txt

## Kill Conditions

- Unversioned model deployment.
- Sustained negative CLV without review.
- Exposure beyond defined threshold.

---

# PHASE 8 — STRESS & FAILURE VALIDATION

## Objective

Prove invariant survival under defined stress simulations.

## Required Simulations

- Subscriber churn shock.
- API latency spike.
- Discord outage.
- Settlement surge.
- CI invariant breach injection.

## Acceptance Criteria

- No canonical truth violation.
- No pending event beyond threshold.
- Retry logic deterministic.
- Post-simulation reconciliation clean.

## Kill Conditions

- Canonical state corruption.
- Invariant breach unblocked by CI.
- Manual intervention required to restore consistency.
