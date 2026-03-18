# Codex Hardening Audit Report

**Sprint**: SPRINT-CODEX-HARDENING-001 **Date**: 2026-03-18 **Status**: COMPLETE

---

## Findings and Fixes

### Finding 1: Claude Skill YAML Frontmatter Errors

**Root cause**: Codex auto-discovers `.agents/skills/*/SKILL.md` files in the
project root. Five Claude-format skill files existed there without YAML
frontmatter, producing `codex_core::codex: failed to load skill` errors on every
run.

**Affected files**:

- `.agents/skills/linear-sync/SKILL.md`
- `.agents/skills/sprint-plan/SKILL.md`
- `.agents/skills/sprint-proof-bundle/SKILL.md`
- `.agents/skills/status-sync/SKILL.md`
- `.agents/skills/system-status/SKILL.md`

**Fix**: Renamed all five files from `SKILL.md` to `SKILL_CLAUDE.md`. Codex only
scans for `SKILL.md` -- renaming prevents discovery without modifying file
content. The Claude Code system uses `.claude/skills/` (a separate directory)
and is unaffected.

**Why not other approaches**:

- Adding YAML frontmatter would blur Claude and Codex skill systems
- No Codex config key exists to disable project-level skill discovery
- No `.codexignore` or `skills_path` override is available in Codex v0.115.0

---

### Finding 2: Unnecessary MCP Server Startup

**Root cause**: `~/.codex/config.toml` defines two global MCP servers:

```toml
[mcp_servers.playwright]
args = ["@playwright/mcp@latest"]
command = "npx"

[mcp_servers.linear]
url = "https://mcp.linear.app/mcp"
```

Both start for every `codex exec` call, regardless of task type. Playwright
frequently times out (10-second startup timeout), adding noise and delay.

**Fix**: All three Codex wrappers now pass `-c 'mcp_servers={}'` to
`codex exec`, overriding the global MCP config with an empty table for the
duration of the wrapper run. This is the documented Codex config override
mechanism.

**Scope**: Only affects wrapper-invoked runs. Interactive `codex` sessions
retain global MCP servers as configured by the user.

---

### Finding 3: Incomplete Task Template Execution

**Root cause**: `run-write.sh` had a human confirmation gate but no validation
that the task file was actually complete. The `fix-executor.md` template
contains `<FILL IN: ...>` placeholders that must be filled before execution.

**Fix**: Added a `validate_task_completeness` check in `run-write.sh` that runs
BEFORE the confirmation prompt:

- Scans for `<FILL IN:` markers (grep -c)
- Scans for `<!-- Fill in` HTML comment markers
- If any are found: prints the offending lines and exits 1
- If none found: proceeds to confirmation gate

**Coverage**: Catches both the explicit placeholder syntax (`<FILL IN: ...>`)
and the HTML comment form (`<!-- Fill in ... -->`).

---

### Finding 4: Smart Quote Encoding in Wrapper Scripts

**Root cause**: Original wrapper files contained Unicode typographic quotes
(left/right double quotation marks, U+201C/U+201D) instead of ASCII double
quotes. These characters are invisible in most editors but cause bash to
misparse arguments and fail with syntax errors.

**Fix**: Rewrote all three wrapper scripts (`run-readonly.sh`, `run-write.sh`,
`run-verify.sh`) with clean ASCII encoding. Replaced em dashes with `--` in
comments for portability.

---

## Verification Results

| Test                                                        | Result                                             |
| ----------------------------------------------------------- | -------------------------------------------------- |
| Template rejection (unfilled fix-executor.md)               | PASS -- 5 placeholders detected, execution blocked |
| Template rejection via trigger (implementation-start + yes) | PASS -- blocked after trigger confirmation         |
| diagnosis-start auto trigger                                | PASS -- routes to run-readonly.sh, clean output    |
| visibility-check auto trigger                               | PASS -- routes to run-verify.sh, clean output      |
| implementation-start manual-confirm                         | PASS -- prompts correctly                          |
| Invalid trigger name                                        | PASS -- fails closed with known-moments list       |
| --list trigger registry                                     | PASS -- all 5 moments displayed                    |
| SKILL.md files removed from discovery                       | PASS -- 0 SKILL.md, 5 SKILL_CLAUDE.md              |

**Note**: Full Codex execution could not be verified (OpenAI usage credits
exhausted). The `-c 'mcp_servers={}'` config override and skill rename will be
validated on next Codex run when credits return.

---

## Files Changed

| File                                | Change                                                                              |
| ----------------------------------- | ----------------------------------------------------------------------------------- |
| `scripts/codex/run-readonly.sh`     | Rewrote with ASCII encoding; added `-c 'mcp_servers={}'`                            |
| `scripts/codex/run-write.sh`        | Rewrote with ASCII encoding; added template validation; added `-c 'mcp_servers={}'` |
| `scripts/codex/run-verify.sh`       | Rewrote with ASCII encoding; added `-c 'mcp_servers={}'`                            |
| `scripts/codex/CODEX_GOVERNANCE.md` | Added rules 7-9 (template rejection, MCP isolation, skill isolation)                |
| `.agents/skills/*/SKILL.md`         | Renamed to `SKILL_CLAUDE.md` (5 files)                                              |

---

## Remaining Limitations

1. **MCP override is untested under live Codex execution** -- the
   `-c 'mcp_servers={}'` syntax is documented but could not be verified with
   credits exhausted
2. **Skill isolation relies on filename convention** -- if Codex changes its
   discovery pattern in a future version, the rename approach may need updating
3. **No Codex-specific skills exist yet** -- the `.agents/skills/` directory has
   no functional Codex skills, only Claude skills that are now isolated
