# SPRINT PLAN: SMARTFORM-CATALOG-PLUMBING-058

**Sprint Name**: `SPRINT-SMARTFORM-CATALOG-PLUMBING-058` **Objective**: Fix
Smart Form catalog plumbing to enable sportsbook-grade player search and stat
type selection **Estimated Effort**: 1 day (4-6 hours) **Dependencies**:
Supabase access, pnpm workspace

---

## 1. Sprint Scope

### In Scope (This Sprint)

| ID  | Task                                   | File(s)        | Effort |
| --- | -------------------------------------- | -------------- | ------ |
| T1  | Create stat_types reference table      | Migration SQL  | 30 min |
| T2  | Fix players API fallback column        | `route.ts`     | 15 min |
| T3  | Update stat-types API to use new table | `route.ts`     | 30 min |
| T4  | Verify MV refresh is working           | Supabase check | 30 min |
| T5  | Add E2E test for player search         | Playwright     | 45 min |
| T6  | Update contract documentation          | Markdown       | 15 min |

### Out of Scope (Future Sprint)

- Connecting sportsbook data feed to `raw_props`
- Line auto-fill from live odds
- Recent picks / favorites UI
- Props cascade from player selection

---

## 2. Task Details

### T1: Create stat_types Reference Table

**File**: `supabase/migrations/20260219100000_stat_types_reference.sql`

```sql
-- =============================================================================
-- SPRINT-SMARTFORM-CATALOG-PLUMBING-058: Stat Types Reference Table
-- =============================================================================

-- Create stat_types table
CREATE TABLE IF NOT EXISTS stat_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport TEXT NOT NULL,
  code TEXT NOT NULL,
  display_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sport, code)
);

-- Create index for sport lookups
CREATE INDEX idx_stat_types_sport_active ON stat_types (sport, active) WHERE active = true;

-- Grant access
GRANT SELECT ON stat_types TO authenticated, anon, service_role;

-- Seed NBA stat types
INSERT INTO stat_types (sport, code, display_name, category, sort_order) VALUES
('NBA', 'PTS', 'Points', 'scoring', 1),
('NBA', 'REB', 'Rebounds', 'rebounds', 2),
('NBA', 'AST', 'Assists', 'passing', 3),
('NBA', 'PRA', 'Pts+Reb+Ast', 'combo', 4),
('NBA', '3PM', '3-Pointers Made', 'scoring', 5),
('NBA', 'STL', 'Steals', 'defense', 6),
('NBA', 'BLK', 'Blocks', 'defense', 7),
('NBA', 'TO', 'Turnovers', 'other', 8),
('NBA', 'DD', 'Double-Double', 'combo', 9),
('NBA', 'TD', 'Triple-Double', 'combo', 10)
ON CONFLICT (sport, code) DO NOTHING;

-- Seed NFL stat types
INSERT INTO stat_types (sport, code, display_name, category, sort_order) VALUES
('NFL', 'PASS_YDS', 'Passing Yards', 'passing', 1),
('NFL', 'PASS_TD', 'Passing TDs', 'passing', 2),
('NFL', 'PASS_ATT', 'Pass Attempts', 'passing', 3),
('NFL', 'PASS_COMP', 'Completions', 'passing', 4),
('NFL', 'INT', 'Interceptions Thrown', 'passing', 5),
('NFL', 'RUSH_YDS', 'Rushing Yards', 'rushing', 6),
('NFL', 'RUSH_ATT', 'Rush Attempts', 'rushing', 7),
('NFL', 'RUSH_TD', 'Rushing TDs', 'rushing', 8),
('NFL', 'REC', 'Receptions', 'receiving', 9),
('NFL', 'REC_YDS', 'Receiving Yards', 'receiving', 10),
('NFL', 'REC_TD', 'Receiving TDs', 'receiving', 11),
('NFL', 'TARGETS', 'Targets', 'receiving', 12)
ON CONFLICT (sport, code) DO NOTHING;

-- Seed MLB stat types
INSERT INTO stat_types (sport, code, display_name, category, sort_order) VALUES
('MLB', 'H', 'Hits', 'batting', 1),
('MLB', 'HR', 'Home Runs', 'batting', 2),
('MLB', 'RBI', 'RBIs', 'batting', 3),
('MLB', 'R', 'Runs', 'batting', 4),
('MLB', 'TB', 'Total Bases', 'batting', 5),
('MLB', 'SB', 'Stolen Bases', 'batting', 6),
('MLB', 'K', 'Strikeouts (Pitcher)', 'pitching', 7),
('MLB', 'ER', 'Earned Runs Allowed', 'pitching', 8),
('MLB', 'OUTS', 'Outs Recorded', 'pitching', 9),
('MLB', 'HITS_ALLOWED', 'Hits Allowed', 'pitching', 10)
ON CONFLICT (sport, code) DO NOTHING;

-- Seed NHL stat types
INSERT INTO stat_types (sport, code, display_name, category, sort_order) VALUES
('NHL', 'G', 'Goals', 'scoring', 1),
('NHL', 'A', 'Assists', 'scoring', 2),
('NHL', 'PTS', 'Points (G+A)', 'scoring', 3),
('NHL', 'SOG', 'Shots on Goal', 'shooting', 4),
('NHL', 'SAVES', 'Saves (Goalie)', 'goaltending', 5),
('NHL', 'GAA', 'Goals Against', 'goaltending', 6)
ON CONFLICT (sport, code) DO NOTHING;

-- Verification
DO $$
DECLARE
  nba_count integer;
  nfl_count integer;
  mlb_count integer;
BEGIN
  SELECT COUNT(*) INTO nba_count FROM stat_types WHERE sport = 'NBA';
  SELECT COUNT(*) INTO nfl_count FROM stat_types WHERE sport = 'NFL';
  SELECT COUNT(*) INTO mlb_count FROM stat_types WHERE sport = 'MLB';

  IF nba_count < 5 THEN
    RAISE EXCEPTION 'Expected 5+ NBA stat types, found %', nba_count;
  END IF;

  RAISE NOTICE 'SPRINT-SMARTFORM-CATALOG-PLUMBING-058: stat_types seeded';
  RAISE NOTICE '  NBA: % types', nba_count;
  RAISE NOTICE '  NFL: % types', nfl_count;
  RAISE NOTICE '  MLB: % types', mlb_count;
END $$;

-- Reload PostgREST schema
NOTIFY pgrst, 'reload schema';
```

