require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSettlementStatus() {
  console.log('🏀 Checking tonight\'s games settlement status...\n');

  // Check last 2 days for tonight's games
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const { data: recentProps, error } = await supabase
    .from('raw_props')
    .select('game_date, sport, settled, COUNT(*)')
    .gte('game_date', yesterday.toISOString().split('T')[0])
    .lte('game_date', today.toISOString().split('T')[0] + 'T23:59:59Z');

  if (error) {
    console.error('❌ Database error:', error);
    return;
  }

  if (!recentProps || recentProps.length === 0) {
    console.log('❌ No recent games found in database');
    console.log('💡 This could mean:');
    console.log('   • No games scheduled for tonight');
    console.log('   • Props haven\'t been ingested yet');
    console.log('   • Database connection issue');
    return;
  }

  // Simple settlement check
  const { data: settlementSummary, error: summaryError } = await supabase
    .from('raw_props')
    .select('settled')
    .gte('game_date', yesterday.toISOString().split('T')[0])
    .lte('game_date', today.toISOString().split('T')[0] + 'T23:59:59Z');

  if (summaryError) {
    console.error('❌ Summary error:', summaryError);
    return;
  }

  const settled = settlementSummary.filter(p => p.settled).length;
  const total = settlementSummary.length;
  const unsettled = total - settled;
  const settlementRate = total > 0 ? ((settled / total) * 100).toFixed(1) : 0;

  console.log('📊 SETTLEMENT SUMMARY');
  console.log('====================');
  console.log(`Total Props: ${total}`);
  console.log(`Settled: ${settled}`);
  console.log(`Pending: ${unsettled}`);
  console.log(`Settlement Rate: ${settlementRate}%`);

  if (unsettled === 0) {
    console.log('\n✅ ALL GAMES SETTLED - Tonight\'s games are complete!');
  } else {
    console.log(`\n⏳ ${unsettled} props still pending settlement`);
    console.log('💡 Run settlement: npm run sgo:settlement unsettled');
  }

  // Show recent props for context
  const { data: sampleProps, error: sampleError } = await supabase
    .from('raw_props')
    .select('game_date, sport, player_name, market, settled')
    .gte('game_date', yesterday.toISOString().split('T')[0])
    .lte('game_date', today.toISOString().split('T')[0] + 'T23:59:59Z')
    .order('game_date', { ascending: false })
    .limit(5);

  if (sampleProps && sampleProps.length > 0) {
    console.log('\n📋 Recent Props Sample:');
    sampleProps.forEach(prop => {
      const status = prop.settled ? '✅' : '⏳';
      console.log(`${status} ${prop.sport} | ${prop.player_name} | ${prop.market} | ${prop.game_date.split('T')[0]}`);
    });
  }
}

checkSettlementStatus().then(() => process.exit(0)).catch(console.error);