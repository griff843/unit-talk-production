# Codex Task: <TASK-NAME>

**Mode**: read-only | bounded-write | verify **Sprint**: <SPRINT-ID> **Agent**:
repo-scan | fix-executor | publish-verifier | test-hardener |
migration-validator | regression-challenger

## Objective

<One sentence. What should Codex produce or accomplish?>

## Scope

**IN scope:**

- <specific files, directories, or systems Codex may access>

**OUT of scope:**

- <explicit boundaries — what Codex must not touch or modify>

## Constraints

- Do not modify files outside the IN scope list above
- Do not run destructive shell commands
- Do not redesign architecture or propose broad refactors
- Output must follow the Standard Output Contract below

## Required Output

<What Codex must produce: a structured report, specific file edits, JSON output,
etc. Include task-specific tables and sections here.>

### Standard Output Contract

All Codex outputs must include these sections (see
`docs/ai/CODEX_EXECUTION_PLANE.md` §5):

```markdown
## Task Summary

- Task class: <task-class>
- Mode: <read-only | bounded-write | verify>
- Sprint: <SPRINT-ID>
- Files examined: <count>
- Files modified: <count> (0 for read-only/verify)

## Findings

<Structured findings per task-specific sections above>

## Verdict

- Status: PASS | FAIL | PARTIAL
- Confidence: HIGH | MEDIUM | LOW
- Blocking issues: <count>
- Advisory issues: <count>

## Modified Files (bounded-write only)

| File   | Change        |
| ------ | ------------- |
| <path> | <description> |

## Acceptance Criteria Check

- [ ] <criterion>: PASS/FAIL
```

## Acceptance Criteria

- [ ] <Checkable criterion 1 — verifiable by a human or script>
- [ ] <Checkable criterion 2>
- [ ] No files modified outside scope (for read-only/verify tasks)
- [ ] Output conforms to Standard Output Contract
