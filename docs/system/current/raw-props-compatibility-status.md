# raw_props Compatibility Status — Post-Shutdown

> Updated: 2026-03-08 | Sprint: SPRINT-044R (previously 044Q)

---

## Compatibility Wrapper Module: DELETED

`apps/api/src/compatibility/rawPropsWriter.ts` has been deleted. Zero production
code writes to `raw_props`. The `compatibility/` directory has been removed.

---

## Remaining raw_props Touchpoints

These are NOT compatibility wrappers. They are direct raw_props references that
remain in the codebase for specific reasons.

| Location                                 | Type       | Purpose                                                  | Removable?                                    |
| ---------------------------------------- | ---------- | -------------------------------------------------------- | --------------------------------------------- |
| `GradingAgent.fetchPendingProps()`       | READ       | Dead raw_props branch (behind GRADING_DATA_SOURCE check) | Yes — cosmetic cleanup                        |
| `GradingAgent.gradeNewProps()`           | READ       | Dead raw_props branch (behind GRADING_DATA_SOURCE check) | Yes — cosmetic cleanup                        |
| `FeedAgent/utils/dedupePublicProps.ts`   | READ       | Checks raw_props.external_id for dedup                   | Yes — after dedup is redirected               |
| ~~`SettlementAgent.initialize()`~~       | ~~READ~~   | ~~raw_props in requiredTables~~                          | **DONE (044R)** — removed from requiredTables |
| ~~`SettlementAgent.processGameProps()`~~ | ~~READ~~   | ~~raw_props query for pending settlement~~               | **DONE (044R)** — reads unified_picks         |
| ~~`SettlementAgent.settleProp()`~~       | ~~WRITE~~  | ~~raw_props settlement_status UPDATE~~                   | **DONE (044R)** — uses lifecycleSettle        |
| `ProviderHealthEndpoint`                 | READ       | raw_props.created_at for freshness monitoring            | Yes — redirect to provider_offers             |
| `ProfessionalPropProcessor`              | READ       | getUnprocessedRawProps() (runner-only, not production)   | Yes — runner cleanup                          |
| Non-production scripts (22+)             | READ/WRITE | Dev runners, test scripts, analysis tools                | Die with table drop                           |

---

## What's Needed to Fully Retire raw_props

1. Redirect `dedupePublicProps()` to check `provider_offers` instead of
   `raw_props`
2. ~~Update `SettlementAgent.initialize()` requiredTables~~ **DONE (044R)**
3. Update `ProviderHealthEndpoint` freshness query
4. Remove dead raw_props branches from `fetchPendingProps()` and
   `gradeNewProps()`
5. Drop `raw_props` table (non-production writers die naturally)

---

## Migration Timeline

| Sprint | Milestone                                                                     |
| ------ | ----------------------------------------------------------------------------- |
| 044D   | Dual-path implementation (GRADING_DATA_SOURCE env var)                        |
| 044N   | All raw_props writers isolated behind compatibility wrappers                  |
| 044O   | ESPN dead writer removed                                                      |
| 044P   | Default flipped to provider_offers                                            |
| 044Q   | All compatibility wrappers deleted; rawPropsWriter.ts removed                 |
| 044R   | Settlement migrated off raw_props — reads unified_picks, uses lifecycleSettle |
| Next   | Redirect remaining reads (dedup, health); drop table                          |
