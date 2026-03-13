# Linear Sync — Mapping Rules

Field mapping, label assignment, issue creation, and milestone rules for syncing
repo truth into Linear.

---

## §Issue Finding Strategy

Search in this priority order:

1. **Exact title match**: `query="<SPRINT-NAME>"` (e.g.,
   `SPRINT-TEST-INFRA-RECOVERY`)
2. **Keyword match**: `query="<objective keywords>"` (e.g.,
   `test infra recovery`)
3. **Cycle scan**: List issues in current cycle; find by objective similarity
4. **Project scan**: List issues in the matching project (Platform, Ops & Infra,
   etc.)

If multiple issues match, report all and ask operator to disambiguate. Never
update the wrong issue.

---

## §Issue Creation Rules

When no matching issue exists, create one:

```
mcp__linear__save_issue with:
  title:    "<SPRINT-NAME> — <one-line objective>"
  team:     "Unit Talk"
  state:    <per mode: "In Progress" or "Done">
  priority: <from NEXT_5_SPRINTS.md or default 3 (Normal)>
  labels:   <per §Label Rules>
  description: <see below>
```

### Issue Description Template

```markdown
## Sprint: <SPRINT-NAME>

**Objective**: <from NEXT_5_SPRINTS.md or sprint prompt> **Priority**: P0/P1/P2
**Phase**: Phase N — <Name> **Branch**: `sprint/<name-lowercase>`

### Tasks

<task list from NEXT_5_SPRINTS.md or sprint prompt>

### Success Criteria

<criteria from NEXT_5_SPRINTS.md>

---

_Created by /linear-sync sprint-start_
```

### When NOT to create

- `blocked` mode with no matching issue → HALT and flag for operator
- When the sprint name is ambiguous (could match multiple existing issues)
- When the operator explicitly says "don't create"

---

## §State Mapping

### Sprint Condition → Linear State

| Condition                                | Linear State    | Verification Required        |
| ---------------------------------------- | --------------- | ---------------------------- |
| Sprint branch checked out, work starting | **In Progress** | Branch exists                |
| PR open for review                       | **In Review**   | PR URL available             |
| Merged to main + tag on remote           | **Done**        | `git ls-remote` confirms tag |
| Dependency incomplete                    | **Blocked**     | Dependency tag missing       |
| External blocker (env, API, infra)       | **Blocked**     | Blocker documented           |
| Sprint deferred or cancelled             | **Canceled**    | Operator decision            |

### State Transition Guards

| Transition        | Guard                                |
| ----------------- | ------------------------------------ |
| Any → In Progress | Branch must exist                    |
| Any → Done        | Tag MUST exist on remote             |
| Any → Blocked     | Blocker reason MUST be documented    |
| Done → Any        | Never reopen a Done issue            |
| Canceled → Any    | Only reopen if sprint is reactivated |

### What NOT to change

- Do not change state if the issue is already in the target state
- Do not move backwards (Done → In Progress) unless sprint was incorrectly
  closed
- Do not set a state that contradicts the repo truth

---

## §Priority Mapping

| NEXT_5_SPRINTS.md Priority | Linear Priority |
| -------------------------- | --------------- |
| P0 — CRITICAL              | 1 (Urgent)      |
| P1 — HIGH                  | 2 (High)        |
| P2 — MEDIUM                | 3 (Normal)      |
| Not specified              | 3 (Normal)      |

Only set priority on issue creation or `sprint-start`. Do not override priority
on `sprint-complete` (it may have been adjusted during the sprint).

---

## §Label Rules

### Apply labels based on sprint type

| Sprint Type                               | Labels to Add          |
| ----------------------------------------- | ---------------------- |
| Fix sprint (test recovery, build fix)     | `bug`, `infra`         |
| Migration sprint (single-writer, adapter) | `Improvement`, `infra` |
| Feature sprint (new capability)           | `Feature`              |
| Architecture sprint (cross-system design) | `Feature`, `infra`     |
| Audit/Truth sprint (docs, reconciliation) | `Improvement`          |
| Activation sprint (enable existing code)  | `Improvement`          |

