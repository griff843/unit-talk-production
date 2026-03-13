# SMARTFORM DATA CONTRACT V1

> **Authority**: This contract governs ALL data access for Smart Form API
> routes. Routes MUST query ONLY the versioned contract surfaces defined here.

**Version**: 1.0.1 **Created**: 2026-02-19 **Sprint**:
SMARTFORM-DATA-CONTRACTS-MANUAL-INVENTORY-059

---

## 1. Purpose

This contract defines the **single source of truth** for Smart Form data access
patterns. It eliminates drift between database schema, API routes, and frontend
expectations.

**Core Principle**: If it's not a contract surface, Smart Form cannot query it.

**V1.0.1 Changes**:

- Added `manual_inventory_for_form_v1` for prop suggestions from manual
  submissions
- Added `market_usage_stats_v1` for sorting stat types by usage popularity
- Changed stat-types strategy from inventory-first to **manual-usage-first**
- Props route now returns suggestions (not live props), no dependency on live
  feeds
- Added combo markets: PR, PA, RA to NBA taxonomy

---

## 2. Contract Surfaces

### 2.A. catalog_players_v1

**Type**: View **Purpose**: Player search and selection

| Column           | Type        | Description                                  |
| ---------------- | ----------- | -------------------------------------------- |
| player_id        | uuid        | Primary key                                  |
| player_name      | text        | Full name (derived from `players.full_name`) |
| sport            | text        | Sport code (NBA, NFL, MLB)                   |
| team_id          | uuid        | FK to teams                                  |
| team_name        | text        | Team full name                               |
| team_abbr        | text        | Team abbreviation                            |
| position         | text        | Player position                              |
| headshot_url     | text        | Player photo URL                             |
| search_text      | text        | Pre-computed search field                    |
| contract_version | text        | Always '1.0.1'                               |
| last_updated     | timestamptz | Last modification                            |

**API Route**: `GET /api/catalog/players`

**Query Example**:

```sql
SELECT player_id, player_name, sport, team_name
FROM catalog_players_v1
WHERE sport = 'NBA'
  AND (player_name ILIKE '%brown%' OR search_text ILIKE '%brown%')
ORDER BY player_name
LIMIT 50;
```

### 2.B. catalog_teams_v1

**Type**: View **Purpose**: Team search and selection

| Column           | Type        | Description               |
| ---------------- | ----------- | ------------------------- |
| team_id          | uuid        | Primary key               |
| team_name        | text        | Full team name            |
| team_abbr        | text        | Abbreviation (BOS, LAL)   |
| sport            | text        | Sport code                |
| external_team_id | uuid        | External reference        |
| logo_url         | text        | Team logo URL             |
| search_text      | text        | Pre-computed search field |
| contract_version | text        | Always '1.0.1'            |
| last_updated     | timestamptz | Last modification         |

**API Route**: `GET /api/catalog/teams`

### 2.C. manual_inventory_for_form_v1 (NEW in V1.0.1)

**Type**: View **Purpose**: Prop suggestions derived from manual submissions
(unified_picks)

This surface enables the Smart Form to work **without dependency on live prop
feeds**. It aggregates historical manual submissions to provide line
suggestions.

| Column           | Type        | Description                          |
| ---------------- | ----------- | ------------------------------------ |
| sport            | text        | Sport code                           |
| player_id        | text        | Player ID (nullable for manual only) |
| player_name      | text        | Player full name                     |
| team_abbr        | text        | Player's team abbreviation           |
| market_key       | text        | Stat type code (PTS, AST)            |
| avg_line         | numeric     | Average line from recent submissions |
| min_line         | numeric     | Minimum line seen                    |
| max_line         | numeric     | Maximum line seen                    |
| avg_odds         | integer     | Average odds from submissions        |
| count_recent     | integer     | Number of recent submissions         |
| last_seen_at     | timestamptz | Most recent submission timestamp     |
| contract_version | text        | Always '1.0.1'                       |

**API Route**: `GET /api/catalog/props`

**Query Example**:

```sql
SELECT player_name, market_key, avg_line, count_recent
FROM manual_inventory_for_form_v1
WHERE sport = 'NBA'
  AND player_name ILIKE '%brown%'
ORDER BY count_recent DESC, last_seen_at DESC
LIMIT 50;
```

