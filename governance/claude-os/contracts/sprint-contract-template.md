# Sprint Contract: {SPRINT_ID}

**Version**: 1.0.0 **Status**: DRAFT | RATIFIED | ACTIVE | CLOSED **Created**:
{YYYY-MM-DD} **Author**: {human or Claude OS phase}

---

## 1. Sprint Identity

| Field                      | Value                                                    |
| -------------------------- | -------------------------------------------------------- |
| **Sprint ID**              | `{SPRINT-<NAME>-###}`                                    |
| **Linear Issue**           | `{UNI-N}` (workflow reference, not truth)                |
| **Objective**              | {One sentence: what this sprint accomplishes}            |
| **Sprint Type**            | docs / runtime / build-fix / e2e-lifecycle / ui / schema |
| **Runtime Proof Required** | YES / NO                                                 |

---

## 2. Scope

### In-Scope

- {Specific deliverable 1}
- {Specific deliverable 2}
- {Specific deliverable 3}

### Out-of-Scope

- {Explicitly excluded item 1}
- {Explicitly excluded item 2}

### Boundary Rule

Only changes listed in "Files Allowed to Change" (Section 5) are permitted. Any
change outside this boundary requires sprint contract amendment and human
approval.

---

## 3. Preconditions

All preconditions must be TRUE before implementation begins. If any is FALSE,
execution halts (fail-closed).

| #   | Precondition                               | Verification Method     | Status         |
| --- | ------------------------------------------ | ----------------------- | -------------- | ------- |
| 1   | {Previous sprint X is complete and merged} | `git log --oneline      | grep SPRINT-X` | PENDING |
| 2   | {Required truth source exists}             | `test -f {path}`        | PENDING        |
| 3   | {Session baseline passes}                  | `pnpm session:baseline` | PENDING        |
| 4   | {Type check passes before starting}        | `npm run type-check`    | PENDING        |
| 5   | {Sprint gate passes}                       | `pnpm sprint:gate`      | PENDING        |

---

## 4. Truth Sources

These documents must be loaded and verified before implementation. See
`governance/claude-os/context/context-manifest.json` for loading rules.

| Source                     | Path                                  | Required |
| -------------------------- | ------------------------------------- | -------- |
| Execution Contract         | `CLAUDE_EXECUTION_CONTRACT.md`        | Always   |
| System Invariants          | `docs/SYSTEM_INVARIANTS.md`           | Always   |
| Claude OS Laws             | `governance/claude-os/SYSTEM_LAWS.md` | Always   |
| {Domain-specific contract} | `{path}`                              | {Yes/No} |
| {System current doc}       | `{path}`                              | {Yes/No} |
| {Additional truth source}  | `{path}`                              | {Yes/No} |

---

## 5. File Boundaries

### Files Allowed to Change

| File Path           | Change Type                | Justification                   |
| ------------------- | -------------------------- | ------------------------------- |
| `{path/to/file.ts}` | {create / modify / delete} | {Why this file needs to change} |
| `{path/to/file.ts}` | {create / modify / delete} | {Why this file needs to change} |

### Files Forbidden to Change

| File Path                              | Reason                                                                     |
| -------------------------------------- | -------------------------------------------------------------------------- |
| `CLAUDE_EXECUTION_CONTRACT.md`         | Hard law — never modified by sprint                                        |
| `docs/SYSTEM_INVARIANTS.md`            | System invariants — never modified by sprint                               |
| `apps/api/src/lib/lifecycle/*.ts`      | Lifecycle adapters — unless sprint is specifically about lifecycle changes |
| `supabase/migrations/*.sql` (existing) | Applied migrations are immutable                                           |
| {Additional forbidden files}           | {Reason}                                                                   |

---

## 6. Invariants Touched

List any system invariants that this sprint's changes interact with. Reference
`docs/SYSTEM_INVARIANTS.md`.

| Invariant                  | How This Sprint Interacts                         |
| -------------------------- | ------------------------------------------------- |
| {Single-writer discipline} | {e.g., "Adds new lifecycle adapter call"}         |
| {Idempotency}              | {e.g., "New atomic claim pattern for X"}          |
| {None}                     | {Sprint does not interact with system invariants} |

