# AGENTS.md - Unit Talk Platform

> **SPRINT GOVERNANCE**: All sprint work MUST follow
> `docs/CLAUDE_OS_GOVERNANCE_CONTRACT.md` (authoritative). To close any sprint,
> run: `npm run sprint:close -- <SPRINT-ID>`

> **GOVERNANCE AUTHORITY**: This document + `CLAUDE_EXECUTION_CONTRACT.md`
> govern all AI operations. Modular rules: `.claude/rules/` | Agents:
> `.claude/agents/` | Skills: `.claude/skills/`

---

## Quick Reference

| Resource                                  | Purpose                                  |
| ----------------------------------------- | ---------------------------------------- |
| `docs/CLAUDE_OS_GOVERNANCE_CONTRACT.md`   | Sprint execution rules (authoritative)   |
| `CLAUDE_EXECUTION_CONTRACT.md`            | Hard law - non-negotiable invariants     |
| `.claude/rules/*.md`                      | Modular rule files                       |
| `.claude/agents/*.md`                     | Specialist role definitions              |
| `.claude/skills/*.md`                     | Repeatable procedures (invoke on-demand) |
| `docs/claude/SPRINT_WORKFLOW_TEMPLATE.md` | Sprint execution template                |

---

## 1. Absolute Rules

**FORBIDDEN:**

- Static claims ("100%", "Production Ready", hard-coded counts)
- Direct writes to `unified_picks` outside lifecycle adapters
- Claims without proof artifacts in `/out/sprints/...`
- Modifying settlement/immutable fields without authority

**REQUIRED:**

- All status from CI/CD, health endpoints, or database queries
- Proof artifacts for any "complete" statement
- Single-writer discipline via lifecycle adapters
- Sprint naming: `SPRINT-<NAME>-###`

---

## 2. Repository Structure

```
unit-talk-platform/
├── apps/
│   ├── api/              # Backend API & Agents (CANONICAL WRITER)
│   ├── command-center/   # Operations Dashboard (READ-ONLY)
│   ├── dashboard/        # Analytics Frontend (READ-ONLY)
│   ├── discord-bot/      # Discord Integration
│   └── smart-form/       # Ticket Submission (bridge_outbox ONLY)
├── packages/             # Shared packages
├── docs/                 # Documentation
├── out/                  # Sprint proofs & artifacts
│   └── sprints/<SPRINT>/<DATE>/
└── .claude/             # Claude governance system
```

---

## 3. Canonical Tables

| Table                     | Status         | Writer                       |
| ------------------------- | -------------- | ---------------------------- |
| `unified_picks`           | **CANONICAL**  | API (via lifecycle adapters) |
| `participants`            | **CANONICAL**  | SGO Sync (players/teams)     |
| `participant_memberships` | **CANONICAL**  | SGO Sync (player-team links) |
| `bridge_outbox`           | ACTIVE         | Smart Form                   |
| `agent_health`            | ACTIVE         | API Agents                   |
| `prop_settlements`        | ACTIVE         | SettlementAgent              |
| `daily_picks`             | **DEPRECATED** | NONE                         |
| `players`                 | **DEPRECATED** | NONE - use `participants`    |
| `teams`                   | **DEPRECATED** | NONE - use `participants`    |

---

## 4. Single-Writer Policy

**`unified_picks` writes MUST use lifecycle adapters:**

```typescript
import {
  lifecycleInsert,
  lifecycleUpdate,
  atomicClaimForPost,
} from '../lib/lifecycle';

// INSERT: submitter or promoter role
await lifecycleInsert(supabase, pick, { writerRole: 'submitter' });

// UPDATE: poster or settler role
await lifecycleUpdate(supabase, pickId, updates, { writerRole: 'poster' });

// ATOMIC CLAIM: idempotent posting
await atomicClaimForPost(supabase, pickId);
```

**Writer Roles:** | Role | Authority | |------|-----------| | `submitter` |
Initial pick creation | | `promoter` | Queue/promote picks | | `poster` |
Discord posting, receipt updates | | `settler` | Settlement operations | |
`operator_override` | Manual corrections |

**Gate Enforcement:** CI runs `npm run lifecycle:single-writer -- --strict`

---

## 5. Service Boundaries

### API (apps/api) - CANONICAL WRITER

- **OWNS:** Agents, Grading, Settlement, Lifecycle enforcement
- **MUST NOT:** Serve UI, handle Discord directly

### Smart Form (apps/smart-form)

- **OWNS:** Ticket UI, Form Validation
- **WRITES TO:** `bridge_outbox` ONLY (never unified_picks directly)

### Command Center / Dashboard

- **READ-ONLY** - No writes to business tables

---

## 6. Sprint Protocol

**Naming:** `SPRINT-<NAME>-###` (e.g., `SPRINT-LIFECYCLE-MIGRATION-038`)

**Proof Location:** `out/sprints/<SPRINT>/<YYYY-MM-DD>/`

**Required Artifacts:**

```
out/sprints/<SPRINT>/<DATE>/
├── proofs/
│   ├── proof_*.txt          # Command outputs
│   └── screenshots/         # Visual evidence
├── diffs/
│   └── *.diff               # Code changes
└── SPRINT_CLOSEOUT_REPORT.md
```

**Workflow:** See `docs/claude/SPRINT_WORKFLOW_TEMPLATE.md`

