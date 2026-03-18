# Codex Task: Repo Scan Agent

**Mode**: read-only **Sprint**: on-demand **Agent**: repo-scan

## Objective

Scan the Unit Talk codebase to identify TypeScript error clusters, schema/code
mismatches, broken API candidates, and lifecycle risk areas; output a structured
diagnostic report with ranked findings and recommended bounded execution tasks.

## Scope

**IN scope:**

- `apps/api/src/` — all TypeScript source files
- `apps/command-center/src/` — read for route/component issues
- `apps/smart-form/src/` — read for outbox/lifecycle issues
- `packages/` — shared package types and contracts
- `supabase/migrations/` — schema migration files
- `tools/governance/` — sprint gate and governance scripts

**OUT of scope:**

- Do not modify any file
- Do not run npm/pnpm install or any package manager commands
- Do not run test suites
- Do not propose architecture redesign

## Constraints

- Read-only only. Zero file writes.
- Focus on evidence from the repo — no speculation beyond what code shows.
- Do not propose broad rewrites. Identify specific, bounded problems.
- Prioritize issues that block production or lifecycle correctness.

## Required Output

Produce a structured report with these sections:

1. **Executive Summary** (3-5 sentences on overall repo health)
2. **Top 5 TypeScript/Build Error Clusters** (file path, error type, count)
3. **Top 5 Schema/Code Mismatch Candidates** (table or column mismatch, file)
4. **Top 5 Route/API Risk Areas** (endpoint, issue, severity)
5. **Lifecycle-Critical Files** (unified_picks, lifecycle adapters, agents)
6. **Recommended Next Bounded Execution Tasks** (max 5 tasks, each one sentence)

Format: Markdown with headers. Keep it scannable. No filler.

## Acceptance Criteria

- [ ] Executive summary present and grounded in repo evidence
- [ ] At least 3 TypeScript error clusters identified with file paths
- [ ] At least 2 schema/code mismatch candidates identified
- [ ] Recommended tasks are bounded (not "redesign the whole system")
- [ ] No files modified
