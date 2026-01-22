# UNIT TALK SYSTEM CONTRACT (AUTHORITATIVE)

**Version**: 1.1 **Authority**: Chief Systems Architect (Unit Talk) **Last
Updated**: 2026-01-21 **Scope**: This contract is the single source of truth for
the Unit Talk stack. Any code, migration, worker, UI, or doc that violates this
contract is invalid and must be corrected. **Applies to**: DB schema, API,
Temporal/workers, Discord publisher, Smart Form, Command Center, CI/CD, docs.

---

## AUTHORITY & PRECEDENCE

This document is the **single authoritative source of truth** for the Unit Talk
platform.

### Precedence Order (highest to lowest)

1. **SYSTEM_CONTRACT.md** (this document) - Canonical data model, lifecycle,
   invariants
2. **EXECUTION_PLAN.md** - Gate definitions and verification scripts
3. **GATE_VERIFICATION.md** - Gate pass/fail criteria
4. **App-specific CLAUDE.md files** - Implementation guidance per application
5. **All other documentation** - Non-authoritative, informational only

### What This Contract Governs

- Database schema (canonical tables, views, columns, constraints)
- Data lifecycle (submission → publish → Discord)
- Environment and secrets governance
- Definition of Done criteria for releases

### What This Contract Does NOT Govern

- Implementation details within applications (covered by app CLAUDE.md)
- CI/CD workflow specifics (covered by EXECUTION_PLAN.md)
- Historical audit artifacts (archived in docs/\_archive/)

### Conflict Resolution

If any document conflicts with this contract, this contract wins. The
conflicting document must be corrected or archived.

---

## 1) CANONICAL DATA MODEL (DB CONTRACT)

### 1.1 Canonical Tables (Source of Truth)

#### A) unified_picks (CANONICAL / ONLY WRITABLE PICK TABLE)

**Purpose**: Single authoritative record for every pick/leg created by any
source (Smart Form, ingestion, ops tools).

**Writes**: ONLY from the canonical write path (Smart Form API handler / server
activity / approved writer service).

**Required Columns** (minimum contract): | Column | Type | Constraints |
|--------|------|-------------| | id | uuid | PK | | created_at | timestamptz |
NOT NULL, default now() | | updated_at | timestamptz | NOT NULL, maintained | |
trace_id | text | NOT NULL, REQUIRED ON ALL WRITES | | source | text | NOT NULL
(e.g., smart_form) | | user_id | uuid | NOT NULL, FK -> users.id | | sport |
text | NOT NULL | | league | text | NULL allowed | | game_id | uuid | NULL
allowed, FK -> games.id | | pick_type | text | NOT NULL (player_prop, moneyline,
spread, total, team_total) | | selection | text | NOT NULL | | market | text |
NULL allowed | | line | numeric | NULL allowed | | odds | integer | NULL allowed
(American odds integer) | | units | numeric | NOT NULL | | ticket_id | uuid |
NULL allowed, FK -> smart_tickets.id | | status | text | NOT NULL, default
'created' | | promoted_at | timestamptz | NULL allowed | | posted_at |
timestamptz | NULL allowed | | settled_at | timestamptz | NULL allowed |

**Hard Invariants**:

- unified_picks is the only writable pick table
- Every row must have a non-empty trace_id
- Any pipeline that publishes to Discord must reference a unified_picks.id

#### B) smart_tickets (CANONICAL TICKET GROUPING)

**Purpose**: Groups multi-leg submissions and provides shared metadata.

**Required Columns**: | Column | Type | Constraints |
|--------|------|-------------| | id | uuid | PK | | created_at | timestamptz |
NOT NULL, default now() | | updated_at | timestamptz | NOT NULL | | trace_id |
text | NOT NULL | | user_id | uuid | NOT NULL, FK -> users.id | | ticket_type |
text | NOT NULL (single, parlay, rr, teaser) | | legs_count | int | NOT NULL | |
status | text | NOT NULL, default 'created' | | notes | text | NULL allowed |

**Hard Invariants**:

