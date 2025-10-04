#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkScoring() {
  console.log('\n═══ SCORING STATUS CHECK ═══\n');

  // Get count of total picks
  const { count: totalCount } = await supabase
    .from('unified_picks')
    .select('*', { count: 'exact', head: true })
    .gte('game_date', '2025-10-02T04:00:00Z')
    .lt('game_date', '2025-10-03T04:00:00Z');

  console.log(`Total picks: ${totalCount}`);

  // Get count with professional_score
  const { count: scoredCount } = await supabase
    .from('unified_picks')
    .select('*', { count: 'exact', head: true })
    .gte('game_date', '2025-10-02T04:00:00Z')
    .lt('game_date', '2025-10-03T04:00:00Z')
    .not('professional_score', 'is', null);

  console.log(`Picks with professional_score: ${scoredCount || 0}`);

  // Get count with confidence
  const { count: confidenceCount } = await supabase
    .from('unified_picks')
    .select('*', { count: 'exact', head: true })
    .gte('game_date', '2025-10-02T04:00:00Z')
    .lt('game_date', '2025-10-03T04:00:00Z')
    .gt('confidence', 0);

  console.log(`Picks with confidence: ${confidenceCount || 0}`);

  const unscored = totalCount! - (scoredCount || 0);

  console.log(`\n${unscored === 0 ? '✅' : '❌'} Unscored picks: ${unscored}`);

  if (unscored > 0) {
    console.log(`\n🎯 Action Required: Run ScoringAgent to score ${unscored} picks`);
  } else {
    console.log(`\n✅ All picks have been scored!`);
  }

  console.log('\n════════════════════════════════════════════════════════\n');
}

checkScoring().catch(console.error);
