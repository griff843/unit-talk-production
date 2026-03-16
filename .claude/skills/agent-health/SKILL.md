# Skill: Agent Health

## Purpose

Answer "what is the health of the AI operating layer right now?" from the
current repo state. Provides a structured operator-facing diagnostic of which AI
OS components are operational, stale, partial, or missing. Read-only — this
skill never modifies files.

**Portability class:** Adapter-Based (pattern reusable; sources are Unit
Talk-specific)

## Invocation

```
/agent-health
```

Or with focus area:

```
/agent-health --focus skills
/agent-health --focus docs
/agent-health --focus workflow
```

**Modes:**

- **(default)** Full operating-layer health summary
- **`--focus skills`** Skills layer only — what's operational vs. missing
- **`--focus docs`** AI docs alignment only — what's defined vs. operationalized
- **`--focus workflow`** Workflow coverage only — rules, hooks, conventions

---

## When to Use

Run `/agent-health` when:

- Beginning a new work session and want orientation before choosing a sprint
- After a sequence of AI OS enhancement changes (e.g., new skills added, docs
  updated)
- Preparing to run `/sprint-plan` and want a pre-planning health view
- Something feels drifted but you can't pinpoint where
- After a long gap between sessions
- After the AI doc layer has changed materially (new planning docs, readiness
  updates)

**Relationship to other skills:**

- `/system-status` answers "where does the _platform_ stand?" — subsystems,
  phases, drift, sprint queue
- `/agent-health` answers "where does the _AI operating layer_ stand?" — skills,
  docs, workflow conventions, automation coverage
- Run `/system-status` first if you need platform truth; run `/agent-health`
  first if you need AI OS layer truth

---

## Sources (read in this exact order)

| Order | Source                                                | What it answers                                         |
| ----- | ----------------------------------------------------- | ------------------------------------------------------- |
| 1     | `.claude/skills/` directory listing                   | Which skills exist as SKILL.md files                    |
| 2     | `.claude/rules/` directory listing + rule files       | Workflow enforcement coverage                           |
| 3     | `docs/ai/AI_ENHANCEMENT_REMAINING_WORK_MAP_v1.md`     | What AI OS work was planned and what's still unfinished |
| 4     | `docs/ai/AI_BOOTSTRAP_READINESS_CHECKLIST_v1.md`      | Current readiness state per AI OS layer                 |
| 5     | `docs/status/CURRENT_SYSTEM_STATUS.md`                | Platform status for cross-reference                     |
| 6     | `docs/status/DRIFT_REPORT.md`                         | Any AI-layer drift items                                |
| 7     | Most recent `out/sprints/*/SPRINT_CLOSEOUT_REPORT.md` | Last sprint — did it affect the AI layer?               |

Optional sources (check if freshness is in question):

- `docs/ai/AI_PORTABLE_CORE_INVENTORY_v1.md` — portability classification state
- `docs/ai/AI_PROJECT_ADAPTER_UNIT_TALK_v1.md` — Unit Talk adapter state
- `tools/claude-os/src/` directory listing — TypeScript automation tools
  available

---

## Procedure

### Step 1: Inventory the Skills Layer

```bash
ls .claude/skills/
```

For each directory found, check whether a `SKILL.md` exists:

```bash
ls .claude/skills/*/SKILL.md 2>/dev/null
```

Classify each skill as:

| Status               | Meaning                                               |
| -------------------- | ----------------------------------------------------- |
| **OPERATIONAL**      | `SKILL.md` exists and is non-empty                    |
| **EMPTY**            | Directory exists but no `SKILL.md` (placeholder only) |
| **EXPECTED-MISSING** | In the Wave 2 plan or AI docs but not yet created     |

Cross-reference against `AI_ENHANCEMENT_REMAINING_WORK_MAP_v1.md` and
`AI_SKILL_WAVE_2_PLAN_v1.md` (if present) to identify skills that were planned
but not yet built.

### Step 2: Inventory the Rules Layer

```bash
ls .claude/rules/
```

Read the rule files and assess coverage of the core workflow spine:

| Gate                      | Rule That Covers It                   | Status            |
| ------------------------- | ------------------------------------- | ----------------- |
| Phase flow enforcement    | `00-workflow.md`                      | Present / Missing |
| Proof discipline          | `01-safety-and-proof.md`              | Present / Missing |
| DB migration safety       | `02-db-migrations.md`                 | Present / Missing |
| Single-writer enforcement | `03-single-writer-and-idempotency.md` | Present / Missing |
| Testing/verification      | `04-testing-and-verification.md`      | Present / Missing |
| Output format standards   | `05-output-formats.md`                | Present / Missing |
| Linear MCP discipline     | `06-linear-mcp-discipline.md`         | Present / Missing |
| Lane model                | `07-lane-model.md`                    | Present / Missing |

### Step 3: Read the AI Enhancement Work Map

```bash
cat docs/ai/AI_ENHANCEMENT_REMAINING_WORK_MAP_v1.md
```

Extract:

- What was listed as "remaining work" in the map
- Which items are still marked as "not yet built" or "defined only"
- Whether the work map is still current or has been superseded by actual
  implementations

### Step 4: Read the Bootstrap Readiness Checklist

```bash
cat docs/ai/AI_BOOTSTRAP_READINESS_CHECKLIST_v1.md
```

Extract the current readiness verdict for each layer:

- helpers: Defined / Ready for implementation / Partially operational /
  Operational
- hooks: Defined / Ready for implementation / Partially operational /
  Operational
- skills: Defined / Ready for implementation / Partially operational /
  Operational
