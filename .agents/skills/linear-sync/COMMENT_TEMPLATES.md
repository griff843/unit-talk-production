# Linear Sync — Comment Templates

Structured comment formats posted to Linear issues by `/linear-sync`. Each mode
has a specific template. Use exactly as written — these comments serve as the
audit trail between repo truth and Linear.

---

## sprint-start

Posted when a sprint begins implementation.

```markdown
🚀 Sprint Started — <SPRINT-NAME>

**Branch**: `sprint/<name-lowercase>` **Priority**: P0/P1/P2 **Phase**: Phase N
— <Name> **Model**: Sonnet / Opus **Cycle**: <cycle name>

**Objective**: <one sentence from NEXT_5_SPRINTS.md>

**Tasks**:

1. <task 1>
2. <task 2>
3. <task 3>

**Success Criteria**:

- <criterion 1>
- <criterion 2>

**Depends On**: <dependency sprint or "none">

---

_Synced by /linear-sync sprint-start_
```

---

## sprint-complete

Posted when a sprint is merged, tagged, and synced. This is the primary
traceability record between the repo proof bundle and Linear.

```markdown
✅ Sprint Complete — <SPRINT-NAME>

**Merged**: `sprint/<name>` → main (<commit SHA short>) **Tag**: `<SPRINT-TAG>`
(on remote) **Proof**: `out/sprints/<SPRINT>/<DATE>/` **Closeout**:
`SPRINT_CLOSEOUT_REPORT.md`

### Deliverables

- ✅ <task 1>
- ✅ <task 2>
- ❌ <task 3 — deferred> (if any)

**Completion**: N/M tasks

### Subsystem Impact

| Subsystem | Before   | After    |
| --------- | -------- | -------- |
| <name>    | <status> | <status> |

### Drift Impact

- **Resolved**: <N> items (<list or "none">)
- **New**: <N> items (<list or "none">)

### Phase Impact

- Phase <N>: <X>% → <Y>% (<milestone if applicable>)

### Next Sprint

<SPRINT-NAME-NNN> — <one-line goal>

---

_Synced by /linear-sync sprint-complete_
```

---

## blocked

Posted when a sprint is blocked by a dependency, external factor, or drift.

```markdown
⚠️ Sprint Blocked — <SPRINT-NAME>

**Reason**: <one-sentence blocker description> **Blocking Issue**: UNI-N
(<title>) or "external: <description>" **Blocking Sprint**:
<SPRINT-DEPENDENCY-NAME> (if applicable)

### Blocker Detail

<2–3 sentences explaining what is blocked and why>

### Unblock Criteria

- <what must happen for this to unblock>
- <specific deliverable or condition>

### Workaround

<if any partial workaround exists, describe it; otherwise "none">

---

_Synced by /linear-sync blocked_
```

---

## milestone-refresh

Posted as a project comment (not an issue comment) when refreshing milestone
progress.

```markdown
📊 Milestone Progress — <milestone-name>

**Project**: <project name> **As of**: <YYYY-MM-DD>

### Summary

**Done**: N / M issues (<X>%) **In Progress**: N **Blocked**: N **Todo**: N

### Completed Since Last Refresh

- UNI-N: <title> (Done <date>)
- UNI-N: <title> (Done <date>)

### Still Open

- UNI-N: <title> — <state> (<brief note if blocked>)
- UNI-N: <title> — <state>

### Target Date

**Original**: <date> **Current**: <date or "on track"> **Assessment**: On track
/ At risk / Overdue

---

_Synced by /linear-sync milestone-refresh_
```

---

## Notes on Comment Usage

### Sourcing data for templates

| Template field                     | Source                                           |
| ---------------------------------- | ------------------------------------------------ |
| Sprint name, branch, tag           | Git / operator input                             |
| Tasks, success criteria            | `docs/status/NEXT_5_SPRINTS.md` or sprint prompt |
| Deliverables, verification results | `SPRINT_CLOSEOUT_REPORT.md`                      |
| Subsystem impact, drift impact     | `SPRINT_CLOSEOUT_REPORT.md` Status Changes table |
| Phase impact                       | `docs/status/PHASE_STATUS.md` + closeout report  |
| Next sprint                        | `docs/status/NEXT_5_SPRINTS.md`                  |
| Milestone progress                 | Linear API (issue count by state)                |

### What NOT to include in comments

- Full proof file contents (too large — reference the path instead)
- Raw git diff output (reference `diffs/changes.diff`)
- Speculation about future sprints beyond the next one
- System status that didn't come from a canonical doc
