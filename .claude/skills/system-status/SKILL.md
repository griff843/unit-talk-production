# Skill: System Status

## Purpose

Answer "where does Unit Talk stand right now?" from the canonical truth layer.
Returns a concise, evidence-backed platform status snapshot. Read-only — this
skill never modifies files.

## Invocation

```
/system-status
```

Or with mode:

```
/system-status --audit
```

Modes:

- **(default)** Concise operator summary — fits in one screen
- **`--audit`** Full audit summary — expanded detail on every subsystem, phase,
  drift item

---

## Sources (read in this exact order)

| Order | File                                                  | What it answers                                                                     |
| ----- | ----------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1     | `docs/status/CURRENT_SYSTEM_STATUS.md`                | Subsystem status, infrastructure health, agent compliance                           |
| 2     | `docs/06_status/current_phase.md`                     | **Canonical active Layer/Phase position** — read BEFORE PHASE_STATUS.md             |
| 3     | `docs/status/PHASE_STATUS.md`                         | Phase completion %, milestones, blocking gaps (operational phase naming — see note) |
| 4     | `docs/status/NEXT_5_SPRINTS.md`                       | Sprint queue, priorities, dependencies                                              |
| 5     | `docs/status/DRIFT_REPORT.md`                         | Active drift by severity, drift trend                                               |
| 6     | `docs/04_roadmap/layer_phase_execution_model.md`      | Canonical layer/phase model — use for sprint classification                         |
| 7     | Most recent `out/sprints/*/SPRINT_CLOSEOUT_REPORT.md` | Last completed sprint, what it changed                                              |

> **Phase naming note**: `docs/status/PHASE_STATUS.md` uses the pre-2026-03-13
> operational phase naming (Phase 1 — Structural Dominance, Phase 2 —
> Intelligence Superiority, etc.). This is distinct from the canonical execution
> model phases (Phase 0–14 across Layers 1–4) in
> `docs/04_roadmap/layer_phase_execution_model.md`. For sprint classification,
> always use the canonical model. For progress tracking, use PHASE_STATUS.md.

If any of sources 1–4 are missing, **HALT** — the truth layer is incomplete.
Source 5 is the canonical execution model authority; source 6 is optional.

---

## Procedure

### Step 1: Read Canonical Sources

```bash
cat docs/status/CURRENT_SYSTEM_STATUS.md
cat docs/06_status/current_phase.md
cat docs/status/PHASE_STATUS.md
cat docs/status/NEXT_5_SPRINTS.md
cat docs/status/DRIFT_REPORT.md
```

Read all five completely before producing any output.

### Step 2: Check Freshness

Extract the `Last Updated` timestamp from each doc:

```bash
grep "Last Updated" docs/status/CURRENT_SYSTEM_STATUS.md
grep "Last Updated" docs/status/NEXT_5_SPRINTS.md
```

Apply freshness rules per `FRESHNESS_RULES.md`:

| Condition                           | Assessment                                                 |
| ----------------------------------- | ---------------------------------------------------------- |
| All docs updated within last 7 days | **FRESH** — proceed normally                               |
| Any doc updated 8–14 days ago       | **AGING** — note in output, recommend `/status-sync`       |
| Any doc updated > 14 days ago       | **STALE** — halt and require `/status-sync` or truth audit |

Also check for unsynced sprints:

```bash
# Find most recent sprint closeout
ls -t out/sprints/*/*/SPRINT_CLOSEOUT_REPORT.md 2>/dev/null | head -1
```

If the most recent closeout's date is AFTER the `Last Updated` timestamp in
`CURRENT_SYSTEM_STATUS.md`, there is an **unsynced sprint**. Flag it.

### Step 3: Extract Current Phase

First, read `docs/06_status/current_phase.md` and record the **canonical active
Layer/Phase**:

```
Current active work: Layer N / Phase M — <Name>
```

This is the PRIMARY classification for sprint planning and output. Record it as:
`Canonical position: Layer N / Phase M — <Name>`

