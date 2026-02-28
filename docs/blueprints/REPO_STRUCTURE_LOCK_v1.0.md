# REPO STRUCTURE LOCK v1.0

**Sprint**: BLUEPRINT-FOUNDATION-AUDIT-001 **Date**: 2026-02-27 **Status**:
LOCKED **Approval Authority**: Griff (Operator)

---

## Purpose

This document defines the canonical repository structure for the Unit Talk
platform. Any structural changes to top-level directories or
governance-controlled paths require explicit approval.

---

## 1. Top-Level Structure

```
unit-talk-platform/
├── .claude/                    # Claude governance system
│   ├── agents/                 # Specialist role definitions
│   ├── rules/                  # Modular rule files
│   └── skills/                 # Repeatable procedures
├── .github/                    # GitHub workflows and config
│   └── workflows/              # CI/CD pipelines
├── apps/                       # Application packages
│   ├── api/                    # Backend API & Agents (CANONICAL WRITER)
│   ├── command-center/         # Operations Dashboard (READ-ONLY)
│   ├── dashboard/              # Analytics Frontend (READ-ONLY)
│   ├── discord-bot/            # Discord Integration
│   └── smart-form/             # Ticket Submission (bridge_outbox ONLY)
├── architecture/               # Architecture specifications
│   ├── _archive/               # Superseded architecture docs
│   ├── contracts/              # Tier 2 contracts
│   │   ├── discord/            # Discord delivery contracts
│   │   ├── distribution/       # Outbox/routing contracts
│   │   ├── operational/        # Audit/incident contracts
│   │   └── repo-truth/         # CI/release contracts
│   ├── failure-model/          # Failure mode analysis
│   └── state-machines/         # State machine definitions
├── docs/                       # Documentation root
│   ├── api/                    # API documentation
│   │   └── v1/                 # API specs v1
│   ├── apps/                   # Per-app documentation
│   │   ├── api-worker/         # API worker docs
│   │   ├── command-center/     # Command center docs
│   │   ├── discord-bot/        # Discord bot docs
│   │   └── smart-form/         # Smart form docs
│   ├── architecture/           # Architecture docs
│   │   └── v1/                 # Architecture v1
│   ├── blueprints/             # System blueprints
│   ├── claude/                 # Claude-specific docs
│   ├── contracts/              # Contract definitions
│   ├── db/                     # Database documentation
│   │   └── v1/                 # DB specs v1
│   ├── migrations/             # Migration planning
│   ├── ops/                    # Operations docs
│   │   ├── runbooks/           # Operational runbooks
│   │   └── sop/                # Standard operating procedures
│   ├── phases/                 # Phase documentation
│   ├── product/                # Product documentation
│   │   └── v1/                 # Product specs v1
│   └── smart-form/             # Smart form docs
├── governance/                 # Governance documents
│   ├── archive/                # Archived governance docs
│   │   └── 2026-02-27/         # Archive by date
│   ├── closeouts/              # Sprint closeout markers
│   ├── decision-log/           # Decision records
│   ├── master-roadmap/         # Roadmap drafts
│   ├── operating-constitution/ # Operating constitution drafts
│   ├── platform-constitution/  # Platform constitution
│   ├── ratifications/          # Ratification records
│   ├── release/                # Release governance
│   ├── system-invariants/      # System invariants (original)
│   └── v1/                     # TIER 1 CONSTITUTIONAL (LOCKED)
├── infrastructure/             # Infrastructure config
│   └── kubernetes/             # K8s manifests
├── out/                        # Output artifacts (git-ignored mostly)
│   ├── audits/                 # Audit reports
│   ├── blueprint-audit/        # Blueprint audit outputs
│   ├── e2e/                    # E2E test outputs
│   ├── governance-audit/       # Governance audit outputs
│   ├── governance-lock/        # Governance lock outputs
│   ├── session-baseline/       # Session baselines
│   └── sprints/                # Sprint proof bundles
├── packages/                   # Shared packages
│   ├── contracts/              # Shared contract types
│   ├── event-kit/              # Event handling
│   ├── shared/                 # Shared utilities
│   ├── syndicate-sdk/          # Syndicate SDK
│   └── ui/                     # Shared UI components
├── scripts/                    # Build/utility scripts
├── supabase/                   # Supabase config
│   ├── functions/              # Edge functions
│   └── migrations/             # Database migrations
└── tools/                      # Development tools
```

---

## 2. Protected Paths

### Tier 1 (Constitutional - Locked)

| Path                           | Protection Level | Modification Rules                              |
| ------------------------------ | ---------------- | ----------------------------------------------- |
| `governance/v1/`               | LOCKED           | Requires version bump + Griff approval + CI tag |
| `CLAUDE_EXECUTION_CONTRACT.md` | PROTECTED        | Requires Griff approval                         |
| `CLAUDE.md`                    | PROTECTED        | Requires sprint documentation                   |

