# SYSTEM STATUS WORKFLOW

**Owner**: Engineering Team **Effective**: 2026-03-09 **Sprint**:
SPRINT-BUILD-CLAUDE-SKILL-SYSTEM-STATUS **Authority**:
`.claude/skills/system-status/SKILL.md`

---

## Overview

`/system-status` answers "where does Unit Talk stand?" from canonical truth
docs. It is the read layer for the same truth docs that `/status-sync` writes
and `/sprint-plan` reads to select the next sprint.

```
/status-sync          → writes truth docs
/system-status        → reads truth docs (this skill)
/sprint-plan          → reads truth docs + selects next sprint
/sprint-proof-bundle  → captures evidence for closeout
```

This skill is **read-only**. It never modifies status docs, code, or Linear.

---

## When to Use

| Situation                               | Use `/system-status`?                        |
| --------------------------------------- | -------------------------------------------- |
| Starting a new session                  | **YES** — get oriented before any work       |
| Deciding what sprint to do next         | **YES**, then follow with `/sprint-plan`     |
| After completing a sprint (before sync) | **YES** (with freshness warning expected)    |
| Mid-sprint, checking broader context    | **YES** — helps identify if drift changed    |
| Someone asks "what's the status?"       | **YES** — paste the output                   |
| After a truth audit                     | **YES** — confirm the audit corrected things |
| Status docs are very stale (>14 days)   | **NO** — run `/status-sync` first            |

---

## Invocation

### Concise mode (default)

```
/system-status
```

Returns a ~30-line snapshot: phase, subsystem counts, blockers, sprint queue,
drift summary, and a one-line recommendation.

### Audit mode

```
/system-status --audit
```

Returns the full expanded summary: every subsystem row, every drift item, every
phase milestone, freshness table, and ranked recommendations. Designed to be
pasted as a status update in Linear or shared with stakeholders.

---

## Examples

### Example 1: After a Completed Sprint

**Context**: SPRINT-SINGLE-WRITER-COMPLETION just merged. `/status-sync` was
already run. Docs are fresh.

```
/system-status
```

Output:

```markdown
# Unit Talk — System Status

**As of**: 2026-03-10 | **Freshness**: FRESH **Phase**: Phase 1 → Phase 2
transition (Phase 1: 80%, Phase 2: 70%) **Active Sprint**: none **Next Sprint**:
SPRINT-PROMOTION-ACTIVATION (P1)

## Subsystem Health

VERIFIED: 6 | PARTIAL: 4 | BROKEN: 0 | UNVERIFIED: 1

## Top Blockers

1. DRIFT-H3: Promotion policy disabled by default (HIGH)
2. DRIFT-H4: GitHub-Linear integration not connected (HIGH)

## Sprint Queue

1. SPRINT-PROMOTION-ACTIVATION — P1 — Enable Discord publishing
2. SPRINT-MULTI-BOOK-CONSENSUS — P1 — V3 multi-book scoring
3. SPRINT-OPERATIONAL-OBSERVABILITY — P1 — Close failure modes
4. <TBD from roadmap>
5. <TBD from roadmap>

## Drift

CRITICAL: 0 | HIGH: 3 | MEDIUM: 5 | LOW: 3 | Total: 11 Trend: DECREASING (3
CRITICAL items resolved last sprint)

## Next Action

Run /sprint-plan to select and generate SPRINT-PROMOTION-ACTIVATION prompt.
```

---

### Example 2: Mid-Sprint, Checking Context

**Context**: On branch `sprint/promotion-activation`. Sprint in progress.

```
/system-status
```

Output:

