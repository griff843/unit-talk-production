# SEARCH CATALOG CONTRACT V1

> **Authority**: This contract governs ALL search and catalog functionality for
> the Unit Talk platform. Smart Form, API, and all services MUST comply.

**Version**: 1.0.0
**Created**: 2026-02-18
**Sprint**: SEARCH-CATALOG-CONTRACT-035

---

## 1. Purpose

This contract defines the canonical search and catalog architecture for
sportsbook-grade entity resolution. All typeahead, dropdown, and filtering
operations MUST use the defined API routes and Postgres-backed infrastructure.

**Goals**:
- Typo-tolerant search (pg_trgm + GIN indexes)
- Cascading filters: Sport → Games → Teams → Players → Props
- <200ms P95 for typeahead queries
- Zero hardcoded mock data
- Single canonical query path (no drift)

---

## 2. Canonical Catalog Entities

### 2.A. Sports/Leagues

| Sport | League | Canonical Value |
|-------|--------|-----------------|
| NFL | National Football League | `NFL` |
| NBA | National Basketball Association | `NBA` |
| MLB | Major League Baseball | `MLB` |
| NHL | National Hockey League | `NHL` |
| NCAAF | NCAA Football | `NCAAF` |
| NCAAB | NCAA Basketball | `NCAAB` |

**Storage**: Static enum at application level. No database table required.

### 2.B. Teams

**Table**: `teams`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| name | text | Full team name (e.g., "Boston Celtics") |
| abbr | text | Abbreviation (e.g., "BOS") |
| sport | text | Sport code (e.g., "NBA") |
| team_uuid | uuid | External UUID reference |
| meta | jsonb | Additional metadata |
| logo_url | text | Team logo URL |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Update timestamp |

**Aliases**: Stored in `meta.aliases` as string array for fuzzy matching.
```json
{
  "aliases": ["Celtics", "Boston", "BOS", "The Celtics"],
  "deprecated": false
}
```

### 2.C. Players

**Table**: `players`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| name | text | Full player name |
| team_id | uuid | FK to teams.id |
| sport | text | Sport code |
| position | text | Player position |
| jersey_number | text | Jersey number |
| meta | jsonb | Additional metadata |
| headshot_url | text | Player headshot URL |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Update timestamp |

**Aliases**: Stored in `meta.aliases` for fuzzy matching.
```json
{
  "aliases": ["J. Brown", "Jaylen", "JB"],
  "display_name": "Jaylen Brown"
}
```

### 2.D. Games/Events

**Table**: `games`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| sport | text | Sport code |
| league | text | League (same as sport in most cases) |
| home_team | text | Home team identifier |
| away_team | text | Away team identifier |
| game_date | date | Game date |
| start_time | timestamptz | Game start time |
| status | text | scheduled, in_progress, final |
| external_game_id | text | External system ID |
| meta | jsonb | Odds, matchup info, etc. |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Update timestamp |

### 2.E. Markets/Props

**Table**: `raw_props`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| sport | text | Sport code |
| player_name | text | Player name |
| team | text | Team name |
| stat_type | text | Stat type (PTS, REB, AST, etc.) |
| line | numeric | Prop line value |
| over_odds | numeric | Over odds |
| under_odds | numeric | Under odds |
| game_id | uuid | FK to games.id |
| game_date | date | Game date |
| source | text | Data source |
| created_at | timestamptz | Creation timestamp |

---

## 3. Canonical Read APIs

All Smart Form catalog/search operations MUST use these endpoints:

### 3.A. Leagues/Sports

```
GET /api/catalog/leagues
```

**Response**:
```json
{
  "leagues": [
    { "code": "NBA", "name": "National Basketball Association", "active": true },
    { "code": "NFL", "name": "National Football League", "active": true }
  ],
  "meta": { "total": 6, "source": "static", "timestamp": "..." }
}
```

### 3.B. Teams

```
GET /api/catalog/teams?sport={sport}&q={search_query}
```

**Parameters**:
- `sport` (required): Sport code
- `q` (optional): Search query for fuzzy matching

**Response**:
```json
{
  "teams": [
    { "id": "uuid", "name": "Boston Celtics", "abbr": "BOS", "sport": "NBA" }
  ],
  "meta": { "total": 30, "source": "database", "timestamp": "..." }
}
```

### 3.C. Games

```
GET /api/catalog/games?sport={sport}&date={date}&team_id={team_id}
```

**Parameters**:
- `sport` (required): Sport code
- `date` (optional): Game date (YYYY-MM-DD), defaults to today
- `team_id` (optional): Filter by team

