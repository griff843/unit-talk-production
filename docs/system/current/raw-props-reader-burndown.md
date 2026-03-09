# raw_props Reader Burndown — Running Tracker

> Updated: 2026-03-08 | Sprint: SPRINT-044R (previously 044Q, 044P, 044O, 044N)

---

## Current raw_props Reference Count: ~22

Baseline (post-044L dead code removal): ~38 After 044M easy reader migration:
~31 (-7) After 044R settlement migration: ~22 (-9)

---

## Category Status

| #   | Category            | Refs | Status                                                                   | Blocked On                       |
| --- | ------------------- | ---- | ------------------------------------------------------------------------ | -------------------------------- |
| 1   | Grading Pipeline    | 5    | **MIGRATED (044P)** — dead code in else branches                         | GRADING_DATA_SOURCE flipped      |
| 2   | Data Ingestion      | 0    | **REMOVED (044Q)** — compatInsertRawProp deleted                         | --                               |
| 3   | Duplicate Detection | 3    | ACTIVE                                                                   | Ingestion writes must stop first |
| 4   | Health Checks       | 0    | **MIGRATED (044M)**                                                      | --                               |
| 5   | Settlement          | 0    | **MIGRATED (044R)** — SettlementAgent reads unified_picks, not raw_props | --                               |
| 6   | Publishing/Shadow   | 2    | ACTIVE                                                                   | offer_id availability            |
| 7   | Type Definitions    | 3    | PASSIVE                                                                  | Table existence                  |
| 8   | Archived/Dev        | ~5   | PASSIVE                                                                  | Nothing (final cleanup)          |

---

## Migration History

| Sprint | Action                                                                                                                   | Refs Removed                                  |
| ------ | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| 044J   | Retirement readiness audit                                                                                               | 0 (analysis)                                  |
| 044K   | Grading field truth audit                                                                                                | 0 (analysis)                                  |
| 044L   | Dead code removal (7 files) + docs                                                                                       | ~7 (dead code)                                |
| 044M   | Health check migration (3 edits) + dev utility deletion (3 files)                                                        | 7                                             |
| 044N   | Writer isolation (7 production call sites wrapped)                                                                       | 0 (isolation only)                            |
| 044O   | Writer shutdown: espnGradingService.ts deleted, compatUpdatePropResult() removed                                         | 0 (writer-side only)                          |
| 044P   | GRADING_DATA_SOURCE default flipped to provider_offers; gradeNewProps() routed                                           | ~5 (grading pipeline reads now dead code)     |
| 044Q   | Wrapper shutdown: all 3 compat functions deleted, rawPropsWriter.ts deleted, raw_props branches removed                  | ~4 (ingestion writes + dead grading branches) |
| 044R   | Settlement migration: SettlementAgent reads unified_picks, prop_settlements uses final_pick_id, raw_props UPDATE removed | ~9 (all settlement reads)                     |

---

## Critical Path

```
DONE:  Dead code removal (044L)
DONE:  Health checks + dev utilities (044M)
DONE:  Writer isolation behind compatibility wrappers (044N)
DONE:  Non-essential writer shutdown — ESPN dead code removed (044O)
DONE:  Flip GRADING_DATA_SOURCE default → provider_offers (044P)
DONE:  Delete all compat wrappers + raw_props branches + orphaned writes (044Q)
DONE:  Settlement migration — SettlementAgent reads unified_picks (044R)
NEXT:  Redirect dedup queries (dedupePublicProps raw_props read)
THEN:  Publishing/Shadow offer_id
LAST:  Drop types + archived code + table
```

---

## Source of Truth

- Field-level analysis: `out/sprints/SPRINT-044K/` (28-field audit)
- Reference map: `out/sprints/SPRINT-044L/` (compatibility isolation map)
- Reader migration manifest: `out/sprints/SPRINT-044M/`
- Writer inventory: `out/sprints/SPRINT-044N/` +
  `docs/system/current/raw-props-writer-inventory.md`
- Writer shutdown: `out/sprints/SPRINT-044O/` +
  `docs/system/current/raw-props-writer-shutdown-status.md`
