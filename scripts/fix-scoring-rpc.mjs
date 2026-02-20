#!/usr/bin/env node
/**
 * Fix score_ticket_legs_v3 RPC - ambiguous column reference
 * The RETURNS TABLE has a column named 'leg_id' which conflicts with
 * leg_id columns in the tables being queried. Fix by qualifying references.
 */

import pg from 'pg';
import { config } from 'dotenv';

config();

const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL_POOLER || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  console.log('Connected to database\n');

  const fixSQL = `
CREATE OR REPLACE FUNCTION score_ticket_legs_v3(
  p_leg_ids UUID[],
  p_model_name TEXT,
  p_model_version TEXT,
  p_feature_vectors JSONB[],
  p_scores JSONB[],
  p_computed_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  out_leg_id UUID,
  out_feature_snapshot_id UUID,
  out_scored_leg_id UUID,
  out_status TEXT
) AS $$
DECLARE
  v_idx INTEGER;
  v_leg_id UUID;
  v_features JSONB;
  v_score JSONB;
  v_fs_id UUID;
  v_sl_id UUID;
  v_existing_fs UUID;
  v_existing_sl UUID;
  v_leg_exists BOOLEAN;
BEGIN
  -- Validate inputs
  IF array_length(p_leg_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'p_leg_ids cannot be empty';
  END IF;

  IF array_length(p_leg_ids, 1) != array_length(p_feature_vectors, 1) THEN
    RAISE EXCEPTION 'p_leg_ids and p_feature_vectors must have same length';
  END IF;

  IF array_length(p_leg_ids, 1) != array_length(p_scores, 1) THEN
    RAISE EXCEPTION 'p_leg_ids and p_scores must have same length';
  END IF;

  IF p_model_name IS NULL OR p_model_version IS NULL THEN
    RAISE EXCEPTION 'model_name and model_version are required';
  END IF;

  -- Process each leg
  FOR v_idx IN 1..array_length(p_leg_ids, 1) LOOP
    v_leg_id := p_leg_ids[v_idx];
    v_features := p_feature_vectors[v_idx];
    v_score := p_scores[v_idx];

    -- Verify leg exists (fail-closed)
    SELECT EXISTS(SELECT 1 FROM ticket_legs tl WHERE tl.id = v_leg_id) INTO v_leg_exists;
    IF NOT v_leg_exists THEN
      out_leg_id := v_leg_id;
      out_feature_snapshot_id := NULL;
      out_scored_leg_id := NULL;
      out_status := 'error_leg_not_found';
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Check for existing feature_snapshot (idempotency)
    SELECT fs.id INTO v_existing_fs
    FROM feature_snapshots fs
    WHERE fs.leg_id = v_leg_id
      AND fs.model_name = p_model_name
      AND fs.model_version = p_model_version
      AND fs.computed_at = p_computed_at;

    IF v_existing_fs IS NOT NULL THEN
      -- Check for existing scored_leg
      SELECT sl.id INTO v_existing_sl
      FROM scored_legs sl
      WHERE sl.leg_id = v_leg_id
        AND sl.model_name = p_model_name
        AND sl.model_version = p_model_version
        AND sl.computed_at = p_computed_at;

      IF v_existing_sl IS NOT NULL THEN
        -- Both exist - idempotent return
        out_leg_id := v_leg_id;
        out_feature_snapshot_id := v_existing_fs;
        out_scored_leg_id := v_existing_sl;
        out_status := 'exists';
        RETURN NEXT;
        CONTINUE;
      END IF;

      -- Feature snapshot exists but not scored_leg - use existing snapshot
      v_fs_id := v_existing_fs;
    ELSE
      -- Insert feature_snapshot
      INSERT INTO feature_snapshots (
        leg_id,
        model_name,
        model_version,
        feature_vector,
        computed_at,
        clv_at_bet,
        clv_at_close,
        weather_impact,
        injury_impact,
        rest_impact,
        home_away_impact,
        historical_edge,
        market_efficiency
      ) VALUES (
        v_leg_id,
        p_model_name,
        p_model_version,
        v_features,
        p_computed_at,
        (v_features->>'clv_at_bet')::NUMERIC,
        (v_features->>'clv_at_close')::NUMERIC,
        (v_features->>'weather_impact')::NUMERIC,
        (v_features->>'injury_impact')::NUMERIC,
        (v_features->>'rest_impact')::NUMERIC,
        (v_features->>'home_away_impact')::NUMERIC,
        (v_features->>'historical_edge')::NUMERIC,
        (v_features->>'market_efficiency')::NUMERIC
      )
      RETURNING id INTO v_fs_id;
    END IF;

    -- Insert scored_leg
    INSERT INTO scored_legs (
      leg_id,
      feature_snapshot_id,
      model_name,
      model_version,
      edge_score,
      confidence_score,
      tier,
      promotion_band,
      kelly_fraction,
      expected_value,
      feature_contributions,
      computed_at,
      is_latest
    ) VALUES (
      v_leg_id,
      v_fs_id,
      p_model_name,
      p_model_version,
      (v_score->>'edge_score')::NUMERIC,
      (v_score->>'confidence_score')::NUMERIC,
      v_score->>'tier',
      v_score->>'promotion_band',
      (v_score->>'kelly_fraction')::NUMERIC,
      (v_score->>'expected_value')::NUMERIC,
      v_score->'feature_contributions',
      p_computed_at,
      TRUE
    )
    RETURNING id INTO v_sl_id;

    out_leg_id := v_leg_id;
    out_feature_snapshot_id := v_fs_id;
    out_scored_leg_id := v_sl_id;
    out_status := 'inserted';
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION score_ticket_legs_v3 IS
  'Single-writer batch scoring RPC. Idempotent by (leg, model, version, time). Canonical V3.';
  `;

  console.log('Dropping old function...');
  await client.query(`DROP FUNCTION IF EXISTS score_ticket_legs_v3(UUID[], TEXT, TEXT, JSONB[], JSONB[], TIMESTAMPTZ)`);

  console.log('Applying fix for score_ticket_legs_v3...');
  await client.query(fixSQL);
  console.log('Function updated successfully\n');

  // Verify the function exists
  const check = await client.query(`
    SELECT proname, proargnames
    FROM pg_proc
    WHERE proname = 'score_ticket_legs_v3'
  `);

  if (check.rows.length > 0) {
    console.log('Verified: Function exists');
    console.log('Args:', check.rows[0].proargnames);
  }

  await client.end();
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
