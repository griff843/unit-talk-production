# Canonical Document Set

**Sprint**: SPRINT-PLATFORM-TRUTH-AUDIT **Date**: 2026-03-09 **Total
Documentation Files**: ~4,271

---

## CANONICAL (Authoritative — current system of record)

| Document                               | Purpose                                                             | Location                                              |
| -------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------- |
| CLAUDE.md                              | Sprint governance entry point                                       | `/CLAUDE.md`                                          |
| CLAUDE_EXECUTION_CONTRACT.md           | Hard law, non-negotiable invariants                                 | `/CLAUDE_EXECUTION_CONTRACT.md`                       |
| CLAUDE_OS_GOVERNANCE_CONTRACT.md       | Sprint execution rules (AUTHORITATIVE)                              | `docs/CLAUDE_OS_GOVERNANCE_CONTRACT.md`               |
| INTELLIGENCE_PIPELINE_SPRINT_ORDER.md  | Intelligence sprint ordering (LOCKED)                               | `docs/roadmap/INTELLIGENCE_PIPELINE_SPRINT_ORDER.md`  |
| ARCHITECTURE_MIGRATION_SPRINT_ORDER.md | Architecture migration sprint ordering (LOCKED)                     | `docs/roadmap/ARCHITECTURE_MIGRATION_SPRINT_ORDER.md` |
| SYSTEM_INVARIANTS.md                   | Non-negotiable system rules                                         | `docs/SYSTEM_INVARIANTS.md`                           |
| PICK_LIFECYCLE_CONTRACT.md             | Pick lifecycle state machine contract                               | `docs/contracts/PICK_LIFECYCLE_CONTRACT.md`           |
| Governance Rules (6 files)             | Sprint workflow, safety, migrations, single-writer, testing, output | `.claude/rules/00-05-*.md`                            |
| Governance v1 (locked)                 | Constitution, execution contract, env contract, invariants          | `governance/v1/*.md`                                  |
| Architecture contracts (66 files)      | Distribution, operational, repo-truth contracts                     | `architecture/contracts/`                             |
| PICK_LIFECYCLE_v1.0.md                 | Pick lifecycle state machine                                        | `architecture/state-machines/PICK_LIFECYCLE_v1.0.md`  |
| TABLE_CLASSIFICATION_SPEC.md           | Canonical table ownership                                           | `docs/governance/TABLE_CLASSIFICATION_SPEC.md`        |
| AGENT_OWNERSHIP_MATRIX.md              | Agent responsibility boundaries                                     | `docs/governance/AGENT_OWNERSHIP_MATRIX.md`           |

---

## REFERENCE (Accurate but informational, not governing)

| Document                             | Purpose                                 | Location                                   |
| ------------------------------------ | --------------------------------------- | ------------------------------------------ |
| CANONICAL_SCHEMA_V2.md               | Schema reference (still valid)          | `docs/architecture/CANONICAL_SCHEMA_V2.md` |
| ERD_SCHEMA.md                        | Entity relationship diagrams            | `docs/architecture/ERD_SCHEMA.md`          |
| REPO_MAPPING.md                      | Repository structure map                | `docs/architecture/REPO_MAPPING.md`        |
| SCORING_AUTHORITY.md                 | Scoring authority model                 | `docs/architecture/SCORING_AUTHORITY.md`   |
| CONTRACTS_INDEX.md                   | Contract catalog                        | `docs/CONTRACTS_INDEX.md`                  |
| ENV_CONTRACT.md                      | Environment variables reference         | `docs/ENV_CONTRACT.md`                     |
| AGENTS.md                            | Agent specifications overview           | `docs/AGENTS.md`                           |
| BASE_AGENT_SPEC.md                   | Base agent specification                | `docs/BASE_AGENT_SPEC.md`                  |
| System current state docs (15 files) | Current system status snapshots         | `docs/system/current/`                     |
| System target state docs (3 files)   | Target architecture definition          | `docs/system/target/`                      |
| Operations SOPs (10+ files)          | Standard operating procedures           | `docs/ops/sop/`                            |
| API specs (4 files)                  | Route specs, error codes, rate limiting | `docs/api/v1/`                             |
| ADR-001                              | Agent architecture decision             | `docs/adr/001-agent-architecture.md`       |
| Architecture diagrams (5 files)      | Visual architecture models              | `docs/architecture/diagrams/`              |
| App-specific CLAUDE.md files         | Per-app governance                      | `apps/*/CLAUDE.md`                         |

