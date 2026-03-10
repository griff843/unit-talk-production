# Skill: Status Sync

## Purpose

Synchronize repo truth (docs/status/), sprint closeout records, and Linear
execution state after every completed sprint or subsystem change. Prevents drift
between what the code does, what the docs say, and what Linear tracks.

## Invocation

```
/status-sync <SPRINT-NAME>
```

Or invoked automatically after `/sprint-proof-bundle` completes.

---

## Decision Gate: Should I Run This?

Run `/status-sync` if ANY of the following are true:

- A sprint was just merged to main
- A subsystem status changed (VERIFIED → PARTIAL, BROKEN → VERIFIED, etc.)
- A drift item was resolved or a new one discovered
- A phase milestone was completed
- The next sprint order changed

**Do NOT run** if:

- No sprint was completed
- Only documentation or tooling changed with no functional impact
- A sprint was planned but not yet implemented

---

## Procedure

### Step 1: Locate Sprint Closeout

```bash
SPRINT="<SPRINT-NAME>"
DATE=$(date +%Y-%m-%d)

# Find the closeout report
ls out/sprints/$SPRINT/*/SPRINT_CLOSEOUT_REPORT.md
```

Read the closeout report fully before proceeding. Extract:

- Deliverables completed
- Subsystems affected
- Verification results (gate pass/fail)
- Any new or resolved drift items

### Step 2: Assess What Changed

Answer these questions from the closeout report:

| Question                                    | If Yes → Update                                      |
| ------------------------------------------- | ---------------------------------------------------- |
| Did a subsystem status change?              | `CURRENT_SYSTEM_STATUS.md`                           |
| Did a phase completion % change?            | `PHASE_STATUS.md`                                    |
| Was the top-priority sprint completed?      | `NEXT_5_SPRINTS.md`                                  |
| Was a drift item resolved or created?       | `DRIFT_REPORT.md`                                    |
| Did the sprint touch infrastructure health? | Infrastructure section of `CURRENT_SYSTEM_STATUS.md` |

If none of the above: **stop here** — no status files need updating.

### Step 3: Update CURRENT_SYSTEM_STATUS.md

**Only update if a subsystem row changes status.**

```bash
# Read current status
cat docs/status/CURRENT_SYSTEM_STATUS.md
```

Apply changes per the rules in `UPDATE_RULES.md`:

- Update the `Status` column for affected subsystem(s)
- Update the `Evidence` and `Blocking Issues` columns
- Update the `Last Updated` timestamp at the top
- Update Infrastructure Health rows if CI/build/test status changed

**Do not rewrite unaffected rows.** Make targeted edits only.

```
**Last Updated**: <YYYY-MM-DD> **Audit Source**: <SPRINT-NAME>
```

### Step 4: Update PHASE_STATUS.md

**Only update if a phase milestone was completed or % moved materially (≥5%).**

```bash
cat docs/status/PHASE_STATUS.md
```

- Increment phase completion percentage
- Mark completed milestone tasks with ✅
- Add new completed milestone in the sprint reference column
- Do not modify phases not touched by this sprint

### Step 5: Update NEXT_5_SPRINTS.md

**Only update if the top-priority sprint was completed or priority order
changed.**

```bash
cat docs/status/NEXT_5_SPRINTS.md
```

- Remove the completed sprint from the list
- Promote the next sprint to position 1
- Add a new sprint at position 5 if one exists in the roadmap
- Reference `docs/roadmap/INTELLIGENCE_PIPELINE_SPRINT_ORDER.md` for ordering

### Step 6: Update DRIFT_REPORT.md

**Only update if:**

- A drift item was **resolved** by this sprint → remove or mark RESOLVED
- A new **CRITICAL or HIGH** drift was **discovered** → add a new row
- An existing drift severity **changed** based on sprint findings

**Do NOT update** for informational sprints, minor adjustments, or status
changes that don't resolve a documented drift.

```bash
cat docs/status/DRIFT_REPORT.md
```

When resolving a drift item:

- Remove it from the active table
- Add a one-line entry in the `## Resolved` section (if it exists)

When adding a new drift item:

- Insert in severity order (CRITICAL first)
- Include: Severity, Item, Description, First Detected

### Step 7: Sync to Linear

See `LINEAR_SYNC_GUIDE.md` for full field mapping. Summary:

1. Find the Linear issue for this sprint (search by sprint name or ID)
2. Move state to **Done** if sprint merged + tagged
3. Move state to **Blocked** if sprint is blocked on a dependency
4. Update the issue description with a link to the closeout report
5. Add a comment with the sync summary (use template below)
6. If the sprint was part of a milestone, update milestone progress

**Linear Comment Template:**

```
✅ Sprint Sync — <SPRINT-NAME>

Status: COMPLETE
Merged: <branch> → main
Tag: <SPRINT-TAG>
Proof: out/sprints/<SPRINT>/<DATE>/SPRINT_CLOSEOUT_REPORT.md

Subsystems updated: <list>
Drift resolved: <count> items
Phase impact: <phase N> → <X>%
```

### Step 8: Verify Consistency

After all updates, run a quick consistency check:

```bash
# Confirm no stale "In Progress" or "blocked" states remain for this sprint
grep -r "<SPRINT-NAME>" docs/status/ --include="*.md"
```

Verify:

- [ ] `CURRENT_SYSTEM_STATUS.md` Last Updated timestamp is today
- [ ] Completed sprint is no longer in `NEXT_5_SPRINTS.md` position 1
- [ ] No resolved drift items remain in the active section of `DRIFT_REPORT.md`
- [ ] Linear issue state is **Done** (not In Progress)

---

## Output

After running this skill, report:

```markdown
## Status Sync Complete — <SPRINT-NAME>

**Date**: <YYYY-MM-DD>

### Docs Updated

- [ ] CURRENT_SYSTEM_STATUS.md — <what changed>
- [ ] PHASE_STATUS.md — <what changed>
- [ ] NEXT_5_SPRINTS.md — <what changed>
- [ ] DRIFT_REPORT.md — <what changed or "no change required">

### Linear

- Issue: <UNI-N> → Done
- Comment posted: ✅

### Consistency Check

- Timestamps: ✅
- No stale sprint references: ✅
- Drift items reconciled: ✅
```

---

## Failure Protocol

| Failure                                              | Action                                               |
| ---------------------------------------------------- | ---------------------------------------------------- |
| Cannot find closeout report                          | STOP — run `/sprint-proof-bundle` first              |
| Linear issue not found                               | Search by sprint name; if absent, create issue first |
| Drift item unclear                                   | Add it as MEDIUM severity with a note, do not skip   |
| Phase % ambiguous                                    | Do not update PHASE_STATUS.md; note the ambiguity    |
| Status conflict (two sprints changed same subsystem) | Use the most recent sprint's findings                |

---

## Follow-On Skills

After status sync, consider:

1. `/sprint-plan` — Begin the next sprint now that status is updated
2. `/single-writer-audit` — If lifecycle compliance changed this sprint
3. `/sprint-verify` — Re-verify if any gate results were borderline

---

## Notes

- This skill makes **targeted edits** — never full rewrites of status files
- All status claims must trace to proof artifacts; never guess at status
- If in doubt about a status level, use PARTIAL not VERIFIED
- Linear sync is best-effort; if Linear API is unavailable, document the gap and
  sync manually when available
- See `UPDATE_RULES.md` for detailed decision rules on each doc
- See `LINEAR_SYNC_GUIDE.md` for Linear field mapping and state transitions
