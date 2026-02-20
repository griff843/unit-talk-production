#!/usr/bin/env node
/**
 * Fix the upsert_provider_offers_v3 function to handle insert/update counting correctly
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
  console.log('Connected');

  // Drop and recreate the function with fixed counting logic
  await client.query(`
    CREATE OR REPLACE FUNCTION upsert_provider_offers_v3(
      p_provider_key TEXT,
      p_captured_at TIMESTAMPTZ,
      p_offers JSONB,
      p_min_confidence NUMERIC DEFAULT 0.8
    )
    RETURNS TABLE (
      inserted_count INTEGER,
      updated_count INTEGER,
      quarantined_count INTEGER,
      quarantine_reasons JSONB
    ) AS $$
    DECLARE
      v_provider_id INTEGER;
      v_offer JSONB;
      v_inserted INTEGER := 0;
      v_updated INTEGER := 0;
      v_quarantined INTEGER := 0;
      v_quarantine_reasons JSONB := '[]'::JSONB;
      v_event_mapping RECORD;
      v_market_mapping RECORD;
      v_participant_mapping RECORD;
      v_segment_type_id INTEGER;
      v_quarantine_reason TEXT;
      v_quarantine_detail JSONB;
      v_existing_id UUID;
    BEGIN
      -- Resolve provider
      v_provider_id := resolve_provider_id(p_provider_key);

      IF v_provider_id IS NULL THEN
        -- Quarantine ALL offers - provider not found
        FOR v_offer IN SELECT * FROM jsonb_array_elements(p_offers)
        LOOP
          INSERT INTO offer_quarantine (
            provider_key, provider_id, captured_at,
            reason_code, reason_detail, raw_payload
          ) VALUES (
            p_provider_key, NULL, p_captured_at,
            'UNMAPPED_PROVIDER',
            jsonb_build_object('provider_key', p_provider_key),
            v_offer
          );
          v_quarantined := v_quarantined + 1;
        END LOOP;

        RETURN QUERY SELECT
          0::INTEGER,
          0::INTEGER,
          v_quarantined,
          jsonb_build_array(jsonb_build_object('reason', 'UNMAPPED_PROVIDER', 'count', v_quarantined));
        RETURN;
      END IF;

      -- Process each offer
      FOR v_offer IN SELECT * FROM jsonb_array_elements(p_offers)
      LOOP
        v_quarantine_reason := NULL;
        v_quarantine_detail := '{}'::JSONB;

        -- 1. Resolve event mapping
        SELECT * INTO v_event_mapping
        FROM resolve_event_mapping(
          v_provider_id,
          v_offer->>'provider_event_id',
          p_min_confidence
        );

        IF v_event_mapping.canonical_event_id IS NULL THEN
          v_quarantine_reason := 'UNMAPPED_EVENT';
          v_quarantine_detail := jsonb_build_object(
            'provider_event_id', v_offer->>'provider_event_id'
          );
        END IF;

        -- 2. Resolve market mapping (if event OK)
        IF v_quarantine_reason IS NULL THEN
          SELECT * INTO v_market_mapping
          FROM resolve_market_mapping(
            v_provider_id,
            v_offer->>'provider_market_key',
            p_min_confidence
          );

          IF v_market_mapping.canonical_market_type_id IS NULL THEN
            v_quarantine_reason := 'UNMAPPED_MARKET';
            v_quarantine_detail := jsonb_build_object(
              'provider_market_key', v_offer->>'provider_market_key'
            );
          END IF;
        END IF;

        -- 3. Resolve participant mapping (if applicable and prior checks OK)
        IF v_quarantine_reason IS NULL AND v_offer->>'provider_participant_id' IS NOT NULL THEN
          SELECT * INTO v_participant_mapping
          FROM resolve_participant_mapping(
            v_provider_id,
            v_offer->>'provider_participant_id',
            COALESCE(v_offer->>'participant_type', 'player'),
            p_min_confidence
          );

          IF v_participant_mapping.canonical_participant_id IS NULL THEN
            v_quarantine_reason := 'UNMAPPED_PARTICIPANT';
            v_quarantine_detail := jsonb_build_object(
              'provider_participant_id', v_offer->>'provider_participant_id',
              'participant_type', COALESCE(v_offer->>'participant_type', 'player')
            );
          END IF;
        END IF;

        -- 4. Resolve segment type (optional)
        v_segment_type_id := NULL;
        IF v_quarantine_reason IS NULL AND v_offer->>'segment_type' IS NOT NULL THEN
          SELECT id INTO v_segment_type_id
          FROM segment_types
          WHERE code = v_offer->>'segment_type';
        END IF;

        -- 5. Either quarantine or upsert
        IF v_quarantine_reason IS NOT NULL THEN
          -- QUARANTINE: mapping failed
          INSERT INTO offer_quarantine (
            provider_key, provider_id, captured_at,
            reason_code, reason_detail, raw_payload
          ) VALUES (
            p_provider_key, v_provider_id, p_captured_at,
            v_quarantine_reason, v_quarantine_detail, v_offer
          );
          v_quarantined := v_quarantined + 1;

          -- Track reason for summary
          v_quarantine_reasons := v_quarantine_reasons || jsonb_build_object(
            'reason', v_quarantine_reason,
            'detail', v_quarantine_detail
          );
        ELSE
          -- Check if offer already exists
          SELECT id INTO v_existing_id
          FROM provider_offers
          WHERE event_id = v_event_mapping.canonical_event_id
            AND market_id IS NOT DISTINCT FROM NULL
            AND participant_id IS NOT DISTINCT FROM v_participant_mapping.canonical_participant_id
            AND segment_id IS NULL
            AND provider = p_provider_key
            AND snapshot_at = p_captured_at;

          IF v_existing_id IS NOT NULL THEN
            -- UPDATE existing
            UPDATE provider_offers SET
              market_type_id = v_market_mapping.canonical_market_type_id,
              provider_id = v_provider_id,
              provider_event_id = v_offer->>'provider_event_id',
              provider_market_key = v_offer->>'provider_market_key',
              provider_participant_id = v_offer->>'provider_participant_id',
              line = (v_offer->>'line')::NUMERIC,
              over_odds = (v_offer->>'over_odds')::INTEGER,
              under_odds = (v_offer->>'under_odds')::INTEGER,
              home_odds = (v_offer->>'home_odds')::INTEGER,
              away_odds = (v_offer->>'away_odds')::INTEGER,
              yes_odds = (v_offer->>'yes_odds')::INTEGER,
              no_odds = (v_offer->>'no_odds')::INTEGER,
              devigged_over = (v_offer->>'devigged_over')::NUMERIC,
              devigged_under = (v_offer->>'devigged_under')::NUMERIC,
              juice = (v_offer->>'juice')::NUMERIC,
              is_opening = COALESCE((v_offer->>'is_opening')::BOOLEAN, FALSE),
              is_closing = COALESCE((v_offer->>'is_closing')::BOOLEAN, FALSE),
              mapping_confidence = LEAST(
                COALESCE(v_event_mapping.confidence, 1.0),
                COALESCE(v_market_mapping.confidence, 1.0),
                COALESCE(v_participant_mapping.confidence, 1.0)
              ),
              meta = COALESCE(v_offer->'meta', '{}'::JSONB)
            WHERE id = v_existing_id;
            v_updated := v_updated + 1;
          ELSE
            -- INSERT new
            INSERT INTO provider_offers (
              event_id,
              market_id,
              market_type_id,
              participant_id,
              segment_id,
              segment_type_id,
              provider,
              provider_id,
              provider_event_id,
              provider_market_key,
              provider_participant_id,
              line,
              over_odds,
              under_odds,
              home_odds,
              away_odds,
              yes_odds,
              no_odds,
              devigged_over,
              devigged_under,
              juice,
              snapshot_at,
              is_opening,
              is_closing,
              mapping_confidence,
              meta
            ) VALUES (
              v_event_mapping.canonical_event_id,
              NULL,
              v_market_mapping.canonical_market_type_id,
              v_participant_mapping.canonical_participant_id,
              NULL,
              v_segment_type_id,
              p_provider_key,
              v_provider_id,
              v_offer->>'provider_event_id',
              v_offer->>'provider_market_key',
              v_offer->>'provider_participant_id',
              (v_offer->>'line')::NUMERIC,
              (v_offer->>'over_odds')::INTEGER,
              (v_offer->>'under_odds')::INTEGER,
              (v_offer->>'home_odds')::INTEGER,
              (v_offer->>'away_odds')::INTEGER,
              (v_offer->>'yes_odds')::INTEGER,
              (v_offer->>'no_odds')::INTEGER,
              (v_offer->>'devigged_over')::NUMERIC,
              (v_offer->>'devigged_under')::NUMERIC,
              (v_offer->>'juice')::NUMERIC,
              p_captured_at,
              COALESCE((v_offer->>'is_opening')::BOOLEAN, FALSE),
              COALESCE((v_offer->>'is_closing')::BOOLEAN, FALSE),
              LEAST(
                COALESCE(v_event_mapping.confidence, 1.0),
                COALESCE(v_market_mapping.confidence, 1.0),
                COALESCE(v_participant_mapping.confidence, 1.0)
              ),
              COALESCE(v_offer->'meta', '{}'::JSONB)
            );
            v_inserted := v_inserted + 1;
          END IF;
        END IF;
      END LOOP;

      -- Return summary
      RETURN QUERY SELECT v_inserted, v_updated, v_quarantined, v_quarantine_reasons;
    END;
    $$ LANGUAGE plpgsql;
  `);

  console.log('✅ Fixed upsert_provider_offers_v3 function');

  await client.end();
  console.log('Done');
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
