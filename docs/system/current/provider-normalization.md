# Provider Normalization — Current System

> Generated: 2026-03-07 | Sprint: SPRINT-SYSTEM-DOCUMENTATION-FOUNDATION

---

## Overview

Three external providers feed data into the platform. Each is normalized to the
internal `RawProp` structure before storage in `raw_props`. The
`dataSourceRouter` selects which provider to query based on sport and
availability.

---

## 1. SportsGameOdds (SGO)

**Module**: `apps/api/src/logic/providers/sgoFetcher.ts` **Router function**:
`fetchFromSGO()` in `dataSourceRouter.ts` **API**:
`https://api.sportsgameodds.com/v2/events` **Auth**: `SGO_API_KEY` environment
variable **Rate limit**: 10 req/min (6s delay between requests) **Leagues**:
NFL, NBA, MLB, NHL, NCAAF, NCAAB, WNBA

### Transformation Pipeline

```
fetchSGOEvents() -> raw event objects
  -> flattenSGOEvents() -> SGOFlattenedProp (one per offer side)
    -> pairOverUnderProps() -> SGOPairedProp (over/under grouped)
      -> mapSGOPairedToRawProp() -> RawProp
```

### Field Mapping (SGO -> RawProp)

| SGO Field                          | RawProp Field             | Notes                                           |
| ---------------------------------- | ------------------------- | ----------------------------------------------- |
| `eventID`                          | `external_game_id`        | Game identifier                                 |
| `eventID + marketKey + playerName` | `external_id`             | Composite: `sgo:{eventID}:{marketKey}:{player}` |
| `playerName`                       | `player_name`             | Direct                                          |
| `statType`                         | `stat_type`               | Direct                                          |
| `line`                             | `line`                    | Numeric conversion                              |
| `overOdds`                         | `over_odds`               | American odds                                   |
| `underOdds`                        | `under_odds`              | American odds                                   |
| `homeTeam`                         | `home_team`               | Direct                                          |
| `awayTeam`                         | `away_team`               | Direct                                          |
| `startsAtUTC`                      | `game_time`, `start_time` | ISO timestamp                                   |
| `overMarketKey`                    | `meta.over_market_key`    | Settlement traceability                         |
| `underMarketKey`                   | `meta.under_market_key`   | Settlement traceability                         |
| `leagueID`                         | `sport`, `league`         | Uppercase                                       |

### Settlement Identifiers

- `eventID` -> game result lookup
- `overMarketKey` / `underMarketKey` -> specific market side lookup
- `playerName` -> player identification

### Known Quirks

- Team IDs are strings (e.g., "BROOKLYN_NETS_NBA") but schema expects integer FK
  -> stored as null
- Market keys repeat across events/players -> composite external_id prevents
  unique constraint violations
- Flattened format creates both single-sided and paired records -> pairing step
  deduplicates

---

## 2. Odds API

**Module**: `apps/api/src/agents/FeedAgent/oddsApi.ts` **API**:
`https://api.the-odds-api.com/v4/sports/{sportKey}/odds` **Auth**:
`ODDS_API_KEY` query parameter **Credit budget**: ~500/month (1 credit per
request) **Sports**: NFL, NBA, MLB, NHL, NCAAF, NCAAB, WNBA, EPL, ATP + more

### Field Mapping (Odds API -> RawProp)

| Odds API Field          | RawProp Field                     | Notes                                                |
| ----------------------- | --------------------------------- | ---------------------------------------------------- |
| `game.id`               | `external_game_id`, `external_id` | Direct                                               |
| `sport_key`             | `sport`                           | Mapped: "americanfootball_nfl" -> "NFL"              |
| `home_team @ away_team` | `matchup`                         | Formatted                                            |
| `market.key`            | `stat_type`                       | h2h -> moneyline, spreads -> spread, totals -> total |
| `outcome.point`         | `line`                            | For spreads/totals                                   |
| `outcome.price`         | `over_odds` / `under_odds`        | Market-specific pairing                              |
| `bookmaker.key`         | `source`                          | Provider name                                        |

### Market Pairing