Then, from `PHASE_STATUS.md`, extract the **operational context**:

- Which phases are Active (operational names)
- Current completion % for each Active phase
- The overall platform phase label (e.g., "Transitioning Phase 1 → Phase 2")

These percentages are tracking context only — they do not override the canonical
position.

### Step 4: Extract Subsystem Health

From `CURRENT_SYSTEM_STATUS.md`, build the subsystem summary:

- Count subsystems by status: VERIFIED / PARTIAL / BROKEN / UNVERIFIED / ASSUMED
- Identify subsystems that are BROKEN (always report these)
- Identify infrastructure health rows that are not PASS/CLEAN

### Step 5: Extract Active Blockers

Blockers come from two places:

1. `DRIFT_REPORT.md` — CRITICAL items are blockers
2. `CURRENT_SYSTEM_STATUS.md` — "Blocking Issues" column for PARTIAL/BROKEN
   subsystems

Merge and deduplicate. Rank by severity: CRITICAL first, then HIGH.

### Step 6: Extract Sprint Queue

From `NEXT_5_SPRINTS.md`, extract:

- Sprint 1 (next up) — name, priority, goal
- Active sprint — check if a sprint branch exists:
  ```bash
  git branch --show-current
  ```
  If the current branch starts with `sprint/`, this is the active sprint.
- Sprint 2–5 summary (names and priorities)

### Step 7: Assess Drift Trend

From `DRIFT_REPORT.md`:

- Count items by severity: CRITICAL / HIGH / MEDIUM / LOW
- Compare to the Resolved section (if it exists) — are items being resolved or
  accumulating?
- Determine trend: **DECREASING** (items being resolved), **STABLE** (no
  change), **INCREASING** (new items appearing)

If no Resolved section exists and CRITICAL count > 0, trend is **INCREASING**
(assumed).

### Step 8: Generate Output

Use the appropriate output format:

- **Default** → Concise Operator Format (see below)
- **`--audit`** → Audit Summary Format (see below)

### Step 9: Recommend Next Action

Based on what the status shows:

| Condition                             | Recommendation                                  |
| ------------------------------------- | ----------------------------------------------- |
| Status docs STALE                     | Run `/status-sync <LAST-SPRINT>`                |
| Sprint just completed, no status sync | Run `/status-sync <SPRINT>`                     |
| No active sprint, status fresh        | Run `/sprint-plan` to select next sprint        |
| Active sprint in progress             | Continue implementation                         |
| 3+ CRITICAL drift items               | Consider truth audit sprint before next feature |
| All clear, no blockers                | Proceed with Sprint 1 from queue                |

---

## Output: Concise Operator Format (default)

```markdown
# Unit Talk — System Status

**As of**: <YYYY-MM-DD> | **Freshness**: FRESH | AGING | STALE **Layer/Phase**:
Layer N / Phase M — <Canonical Name> | Operational: <PHASE_STATUS nickname>
(<X>%) **Active Sprint**: <branch name> | none **Next Sprint**: <SPRINT-NAME>
(P0/P1)

## Subsystem Health

VERIFIED: N | PARTIAL: N | BROKEN: N | UNVERIFIED: N

**Broken/Blocked**:

- <subsystem>: <one-line reason>
- <subsystem>: <one-line reason>

## Top Blockers

1. <DRIFT-ID>: <description> (CRITICAL)
2. <DRIFT-ID>: <description> (HIGH)

## Sprint Queue

1. <SPRINT-NAME> — P0 — <goal>
2. <SPRINT-NAME> — P1 — <goal>
3. <SPRINT-NAME> — P1 — <goal>
4. <SPRINT-NAME> — P1 — <goal>
5. <SPRINT-NAME> — P1 — <goal>

## Drift

CRITICAL: N | HIGH: N | MEDIUM: N | LOW: N | Total: N Trend: DECREASING | STABLE
| INCREASING

## Next Action

<one-sentence recommendation>
```

---

## Output: Audit Summary Format (`--audit`)