**Response**:
```json
{
  "games": [
    {
      "id": "uuid",
      "sport": "NBA",
      "home_team": { "id": "uuid", "name": "Boston Celtics" },
      "away_team": { "id": "uuid", "name": "Miami Heat" },
      "start_time": "2026-02-18T19:30:00Z",
      "status": "scheduled",
      "display_label": "Heat @ Celtics"
    }
  ],
  "meta": { "total": 12, "source": "database", "timestamp": "..." }
}
```

### 3.D. Players

```
GET /api/catalog/players?sport={sport}&team_id={team_id}&q={search_query}
```

**Parameters**:
- `sport` (required): Sport code
- `team_id` (optional): Filter by team
- `q` (optional): Search query for fuzzy matching

**Response**:
```json
{
  "players": [
    {
      "id": "uuid",
      "name": "Jaylen Brown",
      "team": { "id": "uuid", "name": "Boston Celtics" },
      "position": "SF",
      "sport": "NBA"
    }
  ],
  "meta": { "total": 15, "source": "database", "timestamp": "..." }
}
```

### 3.E. Props

```
GET /api/catalog/props?sport={sport}&player_id={player_id}&stat_type={stat_type}
```

**Parameters**:
- `sport` (required): Sport code
- `player_id` (optional): Filter by player
- `stat_type` (optional): Filter by stat type

**Response**:
```json
{
  "props": [
    {
      "id": "uuid",
      "player_name": "Jaylen Brown",
      "stat_type": "PTS",
      "line": 24.5,
      "over_odds": -110,
      "under_odds": -110
    }
  ],
  "meta": { "total": 8, "source": "database", "timestamp": "..." }
}
```

### 3.F. Unified Search

```
GET /api/search?q={query}&sport={sport}&type={player|team|game}
```

**Parameters**:
- `q` (required): Search query (min 2 chars)
- `sport` (optional): Scope to sport
- `type` (optional): Filter by entity type

**Response**:
```json
{
  "results": [
    { "type": "player", "id": "uuid", "name": "Jaylen Brown", "team": "Boston Celtics", "sport": "NBA" },
    { "type": "team", "id": "uuid", "name": "Boston Celtics", "abbr": "BOS", "sport": "NBA" }
  ],
  "meta": { "total": 2, "query": "brown", "sport": "NBA", "timestamp": "..." }
}
```

---

## 4. Performance Contract

### 4.A. Latency Requirements

| Endpoint | P50 | P95 | P99 |
|----------|-----|-----|-----|
| /api/search | 50ms | 200ms | 500ms |
| /api/catalog/teams | 30ms | 100ms | 200ms |
| /api/catalog/players | 50ms | 150ms | 300ms |
| /api/catalog/games | 40ms | 120ms | 250ms |
| /api/catalog/props | 60ms | 180ms | 400ms |

### 4.B. Caching Rules

| Resource | Cache TTL | Invalidation |
|----------|-----------|--------------|
| Sports/Leagues | Static | Never |
| Teams | 10 minutes | On team update |
| Players | 10 minutes | On roster update |
| Games (today) | 5 minutes | On game status change |
| Props | 2 minutes | On odds update |
| Search results | 30 seconds | On underlying data change |

### 4.C. Cache Implementation

```typescript
// Redis cache keys
const CACHE_KEYS = {
  teams: (sport: string) => `catalog:teams:${sport}`,
  players: (sport: string, teamId?: string) =>
    `catalog:players:${sport}${teamId ? `:${teamId}` : ''}`,
  games: (sport: string, date: string) => `catalog:games:${sport}:${date}`,
  props: (sport: string, playerId: string) => `catalog:props:${sport}:${playerId}`,
  search: (query: string, sport?: string) => `search:${sport || 'all'}:${query}`,
};

// Cache TTLs in seconds
const CACHE_TTL = {
  teams: 600,      // 10 min
  players: 600,    // 10 min
  games: 300,      // 5 min
  props: 120,      // 2 min
  search: 30,      // 30 sec
};
```

---

## 5. Postgres Search Strategy

### 5.A. pg_trgm Extension

```sql
-- Enable trigram extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Set similarity threshold
SET pg_trgm.similarity_threshold = 0.3;
```

### 5.B. Indexes