- **h2h**: home team -> over_odds, away team -> under_odds
- **spreads**: pair by same absolute point value
- **totals**: "Over" -> over_odds, "Under" -> under_odds

### Settlement

Uses separate `/v4/sports/{sportKey}/scores` endpoint. Returns completed games
with final scores. Matched by `game.id`.

---

## 3. Optimal API

**Module**: `apps/api/src/agents/FeedAgent/optimal.ts` **API**:
`https://api.optimal-bet.com/v1/playerProps/{sport}` **Rate limit**: 900
req/hour **Sports**: NFL, NBA, MLB, NHL

### Field Mapping (Optimal -> RawProp)

| Optimal Field             | RawProp Field             | Notes                     |
| ------------------------- | ------------------------- | ------------------------- |
| `game_id` prefix          | `sport`                   | Detected: "NBA-" -> "NBA" |
| `player_name`             | `player_name`             | Direct                    |
| `team`                    | `team`                    | Direct                    |
| `opponent`                | `opponent`                | Direct                    |
| `prop_type`               | `stat_type`               | Direct                    |
| `line`                    | `line`                    | Direct                    |
| `over_odds`, `under_odds` | `over_odds`, `under_odds` | After pairing             |

### Single-Sided Odds Estimation

When only one side available, probability conversion estimates the missing side:

```
overProb = 100 / (overOdds + 100)
underProb = 1 - overProb
underOdds = calculated via American formula
```

### Known Limitations

- No direct settlement endpoint (limited traceability)
- Sport detection requires game_id prefix parsing
- Missing home_team/away_team in response

---

## 4. Internal Normalized Schema (RawProp)

**Definition**: `apps/api/src/types/rawProps.ts`

### Core Fields

| Field              | Type    | Required | Purpose                    |
| ------------------ | ------- | -------- | -------------------------- |
| `id`               | UUID    | Yes      | Primary key                |
| `external_id`      | TEXT    | Yes      | Provider-unique identifier |
| `external_game_id` | TEXT    | No       | Provider game/event ID     |
| `player_name`      | TEXT    | Yes\*    | Player identification      |
| `stat_type`        | TEXT    | Yes      | Market stat type           |
| `line`             | NUMERIC | Yes      | Betting line               |
| `over_odds`        | INTEGER | No       | American odds              |
| `under_odds`       | INTEGER | No       | American odds              |
| `sport`            | TEXT    | Yes      | League enum                |
| `source`           | TEXT    | Yes      | Provider name              |
| `meta`             | JSONB   | No       | Provider-specific metadata |

\*66 total fields, all nullable via Zod schema to accommodate incomplete
provider data.

### Fields Required for Settlement

| Field                   | Purpose                     | Available From                    |
| ----------------------- | --------------------------- | --------------------------------- |
| `external_game_id`      | Match game results          | SGO (eventID), Odds API (game.id) |
| `external_id`           | Unique prop identification  | All providers                     |
| `player_name`           | Player matching             | All providers                     |
| `stat_type`             | Stat resolution             | All providers                     |
| `line`                  | WIN/LOSS/PUSH determination | All providers                     |
| `meta.over_market_key`  | SGO settlement lookup       | SGO only                          |
| `meta.under_market_key` | SGO settlement lookup       | SGO only                          |

---

## Router Selection Logic

**File**: `apps/api/src/agents/FeedAgent/dataSourceRouter.ts`

| Sport | Primary     | Secondary | Final Fallback |
| ----- | ----------- | --------- | -------------- |
| NFL   | optimal-api | odds-api  | SGO            |
| NBA   | optimal-api | odds-api  | SGO            |
| MLB   | optimal-api | odds-api  | SGO            |
| NHL   | optimal-api | odds-api  | SGO            |
| NCAAF | odds-api    | --        | SGO            |
| NCAAB | odds-api    | --        | SGO            |
| WNBA  | odds-api    | --        | SGO            |

Decision priority:

1. `forceSource` specified -> use it
2. Settlement request -> Odds API only
3. Player props + sport supports -> Optimal API primary
4. NCAAF -> Odds API only
5. Otherwise -> configured primary with secondary fallback
6. If primary + secondary both empty -> SGO (if supported league)
