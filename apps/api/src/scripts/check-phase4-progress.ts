#!/usr/bin/env tsx
/**
 * Check Phase 4 progress
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkProgress() {
  console.log('📊 PHASE 4 PROGRESS CHECK');
  console.log('='.repeat(60));

  // Market props
  const { count: marketCount } = await supabase
    .from('market_props')
    .select('*', { count: 'exact', head: true });

  // Scored props
  const { count: scoredCount } = await supabase
    .from('scored_props')
    .select('*', { count: 'exact', head: true });

  // Promotion queue
  const { count: queueCount } = await supabase
    .from('promotion_queue')
    .select('*', { count: 'exact', head: true });

  // Sample props
  const { data: sampleProps } = await supabase
    .from('market_props')
    .select('id, player_name, market, line, odds')
    .limit(5);

  console.log('\n📦 DATA INGESTED:');
  console.log(`  ✅ market_props: ${marketCount || 0} rows`);
  console.log(`  📊 scored_props: ${scoredCount || 0} rows`);
  console.log(`  📋 promotion_queue: ${queueCount || 0} rows`);

  const scoringRate = marketCount ? ((scoredCount || 0) / marketCount * 100) : 0;
  console.log(`\n📈 Scoring Coverage: ${scoringRate.toFixed(1)}%`);

  if (sampleProps && sampleProps.length > 0) {
    console.log('\n👥 Sample Props:');
    sampleProps.forEach(p => {
      console.log(`  - ${p.player_name} (${p.market}): ${p.line} @ ${p.odds}`);
    });
  }

  console.log('\n📋 NEXT STEPS:');
  if (scoringRate < 10) {
    console.log(`  ⏳ Need to score ${marketCount || 0} props`);
    console.log('  🎯 Run: npm run score-all-props');
  } else if (scoringRate < 90) {
    console.log(`  ⏳ Need to score ${(marketCount || 0) - (scoredCount || 0)} more props`);
    console.log('  🎯 Run: npm run score-all-props');
  } else {
    console.log('  ✅ Scoring complete!');
    console.log('  🎯 Run: npm run verify-gates');
  }

  console.log('\n' + '='.repeat(60));
}

checkProgress().catch(console.error);
