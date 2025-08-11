const { createClient } = require('@supabase/supabase-js');
require('dotenv/config');

const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkAlertAgentMonitoring() {
  console.log('🔍 Phase C: Discord Integration Verification');
  console.log('='.repeat(50));

  console.log('\n1️⃣ Checking final_picks with pending status (AlertAgent targets)...');
  const { data: pendingPicks, error } = await client
    .from('final_picks')
    .select('id, player_name, capper, tier, play_status, posted_to_discord, created_at')
    .eq('play_status', 'pending')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.log('❌ Error checking final_picks:', error);
    return;
  }

  console.log(`Found ${pendingPicks.length} pending final picks for AlertAgent monitoring:`);
  pendingPicks.forEach((pick, i) => {
    console.log(
      `  ${i + 1}. ${pick.player_name} (${pick.capper}) - Tier: ${pick.tier} - Posted: ${pick.posted_to_discord}`
    );
    console.log(`     ID: ${pick.id} - Created: ${pick.created_at}`);
  });

  console.log('\n2️⃣ Checking Discord bot status...');
  // Check if there are any Discord-related records
  const { data: discordPosts, error: discordError } = await client
    .from('final_picks')
    .select('id, player_name, capper, posted_to_discord, discord_post_id')
    .eq('posted_to_discord', true)
    .order('created_at', { ascending: false })
    .limit(5);

  if (!discordError && discordPosts.length > 0) {
    console.log(`✅ Found ${discordPosts.length} picks already posted to Discord:`);
    discordPosts.forEach((pick, i) => {
      console.log(
        `  ${i + 1}. ${pick.player_name} (${pick.capper}) - Post ID: ${pick.discord_post_id}`
      );
    });
  } else {
    console.log('⚠️ No picks have been posted to Discord yet');
  }

  console.log('\n3️⃣ Checking Griff843 capper thread configuration...');
  const capperThreads = process.env.CAPPER_THREADS ? JSON.parse(process.env.CAPPER_THREADS) : {};
  const griff843ThreadId = capperThreads['Griff843'];

  console.log('Griff843 thread ID:', griff843ThreadId || 'NOT CONFIGURED');

  console.log('\n📊 Phase C Discord Integration Status:');
  console.log(`- Pending picks awaiting Discord posting: ${pendingPicks.length}`);
  console.log(`- Picks already posted to Discord: ${discordPosts ? discordPosts.length : 0}`);
  console.log(`- Griff843 thread configured: ${griff843ThreadId ? '✅ Yes' : '❌ No'}`);

  if (pendingPicks.length > 0 && !griff843ThreadId) {
    console.log('\n⚠️ ISSUE IDENTIFIED:');
    console.log('AlertAgent cannot post picks because Griff843 thread ID is not configured');
    console.log('Need to set CAPPER_THREADS environment variable with Griff843 thread mapping');
  } else if (pendingPicks.length > 0 && griff843ThreadId) {
    console.log('\n🎯 NEXT VERIFICATION STEP:');
    console.log('AlertAgent should be monitoring these pending picks and posting to Discord');
    console.log(`Target thread: ${griff843ThreadId}`);
    console.log('Check if AlertAgent service is running and processing pending picks');
  } else {
    console.log('\n✅ No pending picks to verify Discord posting');
  }
}

checkAlertAgentMonitoring();
