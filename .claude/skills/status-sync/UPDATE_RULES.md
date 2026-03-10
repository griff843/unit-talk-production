# Status Sync — Update Rules

Decision authority for each doc in `docs/status/`. Apply these rules
deterministically every time `/status-sync` runs.

---

## CURRENT_SYSTEM_STATUS.md

### When to Update

| Condition                                                   | Update Required                       |
| ----------------------------------------------------------- | ------------------------------------- |
| Subsystem moved PARTIAL → VERIFIED                          | YES — update Status column + Evidence |
| Subsystem moved VERIFIED → PARTIAL                          | YES — update Status + Blocking Issues |
| Subsystem moved any state → BROKEN                          | YES — mark BROKEN, add blocker detail |
| Subsystem moved BROKEN → any state                          | YES — update per new evidence         |
| Infrastructure row changed (TypeScript, tests, gate, build) | YES                                   |
| Agent lifecycle compliance changed                          | YES — update Agent Status table       |
| No subsystem or infrastructure changed                      | NO                                    |

### Status Transition Rules

```
UNVERIFIED → PARTIAL    Only if code confirmed to exist but gaps remain
UNVERIFIED → VERIFIED   Only if full verification proof exists
PARTIAL    → VERIFIED   Only if ALL known blocking issues are resolved
PARTIAL    → BROKEN     Only if a previously working path is now confirmed broken
VERIFIED   → PARTIAL    If a regression is found or gate fails on this subsystem
BROKEN     → PARTIAL    If partial functionality is restored; blockers remain
BROKEN     → VERIFIED   Only with full proof; do not jump directly without evidence
```

### Forbidden Updates

- Do not set VERIFIED without evidence in a proof artifact
- Do not set BROKEN based on assumption alone — only on confirmed failure
- Do not change unrelated subsystem rows when only one subsystem was touched
- Do not change the `Last Updated` timestamp without making a real content
  change

---

## PHASE_STATUS.md

### When to Update

| Condition                                     | Update Required               |
| --------------------------------------------- | ----------------------------- |
| A phase milestone task is completed           | YES — mark ✅ on that task    |
| Phase completion % increases by ≥ 5%          | YES — update the % figure     |
| Phase 1 milestone completed → Phase 2 unlocks | YES — update both phases      |
| Sprint only partially addressed a phase goal  | NO — wait for full completion |
| Phase % would change by < 5%                  | NO — not worth the noise      |

### Phase Percentage Rules

- Phase % = (completed milestones / total milestones) × 100
- Round to nearest 5%
- Only increment — never decrement without explicit decision
- If a milestone was incorrectly marked complete, note the correction inline

### Phase Gate Rules

A phase does not advance until **all** CRITICAL milestones are ✅. OPTIONAL
milestones may remain pending without blocking phase advancement.

---

## NEXT_5_SPRINTS.md

### When to Update

| Condition                                     | Update Required                     |
| --------------------------------------------- | ----------------------------------- |
| Position 1 sprint was completed this session  | YES — remove it, promote position 2 |
| Sprint order changed due to new priority      | YES — reorder                       |
| A new sprint was added to the pipeline        | YES — add at appropriate position   |
| Position 1 sprint is still in progress        | NO                                  |
| Only notes/docs changed (no sprint work done) | NO                                  |

### Ordering Rules

1. P0 sprints (blocking, production-critical) always first
2. P1 sprints ordered by dependency chain
3. Never reorder without reviewing
   `docs/roadmap/INTELLIGENCE_PIPELINE_SPRINT_ORDER.md`
4. If a sprint is skipped due to governance decision, note it with `[SKIPPED]`
   and reason
5. Always maintain exactly 5 entries — add from roadmap backlog as needed

### Sprint Entry Format

```markdown
## 1. SPRINT-NAME-NNN — <Title>

**Priority**: P0 | P1 | P2 **Est. Effort**: X days **Depends On**: <sprint or
"none"> **Goal**: <one sentence>
```

---

## DRIFT_REPORT.md

### When to Update

**ADD a new drift item if:**

- A CRITICAL or HIGH issue is confirmed by a sprint audit
- A new gap between docs and actual behavior is found
- A verification failure reveals a systemic problem

**RESOLVE (remove) a drift item if:**

- The sprint explicitly fixed the reported issue
- Proof artifact confirms the fix (gate pass, test pass, etc.)
- The issue was found to be a documentation error, not a real gap

**DO NOT update if:**

- Sprint was informational only
- A MEDIUM/LOW drift item was partially improved but not fully resolved
- You are not certain whether the sprint addressed the drift item

### Severity Definitions

| Severity | Meaning                                                        |
| -------- | -------------------------------------------------------------- |
| CRITICAL | Blocks production or data integrity; must be fixed immediately |
| HIGH     | Degrades platform reliability; fix within current sprint cycle |
| MEDIUM   | Technical debt or gap; fix within 2–4 sprint cycles            |
| LOW      | Cosmetic, docs-only, or minor inconsistency                    |

### Resolved Entry Format

When a drift item is resolved, move it to the `## Resolved` section:

```markdown
| <DATE> | <SPRINT-NAME> | <Item description> | Was: <SEVERITY> |
```

---

## Linear State Transitions

### Issue State Rules

| Condition                                           | Linear State                      |
| --------------------------------------------------- | --------------------------------- |
| Sprint merged to main + tag exists                  | Done                              |
| Sprint in implementation (code written, not merged) | In Progress                       |
| Sprint blocked on another issue                     | Blocked (add blocking issue link) |
| Sprint planned but not started                      | Todo                              |
| Sprint cancelled or deferred                        | Canceled                          |

### When NOT to Move to Done

- Sprint branch exists but not merged
- Proof bundle incomplete
- Tag not yet minted
- Gate still failing

### Milestone Update Rules

- Update milestone progress when a sprint within the milestone is Done
- Milestone is complete only when ALL assigned issues are Done
- Never mark a milestone complete if any issue is Blocked

---

## Idempotency

This skill is safe to run multiple times on the same sprint:

- If a doc was already updated for this sprint, the timestamp will match
- The Linear comment will be a duplicate — acceptable; note it is a re-sync
- No destructive operations occur
