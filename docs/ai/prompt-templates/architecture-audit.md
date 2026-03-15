# Prompt Template: Architecture Audit

> **When to use**: Before a major architectural sprint, when a new system design
> is proposed, or when you want an outside perspective on structural decisions.
>
> **Ground first**: Run `pnpm ai:context` and paste
> `out/ai/context/context_bundle.md` before this prompt.

---

## Prompt

```
You are an expert systems architect reviewing the Unit Talk sports betting intelligence platform. I've provided context above. Please conduct an architecture audit focused on: [FOCUS AREA].

## Audit Scope

Focus area: [e.g., "the MCP layer design", "the pick lifecycle single-writer pattern", "the Layer 3 / Phase 10 Command Center UX architecture"]

## What I Need

1. **Strengths** — What architectural decisions are well-made and why?

2. **Risks** — What are the top 3 architectural risks in this area? For each:
   - What is the risk?
   - What is the blast radius if it materializes?
   - How likely is it given the current codebase state?

3. **Gaps** — What is missing or under-specified that could cause problems in the next 3 sprints?

4. **Recommendations** — For each gap or risk, one concrete recommendation. Reference specific files or packages where relevant.

5. **Invariants to Preserve** — List the architectural invariants that must not be broken by any change in this area (e.g., single-writer discipline for `unified_picks`, lifecycle adapter enforcement).

## Constraints

- Do not suggest changes that bypass the single-writer discipline (all `unified_picks` writes must go through lifecycle adapters in `apps/api/src/lib/lifecycle/`)
- Do not suggest removing idempotency guards on pick submission, posting, or settlement
- Reference the Layer/Phase model for sprint classification (Layer 3 / Phase 10 is current)
- If you're unsure about a specific implementation detail, say so — don't invent it

## Output Format

Use headers: Strengths / Risks / Gaps / Recommendations / Invariants to Preserve
Keep each point to 2–3 sentences max. Total response under 800 words.
```

---

## Variables to Fill In

| Variable       | Description                     | Example                |
| -------------- | ------------------------------- | ---------------------- |
| `[FOCUS AREA]` | The architectural area to audit | "the MCP layer design" |

---

## When This Template Is Most Useful

- Before SPRINT-054 (Replay Endpoint): audit the Temporal workflow integration
  architecture
- Before any Phase 11 work: audit the Operator Workflow Registry design
- After a DRIFT_REPORT shows CRITICAL architecture drift items
- When onboarding a new senior engineer or consultant
- Before a major dependency upgrade (Temporal, Supabase, Next.js)