### Tier 2 (Contracts - Controlled)

| Path                      | Protection Level | Modification Rules             |
| ------------------------- | ---------------- | ------------------------------ |
| `architecture/contracts/` | CONTROLLED       | Requires sprint + version bump |
| `docs/contracts/`         | CONTROLLED       | Requires sprint + version bump |
| `.claude/rules/`          | CONTROLLED       | Requires sprint documentation  |

### Standard Paths

| Path                       | Modification Rules        |
| -------------------------- | ------------------------- |
| `apps/`                    | Standard PR process       |
| `packages/`                | Standard PR process       |
| `docs/` (except contracts) | Standard PR process       |
| `out/`                     | Ephemeral, auto-generated |

---

## 3. Canonical Locations

### Documentation

| Document Type          | Canonical Location             |
| ---------------------- | ------------------------------ |
| Governance Tier 1      | `governance/v1/`               |
| Architecture Contracts | `architecture/contracts/`      |
| Data Contracts         | `docs/contracts/`              |
| Blueprints             | `docs/blueprints/`             |
| Architecture Specs     | `docs/architecture/v1/`        |
| DB Specs               | `docs/db/v1/`                  |
| API Specs              | `docs/api/v1/`                 |
| Product Specs          | `docs/product/v1/`             |
| SOPs                   | `docs/ops/sop/`                |
| Runbooks               | `docs/ops/runbooks/`           |
| App Docs               | `docs/apps/<app>/`             |
| Sprint Proofs          | `out/sprints/<SPRINT>/<DATE>/` |

### Code

| Component       | Canonical Location     | Writer Authority   |
| --------------- | ---------------------- | ------------------ |
| API/Agents      | `apps/api/`            | CANONICAL WRITER   |
| Smart Form      | `apps/smart-form/`     | bridge_outbox ONLY |
| Command Center  | `apps/command-center/` | READ-ONLY          |
| Discord Bot     | `apps/discord-bot/`    | Via API            |
| Shared Packages | `packages/`            | N/A                |

### Configuration

| Config Type         | Canonical Location           |
| ------------------- | ---------------------------- |
| Claude Rules        | `.claude/rules/`             |
| Claude Agents       | `.claude/agents/`            |
| Claude Skills       | `.claude/skills/`            |
| GitHub Workflows    | `.github/workflows/`         |
| K8s Manifests       | `infrastructure/kubernetes/` |
| Supabase Migrations | `supabase/migrations/`       |

---

## 4. Directory Creation Rules

### Allowed Without Approval

- `out/*` - Ephemeral output directories
- `apps/*/node_modules/` - Dependencies
- `packages/*/dist/` - Build outputs

### Requires Sprint

- New top-level directories
- New subdirectories under `docs/`
- New subdirectories under `architecture/`
- New app directories under `apps/`

### Requires Griff Approval

- New directories under `governance/`
- New directories under `governance/v1/`
- Structural changes to protected paths

---

## 5. File Naming Conventions

### Versioned Documents

```
<NAME>_v<MAJOR>.<MINOR>.md
```

Examples:

- `CONSTITUTION_v1.0.md`
- `OUTBOX_CONTRACT_v1.1.md`
- `SMART_FORM_PRODUCT_SPEC_V1.1.md`

### Sprint Outputs

```
out/sprints/SPRINT-<NAME>-###/<YYYY-MM-DD>/
├── proofs/
│   └── proof_*.txt
├── diffs/
│   └── *.diff
└── SPRINT_CLOSEOUT_REPORT.md
```

### Governance Archives

```
governance/archive/<YYYY-MM-DD>/
├── ARCHIVE_INDEX.md
└── <archived_files>
```

---

## 6. Migration Path for Misplaced Files

Files discovered at incorrect locations should be:

1. **Documented** in ARTIFACT_REGISTRY_v1.0.md as EQUIVALENT
2. **NOT moved** without sprint + approval
3. **Cross-referenced** from canonical location
4. **Migrated** only during dedicated consolidation sprints

---

## 7. Enforcement

### CI Gates

- `governance-version-gate.yml` - Enforces Tier 1 versioning
- `single-writer-gate` - Enforces single-writer discipline
- `structure-check` (proposed) - Validates directory structure

### Violation Classes

| Violation                                   | Consequence            |
| ------------------------------------------- | ---------------------- |
| Create file in locked path without approval | CI FAIL                |
| Delete protected file                       | CI FAIL                |
| Rename protected file without version bump  | CI FAIL                |
| Create undocumented top-level directory     | Sprint review required |

---

## 8. Amendment

Amendments to this structure lock require:

1. Sprint documentation
2. Griff approval
3. Version bump to this document
4. Update to ARTIFACT_REGISTRY_v1.0.md

---

**Document Owner**: Engineering Team **Locked**: 2026-02-27 **Sprint**:
BLUEPRINT-FOUNDATION-AUDIT-001
