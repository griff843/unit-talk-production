# Codex Task: Fix Executor Agent

**Mode**: bounded-write **Sprint**: <FILL IN: SPRINT-ID> **Agent**: fix-executor

## Objective

Execute the mechanical fix described below with precision. No architecture
decisions. No scope expansion. Implement exactly what is specified and stop.

---

## TASK DEFINITION

<!-- Fill in the specific fix below before running this agent -->

**Fix target**: <FILL IN: file path(s) to modify> **Fix description**:
<FILL IN: one-paragraph description of exactly what to change>

Example:

> In `apps/api/src/agents/DiscordPromotionAgent/index.ts`, the
> `buildParlayEmbed` function calls `pick.capper` directly. Change it to use
> `getCapper(pick)` from `./helpers` to match the buildEmbedFromPresentation
> pattern. No other changes.

---

## Scope

**IN scope:**

- <FILL IN: exact files allowed to be modified>

**OUT of scope:**

- All files not listed above
- Test files (unless the fix is test-only)
- Migration files
- Any config file not directly referenced in the fix description
- `docs/`, `out/`, `governance/` — never

## Constraints

- Implement only what is described in TASK DEFINITION above
- Do not add features, refactor surrounding code, or add comments
- Do not add error handling for hypothetical edge cases
- Do not modify imports unless the fix requires it
- If fix is ambiguous, stop and ask — do not guess
- After edits: run `pnpm type-check` to verify no new TypeScript errors

## Required Output

- Modified files only (no other changes)
- Brief summary: what was changed, in one paragraph
- TypeScript check result after edits

## Acceptance Criteria

- [ ] Only files in the IN scope list were modified
- [ ] Fix matches the TASK DEFINITION exactly
- [ ] No new TypeScript errors introduced
- [ ] No unrelated code touched
