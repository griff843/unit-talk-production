# AI_PROJECT_ADAPTER_UNIT_TALK_v1

**Status:** v1 — Active **Owner:** Griff **Project:** Unit Talk **Scope:**
Project adapter for the AI operating system **Purpose:** Define how the portable
AI operating core should interpret and operate within Unit Talk. **Created:**
2026-03-16 | **Sprint:** PORTABLE-CORE-EXTRACTION-059A

---

# 1. Project Identity

## 1.1 Name

Unit Talk

## 1.2 Domain Summary

Sports picks prediction platform with AI-assisted operator workflows, pick
lifecycle management, Discord delivery, and betting intelligence.

## 1.3 Primary Purpose

Ingest sports picks from providers and cappers, grade them through an AI scoring
engine, promote high-confidence picks to Discord channels, and settle outcomes —
with full lifecycle tracing and governance.

## 1.4 Primary Operating Surfaces

- `apps/api` — Backend API, agents, grading engine, settlement, lifecycle
  enforcement (CANONICAL WRITER)
- `apps/discord-bot` — Discord integration for pick delivery
- `apps/command-center` — Operator dashboard (read-only)
- `apps/dashboard` — Analytics frontend (read-only)
- `apps/smart-form` — Pick submission form (`bridge_outbox` ONLY)

## 1.5 Risk Profile Summary

Expensive mistakes:

- Writing to `unified_picks` outside lifecycle adapters (single-writer
  violation)
- Pick duplication (same pick submitted/posted twice)
- Settlement data corruption (immutable fields overwritten)
- Posting incorrect picks to Discord (visible to subscribers)
- Schema migrations without rollback (production data at risk)
- Phase sequencing violations (Layer 3 cannot proceed until Layer 2 is complete)

---

# 2. Canonical Documentation Map

## 2.1 Canonical Roadmap Docs

- `docs/roadmap/INTELLIGENCE_PIPELINE_SPRINT_ORDER.md` — Sprint gate authority
  (what runs in what order)
- `docs/status/NEXT_5_SPRINTS.md` — Next sprint queue (most important for sprint
  shaping)

## 2.2 Canonical Current-State Docs

- `docs/06_status/current_phase.md` — **Authoritative** current phase/layer
  position (read THIS first)
- `docs/status/PHASE_STATUS.md` — Operational percentages only (NOT sprint
  classification authority)
- `docs/status/CURRENT_SYSTEM_STATUS.md` — System health summary

## 2.3 Canonical Architecture Docs

- `docs/02_architecture/claude_os_ceiling_blueprint.md` — Claude OS evolution
  authority
- `docs/contracts/PICK_LIFECYCLE_CONTRACT.md` — Pick lifecycle rules
- `docs/SYSTEM_INVARIANTS.md` — Fail-open/fail-closed system rules
- `apps/api/src/lib/lifecycle/` — Lifecycle adapter source (canonical
  single-writer implementation)

## 2.4 Canonical Governance Docs

- `docs/CLAUDE_OS_GOVERNANCE_CONTRACT.md` — Sprint execution rules
  (authoritative)
- `CLAUDE_EXECUTION_CONTRACT.md` — Hard law non-negotiable invariants
- `CLAUDE.md` — Quick reference (references above)

## 2.5 Canonical Status Docs

- `docs/06_status/current_phase.md` — Phase position
- `docs/status/NEXT_5_SPRINTS.md` — Sprint queue
- `out/sprints/*/SPRINT_CLOSEOUT_REPORT.md` — Sprint closeout truth (local,
  gitignored)

## 2.6 Precedence Rules

1. `CLAUDE_EXECUTION_CONTRACT.md` supersedes everything for hard invariants
2. `docs/CLAUDE_OS_GOVERNANCE_CONTRACT.md` governs sprint execution
3. `docs/06_status/current_phase.md` is authoritative for phase classification
   (not `PHASE_STATUS.md`)
4. `docs/roadmap/INTELLIGENCE_PIPELINE_SPRINT_ORDER.md` governs sprint ordering
5. If two docs conflict on current state, `current_phase.md` wins over
   `PHASE_STATUS.md`

---

# 3. Roadmap / Phase Model

## 3.1 Model in Use

Layered phase model: Layer 1 (phases 0–5), Layer 2 (phases 6–8), Layer 3 (phases
9–14+), Claude OS (parallel track).

## 3.2 Current Active Phase (2026-03-16)

