# Skill: Incident Triage

## Purpose

Provide structured triage for production incidents and anomalies surfaced via
the `finding-backlog` CLI, health endpoints, or a manual operator report.
Classifies the incident, identifies the affected subsystems and blast radius,
and routes to the correct next action — without claiming runtime visibility the
operator does not have.

**Portability class:** Unit Talk-Specific (the triage pattern is reusable; the
sources, severity taxonomy, and routing targets are Unit Talk-specific)

## Invocation

```
/incident-triage
```

With hints:

```
/incident-triage --severity CRITICAL
/incident-triage --source finding-backlog
/incident-triage --source health
/incident-triage --source manual
```

---

## When to Use

Run `/incident-triage` when:

- A CRITICAL or HIGH severity finding appears in the finding backlog
- `/agent-health` or `/system-status` shows a broken or PARTIAL subsystem
- An unexpected platform behavior requires structured triage before deciding
  whether a hotfix or a sprint is appropriate
- The Discord bot, scoring, or lifecycle pipeline behaves unexpectedly
- A DRIFT_REPORT item is newly CRITICAL and needs a root-cause path
- You are about to start an unstructured debug session — run this first to
  classify before diving in

**Do not use** for general platform health overviews (use `/system-status`) or
AI OS layer health (use `/agent-health`).

---

## Required Inputs (gather before starting)

| Input              | What it is                                                               |
| ------------------ | ------------------------------------------------------------------------ |
| Incident source    | Where was it surfaced: finding-backlog, health endpoint, operator report |
| Symptom            | One-line description of what went wrong or is behaving unexpectedly      |
| Expected behavior  | What should have happened                                                |
| Affected subsystem | Which subsystem(s) appear involved                                       |
| Timing             | When did this start / when was it last working                           |

---

## Optional Inputs

- Finding ID or DRIFT-ID from the drift report
- Sprint or deployment that may have introduced the issue
- Related pick ID, workflow ID, or agent name
- Error log excerpts or health snapshot output
- Screenshots or embed output if Discord-related

---

## Severity Reference

The `finding-backlog` CLI uses this severity taxonomy:

| Severity | Meaning                                | Typical Action    |
| -------- | -------------------------------------- | ----------------- |
| P0       | Platform-breaking — immediate STOP     | Emergency hotfix  |
| P1       | Blocking — high-severity sprint needed | Prioritize sprint |
| P2       | High — should be addressed this cycle  | Next sprint queue |
| P3       | Medium — log and monitor               | Backlog           |
| P4       | Low — informational only               | Log only          |

---

## Incident Classification Reference

Before starting triage, identify the most likely failure class:

| Class                    | Description                                           | Example Symptoms                                |
| ------------------------ | ----------------------------------------------------- | ----------------------------------------------- |
| **LIFECYCLE**            | Pick lifecycle transition failed or was skipped       | pick stuck in wrong stage, missed promotion     |
| **SINGLE_WRITER**        | Unauthorized write to unified_picks detected          | gate failure, direct insert outside lifecycle   |
| **DISCORD_DELIVERY**     | Pick or message not delivered to Discord              | post missing, wrong channel, embed broken       |
| **SCORING_DRIFT**        | Scoring or grading logic producing unexpected results | unexpected band assignment, promotion_band null |
| **TEMPORAL_FAILURE**     | Temporal workflow did not start or stalled            | replay endpoint silent, scheduling gap          |
| **AGENT_HEALTH**         | An agent is unhealthy or not responding               | health endpoint DEGRADED row                    |
| **SCHEMA_DRIFT**         | DB schema and TypeScript types are out of sync        | type-check errors after deploy                  |
| **ENV_MISMATCH**         | Config divergence between dev/staging/prod            | works locally, fails in prod                    |
| **EXPECTATION_MISMATCH** | Behavior is correct per code; expectation was wrong   | no code fix needed                              |

---

## Procedure

### Step 1: Classify the Incident

Based on the inputs, assign:

- **Primary class**: most likely class from the reference table above
- **Secondary class**: second most likely if ambiguous
- **Severity**: P0–P4 (or CRITICAL/HIGH/MEDIUM from DRIFT_REPORT)
- **Confidence**: HIGH / MEDIUM / LOW

### Step 2: Check the Finding Backlog

If sourced from the finding-backlog CLI:

```bash
# List all findings for a given sprint or from last baseline
cd tools/claude-os && npx tsx src/cli.ts findings --sprint <SPRINT-ID>

# Or from the workspace root
pnpm findings --sprint <SPRINT-ID> --json
```

Key fields to inspect per finding:

- `severity`: P0–P4
- `source`: failure_classifier / drift_sentinel / verdict_engine /
  lifecycle_checker
- `category`: the specific failure category
- `action`: BACKLOG_CREATE / LINEAR_DRAFT / LOG_ONLY
- `suggestedSprintName`: proposed sprint name for a fix
- `estimatedEffort`: small / medium / large

### Step 3: Check Health Endpoints (if not finding-backlog)

For runtime failures, check the platform health surface:

```bash
# GET /ops/health — overall health summary
# GET /api/health/summary — Command Center health proxy
# Key rows to inspect:
#   agent_health table: discord_api, discord_gateway, grading_agent, settlement_agent
#   Expected: status = HEALTHY, last_heartbeat within last 5 minutes
```

