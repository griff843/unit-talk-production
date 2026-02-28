--------------------------------------------------
Governance Tier: TIER 1 — CONSTITUTIONAL LAW
Version: v1.0
Ratification Date: 2026-02-27
Approval Authority: Griff (Operator)
---

---

# GOVERNANCE VERSIONING RULES

**Purpose**: Define version control requirements for Tier 1 governance
documents.

---

## 1. Version Bump Requirements

### 1.1 Tier 1 Changes Require Version Bump

Any modification to a Tier 1 governance document MUST include a version bump.

| Change Type       | Version Bump | Example      |
| ----------------- | ------------ | ------------ |
| Invariant change  | MAJOR        | v1.0 -> v2.0 |
| Enum modification | MAJOR        | v1.0 -> v2.0 |
| Authority change  | MAJOR        | v1.0 -> v2.0 |
| New prohibition   | MAJOR        | v1.0 -> v2.0 |
| Clarification     | MINOR        | v1.0 -> v1.1 |
| Typo fix          | MINOR        | v1.0 -> v1.1 |
| Reference update  | MINOR        | v1.0 -> v1.1 |

### 1.2 Version Format

```
v{MAJOR}.{MINOR}
```

- MAJOR: Breaking changes, new invariants, removed permissions
- MINOR: Clarifications, typo fixes, non-breaking additions

---

## 2. Diff Summary Required

### 2.1 Mandatory Diff Documentation

Every Tier 1 modification MUST include:

1. **Diff Summary**: Human-readable description of changes
2. **Sections Modified**: List of affected sections
3. **Impact Assessment**: What enforcement changes
4. **Backwards Compatibility**: Does this break existing compliance?

### 2.2 Diff Location

Diffs MUST be documented in:

```
governance/v1/CHANGELOG.md
```

### 2.3 Diff Format

```markdown
## v{VERSION} - {DATE}

### Changed

- [Section X] Description of change

### Added

- [Section Y] Description of addition

### Removed

- [Section Z] Description of removal

### Impact

- What does this affect?
- Who needs to update?
```

---

## 3. Griff Approval Required

### 3.1 Approval Authority

All Tier 1 changes require explicit approval from: **Griff (Operator)**

### 3.2 Approval Record

Approval MUST be documented with:

| Field    | Required                                        |
| -------- | ----------------------------------------------- |
| Approver | Griff                                           |
| Date     | YYYY-MM-DD                                      |
| Version  | vX.Y                                            |
| Scope    | What was approved                               |
| Method   | PR approval, commit message, or signed document |

### 3.3 No Bypass

There is no emergency bypass for Tier 1 approval. If Griff is unavailable:

- Changes MUST wait
- No temporary approvals permitted
- No delegation of Tier 1 authority

---

## 4. Tag Required

### 4.1 Governance Tag Requirement

Every Tier 1 version change MUST be tagged:

```
GOVERNANCE_V{MAJOR}_{MINOR}_LOCK_{DATE}
```

Example: `GOVERNANCE_V1_0_LOCK_2026-02-27`

### 4.2 Tag Creation Rules

Per TAG_TRUTH_ENFORCEMENT_v1.0.md:

- Tags MUST be created by CI only
- Humans MUST NOT create governance tags
- Tag requires passing gates

### 4.3 Tag Contents

The tagged commit MUST contain:

- Updated governance document(s)
- Changelog entry
- Version bump in document header

---

## 5. CI Enforcement

### 5.1 CI Must Fail If Tier 1 Modified Without Bump

**Rule**: CI MUST fail if any file in `governance/v1/` is modified without:

1. Version header update
2. CHANGELOG.md entry
3. Approved by Griff

### 5.2 Detection Mechanism

CI gate checks:

```bash
# Pseudo-code for CI gate
if governance/v1/* modified:
    assert version_header_changed == true
    assert changelog_updated == true
    assert approval_present == true

if any_assert_fails:
    exit 1 "GOVERNANCE_VERSION_VIOLATION"
```

### 5.3 Gate Location

Enforcement gate: `.github/workflows/governance-version-gate.yml`

### 5.4 No Bypass

- `--no-verify` does NOT bypass governance gates
- Force-push does NOT bypass governance gates
- Admin merge does NOT bypass governance gates

---

## 6. Document Registry

### 6.1 Tier 1 Documents (Governed by These Rules)

| Document                          | Current Version | Location       |
| --------------------------------- | --------------- | -------------- |
| CONSTITUTION_v1.0.md              | v1.0            | governance/v1/ |
| SYSTEM_INVARIANTS_v1.0.md         | v1.0            | governance/v1/ |
| CLAUDE_EXECUTION_CONTRACT_v1.0.md | v1.0            | governance/v1/ |
| ENV_CONTRACT_v1.0.md              | v1.0            | governance/v1/ |
| TAG_TRUTH_ENFORCEMENT_v1.0.md     | v1.0            | governance/v1/ |
| GOVERNANCE_VERSIONING_RULES.md    | v1.0            | governance/v1/ |

### 6.2 Adding New Tier 1 Documents

New Tier 1 documents require:

1. Griff approval
2. Version header with Tier 1 designation
3. Addition to this registry
4. Governance tag

---

## 7. Violation Consequences

### 7.1 Violation Classes

| Violation                          | Consequence                   |
| ---------------------------------- | ----------------------------- |
| Modify Tier 1 without version bump | CI FAIL                       |
| Modify Tier 1 without approval     | CI FAIL                       |
| Create governance tag manually     | Tag deleted, audit logged     |
| Bypass CI gates                    | Sprint FAIL, mandatory review |

### 7.2 Remediation

Violations require:

1. Revert unauthorized changes
2. Follow proper version bump process
3. Document violation in decision log
4. Re-submit through proper channels

---

## 8. Amendment

### 8.1 Amending These Rules

These versioning rules are themselves Tier 1. Amendments require:

- Version bump (this document)
- Griff approval
- Governance tag
- Diff summary

### 8.2 Self-Referential Binding

This document binds itself. Silent modification of versioning rules is a
CONSTITUTIONAL_VIOLATION.

---

**Document Owner**: Griff (Operator) **Ratified**: 2026-02-27 **Enforcement**:
Active
