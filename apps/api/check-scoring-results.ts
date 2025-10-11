import { supabaseClient } from './src/services/supabaseClient';

async function check() {
  if (!supabaseClient) {
    console.log('❌ Supabase client not initialized');
    process.exit(1);
  }

  // Check scored_props created by our script
  const { data: scoredProps, error } = await supabaseClient
    .from('scored_props')
    .select('professional_score, tier, confidence, edge, scoring_version, created_at')
    .eq('scoring_version', '45-factor-enhanced')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  if (!scoredProps || scoredProps.length === 0) {
    console.log('⚠️  No scored props found with scoring_version="45-factor-enhanced"');
    process.exit(0);
  }

  console.log(`\n✅ Found ${scoredProps.length} scored props`);

  const scores = scoredProps.map(p => p.professional_score).filter(s => s != null);

  if (scores.length === 0) {
    console.log('⚠️  No scores found');
    return;
  }

  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - avgScore, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);

  console.log('\n📊 Score Statistics:');
  console.log(`  Average: ${avgScore.toFixed(2)}`);
  console.log(`  Min: ${minScore.toFixed(2)}`);
  console.log(`  Max: ${maxScore.toFixed(2)}`);
  console.log(`  Range: ${(maxScore - minScore).toFixed(2)} points`);
  console.log(`  Std Dev: ${stdDev.toFixed(2)}`);
  console.log(`  Variance: ${variance.toFixed(2)}`);

  console.log('\n🎯 Tier Distribution:');
  const tierCounts: Record<string, number> = {};
  scoredProps.forEach(p => {
    tierCounts[p.tier] = (tierCounts[p.tier] || 0) + 1;
  });
  Object.entries(tierCounts).forEach(([tier, count]) => {
    console.log(`  ${tier}: ${count} (${((count / scoredProps.length) * 100).toFixed(1)}%)`);
  });

  console.log('\n📈 Comparison to Baseline:');
  console.log(`  Baseline Range: 0.5 points (51.15-51.16)`);
  console.log(`  New Range: ${(maxScore - minScore).toFixed(2)} points`);
  console.log(`  Improvement: ${((maxScore - minScore) / 0.5 * 100).toFixed(0)}x better`);

  if (maxScore - minScore > 10) {
    console.log('\n🎉 SUCCESS! Score variance significantly improved!');
  } else if (maxScore - minScore > 2) {
    console.log('\n✅ IMPROVEMENT! Score variance better than baseline');
  } else {
    console.log('\n⚠️  LIMITED IMPROVEMENT - May need more features');
  }

  // Sample some scores
  console.log('\n🔍 Sample Scores:');
  scoredProps.slice(0, 10).forEach(p => {
    console.log(`  ${p.tier} tier | Score: ${p.professional_score.toFixed(2)} | Confidence: ${p.confidence.toFixed(2)} | Edge: ${p.edge?.toFixed(2) || 'N/A'}`);
  });
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
