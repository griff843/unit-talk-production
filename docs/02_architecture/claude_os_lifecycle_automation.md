# Claude OS Lifecycle Automation

**Sprint**: SPRINT-CLAUDE-OS-LIFECYCLE-AUTOMATION-HARDENING **Date**: 2026-03-14
**Authority**: `docs/02_architecture/claude_os_ceiling_blueprint.md`

---

## Overview

Claude OS provides a governed sprint execution pipeline. The **lifecycle
automation** layer extends that pipeline into the post-bundle phase: from proof
bundle ready → tag minted → Linear synced → status docs updated.

The key design principle is **observability without mutation**: Claude OS may
check, validate, and guide post-merge steps, but never auto-commit, auto-merge,
or auto-update shared state.

---

## Architecture: Lifecycle Check Layer

```
┌────────────────────────────────────────────────────────────┐
│                    Sprint Lifecycle                         │
│                                                            │
│  [planning] → [implementing] → [verifying] → [bundling]   │
│        ↑ managed by sprint-state.ts                        │
│                                         ↓                  │
│                              [bundle verdict: PASS]        │
│                                         ↓                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            lifecycle-checker.ts (NEW)                │  │
│  │                                                      │  │
│  │  proof_artifacts  → file existence + size check      │  │
│  │  bundle_verdict   → verdict.json PASS/FAIL           │  │
│  │  working_tree     → git status --porcelain           │  │
│  │  tag_on_remote    → git ls-remote origin refs/tags/  │  │
│  │  status_sync      → CURRENT_SYSTEM_STATUS.md grep    │  │
│  │                                                      │  │
│  │  → overall: COMPLETE | IN_PROGRESS | ACTION_REQUIRED │  │
│  │  → nextSteps[]: priority-ordered operator actions    │  │
│  └──────────────────────────────────────────────────────┘  │
│                              ↓                             │
│          [human: commit → PR → merge → tag mint]           │
│                              ↓                             │
│          [human: Linear sync + /status-sync]               │
│                              ↓                             │
│                    [SPRINT COMPLETE]                        │
└────────────────────────────────────────────────────────────┘
```

---

## Components

### `tools/claude-os/src/lifecycle-checker.ts`

**Purpose**: Single-function API for checking all post-bundle lifecycle gates.

**Public API**:

```typescript
function checkLifecycle(
  sprintId: string,
  options?: LifecycleCheckerOptions
): LifecycleCheckResult;
function resolveArtifactRoot(
  sprintId: string,
  dateOverride?: string
): string | null;
```

**Dimensions checked**: | Dimension | Method | Automatable? |
|-----------|--------|-------------| | `proof_artifacts` | File stat + size
check | ✅ Yes | | `bundle_verdict` | Load verdict.json | ✅ Yes | |
`working_tree` | `git status --porcelain` | ✅ Yes | | `tag_on_remote` |
`git ls-remote origin refs/tags/` | ✅ Yes | | `status_sync` | Grep
CURRENT_SYSTEM_STATUS.md | ✅ Yes |

**Side effects**: None. Read-only.

### CLI Command: `lifecycle-status`

```bash
npx tsx src/cli.ts lifecycle-status --sprint <SPRINT-ID>
  [--date <YYYY-MM-DD>]      # override artifact date
  [--skip-tag-check]          # skip network call for offline use
  [--json]                    # machine-readable output
```

**Exit codes**:

- `0` — COMPLETE, IN_PROGRESS, or UNKNOWN (no blocking action required)
- `1` — ACTION_REQUIRED (proof failures or bundle verdict FAIL)

---

## Automation Boundaries

### Safe (Claude OS runs automatically)

- Read proof artifact files
- Load bundle verdict JSON
- Run `git status --porcelain`
- Run `git ls-remote origin refs/tags/<SPRINT>`
- Read `CURRENT_SYSTEM_STATUS.md`
- Write `LifecycleCheckResult` to `out/` (gitignored)

### Requires Human Approval

- `git commit` — permanent history record
- `git push origin main` — shared remote state
- `gh pr create` / `gh pr merge` — governance gates
- Writing `governance/closeouts/<SPRINT>.md` — triggers CI tag mint
- Linear issue state changes — team-visible
- Edits to canonical status docs (`CURRENT_SYSTEM_STATUS.md`, etc.)

---

## Lifecycle State Model

```
bundled → committed → merged → tagged → linear_synced → status_synced
  ↑                                ↑
  managed by sprint-state.ts       managed by lifecycle-checker.ts
  (planning→bundling→closed)       (observes external state)
```

### State Definitions

| State           | Evidence                                                   |
| --------------- | ---------------------------------------------------------- |
| `bundled`       | `bundle_verdict = PASS` in lifecycle check                 |
| `committed`     | `working_tree = CLEAN`                                     |
| `merged`        | PR merged (inferred from `tag_on_remote` via CI)           |
| `tagged`        | `git ls-remote origin refs/tags/<SPRINT>` returns result   |
| `linear_synced` | `linear_check = CONFIRMED` (manual confirmation)           |
| `status_synced` | `CURRENT_SYSTEM_STATUS.md` Last Updated contains sprint ID |

---

## Integration Points

### From `/sprint-proof-bundle` skill

After Step 10 (Claude OS supervised-run), add:

```bash
npx tsx tools/claude-os/src/cli.ts lifecycle-status --sprint $SPRINT
```

This gives the operator a single-screen view of what's left to do.

### From `/status-sync` skill

After status sync completes, the `status_sync` dimension in `lifecycle-status`
will show PASS.

### From governed tag flow

After `governance/closeouts/<SPRINT>.md` is committed and CI runs,
`tag_on_remote` shows PASS.

---

## Design Decisions

### Why not auto-check Linear?

Linear MCP calls are session-scoped, not available in CLI scripts. The Linear
check dimension returns `UNKNOWN` as default with guidance on what to verify.
Future enhancement: add `--linear-issue-id <UNI-N>` flag that uses the Linear
API to check state.

### Why `status_sync` uses file grep (not date comparison)?

Date comparison would require knowing the sprint merge date, which isn't tracked
in the artifact root. A grep for the sprint ID in the `Last Updated` line is
deterministic and correctly identifies whether status sync ran for this specific
sprint.

### Why is overall `COMPLETE` gated on tag + status-sync but not Linear?

Linear sync is best-effort per Rule 06. The tag proves CI passed and main was
updated. Status sync proves the canonical truth docs are current. These two are
the minimum proof of sprint completion. Linear sync is important but its absence
should not block `COMPLETE`.

---

## References

- Automation boundaries:
  `out/sprints/SPRINT-CLAUDE-OS-LIFECYCLE-AUTOMATION-HARDENING/2026-03-14/AUTOMATION_BOUNDARIES.md`
- State model:
  `out/sprints/SPRINT-CLAUDE-OS-LIFECYCLE-AUTOMATION-HARDENING/2026-03-14/LIFECYCLE_STATE_MODEL.md`
- Implementation: `tools/claude-os/src/lifecycle-checker.ts`
- CLI: `tools/claude-os/src/cli.ts` → `commandLifecycleStatus()`
- Governed tag flow: `.claude/rules/` + `docs/CLAUDE_OS_GOVERNANCE_CONTRACT.md`
