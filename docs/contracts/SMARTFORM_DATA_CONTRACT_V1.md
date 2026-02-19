# SMARTFORM DATA CONTRACT V1

> **Authority**: This contract governs ALL data access for Smart Form API
> routes. Routes MUST query ONLY the versioned contract surfaces defined here.

**Version**: 1.0.0 **Created**: 2026-02-19 **Sprint**:
SMARTFORM-DATA-CONTRACTS-INVENTORY-SURFACE-059

---

## 1. Purpose

This contract defines the **single source of truth** for Smart Form data access
patterns. It eliminates drift between database schema, API routes, and frontend
expectations.

**Core Principle**: If it's not a contract surface, Smart Form cannot query it.

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
| contract_version | text        | Always '1.0.0'                               |
| last_updated     | timestamptz | Last modification                            |

**API Route**: `GET /api/catalog/players` **Query Example**:

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
| contract_version | text        | Always '1.0.0'            |
| last_updated     | timestamptz | Last modification         |

**API Route**: `GET /api/catalog/teams`

### 2.C. inventory_props_for_form_v1

**Type**: View **Purpose**: Props inventory for Smart Form selection

| Column           | Type        | Description               |
| ---------------- | ----------- | ------------------------- |
| prop_id          | uuid        | Primary key               |
| sport            | text        | Sport code                |
| game_id          | uuid        | FK to games               |
| start_time       | timestamptz | Game start time           |
| game_date        | date        | Game date                 |
| matchup          | text        | "Away @ Home" display     |
| home_team        | text        | Home team                 |
| away_team        | text        | Away team                 |
| player_name      | text        | Player full name          |
| team_abbr        | text        | Player's team             |
| market_key       | text        | Stat type code (PTS, AST) |
| line             | numeric     | Prop line value           |
| over_odds        | integer     | Over odds                 |
| under_odds       | integer     | Under odds                |
| book             | text        | Sportsbook source         |
| prop_key         | text        | Unique dedup key          |
| display_label    | text        | "Player Stat Line"        |
| contract_version | text        | Always '1.0.0'            |
| last_updated     | timestamptz | Last modification         |

**API Route**: `GET /api/catalog/props` **Query Example**:

```sql
SELECT prop_id, player_name, market_key, line, over_odds, under_odds
FROM inventory_props_for_form_v1
WHERE sport = 'NBA'
  AND player_name ILIKE '%brown%'
ORDER BY player_name, market_key
LIMIT 50;
```

### 2.D. market_taxonomy_v1

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
| contract_version | text        | Always '1.0.0'               |
| last_updated     | timestamptz | Last modification            |

**API Route**: `GET /api/registry/stat-types`

**Seed Data**:

| Sport | Markets                                                                                                 |
| ----- | ------------------------------------------------------------------------------------------------------- |
| NBA   | PTS, REB, AST, PRA, 3PM, STL, BLK, TO, DD, TD, FGM, FTM                                                 |
| NFL   | PASS_YDS, PASS_TD, PASS_ATT, PASS_COMP, INT, RUSH_YDS, RUSH_ATT, RUSH_TD, REC, REC_YDS, REC_TD, TARGETS |
| MLB   | H, HR, RBI, R, TB, SB, BB, K_BATTER, K, ER, OUTS, HITS_ALLOWED                                          |
| NHL   | G, A, PTS, SOG, SAVES, GAA, BLOCKED, HITS                                                               |

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
    contract_version: '1.0.0';
    timestamp: string; // ISO 8601
    cache_hit?: boolean;
  };
}
```

### 3.B. Response Headers

All contract routes MUST include these headers:

| Header              | Value        | Description               |
| ------------------- | ------------ | ------------------------- |
| X-Contract-Version  | 1.0.0        | Contract version          |
| X-Contract-Surface  | surface_name | Which surface was queried |
| X-Inventory-First   | true/false   | (stat-types only)         |
| X-Taxonomy-Fallback | true/false   | (stat-types only)         |

### 3.C. Error Response

```typescript
interface ContractError {
  error: string;
  code: string;
  contract_version: '1.0.0';
  timestamp: string;
  details?: unknown;
}
```

**Error Codes**: | Code | Description | |------|-------------| | INVALID_PARAMS
| Query parameter validation failed | | CONTRACT_SURFACE_ERROR | Database query
failed | | INTERNAL_ERROR | Unexpected error |

---

## 4. Forbidden Sources

**Routes MUST NOT query these tables/views directly:**

| Forbidden           | Use Instead                   |
| ------------------- | ----------------------------- |
| `players`           | `catalog_players_v1`          |
| `teams`             | `catalog_teams_v1`            |
| `raw_props`         | `inventory_props_for_form_v1` |
| `mv_search_players` | `catalog_players_v1`          |
| `mv_search_teams`   | `catalog_teams_v1`            |
| `mv_props_for_form` | `inventory_props_for_form_v1` |

**Enforcement**:

- Zod schema validation on responses
- `verify-data-contracts.ts` script
- E2E tests verify headers
- Code review policy

---

## 5. Stat Types Strategy

### Inventory-First with Taxonomy Fallback

```
1. Query inventory_props_for_form_v1 for distinct market_keys
   ↓
2. If inventory has data:
   → Return inventory markets + taxonomy display names
   → Set X-Inventory-First: true, X-Taxonomy-Fallback: false
   ↓
3. If inventory is empty:
   → Return full taxonomy for sport
   → Set X-Inventory-First: true, X-Taxonomy-Fallback: true
```

**Why Inventory-First?**

- Shows only markets with actual available props
- Prevents users from selecting unavailable markets
- Taxonomy fallback ensures form works even without live data

---

## 6. Versioning Policy

### Version Format

```
MAJOR.MINOR.PATCH
1.0.0
```

- **MAJOR**: Breaking changes (column removal, type changes)
- **MINOR**: Additive changes (new columns, new surfaces)
- **PATCH**: Bug fixes, performance improvements

### Migration Path

When upgrading contract version:

1. Create new surface (e.g., `catalog_players_v2`)
2. Update API routes to use new surface
3. Keep old surface for deprecation period (30 days)
4. Remove old surface after deprecation

### Deprecation

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
  InventoryPropSchema,
  MarketTaxonomyItemSchema,
  PlayersResponseSchema,
  PropsResponseSchema,
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

- [ ] Contract surfaces exist
- [ ] Required columns present
- [ ] API returns X-Contract-Version header
- [ ] API returns X-Contract-Surface header
- [ ] Response matches Zod schema
- [ ] Error responses include contract_version

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
- Alert if > 50% of requests use taxonomy fallback (means no live props)
- Monitor 503 errors (contract surface unavailable)

---

## 10. References

| Document            | Location                                                             |
| ------------------- | -------------------------------------------------------------------- |
| Migration SQL       | `supabase/migrations/20260219150000_smartform_data_contracts_v1.sql` |
| Zod Schemas         | `apps/smart-form/lib/contracts/smartform-data-contract-v1.ts`        |
| Verification Script | `apps/smart-form/scripts/verify-data-contracts.ts`                   |
| E2E Tests           | `apps/smart-form/tests/e2e/smartform-data-contracts.spec.ts`         |
| Players Route       | `apps/smart-form/app/api/catalog/players/route.ts`                   |
| Stat Types Route    | `apps/smart-form/app/api/registry/stat-types/route.ts`               |
| Props Route         | `apps/smart-form/app/api/catalog/props/route.ts`                     |

---

**Contract Owner**: Engineering Team **Review Required**: Before any contract
surface changes **Enforcement**: CI/CD + Code Review