```markdown
# Unit Talk — System Status (Audit)

**As of**: <YYYY-MM-DD> | **Freshness**: <assessment> **Source docs**:
CURRENT_SYSTEM_STATUS.md (<date>), PHASE_STATUS.md (<date>), NEXT_5_SPRINTS.md
(<date>), DRIFT_REPORT.md (<date>) **Last synced sprint**: <SPRINT-NAME>
(<date>)

---

## Phase Status

> Phase names and percentages come from `docs/status/PHASE_STATUS.md`
> (operational tracking). Sprint classification uses the canonical Layer/Phase
> model from `docs/04_roadmap/layer_phase_execution_model.md`.

| Phase (Operational Name)           | Status   | Completion | Blocking Issues |
| ---------------------------------- | -------- | ---------- | --------------- |
| <Phase N — Name from PHASE_STATUS> | <status> | <X>%       | <issues>        |

**Current Platform Phase**: <summary from PHASE_STATUS.md>

**Canonical Layer/Phase classification** (for sprint planning): <active layer,
e.g., "Layer 1 / Phase 4 — Operational Determinism" — from
layer_phase_execution_model.md>

---

## Subsystem Health

| Subsystem | Status | Blocking Issues |
| --------- | ------ | --------------- |

<full table from CURRENT_SYSTEM_STATUS.md>

### Infrastructure

| Component | Status | Notes |
| --------- | ------ | ----- |

<full infrastructure table from CURRENT_SYSTEM_STATUS.md>

---

## Agent Compliance

| Agent | Lifecycle Compliant | Notes |
| ----- | ------------------- | ----- |

<full agent table from CURRENT_SYSTEM_STATUS.md>

---

## Drift Report

### CRITICAL (<N>)

<full listing of CRITICAL items>

### HIGH (<N>)

<full listing of HIGH items>

### MEDIUM (<N>)

<full listing of MEDIUM items>

### LOW (<N>)

<full listing of LOW items>

**Trend**: <DECREASING | STABLE | INCREASING> **Resolved since last audit**: <N>
items

---

## Sprint Queue

<full Sprint 1–5 listing from NEXT_5_SPRINTS.md with tasks and success criteria>

**Dependency chain**: <chain description>

---

## Freshness Analysis

| Doc                      | Last Updated | Age      | Status            |
| ------------------------ | ------------ | -------- | ----------------- |
| CURRENT_SYSTEM_STATUS.md | <date>       | <N days> | FRESH/AGING/STALE |
| PHASE_STATUS.md          | <date>       | <N days> | FRESH/AGING/STALE |
| NEXT_5_SPRINTS.md        | <date>       | <N days> | FRESH/AGING/STALE |
| DRIFT_REPORT.md          | <date>       | <N days> | FRESH/AGING/STALE |

**Unsynced sprints**: <count and names, or "none">

---

## Recommendations

1. <highest priority recommendation>
2. <second recommendation>
3. <third recommendation>
```

---

## Failure Protocol

| Failure                                   | Action                                                                |
| ----------------------------------------- | --------------------------------------------------------------------- |
| Any canonical doc missing                 | HALT — truth layer incomplete; create missing doc or run truth audit  |
| All docs STALE (>14 days)                 | HALT — redirect to `/status-sync` or truth audit                      |
| Conflicting data between docs             | Report the conflict explicitly; do not resolve it — human must decide |
| Git branch does not match expected sprint | Report discrepancy; do not assume which sprint is active              |
| Linear MCP unavailable                    | Proceed without Linear data; note "Linear context unavailable"        |

---

## Notes

- This skill **reads only** — it never modifies docs, code, or Linear
- Every data point in the output traces to a specific file and section
- If a status is ambiguous, say UNVERIFIED, not VERIFIED
- Prefer underclaiming to overclaiming
- The concise format should fit in one terminal screen (~30 lines)
- The audit format is designed to be pasted as a status update in Linear or
  Slack
- See `FRESHNESS_RULES.md` for detailed staleness thresholds
