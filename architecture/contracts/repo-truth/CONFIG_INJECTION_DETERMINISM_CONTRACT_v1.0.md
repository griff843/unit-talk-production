# CONFIG_INJECTION_DETERMINISM_CONTRACT_v1.0

Unit Talk – Clean-Room Doctrine Phase 5 — Repository Truth (Design Only) Status:
RATIFIED

---

## 1. Purpose

This contract defines deterministic configuration resolution at service boot.
Configuration MUST be resolved once at startup in a declared order. Runtime
mutation of configuration is forbidden. Configuration state MUST be
reconstructable from audit artifacts.

---

## 2. Deterministic Resolution Order

Configuration resolution MUST follow this exact order (highest to lowest
precedence):

| Precedence | Source                         | Phase   | Notes                         |
| ---------- | ------------------------------ | ------- | ----------------------------- |
| 1          | Platform secret store          | Runtime | Prod/staging only             |
| 2          | Container environment          | Runtime | Injected at container start   |
| 3          | Docker Compose env declaration | Runtime | Dev/local compose             |
| 4          | `.env.local` file              | Runtime | Dev only, lowest precedence   |
| 5          | Default values in code         | Build   | Fallbacks for optional config |

Resolution MUST be deterministic: same inputs produce same resolved config.

---

## 3. Resolution Timing

### 3.1 Boot-Time Resolution

All configuration MUST be resolved at service boot, defined as:

- After container start
- Before any request handling
- Before any worker task processing
- Before any external connection initialization

### 3.2 Resolution Checkpoint

Service MUST:

1. Read all configuration sources in declared order
2. Merge according to precedence
3. Validate completeness (all required variables present)
4. Validate format (all variables match expected types)
5. Freeze configuration state
6. Log resolution checkpoint (without secret values)
7. Proceed to service initialization

If validation fails ⇒ Service MUST NOT start. Fail-closed.

---

## 4. Mutability Prohibitions

The following mutations are FORBIDDEN after boot:

| Prohibition                                 | Reason              |
| ------------------------------------------- | ------------------- |
| `process.env[key] = value` after boot       | Non-determinism     |
| Dynamic config reload from external source  | State drift         |
| Hot-reload of secrets without restart       | Audit gap           |
| Environment variable injection mid-request  | Non-reproducibility |
| Config value computation from runtime state | Non-determinism     |

Violation ⇒ CONTRACT FAILURE.

---

## 5. Dynamic Config Reload (If Supported)

If dynamic configuration reload is ever supported:

- Reload MUST require explicit service restart
- Reload MUST produce audit event before restart
- Reload MUST produce audit event after restart with new config hash
- No silent reload is permitted

Current status: Dynamic reload NOT supported. All config changes require
restart.

---

## 6. Reconstruction Requirement

Runtime configuration state MUST be fully reconstructable from:

1. Container image hash (determines code defaults)
2. Environment variables injected at boot (from platform/compose)
3. Boot-time audit log entry (records resolution result)

If these three artifacts are available, the exact configuration state MUST be
reproducible.

---

## 7. Configuration Fingerprint

At boot, service MUST compute and log:

```
config_fingerprint = SHA256(sorted(resolved_config_keys_and_values))
```

Where:

- Secret values are replaced with `[REDACTED:${first_4_chars}]` for
  fingerprinting
- Keys are sorted alphabetically
- Fingerprint is logged and available for audit

---

## 8. Audit Requirements

The following MUST be observable for audit:

| Audit Signal                                  | Purpose               |
| --------------------------------------------- | --------------------- |
| Config resolution checkpoint logged           | Proves boot sequence  |
| Config fingerprint logged (secrets redacted)  | Proves config state   |
| Missing required variable causes boot failure | Proves fail-closed    |
| No `process.env` mutation after boot          | Proves immutability   |
| Image hash available                          | Proves code version   |
| Env var source traceable                      | Proves injection path |

---

## 9. Acceptance Criteria (Binary)

| Criterion                                      | Requirement |
| ---------------------------------------------- | ----------- |
| Config resolved at boot in declared order      | MUST PASS   |
| `process.env` not mutated after boot           | MUST PASS   |
| No dynamic reload without restart + audit      | MUST PASS   |
| Config reconstructable from image + env + logs | MUST PASS   |
| Config fingerprint logged at boot              | MUST PASS   |
| Missing required config causes boot failure    | MUST PASS   |
| Resolution order matches declared precedence   | MUST PASS   |

PASS: All criteria satisfied. FAIL: Any criterion not satisfied.

---

## 10. Canonical Bindings

- BUILD_RUNTIME_SEPARATION_LAW_v1.0 (build vs runtime config access)
- ENVIRONMENT_TRUTH_SOURCE_CONTRACT_v1.0 (source authority per env)
- DOCKER_RUNTIME_AUTHORITY_CONTRACT_v1.0 (container env injection)
- CI_DETERMINISM_AND_GATES_CONTRACT_v1.0 (image hash traceability)
- OPERATIONAL_AUDIT_LOG_CONTRACT_v1.1 (audit event format)

---

## 11. Final Declaration

Configuration is resolved once at boot. Configuration is immutable after boot.
Configuration is reconstructable from artifacts. There is no silent reload.
There is no runtime mutation.

---

## Constitutional Binding

This document operates under the authority of CONSTITUTION_v1.0.

---

**End of Document**