---

### T2: Fix Players API Fallback Column

**File**: `apps/smart-form/app/api/catalog/players/route.ts`

**Current Code** (Line 123-127):

```typescript
let fallbackQuery = sb
  .from('players')
  .select('id, name, sport, team_id, position, jersey_number, headshot_url')
  .eq('sport', sport.toUpperCase())
  .ilike('name', `%${q}%`);
```

**Fixed Code**:

```typescript
let fallbackQuery = sb
  .from('players')
  .select(
    'id, full_name, sport, team_id, position, jersey_number, headshot_url'
  )
  .eq('sport', sport.toUpperCase())
  .ilike('full_name', `%${q}%`);
```

**Also update mapping** (Line 146-156):

```typescript
players = (fallbackData || []).map((p: any) => ({
  id: p.id,
  name: p.full_name, // Map full_name → name for API response
  sport: p.sport,
  team_id: p.team_id,
  team_name: null,
  team_abbr: null,
  position: p.position,
  jersey_number: p.jersey_number,
  headshot_url: p.headshot_url,
}));
```

---

### T3: Update stat-types API to Use New Table

**File**: `apps/smart-form/app/api/registry/stat-types/route.ts`

**Replace Lines 46-75 with**:

```typescript
const sb = supabaseServer();

// Query from stat_types reference table (not raw_props)
const { data, error } = await sb
  .from('stat_types')
  .select('code, display_name, category, sort_order')
  .eq('sport', sport.toUpperCase())
  .eq('active', true)
  .order('sort_order');

logDatabaseOperation(log, 'SELECT', 'stat_types', data, error);

if (error) {
  const body = metadataError(
    'STAT_TYPES_UNAVAILABLE',
    `Stat types query failed: ${error.message}`
  );
  log.error({ ...body, pg_code: error.code }, body.message);
  return NextResponse.json(body, { status: 503 });
}

// Transform to API response shape
const statTypes = (data || []).map((st: any) => ({
  code: st.code,
  display_name: st.display_name,
  category: st.category,
}));

log.info(
  {
    stat_types_count: statTypes.length,
    sport,
    duration_ms: Date.now() - startTime,
  },
  `Found ${statTypes.length} stat types for ${sport}`
);

return NextResponse.json(
  {
    stat_types: statTypes,
    meta: {
      total: statTypes.length,
      sport: sport.toUpperCase(),
      source: 'database',
      contract_version: '1.0.0',
      timestamp: new Date().toISOString(),
    },
  },
  {
    status: 200,
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
    },
  }
);
```

---

### T4: Verify MV Refresh

**SQL to run in Supabase**:

