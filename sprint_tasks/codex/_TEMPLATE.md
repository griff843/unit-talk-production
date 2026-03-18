# Codex Task: <TASK-NAME>

**Mode**: read-only | bounded-write | verify **Sprint**: <SPRINT-ID> **Agent**:
repo-scan | fix-executor | publish-verifier

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
- Output must follow the Required Output format below

## Required Output

<What Codex must produce: a structured report, specific file edits, JSON output,
etc.>

## Acceptance Criteria

- [ ] <Checkable criterion 1 — verifiable by a human or script>
- [ ] <Checkable criterion 2>
- [ ] No files modified outside scope (for read-only/verify tasks)
