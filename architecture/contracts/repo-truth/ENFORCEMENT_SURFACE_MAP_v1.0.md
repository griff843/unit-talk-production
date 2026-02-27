# ENFORCEMENT_SURFACE_MAP_v1.0

**Version:** v1.0 **Phase:** Phase 7 — Repo Enforcement Contracts **Status:**
RATIFIED **Ratified:** 2026-02-27 (UTC) **Enforcement State:** RATIFIED

---

## 1. Purpose

This contract defines the complete enforcement surface map for the Unit Talk
design layer. Every enforcement point MUST be explicitly documented. No
enforcement may exist outside this map.

---

## 2. Scope

### 2.1 In Scope

- CI gate enforcement points
- Runtime boot enforcement points
- Contract validation enforcement points
- Governance document enforcement points
- Tag truth enforcement points

### 2.2 Out of Scope

- Application business logic (covered by lifecycle contracts)
- Database triggers (covered by canonical data model)
- Agent behavior (covered by agent contracts)

---

## 3. Enforcement Surface Categories

### 3.1 Enforcement Surface Enum (Closed)

| Code          | Category            | Description                               |
| ------------- | ------------------- | ----------------------------------------- |
| ES_CI         | CI Gates            | Enforcement during continuous integration |
| ES_BOOT       | Boot Enforcement    | Enforcement during application startup    |
| ES_CONTRACT   | Contract Validation | Enforcement of contract compliance        |
| ES_GOVERNANCE | Governance Checks   | Enforcement of governance document rules  |
| ES_TAG        | Tag Truth           | Enforcement of governed tag minting       |

No enforcement surface category may exist outside this enum.

---

## 4. CI Gate Enforcement Surface (ES_CI)

### 4.1 Required CI Gates

The following CI gates MUST exist and MUST pass before merge:

| Gate ID | Gate Name          | Enforcement                             |
| ------- | ------------------ | --------------------------------------- |
| CI-001  | Type Check         | TypeScript compilation MUST succeed     |
| CI-002  | Lint               | ESLint MUST report zero errors          |
| CI-003  | Unit Tests         | All unit tests MUST pass                |
| CI-004  | Single-Writer Gate | Lifecycle single-writer audit MUST pass |
| CI-005  | Contract Scan      | Forbidden token scan MUST pass          |
| CI-006  | Build              | All workspace builds MUST succeed       |

### 4.2 CI Gate Invariants

- CI gates MUST NOT be skipped via flags or overrides
- CI gates MUST run on every PR
- CI gate failure MUST block merge
- CI gate bypass MUST require explicit governance amendment

---

## 5. Boot Enforcement Surface (ES_BOOT)

### 5.1 Required Boot Checks

The following checks MUST execute at application boot:

| Boot ID  | Check Name           | Enforcement                           |
| -------- | -------------------- | ------------------------------------- |
| BOOT-001 | Environment Identity | ENV_IDENTITY MUST be set and valid    |
| BOOT-002 | Required Secrets     | All required secrets MUST be present  |
| BOOT-003 | Database Connection  | Database connection MUST succeed      |
| BOOT-004 | Schema Version       | Schema version MUST match expected    |
| BOOT-005 | Config Hash          | Configuration hash MUST be verifiable |

### 5.2 Boot Enforcement Invariants

- Boot check failure MUST halt startup
- Boot checks MUST NOT be bypassable
- Boot check order MUST be deterministic
- Boot check results MUST be logged

---

## 6. Contract Validation Surface (ES_CONTRACT)

### 6.1 Contract Compliance Checks

| Contract ID | Contract          | Enforcement                             |
| ----------- | ----------------- | --------------------------------------- |
| CV-001      | CONSTITUTION_v1.0 | All contracts MUST bind to Constitution |
| CV-002      | Forbidden Tokens  | No TODO/TBD/PLACEHOLDER markers         |
| CV-003      | Runnable Commands | No executable command blocks            |
| CV-004      | Closed Enums      | All enums MUST be closed                |
| CV-005      | Binary Criteria   | All acceptance MUST be PASS/FAIL        |

### 6.2 Contract Validation Invariants

- Contract validation MUST run before ratification
- Contract validation failure MUST block ratification
- Contract changes MUST trigger re-validation

---

## 7. Governance Enforcement Surface (ES_GOVERNANCE)

### 7.1 Governance Document Rules

| Gov ID  | Rule                   | Enforcement                       |
| ------- | ---------------------- | --------------------------------- |
| GOV-001 | Version Format         | Versions MUST be v{MAJOR}.{MINOR} |
| GOV-002 | Status Field           | Status MUST be from closed enum   |
| GOV-003 | Ratification Date      | Date MUST be UTC format           |
| GOV-004 | Constitutional Binding | Binding section MUST exist        |
| GOV-005 | End Marker             | "End of Document" MUST be present |

### 7.2 Governance Status Enum (Closed)