### 2.D. market_usage_stats_v1 (NEW in V1.0.1)

**Type**: View **Purpose**: Market usage statistics for sorting stat types by
popularity

| Column           | Type        | Description                         |
| ---------------- | ----------- | ----------------------------------- |
| sport            | text        | Sport code                          |
| market_key       | text        | Market code (PTS, AST)              |
| usage_count      | integer     | Total submissions using this market |
| unique_players   | integer     | Distinct players for this market    |
| last_used_at     | timestamptz | Most recent submission              |
| contract_version | text        | Always '1.0.1'                      |

**Used by**: `GET /api/registry/stat-types` for manual-usage-first sorting

### 2.E. market_taxonomy_v1

**Type**: View (backed by `market_taxonomy` table) **Purpose**: Authoritative
list of allowed markets by sport

| Column           | Type        | Description                  |
| ---------------- | ----------- | ---------------------------- |
| id               | uuid        | Primary key                  |
| sport            | text        | Sport code                   |
| market_key       | text        | Market code (PTS, PASS_YDS)  |
| display_name     | text        | Human readable (Points)      |
| category         | text        | Grouping (scoring, passing)  |
| bet_type         | text        | player_prop, team_prop, game |
| sort_order       | integer     | Display order                |
| aliases          | text[]      | Alternative names            |
| contract_version | text        | Always '1.0.1'               |
| last_updated     | timestamptz | Last modification            |

**API Route**: `GET /api/registry/stat-types`

**Required NBA Markets (11 total)**:

| Code | Display Name    | Category |
| ---- | --------------- | -------- |
| PTS  | Points          | scoring  |
| REB  | Rebounds        | rebounds |
| AST  | Assists         | assists  |
| 3PM  | 3-Pointers Made | scoring  |
| PRA  | Pts + Reb + Ast | combo    |
| PR   | Pts + Reb       | combo    |
| PA   | Pts + Ast       | combo    |
| RA   | Reb + Ast       | combo    |
| BLK  | Blocks          | defense  |
| STL  | Steals          | defense  |
| TO   | Turnovers       | misc     |

**Seed Data by Sport**:

| Sport | Markets                                                                                                 |
| ----- | ------------------------------------------------------------------------------------------------------- |
| NBA   | PTS, REB, AST, PRA, PR, PA, RA, 3PM, STL, BLK, TO, DD, TD, FGM, FTM                                     |
| NFL   | PASS_YDS, PASS_TD, PASS_ATT, PASS_COMP, INT, RUSH_YDS, RUSH_ATT, RUSH_TD, REC, REC_YDS, REC_TD, TARGETS |
| MLB   | H, HR, RBI, R, TB, SB, BB, K_BATTER, K, ER, OUTS, HITS_ALLOWED                                          |
| NHL   | G, A, PTS, SOG, SAVES, GAA, BLOCKED, HITS                                                               |

### 2.F. inventory_props_for_form_v1 (DEPRECATED in V1.0.1)

> **Note**: This surface is still available but `GET /api/catalog/props` now
> uses `manual_inventory_for_form_v1` instead. This removes dependency on live
> prop feeds.

**Type**: View **Purpose**: Live props inventory from raw_props (external feeds)

---

## 3. API Response Contracts

### 3.A. Common Response Structure

```typescript
interface ContractResponse<T> {
  data: T;
  meta: {
    total: number;
    sport: string;
    source: 'contract_surface';
    contract_version: '1.0.1';
    timestamp: string; // ISO 8601
    cache_hit?: boolean;
  };
}
```

### 3.B. Props Response (V1.0.1 - Suggestions)

```typescript
interface PropsResponse {
  suggestions: ManualInventorySuggestion[];
  available_markets: string[];
  meta: {
    total: number;
    sport: string;
    source: 'contract_surface';
    contract_version: '1.0.1';
    timestamp: string;
    player_name?: string;
    market_key?: string;
    days_lookback: number;
    cache_hit: boolean;
    manual_inventory: true; // V1.0.1 indicator
  };
}

interface ManualInventorySuggestion {
  sport: string;
  player_id: string | null;
  player_name: string;
  team_abbr: string | null;
  market_key: string;
  avg_line: number | null;
  min_line: number | null;
  max_line: number | null;
  suggested_line: number | null;
  avg_odds: number | null;
  count_recent: number;
  last_seen_at: string | null;
  contract_version: string;
}
```