- **Layer 1**: ALL phases 0–5 COMPLETE
- **Layer 2**: ALL phases 6–8 COMPLETE
- **Layer 3**: Phase 9 (Smart Form) COMPLETE, Phase 10 (Command Center) IN
  PROGRESS (~80%), Phase 11 (Operator Workflows) ~45%
- **Claude OS**: ALL COS-001 through COS-007 COMPLETE
- Next sprint queue: vacant after SPRINT-059-AI-OS-WAVE2-AGENTS

## 3.3 Sequencing Rules

- Layer phases must advance in order within a layer
- Layer 3 cannot be materially advanced until Layer 2 is complete (it is)
- Claude OS sprints are parallel track — do not block Layer sprints
- The gate tool `pnpm sprint:gate` enforces sprint ordering
- Run `node tools/governance/sprint-gate.js <SPRINT-ID>` before beginning any
  sequenced sprint

## 3.4 Advancement Requirements

- All merge gates must pass: `npm run type-check`, `npm run test`,
  `npm run build`, `npm run lifecycle:single-writer -- --strict`
- Proof artifacts must exist in `out/sprints/<SPRINT>/<DATE>/`
- Sprint must be tagged and merged to main
- Linear issue must be set to Done

---

# 4. Status Surfaces

## 4.1 Primary Current-State Sources

- `docs/06_status/current_phase.md` — phase and layer position
- `docs/status/PHASE_STATUS.md` — percentage completions (advisory)
- `docs/status/CURRENT_SYSTEM_STATUS.md` — system health summary

## 4.2 Sprint Closeout Source

`out/sprints/<SPRINT>/<DATE>/SPRINT_CLOSEOUT_REPORT.md` (gitignored — stays
local)

## 4.3 Backlog / Findings Source

- Linear issues (`UNI-N` format) — open/in-progress issues
- `out/findings/` — finding backlog automation output (gitignored)

## 4.4 Freshness Expectation

- Status docs should be updated within 1 sprint of completion
- `current_phase.md` should reflect the last merged sprint
- Context bundle (`pnpm ai:context`) should be regenerated before any ChatGPT
  architecture session

---

# 5. Truth Sources

## 5.1 Repo Truth Sources

- `apps/api/src/lib/lifecycle/` — canonical single-writer implementation
- `packages/mcp-*/src/` — MCP truth surfaces
- `docs/contracts/` — binding contracts
- `supabase/migrations/` — schema history

## 5.2 Artifact Truth Sources

- `out/sprints/*/SPRINT_CLOSEOUT_REPORT.md` — sprint completion evidence
- `out/sprints/*/proofs/` — verification proofs
- `governance/closeouts/` — governed tag markers

## 5.3 Runtime / Verification Truth Sources

- `GET /api/health/summary` — platform health
- `GET /api/slo/status` — SLO attainment
- `GET /ops/workflows` — operator workflow registry
- CI artifacts — build/test/gate results

## 5.4 Diagnostic Truth Surfaces

- `/pipeline-health` skill — agent health, outbox depth, SLOs
- `/pick-trace <uuid>` skill — pick lifecycle trace
- `/slo-report` skill — SLO attainment report
- `/edge-check` skill — CLV edge and calibration
- MCP packages: `mcp-ops`, `mcp-state`, `mcp-intelligence`, `mcp-decision`

---

# 6. Artifact Conventions

## 6.1 Proof Bundle Conventions

Path: `out/sprints/<SPRINT>/<DATE>/proofs/` Files: `proof_git_status.txt`,
`proof_tests.txt`, `proof_typecheck.txt`, `proof_build.txt`, `proof_gate.txt`

## 6.2 Sprint Artifact Conventions

Root: `out/sprints/<SPRINT>/<DATE>/` Required: `proofs/`,
`SPRINT_CLOSEOUT_REPORT.md` Optional: `diffs/`, `notes/` Note: `out/` is
gitignored — proof artifacts stay local

## 6.3 Audit Artifact Conventions

Findings: `out/findings/` (gitignored) Governance closeouts:
`governance/closeouts/<TAG-NAME>.md` (committed)

## 6.4 Durable Reference Doc Conventions

- Architecture decisions → `docs/02_architecture/`
- Contracts → `docs/contracts/`
- Sprint status → `docs/06_status/`
- AI operating docs → `docs/ai/`

---

# 7. Governance / Closeout Path

## 7.1 Required Closeout Path

