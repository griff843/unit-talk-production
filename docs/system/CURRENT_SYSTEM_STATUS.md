# Current System Status

Status: CANONICAL Authority: Tier 1 Owner: Platform Architecture Last Verified:
2026-03-07 Sprint: SPRINT-DOCS-CANONICALIZATION-040

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

| Sprint      | Commit     | Summary                                         |
| ----------- | ---------- | ----------------------------------------------- |
| SPRINT-039  | `b254115c` | Model calibration loop + evaluation integration |
| SPRINT-038  | `03ee84c2` | Daily metrics + drift detection                 |
| SPRINT-037  | `391dad84` | Walk-forward evaluation hardening               |
| SPRINT-036  | `7b51bc9c` | Deterministic band calibration                  |
| SPRINT-035B | `64c526fb` | Truth decisions TD-1–TD-7 + Round 2 remediation |
| SPRINT-035A | `52c638d1` | Runtime truth audit Round 1                     |

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

## Schema State

**Total migrations**: 60 files (2025-01-25 through 2026-03-06) **Latest
migration**: `20260306210000_market_policy.sql` — sport/market gating table

**Key recent schema additions**:

- `market_policy` — promotion gate config per sport/market_type
- `shadow_scoring_runs`, `shadow_scores`, `shadow_clv_results` — isolated
  backfill scoring
- `player_game_stats`, `prop_outcomes` — outcome tracking (WIN/LOSS/PUSH)
- `closing_snapshots`, `clv_results` — CLV measurement infrastructure

---

## Related Documents

- [System Overview](./SYSTEM_OVERVIEW.md)
- [Canonical Runtime Path](./CANONICAL_RUNTIME_PATH.md)
- [Table Classification Spec](../governance/TABLE_CLASSIFICATION_SPEC.md)