### Priority labels

| Priority | Label               |
| -------- | ------------------- |
| P0       | `P0-urgent`         |
| P1       | `P1-high`           |
| P2       | (no priority label) |

### Sprint tracking label

Always add: `sprint` (identifies sprint-originated work).

### Label guard rules

- **Add only** — never remove labels set by other team members
- If a label doesn't exist, note it in the output — don't fail the sync
- Max labels per issue: no hard limit, but keep it reasonable (3–5)

---

## §Cycle Assignment

### On sprint-start

Assign the issue to the current active cycle:

```
mcp__linear__list_cycles with teamId="5aa1b0e9-a5af-43ad-8fb9-040efd4fa255" type="current"
```

If no current cycle exists, skip cycle assignment and note it.

### On sprint-complete

Do not change cycle assignment. The issue stays in whichever cycle it was
assigned to during sprint-start.

---

## §Milestone Rules

### Finding the milestone

Check the issue's existing milestone assignment:

```
mcp__linear__get_issue with id="<issue-id>"
```

If the issue has a milestone, use it. If not, check `NEXT_5_SPRINTS.md` for any
phase reference and look for a matching milestone in the project.

### Milestone progress update

**On sprint-complete (milestoned issue):**

1. Get all issues in the milestone
2. Count Done / Total
3. If all Done → milestone is complete
4. If not all Done → no milestone-level action

**On milestone-refresh:**

1. List all issues in the milestone
2. Count by state: Done / In Progress / Blocked / Todo
3. Post a progress comment to the project:

```markdown
## Milestone Progress: <milestone-name>

**Done**: N / M issues (<X>%) **In Progress**: N **Blocked**: N **Todo**: N

### Completed This Cycle

- UNI-N: <title>
- UNI-N: <title>

### Remaining

- UNI-N: <title> (<state>)
```

### When to update milestone targetDate

- If the milestone target date has passed and issues remain open: update to a
  realistic new date based on sprint estimates in NEXT_5_SPRINTS.md
- Never delete a milestone — update the date instead
- Always add a comment explaining the date change

---

## §Avoiding Overwrites

### Fields this skill may SET

| Field     | When                                   |
| --------- | -------------------------------------- |
| state     | All modes                              |
| assignee  | sprint-start only                      |
| priority  | sprint-start only (if not already set) |
| labels    | sprint-start and sprint-complete       |
| cycle     | sprint-start only                      |
| blockedBy | blocked mode only                      |

### Fields this skill must NEVER overwrite

| Field       | Reason                                         |
| ----------- | ---------------------------------------------- |
| title       | May have been edited by operator for clarity   |
| description | May contain operator notes beyond the template |
| estimate    | Set by team, not by sync                       |
| dueDate     | Set by team planning, not by sync              |
| parentId    | Issue hierarchy is a team decision             |

### Comment policy

- Comments are always **appended** (new comment), never edited
- Exception: if the most recent comment was posted by this skill within the last
  5 minutes and the sync is being re-run, it's acceptable to edit instead of
  double-posting
- Never delete comments

---

## §Discrepancy Handling

| Discrepancy                                     | Resolution                                      |
| ----------------------------------------------- | ----------------------------------------------- |
| Issue is Done but tag doesn't exist on remote   | Report — do NOT change issue state              |
| Issue is In Progress but branch doesn't exist   | Report — consider moving to Blocked or Todo     |
| Issue has labels that conflict with sprint type | Do NOT remove; add the correct labels alongside |
| Issue assigned to wrong cycle                   | Report — let operator decide                    |
| Multiple issues match sprint name               | List all; ask operator to disambiguate          |
| Milestone target date has passed                | Update date; post comment explaining            |
