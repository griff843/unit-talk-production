# CLAUDE OS — Artifact Contract

**Version**: 1.0.0 **Purpose**: Defines the proof bundle contract — what must
exist, where it must live, and what constitutes acceptable evidence before a
sprint can be ratified.

---

## 1. Canonical Output Structure

All sprint artifacts MUST be stored at:

```
out/sprints/<SPRINT_ID>/<YYYY-MM-DD>/
├── proofs/
│   ├── proof_git_status.txt          # REQUIRED — git status output
│   ├── proof_typecheck.txt           # REQUIRED — npm run type-check output
│   ├── proof_tests.txt               # REQUIRED (if tests exist for scope)
│   ├── proof_build.txt               # REQUIRED (if build applies to scope)
│   ├── proof_gate.txt                # REQUIRED (if lifecycle gate applies)
│   └── proof_runtime_*.txt           # REQUIRED (if runtime proof required)
├── diffs/
│   └── sprint_changes.diff           # REQUIRED — git diff of all sprint changes
├── notes/
│   └── *.md                          # OPTIONAL — investigation, decision notes
└── SPRINT_CLOSEOUT_REPORT.md         # REQUIRED — sprint summary and verdict
```

Artifacts stored at any other path do not count toward proof bundle
completeness.

---

## 2. Required Files

### Always Required

| File                          | Content                                       | Generation                                             |
| ----------------------------- | --------------------------------------------- | ------------------------------------------------------ |
| `proofs/proof_git_status.txt` | Output of `git status` at sprint completion   | `git status > proofs/proof_git_status.txt 2>&1`        |
| `proofs/proof_typecheck.txt`  | Output of `npm run type-check`                | `npm run type-check > proofs/proof_typecheck.txt 2>&1` |
| `diffs/sprint_changes.diff`   | Diff of all changes in the sprint             | `git diff > diffs/sprint_changes.diff`                 |
| `SPRINT_CLOSEOUT_REPORT.md`   | Sprint summary, verification results, verdict | Written per template                                   |

### Conditionally Required

| File                         | When Required                             | Condition                                       |
| ---------------------------- | ----------------------------------------- | ----------------------------------------------- |
| `proofs/proof_tests.txt`     | Sprint scope has testable code            | Tests exist for changed code paths              |
| `proofs/proof_build.txt`     | Sprint changes buildable code             | Any app or package code changes                 |
| `proofs/proof_gate.txt`      | Sprint touches unified_picks or lifecycle | Lifecycle single-writer gate applies            |
| `proofs/proof_runtime_*.txt` | Sprint requires runtime proof             | Sprint contract declares runtime proof required |

### Optional

| File                       | Purpose                                                   |
| -------------------------- | --------------------------------------------------------- |
| `notes/*.md`               | Investigation notes, decision records, planning artifacts |
| `proofs/proof_lint.txt`    | Lint output (recommended but not required)                |
| `proofs/screenshots/*.png` | Visual evidence for UI or Discord changes                 |

---

## 3. Naming Rules

| Rule                | Pattern                                         | Example                      |
| ------------------- | ----------------------------------------------- | ---------------------------- |
| Sprint directory    | `SPRINT-<NAME>-###`                             | `SPRINT-LIFECYCLE-FIX-045`   |
| Date directory      | `YYYY-MM-DD`                                    | `2026-03-08`                 |
| Proof files         | `proof_<category>.txt`                          | `proof_typecheck.txt`        |
| Runtime proof files | `proof_runtime_<description>.txt`               | `proof_runtime_db_state.txt` |
| Diff files          | `<scope>_changes.diff` or `sprint_changes.diff` | `sprint_changes.diff`        |
| Note files          | `<topic>.md`                                    | `investigation.md`           |
| Screenshots         | Descriptive name                                | `discord_embed_tier1.png`    |

---

## 4. What Constitutes Acceptable Proof

### Strong Proof (Acceptable)

| Category             | Evidence                                                           |
| -------------------- | ------------------------------------------------------------------ |
| **Command output**   | Full stdout+stderr captured to file, including exit status context |
| **Database state**   | SQL query output showing expected rows/values, with query visible  |
| **API response**     | Full HTTP response including status code and body                  |
| **Discord delivery** | Screenshot or Discord API response showing embed content           |
| **Git state**        | `git status`, `git log`, `git diff` outputs                        |
| **Runtime logs**     | Relevant log lines showing expected behavior                       |

