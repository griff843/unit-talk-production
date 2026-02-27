# FAIL_CLOSED_BOOT_SPEC_v1.0

**Version:** v1.0 **Phase:** Phase 7 — Repo Enforcement Contracts **Status:**
RATIFIED **Ratified:** 2026-02-27 (UTC) **Enforcement State:** RATIFIED

---

## 1. Purpose

This contract specifies fail-closed boot behavior for all Unit Talk services.
Every service MUST halt on startup if any boot precondition fails. There is no
graceful degradation at boot time.

---

## 2. Scope

### 2.1 In Scope

- API service boot sequence
- Worker service boot sequence
- Agent boot sequence
- Environment validation at boot
- Configuration validation at boot

### 2.2 Out of Scope

- Runtime error handling (covered by operational contracts)
- Database migration execution (covered by migration contracts)
- Deployment orchestration (covered by deployment contracts)

---

## 3. Fail-Closed Principle

### 3.1 Definition

Fail-closed means: if a precondition cannot be verified, the system MUST NOT
start. There is no "warn and continue" mode. There is no "best effort" boot.

### 3.2 Rationale

- Unknown state is worse than no state
- Partial boot creates debugging complexity
- Fail-closed is auditable; fail-open is not
- Boot is the last safe moment to validate truth

---

## 4. Boot Precondition Categories

### 4.1 Boot Precondition Enum (Closed)

| Code      | Category      | Description                        |
| --------- | ------------- | ---------------------------------- |
| BP_ENV    | Environment   | Environment identity and variables |
| BP_SECRET | Secrets       | Required secret availability       |
| BP_DB     | Database      | Database connectivity and schema   |
| BP_CONFIG | Configuration | Configuration validity and hash    |
| BP_DEPS   | Dependencies  | Required service dependencies      |

No boot precondition category may exist outside this enum.

---

## 5. Environment Preconditions (BP_ENV)

### 5.1 Required Environment Variables

| Variable     | Requirement                          | Fail Behavior |
| ------------ | ------------------------------------ | ------------- |
| ENV_IDENTITY | MUST be set to dev, staging, or prod | HALT          |
| NODE_ENV     | MUST match ENV_IDENTITY mapping      | HALT          |
| PORT         | MUST be a valid port number          | HALT          |

### 5.2 Environment Validation Rules

- ENV_IDENTITY MUST NOT be empty string
- ENV_IDENTITY MUST be from closed environment enum
- Environment variable interpolation MUST NOT occur at boot
- Environment MUST be determined before any other check

### 5.3 Environment Enum (Closed)

| Value   | Description             |
| ------- | ----------------------- |
| dev     | Development environment |
| staging | Staging environment     |
| prod    | Production environment  |

---

## 6. Secrets Preconditions (BP_SECRET)

### 6.1 Required Secrets

| Secret Category | Requirement                           | Fail Behavior |
| --------------- | ------------------------------------- | ------------- |
| Database URL    | MUST be present and parseable         | HALT          |
| API Keys        | MUST be present for required services | HALT          |
| Signing Keys    | MUST be present for auth operations   | HALT          |

### 6.2 Secret Validation Rules

- Secrets MUST NOT be logged at any verbosity level
- Secret presence MUST be checked before use
- Secret format MUST be validated (not just existence)
- Missing secret MUST halt boot with redacted error

---

## 7. Database Preconditions (BP_DB)

### 7.1 Required Database Checks

| Check           | Requirement                              | Fail Behavior |
| --------------- | ---------------------------------------- | ------------- |
| Connection      | MUST establish connection within timeout | HALT          |
| Schema Version  | MUST match expected version              | HALT          |
| Required Tables | MUST verify presence of canonical tables | HALT          |

### 7.2 Database Validation Rules

- Connection timeout MUST be bounded (max 30 seconds)
- Schema version MUST be compared exactly (no fuzzy match)
- Table presence check MUST include canonical tables only
- Database unavailability MUST halt boot

---

## 8. Configuration Preconditions (BP_CONFIG)

### 8.1 Required Configuration Checks

| Check           | Requirement                            | Fail Behavior |
| --------------- | -------------------------------------- | ------------- |
| Config Parse    | Configuration MUST parse without error | HALT          |
| Required Fields | All required fields MUST be present    | HALT          |
| Config Hash     | Configuration hash MUST be verifiable  | HALT          |

### 8.2 Configuration Validation Rules

- Configuration MUST NOT contain placeholder values
- Configuration MUST NOT reference undefined environment variables
- Configuration changes MUST invalidate config hash
- Invalid configuration MUST halt boot

---

## 9. Dependencies Preconditions (BP_DEPS)

### 9.1 Required Dependency Checks

| Dependency     | Requirement                              | Fail Behavior |
| -------------- | ---------------------------------------- | ------------- |
| External APIs  | Required external APIs MUST be reachable | HALT          |
| Message Queues | Required queues MUST be accessible       | HALT          |
| Cache Services | Required caches MUST be connectable      | HALT          |

