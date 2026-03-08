# Sprint Plan: {SPRINT_ID}

**Date**: {YYYY-MM-DD} **Phase**: 1 (Planning) **Agent**: Architect

---

## 1. Context Loaded

Confirm that all required truth sources have been loaded and verified.

| Context Source       | Path                                  | Loaded | Verified |
| -------------------- | ------------------------------------- | ------ | -------- |
| Execution Contract   | `CLAUDE_EXECUTION_CONTRACT.md`        | [ ]    | [ ]      |
| System Invariants    | `docs/SYSTEM_INVARIANTS.md`           | [ ]    | [ ]      |
| Claude OS Laws       | `governance/claude-os/SYSTEM_LAWS.md` | [ ]    | [ ]      |
| {Domain contract}    | `{path}`                              | [ ]    | [ ]      |
| {System current doc} | `{path}`                              | [ ]    | [ ]      |

**Context verification result**: PASS / FAIL (if FAIL, execution halts)

---

## 2. Truth Sources Confirmed

Confirm that loaded truth sources are consistent and non-contradictory.

| Truth Claim                            | Source          | Confirmed |
| -------------------------------------- | --------------- | --------- |
| {Canonical table for this domain is X} | `{source path}` | [ ]       |
| {Writer authority is Y}                | `{source path}` | [ ]       |
| {Deprecated paths are Z}               | `{source path}` | [ ]       |

**Truth consistency result**: PASS / CONFLICT (if CONFLICT, halt and report)

---

## 3. Problem Statement

{Clear, specific description of what this sprint solves. Reference the Linear
issue for context but ground the problem in repo truth.}

**What is broken / missing / needed**: {description} **Impact if not
addressed**: {consequence} **Success looks like**: {observable outcome}

---

## 4. Proposed Approach

### Strategy

{High-level description of the approach — what changes, in what order, and why
this approach over alternatives.}

### Implementation Steps

| #   | Step            | Files Affected | Risk              |
| --- | --------------- | -------------- | ----------------- |
| 1   | {First change}  | `{path}`       | {low/medium/high} |
| 2   | {Second change} | `{path}`       | {low/medium/high} |
| 3   | {Third change}  | `{path}`       | {low/medium/high} |

### Alternatives Considered

| Alternative              | Why Rejected |
| ------------------------ | ------------ |
| {Alternative approach 1} | {Reason}     |
| {Alternative approach 2} | {Reason}     |

---

## 5. Risks

| Risk     | Likelihood        | Impact            | Mitigation        |
| -------- | ----------------- | ----------------- | ----------------- |
| {Risk 1} | {low/medium/high} | {low/medium/high} | {How to mitigate} |
| {Risk 2} | {low/medium/high} | {low/medium/high} | {How to mitigate} |

---

## 6. Files Expected to Change

| File Path | Change Type            | Justification |
| --------- | ---------------------- | ------------- |
| `{path}`  | {create/modify/delete} | {Why}         |
| `{path}`  | {create/modify/delete} | {Why}         |

**Boundary check**: All files are within expected sprint scope. / WARNING: Files
X,Y are outside expected scope — contract amendment needed.

---

## 7. Verification Plan

| Verification              | Recipe ID     | How Evidence Will Be Collected                         |
| ------------------------- | ------------- | ------------------------------------------------------ |
| TypeScript compilation    | `typecheck`   | `npm run type-check > proofs/proof_typecheck.txt 2>&1` |
| Tests                     | `unit_tests`  | `npm run test:unit > proofs/proof_tests.txt 2>&1`      |
| Build                     | `build`       | `npm run build > proofs/proof_build.txt 2>&1`          |
| {Additional verification} | `{recipe_id}` | `{command}`                                            |

**Verification tier**: T1 / T2 / T3 / T4 **Runtime proof required**: YES / NO

---

## 8. Proof Plan

| Artifact                    | When Collected               | Method               |
| --------------------------- | ---------------------------- | -------------------- |
| `proof_git_status.txt`      | After implementation         | `git status`         |
| `proof_typecheck.txt`       | After implementation         | `npm run type-check` |
| `proof_tests.txt`           | After implementation         | `npm run test`       |
| `sprint_changes.diff`       | After implementation         | `git diff`           |
| `SPRINT_CLOSEOUT_REPORT.md` | After all verification       | Written per template |
| {Runtime proof}             | {After runtime verification} | {Collection method}  |

---

## 9. Abort Conditions

The sprint will be aborted if any of the following occur:

- [ ] Truth source becomes unavailable during implementation.
- [ ] Implementation requires changing a forbidden file.
- [ ] A previously passing verification starts failing for unrelated reasons.
- [ ] Scope expands beyond what was planned without contract amendment.
- [ ] A deprecated path must be used as the implementation target.
- [ ] {Sprint-specific abort condition}.

---

## Plan Status: READY FOR APPROVAL / NEEDS AMENDMENT

**Architect recommendation**: Proceed / Amend / Abandon **Rationale**: {Why
proceed or why not}
