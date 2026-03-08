# Ingestion Source of Truth

> Created: 2026-03-08 | Sprint: SPRINT-044H

---

## Current Ingestion Architecture (post-044G)

Two ingestion paths exist. The canonical V3 path is proven live; the legacy path
remains the scheduler default.

### Canonical V3 Path: provider_offers

| Attribute          | Value                                                           |
| ------------------ | --------------------------------------------------------------- |
| **Landing table**  | `provider_offers`                                               |
| **Writer**         | IngestionAgent via `upsert_provider_offers_bootstrap` RPC       |
| **Event creation** | Auto via `auto_create_event_for_ingestion` → `canonical_events` |
| **FK resolution**  | Participant: external_id → name → auto-create cascade           |
| **Market resolve** | `resolve_market_id_for_bootstrap` → `markets` table             |
| **Providers**      | SGO (proven 044G), OddsAPI (existing), Optimal (not yet wired)  |
| **Status**         | LIVE — 1.38M+ rows total, 2,108 SGO rows proven in 044G         |

**Runtime proof (SPRINT-044G, 2026-03-08)**:

- 2,108 provider_offers rows inserted from live SGO data
- 10 canonical_events auto-created
- 94 participant FKs resolved, 0 failures
- 0 raw_props writes during SGO canonical ingestion
- 8/8 validation phases PASS

### Legacy Path: raw_props

| Attribute          | Value                                                        |
| ------------------ | ------------------------------------------------------------ |
| **Landing table**  | `raw_props`                                                  |
| **Writer**         | FeedAgent via direct INSERT                                  |
| **Event creation** | None — stores strings only                                   |
| **FK resolution**  | None — player_name, stat_type stored as loose text           |
| **Providers**      | Optimal API (primary), OddsAPI (secondary), SGO (fallback)   |
| **Status**         | COMPATIBILITY — still scheduler default, deprecated per TD-1 |

---

## Provider Coverage Matrix

| Provider    | raw_props (legacy) | provider_offers (V3) | Notes                             |
| ----------- | ------------------ | -------------------- | --------------------------------- |
| SGO         | Via FeedAgent      | LIVE (proven 044G)   | Canonical path bypasses raw_props |
| OddsAPI     | Via FeedAgent      | LIVE (existing)      | `ingestProviderOffers()`          |
| Optimal API | Via FeedAgent      | NOT YET WIRED        | Adapter needs creation            |

---

## Downstream Consumers

| Consumer               | Current data source      | V3 path available?                          |
| ---------------------- | ------------------------ | ------------------------------------------- |
| GradingAgent           | raw_props (default)      | Yes — `GRADING_DATA_SOURCE=provider_offers` |
| ClosingSnapshotService | provider_offers          | Yes — native V3 consumer                    |
| CLVComputeService      | provider_offers          | Yes — native V3 consumer                    |
| SettlementAgent        | raw_props + game_results | No — not yet migrated                       |
| DiscordPromotionAgent  | unified_picks            | N/A — reads from unified_picks              |

---

## What Still Blocks raw_props Retirement

1. **GradingAgent default**: Must switch `GRADING_DATA_SOURCE` from `raw_props`
   to `provider_offers`
2. **Promotion context read**: `promoteToUnifiedPicks()` reads `raw_props` for
   pick context data
3. **SettlementAgent**: Still reads `raw_props` and `game_results`
4. **Optimal API adapter**: Not yet wired to provider_offers path
5. **Scheduler default**: Still calls `ingestUnifiedData()` → raw_props as
   primary
