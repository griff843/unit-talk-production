# PROOF_RECEIPTS_STANDARD_v1.0

**Version:** v1.0 **Phase:** Phase 7 — Repo Enforcement Contracts **Status:**
RATIFIED **Ratified:** 2026-02-27 (UTC) **Enforcement State:** RATIFIED

---

## 1. Purpose

This contract defines the standard for proof receipts across all Unit Talk
governance operations. Every governance action MUST produce a proof receipt. No
governance claim is valid without a corresponding receipt.

---

## 2. Scope

### 2.1 In Scope

- Sprint closeout proof receipts
- Ratification proof receipts
- Audit proof receipts
- Tag minting proof receipts
- Contract validation proof receipts

### 2.2 Out of Scope

- Application-level receipts (covered by lifecycle contracts)
- Database transaction logs (covered by audit log contracts)
- External API receipts (covered by distribution contracts)

---

## 3. Proof Receipt Principle

### 3.1 Definition

A proof receipt is an immutable artifact that provides auditable evidence of a
governance action. Receipts MUST be machine-verifiable and human-readable.

### 3.2 Rationale

- Claims without proof are unverifiable
- Proof enables audit and rollback
- Receipts create accountability
- Immutable receipts prevent tampering

---

## 4. Proof Receipt Categories

### 4.1 Receipt Category Enum (Closed)

| Code        | Category            | Description                    |
| ----------- | ------------------- | ------------------------------ |
| PR_SPRINT   | Sprint Closeout     | Proof of sprint completion     |
| PR_RATIFY   | Ratification        | Proof of document ratification |
| PR_AUDIT    | Audit               | Proof of audit execution       |
| PR_TAG      | Tag Minting         | Proof of governed tag creation |
| PR_CONTRACT | Contract Validation | Proof of contract compliance   |

No receipt category may exist outside this enum.

---

## 5. Sprint Closeout Receipts (PR_SPRINT)

### 5.1 Required Artifacts

| Artifact        | Filename Pattern          | Content                          |
| --------------- | ------------------------- | -------------------------------- |
| Git Status      | proof_git_status.txt      | Output of git status at closeout |
| Git Diff        | proof_git_diff.txt        | Output of git diff for changes   |
| Test Results    | proof_tests.txt           | Test execution output            |
| Build Results   | proof_build.txt           | Build execution output           |
| Closeout Report | SPRINT_CLOSEOUT_REPORT.md | Human-readable summary           |

### 5.2 Sprint Receipt Location

Sprint receipts MUST be stored at: `out/sprints/<SPRINT-ID>/<YYYY-MM-DD>/`

### 5.3 Sprint Receipt Invariants

- All required artifacts MUST be present
- Artifacts MUST be generated at closeout time (not reconstructed)
- Artifacts MUST NOT be modified after creation
- Missing artifacts MUST block sprint closeout

---

## 6. Ratification Receipts (PR_RATIFY)

### 6.1 Required Artifacts

| Artifact       | Filename Pattern                | Content                          |
| -------------- | ------------------------------- | -------------------------------- |
| Git Status     | proof_git_status.txt            | Repository state at ratification |
| Git Diff       | proof_git_diff.txt              | Changes being ratified           |
| File List      | proof_file_list.txt             | Files included in ratification   |
| Header Snippet | proof_header_snippet.txt        | Document header verification     |
| Forbidden Scan | proof_forbidden_token_scan.txt  | Token scan results               |
| Command Scan   | proof_runnable_command_scan.txt | Command block scan results       |
| Result         | RATIFICATION_RESULT.md          | Binary PASS/FAIL result          |

### 6.2 Ratification Receipt Location

Ratification receipts MUST be stored at:
`out/ratifications/<PHASE-ID>/<YYYY-MM-DD>/` or
`out/audits/<PHASE-ID>/<YYYY-MM-DD>/`

### 6.3 Ratification Receipt Invariants

- RATIFICATION_RESULT.md MUST contain binary PASS or FAIL
- All scans MUST be executed and recorded
- Receipt MUST be created before commit
- Ratification without receipt is invalid

---

## 7. Audit Receipts (PR_AUDIT)

### 7.1 Required Artifacts

| Artifact       | Filename Pattern         | Content                         |
| -------------- | ------------------------ | ------------------------------- |
| Audit Scope    | proof_audit_scope.txt    | Files and contracts audited     |
| Scan Results   | proof_scan_results.txt   | Automated scan outputs          |
| Findings       | proof_findings.txt       | Issues identified               |
| Reconciliation | proof_reconciliation.txt | Discrepancy resolution (if any) |
| Audit Report   | AUDIT_REPORT.md          | Human-readable summary          |

### 7.2 Audit Receipt Location

Audit receipts MUST be stored at: `out/audits/<AUDIT-ID>/<YYYY-MM-DD>/`

### 7.3 Audit Receipt Invariants

- Scope MUST be explicitly defined
- All findings MUST be documented
- Reconciliation MUST be provided if discrepancies exist
- Audit without receipt is unverifiable

---

## 8. Tag Minting Receipts (PR_TAG)

### 8.1 Required Artifacts

| Artifact           | Filename Pattern       | Content                          |
| ------------------ | ---------------------- | -------------------------------- |
| Closeout Reference | proof_closeout_ref.txt | Reference to triggering closeout |
| Tag Name           | proof_tag_name.txt     | Exact tag being minted           |
| Commit SHA         | proof_commit_sha.txt   | Commit being tagged              |
| CI Job ID          | proof_ci_job_id.txt    | CI job that minted the tag       |

