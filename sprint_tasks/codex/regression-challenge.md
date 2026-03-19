# Codex Task: Regression Challenge Pass

**Mode**: read-only **Sprint**: <FILL IN: SPRINT-ID> **Agent**:
regression-challenger

## Objective

Perform an adversarial review of recent code changes to identify regressions,
logic errors, contract violations, or unintended side effects that tests and
type-checks may not catch.

## Scope

**IN scope:**

- <FILL IN: specific files or directories changed in this sprint>
- Related test files for the above
- Contracts and interfaces consumed by the changed code

**OUT of scope:**

- Modifying any files (this is a read-only review)
- Reviewing code not changed in this sprint
- Suggesting architectural redesigns
- Style or formatting feedback

## Constraints

- Read-only — do not modify any files
- Focus on functional correctness, not style
- Check against documented contracts in `docs/contracts/` if applicable
- Check single-writer discipline if `unified_picks` is involved
- Check idempotency guarantees if any write operations are changed
- Flag any behavior change that existing tests do not cover

## Required Output

```markdown
## Task Summary

- Task class: regression-challenge
- Mode: read-only
- Sprint: <SPRINT-ID>
- Files examined: <count>
- Files modified: 0

## Challenge Findings

### Blocking (must fix before merge)

| #   | File:Line   | Finding       | Severity | Category                            |
| --- | ----------- | ------------- | -------- | ----------------------------------- |
| 1   | <path:line> | <description> | BLOCKING | <logic/contract/safety/idempotency> |

### Advisory (should review, may not block)

| #   | File:Line   | Finding       | Severity | Category                            |
| --- | ----------- | ------------- | -------- | ----------------------------------- |
| 1   | <path:line> | <description> | ADVISORY | <logic/contract/safety/idempotency> |

## Contract Compliance

- Single-writer discipline: PASS/FAIL/N-A
- Idempotency guarantees: PASS/FAIL/N-A
- Lifecycle adapter usage: PASS/FAIL/N-A
- Error handling: PASS/FAIL/N-A

## Untested Behavior Changes

| File   | Change         | Covered by Test? |
| ------ | -------------- | ---------------- |
| <path> | <what changed> | YES/NO           |

## Verdict

- Status: PASS | FAIL | PARTIAL
- Confidence: HIGH | MEDIUM | LOW
- Blocking issues: <count>
- Advisory issues: <count>

## Acceptance Criteria Check

- [ ] All changed files reviewed
- [ ] Contract compliance checked where applicable
- [ ] Untested behavior changes identified
- [ ] No files modified (read-only task)
```

## Acceptance Criteria

- [ ] Every file changed in this sprint has been reviewed
- [ ] Blocking findings are clearly distinguished from advisory
- [ ] Contract violations (single-writer, idempotency) are flagged
- [ ] Untested behavior changes are enumerated
- [ ] No files modified (read-only task)
