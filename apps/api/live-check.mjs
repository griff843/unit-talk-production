import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

console.log('🔍 LIVE SYSTEM DATA CHECK');
console.log('Date:', new Date().toISOString().split('T')[0]);
console.log('=' + '='.repeat(79));

const { data: picks, count: picksCount } = await supabase
  .from('unified_picks')
  .select('id, sport, player_name, prop_type, line, created_at', { count: 'exact' })
  .order('created_at', { ascending: false })
  .limit(5);

console.log(`\n📊 UNIFIED PICKS: ${picksCount || 0} total`);
if (picks && picks.length > 0) {
  console.log('Recent picks:');
  picks.forEach(p => {
    console.log(`  • ${p.sport} - ${p.player_name} - ${p.prop_type} ${p.line}`);
  });
}

const { data: games, count: gamesCount } = await supabase
  .from('games')
  .select('id, sport, home_team, away_team, game_date, status', { count: 'exact' })
  .order('game_date', { ascending: false })
  .limit(5);

console.log(`\n🏀 GAMES: ${gamesCount || 0} total`);
if (games && games.length > 0) {
  console.log('Recent games:');
  games.forEach(g => {
    console.log(`  • ${g.sport}: ${g.away_team} @ ${g.home_team} - ${g.status || 'scheduled'}`);
  });
}

const { data: allPicks } = await supabase
  .from('unified_picks')
  .select('sport');

const sportsCounts = {};
allPicks?.forEach(p => {
  sportsCounts[p.sport] = (sportsCounts[p.sport] || 0) + 1;
});

console.log(`\n📈 PICKS BY SPORT:`);
Object.entries(sportsCounts).forEach(([sport, count]) => {
  console.log(`  ${sport}: ${count}`);
});

const { data: health } = await supabase
  .from('agent_health')
  .select('agent_name, status, last_run, error_count')
  .order('last_run', { ascending: false })
  .limit(10);

console.log(`\n💚 AGENT HEALTH:`);
if (health && health.length > 0) {
  health.forEach(h => {
    const lastRun = h.last_run ? new Date(h.last_run).toLocaleString() : 'Never';
    console.log(`  ${h.agent_name}: ${h.status} (errors: ${h.error_count})`);
  });
} else {
  console.log('  ⚠️  No agent health records found');
}

console.log('\n' + '='.repeat(80));
console.log('📊 SUMMARY:');
console.log(`   Total Picks: ${picksCount || 0}`);
console.log(`   Total Games: ${gamesCount || 0}`);
console.log(`   Sports Active: ${Object.keys(sportsCounts).length}`);
console.log(`   Agent Records: ${health?.length || 0}`);
const status = (picksCount || 0) > 0 ? '✅ OPERATIONAL' : '⚠️  NO DATA INGESTED';
console.log(`   Status: ${status}`);
console.log('=' + '='.repeat(79));