---

## SUPERSEDED (Replaced by newer documents — keep for reference only)

| Document                                      | Replaced By                                                              | Location                     |
| --------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------- |
| UNIT_TALK_MASTER_SYSTEM_BLUEPRINT_v2.0.md     | System current/target docs + invariants                                  | `docs/blueprints/`           |
| PRODUCTION_DOMINANCE_ROADMAP_v2.0.md          | INTELLIGENCE_PIPELINE_SPRINT_ORDER + ARCHITECTURE_MIGRATION_SPRINT_ORDER | `docs/blueprints/`           |
| PHASE_2A_INTELLIGENCE_SUPERIORITY_AUDIT_v1.md | Gap analysis + migration sprint order                                    | `docs/blueprints/`           |
| database-schema-v3.md                         | CANONICAL_SCHEMA_V2.md + supabase migrations                             | `docs/database-schema-v3.md` |
| DISCORD_DELIVERY_AND_FANOUT_PLAN.md           | Discord distribution contracts                                           | `docs/architecture/`         |
| V3_ELITE_ROADMAP.md                           | Sprint orders (locked)                                                   | `docs/architecture/`         |
| PIPELINE_CONTRACT_CLEANROOM_V3.md             | Pick lifecycle contract + state machine                                  | `docs/architecture/`         |
| STAT_PROJECTION_ARCHITECTURE_v2.md            | Completed via SPRINT-032/032A                                            | `docs/architecture/`         |
| 15+ blueprint spec files                      | Completed or superseded by sprints                                       | `docs/blueprints/`           |
| SMARTFORM_DATA_CONTRACT_V1.md                 | SMARTFORM_DATA_CONTRACT_V2.md                                            | `docs/contracts/`            |
| Architecture \_archive/ (25 files)            | Current v1.0 contracts                                                   | `architecture/_archive/`     |

---

## ARCHIVED (Historical — no longer representing current system)

| Category                | Count | Location                           |
| ----------------------- | ----- | ---------------------------------- |
| Deprecated systems docs | 23    | `docs/archive/deprecated-systems/` |
| Historical plans        | 23    | `docs/archive/historical-plans/`   |
| Analysis documents      | 4     | `docs/archive/analysis/`           |
| Session reports         | 60+   | `docs/archive/session-reports/`    |
| Sprint artifacts        | 13    | `docs/archive/sprint-artifacts/`   |
| Sprint proof bundles    | 1000+ | `out/sprints/`                     |
| Huly OS tooling         | 10+   | `tools/huly-os/` (deprecated)      |

---

## CLASSIFICATION NOTES

1. **Blueprint bloat**: 20+ blueprint/spec documents in `docs/blueprints/` are
   largely superseded by the locked sprint orders and system docs. They should
   be moved to archive.

2. **Stub documents**: 5 `*_STUB.md` files in `docs/contracts/` are
   placeholder/template versions. Not canonical.

3. **Governance closeouts** (23 files in `governance/closeouts/`): These are
   sprint completion records, not governing documents. Classification:
   REFERENCE.

4. **Out/ directory** (1000+ files): Sprint proof artifacts. Not canonical
   documentation. Classification: ARCHIVED (evidence layer).

5. **Agent/skill definitions** (31 files in `.claude/`): These define Claude's
   operational behavior. Classification: CANONICAL for AI operations.

---

## DOCUMENT HEALTH SUMMARY

| Status     | Count        | Action                      |
| ---------- | ------------ | --------------------------- |
| CANONICAL  | ~100 files   | Maintain and enforce        |
| REFERENCE  | ~80 files    | Review periodically         |
| SUPERSEDED | ~50 files    | Move to archive             |
| ARCHIVED   | ~4,000 files | Retain as historical record |

**Key risk**: Document proliferation (4,271 files) creates confusion about which
documents are authoritative. The CANONICAL set should be prominently linked and
the SUPERSEDED documents should be clearly marked.
