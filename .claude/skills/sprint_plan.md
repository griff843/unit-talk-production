# Skill: Sprint Plan

> Model tier: **Opus** — design decisions, scope definition, architectural
> tradeoffs

## Purpose

Create a structured plan for a sprint before implementation begins.

## Invocation

```
/sprint-plan <objective>
```

## Procedure

### Step 1: Parse Objective

Extract from user request:

- Primary goal
- Success criteria
- Scope boundaries

### Step 2: Context Gathering

Read relevant files:

```bash
# Check current state
git status

# Identify affected files
rg "<relevant pattern>" apps/api/src --type ts -l
```

### Step 3: Identify Implications

- [ ] Does this touch `unified_picks`? → Single-writer implications
- [ ] Does this add/modify schema? → Migration needed
- [ ] Does this affect agents? → Lifecycle adapter check
- [ ] Does this change API contracts? → E2E test implications

### Step 4: Create Sprint Directory

```bash
SPRINT="<CATEGORY>-<DESCRIPTION>-<NNN>"
DATE=$(date +%Y-%m-%d)
mkdir -p out/sprints/$SPRINT/$DATE/{proofs,diffs,notes}
```

### Step 5: Write Plan

Create `out/sprints/$SPRINT/$DATE/notes/plan.md`:

```markdown
# Sprint Plan: <SPRINT-NAME>

## Objective

<One sentence description>

## Success Criteria

- [ ] Criteria 1
- [ ] Criteria 2

## Tasks

### Phase 1: <Name>

1. [ ] Task 1
2. [ ] Task 2

### Phase 2: <Name>

1. [ ] Task 3
2. [ ] Task 4

## Files to Modify

| File            | Change      |
| --------------- | ----------- |
| path/to/file.ts | Description |

## Verification Plan

- [ ] Type check passes
- [ ] Tests pass (expected: X tests)
- [ ] Build succeeds
- [ ] Lifecycle gate passes (if applicable)

## Assumptions

- Assumption 1
- Assumption 2

## Questions (Critical Only)

- Question 1 (if any)
```

### Step 6: Validate Plan

Before proceeding:

- [ ] All affected files identified
- [ ] Single-writer implications addressed
- [ ] Verification steps defined
- [ ] No ambiguity in tasks

## Output

Present plan summary to user:

```markdown
## Sprint Plan: <SPRINT-NAME>

**Objective**: <one line>

**Tasks**: X tasks across Y phases

**Files**: Z files to modify

**Key Considerations**:

- <consideration 1>
- <consideration 2>

Plan written to: `out/sprints/<SPRINT>/<DATE>/notes/plan.md`

Ready to proceed with implementation?
```

## Notes

- Keep plans concise but complete
- Document assumptions explicitly
- Only ask questions that would change the approach
- Use judgment for non-critical decisions