- If a submission contains >1 leg, it must create one smart_tickets row
- smart_tickets.trace_id must match all related unified_picks.trace_id

#### C) pick_publish (CANONICAL DISCORD PUBLISH OUTBOX)

**Purpose**: The only pipeline that results in Discord messages.

**Required Columns**: | Column | Type | Constraints |
|--------|------|-------------| | id | uuid | PK | | created_at | timestamptz |
NOT NULL, default now() | | updated_at | timestamptz | NOT NULL | | trace_id |
text | NOT NULL | | pick_id | uuid | NOT NULL, FK -> unified_picks.id | | status
| text | NOT NULL, default 'pending' | | attempts | int | NOT NULL, default 0 |
| max_attempts | int | NOT NULL, default 5 | | next_attempt_at | timestamptz |
NOT NULL, default now() | | locked_at | timestamptz | NULL allowed | | locked_by
| text | NULL allowed | | last_error | text | NULL allowed | |
discord_channel_id | text | NOT NULL | | discord_thread_id | text | NULL allowed
| | discord_message_id | text | NULL allowed |

**Hard Invariants**:

- pick_publish is the only publish pipeline
- Every row must have trace_id and pick_id
- Lifecycle: pending -> processing -> sent OR pending -> processing -> failed

#### D) bridge_outbox (CANONICAL EVENT OUTBOX FOR INTERNAL FANOUT)

**Purpose**: Durable event stream for internal consumers (Command Center, audit,
notifications) excluding Discord publishing.

**Required Columns**: | Column | Type | Constraints |
|--------|------|-------------| | id | uuid | PK | | created_at | timestamptz |
NOT NULL, default now() | | trace_id | text | NOT NULL | | event_type | text |
NOT NULL | | entity_type | text | NOT NULL | | entity_id | uuid | NOT NULL | |
status | text | NOT NULL, default 'pending' | | attempts | int | NOT NULL,
default 0 | | max_attempts | int | NOT NULL, default 10 | | next_attempt_at |
timestamptz | NOT NULL, default now() | | locked_at | timestamptz | NULL allowed
| | locked_by | text | NULL allowed | | last_error | text | NULL allowed | |
payload | jsonb | NOT NULL |

**Hard Invariants**:

- Every event row must include trace_id
- Consumers must be idempotent using (event_type, entity_id, trace_id)

#### E) users (CANONICAL IDENTITY)

**Required Columns**: | Column | Type | Constraints |
|--------|------|-------------| | id | uuid | PK | | created_at | timestamptz |
NOT NULL | | handle | text | NOT NULL, unique | | role | text | NOT NULL | |
is_active | bool | NOT NULL, default true |

#### F) games (CANONICAL GAME ENTITY)

**Required Columns**: | Column | Type | Constraints |
|--------|------|-------------| | id | uuid | PK | | sport | text | NOT NULL | |
league | text | NULL allowed | | start_time | timestamptz | NOT NULL | |
home_team | text | NOT NULL | | away_team | text | NOT NULL | | status | text |
NOT NULL (scheduled, live, final) |

#### G) agent_health (CANONICAL WORKER/AGENT LIVENESS)

**Required Columns**: | Column | Type | Constraints |
|--------|------|-------------| | id | uuid | PK | | agent_name | text | NOT
NULL | | instance_id | text | NOT NULL | | last_heartbeat_at | timestamptz | NOT
NULL | | status | text | NOT NULL (healthy, degraded, down) | | details | jsonb
| NULL allowed |

### 1.2 Permitted Views (READ-ONLY)

#### picks (VIEW ONLY)

- Must be a VIEW derived from unified_picks
- No writes. No triggers that write back
- Must expose: id, created_at, trace_id, user_id, sport, pick_type, selection,
  odds, units, status, posted_at, settled_at

**Invariant**: picks is read-only. Any code attempting to insert/update/delete
is a contract violation.

### 1.3 Global Invariants (Non-negotiable)

1. **Single Writer Rule**: Only unified_picks is writable for pick records
2. **Traceability**: Every submission must have trace_id propagated through all
   tables
