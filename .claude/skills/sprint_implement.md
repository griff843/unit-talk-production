# Skill: Sprint Implement

> Model tier: **Sonnet** — mechanical code changes, file edits

## Purpose

Execute sprint tasks according to the plan, tracking progress throughout.

## Invocation

```
/sprint-implement
```

Assumes sprint plan already exists.

## Procedure

### Step 1: Load Plan

Read current sprint plan:

```bash
cat out/sprints/<SPRINT>/<DATE>/notes/plan.md
```

### Step 2: Track Progress

For each task:

1. **Mark as in-progress**
2. **Execute the task**
3. **Verify task completion**
4. **Mark as complete**

### Step 3: Implementation Rules

#### Code Changes

- Always read file before editing
- Use lifecycle adapters for `unified_picks` writes
- Add sprint reference comments:
  ```typescript
  // <SPRINT-NAME>: <brief description>
  ```

#### Testing

- Add tests for new functionality
- Ensure existing tests still pass
- Run relevant tests after each significant change:
  ```bash
  npm run test -- --testPathPattern="<pattern>"
  ```

#### Error Handling

If a task fails:

1. **STOP** - Do not proceed to next task
2. **ANALYZE** - Understand the root cause
3. **FIX** - Address the issue
4. **VERIFY** - Confirm fix works
5. **DOCUMENT** - Note the issue and resolution

### Step 4: Intermediate Verification

After completing a phase, run quick checks:

```bash
# Type check
npm run type-check

# Related tests
npm run test -- --testPathPattern="<affected area>"
```

### Step 5: Document Decisions

Write significant decisions to notes:

```bash
cat >> out/sprints/$SPRINT/$DATE/notes/decisions.md << 'EOF'
## Decision: <title>

**Context**: <why decision was needed>
**Decision**: <what was decided>
**Rationale**: <why this approach>
EOF
```

## Progress Reporting

After each phase, report:

```markdown
## Sprint Progress: <SPRINT-NAME>

### Phase X: <Name> ✅

| Task   | Status | Notes        |
| ------ | ------ | ------------ |
| Task 1 | ✅     | <brief note> |
| Task 2 | ✅     | <brief note> |

### Next: Phase Y

Proceeding with:

- Task 3
- Task 4
```

## Rules

1. **Follow the plan** - Don't add scope
2. **One task at a time** - Complete before moving on
3. **Verify frequently** - Catch issues early
4. **Document changes** - Sprint comments in code
5. **Stop on failure** - Fix before continuing
