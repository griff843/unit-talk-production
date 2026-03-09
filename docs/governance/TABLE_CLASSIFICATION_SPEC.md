# Table Classification Spec

Status: CANONICAL Authority: Tier 1 Owner: Platform Architecture Last Verified:
2026-03-07 Sprint: SPRINT-DOCS-CANONICALIZATION-040

---

## Classification Tiers

| Tier          | Meaning                                           | Write Enforcement              |
| ------------- | ------------------------------------------------- | ------------------------------ |
| CANONICAL     | Source of truth, lifecycle-protected              | Via lifecycle adapters only    |
| ACTIVE        | Production table, application-level enforcement   | Via designated writer agent    |
| COMPATIBILITY | Temporarily tolerated, scheduled for retirement   | Direct writes allowed (legacy) |
| SHADOW        | Isolated scoring/evaluation, no production impact | Direct writes allowed          |
| DEPRECATED    | No longer written to, may still be read           | NONE                           |

---

## Table Registry

### Canonical (Lifecycle-Protected)

| Table                     | Writer           | Lifecycle Adapter                                       | Notes                                  |
| ------------------------- | ---------------- | ------------------------------------------------------- | -------------------------------------- |
| `unified_picks`           | API (multi-role) | `lifecycleInsert`, `lifecycleUpdate`, `lifecycleSettle` | Full field-level authority enforcement |
| `participants`            | SGO Sync         | Application-level                                       | Players, teams, fighters               |
| `participant_memberships` | SGO Sync         | Application-level                                       | Time-bounded roster links              |

### Active (Application-Enforced)

| Table               | Writer                | Purpose                                |
| ------------------- | --------------------- | -------------------------------------- |
| `bridge_outbox`     | Smart Form            | Pick submission bridge                 |
| `agent_health`      | API Agents            | Agent health telemetry                 |
| `prop_settlements`  | SettlementAgent       | Settlement tracking                    |
| `pick_publish`      | DiscordPromotionAgent | Discord publish outbox                 |
| `closing_snapshots` | ClosingSnapshotAgent  | Consensus devig at market close        |
| `clv_results`       | CLV computation       | Per-pick CLV measurement               |
| `player_game_stats` | DataAgent             | Box score data                         |
| `prop_outcomes`     | SettlementAgent       | WIN/LOSS/PUSH outcomes                 |
| `market_policy`     | Operator              | Promotion gate config per sport/market |

### Canonical V3 Schema (Target)

| Table                | Purpose                              | Migration        |
| -------------------- | ------------------------------------ | ---------------- |
| `events`             | Canonical game/match/fight           | `20260220100000` |
| `event_participants` | N-participant roster                 | `20260220100000` |
| `event_segments`     | Quarters, innings, sets              | `20260220100000` |
| `markets`            | Provider-agnostic market definitions | `20260220100000` |
| `provider_offers`    | Multi-book odds snapshots            | `20260220100000` |
| `tickets`            | User bet tickets                     | `20260220100000` |
| `ticket_legs`        | Individual parlay legs               | `20260220100000` |
| `feature_snapshots`  | Scoring model inputs                 | `20260220100000` |
| `scored_legs`        | Scoring model outputs                | `20260220100000` |

### Compatibility (Temporarily Tolerated)

| Table          | Writer                          | Replacement              | Decision           |
| -------------- | ------------------------------- | ------------------------ | ------------------ |
| `raw_props`    | FeedAgent (direct insert)       | `provider_offers`        | TD-1 (SPRINT-035B) |
| `games`        | FeedAgent (direct insert)       | `events`                 | TD-2 (SPRINT-035B) |
| `game_results` | SettlementAgent (direct insert) | Settlement via lifecycle | TD-3 (SPRINT-035B) |

### Shadow (Isolated)

| Table                 | Purpose                    | Migration        |
| --------------------- | -------------------------- | ---------------- |
| `shadow_scoring_runs` | Backfill run metadata      | `20260306000000` |
| `shadow_scores`       | Historical scoring outputs | `20260306000000` |
| `shadow_clv_results`  | Historical CLV             | `20260306000000` |

### Deprecated (No Writes)

| Table         | Replacement                                    |
| ------------- | ---------------------------------------------- |
| `daily_picks` | `unified_picks` (dropped via `20260223100000`) |
| `players`     | `participants`                                 |
| `teams`       | `participants`                                 |

---

## Writer Authority (unified_picks)

| Role                | Field Scope                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| `submitter`         | Initial pick fields (id, selection, line, odds, stake, sport, etc.)                                     |
| `promoter`          | Scoring and promotion fields (tier, professional_score, p_final, edge_final, promotion_band, etc.)      |
| `poster`            | Discord delivery fields (discord_message_id, discord_thread_id, promotion_posted_at, posted_to_discord) |
| `settler`           | Settlement fields (settlement_status, settlement_result, settlement_source, settled_at)                 |
| `operator_override` | ALL fields including immutable ones                                                                     |

## Immutable Fields (unified_picks)

Once set, these cannot be changed except by `operator_override`: `id`,
`bet_slip_id`, `leg_index`, `user_id`, `selection`, `line`, `odds`, `stake`,
`sport`, `bet_type`, `stat_type`, `player_name`, `team`, `direction`, `side`,
`source`, `ticket_type`, `parlay_id`, `pick_type`, `over_odds`, `under_odds`,
`game_date`, `created_at`, `placed_at`, `promotion_posted_at`,
`discord_message_id`, `discord_thread_id`, `settlement_hash`,
`settlement_frozen`, `freeze_enforced_at`

---

## Related Documents

- [Pick Lifecycle Contract](../contracts/PICK_LIFECYCLE_CONTRACT.md)
- [Single-Writer Rule](.../../.claude/rules/03-single-writer-and-idempotency.md)
- [Canonical Runtime Path](../system/CANONICAL_RUNTIME_PATH.md)
