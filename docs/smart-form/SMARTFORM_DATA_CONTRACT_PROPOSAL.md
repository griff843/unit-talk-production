# SMART FORM DATA CONTRACT PROPOSAL

**Date**: 2026-02-19 **Sprint**: SMARTFORM-CATALOG-PLUMBING-058 **Status**:
PROPOSAL

---

## 1. Purpose

This contract eliminates drift between database schema, API routes, and frontend
expectations. It is the **single source of truth** for Smart Form data
structures.

**Principle**: If it's not in this contract, it doesn't exist.

---

## 2. Canonical Types (TypeScript + SQL)

### 2.A. StatType Reference

**Table**: `stat_types` (NEW - to be created)

```sql
CREATE TABLE stat_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport TEXT NOT NULL,
  code TEXT NOT NULL,           -- PTS, AST, REB, 3PM
  display_name TEXT NOT NULL,   -- Points, Assists, Rebounds
  category TEXT NOT NULL,       -- scoring, passing, defense
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sport, code)
);
```

**Seed Data**:

```sql
-- NBA
INSERT INTO stat_types (sport, code, display_name, category, sort_order) VALUES
('NBA', 'PTS', 'Points', 'scoring', 1),
('NBA', 'REB', 'Rebounds', 'scoring', 2),
('NBA', 'AST', 'Assists', 'passing', 3),
('NBA', 'PRA', 'Pts+Reb+Ast', 'combo', 4),
('NBA', '3PM', '3-Pointers Made', 'scoring', 5),
('NBA', 'STL', 'Steals', 'defense', 6),
('NBA', 'BLK', 'Blocks', 'defense', 7),
('NBA', 'TO', 'Turnovers', 'other', 8);

-- NFL
INSERT INTO stat_types (sport, code, display_name, category, sort_order) VALUES
('NFL', 'PASS_YDS', 'Passing Yards', 'passing', 1),
('NFL', 'PASS_TD', 'Passing TDs', 'passing', 2),
('NFL', 'RUSH_YDS', 'Rushing Yards', 'rushing', 3),
('NFL', 'RUSH_TD', 'Rushing TDs', 'rushing', 4),
('NFL', 'REC', 'Receptions', 'receiving', 5),
('NFL', 'REC_YDS', 'Receiving Yards', 'receiving', 6),
('NFL', 'REC_TD', 'Receiving TDs', 'receiving', 7),
('NFL', 'INT', 'Interceptions', 'defense', 8);

-- MLB
INSERT INTO stat_types (sport, code, display_name, category, sort_order) VALUES
('MLB', 'H', 'Hits', 'batting', 1),
('MLB', 'HR', 'Home Runs', 'batting', 2),
('MLB', 'RBI', 'RBIs', 'batting', 3),
('MLB', 'TB', 'Total Bases', 'batting', 4),
('MLB', 'K', 'Strikeouts (Pitcher)', 'pitching', 5),
('MLB', 'ER', 'Earned Runs', 'pitching', 6);
```

**TypeScript**:

```typescript
// packages/shared/types/catalog.ts
export interface StatType {
  id: string;
  sport: string;
  code: string; // PTS, AST, REB
  display_name: string; // Points, Assists
  category: string; // scoring, passing
  sort_order: number;
}
```

### 2.B. Player

**Table**: `players` (existing, with clarified column)

| Column       | Type        | Required | Notes                     |
| ------------ | ----------- | -------- | ------------------------- |
| id           | uuid        | ✅       | PK                        |
| full_name    | text        | ✅       | **Canonical column name** |
| sport        | text        | ✅       | NBA, NFL, MLB             |
| team_id      | uuid        | ❌       | FK to teams               |
| position     | text        | ❌       | PG, SF, QB                |
| headshot_url | text        | ❌       | Player photo              |
| meta         | jsonb       | ❌       | Aliases, external IDs     |
| active       | boolean     | ✅       | Default true              |
| created_at   | timestamptz | ✅       |                           |
| updated_at   | timestamptz | ✅       |                           |

**MV Output Contract** (`mv_search_players`):

```typescript
// API response shape - MV aliases full_name → name
export interface PlayerSearchResult {
  id: string;
  name: string; // Aliased from full_name
  sport: string;
  team_id: string | null;
  team_name: string | null;
  team_abbr: string | null;
  position: string | null;
  headshot_url: string | null;
}
```

### 2.C. Team

**Table**: `teams` (existing)

| Column     | Type        | Required | Notes              |
| ---------- | ----------- | -------- | ------------------ |
| id         | uuid        | ✅       | PK                 |
| name       | text        | ✅       | Boston Celtics     |
| abbr       | text        | ✅       | BOS                |
| sport      | text        | ✅       | NBA                |
| team_uuid  | uuid        | ❌       | External reference |
| logo_url   | text        | ❌       |                    |
| meta       | jsonb       | ❌       | Aliases            |
| created_at | timestamptz | ✅       |                    |
| updated_at | timestamptz | ✅       |                    |