### Weak Proof (Not Acceptable as Primary Evidence)

| Category                      | Why Weak                                        |
| ----------------------------- | ----------------------------------------------- |
| **Assertion without capture** | "It works" — cannot be reviewed                 |
| **Partial output**            | Truncated command output hides potential errors |
| **Mock/stub results only**    | Does not prove real system behavior             |
| **Screenshots of IDE**        | May not show full context                       |
| **Verbal confirmation**       | Not auditable                                   |

### Proof Honesty Requirements

Every proof bundle MUST:

1. **Report failures honestly.** If a test fails, the proof file shows the
   failure. Do not re-run until it passes without documenting the investigation.
2. **State limitations explicitly.** If runtime proof could not be collected
   (e.g., no access to production), state this in the closeout report.
3. **Not cherry-pick evidence.** Include full command output, not just the
   "passing" lines.
4. **Include timestamps.** Proof files should indicate when they were generated
   (implicit in file metadata or explicit in content).

---

## 5. Ratifiability Requirements

A sprint proof bundle is ratifiable when:

| #   | Requirement                                                             | Verification         |
| --- | ----------------------------------------------------------------------- | -------------------- |
| 1   | All required files exist at canonical path                              | File existence check |
| 2   | Proof files are non-empty                                               | File size > 0        |
| 3   | `proof_typecheck.txt` shows no errors (or errors are explained)         | Content check        |
| 4   | `proof_tests.txt` shows all tests passing (or failures are explained)   | Content check        |
| 5   | `proof_gate.txt` shows GATE PASSED (if applicable)                      | Content check        |
| 6   | `sprint_changes.diff` reflects only in-scope changes                    | Diff review          |
| 7   | `SPRINT_CLOSEOUT_REPORT.md` includes verdict                            | Content check        |
| 8   | Runtime proof files present (if sprint contract requires runtime proof) | File existence check |
| 9   | No unexplained failures in any proof file                               | Content review       |
| 10  | Closeout report honestly states any limitations                         | Content review       |

If any requirement is unmet, the proof bundle is NOT ratifiable. The sprint must
address the gap before PR creation.

---

## 6. Strong vs Weak Proof Examples

### Example: Strong Proof Bundle

```
SPRINT-FEED-AGENT-FIX-046/2026-03-08/
├── proofs/
│   ├── proof_git_status.txt          → Shows clean working tree
│   ├── proof_typecheck.txt           → 0 errors, full output
│   ├── proof_tests.txt               → 47 tests passed, full vitest output
│   ├── proof_build.txt               → API build success, full output
│   ├── proof_gate.txt                → GATE PASSED, 0 violations
│   └── proof_runtime_db_state.txt    → SQL query showing FeedAgent produced correct picks
├── diffs/
│   └── sprint_changes.diff           → 3 files changed, all within sprint boundary
└── SPRINT_CLOSEOUT_REPORT.md         → PASS verdict, no limitations
```

**Why strong**: Every required artifact present. All evidence is captured
command output. Runtime proof demonstrates actual behavior. Closeout report has
clear verdict.

### Example: Weak Proof Bundle

```
SPRINT-FEED-AGENT-FIX-046/2026-03-08/
├── proofs/
│   ├── proof_typecheck.txt           → 0 errors (but build proof missing)
│   └── proof_tests.txt               → "Tests pass" (only 1 line, no actual output)
└── SPRINT_CLOSEOUT_REPORT.md         → "Everything works, ready to merge"
```

**Why weak**: Missing git status, build proof, gate proof, and runtime proof.
Test evidence is an assertion, not captured output. Closeout report has no
structured verdict. Diff is missing entirely. This bundle is NOT ratifiable.

---

## 7. Proof Bundle Lifecycle

1. **Create directory structure** at sprint start.
2. **Populate proofs** as verification completes (do not wait until end).
3. **Generate diff** after implementation is complete.
4. **Write closeout report** after all verification passes.
5. **Review completeness** against this contract before declaring ratifiable.
6. **Bundle is immutable** after sprint ratification. Do not modify
   retroactively.