3. **Outbox Lifecycle**: status transitions are strict and monotonic
4. **Publishing Exclusivity**: Discord publishes occur only via pick_publish

---

## 2) CANONICAL LIFECYCLE

### 2.1 Single Correct Lifecycle: "Manual Smart Form Submit -> Discord"

**Actors**: Smart Form UI -> API -> DB -> Publisher Worker -> Discord

1. **Step 0 - Trace Initialization**: UI/API generates trace_id once per
   submission
2. **Step 1 - Validate & Normalize**: API validates before any DB write
3. **Step 2 - Create Ticket**: If multi-leg, insert smart_tickets row
4. **Step 3 - Insert Picks**: Insert into unified_picks per leg
5. **Step 4 - Resolve Discord Routing**: DB-first, ENV fallback, fail-closed
6. **Step 5 - Enqueue Publish**: Insert into pick_publish with status='pending'
7. **Step 6 - Emit Bridge Event**: Insert into bridge_outbox for internal fanout
8. **Step 7 - Publisher Worker Executes**: Atomic claim, render, call Discord

---

## 3) ENVIRONMENT & GOVERNANCE MODEL

### 3.1 Environments

- **Local**: Developer machine + local docker compose
- **Staging**: Production-like environment for integration validation
- **Prod**: Customer-facing system

### 3.2 Parity Rules

- Schema Parity: Staging == Prod for canonical objects
- Pipeline Parity: Same states, same invariants everywhere
- Config Parity: Routing resolution behavior identical everywhere

### 3.3 Drift Prevention

- DB is contract authority
- Migrations are the only legal way to change schema
- Fail-closed on contract violations

### 3.4 Secrets Rules

- GitHub Secrets for CI/CD and deployments
- Local .env for developer-only
- No secrets committed to git

---

## 4) DEFINITION OF DONE (DoD) - ELITE PROOF BUNDLE

### 4.1 E2E UI Proof Bundle

- Screenshot/video of Smart Form submission with visible trace_id
- DB proof showing: smart_tickets, unified_picks, pick_publish rows
- Discord proof: message link matching discord_message_id

### 4.2 Schema Parity Proof Bundle

- Schema inventory export for local, staging, prod
- Verification of canonical objects and required columns
- Verification that picks is a view and read-only

### 4.3 Outbox Health + Stuck Detection Proof

- Count of pending, processing, sent, failed
- Stuck definition and enforcement

### 4.4 Inventory + Legacy Archive Plan

- Legacy tables/views/functions classified
- Archive approach documented

---

## 5) ENFORCEMENT MECHANISMS (Week 2 Hardening)

### 5.1 Canonical Column Mapping (Smart Form Requirements)

Per Griff's authoritative directive (2026-01-21):

| Requirement | Canonical Column | Type          | Description                       |
| ----------- | ---------------- | ------------- | --------------------------------- |
| **capper**  | `user_id`        | UUID FK→users | The capper who submitted the pick |
| **units**   | `stake`          | NUMERIC(10,2) | Unit size for the bet             |
| selection   | `selection`      | TEXT          | Pick selection (over/under/etc.)  |
| sport       | `sport`          | TEXT          | Sport code (NFL, NBA, etc.)       |
| trace_id    | `trace_id`       | TEXT          | End-to-end observability ID       |

### 5.2 Database-Level Guardrails

**CHECK Constraint: `chk_smart_form_required_fields`**

```sql
-- Enforced via migration: 20260121_pr10_week2_smart_form_enforcement.sql
ALTER TABLE unified_picks
ADD CONSTRAINT chk_smart_form_required_fields CHECK (
  form_source IS DISTINCT FROM 'smart_form' OR (
    user_id IS NOT NULL AND   -- capper
    stake IS NOT NULL AND     -- units
    selection IS NOT NULL AND
    sport IS NOT NULL AND
    trace_id IS NOT NULL
  )
);
```

**Foreign Key: `pick_publish.pick_id → unified_picks.id`**

- Enforces that every publish row references a valid pick
- Prevents orphan publish records

