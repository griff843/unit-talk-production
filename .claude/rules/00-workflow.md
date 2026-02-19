# Rule 00: Workflow

> Reference: `CLAUDE_EXECUTION_CONTRACT.md` Section IV

## Sprint Workflow

All significant work follows the sprint protocol:

### Phase Flow

```
Phase 0: Context    → Understand scope, read files
Phase 1: Plan       → Document approach (NO code changes)
Phase 2: Implement  → Smallest working change set
Phase 3: Verify     → Run tests, gates, checks
Phase 4: Proof      → Generate proof artifacts
Phase 5: Commit+Tag → ⚠️ MANDATORY: git commit + git tag
Phase 6: Closeout   → Write closeout report + merge to main
```

### ⚠️ HARD RULE: Commit + Tag + Merge

**A sprint is NOT complete until:**
1. Changes are committed with sprint reference
2. Sprint tag is created (`SPRINT-<NAME>-###-COMPLETE`)
3. Merged to main (fast-forward preferred)
4. Working tree is clean

**Skip this = Sprint incomplete = Must be done before next sprint.**

### Sprint Naming

```
Pattern: SPRINT-<NAME>-###
```

Examples:
- `SPRINT-LIFECYCLE-MIGRATION-038`
- `SPRINT-POSTING-FIX-039`
- `SPRINT-SETTLEMENT-AUDIT-040`

### Proof Location

```
out/sprints/<SPRINT>/<YYYY-MM-DD>/
├── proofs/
├── diffs/
├── notes/
└── SPRINT_CLOSEOUT_REPORT.md
```

## Task Tracking

Use TodoWrite tool to track progress:
- Mark tasks `in_progress` before starting
- Mark tasks `completed` immediately after finishing
- Never batch completions

## Stop Conditions

**STOP and ask if:**
1. Phase prerequisites not met
2. Unclear requirements
3. Blocking issue encountered
4. Tests fail unexpectedly

## First-Try Correctness

Minimize back-and-forth by:
1. Reading all relevant context before implementing
2. Planning the full change set before coding
3. Running verification before claiming done
4. Generating proofs before closeout
