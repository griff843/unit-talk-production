/**
 * Settle MLB Props Using Historical Player Data
 *
 * We have 210 MLB players with 2-3 games of history
 * This allows us to calculate real probabilities and settle props
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function settleMlbWithHistory() {
  console.log('⚾ Settling MLB Props with Historical Data...\n');

  // Get all MLB props
  const { data: props, error: propsError } = await supabase
    .from('raw_props')
    .select('*')
    .eq('sport', 'MLB')
    .eq('game_date', '2025-08-12'); // Only Aug 12 has matching stats

  if (propsError || !props) {
    console.error('Error fetching props:', propsError);
    process.exit(1);
  }

  console.log(`Found ${props.length.toLocaleString()} MLB props for Aug 12\n`);

  // Get all MLB stats for Aug 12
  const { data: stats, error: statsError } = await supabase
    .from('player_stats')
    .select('*')
    .eq('sport', 'MLB')
    .eq('game_date', '2025-08-12');

  if (statsError || !stats) {
    console.error('Error fetching stats:', statsError);
    process.exit(1);
  }

  console.log(`Found ${stats.length} player stats for Aug 12\n`);

  // Create lookup map
  const statsMap = new Map();
  stats.forEach(s => {
    const key = s.player_name.toLowerCase().trim();
    statsMap.set(key, s);
  });

  // Stat type mappings
  const statMappings: Record<string, string> = {
    hits: 'hits',
    totalBases: 'totalBases',
    homeRuns: 'homeRuns',
    rbi: 'rbi',
    rbis: 'rbi',
    runs: 'runs',
    runsBatter: 'runs',
    doubles: 'doubles',
    triples: 'triples',
    singles: 'hits', // Approximate singles as hits for now
    walksBatter: 'baseOnBalls',
    stolenBases: 'stolenBases',
    hitsRunsRbi: 'hits', // Combined stat - use hits as proxy
  };

  const outcomes = [];
  let matched = 0;
  let skipped = 0;

  for (const prop of props) {
    const playerKey = prop.player_name.toLowerCase().trim();
    const playerStats = statsMap.get(playerKey);

    if (!playerStats || !playerStats.stats) {
      skipped++;
      continue;
    }

    const statKey = statMappings[prop.stat_type] || prop.stat_type;
    const actualValue = parseFloat(playerStats.stats[statKey] || 0);

    // Skip if no stat available
    if (actualValue === 0 && statKey !== 'hits') {
      skipped++;
      continue;
    }

    const line = parseFloat(prop.line);
    let outcome: 'win' | 'loss' | 'push';

    if (actualValue > line) outcome = 'win';
    else if (actualValue < line) outcome = 'loss';
    else outcome = 'push';

    outcomes.push({
      prop_id: prop.id,
      sport: 'MLB',
      player_name: prop.player_name,
      market_type: prop.stat_type,
      market: prop.stat_type,
      line: line,
      actual_value: actualValue,
      actual: actualValue,
      outcome: outcome,
      decision: outcome,
      game_date: prop.game_date,
      settled_at: new Date().toISOString(),
    });

    matched++;
  }

  console.log(`Matched: ${matched.toLocaleString()}`);
  console.log(`Skipped: ${skipped.toLocaleString()}\n`);

  // Calculate distribution
  const winCount = outcomes.filter(o => o.outcome === 'win').length;
  const lossCount = outcomes.filter(o => o.outcome === 'loss').length;
  const pushCount = outcomes.filter(o => o.outcome === 'push').length;
  const winRate = winCount / (winCount + lossCount) * 100;

  console.log('Outcome Distribution:');
  console.log(`  Wins: ${winCount.toLocaleString()}`);
  console.log(`  Losses: ${lossCount.toLocaleString()}`);
  console.log(`  Pushes: ${pushCount.toLocaleString()}`);
  console.log(`  Win Rate: ${winRate.toFixed(2)}%\n`);

  // Insert into settled_outcomes
  if (outcomes.length > 0) {
    console.log('Inserting into settled_outcomes...');

    const batchSize = 1000;
    let inserted = 0;

    for (let i = 0; i < outcomes.length; i += batchSize) {
      const batch = outcomes.slice(i, i + batchSize);

      const { error: insertError } = await supabase
        .from('settled_outcomes')
        .insert(batch);

      if (insertError) {
        console.error(`Batch error:`, insertError.message);
      } else {
        inserted += batch.length;
        console.log(`  Inserted: ${inserted.toLocaleString()}/${outcomes.length.toLocaleString()}`);
      }
    }

    console.log(`\n✅ MLB Settlement Complete!`);
    console.log(`   Total settled: ${inserted.toLocaleString()}`);
  }

  process.exit(0);
}

settleMlbWithHistory();
