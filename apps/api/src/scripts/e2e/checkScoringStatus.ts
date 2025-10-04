#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkScoring() {
  console.log('\n═══ SCORING STATUS CHECK ═══\n');

  // Check how many picks have scores
  const { data: picks } = await supabase
    .from('unified_picks')
    .select('id, professional_score, confidence, enhanced45factor_score, metadata')
    .gte('game_date', '2025-10-02T04:00:00Z')
    .lt('game_date', '2025-10-03T04:00:00Z')
    .limit(10000);

  if (!picks) {
    console.log('No picks found');
    return;
  }

  console.log(`Total picks checked: ${picks.length}`);

  // Check for scoring fields
  const withProfessionalScore = picks.filter(p => p.professional_score !== null && p.professional_score !== undefined).length;
  const withConfidence = picks.filter(p => p.confidence !== null && p.confidence !== undefined && p.confidence > 0).length;
  const withEnhanced45 = picks.filter(p => p.enhanced45factor_score !== null && p.enhanced45factor_score !== undefined).length;

  console.log(`\nScoring Status:`);
  console.log(`  Professional Score: ${withProfessionalScore} / ${picks.length} (${((withProfessionalScore / picks.length) * 100).toFixed(1)}%)`);
  console.log(`  Confidence: ${withConfidence} / ${picks.length} (${((withConfidence / picks.length) * 100).toFixed(1)}%)`);
  console.log(`  Enhanced45Factor: ${withEnhanced45} / ${picks.length} (${((withEnhanced45 / picks.length) * 100).toFixed(1)}%)`);

  const unscored = picks.length - Math.max(withProfessionalScore, withConfidence, withEnhanced45);
  console.log(`\n⚠️  Unscored picks: ${unscored}`);

  if (unscored > 0) {
    console.log(`\n❌ Picks need scoring! Run ScoringAgent to score ${unscored} picks.`);
  } else {
    console.log(`\n✅ All picks have been scored!`);
  }

  // Sample a scored pick if any
  const scored = picks.find(p => p.professional_score || p.confidence);
  if (scored) {
    console.log(`\nSample scored pick:`);
    console.log(`  Professional Score: ${scored.professional_score}`);
    console.log(`  Confidence: ${scored.confidence}`);
    console.log(`  Enhanced45Factor: ${scored.enhanced45factor_score}`);
  }

  console.log('\n════════════════════════════════════════════════════════\n');
}

checkScoring().catch(console.error);