If any health row shows DEGRADED or OFFLINE:

- Discord failures → `/discord-diagnose` first
- Scoring failures → `/scoring-audit` first
- Temporal failures → @temporal-workflow-guardian

### Step 4: Identify Affected Subsystems

From what was found in Steps 2–3, list:

- Which subsystems are **directly** involved
- Which subsystems are **downstream** (blast radius)
- Whether the issue is isolated or cross-system

### Step 5: Determine Fix Path

Apply this decision table:

| Condition                                 | Path                                                                           |
| ----------------------------------------- | ------------------------------------------------------------------------------ |
| P0 severity — platform broken now         | Emergency hotfix sprint TODAY                                                  |
| P1 severity — blocking, needs sprint      | Run `/prompt-compose` to create implementation prompt                          |
| Affects unified_picks or lifecycle        | Verify single-writer gate first: `npm run lifecycle:single-writer -- --strict` |
| Affects Discord delivery                  | Run `/discord-diagnose` before fixing                                          |
| Affects scoring/grading                   | Run `/scoring-audit` before fixing                                             |
| P2–P3 severity — documented drift         | Add to DRIFT_REPORT, queue in next sprint plan                                 |
| EXPECTATION_MISMATCH — no code fix needed | Document resolution; close finding                                             |

### Step 6: Generate Triage Output

Use the output format below.

---

## Output Format

```markdown
# Incident Triage — <symptom summary>

**Date**: <YYYY-MM-DD> **Symptom**: <one-line description> **Source**:
finding-backlog | health endpoint | manual report **Primary Class**:
<class from reference table> **Secondary Class**: <class or N/A> **Severity**:
P0 | P1 | P2 | P3 | P4 **Confidence**: HIGH | MEDIUM | LOW

---

## Affected Subsystems

- **Direct**: <subsystem(s) where the failure is occurring>
- **Downstream / Blast Radius**: <what else is affected if this is not fixed>

---

## Root Cause Hypothesis

<2–3 sentences: what the evidence points to, what the most likely root cause is,
and why>

---

## Priority Checks

1. <Most important thing to inspect — specific query, file, or endpoint>
2. <Second check>
3. <Third check>

---

## Recommended Path

- [ ] <Action 1 — e.g., "Run /discord-diagnose for posting failure details">
- [ ] <Action 2 — e.g., "Run /prompt-compose to compose hotfix implementation
      prompt">
- [ ] <Action 3 — e.g., "Update DRIFT_REPORT with DRIFT-NEW item">

**Fix classification**: hotfix sprint | queued sprint | no-code fix | monitoring
only

---

## What This Is NOT

<One sentence noting what this triage explicitly rules out or cannot assess
without more evidence>
```

---

## Failure Protocol

| Failure                            | Action                                                               |
| ---------------------------------- | -------------------------------------------------------------------- |
| Cannot determine expected behavior | Ask operator — do not triage without it                              |
| P0 severity detected               | STOP all related work; escalate immediately; do not proceed normally |
| Symptom is Discord-related         | Run `/discord-diagnose` first; triage is secondary                   |
| Symptom is scoring/calibration     | Run `/scoring-audit` first; triage is secondary                      |
| Cannot access live data            | Note the gap; produce best available triage with explicit caveat     |
| Multiple classes equally plausible | Report both; recommend starting with the more verifiable one         |

---

## Non-Goals

This skill does NOT:

- Fix the incident — it triages and routes to the fix path
- Replace `/discord-diagnose` for Discord-specific failures
- Replace `/scoring-audit` for scoring-specific failures
- Claim runtime visibility it does not have — if a check requires live DB
  access, say so explicitly
- Operate without knowing the expected behavior
- Replace a post-mortem or full incident report

---

## Integration with Claude OS

| This skill uses                          | Purpose                                                 |
| ---------------------------------------- | ------------------------------------------------------- |
| `pnpm findings`                          | Primary finding source — finding-backlog CLI            |
| `/discord-diagnose`                      | Discord-specific triage for DISCORD_DELIVERY class      |
| `/scoring-audit`                         | Scoring-specific triage for SCORING_DRIFT class         |
| `/prompt-compose`                        | Compose implementation prompt when code fix is required |
| `/system-status`                         | Platform health context for cross-referencing           |
| `docs/status/DRIFT_REPORT.md`            | Active drift items — cross-reference for known issues   |
| `docs/status/CURRENT_SYSTEM_STATUS.md`   | Subsystem health baseline                               |
| `tools/claude-os/src/finding-backlog.ts` | Backend CLI powering the `pnpm findings` command        |

---

## Notes

- Always classify before diagnosing — do not start debugging without knowing the
  class and severity
- P0 incidents override all other planned work; do not continue a sprint when P0
  is confirmed
- The finding backlog sources are: `failure_classifier`, `drift_sentinel`,
  `verdict_engine`, `lifecycle_checker` — know which fired before proposing a
  fix
- `promotion_band = null` is a known P1 failure mode in scoring/promotion; check
  this early for any pick-not-posted triage
- For lifecycle-class incidents, always verify single-writer gate before
  claiming a code fix is complete
- This skill is Unit Talk-Specific v1; the triage pattern (classify → blast
  radius → fix path) may generalize to an adapter-based form in a future wave
