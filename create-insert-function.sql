CREATE OR REPLACE FUNCTION insert_raw_props_batch(props_json JSONB)
RETURNS TABLE (inserted_count INT, error_message TEXT) AS $$
DECLARE
  prop JSONB;
  count INT := 0;
BEGIN
  FOR prop IN SELECT * FROM jsonb_array_elements(props_json)
  LOOP
    INSERT INTO public.raw_props (
      prop_id,
      external_prop_id,
      sport,
      player_name,
      stat_type,
      line,
      over_odds,
      under_odds,
      game_start,
      source,
      is_valid
    ) VALUES (
      (prop->>'prop_id')::TEXT,
      (prop->>'external_prop_id')::TEXT,
      (prop->>'sport')::TEXT,
      (prop->>'player_name')::TEXT,
      (prop->>'stat_type')::TEXT,
      (prop->>'line')::NUMERIC,
      (prop->>'over_odds')::INTEGER,
      (prop->>'under_odds')::INTEGER,
      (prop->>'game_start')::TIMESTAMPTZ,
      (prop->>'source')::TEXT,
      COALESCE((prop->>'is_valid')::BOOLEAN, true)
    )
    ON CONFLICT (prop_id) DO UPDATE SET
      updated_at = NOW();

    count := count + 1;
  END LOOP;

  RETURN QUERY SELECT count, NULL::TEXT;
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT 0, SQLERRM;
END;
$$ LANGUAGE plpgsql;
