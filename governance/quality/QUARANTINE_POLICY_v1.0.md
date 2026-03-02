# UNIT TALK — QUARANTINE GOVERNANCE POLICY

Version: 1.0  
Status: Binding  
Authority: Founder  
Applies To: All Test Suites, CI Gates, and Sprint Execution

---

## Purpose

Quarantine exists to temporarily isolate unstable tests without degrading
systemic integrity.

It is not a dumping ground. It is not indefinite. It is not optional.

Quarantine is a controlled containment mechanism with enforced decay.

---

## Definitions

**Quarantined Test**  
A test temporarily removed from active CI execution due to instability,
nondeterminism, or environmental mismatch.

**Active Test Pool**  
All tests executed in required CI checks.

**Quarantine Pool**  
All tests isolated under the quarantine manifest.

---

## Hard Constraints

1. Quarantined tests may not exceed 15% of total test count.
2. No quarantined test may remain quarantined longer than 30 days.
3. Any increase in quarantine count requires explicit PR justification.
4. CI must fail if quarantine grows without manifest update.
5. CI must fail if quarantine exceeds hard threshold.
6. CI must fail if any quarantined test breaches SLA.

---

## Structural Requirements

- All quarantined tests must be listed in:
  governance/quality/QUARANTINE_MANIFEST.json

Each entry must include:

- file_path
- reason
- date_quarantined
- owner
- restoration_deadline
- related_issue (optional)

---

## Restoration Rules

- Quarantined tests must be actively tracked.
- Each sprint must include restoration review.
- No sprint may introduce new quarantine entries without leadership approval.

---

## CI Enforcement Requirements

The CI pipeline must:

1. Count total tests.
2. Count quarantined tests.
3. Validate threshold compliance.
4. Validate SLA compliance.
5. Fail-closed on violation.

---

## Governance Violation

Violation of quarantine policy is treated as:

- Integrity breach
- CI enforcement failure
- Quality governance violation

---

## Ratification

This policy is binding once merged into main and tagged.

Tag Pattern: QUARANTINE-GOVERNANCE-LOCK-001
