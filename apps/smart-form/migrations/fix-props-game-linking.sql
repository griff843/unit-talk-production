-- Migration: Fix Props-Game Linking
-- Purpose: Ensure all raw_props have proper game_id references to games table
-- Date: 2025-08-03

-- Step 1: Add index for performance
CREATE INDEX IF NOT EXISTS idx_raw_props_external_game_id ON raw_props(external_game_id);
CREATE INDEX IF NOT EXISTS idx_games_external_game_id ON games(external_game_id);
CREATE INDEX IF NOT EXISTS idx_raw_props_game_id ON raw_props(game_id);

-- Step 2: Update raw_props to link to games via external_game_id matching
UPDATE raw_props 
SET game_id = games.id
FROM games 
WHERE raw_props.game_id IS NULL 
  AND raw_props.external_game_id IS NOT NULL
  AND games.external_game_id = raw_props.external_game_id;

-- Step 3: Try to link by team matching for remaining unlinked props
UPDATE raw_props 
SET game_id = games.id
FROM games 
WHERE raw_props.game_id IS NULL 
  AND raw_props.team IS NOT NULL
  AND raw_props.sport = games.league
  AND (
    LOWER(games.home_team) LIKE '%' || LOWER(raw_props.team) || '%' OR
    LOWER(games.away_team) LIKE '%' || LOWER(raw_props.team) || '%'
  )
  AND ABS(EXTRACT(EPOCH FROM (games.commence_time::timestamp - raw_props.game_time::timestamp))) < 86400; -- Within 24 hours

-- Step 4: Add foreign key constraint (optional, for data integrity)
-- ALTER TABLE raw_props ADD CONSTRAINT fk_raw_props_game_id 
-- FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE;

-- Step 5: Create function to automatically link new props to games
CREATE OR REPLACE FUNCTION link_prop_to_game()
RETURNS TRIGGER AS $$
BEGIN
  -- If game_id is null, try to find matching game
  IF NEW.game_id IS NULL THEN
    -- First try external_game_id match
    SELECT id INTO NEW.game_id 
    FROM games 
    WHERE external_game_id = NEW.external_game_id
    LIMIT 1;
    
    -- If still null, try team matching
    IF NEW.game_id IS NULL AND NEW.team IS NOT NULL THEN
      SELECT id INTO NEW.game_id 
      FROM games 
      WHERE league = NEW.sport
        AND (
          LOWER(home_team) LIKE '%' || LOWER(NEW.team) || '%' OR
          LOWER(away_team) LIKE '%' || LOWER(NEW.team) || '%'
        )
        AND ABS(EXTRACT(EPOCH FROM (commence_time::timestamp - NEW.game_time::timestamp))) < 86400
      ORDER BY ABS(EXTRACT(EPOCH FROM (commence_time::timestamp - NEW.game_time::timestamp)))
      LIMIT 1;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create trigger to automatically link props on insert/update
DROP TRIGGER IF EXISTS trigger_link_prop_to_game ON raw_props;
CREATE TRIGGER trigger_link_prop_to_game
  BEFORE INSERT OR UPDATE ON raw_props
  FOR EACH ROW
  EXECUTE FUNCTION link_prop_to_game();

-- Step 7: Verify the migration worked
DO $$
DECLARE
  total_props INTEGER;
  linked_props INTEGER;
  unlinked_props INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_props FROM raw_props;
  SELECT COUNT(*) INTO linked_props FROM raw_props WHERE game_id IS NOT NULL;
  SELECT COUNT(*) INTO unlinked_props FROM raw_props WHERE game_id IS NULL;
  
  RAISE NOTICE 'Migration Results:';
  RAISE NOTICE 'Total props: %', total_props;
  RAISE NOTICE 'Linked props: %', linked_props;
  RAISE NOTICE 'Unlinked props: %', unlinked_props;
  RAISE NOTICE 'Link percentage: %', ROUND((linked_props::DECIMAL / total_props * 100), 2);
END $$;
