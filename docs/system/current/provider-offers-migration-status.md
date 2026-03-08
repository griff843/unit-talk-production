# Provider Offers Migration Status

> Created: 2026-03-08 | Sprint: SPRINT-044H

---

## Migration Overview

The platform is migrating from flat `raw_props` ingestion to normalized
`provider_offers` with canonical FK resolution. This document tracks phase
completion based on runtime-verified evidence.

---

## Phase Status

### Phase 1: Dual-Write Infrastructure — COMPLETE

| Item                                   | Sprint | Evidence                            |
| -------------------------------------- | ------ | ----------------------------------- |
| `provider_offers` table created        | V3     | 1.38M+ rows in production           |
| `upsert_provider_offers_bootstrap` RPC | V3     | Auto-creates events, resolves FKs   |
| OddsAPI → provider_offers adapter      | V3     | Existing, 1.38M+ rows               |
| SGO provider registered                | 044F   | provider_registry code='sgo'        |
| SGO → provider_offers adapter          | 044F   | `ingestSGOProviderOffers()`         |
| Participant FK resolution              | 044F   | ON CONFLICT constraint, auto-create |

### Phase 2: Runtime Validation — COMPLETE (SPRINT-044G)

| Item                                  | Result                     |
| ------------------------------------- | -------------------------- |
| SGO ingestion → provider_offers       | 2,108 rows inserted        |
| canonical_events auto-creation        | 10 events created          |
| Participant FK resolution             | 94/94 resolved, 0 failures |
| raw_props bypass (SGO canonical path) | 0 raw_props writes         |
| provider_event_map linkage            | Working                    |
| Validator 8/8 phases                  | PASS                       |

### Phase 3: GradingAgent Data Source Switch — IN PROGRESS

| Item                                        | Status                           |
| ------------------------------------------- | -------------------------------- |
| `GRADING_DATA_SOURCE` env var               | Implemented (044D)               |
| `fetchPendingProviderOffers()` method       | Implemented (044D)               |
| `convertProviderOfferToFeatureSet()` mapper | Implemented (044D)               |
| Default switched to `provider_offers`       | NOT YET — default is `raw_props` |
| Promotion context read migrated             | NOT YET — still reads raw_props  |

### Phase 4: Remaining Consumer Migration — NOT STARTED

| Consumer        | Current Source      | Migration Needed             |
| --------------- | ------------------- | ---------------------------- |
| SettlementAgent | raw_props           | Read from provider_offers    |
| Optimal API     | FeedAgent→raw_props | Wire to provider_offers path |

### Phase 5: raw_props Retirement — NOT STARTED

Requires all of Phase 3 + Phase 4 to be complete. raw_props can be made
read-only and eventually dropped once no writers or readers remain.

---

## Schema Migrations Applied (044F–044G)

| Migration                                                  | Purpose                               |
| ---------------------------------------------------------- | ------------------------------------- |
| `20260308100000_seed_sgo_provider.sql`                     | Register SGO in provider_registry     |
| `20260308100001_bootstrap_participant_resolution.sql`      | Add participant_id resolution to RPC  |
| `20260308110000_fix_participant_conflict_clause.sql`       | Fix ON CONFLICT composite constraint  |
| `20260308120000_events_v3_columns.sql`                     | Add V3 columns to legacy events table |
| `20260308120001_events_meta_column.sql`                    | Add meta column to events             |
| `20260308130000_events_relax_legacy_not_null.sql`          | Relax aggregate_id/type NOT NULL      |
| `20260308130001_events_relax_event_data_not_null.sql`      | Relax event_data NOT NULL             |
| `20260308130002_events_relax_idempotency_key_not_null.sql` | Relax idempotency_key NOT NULL        |
| `20260308140000_fix_auto_create_event_use_canonical.sql`   | Fix RPC to use canonical_events table |

---

## Key Architecture Findings

1. **canonical_events is a separate TABLE from events**: The V3 foundation
   migration used `CREATE TABLE IF NOT EXISTS events` which was a no-op because
   the legacy event-sourcing `events` table already existed. `canonical_events`
   is the actual V3 sports-event catalog table.

2. **Legacy events table retained**: The old `events` table (aggregate_id,
   aggregate_type, event_data columns) still exists with NOT NULL constraints
   relaxed. It is not used by the V3 pipeline.

3. **provider_event_map FK references canonical_events**: NOT the legacy events
   table. The `auto_create_event_for_ingestion` function was fixed (044G) to
   INSERT into `canonical_events`.
