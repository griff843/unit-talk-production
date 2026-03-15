# Prompt Template: Repository Audit

> **When to use**: Periodic health check of the codebase against architectural
> standards. Use before a major milestone (layer completion, product launch) or
> after a batch of sprints to identify technical debt.
>
> **Ground first**: Run `pnpm ai:context` and paste
> `out/ai/context/context_bundle.md` before this prompt.

---

## Prompt

```
You are auditing the Unit Talk sports betting intelligence platform repository. I've provided the platform context above. Please conduct a repository health audit.

## Audit Focus

Primary focus: [Choose one or more]
- [ ] Single-writer discipline compliance
- [ ] Lifecycle adapter usage patterns
- [ ] Test coverage gaps by subsystem
- [ ] Deprecated table references (daily_picks, players, teams)
- [ ] MCP layer completeness
- [ ] Documentation freshness and gaps
- [ ] Technical debt in [SPECIFIC_AREA]

## Context

Current Layer/Phase: Layer 3 / Phase 10 — Command Center UX
Test suite state: Vitest api 978/978, claude-os 532/532, command-center 29/29; Jest api 643/643
Single-writer gate: PASS (998 files, 0 violations)
Sprint queue: [PASTE top 3 from NEXT_5_SPRINTS.md]

## What I Need

1. **Compliance Assessment** — For each selected focus area, assess compliance level:
   - GREEN: No issues found, well-implemented
   - YELLOW: Minor gaps, acceptable for current phase
   - RED: Structural issue, should be addressed before Layer 4

2. **Specific Violations** (if any) — For RED or YELLOW items, list specific patterns or file areas to investigate. Do not invent file contents — reference patterns from the context bundle.

3. **Technical Debt Inventory** — List the top 5 technical debt items ranked by blast radius × likelihood of causing problems in the next 3 sprints.

4. **Deprecation Sweep** — Are there known references to deprecated tables (daily_picks, players, teams) still active? What subsystems might still carry these?

5. **Documentation Gaps** — Based on the repo map and status docs, which subsystems or contracts lack documentation that could cause onboarding problems or sprint errors?

6. **Pre-Layer-4 Checklist** — What should be resolved before entering Layer 4 (Phases 12–14)? List as: MUST / SHOULD / NICE-TO-HAVE.

## Constraints

- Base all assessments on the provided context — don't invent gaps that aren't visible from the context
- If the context bundle is insufficient to assess an area, say "INSUFFICIENT CONTEXT — requires file read" rather than guessing
- Reference canonical docs (CLAUDE_EXECUTION_CONTRACT.md, lifecycle adapters, MCP schemas) when making compliance judgments

## Output Format

Use headers matching your selected focus areas, then: Technical Debt Inventory / Deprecation Sweep / Documentation Gaps / Pre-Layer-4 Checklist
Total response under 900 words. Use tables where it improves readability.
```

---

## Variables to Fill In

| Variable           | Description                   | Source          |
| ------------------ | ----------------------------- | --------------- |
| Focus areas        | Check the boxes that apply    | Your audit goal |
| `[SPECIFIC_AREA]`  | Specific area if custom focus | Your judgment   |
| Sprint queue top 3 | From NEXT_5_SPRINTS.md        | Status docs     |

---

## Recommended Audit Cadence

| Trigger                        | Recommended Focus                     |
| ------------------------------ | ------------------------------------- |
| After every 5 sprints          | Full audit (all focus areas)          |
| After a layer completion       | Pre-next-layer checklist              |
| After any P0/P1 incident       | Single-writer + lifecycle compliance  |
| Before onboarding new engineer | Documentation gaps                    |
| Before external review         | Full audit + technical debt inventory |
