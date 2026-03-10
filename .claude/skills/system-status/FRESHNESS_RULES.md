# System Status — Freshness Rules

## Authority

Status docs in `docs/status/` are canonical only if they are current. Stale docs
produce incorrect sprint selection, wrong blocker assessments, and phantom drift
items. These rules determine when to trust status docs and when to halt.

---

## §1 — Per-Doc Freshness Assessment

Each status doc is assessed independently.

### Thresholds

| Age                          | Assessment | Color  | Action                                       |
| ---------------------------- | ---------- | ------ | -------------------------------------------- |
| 0–7 days since Last Updated  | **FRESH**  | Green  | Trust fully                                  |
| 8–14 days since Last Updated | **AGING**  | Yellow | Note in output; recommend `/status-sync`     |
| 15+ days since Last Updated  | **STALE**  | Red    | HALT — do not produce status from stale data |

### Calculating Age

```
Age = today's date − Last Updated date (from doc header)
```

The `Last Updated` field is at the top of each doc. Example:

```
**Last Updated**: 2026-03-09
```

If `Last Updated` is missing from a doc, treat the doc as **STALE**.

---

## §2 — Aggregate Freshness

The overall freshness is determined by the **stalest** doc:

| All docs FRESH | Some AGING     | Any STALE             |
| -------------- | -------------- | --------------------- |
| Overall: FRESH | Overall: AGING | Overall: STALE → HALT |

If 3 of 4 docs are FRESH but 1 is STALE, the overall status is STALE. One stale
doc can invalidate the entire snapshot because status docs reference each other
(e.g., NEXT_5_SPRINTS depends on DRIFT_REPORT being current).

---

## §3 — Unsynced Sprint Detection

An unsynced sprint exists when:

```
most_recent_closeout_date > CURRENT_SYSTEM_STATUS.md Last Updated date
```

How to detect:

```bash
# Find most recent closeout date
LAST_CLOSEOUT=$(ls -td out/sprints/*/2*/ 2>/dev/null | head -1)
echo "Last closeout dir: $LAST_CLOSEOUT"

# Compare with status doc
grep "Last Updated" docs/status/CURRENT_SYSTEM_STATUS.md
```

If an unsynced sprint exists:

- Report it in the output: "Unsynced sprint: <SPRINT-NAME>"
- Assessment downgrades to AGING (minimum), even if docs would otherwise be
  FRESH
- Recommend: `/status-sync <SPRINT-NAME>`

---

## §4 — Sprint Branch vs Status Doc Alignment

Check if the current branch implies work that should have been synced:

```bash
git branch --show-current
# If sprint/... → check if that sprint's closeout exists
```

| Condition                                  | Meaning                                         |
| ------------------------------------------ | ----------------------------------------------- |
| Branch is `main`                           | No active sprint; status docs should be current |
| Branch is `sprint/<name>` with no closeout | Sprint in progress; status docs may be AGING    |
| Branch is `sprint/<name>` with closeout    | Sprint done but not merged; sync pending        |

---

## §5 — Conflict Resolution

When status docs contradict each other:

### Phase vs Subsystem conflict

Example: PHASE_STATUS says "Phase 1: 75%" but CURRENT_SYSTEM_STATUS shows a
Phase 1 subsystem as BROKEN.

Resolution: **Report both**. Do not reconcile. Add a note:

```
⚠️ CONFLICT: PHASE_STATUS claims 75% but <subsystem> is BROKEN in
CURRENT_SYSTEM_STATUS. Recommend truth audit to reconcile.
```

### Drift vs Queue conflict

Example: DRIFT_REPORT has a CRITICAL item that is not addressed by Sprint 1 in
NEXT_5_SPRINTS.

Resolution: **Report both**. Add a note:

```
⚠️ CRITICAL drift (DRIFT-C1) is not addressed by Sprint 1
(<SPRINT-NAME>). Consider override per /sprint-plan selection rules.
```

### General rule

Never silently resolve a conflict. Report it. Let the operator or `/sprint-plan`
handle it.

---

## §6 — Status Level Reporting Rules

When summarizing subsystem status from CURRENT_SYSTEM_STATUS.md:

| Doc says                  | Skill reports | Notes                                      |
| ------------------------- | ------------- | ------------------------------------------ |
| VERIFIED                  | VERIFIED      | Only if Evidence column is populated       |
| VERIFIED (empty Evidence) | ASSUMED       | No evidence = assumption, not verification |
| PARTIAL                   | PARTIAL       | Report the Blocking Issues column          |
| BROKEN                    | BROKEN        | Always highlight in the output             |
| UNVERIFIED                | UNVERIFIED    | Note "needs verification sprint"           |
| ASSUMED                   | ASSUMED       | Note "needs evidence to confirm"           |

**Key rule**: This skill never upgrades a status. If the doc says PARTIAL, this
skill says PARTIAL. If the doc says VERIFIED but evidence is empty, this skill
may downgrade to ASSUMED and flag it.

---

## §7 — Drift Trend Calculation

### Determine trend from DRIFT_REPORT.md

1. Count total active drift items
2. Check for a `## Resolved` section
3. Assess:

| Resolved section exists | New items since last audit           | Trend                        |
| ----------------------- | ------------------------------------ | ---------------------------- |
| Yes, items resolved     | No new items                         | **DECREASING**               |
| Yes, items resolved     | Some new items (fewer than resolved) | **DECREASING**               |
| Yes, items resolved     | Same or more new items               | **STABLE** or **INCREASING** |
| No resolved section     | 0 CRITICAL items                     | **STABLE**                   |
| No resolved section     | 1+ CRITICAL items                    | **INCREASING** (assumed)     |

When in doubt, report **STABLE** with a note: "Insufficient data to determine
drift trend with confidence."

---

## §8 — Active Sprint vs Next Sprint

### How to determine "active sprint"

```bash
BRANCH=$(git branch --show-current)
```

| Branch pattern             | Active sprint                                      |
| -------------------------- | -------------------------------------------------- |
| `sprint/<name>`            | Active: <name> (in progress)                       |
| `main`                     | No active sprint                                   |
| Other (feature, fix, etc.) | Not a governed sprint; note as "non-sprint branch" |

### How to determine "next sprint"

If no active sprint: next sprint = Sprint 1 from NEXT_5_SPRINTS.md. If active
sprint: next sprint = the sprint AFTER the active one in the queue.

If the active sprint is not in NEXT_5_SPRINTS.md, note the discrepancy: "Active
sprint <name> is not in the planned queue."
