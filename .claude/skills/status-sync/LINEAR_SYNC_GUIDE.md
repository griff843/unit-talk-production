# Status Sync — Linear Sync Guide

Field mapping and state transition rules for syncing sprint results to Linear.

## Finding the Right Issue

```
Search priority:
1. Issue title contains <SPRINT-NAME>
2. Issue description contains the sprint branch name
3. Cycle contains sprint-adjacent issues
```

Use the Linear MCP tool:

```
mcp__linear__list_issues with query="<SPRINT-NAME>"
```

If no issue exists, do not create one automatically — flag it for operator
review.

---

## State Transitions

| Sprint Condition    | Target State    | Notes                                         |
| ------------------- | --------------- | --------------------------------------------- |
| Merged + tag minted | **Done**        | Verify `git ls-remote origin refs/tags/<TAG>` |
| In review / PR open | **In Review**   | Link PR in issue                              |
| Implementing        | **In Progress** | Set when work starts                          |
| Blocked             | **Blocked**     | Add `blockedBy` issue link                    |
| Deferred            | **Canceled**    | Add deferral reason in comment                |

---

## Required Comment After Completion

Post this comment to the Linear issue when marking Done:

```markdown
✅ Sprint Complete — <SPRINT-NAME>

**Merged**: <branch> → main (<commit SHA>) **Tag**: <SPRINT-TAG> (minted by CI)
**Proof Bundle**: `out/sprints/<SPRINT>/<DATE>/`

**Subsystems Updated**:

- <Subsystem>: <OLD_STATUS> → <NEW_STATUS>
- <Subsystem>: <unchanged if no change>

**Drift Impact**:

- Resolved: <N> items (<list item names>)
- New: <N> items (<list item names or "none">)

**Phase Impact**:

- Phase <N>: <X>% → <Y>% (milestone: <name> ✅)

**Next Sprint**: <SPRINT-NAME-NNN>
```

---

## Milestone Updates

When a sprint is the last one in a milestone:

1. Verify all milestone issues are Done
2. Update milestone `targetDate` if it was missed (do not delete the milestone)
3. Add a milestone completion comment to the project

When a sprint is mid-milestone:

1. No milestone-level update needed — just issue state

---

## Labels to Apply

| Condition                          | Add Label   |
| ---------------------------------- | ----------- |
| Sprint introduced a production fix | `bug`       |
| Sprint added new capability        | `feature`   |
| Sprint was infrastructure/ops      | `infra`     |
| Sprint was P0 (blocking)           | `P0-urgent` |
| Sprint was P1                      | `P1-high`   |

---

## When Linear Is Unavailable

If Linear MCP is unavailable during sync:

1. Continue updating all docs/status/ files
2. Add a note to the closeout report: `Linear sync pending`
3. Run Linear sync manually when access is restored using the comment template
   above

---

## Cycle Tracking

Linear cycles replace the `SPRINT-<NAME>-###` naming for execution tracking:

- Each sprint maps to an issue in the current cycle
- Cycles are team-level (Unit Talk team: `5aa1b0e9-a5af-43ad-8fb9-040efd4fa255`)
- Use `mcp__linear__list_cycles` to find active cycle when assigning issues

---

## Do Not

- Do not close issues without verifying the tag exists on remote
- Do not create duplicate issues for the same sprint
- Do not move to Done if the sprint branch was not merged
- Do not remove labels set by other team members