1. Type check passes (`npm run type-check`)
2. Tests pass (`npm run test`, `npm run test:vitest`)
3. Build passes (`npm run build`)
4. Lifecycle gate passes (`npm run lifecycle:single-writer -- --strict`)
5. Proof artifacts generated in `out/sprints/<SPRINT>/<DATE>/proofs/`
6. SPRINT_CLOSEOUT_REPORT.md written
7. Changes committed with sprint reference
8. Governance closeout marker at `governance/closeouts/<TAG>.md`
9. Sprint tag minted by CI
10. Merged to main, tags pushed
11. Linear issue set to Done

## 7.2 Proof Requirements

Minimum proof bundle:

- `proof_git_status.txt`
- `proof_tests.txt`
- `proof_typecheck.txt`
- `proof_gate.txt` (if unified_picks touched)

## 7.3 Verification Rules

All four merge gates must pass (type-check, build, test, lifecycle gate). Sprint
is NOT complete until tag appears on remote.

## 7.4 Exceptions

Docs-only sprints (Lane 4) may skip build/test if no code changed, but still
require SPRINT_CLOSEOUT_REPORT.md and governance closeout marker.

---

# 8. Domain-Sensitive Boundaries

## 8.1 Project-Local Business/Domain Logic

- Pick lifecycle semantics (unified_picks stages: submitted → graded → promoted
  → posted → settled)
- Provider offer ingestion and bridge_outbox pattern
- Discord channel routing and pick posting behavior
- CLV edge calculation and calibration assessment
- Betting-specific market types, exposure caps, and risk logic
- Settlement/grading reconciliation workflows

## 8.2 Project-Local Invariants

- All `unified_picks` writes MUST use lifecycle adapters (single-writer policy)
- Direct Supabase writes to `unified_picks` are forbidden everywhere except
  `apps/api/src/lib/lifecycle/`
- Settlement fields are immutable once written
- `bridge_outbox` is the ONLY write surface for `apps/smart-form`
- `daily_picks`, `players`, `teams` tables are deprecated — use `unified_picks`,
  `participants`

## 8.3 Project-Local Delivery Semantics

- Discord channel IDs are environment variables — never hardcoded
- Pick posting is idempotent (atomic claim via `posted_to_discord` flag)
- Parlay posting uses `atomicClaimParlayForPost`
- BridgeWorker processes `bridge_outbox` records

## 8.4 Non-Portable Areas (must remain local)

- `apps/api/src/lib/lifecycle/` — entire lifecycle adapter layer
- `apps/api/src/agents/` — all agent implementations
- `packages/mcp-*/` — all MCP packages (expose UT truth surfaces)
- `docs/ai/intelligence-reviews/` — betting intelligence review procedures
- All skills: `pick-trace`, `edge-check`, `grading-audit`,
  `intelligence-analysis`, `lifecycle-diagnose`, `risk-policy`,
  `settlement-integrity`, `single_writer_audit`

---

# 9. Adapter-Based Helper Configuration

## 9.1 Sprint Planning Agent Inputs

Primary: `docs/status/NEXT_5_SPRINTS.md` Supporting:
`docs/06_status/current_phase.md`, `docs/status/PHASE_STATUS.md` Gate:
`pnpm sprint:gate` — run before recommending any sequenced sprint Constraint:
Must not recommend a sprint that is not next in the ordered queue

## 9.2 Incident Triage Agent Inputs

Primary: Run `/pipeline-health` first Secondary: `/slo-report`, `/pick-trace`
for specific picks Escalation: Context bundle + ChatGPT for multi-subsystem
issues

## 9.3 Architecture Audit Agent Inputs

Primary: `docs/02_architecture/claude_os_ceiling_blueprint.md` Supporting:
`docs/contracts/PICK_LIFECYCLE_CONTRACT.md`, `docs/SYSTEM_INVARIANTS.md`
Context: Fresh `pnpm ai:context` bundle

## 9.4 Intelligence Review Agent Inputs

Primary: `docs/ai/intelligence-reviews/*.md` procedures Supporting:
`/edge-check`, `/slo-report` skill outputs Domain: Betting intelligence — CLV,
calibration, strategy, risk

## 9.5 Status Sync Inputs

Primary: `docs/06_status/current_phase.md` Supporting:
`docs/status/PHASE_STATUS.md`, `docs/status/CURRENT_SYSTEM_STATUS.md` Source:
Latest sprint closeout report

## 9.6 Prompt Composer Constraints

Must respect:

- Single-writer policy in any implementation that touches `unified_picks`
- Lifecycle adapter pattern (no direct Supabase writes in api)
- Migration rollback requirement
- Sprint gate ordering

