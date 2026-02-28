# UNIT TALK MASTER SYSTEM BLUEPRINT v1.0

**Sprint**: BLUEPRINT-FOUNDATION-AUDIT-001 **Date**: 2026-02-27 **Status**:
ACTIVE **Version**: v1.0

---

## 1. Executive Summary

Unit Talk is a sports betting intelligence platform that provides verified
picks, analytics, and performance tracking to subscribers across multiple tiers
(VIP, VIP+, Black Label). The system follows a disciplined governance model with
single-writer enforcement, fail-closed validation, and proof-based operations.

---

## 2. System Architecture Overview

### 2.1 High-Level Components

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           UNIT TALK PLATFORM                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────┐  │
│  │  Smart Form  │───▶│ bridge_outbox│───▶│      API Workers         │  │
│  │  (Submission)│    │    Table     │    │  (Canonical Writer)      │  │
│  └──────────────┘    └──────────────┘    └────────────┬─────────────┘  │
│                                                        │                 │
│                                                        ▼                 │
│                                          ┌──────────────────────────┐   │
│                                          │    unified_picks Table   │   │
│                                          │    (Source of Truth)     │   │
│                                          └────────────┬─────────────┘   │
│                                                       │                  │
│         ┌─────────────────────────────────────────────┼──────────────┐  │
│         │                         │                   │              │  │
│         ▼                         ▼                   ▼              ▼  │
│  ┌─────────────┐          ┌─────────────┐    ┌─────────────┐  ┌──────┐ │
│  │ Discord Bot │          │  Command    │    │  Dashboard  │  │ API  │ │
│  │ (Delivery)  │          │  Center     │    │ (Analytics) │  │(Read)│ │
│  └─────────────┘          │ (READ-ONLY) │    │ (READ-ONLY) │  └──────┘ │
│                           └─────────────┘    └─────────────┘           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

1. **Submission**: Picks submitted via Smart Form → `bridge_outbox` table
2. **Ingestion**: API Workers consume from outbox → validate → write to
   `unified_picks`
3. **Grading**: GradingAgent evaluates picks → promotes eligible ones
4. **Distribution**: DiscordPromotionAgent posts to Discord channels
5. **Settlement**: SettlementAgent grades outcomes → updates settlement fields
6. **Projection**: Command Center/Dashboard read from `unified_picks`
   (READ-ONLY)

---

## 3. Governance Model

### 3.1 Document Hierarchy

```
TIER 1: CONSTITUTIONAL LAW (governance/v1/)
├── CONSTITUTION_v1.0.md           - Supreme design authority
├── SYSTEM_INVARIANTS_v1.0.md      - 11 system invariants
├── CLAUDE_EXECUTION_CONTRACT_v1.0.md - AI hard law
├── ENV_CONTRACT_v1.0.md           - Environment contract
├── TAG_TRUTH_ENFORCEMENT_v1.0.md  - Release governance
└── GOVERNANCE_VERSIONING_RULES.md - Amendment rules

TIER 2: ARCHITECTURE CONTRACTS (architecture/contracts/)
├── Discord Delivery Contracts
├── Distribution/Routing Contracts
├── Operational/Audit Contracts
└── Repo Truth Contracts

TIER 3: IMPLEMENTATION (apps/, packages/)
└── Application code following contracts
```

### 3.2 Key Invariants

| #   | Invariant                       | Enforcement                 |
| --- | ------------------------------- | --------------------------- |
| 1   | Single-Writer Discipline        | Lifecycle adapters, CI gate |
| 2   | Fail-Closed Environment         | ENV_CONTRACT validation     |
| 3   | Outbox Pattern for Side Effects | bridge_outbox table         |
| 4   | Idempotency                     | Atomic claim patterns       |
| 5   | Immutable Settlement Fields     | Database triggers           |

See: `governance/v1/SYSTEM_INVARIANTS_v1.0.md`

---

## 4. Application Components

### 4.1 API Workers (apps/api/)

**Role**: CANONICAL WRITER - Only component authorized to write to
`unified_picks`

**Key Agents**:

- **GradingAgent**: Evaluates pick quality, promotes to Discord-ready
- **DiscordPromotionAgent**: Posts picks to Discord, updates receipts
- **SettlementAgent**: Grades pick outcomes, records settlements
- **FeedAgent**: Ingests external data (odds, scores)
- **IngestionAgent**: Processes bridge_outbox submissions

**Writer Roles**: | Role | Authority | |------|-----------| | submitter |
Initial pick creation | | promoter | Queue/promote picks | | poster | Discord
posting, receipts | | settler | Settlement operations | | operator_override |
Manual corrections |

### 4.2 Smart Form (apps/smart-form/)

**Role**: Ticket submission interface for cappers

**Writes To**: `bridge_outbox` table ONLY (never unified_picks)

**Key Features**:

- Game/player search
- Pick type selection
- Submission validation
- Bet slip generation

### 4.3 Discord Bot (apps/discord-bot/)

**Role**: Discord integration for pick delivery and user interaction

**Key Features**:

- Embedded pick display
- Tier-based channel access
- User commands (/stats, /records, etc.)
- Onboarding flows

### 4.4 Command Center (apps/command-center/)

**Role**: Operations dashboard for monitoring and control

**Access**: READ-ONLY (no writes to business tables)

**Key Features**:

- Agent health monitoring
- Pick pipeline status
- Settlement tracking
- Performance analytics

