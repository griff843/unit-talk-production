# Provider Normalization — Target Architecture

> Generated: 2026-03-07 | Sprint: SPRINT-SYSTEM-DOCUMENTATION-FOUNDATION

---

## Overview

In the target architecture, all providers normalize to `ProviderOfferPayload`
before entering the database via the `upsert_provider_offers_bootstrap` RPC.
This replaces the current flat `RawProp` normalization.

---

## Canonical Payload Format

**File**: `apps/api/src/services/offersCache.ts`

```typescript
interface ProviderOfferPayload {
  provider_key: string; // 'sgo' | 'fanduel' | 'draftkings' | etc.
  provider_event_id: string; // Provider's event/game ID
  provider_market_key: string; // Provider's market identifier
  line?: number;
  over_odds?: number;
  under_odds?: number;
  home_odds?: number;
  away_odds?: number;
  yes_odds?: number;
  no_odds?: number;
  snapshot_at: string; // ISO timestamp of when captured

  // Enrichment fields (for auto-event creation)
  sport_key?: string;
  home_team?: string;
  away_team?: string;
  commence_time?: string;
}
```

---

## Provider Mappings (Target)

### SGO -> ProviderOfferPayload

| SGO Field                           | Payload Field         | Notes                   |
| ----------------------------------- | --------------------- | ----------------------- |
| --                                  | `provider_key`        | `'sgo'` (constant)      |
| `eventID`                           | `provider_event_id`   | Direct                  |
| `overMarketKey` or `underMarketKey` | `provider_market_key` | Market identifier       |
| `line`                              | `line`                | Direct                  |
| `overOdds`                          | `over_odds`           | American odds           |
| `underOdds`                         | `under_odds`          | American odds           |
| `startsAtUTC`                       | `commence_time`       | For auto-event creation |
| `homeTeam`                          | `home_team`           | For auto-event creation |
| `awayTeam`                          | `away_team`           | For auto-event creation |
| `leagueID`                          | `sport_key`           | Lowercase               |

### Odds API -> ProviderOfferPayload

| Odds API Field               | Payload Field                                       | Notes                         |
| ---------------------------- | --------------------------------------------------- | ----------------------------- |
| `bookmaker.key`              | `provider_key`                                      | Via BOOKMAKER_TO_PROVIDER map |
| `game.id`                    | `provider_event_id`                                 | Direct                        |
| `{marketKey}:{outcome.name}` | `provider_market_key`                               | Composite                     |
| `outcome.point`              | `line`                                              | For spreads/totals            |
| varies by market             | `over_odds`, `under_odds`, `home_odds`, `away_odds` | Market-specific               |
| now()                        | `snapshot_at`                                       | Capture time                  |
| `game.sport_key`             | `sport_key`                                         | Direct                        |
| `game.home_team`             | `home_team`                                         | Direct                        |
| `game.away_team`             | `away_team`                                         | Direct                        |
| `game.commence_time`         | `commence_time`                                     | Direct                        |

**Bookmaker mapping** (existing in providerOffersIngestion.ts):

```
fanduel -> fanduel
draftkings -> draftkings
betmgm -> betmgm
caesars -> caesars
williamhill_us -> caesars
espnbet -> espnbet
pinnacle -> pinnacle
```

### Optimal API -> ProviderOfferPayload

| Optimal Field             | Payload Field             | Notes                  |
| ------------------------- | ------------------------- | ---------------------- |
| --                        | `provider_key`            | `'optimal'` (constant) |
| `eventId`                 | `provider_event_id`       | Direct                 |
| `{propType}:{playerName}` | `provider_market_key`     | Composite              |
| `line`                    | `line`                    | Direct                 |
| `over_odds`, `under_odds` | `over_odds`, `under_odds` | After pairing          |
| now()                     | `snapshot_at`             | Capture time           |

---

## RPC Flow

```
ProviderOfferPayload[]
  |
  v
upsert_provider_offers_bootstrap(p_provider_key, p_captured_at, p_offers)
  |
  +-- For each offer:
  |     +-- Find or create event (provider_event_id -> events.external_id)
  |     +-- Find or create market (provider_market_key -> markets.canonical_key)
  |     +-- Find participant (player name lookup -> participants)
  |     +-- INSERT into provider_offers with resolved FKs
  |
  +-- Return: { inserted_count, updated_count, events_created }
```

---

## Settlement Traceability (Target)

| Provider | Event Match                  | Market Match                                    | Player Match                    |
| -------- | ---------------------------- | ----------------------------------------------- | ------------------------------- |
| SGO      | events.external_id = eventID | provider_offers.provider_market_key = marketKey | participants.name = playerName  |
| Odds API | events.external_id = game.id | provider_offers via market resolution           | N/A (game-level)                |
| Optimal  | events.external_id = eventId | provider_offers via market resolution           | participants.name = player_name |

All settlement matching uses FK chains through canonical tables instead of
string matching on denormalized fields.

---

## Key Differences from Current

| Aspect              | Current (RawProp)        | Target (ProviderOfferPayload)                       |
| ------------------- | ------------------------ | --------------------------------------------------- |
| Schema              | 66 nullable fields       | 12 typed fields                                     |
| Identity resolution | String matching          | FK resolution via RPC                               |
| Deduplication       | 24h window + external_id | Composite unique constraint on provider_offers      |
| Multi-book support  | One row per provider     | Multiple rows per event (one per book per snapshot) |
| CLV readiness       | No                       | is_opening / is_closing flags                       |
| Settlement matching | external_game_id string  | events.external_id FK chain                         |