---

## 7. Verification Required

Define what must be verified and how. Reference
`governance/claude-os/recipes/verification-recipes.json` for recipe IDs.

| Verification           | Recipe ID           | Required | Evidence Type    |
| ---------------------- | ------------------- | -------- | ---------------- |
| TypeScript compilation | `typecheck`         | Yes      | Command output   |
| Lint                   | `lint`              | Yes      | Command output   |
| Unit tests             | `unit_tests`        | {Yes/No} | Command output   |
| Integration tests      | `integration_tests` | {Yes/No} | Command output   |
| Build                  | `build`             | {Yes/No} | Command output   |
| Lifecycle gate         | `schema_guard`      | {Yes/No} | Command output   |
| Runtime smoke test     | `runtime_smoke`     | {Yes/No} | Runtime evidence |
| {Custom verification}  | {custom}            | {Yes/No} | {Evidence type}  |

---

## 8. Runtime Proof Required

If "Runtime Proof Required" is YES, specify what runtime evidence must be
collected:

| Evidence                   | Collection Method     | What It Proves                            |
| -------------------------- | --------------------- | ----------------------------------------- |
| {Database state snapshot}  | {SQL query output}    | {Expected rows exist with correct values} |
| {API response}             | {curl/httpie command} | {Endpoint returns expected data}          |
| {Discord embed screenshot} | {Manual capture}      | {Embed renders correctly}                 |
| {N/A — build-time sprint}  | {N/A}                 | {N/A}                                     |

---

## 9. Artifact Output Path

```
out/sprints/{SPRINT_ID}/{YYYY-MM-DD}/
├── proofs/
│   ├── proof_git_status.txt
│   ├── proof_tests.txt
│   ├── proof_typecheck.txt
│   ├── proof_build.txt
│   ├── proof_gate.txt
│   └── {additional runtime proof files}
├── diffs/
│   └── sprint_changes.diff
├── notes/
│   └── {investigation or decision notes}
└── SPRINT_CLOSEOUT_REPORT.md
```

---

## 10. Acceptance Criteria

Sprint is accepted when ALL of the following are true:

- [ ] {Specific, testable criterion 1}
- [ ] {Specific, testable criterion 2}
- [ ] {Specific, testable criterion 3}
- [ ] All verification recipes pass with captured evidence.
- [ ] Proof bundle is complete per artifact contract.
- [ ] No files outside boundary were modified.
- [ ] No deprecated paths introduced as new dependencies.
- [ ] No silent fallbacks introduced.

---

## 11. Kill Conditions

Abort the sprint immediately if any of the following occur:

| #   | Condition                                                     | Action                               |
| --- | ------------------------------------------------------------- | ------------------------------------ |
| 1   | Truth source referenced in Section 4 is missing or unreadable | STOP — report missing truth          |
| 2   | Implementation requires changing a forbidden file             | STOP — request contract amendment    |
| 3   | Verification recipe fails and root cause is unclear           | STOP — investigate before proceeding |
| 4   | Deprecated path must be used as implementation target         | STOP — escalate to human             |
| 5   | Scope creep beyond in-scope items detected                    | STOP — evaluate and amend or defer   |
| 6   | {Sprint-specific kill condition}                              | {Action}                             |

---

## 12. Rollback / Reversibility

| Aspect                 | Reversibility                              |
| ---------------------- | ------------------------------------------ |
| Code changes           | Git revert of sprint commit                |
| Schema migrations      | {Documented rollback SQL / Not applicable} |
| Runtime config changes | {Revert config file / Not applicable}      |
| External side effects  | {None / Describe}                          |

---

## 13. Ratification Checklist

Before creating PR for human review:

- [ ] All acceptance criteria met (Section 10).
- [ ] All verification recipes passed with captured evidence.
- [ ] Proof bundle complete at canonical artifact path.
- [ ] Sprint closeout report written.
- [ ] No kill conditions triggered.
- [ ] Audit agent found no drift or boundary violations.
- [ ] PR created via `gh pr create` with sprint reference.
- [ ] Sprint tag prepared: `{SPRINT_ID}-COMPLETE`.

**PR is ready for human ratification.**
