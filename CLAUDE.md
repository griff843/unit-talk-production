# CLAUDE.md - Unit Talk Platform

> **SPRINT GOVERNANCE**: All sprint work MUST follow
> `docs/CLAUDE_OS_GOVERNANCE_CONTRACT.md` (authoritative). To close any sprint,
> run: `npm run sprint:close -- <SPRINT-ID>`

> **GOVERNANCE AUTHORITY**: This document + `CLAUDE_EXECUTION_CONTRACT.md`
> govern all AI operations. Modular rules: `.claude/rules/` | Agents:
> `.claude/agents/` | Skills: `.claude/skills/`

---

## Quick Reference

| Resource                                              | Purpose                                    |
| ----------------------------------------------------- | ------------------------------------------ |
| `docs/CLAUDE_OS_GOVERNANCE_CONTRACT.md`               | Sprint execution rules (authoritative)     |
| `CLAUDE_EXECUTION_CONTRACT.md`                        | Hard law - non-negotiable invariants       |
| `docs/02_architecture/claude_os_ceiling_blueprint.md` | Claude OS evolution authority              |
| `.claude/rules/*.md`                                  | Modular rule files                         |
| `.claude/rules/07-lane-model.md`                      | Lane model — parallel execution discipline |
| `.claude/agents/*.md`                                 | Specialist role definitions                |
| `.claude/skills/*.md`                                 | Repeatable procedures (invoke on-demand)   |
| `docs/claude/SPRINT_WORKFLOW_TEMPLATE.md`             | Sprint execution template                  |

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
└── .claude/              # Claude governance system
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

**Naming:** See `docs/claude/SPRINT_NAMING_CONVENTION.md` (canonical authority).

Two patterns:

- **Sequenced** (main queue): `SPRINT-NNN-DESCRIPTIVE-NAME` e.g.,
  `SPRINT-053-GOVERNANCE-NAMING-CONVENTION`
- **Non-sequenced** (governance/Claude OS): `SPRINT-DOMAIN-DESCRIPTOR` e.g.,
  `SPRINT-COS-007-SPRINT-CLOSE-VALIDATION`

> ⚠️ `SPRINT-<NAME>-###` (number at end) is the **legacy deprecated** pattern —
> do not use for new sprints.

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

> Full cross-reference with model tiers and lanes:
> `.claude/DELEGATION_MATRIX.md`

**Agents** (specialist roles - see `.claude/agents/`):

| Agent                    | Purpose                          | Model Tier |
| ------------------------ | -------------------------------- | ---------- |
| `@sprint-manager`        | Orchestrate sprint workflow      | Opus       |
| `@release-engineer`      | Deployment operations            | Sonnet     |
| `@migration-auditor`     | DB migration review              | Opus       |
| `@single-writer-sheriff` | Enforce single-writer discipline | Sonnet     |
| `@proof-bundler`         | Generate proof artifacts         | Haiku      |

**Skills** (procedures - see `.claude/skills/`):

| Skill                        | Purpose               | Model Tier |
| ---------------------------- | --------------------- | ---------- |
| `/skill sprint_plan`         | Phase 1 planning      | Opus       |
| `/skill sprint_verify`       | Phase 3 verification  | Sonnet     |
| `/skill sprint_proof_bundle` | Phase 4 proof capture | Haiku      |
| `/skill single_writer_audit` | Audit compliance      | Sonnet     |
| `/skill migration_review`    | Review migrations     | Opus       |
| `/skill e2e_smoke_check`     | E2E smoke test        | Haiku      |

---

## 10. Stop Conditions

**STOP and ask for clarification if:**

1. Unclear which lifecycle adapter to use
2. Migration affects production data
3. Single-writer violation detected
4. Tests fail after implementation
5. Proof artifacts cannot be generated

---

## 11. Mandatory Session Baseline (Non-Negotiable)

> Full protocol: `docs/claude/SESSION_BASELINE_PROTOCOL.md`

Before ANY code modification, run `pnpm session:baseline`. If baseline is stale
or missing, STOP. See protocol doc for thresholds, MCP wrappers, and enforcement
rules.

---

## 12. Sprint Order Enforcement

**Sole queue authority**: `docs/status/NEXT_5_SPRINTS.md`

No secondary source (roadmap, status doc, or AI memory) may override the queue.
`docs/roadmap/INTELLIGENCE_PIPELINE_SPRINT_ORDER.md` is historical reference
only — it is NOT a sprint-start authority.

Before beginning any new sprint, run:

```bash
pnpm sprint:gate
```

And if targeting a specific sprint:

```bash
node tools/governance/sprint-gate.js <SPRINT-ID>
```

If the gate fails, stop and report the mismatch instead of proceeding. If the
queue slot is vacant, missing, or unparseable — fail closed, do not proceed.

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