### 5.3 Anti-Cheat Enforcement (DB-Level Audit)

**Decision**: Trigger-based audit logging (not RLS)

**Rationale**: RLS is bypassed by `service_role` key. Since Smart Form and API
both use `service_role`, RLS cannot differentiate legitimate vs manual inserts.
A trigger runs on ALL inserts regardless of role.

**Components** (Migration: `20260121_pr10_week2_anticheat_enforcement.sql`):

1. **Audit Table: `picks_audit_log`**
   - Logs every insert to `unified_picks`
   - Captures: `pick_id`, `form_source`, `trace_id`, `pg_role`, `pg_user`,
     `client_ip`
   - Enables forensic analysis of unauthorized inserts

2. **Trigger: `trg_audit_picks_insert`**
   - Fires AFTER INSERT on `unified_picks`
   - Records metadata for every pick creation
   - Cannot be bypassed by any role

3. **CHECK Constraint: `chk_valid_form_source`**
   - Enforces `form_source` must be from known values:
     - `smart_form`, `api`, `ingestion`, `system`, `migration`, `test`
   - Rejects unknown form_source values (e.g., 'hacker_script')

**Forensic Query** (for detecting unauthorized inserts):

```sql
SELECT * FROM picks_audit_log
WHERE pg_role NOT IN ('service_role', 'authenticated')
   OR form_source NOT IN ('smart_form', 'api', 'ingestion', 'system')
ORDER BY created_at DESC;
```

### 5.4 CI Gates (Fail-Closed)

| Gate                         | Workflow                     | What It Checks                                   |
| ---------------------------- | ---------------------------- | ------------------------------------------------ |
| 0. Schema Introspection      | `week2-governance-gates.yml` | Outputs actual column structure                  |
| 1. Schema Parity             | `week2-governance-gates.yml` | Staging has all canonical tables                 |
| 2. picks VIEW Write-Blocked  | `week2-governance-gates.yml` | picks VIEW rejects INSERT/UPDATE                 |
| 3. pick_publish FK Integrity | `week2-governance-gates.yml` | FK to unified_picks enforced                     |
| 3.5. Smart Form CHECK        | `week2-governance-gates.yml` | Invalid smart_form inserts rejected              |
| 4. Agent Contract            | `week2-governance-gates.yml` | DiscordPromotionAgent reads from pick_publish    |
| 5. Anti-Cheat (E2E)          | `week2-governance-gates.yml` | E2E uses Playwright, no direct DB inserts        |
| 5.5. Anti-Cheat (DB)         | `week2-governance-gates.yml` | Audit trigger exists, form_source CHECK enforced |
| 6. Outbox Lifecycle          | `outbox-lifecycle-gate.yml`  | pending → processing → sent transition           |

**Fail-Closed Behavior**: If ANY gate fails, the workflow fails. No exceptions.

### 5.5 Proof Mechanism

**Only CI-generated proof is authoritative.**

- Proof MUST be generated via GitHub Actions with secrets injection
- Proof MUST use Playwright browser automation (not direct DB inserts)
- Proof MUST show trace_id propagation through all canonical tables
- Local script execution is NOT authoritative proof

### 5.6 How to Verify

Run these workflows to verify system compliance:

```bash
# Trigger governance gates manually
gh workflow run week2-governance-gates.yml --ref feat/pr9-go-live-hardening

# Trigger outbox lifecycle test
gh workflow run outbox-lifecycle-gate.yml --ref feat/pr9-go-live-hardening

# Check schema parity
gh workflow run schema-parity-check.yml --ref feat/pr9-go-live-hardening
```

**DO NOT** run local scripts as proof. CI is the only proof mechanism.

---

## ENFORCEMENT CLAUSE

Any PR, migration, worker change, or doc change that contradicts this contract
is a hard fail and must be reverted or corrected. This contract overrides all
older references.

**Week 2 Hardening Gates** are non-negotiable. If any gate fails:

1. The PR cannot be merged
2. The deployment is blocked
3. The issue must be fixed at the source (not bypassed)
