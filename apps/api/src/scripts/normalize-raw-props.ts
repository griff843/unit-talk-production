#!/usr/bin/env tsx
/**
 * Normalize raw_props into unified_picks
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function normalizeProps() {
  console.log('🔄 Normalizing raw_props to unified_picks...\n');

  const today = new Date().toISOString().split('T')[0];

  const { data: rawProps, error } = await supabase
    .from('raw_props')
    .select('*')
    .gte('game_date', today)
    .limit(500);

  if (error) {
    console.error('❌ Error fetching raw_props:', error.message);
    return;
  }

  console.log(`Found ${rawProps?.length || 0} raw props for today\n`);

  if (!rawProps || rawProps.length === 0) {
    console.log('No raw props to normalize');
    return;
  }

  let inserted = 0;
  let updated = 0;

  for (const prop of rawProps) {
    // Extract metadata fields
    const metadata = prop.metadata || {};

    const unified = {
      game_date: prop.game_date,
      sport: metadata.sport || 'NFL',
      game_id: prop.game_id,
      external_game_id: prop.external_game_id,
      line: prop.line,
      odds: prop.odds,
      over_odds: prop.over_odds,
      under_odds: prop.under_odds,
      metadata: prop.metadata,
      external_prop_id: prop.external_prop_id,
      updated_at: new Date().toISOString()
    };

    const { error: upsertError } = await supabase
      .from('unified_picks')
      .insert(unified);

    if (upsertError) {
      console.error(`  ❌ Error upserting prop ${prop.id}:`, upsertError.message);
    } else {
      inserted++;
    }
  }

  console.log(`✅ Normalized ${inserted} props into unified_picks\n`);

  // Verify
  const { count } = await supabase
    .from('unified_picks')
    .select('*', { count: 'exact', head: true })
    .gte('game_date', today);

  console.log(`Total unified_picks for today: ${count}`);
}

normalizeProps().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
