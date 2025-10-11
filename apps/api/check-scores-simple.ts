import { supabaseClient } from './src/services/supabaseClient';

async function check() {
  const { data, error } = await supabaseClient!
    .from('scored_props')
    .select('professional_score, tier, created_at')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log('\n📊 Total scored props:', data.length);

  if (data.length === 0) {
    console.log('No scored props found');
    return;
  }

  // Get all scores
  const scores = data.map(p => p.professional_score).filter(s => s != null && !isNaN(s));

  if (scores.length === 0) {
    console.log('No valid scores found');
    return;
  }

  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min;

  console.log('\n📈 Score Statistics:');
  console.log(`  Average: ${avg.toFixed(2)}`);
  console.log(`  Min: ${min.toFixed(2)}`);
  console.log(`  Max: ${max.toFixed(2)}`);
  console.log(`  Range: ${range.toFixed(2)} points`);

  console.log('\n🎯 Comparison to Baseline:');
  console.log(`  Baseline: 0.5 points (51.15-51.16)`);
  console.log(`  Current: ${range.toFixed(2)} points`);
  console.log(`  Improvement: ${(range / 0.5).toFixed(1)}x`);

  // Check recent scores (last 100)
  const recentScores = scores.slice(0, 100);
  const recentAvg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
  const recentMin = Math.min(...recentScores);
  const recentMax = Math.max(...recentScores);

  console.log('\n🕐 Last 100 Scores:');
  console.log(`  Average: ${recentAvg.toFixed(2)}`);
  console.log(`  Range: ${(recentMax - recentMin).toFixed(2)} points`);

  // Tier distribution
  const tierCounts: Record<string, number> = {};
  data.forEach(p => {
    if (p.tier) tierCounts[p.tier] = (tierCounts[p.tier] || 0) + 1;
  });

  console.log('\n🎯 Tier Distribution:');
  Object.entries(tierCounts).sort((a, b) => b[1] - a[1]).forEach(([tier, count]) => {
    console.log(`  ${tier}: ${count} (${((count / data.length) * 100).toFixed(1)}%)`);
  });
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