```markdown
# Unit Talk — System Status

**As of**: 2026-03-11 | **Freshness**: FRESH **Phase**: Phase 1 → Phase 2
transition (Phase 1: 80%, Phase 2: 70%) **Active Sprint**:
sprint/promotion-activation (in progress) **Next Sprint**:
SPRINT-MULTI-BOOK-CONSENSUS (P1)

## Subsystem Health

VERIFIED: 6 | PARTIAL: 4 | BROKEN: 0 | UNVERIFIED: 1

## Top Blockers

1. DRIFT-H3: Promotion policy disabled by default (HIGH) — active sprint
   addresses this

## Sprint Queue

1. SPRINT-PROMOTION-ACTIVATION — P1 — Enable Discord publishing [IN PROGRESS]
2. SPRINT-MULTI-BOOK-CONSENSUS — P1 — V3 multi-book scoring ...

## Drift

CRITICAL: 0 | HIGH: 3 | MEDIUM: 5 | LOW: 3 | Total: 11 Trend: STABLE

## Next Action

Continue implementation. Run /sprint-proof-bundle when complete.
```

---

### Example 3: Stale Status Docs

**Context**: 3 sprints have merged since the last `/status-sync`. Status docs
are 18 days old.

```
/system-status
```

Output:

```markdown
⚠️ HALT — Status docs are STALE

| Doc                      | Last Updated | Age     | Status |
| ------------------------ | ------------ | ------- | ------ |
| CURRENT_SYSTEM_STATUS.md | 2026-02-22   | 18 days | STALE  |
| PHASE_STATUS.md          | 2026-02-22   | 18 days | STALE  |
| NEXT_5_SPRINTS.md        | 2026-02-25   | 15 days | STALE  |
| DRIFT_REPORT.md          | 2026-02-22   | 18 days | STALE  |

Unsynced sprints detected: 3

Cannot produce reliable status from stale data.

**Required**: Run /status-sync for each unsynced sprint, most recent first:

1. /status-sync SPRINT-C
2. /status-sync SPRINT-B
3. /status-sync SPRINT-A

Then re-run /system-status.
```

---

### Example 4: After a Truth Audit

**Context**: SPRINT-SYSTEM-TRUTH-AUDIT just completed. All docs refreshed.

```
/system-status --audit
```

Output: Full audit summary format with every subsystem, every drift item, every
phase — all showing freshly verified data with today's date. The freshness table
shows all docs FRESH. Drift trend shows DECREASING if the audit resolved items.
Recommendations list the next implementation sprint.

---

## Skill Interaction Map

```
/system-status
    │
    ├── Reads:  docs/status/CURRENT_SYSTEM_STATUS.md
    │           docs/status/PHASE_STATUS.md
    │           docs/status/NEXT_5_SPRINTS.md
    │           docs/status/DRIFT_REPORT.md
    │           most recent sprint closeout (optional)
    │           git branch --show-current (active sprint)
    │
    ├── Writes: NOTHING (read-only)
    │
    ├── Redirects to (when data is stale):
    │   /status-sync <SPRINT>     ← update stale docs
    │
    └── Feeds into:
        /sprint-plan              ← select next sprint from fresh status
```

---

## Future Integration Recommendation

### Claude OS `system-status` command

Claude OS should eventually expose a `system-status` command that reads the same
truth layer:

```bash
npx tsx src/cli.ts system-status
```

This would give non-Claude operators (scripts, CI, dashboards) the same status
snapshot. The implementation would be a thin wrapper that reads the same four
docs and applies the same freshness rules.

**When to build this**: After 5+ sprint cycles of the skill being used
successfully. No urgency — the skill covers the primary use case.

### Interaction with other skills

| Skill                  | Relationship                                                     |
| ---------------------- | ---------------------------------------------------------------- |
| `/status-sync`         | Upstream writer — produces the data this skill reads             |
| `/sprint-plan`         | Downstream consumer — reads the same data, then selects a sprint |
| `/sprint-proof-bundle` | Parallel — this skill can check status mid-sprint for context    |
| `/sprint-verify`       | No direct interaction — but status can confirm gate expectations |

### Recommended usage cadence

```
Session start:  /system-status                ← get oriented
Sprint done:    /sprint-proof-bundle          ← capture evidence
After merge:    /status-sync                  ← update truth
After sync:     /system-status                ← verify truth is fresh
Next sprint:    /sprint-plan                  ← select from fresh truth
```

---

## Skill Directory

```
.claude/skills/system-status/
├── SKILL.md              # 9-step read-only procedure, two output modes
└── FRESHNESS_RULES.md    # Staleness thresholds, conflict resolution, trend calculation
```
