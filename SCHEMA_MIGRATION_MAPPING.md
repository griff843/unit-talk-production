# Unit Talk v3.0.0 Schema Migration Mapping

## Canonical v3.0.0 Schema (Source of Truth)

### Core Tables
```sql
-- raw_props (ingest staging; authoritative grading pickup by processed_at)
CREATE TABLE raw_props (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processed_at timestamptz,              -- NEW: authoritative pickup gate
  pro_attempts int DEFAULT 0,            -- NEW: retry tracking
  processing_error text,                 -- NEW: error logging
  -- ... existing columns
);

-- unified_picks (canonical graded/published)
CREATE TABLE unified_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Core pick fields
  tier text,
  confidence int,
  professional_score numeric,            -- NEW: replaces score/composite_score
  -- Devigging fields
  devigged_win_prob numeric,            -- NEW
  devigged_edge numeric,                -- NEW: replaces edge_score/ev
  clv_pct numeric,                      -- NEW: replaces clv/clv_basis_points
  -- Sizing fields
  kelly_fraction numeric,               -- NEW: replaces position_size/stake_fraction
  risk numeric,                         -- NEW
  clv_tracking_id text,                -- NEW
  -- Status fields
  grading_status text,                  -- NEW: replaces is_graded/graded
  stage text,                          -- NEW: replaces queue_status/promotion_status
  published boolean DEFAULT false,      -- NEW: replaces auto_approved/promoted_to_picks
  is_instant boolean DEFAULT false,     -- NEW: replaces instant/post_now
  -- Grouping fields
  group_key text,                       -- NEW
  promoted_at timestamptz,             -- NEW: replaces publish timestamps
  -- ... existing columns
);

-- shadow_decisions (shadow mode audit)
CREATE TABLE shadow_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_type text NOT NULL,
  -- ... fields from earlier definition
);

-- View for postable picks
CREATE VIEW view_postable_picks AS
SELECT * FROM unified_picks 
WHERE published = true AND play_status = 'pending' 
ORDER BY promoted_at DESC;
```

## Migration Mapping: Old → New

### Table Names
| Old Reference | New Reference | Action |
|---------------|---------------|---------|
| `final_picks` | `unified_picks` | **REPLACE ALL** |
| `picks_final` | `unified_picks` | **REPLACE ALL** |
| `_final_picks` | `unified_picks` | **REPLACE ALL** |
| `raw_props_old` | `raw_props` | **REPLACE ALL** |
| `ingested_props` | `raw_props` | **REPLACE ALL** |

### Column Names
| Old Column | New Column | Action | Migration Strategy |
|------------|------------|---------|-------------------|
| `auto_approved` | `published` | **REPLACE** | `WHERE auto_approved = true` → `WHERE published = true` |
| `promoted_to_picks` | `promoted_at IS NOT NULL` | **REPLACE** | `WHERE promoted_to_picks = true` → `WHERE promoted_at IS NOT NULL` |
| `is_graded` | `grading_status = 'graded'` | **REPLACE** | `WHERE is_graded = true` → `WHERE grading_status = 'graded'` |
| `graded` | `grading_status` | **REPLACE** | Context-dependent replacement |
| `queue_status` | `stage` | **REPLACE** | Direct column rename |
| `promotion_status` | `stage` | **REPLACE** | Direct column rename |
| `instant` | `is_instant` | **REPLACE** | `instant = true` → `is_instant = true` |
| `post_now` | `is_instant` | **REPLACE** | `post_now = true` → `is_instant = true` |
| `edge_score` | **REMOVE** | **DELETE** | Calculate from `confidence * 0.1` if needed |
| `ev` | `devigged_edge` | **REPLACE** | Expected value → devigged edge |
| `clv_basis_points` | `clv_pct` | **REPLACE** | Convert basis points to percentage |
| `clv` (standalone) | `clv_pct` | **REPLACE** | Ensure consistent percentage format |
| `position_size` | `kelly_fraction` | **REPLACE** | Position sizing → Kelly criterion |
| `stake_fraction` | `kelly_fraction` | **REPLACE** | Direct replacement |
| `processed` (boolean) | `processed_at IS NOT NULL` | **REPLACE** | Boolean → timestamp gate |
| `score` / `composite_score` | `professional_score` | **REPLACE** | Unified professional scoring |

### Query Pattern Updates
| Old Pattern | New Pattern | Context |
|-------------|-------------|---------|
| `WHERE processed = true` | `WHERE processed_at IS NOT NULL` | Raw props pickup |
| `WHERE processed = false` | `WHERE processed_at IS NULL` | Unprocessed props |
| `WHERE auto_approved = true` | `WHERE published = true` | Published picks |
| `WHERE is_graded = true` | `WHERE grading_status = 'graded'` | Graded picks |
| `WHERE tier IS NULL` | `WHERE processed_at IS NULL` | Ungraded props (authoritative) |

## TypeScript Type Updates

### Interface Renames
```typescript
// OLD
interface FinalPick { ... }
type FinalPicksResponse = Database['public']['Tables']['final_picks']['Row'];

// NEW
interface UnifiedPick { ... }
type UnifiedPicksResponse = Database['public']['Tables']['unified_picks']['Row'];
```

### Column Type Updates
```typescript
// OLD
interface LegacyPick {
  auto_approved?: boolean;
  promoted_to_picks?: boolean;
  is_graded?: boolean;
  edge_score?: number;
  position_size?: number;
  processed?: boolean;
}

// NEW
interface UnifiedPick {
  published: boolean;
  promoted_at?: string;
  grading_status?: string;
  devigged_edge?: number;
  kelly_fraction?: number;
  processed_at?: string;
}
```

## Migration Validation Rules

### Safe Transformation Rules
1. **Table Names**: Always replace `final_picks` → `unified_picks`
2. **Boolean Columns**: Replace with timestamp or status fields
3. **Score Columns**: Consolidate into `professional_score`
4. **Status Columns**: Use standardized `stage` and `grading_status`

### Preservation Rules
1. **Historical Data**: Keep archive tables with `_archive` suffix
2. **Changelog Comments**: Preserve historical references in documentation
3. **Migration Safety**: Use `IF NOT EXISTS` for all schema changes

### Validation Queries
```sql
-- Verify no legacy table references remain
SELECT schemaname, tablename 
FROM pg_tables 
WHERE tablename LIKE '%final_picks%' 
   OR tablename LIKE '%raw_props_old%';

-- Verify new columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'unified_picks' 
  AND column_name IN ('published', 'processed_at', 'grading_status');

-- Verify data integrity
SELECT 
  COUNT(*) as total_picks,
  COUNT(CASE WHEN published = true THEN 1 END) as published_picks,
  COUNT(CASE WHEN grading_status = 'graded' THEN 1 END) as graded_picks
FROM unified_picks;
```

## Files Requiring Updates (Priority Order)

### CRITICAL (Blocking Production)
1. `apps/api/src/db/types/final_picks.ts`
2. `apps/api/src/agents/AlertAgent/index.ts`
3. `apps/api/src/agents/SettlementAgent/index.ts`
4. `apps/discord-bot/src/services/database.ts`

### HIGH PRIORITY  
5. Migration files in `migrations/`
6. Agent services with direct DB queries
7. Type definition files

### MEDIUM PRIORITY
8. Test files
9. Documentation
10. Configuration files

This mapping will guide the automated codemod process to ensure safe, consistent updates across the entire codebase.