### 3.C. Stat Types Response (V1.0.1 - Manual Usage)

```typescript
interface StatTypesResponse {
  stat_types: StatTypeItem[];
  meta: {
    total: number;
    sport: string;
    source: 'contract_surface';
    contract_version: '1.0.1';
    timestamp: string;
    bet_type?: string;
    inventory_first: true;
    taxonomy_fallback: boolean;
    manual_usage_enabled: true; // V1.0.1 indicator
  };
}

interface StatTypeItem {
  code: string;
  display_name: string;
  category: string;
  source: 'manual_inventory' | 'taxonomy';
  has_inventory: boolean;
  inventory_count?: number;
  usage_count?: number; // V1.0.1: from manual submissions
  last_used_at?: string | null;
}
```

### 3.D. Response Headers

All contract routes MUST include these headers:

| Header                 | Value        | Description                        |
| ---------------------- | ------------ | ---------------------------------- |
| X-Contract-Version     | 1.0.1        | Contract version                   |
| X-Contract-Surface     | surface_name | Which surface was queried          |
| X-Manual-Inventory     | true         | (props only) V1.0.1 indicator      |
| X-Manual-Usage-Enabled | true         | (stat-types only) V1.0.1 indicator |
| X-Taxonomy-Fallback    | true/false   | (stat-types only) No usage data    |

### 3.E. Error Response

```typescript
interface ContractError {
  error: string;
  code: string;
  contract_version: '1.0.1';
  timestamp: string;
  details?: unknown;
}
```

**Error Codes**:

| Code                   | Description                       |
| ---------------------- | --------------------------------- |
| INVALID_PARAMS         | Query parameter validation failed |
| CONTRACT_SURFACE_ERROR | Database query failed             |
| INTERNAL_ERROR         | Unexpected error                  |

---

## 4. Forbidden Sources

**Routes MUST NOT query these tables/views directly:**

| Forbidden           | Use Instead                    |
| ------------------- | ------------------------------ |
| `players`           | `catalog_players_v1`           |
| `teams`             | `catalog_teams_v1`             |
| `raw_props`         | `manual_inventory_for_form_v1` |
| `unified_picks`     | `manual_inventory_for_form_v1` |
| `mv_search_players` | `catalog_players_v1`           |
| `mv_search_teams`   | `catalog_teams_v1`             |
| `mv_props_for_form` | `manual_inventory_for_form_v1` |

**Enforcement**:

- Zod schema validation on responses
- `verify-data-contracts.ts` script
- E2E tests verify headers
- Code review policy

---

## 5. Stat Types Strategy (V1.0.1)

### Manual-Usage-First with Taxonomy Fallback

```
1. Query market_usage_stats_v1 for markets used in manual submissions
   ↓
2. Query market_taxonomy_v1 for display names and all valid markets
   ↓
3. Merge data:
   - Add usage_count to taxonomy entries
   - Flag markets with has_inventory: true/false
   ↓
4. Sort results:
   - Markets with usage first (by usage_count DESC)
   - Then by taxonomy sort_order
   ↓
5. Return with headers:
   - X-Manual-Usage-Enabled: true
   - X-Taxonomy-Fallback: true/false (based on whether usage data exists)
```

**Why Manual-Usage-First?**

- Works without live prop feeds
- Shows markets users actually pick
- More popular markets appear first
- Taxonomy fallback ensures form always works
- Enables fully manual workflow

---

## 6. Versioning Policy

### Version Format

```
MAJOR.MINOR.PATCH
1.0.1
```

- **MAJOR**: Breaking changes (column removal, type changes)
- **MINOR**: Additive changes (new columns, new surfaces)
- **PATCH**: Bug fixes, performance improvements

### V1.0.0 → V1.0.1 Changes

