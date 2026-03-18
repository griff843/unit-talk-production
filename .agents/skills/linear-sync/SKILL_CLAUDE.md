# Skill: Linear Sync

## Purpose

Mirror sprint execution state from the canonical repo truth layer into Linear.
Supports sprint start, sprint complete, blocked sprint, and milestone refresh.
Linear is the execution-tracking mirror, not the source of system truth.

## Invocation

```
/linear-sync <mode> <SPRINT-NAME>
```

Modes:

- `sprint-start` — Mark issue In Progress, assign to current cycle
- `sprint-complete` — Mark issue Done, post sync comment with proof summary
- `blocked` — Mark issue Blocked, add blocker reference
- `milestone-refresh` — Update milestone progress from completed issues

---

## Authority Boundary

| Source of truth                           | What it governs                                                |
| ----------------------------------------- | -------------------------------------------------------------- |
| `docs/status/*`                           | System state — subsystem status, phase, drift                  |
| `out/sprints/*/SPRINT_CLOSEOUT_REPORT.md` | Sprint results — deliverables, verification, status changes    |
| Linear issues                             | Execution tracking — who, when, which cycle, blocked-by chains |

This skill **reads** repo truth and **writes** to Linear. It never reads Linear
to determine system truth.

---

## Inputs by Mode

### sprint-start

- Sprint name (from `/sprint-plan` output or operator)
- Sprint branch name (`git branch --show-current`)
- `docs/status/NEXT_5_SPRINTS.md` (for sprint context)

### sprint-complete

- Sprint name
- `out/sprints/<SPRINT>/<DATE>/SPRINT_CLOSEOUT_REPORT.md` (required — must
  exist)
- `docs/status/CURRENT_SYSTEM_STATUS.md` (for subsystem change context)
- `docs/status/DRIFT_REPORT.md` (for drift impact)
- Git tag on remote (`git ls-remote origin refs/tags/<SPRINT>`)

### blocked

- Sprint name
- Blocking reason (from operator or drift report)
- Blocking issue ID if known

### milestone-refresh

- Project name or ID
- Milestone name or ID

---

## Procedure

### Step 1: Find the Linear Issue

Search for the issue matching this sprint:

```
mcp__linear__list_issues with query="<SPRINT-NAME>"
```

If no result, widen the search:

```
mcp__linear__list_issues with query="<sprint objective keywords>"
```

**If no issue found:**

- For `sprint-start`: Create a new issue (see §Issue Creation Rules below)
- For `sprint-complete`: Create a new issue, then immediately mark Done
- For `blocked`: Flag for operator — "No matching issue. Create one before
  syncing."

Record the issue ID: `UNI-N`

### Step 2: Determine Target State

| Mode                | Target State          | Precondition                                    |
| ------------------- | --------------------- | ----------------------------------------------- |
| `sprint-start`      | **In Progress**       | Sprint branch exists                            |
| `sprint-complete`   | **Done**              | Tag exists on remote AND closeout report exists |
| `blocked`           | **Blocked**           | Blocker identified                              |
| `milestone-refresh` | No issue state change | N/A                                             |

**Hard rule for Done**: Never move to Done without verifying:

```bash
git ls-remote origin refs/tags/<SPRINT-NAME>
```

If the tag is not on remote, the sprint is NOT complete per governance contract.
Stop and report the discrepancy.

### Step 3: Read Source Data

**For sprint-start:**

```bash
cat docs/status/NEXT_5_SPRINTS.md
# Extract the sprint's objective, priority, tasks
```

**For sprint-complete:**

```bash
cat out/sprints/<SPRINT>/<DATE>/SPRINT_CLOSEOUT_REPORT.md
# Extract: deliverables, verification results, status changes, drift impact
```

**For blocked:**

```bash
cat docs/status/DRIFT_REPORT.md
# or read the operator-provided blocking reason
```

**For milestone-refresh:**

```
mcp__linear__list_milestones with project="<project>"
mcp__linear__list_issues with project="<project>" state="done"
```

### Step 4: Update Issue State

**sprint-start:**

```
mcp__linear__save_issue with id="<issue-id>" state="In Progress"
```

Also set:

- Assignee → `me` (if not already assigned)
- Cycle → current active cycle (use `mcp__linear__list_cycles`)
- Priority → from NEXT_5_SPRINTS.md (1=Urgent, 2=High, 3=Normal, 4=Low)

**sprint-complete:**

```
mcp__linear__save_issue with id="<issue-id>" state="Done"
```

Also set:

- Labels → per §Label Rules below

**blocked:**

```
mcp__linear__save_issue with id="<issue-id>" state="Blocked"
```

Also set:

- blockedBy → blocking issue ID(s) if known

### Step 5: Post Sync Comment

Use the appropriate template from `COMMENT_TEMPLATES.md`.

Every sync action posts a structured comment. Comments are the audit trail of
repo-to-Linear synchronization.

### Step 6: Update Milestone (if applicable)

**For sprint-complete:** Check if the issue is assigned to a milestone:

```
mcp__linear__get_issue with id="<issue-id>"
# Check milestone field
```

If milestoned:

- Check if all milestone issues are now Done
- If all Done: milestone is complete — update targetDate if overdue
- If not all Done: no milestone change needed

**For milestone-refresh:** List all issues in the milestone, count Done vs
total, and post a progress comment to the project.

### Step 7: Verify Sync

After all updates:

```
mcp__linear__get_issue with id="<issue-id>"
```

Confirm:

- [ ] State matches target
- [ ] Comment was posted
- [ ] Labels are correct
- [ ] Cycle assignment is correct (for sprint-start)

Report the verified state in the output.

---

## Output Format

```markdown
## Linear Sync — <MODE> — <SPRINT-NAME>

**Issue**: UNI-N — <title> **State**: <previous> → <new> **Cycle**: <cycle name>
**Milestone**: <milestone name or "none"> **Labels**: <label list> **Comment
posted**: ✅

### Sync Summary

<1–2 sentences: what was synced and why>

### Discrepancies

<any issues found, or "none">
```

---

## Failure Protocol

| Failure                                   | Action                                                    |
| ----------------------------------------- | --------------------------------------------------------- |
| Linear MCP unavailable                    | Log "Linear sync pending" in closeout report; retry later |
| No matching issue found (sprint-start)    | Create a new issue with sprint details                    |
| No matching issue found (sprint-complete) | Create issue + mark Done + post full comment              |
| No matching issue found (blocked)         | HALT — flag for operator                                  |
| Tag not on remote (sprint-complete)       | HALT — sprint not complete per governance                 |
| Closeout report missing (sprint-complete) | HALT — run `/sprint-proof-bundle` first                   |
| Multiple issues match the sprint name     | List all matches; ask operator which to update            |
| Issue already Done (sprint-complete)      | Skip state change; still post sync comment if new info    |

---

## Notes

- This skill writes to Linear only — it never modifies repo docs
- It reads from repo docs only — it never uses Linear as a source of truth
- Comments are append-only — never edit or delete previous sync comments
- Labels are additive — never remove labels set by other team members
- If in doubt whether to update a field, don't — underclaiming is safer than
  overclaiming
- See `COMMENT_TEMPLATES.md` for all sync comment formats
- See `MAPPING_RULES.md` for field mapping, label rules, and issue creation
