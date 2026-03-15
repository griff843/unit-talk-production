# Prompt Template: Sprint Plan Review

> **When to use**: After `/sprint-plan` generates a sprint recommendation but
> before starting implementation. Use ChatGPT to sanity-check the plan against
> the broader architectural context.
>
> **Ground first**: Run `pnpm ai:context` and paste
> `out/ai/context/context_bundle.md` before this prompt.

---

## Prompt

```
You are reviewing a sprint plan for the Unit Talk platform. I've provided context above. Please review the following sprint plan for completeness, risk, and alignment.

## Sprint Plan to Review

Sprint Name: [SPRINT-NAME]
Objective: [ONE LINE OBJECTIVE]
Type: [Fix | Migration | Feature | Architecture | Audit | Activation]
Phase: [Layer N / Phase M — Name]
Model: [Sonnet | Opus | Haiku]

Tasks:
[PASTE TASK LIST FROM NEXT_5_SPRINTS.md]

Success Criteria:
[PASTE SUCCESS CRITERIA]

Dependencies: [DEPENDENCY SPRINT NAMES or "none"]

## What I Need

1. **Completeness Check** — Are there obvious tasks missing from this sprint that would be needed to achieve the stated success criteria?

2. **Risk Assessment** — What are the top 2 risks in executing this sprint? For each:
   - What could go wrong?
   - What is the mitigation?

3. **Dependency Validation** — Do the stated dependencies make sense? Are there undeclared dependencies (e.g., MCP tools, Temporal client, auth context) that the sprint assumes but doesn't list?

4. **Model Selection Validation** — Is the model choice (Sonnet/Opus/Haiku) appropriate for this sprint type? Reference the model selection rules if you have context on them.

5. **Success Criteria Completeness** — Are the success criteria specific and verifiable? Flag any that are vague (e.g., "works correctly") and suggest improvements.

6. **Scope Assessment** — Is the scope too large for a single sprint (1–3 days)? If so, what should be split out?

## Constraints

- Don't redesign the sprint — just flag gaps and risks
- Reference the Layer/Phase model when discussing priority
- If you're unsure about a specific codebase detail, say so

## Output Format

Use headers: Completeness / Risks / Dependencies / Model / Success Criteria / Scope
Keep total response under 600 words. Be direct — this is a pre-implementation review, not a design document.
```

---

## Variables to Fill In

| Variable                    | Description      | Source                            |
| --------------------------- | ---------------- | --------------------------------- |
| `[SPRINT-NAME]`             | Full sprint name | `NEXT_5_SPRINTS.md`               |
| `[ONE LINE OBJECTIVE]`      | Sprint objective | `NEXT_5_SPRINTS.md`               |
| `[Fix \| Migration \| ...]` | Sprint type      | `/sprint-plan` output             |
| `[Layer N / Phase M]`       | Current phase    | `docs/06_status/current_phase.md` |
| `[Sonnet \| Opus \| Haiku]` | Model choice     | `/sprint-plan` output             |
| Task list, success criteria | Sprint details   | `NEXT_5_SPRINTS.md`               |

---

## Typical Use Cases

- Reviewing SPRINT-054 (Replay Endpoint) before starting Temporal wiring
- Reviewing any sprint that touches multiple layers (e.g., CC UI + API +
  Temporal)
- Before a sprint that has no precedent in the codebase (new pattern)
- When the sprint plan was generated under time pressure and needs a second pass
