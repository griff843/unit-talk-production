# Mandatory Session Baseline Protocol

> **Sprint**: SPRINT-CLAUDE-OS-SESSION-ENFORCEMENT-110A **Authority**: CLAUDE.md
> §11 (Non-Negotiable)

---

## Required Pre-Sprint Actions

Before ANY code modification, Claude MUST:

1. **Run session baseline script**

   ```bash
   pnpm session:baseline
   ```

2. **Review diagnostics** - Check the generated `baseline-summary.md`

3. **Generate sprint plan** based on real errors from baseline

4. **Confirm no schema drift** - Supabase types must match schema

5. **Confirm working tree state** - Document dirty/clean status

## Baseline Output Location

```
out/session-baseline/<timestamp>/
├── baseline.json           # Structured data
└── baseline-summary.md     # Human-readable summary
```

## Pre-Sprint Check Gate

```bash
pnpm pre-sprint-check
```

This check:

- Verifies baseline was run within last 10 minutes
- Verifies no new blocking diagnostics
- **FAIL-CLOSED**: Sprint cannot begin if check fails

## Blocking Thresholds

| Check                 | Threshold | Action                                   |
| --------------------- | --------- | ---------------------------------------- |
| TypeScript errors     | > 0       | Sprint must address or justify exclusion |
| ESLint errors         | > 0       | Must address rule-by-rule before commit  |
| Supabase schema drift | detected  | Regenerate types immediately             |

## MCP Integration

Available MCP wrappers for diagnostics:

```bash
pnpm mcp:typescript   # TypeScript diagnostics
pnpm mcp:eslint       # ESLint analysis
pnpm mcp:git          # Git status/diff
pnpm mcp:workspace    # pnpm workspace graph
pnpm mcp:supabase     # Supabase schema introspection
```

## Enforcement Rules

1. **No sprint may begin without baseline artifacts**
2. **If baseline fails -> STOP and fix before proceeding**
3. **TypeScript diagnostics > 0**: Sprint must explicitly address them
4. **ESLint errors > threshold**: Must address before commit
5. **Schema drift detected**: Regenerate types immediately
