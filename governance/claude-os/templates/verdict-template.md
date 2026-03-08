# Sprint Verdict: {SPRINT_ID}

**Date**: {YYYY-MM-DD} **Agent**: Verifier **Sprint Type**: {docs / runtime /
build-fix / e2e-lifecycle / ui / schema} **Verification Tier**: {T1 / T2 / T3 /
T4}

---

## Verdict

### Status: {PASS / PASS WITH LIMITATIONS / BLOCKED / FAIL}

---

## Status Definitions

| Status                    | Meaning                                                                                                                                                                         | Next Action                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **PASS**                  | All acceptance criteria met. All required verification passed with strong evidence. No limitations.                                                                             | Proceed to ratification (PR creation).                                                         |
| **PASS WITH LIMITATIONS** | Core acceptance criteria met. Some non-blocking limitations exist. Evidence supports ratification with documented caveats.                                                      | Proceed to ratification with limitations documented. Follow-up sprint created for limitations. |
| **BLOCKED**               | Sprint cannot be completed due to an external dependency, missing infrastructure, or unresolvable precondition. The implementation may be correct but cannot be fully verified. | Halt. Document the blocker. Resume when blocker is resolved.                                   |
| **FAIL**                  | One or more acceptance criteria not met. Required verification failed. Evidence does not support ratification.                                                                  | Return to implementation. Fix failures. Re-verify.                                             |

---

## Evidence Checklist

| #   | Evidence Item                                | Required | Present | Passes |
| --- | -------------------------------------------- | -------- | ------- | ------ |
| 1   | TypeScript compilation (proof_typecheck.txt) | Yes      | [ ]     | [ ]    |
| 2   | Test results (proof_tests.txt)               | {Yes/No} | [ ]     | [ ]    |
| 3   | Build output (proof_build.txt)               | {Yes/No} | [ ]     | [ ]    |
| 4   | Lifecycle gate (proof_gate.txt)              | {Yes/No} | [ ]     | [ ]    |
| 5   | Runtime evidence (proof*runtime*\*.txt)      | {Yes/No} | [ ]     | [ ]    |
| 6   | Git status clean (proof_git_status.txt)      | Yes      | [ ]     | [ ]    |
| 7   | Diff within scope (sprint_changes.diff)      | Yes      | [ ]     | [ ]    |
| 8   | Closeout report (SPRINT_CLOSEOUT_REPORT.md)  | Yes      | [ ]     | [ ]    |

---

## Acceptance Criteria Evaluation

| #   | Criterion                                 | Met | Evidence                                 |
| --- | ----------------------------------------- | --- | ---------------------------------------- |
| 1   | {Specific criterion from sprint contract} | [ ] | {Reference to proof file or observation} |
| 2   | {Specific criterion from sprint contract} | [ ] | {Reference to proof file or observation} |
| 3   | {Specific criterion from sprint contract} | [ ] | {Reference to proof file or observation} |
| 4   | No files outside boundary modified        | [ ] | `sprint_changes.diff`                    |
| 5   | No deprecated paths introduced            | [ ] | Diff review / audit report               |
| 6   | No silent fallbacks introduced            | [ ] | Code review                              |

---

## Rationale

{Detailed explanation of why this verdict was reached. Reference specific
evidence files and acceptance criteria. Be precise.}

### What went well

- {Specific positive observation backed by evidence}

### What raised concerns

- {Specific concern with reference to evidence or lack thereof}

### What failed (if FAIL or BLOCKED)

- {Specific failure with root cause analysis}

---

## Limitations (if PASS WITH LIMITATIONS)

| Limitation        | Severity          | Impact                      | Mitigation                                  |
| ----------------- | ----------------- | --------------------------- | ------------------------------------------- |
| {What is limited} | {low/medium/high} | {What cannot be guaranteed} | {Follow-up sprint or known acceptable risk} |

---

## Blockers (if BLOCKED)

| Blocker       | Type                                 | Owner             | Resolution Path  |
| ------------- | ------------------------------------ | ----------------- | ---------------- |
| {What blocks} | {external/infrastructure/governance} | {Who can resolve} | {How to resolve} |

---

## Recommendations

- [ ] **Ratify** — PR is ready for human review.
- [ ] **Ratify with conditions** — PR is ready but follow-up sprint required
      for: {items}.
- [ ] **Return to implementation** — Failures must be fixed before
      re-verification.
- [ ] **Escalate** — Blocker requires human decision beyond sprint scope.

---

## Verifier Sign-Off

**Verdict confirmed**: {PASS / PASS WITH LIMITATIONS / BLOCKED / FAIL}
**Evidence reviewed**: {count} proof files, {count} acceptance criteria
**Confidence**: {high / medium / low} **Confidence rationale**: {Why this
confidence level — e.g., "high: all evidence is captured command output with
clear pass indicators" or "medium: runtime proof is manual observation, not
captured command output"}
