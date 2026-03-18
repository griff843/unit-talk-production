# Codex Execution Layer — Governance

**Authority**: Unit Talk Engineering | Claude OS §7 (verification commands)
**Updated**: 2026-03-18

---

## Agent Registry

| Agent                       | Wrapper           | Task File               | Purpose                                                              |
| --------------------------- | ----------------- | ----------------------- | -------------------------------------------------------------------- |
| Repo Scan                   | `run-readonly.sh` | `repo-scan-agent.md`    | Read-only diagnostic: error clusters, schema mismatches, route risks |
| Fix Executor                | `run-write.sh`    | `fix-executor.md`       | Bounded write: mechanical code fixes from a task-file spec           |
| Publish Visibility Verifier | `run-verify.sh`   | `publish-visibility.md` | Verify Discord publish path, outbox linkage, CC visibility           |

---

## When to Use Codex vs Claude

| Task                              | Codex | Claude |
| --------------------------------- | ----- | ------ |
| Scan repo for error clusters      | ✅    | —      |
| Mechanical code fix (exact spec)  | ✅    | —      |
| Post-change verification / report | ✅    | —      |
| Architecture decisions            | —     | ✅     |
| Sprint planning / sequencing      | —     | ✅     |
| Status doc updates                | —     | ✅     |
| Ambiguous implementation          | —     | ✅     |
| Cross-service design changes      | —     | ✅     |

**Rule of thumb**: If it requires judgment, it goes to Claude. If it's bounded
and mechanical, it goes to Codex.

---

## Routing Rules (Hard)

1. **Codex does not decide architecture.** Task files must specify exact scope.
2. **Codex does not update status docs** (`docs/status/`, `PHASE_STATUS.md`,
   etc.) unless explicitly tasked by Claude.
3. **Codex does not run unscoped repo edits.** Every write task must have a
   bounded file list in scope.
4. **Codex does not merge to main.** All Codex outputs are reviewed before
   commit.
5. **Claude shapes intent.** Claude OS verifies outputs. Codex executes bounded
   tasks only.
6. **Bounded-write tasks require human confirmation** (enforced by
   `run-write.sh` prompt gate).
7. **Incomplete task templates are rejected.** `run-write.sh` scans for
   `<FILL IN:` placeholders and blocks execution before any confirmation.
8. **MCP servers are suppressed.** The project `.codex/config.toml` overrides
   global MCP server entries (playwright, linear) with fail-fast values,
   preventing them from being available as tools during read-only/verify runs.
   Wrapper scripts filter residual startup-noise lines from stdout and redirect
   MCP transport errors (stderr) to a temp log. Note: `-c 'mcp_servers={}'` CLI
   flag does NOT suppress sub-table entries in the global config — the project
   config approach is required (verified on codex-cli 0.115.0).
9. **Claude skills are isolated from Codex.** `.agents/skills/*/SKILL.md`
   renamed to `SKILL_CLAUDE.md` to prevent Codex from attempting to load
   Claude-format skill files.

---

## Responsibility Split

| Area                             | Owner                                  |
| -------------------------------- | -------------------------------------- |
| Sprint planning and sequencing   | Claude                                 |
| Architecture and contract design | Claude                                 |
| Mechanical implementation tasks  | Codex                                  |
| Diagnostic repo scans            | Codex                                  |
| Post-implementation verification | Codex                                  |
| Status doc updates               | Claude                                 |
| Gate enforcement                 | Claude OS (`pnpm sprint:gate`)         |
| Proof artifact generation        | Claude (sprint:close)                  |
| LLM routing decision             | Claude OS (routing-decision-validator) |

---

## Claude OS Integration (Sprint Lifecycle)

Codex fits into the sprint lifecycle at these points:

```
Phase 0: Context
  → Claude reads repo state
  → Codex: repo-scan-agent (optional — run when error picture is unclear)

Phase 2: Implement
  → Claude implements (default for all non-trivial work)
  → Codex: fix-executor (for tightly scoped mechanical tasks only)

Phase 3: Verify
  → Claude OS runs gates (pnpm sprint:gate, pnpm type-check, etc.)
  → Codex: publish-visibility verifier (when Discord publish confidence is low)
  → Codex: repo-scan-agent (if new errors appear post-implementation)
```

**Trigger contract**:

- Claude decides when to invoke Codex
- Claude passes a task file path; Codex receives a bounded prompt
- Claude reviews Codex output before any commit or closeout

**Trigger layer live.** Codex agents are invoked by workflow moment via
`run-trigger.sh`. Read-only tasks auto-execute; write tasks require human
confirmation. See `TRIGGER_INTEGRATION.md` for the full integration spec and
`trigger-registry.sh` for the trigger map.

---

## Safety Checklist (Before Any Codex Run)

- [ ] Task file reviewed — scope and OUT OF SCOPE are explicit
- [ ] Mode confirmed (read-only / bounded-write / verify)
- [ ] For bounded-write: working tree is clean (`git status`)
- [ ] For bounded-write: task file lists exact files allowed to be modified
- [ ] Post-run: `git diff` reviewed before staging