| Change                       | Type        | Description                         |
| ---------------------------- | ----------- | ----------------------------------- |
| manual_inventory_for_form_v1 | NEW SURFACE | Suggestions from unified_picks      |
| market_usage_stats_v1        | NEW SURFACE | Usage statistics for sorting        |
| PR, PA, RA markets           | NEW DATA    | NBA combo markets added             |
| props route                  | BEHAVIOR    | Returns suggestions, not live props |
| stat-types route             | BEHAVIOR    | Sorts by manual usage first         |

### Migration Path

When upgrading contract version:

1. Create new surface (e.g., `catalog_players_v2`)
2. Update API routes to use new surface
3. Keep old surface for deprecation period (30 days)
4. Remove old surface after deprecation

### Deprecation Headers

```
X-Contract-Deprecated: true
X-Contract-Sunset: 2026-03-19
X-Contract-Migration-Guide: /docs/contracts/migration-v1-to-v2.md
```

---

## 7. Validation

### Zod Schema Location

```
apps/smart-form/lib/contracts/smartform-data-contract-v1.ts
```

### Key Schemas

```typescript
import {
  CatalogPlayerSchema,
  CatalogTeamSchema,
  ManualInventoryItemSchema, // V1.0.1
  ManualInventoryResponseSchema, // V1.0.1
  MarketUsageStatsSchema, // V1.0.1
  MarketTaxonomyItemSchema,
  PlayersResponseSchema,
  StatTypesResponseSchema,
  validateContractResponse,
} from '@/lib/contracts/smartform-data-contract-v1';
```

### Fail-Closed Validation

```typescript
// Response validation - throws on invalid
validateContractResponse(PlayersResponseSchema, response, 'PlayersResponse');
```

---

## 8. Testing

### Verification Script

```bash
# Run contract verification
cd apps/smart-form
npx tsx scripts/verify-data-contracts.ts

# JSON output for CI
npx tsx scripts/verify-data-contracts.ts --json
```

### E2E Tests

```bash
# Run contract E2E tests
cd apps/smart-form
npx playwright test smartform-data-contracts.spec.ts
```

### What Tests Verify

- [x] Contract surfaces exist (including manual_inventory_for_form_v1)
- [x] Required columns present
- [x] API returns X-Contract-Version: 1.0.1 header
- [x] API returns X-Contract-Surface header
- [x] API returns X-Manual-Inventory: true (props route)
- [x] Response matches Zod schema
- [x] Error responses include contract_version
- [x] All 11 required NBA markets present (including PR, PA, RA)
- [x] Manual flow works without live prop dependency

---

## 9. Maintenance

### Adding a New Market

```sql
INSERT INTO market_taxonomy (sport, market_key, display_name, category, bet_type, sort_order)
VALUES ('NBA', 'NEW_STAT', 'New Statistic', 'other', 'player_prop', 99);
```

### Refreshing Views

Contract surfaces are views (not materialized), so they reflect base table
changes immediately.

For materialized views upstream:

```sql
SELECT refresh_search_mvs();
```

### Monitoring

- Track `X-Taxonomy-Fallback: true` rate
- Track `X-Manual-Inventory: true` (should always be true in V1.0.1)
- Alert if manual_inventory_for_form_v1 has no data for 24+ hours
- Monitor 503 errors (contract surface unavailable)

---

## 10. References

| Document             | Location                                                               |
| -------------------- | ---------------------------------------------------------------------- |
| V1.0.1 Migration SQL | `supabase/migrations/20260219160000_smartform_manual_inventory_v1.sql` |
| V1.0.0 Migration SQL | `supabase/migrations/20260219150000_smartform_data_contracts_v1.sql`   |
| Zod Schemas          | `apps/smart-form/lib/contracts/smartform-data-contract-v1.ts`          |
| Verification Script  | `apps/smart-form/scripts/verify-data-contracts.ts`                     |
| E2E Tests            | `apps/smart-form/tests/e2e/smartform-data-contracts.spec.ts`           |
| Players Route        | `apps/smart-form/app/api/catalog/players/route.ts`                     |
| Stat Types Route     | `apps/smart-form/app/api/registry/stat-types/route.ts`                 |
| Props Route          | `apps/smart-form/app/api/catalog/props/route.ts`                       |

---

**Contract Owner**: Engineering Team **Review Required**: Before any contract
surface changes **Enforcement**: CI/CD + Code Review
