-- Create backfill function for Phase 2 E2E
-- Date: 2025-10-20

CREATE OR REPLACE FUNCTION backfill_market_props_today(batch_limit int DEFAULT 10000)
RETURNS TABLE (
  inserted_count bigint,
  skipped_count bigint,
  total_market_props bigint
) AS $$
DECLARE
  v_inserted bigint := 0;
  v_total bigint := 0;
BEGIN
  WITH inserted AS (
    INSERT INTO public.market_props (
      sport, market, selection, line, odds, over_odds, under_odds,
      bookmaker_key, best_book, best_available_line,
      game_date, game_time, player_name, team, opponent,
      external_prop_id, external_game_id, game_id, metadata
    )
    SELECT
      COALESCE((rp.metadata->>'sport')::text, rp.sport, 'NFL'),
      COALESCE((rp.metadata->>'market')::text, (rp.metadata->>'market_type')::text, 'player_prop'),
      COALESCE(rp.selection, (rp.metadata->>'selection')::text),
      rp.line, rp.odds, rp.over_odds, rp.under_odds,
      COALESCE((rp.metadata->>'bookmaker_key')::text, (rp.metadata->>'bookmaker')::text, 'unknown'),
      (rp.metadata->>'best_book')::text,
      (rp.metadata->>'best_available_line')::numeric,
      rp.game_date, rp.game_time,
      COALESCE((rp.metadata->>'player_name')::text, rp.player_name),
      (rp.metadata->>'team')::text,
      (rp.metadata->>'opponent')::text,
      COALESCE(rp.external_prop_id, 'raw_' || rp.id::text),
      rp.external_game_id, rp.game_id, rp.metadata
    FROM public.raw_props rp
    WHERE rp.game_date >= CURRENT_DATE
    LIMIT batch_limit
    ON CONFLICT (bookmaker_key, external_prop_id) DO NOTHING
    RETURNING id
  )
  SELECT COUNT(*) INTO v_inserted FROM inserted;
  
  SELECT COUNT(*) INTO v_total FROM public.market_props WHERE game_date >= CURRENT_DATE;
  
  RETURN QUERY SELECT v_inserted, (batch_limit - v_inserted)::bigint, v_total;
END;
$$ LANGUAGE plpgsql;

