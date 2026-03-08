# Current System Status

Status: CANONICAL Authority: Tier 1 Owner: Platform Architecture Last Verified:
2026-03-08 Sprint: SPRINT-044H

---

## Runtime Status: CONDITIONAL GO FOR STAGING

The runtime path is structurally sound. All workflow → activity → registration
chains are complete. Production readiness requires integration testing with live
infrastructure.

---

## Verification Gates

| Gate                                 | Status                  | Last Verified            |
| ------------------------------------ | ----------------------- | ------------------------ |
| `npm run type-check`                 | PASS                    | 2026-03-07 (SPRINT-039)  |
| `npm run build --workspace=apps/api` | PASS                    | 2026-03-07               |
| Lifecycle single-writer gate         | PASS (0 new violations) | 2026-03-07               |
| Activity registration coverage       | 9/9 registered          | 2026-03-07 (SPRINT-035B) |
| Workflow runability                  | 0 broken workflows      | 2026-03-07 (SPRINT-035B) |
| Name collision audit                 | 0 harmful collisions    | 2026-03-07 (SPRINT-035B) |

## Recent Sprint History

| Sprint      | Commit     | Summary                                                   |
| ----------- | ---------- | --------------------------------------------------------- |
| SPRINT-044G | `ec951429` | Provider offers live runtime validation — 8/8 phases PASS |
| SPRINT-044F | `dc892ec2` | SGO provider seed + participant FK resolution             |
| SPRINT-044E | `5a13740a` | Archive ScoringAgent + migrate enrichment to participants |
| SPRINT-044D | `2b3719d1` | provider_offers dual-read + closing snapshots             |
| SPRINT-039  | `b254115c` | Model calibration loop + evaluation integration           |
| SPRINT-038  | `03ee84c2` | Daily metrics + drift detection                           |
| SPRINT-037  | `391dad84` | Walk-forward evaluation hardening                         |
| SPRINT-036  | `7b51bc9c` | Deterministic band calibration                            |
| SPRINT-035B | `64c526fb` | Truth decisions TD-1–TD-7 + Round 2 remediation           |
| SPRINT-035A | `52c638d1` | Runtime truth audit Round 1                               |

## Known Risks

| Risk                           | Severity | Details                                                                            |
| ------------------------------ | -------- | ---------------------------------------------------------------------------------- |
| GradingAgent Supabase DI       | MEDIUM   | `supabase: undefined as any` — will fail on first real Supabase call               |
| Activity stubs                 | MEDIUM   | Many activities log/return placeholders (e.g., `getLiveGames` returns empty array) |
| USP detection quarantined      | LOW      | Detector files exist but not wired — re-export risk                                |
| `_archived/` build errors      | LOW      | Pre-existing, should be excluded from prod tsconfig                                |
| 16 allowlisted lifecycle files | LOW      | Pre-existing direct writes to non-canonical tables                                 |

## Conditions for Production GO

1. Full integration test with Temporal server (worker boot + workflow start)
2. Canary deployment to staging with real data ingestion cycle
3. Verify DiscordPromotionAgent webhook delivery
4. Fix GradingAgent Supabase dependency injection
5. Exclude `_archived/` from production tsconfig

---

## Provider Offers Canonical Status (post-044G)

**Runtime-proven (2026-03-08)**:

- `provider_offers` is now receiving live SGO data (2,108 rows validated)
- `canonical_events` auto-creation via `auto_create_event_for_ingestion` is
  working
- Participant FK resolution is working (94/94 resolved)
- `raw_props` received 0 writes during SGO canonical ingestion
- GradingAgent has `GRADING_DATA_SOURCE` switch but defaults to `raw_props`

**Remaining before raw_props retirement**:

- GradingAgent default data source switch to `provider_offers`
- Promotion path still reads `raw_props` for context data during
  `promoteToUnifiedPicks()`
- Optimal API adapter for provider_offers path not yet wired
- Settlement still reads `raw_props` / `game_results`

---

## Schema State

**Total migrations**: 67 files (2025-01-25 through 2026-03-08) **Latest
migration**: `20260308140000_fix_auto_create_event_use_canonical.sql`

**Key recent schema additions (044D–044G)**:

- `canonical_events` V3 columns added to legacy events table (external_id,
  sport, league, etc.)
- Legacy events NOT NULL constraints relaxed (aggregate_id, aggregate_type,
  event_type, event_data, idempotency_key)
- `auto_create_event_for_ingestion` fixed to target `canonical_events` (not
  legacy `events`)
- `upsert_provider_offers_bootstrap` RPC fixed with correct ON CONFLICT
  constraint
- `market_policy` — promotion gate config per sport/market_type
- `player_game_stats`, `prop_outcomes` — outcome tracking (WIN/LOSS/PUSH)
- `closing_snapshots`, `clv_results` — CLV measurement infrastructure

---

## Related Documents

- [System Overview](./SYSTEM_OVERVIEW.md)
- [Canonical Runtime Path](./CANONICAL_RUNTIME_PATH.md)
- [Table Classification Spec](../governance/TABLE_CLASSIFICATION_SPEC.md)