```sql
-- Check if MVs exist and are populated
SELECT
  schemaname,
  matviewname,
  ispopulated,
  (SELECT COUNT(*) FROM pg_class WHERE relname = matviewname) as exists_check
FROM pg_matviews
WHERE matviewname LIKE 'mv_%'
ORDER BY matviewname;

-- Check row counts
SELECT 'mv_search_players' as mv, COUNT(*) as rows FROM mv_search_players
UNION ALL SELECT 'mv_search_teams', COUNT(*) FROM mv_search_teams
UNION ALL SELECT 'mv_search_games', COUNT(*) FROM mv_search_games
UNION ALL SELECT 'mv_props_for_form', COUNT(*) FROM mv_props_for_form;

-- Manual refresh if needed
SELECT refresh_search_mvs();

-- Or individual refresh
SELECT refresh_search_mv('mv_search_players');
```

**Expected Output**:

- `mv_search_players`: 500+ rows (if players seeded)
- `mv_search_teams`: 30+ rows (NBA teams)
- `mv_search_games`: 0-50 rows (depends on schedule)
- `mv_props_for_form`: 0 rows (no feed connected yet)

---

### T5: Add E2E Test for Player Search

**File**: `apps/smart-form/tests/e2e/player-search.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Smart Form Player Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/submit-ticket');
    // Wait for form to load
    await page.waitForSelector('[data-testid="sport-select"]');
  });

  test('should search for player and return results', async ({ page }) => {
    // Select NBA
    await page.getByRole('combobox', { name: /sport/i }).click();
    await page.getByRole('option', { name: 'NBA' }).click();

    // Select Player Prop bet type
    await page.getByRole('combobox', { name: /bet type/i }).click();
    await page.getByRole('option', { name: /player prop/i }).click();

    // Search for player
    const searchInput = page.getByPlaceholder(/search player/i);
    await searchInput.fill('brown');

    // Wait for search results
    await page.waitForResponse(
      response =>
        response.url().includes('/api/catalog/players') &&
        response.status() === 200
    );

    // Verify results appear
    const results = page.locator('[data-testid="player-search-results"]');
    await expect(results).toBeVisible();

    // Should find Jaylen Brown (if data exists)
    const jaylenOption = page.getByText(/jaylen brown/i);
    // Note: This will fail if players table is empty - that's expected without seed data
  });

  test('should return stat types for NBA', async ({ page }) => {
    // Select NBA
    await page.getByRole('combobox', { name: /sport/i }).click();
    await page.getByRole('option', { name: 'NBA' }).click();

    // Select Player Prop
    await page.getByRole('combobox', { name: /bet type/i }).click();
    await page.getByRole('option', { name: /player prop/i }).click();

    // Wait for stat types to load
    await page.waitForResponse(
      response =>
        response.url().includes('/api/registry/stat-types') &&
        response.status() === 200
    );

    // Open stat type dropdown
    await page.getByRole('combobox', { name: /stat type/i }).click();

    // Verify PTS option exists
    const ptsOption = page.getByRole('option', { name: /points/i });
    await expect(ptsOption).toBeVisible();

    // Verify AST option exists
    const astOption = page.getByRole('option', { name: /assists/i });
    await expect(astOption).toBeVisible();
  });

  test('API returns 200 for player search', async ({ request }) => {
    const response = await request.get('/api/catalog/players', {
      params: {
        sport: 'NBA',
        q: 'brown',
      },
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('players');
    expect(data).toHaveProperty('meta');
    expect(data.meta.sport).toBe('NBA');
  });

  test('API returns stat types from reference table', async ({ request }) => {
    const response = await request.get('/api/registry/stat-types', {
      params: {
        sport: 'NBA',
      },
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.stat_types.length).toBeGreaterThan(5);

    // Verify expected stat types
    const codes = data.stat_types.map((st: any) => st.code);
    expect(codes).toContain('PTS');
    expect(codes).toContain('AST');
    expect(codes).toContain('REB');
  });
});
```

---

### T6: Update Contract Documentation

**File**: `docs/contracts/SEARCH_CATALOG_CONTRACT_V1.md`

**Update Section 2.C (Players table)**:

```markdown
### 2.C. Players

**Table**: `players`

| Column        | Type        | Description                                      |
| ------------- | ----------- | ------------------------------------------------ |
| id            | uuid        | Primary key                                      |
| **full_name** | text        | Full player name (NOTE: `full_name`, not `name`) |
| team_id       | uuid        | FK to teams.id                                   |
| sport         | text        | Sport code                                       |
| position      | text        | Player position                                  |
| jersey_number | text        | Jersey number                                    |
| meta          | jsonb       | Additional metadata                              |
| headshot_url  | text        | Player headshot URL                              |
| created_at    | timestamptz | Creation timestamp                               |
| updated_at    | timestamptz | Update timestamp                                 |

**IMPORTANT**: The table uses `full_name` but the MV `mv_search_players` aliases
it as `name` for API responses.
```