```sql
-- Teams: Trigram index for fuzzy name search
CREATE INDEX CONCURRENTLY idx_teams_name_trgm
ON teams USING gin (name gin_trgm_ops);

CREATE INDEX CONCURRENTLY idx_teams_sport_id
ON teams (sport, id);

-- Players: Trigram index for fuzzy name search
CREATE INDEX CONCURRENTLY idx_players_name_trgm
ON players USING gin (name gin_trgm_ops);

CREATE INDEX CONCURRENTLY idx_players_sport_team
ON players (sport, team_id);

-- Games: Composite indexes for filtering
CREATE INDEX CONCURRENTLY idx_games_sport_date
ON games (sport, game_date);

CREATE INDEX CONCURRENTLY idx_games_sport_start_time
ON games (sport, start_time);

-- Props: Indexes for player/stat filtering
CREATE INDEX CONCURRENTLY idx_raw_props_sport_player_stat
ON raw_props (sport, player_name, stat_type);

CREATE INDEX CONCURRENTLY idx_raw_props_sport_team_stat
ON raw_props (sport, team, stat_type);
```

### 5.C. Materialized Views

```sql
-- mv_search_teams: Optimized team search view
CREATE MATERIALIZED VIEW mv_search_teams AS
SELECT
  t.id,
  t.name,
  t.abbr,
  t.sport,
  t.team_uuid,
  t.logo_url,
  COALESCE(t.meta->>'aliases', '[]')::jsonb AS aliases,
  t.name || ' ' || COALESCE(t.abbr, '') || ' ' ||
    COALESCE(t.meta->>'aliases', '') AS search_text
FROM teams t
WHERE NOT COALESCE((t.meta->>'deprecated')::boolean, false);

CREATE INDEX idx_mv_search_teams_sport ON mv_search_teams (sport);
CREATE INDEX idx_mv_search_teams_search_trgm
ON mv_search_teams USING gin (search_text gin_trgm_ops);

-- mv_search_players: Optimized player search view
CREATE MATERIALIZED VIEW mv_search_players AS
SELECT
  p.id,
  p.name,
  p.sport,
  p.team_id,
  t.name AS team_name,
  p.position,
  p.headshot_url,
  COALESCE(p.meta->>'aliases', '[]')::jsonb AS aliases,
  p.name || ' ' || COALESCE(t.name, '') || ' ' ||
    COALESCE(p.meta->>'aliases', '') AS search_text
FROM players p
LEFT JOIN teams t ON p.team_id = t.id;

CREATE INDEX idx_mv_search_players_sport ON mv_search_players (sport);
CREATE INDEX idx_mv_search_players_team ON mv_search_players (team_id);
CREATE INDEX idx_mv_search_players_search_trgm
ON mv_search_players USING gin (search_text gin_trgm_ops);

-- mv_search_games: Optimized game view for Smart Form
CREATE MATERIALIZED VIEW mv_search_games AS
SELECT
  g.id,
  g.sport,
  g.game_date,
  g.start_time,
  g.status,
  g.home_team,
  g.away_team,
  g.external_game_id,
  g.meta,
  g.home_team || ' vs ' || g.away_team AS display_label
FROM games g
WHERE g.game_date >= CURRENT_DATE - INTERVAL '1 day'
  AND g.game_date <= CURRENT_DATE + INTERVAL '7 days';

CREATE INDEX idx_mv_search_games_sport_date
ON mv_search_games (sport, game_date);
CREATE INDEX idx_mv_search_games_start_time
ON mv_search_games (start_time);
```

### 5.D. MV Refresh Schedule

| View | Refresh Interval | Trigger |
|------|------------------|---------|
| mv_search_teams | 1 hour | Manual or on team insert/update |
| mv_search_players | 1 hour | Manual or on player insert/update |
| mv_search_games | 15 minutes | Manual or on game insert/update |

---

## 6. Prohibitions

### 6.A. NO Hardcoded Mock Data

**PROHIBITED in Smart Form**:
```typescript
// FORBIDDEN - DO NOT USE
const MOCK_TEAMS = ['Celtics', 'Lakers', ...];
const MOCK_PLAYERS = [...];
const FALLBACK_GAMES = [...];
```

**REQUIRED**:
```typescript
// CORRECT - Always use API
const teams = await fetch('/api/catalog/teams?sport=NBA');
const players = await fetch('/api/catalog/players?sport=NBA');
```

### 6.B. NO Direct Table Queries from UI

**PROHIBITED**:
```typescript
// FORBIDDEN in Smart Form components
const { data } = await supabase.from('teams').select('*');
```

**REQUIRED**:
```typescript
// CORRECT - Go through API routes
const response = await fetch('/api/catalog/teams?sport=NBA');
```

### 6.C. NO Search Bypass

