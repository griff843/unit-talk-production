# Proof Bundle Index: {SPRINT_ID}

**Sprint**: `{SPRINT-<NAME>-###}` **Date**: {YYYY-MM-DD} **Sprint Type**: {docs
/ runtime / build-fix / e2e-lifecycle / ui / schema} **Verification Tier**: {T1
/ T2 / T3 / T4} **Bundle Path**: `out/sprints/{SPRINT_ID}/{YYYY-MM-DD}/`

---

## 1. What Changed

### Summary

{2-3 sentence summary of what the sprint accomplished.}

### Files Modified

| File     | Change Type                | Description            |
| -------- | -------------------------- | ---------------------- |
| `{path}` | {modified/created/deleted} | {What changed and why} |
| `{path}` | {modified/created/deleted} | {What changed and why} |

### Scope Confirmation

- [ ] All changes are within sprint contract file boundaries.
- [ ] No forbidden files were modified.
- [ ] No deprecated paths were introduced as new dependencies.

---

## 2. Verification Summary

| Verification           | Recipe              | Result                | Evidence File                        |
| ---------------------- | ------------------- | --------------------- | ------------------------------------ |
| TypeScript compilation | `typecheck`         | PASS / FAIL           | `proofs/proof_typecheck.txt`         |
| Lint                   | `lint`              | PASS / FAIL / SKIPPED | `proofs/proof_lint.txt`              |
| Unit tests             | `unit_tests`        | PASS / FAIL / SKIPPED | `proofs/proof_tests.txt`             |
| Integration tests      | `integration_tests` | PASS / FAIL / SKIPPED | `proofs/proof_tests_integration.txt` |
| Build                  | `build`             | PASS / FAIL / SKIPPED | `proofs/proof_build.txt`             |
| Lifecycle gate         | `lifecycle_gate`    | PASS / FAIL / N/A     | `proofs/proof_gate.txt`              |
| Runtime smoke          | `runtime_smoke`     | PASS / FAIL / N/A     | `proofs/proof_runtime_smoke.txt`     |
| Schema guard           | `schema_guard`      | PASS / FAIL / N/A     | `proofs/proof_schema_guard.txt`      |
| Drift audit            | `drift_audit`       | PASS / FAIL / N/A     | `proofs/proof_drift_audit.txt`       |

### Verification Notes

{Any context about verification results — e.g., why a recipe was skipped, any
warnings observed, pre-existing issues.}

---

## 3. Runtime Evidence Summary

_If sprint contract declares runtime proof required, summarize the evidence
here. If runtime proof is not required, state "N/A — build-time sprint."_

| Evidence           | Collection Method | What It Demonstrates             | File                               |
| ------------------ | ----------------- | -------------------------------- | ---------------------------------- |
| {Database state}   | {SQL query}       | {Expected rows exist}            | `proofs/proof_runtime_db.txt`      |
| {API response}     | {curl command}    | {Endpoint returns expected data} | `proofs/proof_runtime_api.txt`     |
| {Discord delivery} | {Screenshot/API}  | {Embed renders correctly}        | `proofs/proof_runtime_discord.txt` |

---

## 4. Artifact Manifest

| Artifact                    | Status                  | Path                          |
| --------------------------- | ----------------------- | ----------------------------- |
| `proof_git_status.txt`      | PRESENT / MISSING       | `proofs/proof_git_status.txt` |
| `proof_typecheck.txt`       | PRESENT / MISSING       | `proofs/proof_typecheck.txt`  |
| `proof_tests.txt`           | PRESENT / MISSING / N/A | `proofs/proof_tests.txt`      |
| `proof_build.txt`           | PRESENT / MISSING / N/A | `proofs/proof_build.txt`      |
| `proof_gate.txt`            | PRESENT / MISSING / N/A | `proofs/proof_gate.txt`       |
| `proof_runtime_*.txt`       | PRESENT / MISSING / N/A | `proofs/proof_runtime_*.txt`  |
| `sprint_changes.diff`       | PRESENT / MISSING       | `diffs/sprint_changes.diff`   |
| `SPRINT_CLOSEOUT_REPORT.md` | PRESENT / MISSING       | `SPRINT_CLOSEOUT_REPORT.md`   |

### Completeness Check

- [ ] All required artifacts for sprint type `{type}` are PRESENT.
- [ ] All proof files are non-empty.
- [ ] All FAIL results have documented investigation.
- [ ] Diff reflects only in-scope changes.

---

## 5. Verdict Summary

**Verdict**: {PASS / PASS WITH LIMITATIONS / BLOCKED / FAIL}

**Rationale**: {Why this verdict — reference specific evidence.}

### If PASS WITH LIMITATIONS

| Limitation        | Impact                          | Tracked In                         |
| ----------------- | ------------------------------- | ---------------------------------- |
| {What is limited} | {Impact on sprint completeness} | {Linear issue or follow-up sprint} |

### If BLOCKED or FAIL

| Blocker            | Root Cause      | Required Action               |
| ------------------ | --------------- | ----------------------------- |
| {What is blocking} | {Why it blocks} | {What must happen to unblock} |

---

## 6. Known Limitations

{Honest assessment of what this sprint does NOT prove or does NOT address. This
section must be non-empty for any sprint that is not a clean PASS.}

- {Limitation 1}
- {Limitation 2}
- {None — all acceptance criteria fully met with strong evidence.}

---

## 7. Ratification Recommendation

**Recommendation**: RATIFY / DO NOT RATIFY / RATIFY WITH CONDITIONS

**Conditions** (if applicable):

- {Condition 1 — e.g., "Follow-up sprint required for X"}
- {Condition 2}

**PR ready**: YES / NO **Sprint tag**: `{SPRINT_ID}-COMPLETE`
