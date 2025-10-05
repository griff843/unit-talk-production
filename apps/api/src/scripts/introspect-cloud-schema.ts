#!/usr/bin/env tsx
/**
 * Introspect Supabase Cloud schema - authoritative source
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function introspectSchema() {
  console.log('🔍 Introspecting Supabase Cloud Schema\n');

  // Get table columns for pipeline tables
  const tables = [
    'raw_props',
    'unified_picks',
    'scored_props',
    'promotion_queue',
    'settled_outcomes',
    'players',
    'player_stats',
    'bet_slips',
    'bet_legs',
    'ml_labels',
    'model_versions'
  ];

  const schema: any = {};

  for (const table of tables) {
    const { data, error } = await supabase.rpc('exec_sql', {
      query: `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `,
      params: [table]
    }).catch(() => ({ data: null, error: null }));

    if (!error && data) {
      schema[table] = data;
    } else {
      // Fallback: query directly
      const { data: cols } = await supabase
        .from('information_schema.columns' as any)
        .select('column_name, data_type, is_nullable, column_default')
        .eq('table_schema', 'public')
        .eq('table_name', table)
        .order('ordinal_position');

      schema[table] = cols || [];
    }
  }

  // Get views
  const { data: views } = await supabase.rpc('exec_sql', {
    query: `
      SELECT table_name
      FROM information_schema.views
      WHERE table_schema = 'public'
        AND table_name IN ('v_prop_read_model', 'v_daily_board', 'v_open_promotions')
      ORDER BY table_name
    `
  }).catch(() => ({ data: [] }));

  schema.views = views || [];

  // Get RPCs
  const { data: rpcs } = await supabase.rpc('exec_sql', {
    query: `
      SELECT proname, pg_get_function_arguments(oid) as args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND proname IN ('submit_pick', 'approve_pick', 'deny_pick')
      ORDER BY proname
    `
  }).catch(() => ({ data: [] }));

  schema.rpcs = rpcs || [];

  console.log(JSON.stringify(schema, null, 2));
}

introspectSchema().catch(console.error);
