-- Fix unified_picks unique constraint to allow multiple bookmakers
-- This enables proper devigging and line shopping for professional betting

-- Drop existing constraint if it exists
ALTER TABLE unified_picks
DROP CONSTRAINT IF EXISTS unified_picks_external_game_id_market_external_prop_id_key;

ALTER TABLE unified_picks
DROP CONSTRAINT IF EXISTS unified_picks_unique_key;

-- Add new constraint that includes bookmaker_key
-- This allows the same pick from different bookmakers (essential for devigging)
ALTER TABLE unified_picks
ADD CONSTRAINT unified_picks_unique_key
UNIQUE (external_game_id, market, COALESCE(external_prop_id, ''), COALESCE(outcome, ''), COALESCE(line::text, ''), bookmaker_key);

-- Create index for fast lookups during deduplication
CREATE INDEX IF NOT EXISTS idx_unified_picks_dedup
ON unified_picks (external_game_id, market, external_prop_id, bookmaker_key);

-- Explanation:
-- external_game_id: Identifies the specific game
-- market: Type of bet (h2h, spreads, totals, player_props)
-- external_prop_id: For player props (COALESCE handles NULL)
-- outcome: Team or player outcome (COALESCE handles NULL)
-- line: Point spread or total line (COALESCE handles NULL)
-- bookmaker_key: DraftKings, FanDuel, BetMGM, Caesars (CRITICAL for devigging)

-- This allows:
-- ✅ Same pick from multiple bookmakers (required for devigging)
-- ✅ Line shopping to find best odds
-- ✅ Sharp vs public money detection
-- ✅ Market efficiency analysis
-- ✅ CLV tracking across books