**TypeScript**:

```typescript
export interface Team {
  id: string;
  name: string;
  abbr: string;
  sport: string;
  logo_url: string | null;
}
```

### 2.D. Game

**Table**: `games` (existing)

| Column           | Type        | Required | Notes                         |
| ---------------- | ----------- | -------- | ----------------------------- |
| id               | uuid        | ✅       | PK                            |
| sport            | text        | ✅       |                               |
| league           | text        | ✅       | Usually same as sport         |
| home_team        | text        | ✅       | Team name or abbr             |
| away_team        | text        | ✅       | Team name or abbr             |
| game_date        | date        | ✅       |                               |
| start_time       | timestamptz | ✅       |                               |
| status           | text        | ✅       | scheduled, in_progress, final |
| external_game_id | text        | ❌       |                               |
| meta             | jsonb       | ❌       | Odds, venue                   |
| created_at       | timestamptz | ✅       |                               |
| updated_at       | timestamptz | ✅       |                               |

**TypeScript**:

```typescript
export interface Game {
  id: string;
  sport: string;
  home_team: string;
  away_team: string;
  game_date: string; // YYYY-MM-DD
  start_time: string; // ISO timestamp
  status: 'scheduled' | 'in_progress' | 'final';
  display_label: string; // "Heat @ Celtics"
}
```

### 2.E. Prop (Player Prop Line)

**Table**: `raw_props` (existing)

| Column      | Type        | Required | Notes                      |
| ----------- | ----------- | -------- | -------------------------- |
| id          | uuid        | ✅       | PK                         |
| sport       | text        | ✅       |                            |
| player_name | text        | ✅       | Full name                  |
| team        | text        | ❌       | Team name                  |
| stat_type   | text        | ✅       | Must match stat_types.code |
| line        | numeric     | ✅       | 24.5                       |
| over_odds   | integer     | ❌       | -110                       |
| under_odds  | integer     | ❌       | -110                       |
| game_id     | uuid        | ❌       | FK to games                |
| game_date   | date        | ✅       |                            |
| source      | text        | ❌       | DraftKings, FanDuel        |
| created_at  | timestamptz | ✅       |                            |

**TypeScript**:

```typescript
export interface Prop {
  id: string;
  sport: string;
  player_name: string;
  team: string | null;
  stat_type: string; // Must be valid stat_types.code
  line: number;
  over_odds: number | null;
  under_odds: number | null;
  game_id: string | null;
  game_date: string;
  display_label: string; // "Jaylen Brown PTS 24.5"
}
```

---

## 3. API Response Contracts

### 3.A. GET /api/registry/stat-types

**Request**:

```
GET /api/registry/stat-types?sport=NBA
```

**Response**:

```typescript
interface StatTypesResponse {
  stat_types: StatType[];
  meta: {
    total: number;
    sport: string;
    source: 'database';
    timestamp: string;
  };
}
```

**Example**:

```json
{
  "stat_types": [
    { "code": "PTS", "display_name": "Points", "category": "scoring" },
    { "code": "AST", "display_name": "Assists", "category": "passing" },
    { "code": "REB", "display_name": "Rebounds", "category": "scoring" }
  ],
  "meta": {
    "total": 8,
    "sport": "NBA",
    "source": "database",
    "timestamp": "..."
  }
}
```

### 3.B. GET /api/catalog/players

**Request**:

```
GET /api/catalog/players?sport=NBA&q=jaylen
```

**Response**:

```typescript
interface PlayersResponse {
  players: PlayerSearchResult[];
  meta: {
    total: number;
    sport: string;
    query: string | null;
    source: 'database';
    cache_hit: boolean;
    timestamp: string;
  };
}
```

### 3.C. GET /api/catalog/props

**Request**:

```
GET /api/catalog/props?sport=NBA&player_name=Jaylen%20Brown
```

**Response**:

```typescript
interface PropsResponse {
  props: Prop[];
  stat_types: string[]; // Unique stat types in results
  meta: {
    total: number;
    sport: string;
    player_name: string | null;
    source: 'database';
    cache_hit: boolean;
    timestamp: string;
  };
}
```

---

## 4. Validation Rules

### 4.A. Zod Schemas (Smart Form)

```typescript
// apps/smart-form/lib/schemas/catalog.ts
import { z } from 'zod';

export const StatTypeSchema = z.object({
  code: z.string().min(1).max(20),
  display_name: z.string().min(1).max(50),
  category: z.string(),
});

export const PlayerSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  sport: z.enum(['NBA', 'NFL', 'MLB', 'NHL', 'NCAAF', 'NCAAB']),
  team_name: z.string().nullable(),
  position: z.string().nullable(),
});

export const PropSchema = z.object({
  id: z.string().uuid(),
  sport: z.string(),
  player_name: z.string().min(1),
  stat_type: z.string().min(1),
  line: z.number(),
  over_odds: z.number().nullable(),
  under_odds: z.number().nullable(),
});

// API response validation
export const StatTypesResponseSchema = z.object({
  stat_types: z.array(StatTypeSchema),
  meta: z.object({
    total: z.number(),
    sport: z.string(),
    source: z.literal('database'),
    timestamp: z.string(),
  }),
});
```