---

## 7. Verification Commands

```bash
# Single-writer gate (STRICT mode)
npm run lifecycle:single-writer -- --strict
# Working directory: apps/api

# Type check
npm run type-check

# Tests
npm run test:unit
npm run test:integration

# Lifecycle tests
npm run lifecycle:test
```

---

## 8. Development Commands

```bash
# Start environment
./dev.sh start

# Docker commands (preferred)
docker-compose exec api npm run <script>

# Database
docker-compose exec api npm run db:status
docker-compose exec api npm run db:migrate
```

---

## 9. Invoking Agents & Skills

**Agents** (specialist roles - see `.claude/agents/`):

- `@release-engineer` - Deployment operations
- `@migration-auditor` - DB migration review
- `@single-writer-sheriff` - Enforce single-writer discipline
- `@proof-bundler` - Generate proof artifacts
- `@sprint-manager` - Orchestrate sprint workflow

**Skills** (procedures - see `.claude/skills/`):

- `/skill sprint_plan` - Phase 1 planning
- `/skill sprint_verify` - Phase 3 verification
- `/skill sprint_proof_bundle` - Phase 4 proof capture
- `/skill single_writer_audit` - Audit compliance
- `/skill migration_review` - Review migrations
- `/skill e2e_smoke_check` - E2E smoke test

---

## 10. Stop Conditions

**STOP and ask for clarification if:**

1. Unclear which lifecycle adapter to use
2. Migration affects production data
3. Single-writer violation detected
4. Tests fail after implementation
5. Proof artifacts cannot be generated

---

## 11. 🔒 Mandatory Session Baseline (Non-Negotiable)

> **Sprint: SPRINT-CLAUDE-OS-SESSION-ENFORCEMENT-110A**

Before ANY code modification, Codex MUST:

### Required Pre-Sprint Actions

1. **Run session baseline script**

   ```bash
   pnpm session:baseline
   ```

2. **Review diagnostics** - Check the generated `baseline-summary.md`

3. **Generate sprint plan** based on real errors from baseline

4. **Confirm no schema drift** - Supabase types must match schema

5. **Confirm working tree state** - Document dirty/clean status

### Baseline Output Location

```
out/session-baseline/<timestamp>/
├── baseline.json           # Structured data
└── baseline-summary.md     # Human-readable summary
```

### Pre-Sprint Check Gate

```bash
pnpm pre-sprint-check
```

This check:

- Verifies baseline was run within last 10 minutes
- Verifies no new blocking diagnostics
- **FAIL-CLOSED**: Sprint cannot begin if check fails

### Blocking Thresholds

| Check                 | Threshold | Action                                   |
| --------------------- | --------- | ---------------------------------------- |
| TypeScript errors     | > 0       | Sprint must address or justify exclusion |
| ESLint errors         | > 0       | Must address rule-by-rule before commit  |
| Supabase schema drift | detected  | Regenerate types immediately             |

### MCP Integration

Available MCP wrappers for diagnostics:

```bash
pnpm mcp:typescript   # TypeScript diagnostics
pnpm mcp:eslint       # ESLint analysis
pnpm mcp:git          # Git status/diff
pnpm mcp:workspace    # pnpm workspace graph
pnpm mcp:supabase     # Supabase schema introspection
```

### Enforcement Rules

1. **No sprint may begin without baseline artifacts**
2. **If baseline fails → STOP and fix before proceeding**
3. **TypeScript diagnostics > 0**: Sprint must explicitly address them
4. **ESLint errors > threshold**: Must address before commit
5. **Schema drift detected**: Regenerate types immediately

---

## 12. Sprint Order Enforcement

Codex must follow the sprint order defined in:

`docs/status/NEXT_5_SPRINTS.md`

`docs/roadmap/INTELLIGENCE_PIPELINE_SPRINT_ORDER.md` is historical record only
for completed sprints 031–041 and is not a runtime queue authority.

Before beginning any new sprint, run:

```bash
pnpm sprint:gate
```

And if targeting a specific sprint:

```bash
node tools/governance/sprint-gate.js <SPRINT-ID>
```

If the gate fails, stop and report the mismatch instead of proceeding.

Do not begin a later sprint until the previous sprint is completed, committed,
and linked to the corresponding Linear issue.

If a user request conflicts with the locked sprint order, pause and propose the
required governance update before proceeding.

---

## 13. References

- **Execution Contract:** `CLAUDE_EXECUTION_CONTRACT.md`
- **System Invariants:** `docs/SYSTEM_INVARIANTS.md` (fail-open/fail-closed
  rules)
- **Sprint Template:** `docs/claude/SPRINT_WORKFLOW_TEMPLATE.md`
- **Lifecycle Contract:** `docs/contracts/PICK_LIFECYCLE_CONTRACT.md`
- **Prior Sprints:** `out/sprints/*/`

---

**Governance Owner:** Engineering Team **Architecture Verified:** Via CI/CD
pipelines and lifecycle gates

## Documentation Governance Rule

All canonical documentation must live under the structured hierarchy:

docs/ 01_principles 02_architecture 03_product 04_roadmap 05_operations
06_status

No new canonical documentation may be created outside this hierarchy.

Artifacts, reports, and generated outputs must live in:

out/ reports/ artifacts/

Legacy or superseded documents must be moved to:

docs/archive/