### 8.2 Tag Receipt Location

Tag receipts MUST be stored at: `out/tags/<TAG-NAME>/<YYYY-MM-DD>/`

### 8.3 Tag Receipt Invariants

- Tag MUST reference a closeout marker
- Tag MUST be minted by CI only
- Manual tag creation MUST NOT produce valid receipt
- Tag without receipt is invalid

---

## 9. Contract Validation Receipts (PR_CONTRACT)

### 9.1 Required Artifacts

| Artifact          | Filename Pattern              | Content                      |
| ----------------- | ----------------------------- | ---------------------------- |
| Contract List     | proof_contract_list.txt       | Contracts validated          |
| Binding Scan      | proof_binding_scan.txt        | Constitutional binding check |
| Forbidden Scan    | proof_forbidden_scan.txt      | Forbidden token check        |
| Command Scan      | proof_command_scan.txt        | Runnable command check       |
| Validation Result | CONTRACT_VALIDATION_RESULT.md | Binary result per contract   |

### 9.2 Contract Receipt Location

Contract validation receipts MUST be stored at:
`out/contracts/<VALIDATION-ID>/<YYYY-MM-DD>/`

### 9.3 Contract Receipt Invariants

- Every contract MUST have individual PASS/FAIL
- Failed contracts MUST be listed explicitly
- Validation without receipt is invalid

---

## 10. Receipt File Format Requirements

### 10.1 Text Artifact Format

All `.txt` proof artifacts MUST follow:

```
<Artifact Title>
==================

<Metadata Section>
Date: YYYY-MM-DD (UTC)
Category: <PR_ code>
Generator: <tool or command>

---

<Content Section>
<actual proof content>

---

End of <Artifact Title>
```

### 10.2 Markdown Artifact Format

All `.md` proof artifacts MUST follow:

```
# <ARTIFACT_TITLE>

**Date:** YYYY-MM-DD (UTC)
**Category:** <PR_ code>
**Result:** PASS | FAIL

---

## Summary
<summary content>

---

## Details
<detailed content>

---

**End of Document**
```

### 10.3 Format Invariants

- All artifacts MUST have explicit end markers
- All artifacts MUST have timestamps
- All artifacts MUST have category codes
- Format violations MUST invalidate receipt

---

## 11. Receipt Integrity Requirements

### 11.1 Immutability

- Receipts MUST NOT be modified after creation
- Receipt modification MUST invalidate the receipt
- Receipt deletion MUST be prohibited in governance contexts

### 11.2 Completeness

- Partial receipts are invalid
- Missing artifacts MUST block the governance action
- Receipt generation MUST be atomic (all or nothing)

### 11.3 Verifiability

- Receipts MUST be machine-parseable
- Receipts MUST be human-readable
- Receipt content MUST be sufficient to reproduce verification

---

## 12. Receipt Storage Rules

### 12.1 Storage Hierarchy

```
out/
├── sprints/<SPRINT-ID>/<DATE>/
├── ratifications/<PHASE-ID>/<DATE>/
├── audits/<AUDIT-ID>/<DATE>/
├── tags/<TAG-NAME>/<DATE>/
├── contracts/<VALIDATION-ID>/<DATE>/
└── closeouts/<CLOSEOUT-ID>/<DATE>/
```

### 12.2 Storage Invariants

- Receipts MUST be stored in version control
- Receipt paths MUST follow the hierarchy above
- Custom receipt locations MUST NOT be used
- Receipt directories MUST be created before artifact generation

---

## 13. Audit Sweep Section

### 13.1 Patterns to Verify

An audit of this contract MUST check:

1. **Category Completeness**
   - Pattern: Every PR\_ code has a corresponding section
   - Verification: Section count matches enum count

2. **Artifact Completeness**
   - Pattern: Every section lists required artifacts
   - Verification: No section lacks artifact table

3. **Location Consistency**
   - Pattern: Every section has a Location subsection
   - Verification: All locations follow out/ hierarchy

4. **Invariant Presence**
   - Pattern: Every section has Invariants subsection
   - Verification: No section lacks enforcement rules

### 13.2 Audit Frequency

- This contract MUST be audited on every Phase change
- This contract MUST be audited when adding new receipt categories
- Audit results MUST be recorded as PR_AUDIT receipts

---

## 14. Acceptance Criteria (Binary)

PASS only if all are true:

1. Every receipt category has a corresponding section
2. Every category defines required artifacts with filename patterns
3. Every category defines storage location following hierarchy
4. Every category defines invariants enforcing immutability and completeness
5. Receipt format requirements are explicit and verifiable
6. All enums are closed with explicit prohibition of extension

FAIL if any of the above are missing, vague, or unverifiable.

---

## 15. Canonical Binding

- CONSTITUTION_v1.0 (supreme design-layer authority)
- ENFORCEMENT_SURFACE_MAP_v1.0 (enforcement point registry)
- CI_DETERMINISM_AND_GATES_CONTRACT_v1.0 (CI gate definitions)
- TAG_TRUTH_ENFORCEMENT_v1.0 (tag minting rules)
- OPERATIONAL_AUDIT_LOG_CONTRACT_v1.1 (audit log ordering)

---

## 16. Constitutional Binding

This document operates under the authority of CONSTITUTION_v1.0.

---

**End of Document**
