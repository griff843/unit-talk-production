# Contracts Index

> **Sprint**: SPRINT-CLAUDE-CONTRACT-UNIFICATION-115A
> **Status**: AUTHORITATIVE
> **Last Updated**: 2026-02-22

This is the master index for all governance contracts in the Unit Talk Platform.

---

## Governance Hierarchy

```
CLAUDE.md (Root)                    ← Authoritative platform governance
├── CLAUDE_EXECUTION_CONTRACT.md    ← Hard law - non-negotiable invariants
├── docs/SYSTEM_INVARIANTS.md       ← 10 system invariants (permanent)
├── docs/ENV_CONTRACT.md            ← Environment variable contract
├── docs/BUILD_MATRIX.md            ← Build and CI gate requirements
├── docs/OPS_WIRING_PLAN.md         ← Ops flow for local/docker/ci/prod
└── apps/*/CLAUDE.md                ← Service-level governance
```

---

## Core Contracts

### Platform Level

| Document | Purpose | Location |
|----------|---------|----------|
| **CLAUDE.md** | Root governance, sprint protocol, service boundaries | `/CLAUDE.md` |
| **CLAUDE_EXECUTION_CONTRACT.md** | Hard law, non-negotiable invariants | `/CLAUDE_EXECUTION_CONTRACT.md` |
| **SYSTEM_INVARIANTS.md** | 10 permanent system rules | `/docs/SYSTEM_INVARIANTS.md` |

### Operations Contracts

| Document | Purpose | Location |
|----------|---------|----------|
| **ENV_CONTRACT.md** | Environment variable requirements by profile | `/docs/ENV_CONTRACT.md` |
| **BUILD_MATRIX.md** | Build gates and CI requirements | `/docs/BUILD_MATRIX.md` |
| **OPS_WIRING_PLAN.md** | Environment flows: local/docker/ci/prod | `/docs/OPS_WIRING_PLAN.md` |

### Service Contracts

| Service | Location | Role |
|---------|----------|------|
| **API** | `/apps/api/CLAUDE.md` | Canonical writer, agents, settlement |
| **Command Center** | `/apps/command-center/CLAUDE.md` | Read-only ops dashboard |
| **Dashboard** | `/apps/dashboard/CLAUDE.md` | Read-only analytics |
| **Discord Bot** | `/apps/discord-bot/CLAUDE.md` | Discord interactions |
| **Smart Form** | `/apps/smart-form/CLAUDE.md` | Ticket submission (bridge_outbox) |

### Package Contracts

| Package | Location | Purpose |
|---------|----------|---------|
| **config** | `/packages/config/CLAUDE.md` | Environment validation, Zod schemas |
| **shared-types** | `/packages/shared-types/CLAUDE.md` | Centralized TypeScript types |
| **shared-utils** | `/packages/shared-utils/CLAUDE.md` | Shared utilities, autopilot freeze |
| **telemetry** | `/packages/telemetry/CLAUDE.md` | OpenTelemetry instrumentation |

---

## Quick Health Check

Run these 5 commands to verify repo health:

```bash
# 1. Environment validation
pnpm ops:env:check

# 2. Type-check all apps
pnpm run type-check

# 3. Build matrix
pnpm ops:build:matrix

# 4. Single-writer gate
cd apps/api && pnpm run lifecycle:single-writer -- --strict

# 5. Command Center no-mocks gate
pnpm run cc:no-mocks
```

**All 5 must pass before merge.**

---

## Contract Compliance Checklist

Before any merge, verify:

- [ ] All services follow their CLAUDE.md boundaries
- [ ] ENV_CONTRACT.md requirements satisfied for target profile
- [ ] BUILD_MATRIX.md gates pass
- [ ] SYSTEM_INVARIANTS.md invariants enforced
- [ ] Proof artifacts generated in `out/sprints/`

---

## Modular Rules

Additional governance rules in `.claude/rules/`:

| Rule | Purpose |
|------|---------|
| `00-workflow.md` | Sprint workflow phases |
| `01-safety-and-proof.md` | Proof requirements |
| `02-db-migrations.md` | Migration standards |
| `03-single-writer-and-idempotency.md` | Single-writer enforcement |
| `04-testing-and-verification.md` | Testing requirements |
| `05-output-formats.md` | Documentation formats |

---

## Enforcement Points

| Contract | Enforcement Mechanism |
|----------|----------------------|
| Single-writer | `npm run lifecycle:single-writer -- --strict` |
| Fail-closed env | `pnpm ops:env:check` |
| No demo mode | `npm run cc:no-mocks` |
| Deploy paths | `npm run deploy:validate-paths` |
| Build gates | `pnpm ops:build:matrix` |
| Schema drift | `npm run schema:check-drift` (TODO) |

---

## References

- Sprint Governance: `docs/CLAUDE_OS_GOVERNANCE_CONTRACT.md`
- Sprint Template: `docs/claude/SPRINT_WORKFLOW_TEMPLATE.md`
- Prior Sprints: `out/sprints/*/`

---

**Document Owner**: Engineering Team
**Last Audit**: SPRINT-CLAUDE-CONTRACT-UNIFICATION-115A
