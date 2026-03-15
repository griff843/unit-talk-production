# Prompt Template: Incident Analysis

> **When to use**: After an incident (picks not posting, SLO breach, agent down,
> settlement failures). Use to synthesize observations into a root cause and
> remediation plan.
>
> **Ground first**: Run `pnpm ai:context` and paste
> `out/ai/context/context_bundle.md` before this prompt. Also paste any relevant
> `/pipeline-health` or `/pick-trace` output.

---

## Prompt

```
You are conducting an incident analysis for the Unit Talk sports betting intelligence platform. I've provided platform context above. Additional incident observations are below.

## Incident Summary

Date/Time: [YYYY-MM-DD HH:MM UTC]
Duration: [e.g., "~45 minutes", "ongoing"]
Impact: [e.g., "picks not appearing in Discord for ~2 hours", "settlement_attainment SLO in BREACH"]
Severity: [P0 — Platform Down | P1 — SLO Breach | P2 — Degraded]

## Observations

### Pipeline Health (from /pipeline-health or API)
[PASTE pipeline-health output OR health snapshot from command_center_snapshot.json]

### Pick Trace (if specific picks affected)
[PASTE /pick-trace <uuid> output for an affected pick, or "N/A"]

### SLO Status
[PASTE slo-report output or "SLO data not available"]

### Agent/System Logs (if available)
[PASTE relevant log snippets, or "not captured"]

### Timeline of Events
[PASTE what was observed and when, e.g.:
  14:32 — First Discord posting gap noticed
  14:45 — /pipeline-health shows outbox.pending = 847, stale_alert = true
  15:10 — GradingAgent heartbeat stale (>15 min)
]

## What I Need

1. **Root Cause Hypothesis** — Based on the observations, what is the most likely root cause? Provide 1 primary hypothesis and 1 alternative.

2. **Blast Radius** — Which subsystems and SLOs were affected or at risk? Reference the canonical SLOs (lifecycle_attainment 95%, discord_posting 98%, grading_latency_p50 <300s, settlement_attainment 99.5%).

3. **Remediation Steps** — What should be done now (immediate) vs. next sprint (structural fix)? Reference the ON_CALL_RUNBOOK.md scenarios if relevant.

4. **Verification** — How do we confirm the incident is resolved? What specific metrics or observations would confirm recovery?

5. **Prevention** — What structural change would prevent this class of incident? Is this a known drift item? Should it be added to DRIFT_REPORT.md?

## Constraints

- Do not suggest bypassing lifecycle adapters for remediation
- If a replay is needed, reference the replay endpoint (SPRINT-054 pending) or manual operator workflow
- Reference ON_CALL_RUNBOOK.md scenarios where applicable (Scenario 1: Agent Down, 2: Discord Outage, 3: Posting Failure, 4: Settlement Failure)

## Output Format

Use headers: Root Cause / Blast Radius / Remediation / Verification / Prevention
Total response under 700 words. Be specific — vague root causes are not actionable.
```

---

## Variables to Fill In

| Variable               | Description                                   | Source           |
| ---------------------- | --------------------------------------------- | ---------------- |
| Date/Time              | Incident start                                | On-call notes    |
| Duration               | How long it lasted                            | On-call notes    |
| Impact                 | User-visible effect                           | On-call notes    |
| Pipeline health output | `/pipeline-health` or command_center_snapshot | Claude MCP skill |
| Pick trace             | `/pick-trace <uuid>` for affected pick        | Claude MCP skill |
| SLO status             | `/slo-report` output                          | Claude MCP skill |

---

## Post-Incident Checklist

After completing this analysis:

- [ ] File drift item in `DRIFT_REPORT.md` if structural gap discovered
- [ ] Update `ON_CALL_RUNBOOK.md` if a new scenario pattern emerged
- [ ] Create Linear issue for structural remediation sprint
- [ ] Run `/status-sync` if any subsystem status changed