| Status               | Description               |
| -------------------- | ------------------------- |
| DRAFT                | Document in development   |
| RATIFICATION_PENDING | Awaiting ratification     |
| RATIFIED             | Document is authoritative |
| SUPERSEDED           | Replaced by newer version |
| ARCHIVED             | No longer active          |

---

## 8. Tag Truth Enforcement Surface (ES_TAG)

### 8.1 Tag Minting Rules

| Tag ID  | Rule             | Enforcement                                |
| ------- | ---------------- | ------------------------------------------ |
| TAG-001 | CI-Only Minting  | Tags MUST be minted by CI only             |
| TAG-002 | Local Push Block | Local tag push MUST be blocked             |
| TAG-003 | Closeout Trigger | Tags MUST be triggered by closeout markers |
| TAG-004 | Version Format   | Tags MUST follow semantic versioning       |

### 8.2 Tag Enforcement Invariants

- Manual tag creation MUST NOT be permitted
- Tag minting MUST require closeout artifact
- Tag history MUST be immutable

---

## 9. Enforcement Point Registry

### 9.1 Complete Registry

Every enforcement point MUST be registered here:

| Surface       | Point ID | Description            | Fail Mode |
| ------------- | -------- | ---------------------- | --------- |
| ES_CI         | CI-001   | Type check             | BLOCK     |
| ES_CI         | CI-002   | Lint                   | BLOCK     |
| ES_CI         | CI-003   | Unit tests             | BLOCK     |
| ES_CI         | CI-004   | Single-writer gate     | BLOCK     |
| ES_CI         | CI-005   | Contract scan          | BLOCK     |
| ES_CI         | CI-006   | Build                  | BLOCK     |
| ES_BOOT       | BOOT-001 | Environment identity   | HALT      |
| ES_BOOT       | BOOT-002 | Required secrets       | HALT      |
| ES_BOOT       | BOOT-003 | Database connection    | HALT      |
| ES_BOOT       | BOOT-004 | Schema version         | HALT      |
| ES_BOOT       | BOOT-005 | Config hash            | HALT      |
| ES_CONTRACT   | CV-001   | Constitution binding   | BLOCK     |
| ES_CONTRACT   | CV-002   | Forbidden tokens       | BLOCK     |
| ES_CONTRACT   | CV-003   | Runnable commands      | BLOCK     |
| ES_CONTRACT   | CV-004   | Closed enums           | BLOCK     |
| ES_CONTRACT   | CV-005   | Binary criteria        | BLOCK     |
| ES_GOVERNANCE | GOV-001  | Version format         | BLOCK     |
| ES_GOVERNANCE | GOV-002  | Status field           | BLOCK     |
| ES_GOVERNANCE | GOV-003  | Ratification date      | BLOCK     |
| ES_GOVERNANCE | GOV-004  | Constitutional binding | BLOCK     |
| ES_GOVERNANCE | GOV-005  | End marker             | BLOCK     |
| ES_TAG        | TAG-001  | CI-only minting        | BLOCK     |
| ES_TAG        | TAG-002  | Local push block       | BLOCK     |
| ES_TAG        | TAG-003  | Closeout trigger       | BLOCK     |
| ES_TAG        | TAG-004  | Version format         | BLOCK     |

### 9.2 Registry Invariants

- No enforcement point may exist outside this registry
- Adding enforcement points MUST update this registry
- Removing enforcement points MUST require governance amendment

---

## 10. Audit Sweep Section

### 10.1 Patterns to Verify

An audit of this contract MUST check:

1. **Surface Enum Completeness**
   - Pattern: Every ES\_ code in Section 3.1 has a corresponding section
   - Verification: Manual section cross-reference

2. **Registry Completeness**
   - Pattern: Every point ID in Sections 4-8 appears in Section 9.1
   - Verification: Manual count comparison

3. **Fail Mode Consistency**
   - Pattern: Every BLOCK/HALT in registry matches section description
   - Verification: Manual consistency check

4. **No Orphan Points**
   - Pattern: No enforcement point in registry lacks section detail
   - Verification: Manual cross-reference

### 10.2 Audit Frequency

- This contract MUST be audited on every Phase change
- Audit results MUST be recorded in ratification proof

---

## 11. Acceptance Criteria (Binary)

PASS only if all are true:

1. Every enforcement surface category has a corresponding section
2. Every enforcement point has a registered ID
3. Every enforcement point has a defined fail mode (BLOCK or HALT)
4. No enforcement point exists outside this map
5. All enums are closed with explicit prohibition of extension

FAIL if any of the above are missing, vague, or unverifiable.

---

## 12. Canonical Binding

- CONSTITUTION_v1.0 (supreme design-layer authority)
- CI_DETERMINISM_AND_GATES_CONTRACT_v1.0 (CI gate definitions)
- TAG_TRUTH_ENFORCEMENT_v1.0 (tag minting rules)
- BUILD_RUNTIME_SEPARATION_LAW_v1.0 (boot vs build separation)

---

## 13. Constitutional Binding

This document operates under the authority of CONSTITUTION_v1.0.

---

**End of Document**
