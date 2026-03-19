# Codex Task: Test Hardening

**Mode**: bounded-write **Sprint**: <FILL IN: SPRINT-ID> **Agent**:
test-hardener

## Objective

Add missing unit/integration tests for the specified module(s) to close coverage
gaps identified during sprint verification.

## Scope

**IN scope:**

- <FILL IN: exact file paths or directories to add tests for>
- Test files in the corresponding `__tests__/` directory
- Importing existing test utilities from `apps/api/src/test-utils/`

**OUT of scope:**

- Modifying production code (source files under test)
- Creating new test infrastructure or utilities
- Tests for modules not listed above
- E2E tests (those require separate orchestration)

## Constraints

- Tests must use vitest (not jest) —
  `import { describe, it, expect } from 'vitest'`
- Tests must follow existing patterns in `apps/api/src/**/__tests__/`
- No external network calls — mock all Supabase/Discord/Temporal dependencies
- No snapshot tests unless the module already uses them
- Each test file must be independently runnable: `npx vitest run <path>`
- Do not modify files outside the IN scope list above

## Required Output

```markdown
## Task Summary

- Task class: test-hardening
- Mode: bounded-write
- Sprint: <SPRINT-ID>
- Files examined: <count>
- Files modified: <count>

## Tests Added

| Test File | Tests Added | Module Under Test |
| --------- | ----------- | ----------------- |
| <path>    | <count>     | <source file>     |

## Coverage Delta

- Before: <if known>
- After: <if measurable>

## Verdict

- Status: PASS | FAIL | PARTIAL
- Confidence: HIGH | MEDIUM | LOW
- Blocking issues: <count>
- Advisory issues: <count>

## Modified Files

| File   | Change        |
| ------ | ------------- |
| <path> | <description> |

## Acceptance Criteria Check

- [ ] All new tests pass: `npx vitest run <paths>`
- [ ] No existing tests broken
- [ ] Tests mock external dependencies (no network calls)
- [ ] Test file naming follows `<module>.test.ts` convention
```

## Acceptance Criteria

- [ ] All new tests pass independently
- [ ] No existing tests broken by additions
- [ ] External dependencies are mocked (Supabase, Discord, Temporal)
- [ ] Tests cover the primary happy path and at least one error path per module
- [ ] No files modified outside scope