- portability: Defined / Needs ratification / Operational

Note whether the checklist is stale (does not reflect skills built after it was
written).

### Step 5: Check for AI-Layer Drift Items

```bash
grep -i "ai\|claude\|skill\|helper\|hook\|agent" docs/status/DRIFT_REPORT.md
```

Flag any CRITICAL or HIGH drift items that affect the AI operating layer.

### Step 6: Cross-Reference with Last Sprint

Find most recent sprint closeout:

```bash
ls -t out/sprints/*/*/SPRINT_CLOSEOUT_REPORT.md 2>/dev/null | head -1
```

Read it. Determine whether the last sprint changed the AI layer and whether that
change is reflected in the readiness checklist / work map.

### Step 7: Assess Automation Tool Coverage

```bash
ls tools/claude-os/src/*.ts 2>/dev/null
```

Note which automation tools exist as TypeScript CLI utilities (these are the
mechanical backend layer — distinct from interactive SKILL.md procedures). These
cover the automation side; skills cover the interactive operator procedure side.

### Step 8: Generate Output

Use the output format below.

---

## Output Format

```markdown
# AI Operating Layer — Health Report

**As of**: <YYYY-MM-DD> | **AI Layer Status**: HEALTHY | PARTIAL | DEGRADED |
INCOMPLETE

---

## Skills Layer

| Skill  | Status            | Notes                                       |
| ------ | ----------------- | ------------------------------------------- |
| <name> | OPERATIONAL       | <one-line note>                             |
| <name> | EMPTY PLACEHOLDER | No SKILL.md — spec exists but not built     |
| <name> | EXPECTED-MISSING  | Planned in Wave 2 / AI docs but not created |

**Summary**: <N> operational, <N> empty placeholders, <N> expected-missing

---

## Rules / Workflow Enforcement Layer

| Gate             | Status  | Covered By                           |
| ---------------- | ------- | ------------------------------------ |
| Phase flow       | PRESENT | .claude/rules/00-workflow.md         |
| Proof discipline | PRESENT | .claude/rules/01-safety-and-proof.md |
| ...              | ...     | ...                                  |

**Summary**: <N>/8 core rules present

---

## AI Docs Alignment

| Doc                                     | State                                         | Notes  |
| --------------------------------------- | --------------------------------------------- | ------ |
| AI_ENHANCEMENT_REMAINING_WORK_MAP_v1.md | Current / Stale                               | <note> |
| AI_BOOTSTRAP_READINESS_CHECKLIST_v1.md  | Current / Stale                               | <note> |
| AI_SKILL_WAVE_2_PLAN_v1.md              | Defined / Partially Operational / Operational | <note> |

**Readiness per layer (from checklist):**

- Skills: <Defined / Ready / Partial / Operational>
- Helpers/Agents: <status>
- Hooks/Automation: <status>
- Portability: <status>

---

## Automation Tools (tools/claude-os/src/)

<N> TypeScript CLI modules present:

- <name>: <one-line purpose>
- ...

---

## AI-Layer Drift Items

<list from DRIFT_REPORT.md, or "None found">

---

## Gaps and Stale Areas

1. <gap or stale area — one line each>
2. ...

---

## Next Action

<one-sentence highest-priority recommendation>

**Follow-on:**

- If skills are missing → run `/sprint-plan` targeting the missing skill sprint
- If docs are stale → update `AI_BOOTSTRAP_READINESS_CHECKLIST_v1.md` after next
  operationalization
- If no gaps → proceed with `/sprint-plan` from queue
```

---

## Failure Protocol

| Failure                                                                       | Action                                                     |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `docs/ai/` directory missing                                                  | HALT — AI doc layer absent; cannot assess                  |
| `.claude/skills/` directory missing                                           | HALT — skills layer absent                                 |
| All AI docs stale (no recent sprint touching AI layer)                        | Flag as DEGRADED; recommend AI-layer reconciliation sprint |
| Work map lists items as not-built but skills directory shows them operational | Flag discrepancy — work map needs update                   |
| Bootstrap readiness checklist does not reflect current state                  | Note staleness; do not treat checklist as current truth    |

---

## Non-Goals

This skill does NOT:

- Check runtime health of agents, Discord, scoring, or the platform (use
  `/system-status`)
- Modify any AI docs, status docs, or rule files
- Make decisions about what to implement next (use `/sprint-plan` for that)
- Replace a full architecture audit (use the arch-audit skill when it exists)
- Claim completeness for items it cannot directly verify in the repo

---

## Integration with Claude OS

| This skill uses                                   | Purpose                                                          |
| ------------------------------------------------- | ---------------------------------------------------------------- |
| `/system-status`                                  | Platform-level complement — run before or after for full context |
| `/sprint-plan`                                    | Natural follow-on if gaps are found                              |
| `docs/ai/AI_ENHANCEMENT_REMAINING_WORK_MAP_v1.md` | Governing roadmap for AI OS work                                 |
| `tools/claude-os/src/`                            | Automation tools that sit alongside skills                       |
| `.claude/rules/00-workflow.md`                    | Workflow enforcement baseline                                    |

---

## Notes

- This skill reads only — it never writes to docs, code, or Linear
- Do not claim a skill is "operational" unless a non-empty `SKILL.md` exists
- Do not claim a hook is "covered" unless a rule file, skill step, or automation
  explicitly provides that coverage
- The AI Bootstrap Readiness Checklist may be stale — cross-reference actual
  skill files before trusting its readiness states
- Prefer underclaiming to overclaiming: PARTIAL is safer than OPERATIONAL when
  evidence is ambiguous