**Add new Section 2.F (Stat Types)**:

```markdown
### 2.F. Stat Types

**Table**: `stat_types` (NEW in SPRINT-058)

| Column       | Type    | Description                          |
| ------------ | ------- | ------------------------------------ |
| id           | uuid    | Primary key                          |
| sport        | text    | Sport code (NBA, NFL, MLB)           |
| code         | text    | Short code (PTS, AST, REB)           |
| display_name | text    | Human readable (Points, Assists)     |
| category     | text    | Grouping (scoring, passing, defense) |
| sort_order   | integer | Display order                        |
| active       | boolean | Is this stat type active             |

**Canonical Stat Codes by Sport**:

| Sport | Codes                                                      |
| ----- | ---------------------------------------------------------- |
| NBA   | PTS, REB, AST, PRA, 3PM, STL, BLK, TO, DD, TD              |
| NFL   | PASS_YDS, PASS_TD, RUSH_YDS, RUSH_TD, REC, REC_YDS, REC_TD |
| MLB   | H, HR, RBI, TB, K, ER                                      |
```

---

## 3. Execution Order

```
Phase 1: Database
  └─ T1: Apply stat_types migration
  └─ T4: Verify MV refresh

Phase 2: API Fixes
  └─ T2: Fix players API fallback
  └─ T3: Update stat-types API

Phase 3: Verification
  └─ T5: Run E2E tests
  └─ npm run type-check
  └─ npm run build --workspace=apps/smart-form

Phase 4: Documentation
  └─ T6: Update contract docs
  └─ Generate proof artifacts
```

---

## 4. Verification Commands

```bash
# Type check
npm run type-check

# Build Smart Form
npm run build --workspace=apps/smart-form

# Run E2E tests
cd apps/smart-form && npx playwright test player-search.spec.ts

# API smoke test
curl "http://localhost:3021/api/registry/stat-types?sport=NBA" | jq '.stat_types | length'
# Expected: 10 (NBA stat types)

curl "http://localhost:3021/api/catalog/players?sport=NBA&q=brown" | jq '.meta'
# Expected: status 200, source: database
```

---

## 5. Rollback Plan

### If migration fails:

```sql
-- Rollback stat_types table
DROP TABLE IF EXISTS stat_types;
```

### If API breaks:

```bash
# Revert to previous commit
git checkout HEAD~1 -- apps/smart-form/app/api/catalog/players/route.ts
git checkout HEAD~1 -- apps/smart-form/app/api/registry/stat-types/route.ts
```

---

## 6. Definition of Done

- [ ] Migration `20260219100000_stat_types_reference.sql` applied
- [ ] `stat_types` table has 10+ NBA types, 12+ NFL types, 10+ MLB types
- [ ] `/api/catalog/players?sport=NBA&q=test` returns 200 (not 404)
- [ ] `/api/registry/stat-types?sport=NBA` returns PTS, AST, REB, etc.
- [ ] `npm run type-check` passes
- [ ] `npm run build --workspace=apps/smart-form` passes
- [ ] E2E tests pass
- [ ] Contract docs updated
- [ ] Proof artifacts generated

---

## 7. Proof Artifacts Required

```
out/sprints/SPRINT-SMARTFORM-CATALOG-PLUMBING-058/2026-02-19/
├── proofs/
│   ├── proof_migration_applied.txt
│   ├── proof_stat_types_count.txt
│   ├── proof_api_players_200.txt
│   ├── proof_api_stat_types.txt
│   ├── proof_typecheck.txt
│   └── proof_build.txt
├── diffs/
│   ├── players_route_fix.diff
│   └── stat_types_route_update.diff
└── SPRINT_CLOSEOUT_REPORT.md
```

---

## 8. Risk Assessment

| Risk                     | Impact | Mitigation                             |
| ------------------------ | ------ | -------------------------------------- |
| Migration fails          | High   | Test in dev first, have rollback ready |
| API breaks existing flow | Medium | E2E test before deploy                 |
| MV refresh not running   | Medium | Add manual refresh to cron             |
| Players table empty      | Low    | Sprint works, just no search results   |

---

**Sprint Ready**: ✅ YES **Blocking Issues**: None **Estimated Completion**: 4-6
hours