All search operations MUST go through `/api/search` or `/api/catalog/*` routes.
Direct Supabase queries from frontend components are PROHIBITED.

---

## 7. Version Truth

### 7.A. Build SHA Requirement

The runtime SHA MUST equal git HEAD SHA for API and Smart Form services.

**Version Endpoint Contract**:
```json
{
  "service": "smart-form",
  "branch": "main",
  "commit": "abc123",
  "commitFull": "abc123def456...",
  "buildTime": "2026-02-18T10:00:00Z",
  "environment": "production"
}
```

### 7.B. Verification

```bash
# Git HEAD
git rev-parse HEAD

# Smart Form version
curl http://localhost:3021/api/version

# MUST MATCH - commit field must equal git HEAD
```

**"unknown" commits are PROHIBITED** in production or staging environments.

---

## 8. Cascading Filter Logic

### 8.A. Smart Form Flow

```
1. Sport Selected
   └─> Fetch games: GET /api/catalog/games?sport={sport}&date={today}
   └─> Fetch teams: GET /api/catalog/teams?sport={sport}
   └─> Reset downstream: team, player, prop_type

2. Game Selected (optional)
   └─> Auto-filter teams to home_team/away_team
   └─> Fetch players: GET /api/catalog/players?sport={sport}&team_id={home|away}

3. Team Selected
   └─> Fetch players: GET /api/catalog/players?sport={sport}&team_id={team_id}
   └─> For player props: Lock team to player's team

4. Player Selected (for player props)
   └─> Auto-lock team to player's team
   └─> Fetch props: GET /api/catalog/props?sport={sport}&player_id={player_id}
   └─> Populate stat_type dropdown

5. Stat Type Selected
   └─> Show line/odds from available props
```

### 8.B. Manual Mode

When Manual Mode is enabled:
- Free-text team input → Normalize via `/api/search?type=team&q={input}`
- Free-text player input → Normalize via `/api/search?type=player&q={input}`
- System enforces team↔player consistency
- Fields `manual_home_team`/`manual_away_team` populated for non-game picks

---

## 9. Acceptance Criteria

### 9.A. Search Performance
- [ ] /api/search returns results in <200ms P95
- [ ] Typo tolerance: "celitcs" matches "Celtics"
- [ ] Partial match: "Jayl" matches "Jaylen Brown"

### 9.B. Cascading Filters
- [ ] Sport change resets all downstream fields
- [ ] Game selection filters team options
- [ ] Player selection auto-locks team
- [ ] Props filtered by sport + player

### 9.C. No Mock Data
- [ ] Zero hardcoded team arrays in Smart Form
- [ ] Zero hardcoded player arrays in Smart Form
- [ ] Zero mock fallbacks in API routes
- [ ] All "getMockTeams" functions removed

### 9.D. Version Truth
- [ ] Smart Form /api/version commit == git HEAD
- [ ] API /api/health includes version info
- [ ] No "unknown" commits in built containers

### 9.E. Cache Working
- [ ] Redis caching reduces DB queries by 80%+
- [ ] Cache invalidation on data updates
- [ ] Cache hit rate >90% for repeated queries

---

## 10. Implementation Checklist

### Phase 2: Postgres Foundations
- [ ] Enable pg_trgm extension
- [ ] Create trigram indexes on teams.name, players.name
- [ ] Create composite indexes for filter queries
- [ ] Create mv_search_teams, mv_search_players, mv_search_games
- [ ] Create MV refresh scripts

### Phase 3: API Routes
- [ ] Implement /api/catalog/leagues
- [ ] Implement /api/catalog/teams with pg_trgm search
- [ ] Implement /api/catalog/players with pg_trgm search
- [ ] Implement /api/catalog/games
- [ ] Implement /api/catalog/props
- [ ] Implement /api/search unified endpoint
- [ ] Add Redis caching to all endpoints

### Phase 4: Smart Form Wiring
- [ ] Wire sport dropdown to /api/catalog/leagues
- [ ] Wire team dropdown/search to /api/catalog/teams
- [ ] Wire player search to /api/catalog/players
- [ ] Wire game selection to /api/catalog/games
- [ ] Implement cascading reset logic
- [ ] Implement manual mode with normalization
- [ ] Remove ALL mock data arrays

### Phase 5: Verification
- [ ] All latency requirements met
- [ ] All acceptance criteria passed
- [ ] Version truth aligned
- [ ] Screenshots captured

---

**Contract Owner**: Engineering Team
**Enforcement**: CI/CD pipeline + code review
**Compliance Required**: All Smart Form changes
