# TEMPORAL_EXECUTION_BOUNDARY_CONTRACT_v1.0

Unit Talk – Clean-Room Doctrine Phase 5 — Repository Truth (Design Only) Status:
RATIFIED

---

## 1. Purpose

This contract defines execution boundaries for Temporal workflows and workers.
Workers MUST respect build/runtime separation. Worker startup MUST NOT occur at
build time. Execution boundaries between services MUST be explicit and
non-overlapping.

---

## 2. Scope

This contract governs:

- Temporal worker processes
- Temporal workflow execution
- Temporal activity execution
- Boundaries between API, worker, and web application execution

---

## 3. Build/Runtime Separation for Temporal

### 3.1 Build Phase Prohibitions

During build phase, the following are FORBIDDEN:

| Prohibition                    | Reason                      |
| ------------------------------ | --------------------------- |
| Temporal worker registration   | Runtime operation           |
| Temporal client initialization | Requires runtime connection |
| Workflow execution             | Runtime operation           |
| Activity execution             | Runtime operation           |
| Connection to Temporal server  | Runtime dependency          |

### 3.2 Runtime Initialization

Worker startup MUST occur only at runtime:

- After container start
- After environment validation
- After configuration resolution
- Before accepting workflow tasks

---

## 4. Environment Identity Enforcement

### 4.1 Worker Boot Validation

At worker boot, the following MUST be validated:

| Validation                             | Action on Failure     |
| -------------------------------------- | --------------------- |
| APP_ENV present and valid              | Worker MUST NOT start |
| TEMPORAL_NAMESPACE matches environment | Worker MUST NOT start |
| Required credentials present           | Worker MUST NOT start |
| Task queue matches environment         | Worker MUST NOT start |

### 4.2 Cross-Environment Prevention

Workers MUST NOT:

- Connect to wrong environment's Temporal namespace
- Process tasks from wrong environment's queue
- Use credentials from different environment

Violation ⇒ Worker MUST halt immediately.

---

## 5. Execution Boundaries (Closed Set)

### 5.1 Defined Execution Surfaces

| Surface         | Execution Type       | Temporal Role        | Boundary           |
| --------------- | -------------------- | -------------------- | ------------------ |
| API             | Request handler      | Client (start flows) | HTTP request scope |
| Temporal Worker | Background processor | Worker (execute)     | Task queue scope   |
| Web Apps        | Browser client       | None                 | Browser scope      |

### 5.2 Non-Overlapping Requirement

Each execution surface MUST:

- Have distinct process identity
- Have distinct scaling configuration
- Have distinct health check
- Not share process with other surfaces

### 5.3 Boundary Violations

The following are FORBIDDEN:

| Violation                                    | Reason             |
| -------------------------------------------- | ------------------ |
| API process running worker registration      | Boundary violation |
| Worker process serving HTTP requests         | Boundary violation |
| Single process acting as both API and worker | Ambiguous boundary |
| Web app executing Temporal activities        | Wrong surface      |

---

## 6. Worker Configuration Requirements

### 6.1 Required Configuration

Each worker MUST have:

| Configuration       | Description                       |
| ------------------- | --------------------------------- |
| TEMPORAL_ADDRESS    | Temporal server endpoint          |
| TEMPORAL_NAMESPACE  | Environment-specific namespace    |
| TEMPORAL_TASK_QUEUE | Worker's task queue               |
| APP_ENV             | Environment identity              |
| Worker identity     | Unique identifier for this worker |

### 6.2 Task Queue Isolation

Task queues MUST be environment-isolated:

| Environment | Task Queue Pattern    |
| ----------- | --------------------- |
| prod        | `unit-talk-prod-*`    |
| staging     | `unit-talk-staging-*` |
| dev         | `unit-talk-dev-*`     |

Cross-environment task queue access is FORBIDDEN.

---

## 7. Workflow Execution Boundaries

### 7.1 Workflow Determinism

Workflows MUST:

- Use only deterministic operations
- Not access external state directly (use activities)
- Not depend on current time (use workflow time)
- Be replayable from event history

### 7.2 Activity Execution

Activities MUST:

- Execute within worker process
- Have explicit timeouts
- Be idempotent or handle retries correctly
- Log execution for audit

---

## 8. Health and Observability

### 8.1 Worker Health Check

Each worker MUST expose:

- Health endpoint or probe
- Task queue binding status
- Environment identity
- Last activity timestamp

### 8.2 Boundary Verification

At startup, each service MUST log:

- Its execution surface type
- Its environment identity
- Its Temporal role (if any)
- Its process identity

---

## 9. Audit Requirements

The following MUST be observable for audit:

| Audit Signal                            | Purpose                     |
| --------------------------------------- | --------------------------- |
| Worker boot logs environment validation | Proves identity enforcement |
| No worker registration in build logs    | Proves separation           |
| Each surface has distinct process ID    | Proves non-overlap          |
| Task queue matches environment          | Proves isolation            |
| Workflow execution traceable to worker  | Proves boundary respect     |

---

## 10. Acceptance Criteria (Binary)

| Criterion                                         | Requirement |
| ------------------------------------------------- | ----------- |
| Workers respect build/runtime separation          | MUST PASS   |
| Worker startup NOT at build time                  | MUST PASS   |
| Environment identity enforced at worker boot      | MUST PASS   |
| Execution boundaries explicit and non-overlapping | MUST PASS   |
| Task queues environment-isolated                  | MUST PASS   |
| No single process spans multiple surfaces         | MUST PASS   |
| Worker health observable                          | MUST PASS   |

PASS: All criteria satisfied. FAIL: Any criterion not satisfied.

---

## 11. Canonical Bindings

- BUILD_RUNTIME_SEPARATION_LAW_v1.0 (core separation)
- ENVIRONMENT_TRUTH_SOURCE_CONTRACT_v1.0 (env identity)
- DOCKER_RUNTIME_AUTHORITY_CONTRACT_v1.0 (container execution)
- CONFIG_INJECTION_DETERMINISM_CONTRACT_v1.0 (boot config)
- OPERATIONAL_AUDIT_LOG_CONTRACT_v1.1 (execution logging)

---

## 12. Final Declaration

Temporal workers respect build/runtime separation. Execution boundaries are
explicit. Environment identity is enforced. There is no overlap between
surfaces. There is no build-time worker registration.

---

## Constitutional Binding

This document operates under the authority of CONSTITUTION_v1.0.

---

**End of Document**