### 9.2 Dependency Validation Rules

- Dependency health check MUST have bounded timeout
- Dependency unavailability MUST halt boot
- Dependency degradation MUST NOT trigger graceful fallback at boot
- All required dependencies MUST be explicitly listed

---

## 10. Boot Sequence Order

### 10.1 Required Boot Order

Boot checks MUST execute in this exact order:

| Order | Category  | Rationale                                 |
| ----- | --------- | ----------------------------------------- |
| 1     | BP_ENV    | Environment determines all other checks   |
| 2     | BP_SECRET | Secrets needed for subsequent connections |
| 3     | BP_CONFIG | Configuration needed before service init  |
| 4     | BP_DB     | Database needed for data operations       |
| 5     | BP_DEPS   | Dependencies checked last                 |

### 10.2 Boot Order Invariants

- Order MUST NOT be changed without contract amendment
- Later checks MUST NOT execute if earlier checks fail
- Boot sequence MUST be deterministic (same input = same sequence)

---

## 11. Boot Failure Behavior

### 11.1 Failure Response Enum (Closed)

| Code  | Response       | Description                                |
| ----- | -------------- | ------------------------------------------ |
| HALT  | Immediate Exit | Process terminates with non-zero exit code |
| RETRY | Bounded Retry  | Retry with exponential backoff, then HALT  |

### 11.2 Failure Response Rules

- HALT MUST log failure reason (redacting secrets)
- HALT MUST exit with non-zero code
- RETRY MUST have maximum attempt bound (default: 3)
- RETRY MUST have maximum duration bound (default: 60 seconds)
- After RETRY exhaustion, HALT MUST occur

### 11.3 Exit Code Convention

| Exit Code | Meaning                            |
| --------- | ---------------------------------- |
| 0         | Success (boot complete)            |
| 1         | General boot failure               |
| 2         | Environment precondition failure   |
| 3         | Secret precondition failure        |
| 4         | Configuration precondition failure |
| 5         | Database precondition failure      |
| 6         | Dependency precondition failure    |

---

## 12. Boot Logging Requirements

### 12.1 Required Log Events

| Event         | Log Level | Content                                |
| ------------- | --------- | -------------------------------------- |
| Boot Start    | INFO      | Timestamp, service name, environment   |
| Check Start   | DEBUG     | Check category, check name             |
| Check Pass    | DEBUG     | Check name, duration                   |
| Check Fail    | ERROR     | Check name, reason (redacted)          |
| Boot Complete | INFO      | Timestamp, duration, all checks passed |
| Boot Abort    | ERROR     | Timestamp, failing check, exit code    |

### 12.2 Logging Invariants

- Boot logs MUST NOT contain secrets
- Boot logs MUST include correlation ID
- Boot failure logs MUST include sufficient detail for debugging
- Boot logs MUST be structured (JSON preferred)

---

## 13. Audit Sweep Section

### 13.1 Patterns to Verify

An audit of this contract MUST check:

1. **Precondition Completeness**
   - Pattern: Every BP\_ code has a corresponding section
   - Verification: Section count matches enum count

2. **HALT Consistency**
   - Pattern: Every check table has HALT in Fail Behavior column
   - Verification: No WARN or SKIP in any fail behavior

3. **Order Determinism**
   - Pattern: Section 10.1 order matches logical dependency
   - Verification: Later checks cannot run without earlier checks

4. **Exit Code Coverage**
   - Pattern: Every failure category has a unique exit code
   - Verification: No duplicate exit codes for different failures

### 13.2 Audit Frequency

- This contract MUST be audited on every Phase change
- This contract MUST be audited when adding new boot checks
- Audit results MUST be recorded in ratification proof

---

## 14. Acceptance Criteria (Binary)

PASS only if all are true:

1. Every boot precondition category has a corresponding section
2. Every precondition check has fail behavior of HALT or RETRY-then-HALT
3. Boot sequence order is explicitly defined and deterministic
4. All enums are closed with explicit prohibition of extension
5. No "warn and continue" or "graceful degradation" patterns exist

FAIL if any of the above are missing, vague, or contradicted.

---

## 15. Canonical Binding

- CONSTITUTION_v1.0 (supreme design-layer authority)
- ENVIRONMENT_TRUTH_SOURCE_CONTRACT_v1.0 (environment identity)
- BUILD_RUNTIME_SEPARATION_LAW_v1.0 (build vs runtime separation)
- DOCKER_RUNTIME_AUTHORITY_CONTRACT_v1.0 (container runtime)
- ENFORCEMENT_SURFACE_MAP_v1.0 (boot enforcement points)

---

## 16. Constitutional Binding

This document operates under the authority of CONSTITUTION_v1.0.

---

**End of Document**
