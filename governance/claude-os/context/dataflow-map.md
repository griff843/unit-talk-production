# CLAUDE OS — Canonical Dataflow Map

**Version**: 1.0.0 **Purpose**: Architecture-level dataflow reference for Claude
OS sprint execution. Describes canonical data movement, deprecated paths, and
truth lock expectations.

> This document describes architectural intent and canonical paths.
> Implementation specifics should be verified against
> `docs/system/current/runtime-dataflow.md` and
> `docs/system/current/ingestion-source-of-truth.md` before sprint execution.

---

## 1. Provider Ingestion

### Canonical Path

```
External Provider APIs (ESPN, odds providers, etc.)
    |
    v
Ingestion Activities (apps/api/src/activities/ingestion.ts)
    |
    v
provider_offers  <-- CANONICAL landing table
    |
    v
Normalization (provider-specific -> unified schema)
    |
    v
Downstream processing (grading, scoring)
```

**`provider_offers`** is the canonical ingestion landing table. All new
ingestion work must target this table.

### Deprecated Compatibility Path

```
External Provider APIs
    |
    v
Legacy ingestion code [VERIFY current state]
    |
    v
raw_props  <-- DEPRECATED — compatibility reads ONLY
```

**`raw_props`** exists for backward compatibility during migration. It must NOT
be used as a target for new ingestion work. Reads from `raw_props` are permitted
only in legacy code paths that have not yet been migrated. See
`docs/system/current/raw-props-compatibility-status.md` for current migration
state.

### Ingestion Truth Locks

Before claiming an ingestion sprint is complete:

- [ ] Data lands in `provider_offers`, not `raw_props`.
- [ ] Provider normalization rules are applied per
      `docs/system/current/provider-normalization.md`.
- [ ] Freshness expectations are met per
      `docs/system/current/ingestion-freshness-policy.md`.
- [ ] No new writes to `raw_props` were introduced.
- [ ] Ingestion source of truth doc
      (`docs/system/current/ingestion-source-of-truth.md`) is consistent with
      implementation.

---

## 2. Scoring and Grading

```
provider_offers (canonical data)
    |
    v
GradingAgent (apps/api/src/agents/GradingAgent/)
    |
    ├── Score calculation (packages/intelligence)
    ├── Tier assignment (promotion-policy.md)
    └── Grade assignment
    |
    v
unified_picks (via lifecycleUpdate with writerRole: 'promoter')
```

### Scoring Truth Locks

- [ ] GradingAgent reads from canonical sources (`provider_offers`,
      `participants`).
- [ ] All writes to `unified_picks` use lifecycle adapters.
- [ ] Tier assignment follows `docs/system/current/promotion-policy.md`.
- [ ] No reads from deprecated `daily_picks` or `players`/`teams` tables.

---

## 3. Promotion and Outbox

```
unified_picks (graded, scored, tiered)
    |
    v
FeedAgent (apps/api/src/agents/FeedAgent/)
    |
    ├── Promotion queue selection
    ├── atomicClaimForPost (idempotent claim)
    └── Distribution preparation
    |
    v
packages/distribution (embed building, channel routing)
    |
    v
Discord Bot (apps/discord-bot)
    |
    v
Discord Channels (user-facing delivery)
    |
    v
Receipt update on unified_picks (via lifecycleUpdate with writerRole: 'poster')
```

### Smart Form Submission Path (Separate)

```
Smart Form UI (apps/smart-form)
    |
    v
bridge_outbox (staging table — NOT unified_picks)
    |
    v
Bridge processing [VERIFY current implementation]
    |
    v
unified_picks (via lifecycleInsert with writerRole: 'submitter')
```

**Smart Form never writes directly to `unified_picks`.** It writes to
`bridge_outbox`, which is processed by the API layer.

### Promotion Truth Locks

- [ ] FeedAgent uses `atomicClaimForPost` for idempotent posting claims.
- [ ] Discord embeds follow `docs/contracts/DISCORD_EMBED_CONTRACT.md`.
- [ ] Posting receipt is stored via lifecycle adapter.
- [ ] Promotion authority follows
      `docs/contracts/PROMOTION_AUTHORITY_BOUNDARY.md`.

---

## 4. Settlement

```
unified_picks (posted, awaiting outcome)
    |
    v
SettlementAgent (apps/api/src/agents/SettlementAgent/)
    |
    ├── Outcome data collection (external APIs)
    ├── Result calculation
    ├── Settlement hash generation
    └── Immutability enforcement
    |
    v
unified_picks (via lifecycleSettle with writerRole: 'settler')
    |
    v
prop_settlements (settlement record table)
```

### Settlement Truth Locks

- [ ] Settlement uses `lifecycleSettle` adapter exclusively.
- [ ] `settlement_result` and `settlement_hash` are immutable once set.
- [ ] Settlement operations are idempotent (atomic claim pattern).
- [ ] `closing_line` in `closing_snapshots` is immutable (database trigger
      enforced).
- [ ] No settlement data is modified after settlement is written.

---

## 5. Canonical vs Deprecated Table Summary

| Table                     | Status         | Canonical Use                                                 | Deprecated Use        |
| ------------------------- | -------------- | ------------------------------------------------------------- | --------------------- |
| `provider_offers`         | **CANONICAL**  | Ingestion landing table                                       | N/A                   |
| `unified_picks`           | **CANONICAL**  | Pick lifecycle (submit -> grade -> promote -> post -> settle) | N/A                   |
| `participants`            | **CANONICAL**  | Players and teams entity table                                | N/A                   |
| `participant_memberships` | **CANONICAL**  | Player-team relationship links                                | N/A                   |
| `bridge_outbox`           | **ACTIVE**     | Smart Form submission staging                                 | N/A                   |
| `agent_health`            | **ACTIVE**     | Agent runtime health reporting                                | N/A                   |
| `prop_settlements`        | **ACTIVE**     | Settlement records                                            | N/A                   |
| `raw_props`               | **DEPRECATED** | Compatibility reads during migration                          | New writes FORBIDDEN  |
| `daily_picks`             | **DEPRECATED** | None                                                          | All use FORBIDDEN     |
| `players`                 | **DEPRECATED** | None — use `participants`                                     | All new use FORBIDDEN |
| `teams`                   | **DEPRECATED** | None — use `participants`                                     | All new use FORBIDDEN |

---

## 6. Lifecycle State Flow

```
SUBMITTED -> GRADED -> PROMOTED -> QUEUED -> POSTED -> SETTLED
                                                        |
                                                   (immutable)
```

Each transition is governed by:

- Lifecycle adapters (enforcing writer roles).
- Atomic claim patterns (enforcing idempotency).
- Database constraints (enforcing immutability).

Full state machine details: `docs/system/current/lifecycle-state-machine.md`.

---

## 7. Verification Checklist for Lifecycle Sprints

Before claiming any lifecycle-touching sprint is complete, verify:

- [ ] All `unified_picks` writes use lifecycle adapters.
- [ ] No direct `.from('unified_picks').insert()` or `.update()` calls outside
      lifecycle module.
- [ ] Lifecycle gate passes: `npm run lifecycle:single-writer -- --strict`.
- [ ] Idempotency: replay of operations produces no duplicate side effects.
- [ ] Immutability: settled fields cannot be overwritten.
- [ ] Deprecated paths: no new dependencies on deprecated tables.
- [ ] Runtime evidence: actual database state confirms expected transitions (for
      runtime sprints).
