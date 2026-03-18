# Codex Audit Orchestration Spec

**Status**: VERIFIED — SPRINT-CODEX-AUDIT-CRITICAL-ORCHESTRATION-HARDENING
**Last Updated**: 2026-03-18 **Authority**: Supplemental to
`scripts/codex/CODEX_GOVERNANCE.md`

This document records the verified runtime behavior of the Codex execution layer
as tested against codex-cli 0.115.0. It is the authoritative reference for how
to invoke Codex cleanly in an audit context.

---

## Verified Trigger Runs

Both audit-critical triggers have been run and validated clean:

### `diagnosis-start` — Repo Scan Agent

```
bash scripts/codex/run-trigger.sh diagnosis-start
```

- **Wrapper**: `run-readonly.sh` (sandbox: read-only)
- **Task**: `sprint_tasks/codex/repo-scan-agent.md`
- **Type**: auto (no confirmation required)
- **MCP noise**: suppressed — no startup lines in output
- **Output**: structured diagnostic report (5 TS error clusters, 5 schema
  mismatches, 5 route risks, lifecycle-critical files, recommended tasks)
- **Files modified**: zero

### `visibility-check` — Publish Visibility Verifier

```
bash scripts/codex/run-trigger.sh visibility-check
```

- **Wrapper**: `run-verify.sh` (sandbox: read-only)
- **Task**: `sprint_tasks/codex/publish-visibility.md`
- **Type**: auto (no confirmation required)
- **MCP noise**: suppressed — no startup lines in output
- **Output**: structured visibility confidence report (submit path, Discord post
  path, embed build, CC visibility, gaps, operator confidence scores)
- **Files modified**: zero

---

## MCP Suppression — How It Works

**Problem**: codex-cli reads `~/.codex/config.toml` which contains global MCP
server entries (`playwright`, `linear`). The `-c 'mcp_servers={}'` CLI flag does
NOT suppress these sub-table entries — it is ineffective.

**Solution** (verified on codex-cli 0.115.0):

1. **Project-level `.codex/config.toml`** overrides each server with fail-fast
   values, preventing them from becoming available as tools:
   - `playwright`: `command = "false"` — exits immediately, handshake fails
   - `linear`: `url = "http://127.0.0.1:1"` — connection refused, no tool

2. **Wrapper stdout filtering** removes known MCP startup-noise lines using
   `sed -E '/^mcp: /d; /^mcp startup:/d'`

3. **Stderr redirection** captures MCP transport error messages to a temp log,
   keeping the main output channel clean for the structured report.

**Result**: all MCP startup lines (`mcp: X starting`, `mcp: X ready/failed`,
`mcp startup: ...`) are absent from the output seen by the operator.

---

## Safety Invariants — Preserved

| Invariant                                       | Status                                       |
| ----------------------------------------------- | -------------------------------------------- |
| Unknown triggers fail closed                    | ✅ verified (run-trigger.sh line 74–80)      |
| Write tasks require confirmation                | ✅ preserved in run-write.sh                 |
| Bounded-write placeholders rejected             | ✅ preserved in run-write.sh                 |
| MCP tools not available during read/verify runs | ✅ fail-fast project config                  |
| No hidden write enablement                      | ✅ sandbox `read-only` enforced by codex CLI |
| Auto trigger on write wrapper blocked           | ✅ safety check in run-trigger.sh line 114   |

---

## Audit Trigger Map

| Moment                       | Type           | Wrapper      | Purpose                                              |
| ---------------------------- | -------------- | ------------ | ---------------------------------------------------- |
| `diagnosis-start`            | auto           | run-readonly | Repo scan: TS errors, schema mismatches, route risks |
| `visibility-check`           | auto           | run-verify   | Discord publish path + CC visibility confidence      |
| `post-implementation-verify` | auto           | run-verify   | Post-change verification of publish visibility chain |
| `sprint-closeout-support`    | auto           | run-readonly | Final scan before closeout                           |
| `implementation-start`       | manual-confirm | run-write    | Bounded write from fully-specified task file         |

---

## Limitations — Residual Debt

The following are non-blocking known limitations for this sprint:

1. **`status = "disabled"` in config.toml is not respected** — The project
   config cannot mark a server as disabled; it can only override field values.
   The fail-fast approach is the workaround.

2. **Codex is not fully autonomous** — Trigger runs are operator-initiated.
   Claude shapes intent and reviews all outputs before commit. Codex executes
   bounded, verified tasks only.

3. **`--output-last-message` approach not used** — The current wrappers filter
   stdout inline. This is simpler and works for the audit use case. If cleaner
   separation is needed in the future, `--output-last-message <file>` can
   capture just the final agent message to a file.
