#!/usr/bin/env tsx
/**
 * Get Supabase Cloud schema via direct queries
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getCloudSchema() {
  console.log('🔍 Getting Supabase Cloud Schema\n');

  const results: any = {};

  // Get raw_props columns
  const { data: rawPropsSchema } = await supabase
    .from('raw_props')
    .select('*')
    .limit(1);

  if (rawPropsSchema && rawPropsSchema[0]) {
    results.raw_props_columns = Object.keys(rawPropsSchema[0]);
  }

  // Get unified_picks columns
  const { data: unifiedSchema } = await supabase
    .from('unified_picks')
    .select('*')
    .limit(1);

  if (unifiedSchema && unifiedSchema[0]) {
    results.unified_picks_columns = Object.keys(unifiedSchema[0]);
  }

  // Get scored_props columns
  const { data: scoredSchema } = await supabase
    .from('scored_props')
    .select('*')
    .limit(1);

  if (scoredSchema && scoredSchema[0]) {
    results.scored_props_columns = Object.keys(scoredSchema[0]);
  }

  // Check for views
  results.views_exist = {};

  const { count: propReadModel } = await supabase
    .from('v_prop_read_model' as any)
    .select('*', { count: 'exact', head: true });
  results.views_exist.v_prop_read_model = propReadModel !== null;

  const { count: dailyBoard } = await supabase
    .from('v_daily_board' as any)
    .select('*', { count: 'exact', head: true });
  results.views_exist.v_daily_board = dailyBoard !== null;

  const { count: openPromos } = await supabase
    .from('v_open_promotions' as any)
    .select('*', { count: 'exact', head: true });
  results.views_exist.v_open_promotions = openPromos !== null;

  const outDir = path.join(process.cwd(), 'apps/api/out/ops');
  fs.mkdirSync(outDir, { recursive: true });

  const outFile = path.join(outDir, 'CLOUD_SCHEMA.json');
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));

  console.log(JSON.stringify(results, null, 2));
  console.log(`\n✅ Saved to: ${outFile}`);
}

getCloudSchema().catch(console.error);
