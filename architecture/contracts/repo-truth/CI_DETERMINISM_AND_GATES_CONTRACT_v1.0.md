# CI_DETERMINISM_AND_GATES_CONTRACT_v1.0

Unit Talk – Clean-Room Doctrine Phase 5 — Repository Truth (Design Only) Status:
RATIFIED

---

## 1. Purpose

This contract defines deterministic CI pipeline behavior and gate enforcement.
CI MUST be fail-closed. Releases MUST pass all gates. Artifacts MUST be
traceable to their source.

---

## 2. Fail-Closed Requirement

### 2.1 No Warn-Pass

CI pipelines MUST NOT:

- Allow warnings to pass as success
- Allow skipped tests to count as passed
- Allow partial gate passage
- Allow "allow_failure" on required gates

### 2.2 Gate Outcomes (Closed Set)

Each CI gate MUST produce exactly one outcome:

| Outcome | Meaning              | Effect             |
| ------- | -------------------- | ------------------ |
| PASS    | All checks succeeded | Pipeline continues |
| FAIL    | Any check failed     | Pipeline halts     |

No other outcomes (WARN, SKIP, PARTIAL) are permitted for required gates.

---

## 3. Required Gates (Closed Set)

The following gates are REQUIRED for any merge to main or release:

| Gate ID  | Gate Name         | Description                       |
| -------- | ----------------- | --------------------------------- |
| GATE-001 | Type Check        | TypeScript compilation succeeds   |
| GATE-002 | Lint              | ESLint passes with zero errors    |
| GATE-003 | Unit Tests        | All unit tests pass               |
| GATE-004 | Integration Tests | All integration tests pass        |
| GATE-005 | Build             | All workspace builds succeed      |
| GATE-006 | Lifecycle Gate    | Single-writer discipline verified |
| GATE-007 | Security Scan     | No critical/high vulnerabilities  |

All gates MUST pass. Any gate failure halts the pipeline.

---

## 4. Tag and Release Governance

### 4.1 Release Tag Requirements

Release tags MUST:

- Be minted only after all required gates pass
- Reference a specific commit SHA
- Follow semantic versioning or sprint naming convention
- Be immutable once created

Release tags MUST NOT:

- Be created manually bypassing CI
- Be moved to different commits
- Be deleted and recreated

### 4.2 Tag Authority

Only the following may create release tags:

- CI pipeline (automated, post-gate-pass)
- Authorized release manager (documented exception)

No other entity may create tags that imply release status.

---

## 5. Build Matrix Determinism

### 5.1 Matrix Declaration

The CI build matrix MUST declare:

- Node.js version(s)
- Operating system(s)
- Dependency installation method (lockfile frozen)
- Environment variables (build-only)

### 5.2 Matrix Reproducibility

Given the same:

- Source commit
- Lockfile state
- Build matrix declaration
- Base image versions

The build MUST produce identical artifacts (excluding timestamps and
non-deterministic metadata).

---

## 6. Artifact Traceability

### 6.1 Required Traceability Chain

Every published artifact MUST be traceable to:

| Link            | Description                               |
| --------------- | ----------------------------------------- |
| Commit SHA      | Exact source version                      |
| CI Run ID       | Pipeline execution identifier             |
| Gate Results    | Pass/fail status of each gate             |
| Build Timestamp | When artifact was produced                |
| Image Digest    | SHA256 of container image (if applicable) |

### 6.2 Artifact Metadata

Published artifacts MUST include or reference:

- Git commit SHA
- CI pipeline URL
- Build timestamp (UTC)
- Version tag (if release)

---

## 7. Pipeline Immutability

### 7.1 No Retry-Until-Pass

Pipelines MUST NOT:

- Allow unlimited retries of failed gates
- Allow selective re-running of only passed gates
- Allow gate bypass via retry manipulation

### 7.2 Retry Policy

If retry is permitted:

- Full pipeline re-execution required
- All gates re-evaluated
- New CI Run ID generated
- Retry count logged

---

## 8. Audit Requirements

The following MUST be observable for audit:

| Audit Signal                                | Purpose                    |
| ------------------------------------------- | -------------------------- |
| Each gate produces PASS or FAIL             | Proves fail-closed         |
| Release tag links to passing CI run         | Proves gate passage        |
| Artifact includes commit SHA                | Proves source traceability |
| Build matrix is declared in pipeline config | Proves determinism         |
| No warn-pass outcomes in logs               | Proves strict enforcement  |

---

## 9. Acceptance Criteria (Binary)

| Criterion                               | Requirement |
| --------------------------------------- | ----------- |
| CI is fail-closed (no warn-pass)        | MUST PASS   |
| All required gates enforced             | MUST PASS   |
| Tags minted only through governed gates | MUST PASS   |
| Build matrix declared and deterministic | MUST PASS   |
| Artifacts traceable to commit + CI run  | MUST PASS   |
| No bypass mechanism for required gates  | MUST PASS   |
| Release tags immutable                  | MUST PASS   |

PASS: All criteria satisfied. FAIL: Any criterion not satisfied.

---

## 10. Canonical Bindings

- BUILD_RUNTIME_SEPARATION_LAW_v1.0 (build-time constraints)
- BRANCH_PROTECTION_AND_RELEASE_DISCIPLINE_CONTRACT_v1.0 (merge governance)
- DOCKER_RUNTIME_AUTHORITY_CONTRACT_v1.0 (image artifact authority)
- CONFIG_INJECTION_DETERMINISM_CONTRACT_v1.0 (build env determinism)

---

## 11. Final Declaration

CI is fail-closed. Gates are mandatory. Releases are governed. Artifacts are
traceable. There is no warn-pass. There is no bypass.

---

## Constitutional Binding

This document operates under the authority of CONSTITUTION_v1.0.

---

**End of Document**
