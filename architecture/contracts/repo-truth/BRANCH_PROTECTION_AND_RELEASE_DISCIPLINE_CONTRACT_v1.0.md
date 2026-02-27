# BRANCH_PROTECTION_AND_RELEASE_DISCIPLINE_CONTRACT_v1.0

Unit Talk – Clean-Room Doctrine Phase 5 — Repository Truth (Design Only) Status:
RATIFIED

---

## 1. Purpose

This contract defines branch protection rules and release discipline. The main
branch MUST be protected. Direct pushes are forbidden. Releases MUST correspond
to ratified contracts and passing gates.

---

## 2. Protected Branches (Closed Set)

The following branches MUST be protected:

| Branch  | Protection Level | Purpose                |
| ------- | ---------------- | ---------------------- |
| main    | FULL             | Production truth       |
| staging | FULL             | Pre-production staging |

No other branches require protection under this contract.

---

## 3. Main Branch Protection Requirements

The `main` branch MUST enforce:

### 3.1 Required Status Checks

All checks defined in CI_DETERMINISM_AND_GATES_CONTRACT_v1.0 MUST pass before
merge:

- Type Check (GATE-001)
- Lint (GATE-002)
- Unit Tests (GATE-003)
- Integration Tests (GATE-004)
- Build (GATE-005)
- Lifecycle Gate (GATE-006)
- Security Scan (GATE-007)

### 3.2 Direct Push Prohibition

Direct pushes to `main` are FORBIDDEN.

All changes MUST arrive via:

- Pull request with passing checks
- Merge commit or squash merge

### 3.3 Force Push Prohibition

Force push to `main` is FORBIDDEN.

History rewriting on `main` is FORBIDDEN.

### 3.4 Branch Deletion Prohibition

The `main` branch MUST NOT be deleted.

---

## 4. Declared Exceptions

The following exceptions are declared and logged:

| Exception ID | Description                  | Condition                    |
| ------------ | ---------------------------- | ---------------------------- |
| EXC-001      | Emergency hotfix direct push | Requires post-hoc audit + PR |
| EXC-002      | CI infrastructure bootstrap  | Initial repo setup only      |

Exceptions MUST:

- Be logged with timestamp and author
- Be followed by retroactive compliance (PR created, audit performed)
- Not be used for normal development

---

## 5. Release Tag Requirements

### 5.1 Tag Naming Convention

Release tags MUST follow one of:

| Pattern           | Example                    | Purpose            |
| ----------------- | -------------------------- | ------------------ |
| Semantic version  | `v1.2.3`                   | Production release |
| Sprint completion | `SPRINT-NAME-###-COMPLETE` | Sprint milestone   |
| Hotfix            | `v1.2.3-hotfix.1`          | Emergency patch    |

### 5.2 Tag-Contract Correspondence

Release tags MUST correspond to:

- All applicable contracts ratified at tag time
- All required CI gates passing
- Clean working tree at tagged commit
- No pending contract violations

### 5.3 Tag Immutability

Once created:

- Tags MUST NOT be moved
- Tags MUST NOT be deleted and recreated
- Tag history MUST be preserved

---

## 6. Merge Discipline

### 6.1 Required Before Merge

Before any merge to `main`:

- [ ] All CI gates pass
- [ ] No unresolved review comments (if review required)
- [ ] No merge conflicts
- [ ] Branch is up-to-date with main (or rebase completed)

### 6.2 Merge Methods (Closed Set)

Permitted merge methods:

| Method       | Permitted | Notes                  |
| ------------ | --------- | ---------------------- |
| Merge commit | YES       | Preserves full history |
| Squash merge | YES       | Single commit per PR   |
| Rebase merge | YES       | Linear history         |
| Fast-forward | YES       | When branch is ahead   |

All methods require passing gates.

---

## 7. Release Workflow

### 7.1 Standard Release

1. All changes merged to `main` via PR
2. All CI gates pass on `main`
3. Release tag created (by CI or authorized party)
4. Deployment triggered from tagged commit
5. Release notes generated referencing tag

### 7.2 Hotfix Release

1. Hotfix branch created from release tag
2. Fix applied and tested
3. PR to `main` with passing gates
4. Hotfix tag created
5. Deployment from hotfix tag
6. Backport documented

---

## 8. Audit Requirements

The following MUST be observable for audit:

| Audit Signal                           | Purpose                  |
| -------------------------------------- | ------------------------ |
| No direct commits to main in git log   | Proves protection        |
| All main commits have associated PR    | Proves review process    |
| Release tags reference passing CI runs | Proves gate compliance   |
| Exception usage logged and justified   | Proves controlled bypass |
| Tag history shows no movement          | Proves immutability      |

---

## 9. Acceptance Criteria (Binary)

| Criterion                                    | Requirement |
| -------------------------------------------- | ----------- |
| Main branch protected by required checks     | MUST PASS   |
| No direct pushes to main (exceptions logged) | MUST PASS   |
| No force push to main                        | MUST PASS   |
| Release tags correspond to ratified state    | MUST PASS   |
| Release tags correspond to passing gates     | MUST PASS   |
| Tags immutable once created                  | MUST PASS   |
| Exceptions declared and auditable            | MUST PASS   |

PASS: All criteria satisfied. FAIL: Any criterion not satisfied.

---

## 10. Canonical Bindings

- CI_DETERMINISM_AND_GATES_CONTRACT_v1.0 (gate definitions)
- BUILD_RUNTIME_SEPARATION_LAW_v1.0 (build constraints)
- PHASE_5_REPOSITORY_TRUTH_RATIFICATION_v1.0 (ratification checkpoint)

---

## 11. Final Declaration

Main is protected. Direct push is forbidden. Releases are governed. Tags are
immutable. There is no bypass without audit. There is no exception without
logging.

---

## Constitutional Binding

This document operates under the authority of CONSTITUTION_v1.0.

---

**End of Document**