---

# 10. Adapter-Based Hook Configuration

## 10.1 Context Refresh Triggers

- After any sprint closes
- Before any ChatGPT architecture session
- When `current_phase.md` has not been updated in more than 7 days

## 10.2 Handoff Triggers

- ChatGPT produces an architecture decision for a sequenced sprint
- A diagnosis produces a confirmed fix requiring code changes

## 10.3 Closeout Routing Triggers

- Any behavior-changing implementation landing in main
- Any schema migration applied
- Any sprint tag being generated

## 10.4 Artifact Routing Triggers

Sprint artifacts → `out/sprints/<SPRINT>/<DATE>/` Proof files →
`out/sprints/<SPRINT>/<DATE>/proofs/` Governance closeouts →
`governance/closeouts/<TAG>.md`

## 10.5 Phase-Sensitive Routing Triggers

If work targets a Layer 3 phase: confirm Layer 2 is complete before proceeding
Run `pnpm sprint:gate` before shaping any sequenced sprint

## 10.6 Skill-Routing Triggers

Platform health question → `/pipeline-health` first Specific pick issue →
`/pick-trace <uuid>` SLO question → `/slo-report` Edge/calibration question →
`/edge-check`

---

# 11. Project-Specific Skill Surface

## 11.1 Current Project-Specific Skills

- `pick-trace` — unified_picks lifecycle trace
- `edge-check` — CLV edge and calibration audit
- `grading-audit` — scoring/grading layer review
- `intelligence-analysis` — CLV/calibration/risk review
- `lifecycle-diagnose` — lifecycle stage diagnosis
- `risk-policy` — market exposure cap audit
- `settlement-integrity` — settlement record check
- `single_writer_audit` — single-writer gate audit
- `discord-diagnose` — Discord delivery diagnosis (referenced in Wave 2 docs,
  may be `.claude/agents/` level)
- `scoring-audit` — scoring/edge review

## 11.2 Adapter-Based Skills (portable pattern, UT implementation)

- `pipeline-health` — overall platform health
- `slo-report` — SLO attainment
- `sprint_plan` — sprint planning
- `sprint_verify` — sprint verification gates
- `sprint_proof_bundle` — proof artifact generation
- `e2e_smoke_check` — E2E smoke test
- `migration_review` — migration review discipline

## 11.3 Possible Future Generalization Candidates

- `pipeline-health` → generic system-health skill pattern
- `slo-report` → generic SLO reporting pattern
- `discord-diagnose` → generic delivery-channel-diagnose pattern

---

# 12. Project-Specific Constraints and Cautions

## 12.1 Important Constraints

- NEVER run `git push --force` to main
- NEVER skip `--no-verify` on commits
- NEVER write directly to `unified_picks` outside lifecycle adapters
- NEVER modify settlement/immutable fields
- NEVER commit `apps/api/scripts/productionDashboard.ts` (Prettier parse
  failure)
- NEVER assume `daily_picks`, `players`, or `teams` tables are active
  (deprecated)

## 12.2 Common Failure Modes

- Single-writer violations (direct
  `supabase.from('unified_picks').insert/update`)
- Schema drift (Supabase types not regenerated after migrations)
- Squash-merge dropping governance closeout markers (use separate branch if
  needed)
- Phase status drift (PHASE_STATUS.md not updated after sprints)
- Sprint gate ordering violations (later sprint started before earlier one is
  complete)

## 12.3 Common Drift Risks

- `docs/06_status/current_phase.md` becoming stale after sprints
- `docs/status/NEXT_5_SPRINTS.md` not being refreshed between sprints
- `AI_PROJECT_ADAPTER_UNIT_TALK_v1.md` (this file) not being updated after major
  phase changes
- MCP packages built but not rebuilt after source changes

## 12.4 Unsafe Assumptions to Avoid

- Assuming `PHASE_STATUS.md` is authoritative for sprint classification (it is
  NOT — use `current_phase.md`)
- Assuming all four build commands are identical across apps (command-center,
  smart-form, dashboard all use Next.js; api uses ts-node/esbuild)
- Assuming test suite is a single runner (it's dual: Jest for `test/` dir,
  Vitest for `src/**/__tests__/`)
- Assuming all pnpm install operations work cleanly on Windows (husky prepare
  fails — expected)
- Assuming the governed tag appears immediately after merge (wait 2 minutes; if
  not, trigger workflow dispatch)