### 4.B. Database Constraints

```sql
-- Ensure stat_type in raw_props matches stat_types reference
ALTER TABLE raw_props
ADD CONSTRAINT fk_stat_type_valid
FOREIGN KEY (sport, stat_type)
REFERENCES stat_types (sport, code)
DEFERRABLE INITIALLY DEFERRED;

-- Or use a check constraint if FK too restrictive
ALTER TABLE raw_props
ADD CONSTRAINT chk_stat_type_format
CHECK (stat_type ~ '^[A-Z0-9_]+$');
```

---

## 5. Cascading Filter Contract

### 5.A. State Machine

```
INITIAL
  ↓ (sport selected)
SPORT_SELECTED
  → Fetch: teams, stat_types, games
  ↓ (bet type selected)
BET_TYPE_SELECTED
  → If player_prop: enable player search
  ↓ (player selected)
PLAYER_SELECTED
  → Lock team to player's team
  → Fetch: props for player
  → Populate stat_type dropdown from props
  ↓ (stat_type selected)
STAT_TYPE_SELECTED
  → Show available lines
  → Allow manual line override
  ↓
READY_FOR_SUBMISSION
```

### 5.B. Reset Rules

| When Changed | Reset These                         |
| ------------ | ----------------------------------- |
| sport        | team, player, stat_type, line, game |
| bet_type     | player, stat_type, line             |
| player       | stat_type (fetch new), line         |
| stat_type    | line (auto-fill from props)         |

---

## 6. Error States

### 6.A. Empty State Handling

```typescript
interface CatalogEmptyState {
  code: 'NO_DATA';
  entity: 'players' | 'props' | 'stat_types' | 'games';
  sport: string;
  message: string;
  allow_manual: boolean;
}

// Example responses
{
  "stat_types": [],
  "meta": { "total": 0, ... },
  "empty_state": {
    "code": "NO_DATA",
    "entity": "stat_types",
    "sport": "NBA",
    "message": "No stat types available. Use manual entry.",
    "allow_manual": true
  }
}
```

### 6.B. Fallback Chain

```
1. Try MV (mv_search_players)
   ↓ (error)
2. Try base table (players) with correct columns
   ↓ (error)
3. Return empty with manual_mode hint
```

---

## 7. Anti-Drift Guarantees

### 7.A. TypeScript ↔ SQL Sync

All types in `packages/shared/types/catalog.ts` MUST match:

- Supabase generated types
- Migration column definitions
- API response shapes

**Enforcement**: CI step to validate type alignment.

### 7.B. Column Name Rules

| Entity | DB Column   | MV Output        | API Response |
| ------ | ----------- | ---------------- | ------------ |
| Player | `full_name` | `name` (aliased) | `name`       |
| Team   | `name`      | `name`           | `name`       |
| Prop   | `stat_type` | `stat_type`      | `stat_type`  |

**Rule**: API consumers ALWAYS see the MV output column names.

### 7.C. Versioning

```typescript
// Every catalog response includes version
{
  "data": [...],
  "meta": {
    "contract_version": "1.0.0",  // This contract version
    ...
  }
}
```

---

## 8. Migration Path

### Step 1: Create stat_types table

```sql
-- See Section 2.A for full DDL
CREATE TABLE stat_types (...);
INSERT INTO stat_types VALUES (...);
```

### Step 2: Update /api/registry/stat-types

```typescript
// Query stat_types table, not raw_props
const { data } = await sb
  .from('stat_types')
  .select('code, display_name, category, sort_order')
  .eq('sport', sport)
  .eq('active', true)
  .order('sort_order');
```

### Step 3: Fix players API fallback

```typescript
// Use full_name for direct table queries
.from('players')
.select('id, full_name as name, sport, team_id, ...')
.ilike('full_name', `%${q}%`)
```

### Step 4: Add contract_version to responses

```typescript
meta: {
  contract_version: '1.0.0',
  ...
}
```

---

## 9. Acceptance Criteria

- [ ] stat_types table exists with NBA/NFL/MLB seed data
- [ ] /api/registry/stat-types returns from stat_types table
- [ ] /api/catalog/players fallback uses `full_name`
- [ ] All API responses include `contract_version: "1.0.0"`
- [ ] TypeScript types match database schema
- [ ] Empty states return `allow_manual: true`

---

**Contract Owner**: Engineering Team **Review Required**: Before any catalog
schema changes **Version**: 1.0.0