---

## 5. Database Schema

### 5.1 Canonical Tables

| Table                     | Status    | Writer                       |
| ------------------------- | --------- | ---------------------------- |
| `unified_picks`           | CANONICAL | API (via lifecycle adapters) |
| `participants`            | CANONICAL | SGO Sync                     |
| `participant_memberships` | CANONICAL | SGO Sync                     |
| `bridge_outbox`           | ACTIVE    | Smart Form                   |
| `agent_health`            | ACTIVE    | API Agents                   |
| `prop_settlements`        | ACTIVE    | SettlementAgent              |

### 5.2 Lifecycle States

```
SUBMITTED → GRADING → QUEUED → POSTED → SETTLED
              ↓                    ↓
           REJECTED            CANCELLED
```

See: `docs/contracts/PICK_LIFECYCLE_CONTRACT.md`

---

## 6. Environment Configuration

### 6.1 Required Variables

| Variable               | Purpose                | Validation       |
| ---------------------- | ---------------------- | ---------------- |
| `DISCORD_BOT_TOKEN`    | Discord authentication | Required in prod |
| `SUPABASE_URL`         | Database connection    | Required always  |
| `SUPABASE_SERVICE_KEY` | Database auth          | Required always  |
| `SUPABASE_ANON_KEY`    | Public client key      | Required always  |

### 6.2 Profiles

| Profile     | Purpose          | Validation Level |
| ----------- | ---------------- | ---------------- |
| production  | Live environment | STRICT           |
| staging     | Pre-prod testing | STRICT           |
| development | Local dev        | WARN             |
| test        | CI/testing       | MINIMAL          |

See: `governance/v1/ENV_CONTRACT_v1.0.md`

---

## 7. Deployment Architecture

### 7.1 Infrastructure

```
┌─────────────────────────────────────────────────────────────────┐
│                        Production                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ Kubernetes  │  │  Supabase   │  │      Vercel             │ │
│  │  Cluster    │  │  (Database) │  │  (Smart Form/CC)        │ │
│  │  (API/Bot)  │  │             │  │                         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 CI/CD Pipeline

1. **Build**: TypeScript compilation, lint, type-check
2. **Test**: Unit tests, integration tests
3. **Gates**: Single-writer gate, governance gates
4. **Deploy**: Docker build, K8s deployment
5. **Verify**: Smoke tests, health checks

---

## 8. Monitoring & Observability

### 8.1 Health Endpoints

| Service     | Endpoint         | Purpose          |
| ----------- | ---------------- | ---------------- |
| API         | `/health`        | Service liveness |
| API         | `/health/agents` | Agent status     |
| Discord Bot | Internal         | Bot connectivity |

### 8.2 Key Metrics

- Pick submission rate
- Grading latency
- Discord delivery success rate
- Settlement accuracy
- Agent health scores

---

## 9. Security Model

### 9.1 Authentication

| Component      | Method               |
| -------------- | -------------------- |
| API            | Supabase service key |
| Smart Form     | Supabase anon + RLS  |
| Discord Bot    | Discord OAuth        |
| Command Center | Supabase auth        |

### 9.2 Authorization

| Resource            | Access Control                |
| ------------------- | ----------------------------- |
| unified_picks write | API lifecycle adapters only   |
| unified_picks read  | All services via Supabase RLS |
| bridge_outbox write | Smart Form only               |
| Agent operations    | API service only              |

---

## 10. Reference Documents

### Governance

| Document             | Location                                        |
| -------------------- | ----------------------------------------------- |
| Constitution         | governance/v1/CONSTITUTION_v1.0.md              |
| System Invariants    | governance/v1/SYSTEM_INVARIANTS_v1.0.md         |
| Execution Contract   | governance/v1/CLAUDE_EXECUTION_CONTRACT_v1.0.md |
| Environment Contract | governance/v1/ENV_CONTRACT_v1.0.md              |

### Architecture

| Document              | Location                                                    |
| --------------------- | ----------------------------------------------------------- |
| Architecture Overview | docs/ARCHITECTURE.md                                        |
| Workflow Overview     | docs/WORKFLOW_OVERVIEW.md                                   |
| Pick Lifecycle        | docs/contracts/PICK_LIFECYCLE_CONTRACT.md                   |
| Outbox Contract       | architecture/contracts/distribution/OUTBOX_CONTRACT_v1.1.md |

### Operations

| Document          | Location                           |
| ----------------- | ---------------------------------- |
| Go-Live Runbook   | docs/ops/GO_LIVE_RUNBOOK.md        |
| Agent Control     | docs/RUNBOOK_AGENT_CONTROL.md      |
| Incident Response | docs/INCIDENT_RESPONSE_PLAYBOOK.md |

### Registry

| Document            | Location                                    |
| ------------------- | ------------------------------------------- |
| Artifact Registry   | docs/blueprints/ARTIFACT_REGISTRY_v1.0.md   |
| Repo Structure Lock | docs/blueprints/REPO_STRUCTURE_LOCK_v1.0.md |

---

## 11. Version History

| Version | Date       | Changes                    |
| ------- | ---------- | -------------------------- |
| v1.0    | 2026-02-27 | Initial blueprint creation |

---

**Document Owner**: Engineering Team **Created**: 2026-02-27 **Sprint**:
BLUEPRINT-FOUNDATION-AUDIT-001
