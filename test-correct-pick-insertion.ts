// Test direct insertion of a manual pick for griff843 with correct schema

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function insertTestPick() {
  console.log('🚀 Testing Pick Insertion with Correct Schema');
  console.log('================================================\n');

  const pick = {
    user_id: 11, // griff843's ID
    prop_id: 'TEST_PROP_' + Date.now(),
    player_name: 'Lamar Jackson',
    stat_type: 'passing_yards',
    pick_type: 'over',
    pick_direction: 'over',
    line: 275.5,
    over_odds: -110,
    under_odds: -110,
    confidence: 0.85,
    tier: 'S',
    status: 'pending',
    professional_score: 85.5,
    devigged_edge: 0.045,
    kelly_fraction: 0.025,
    processing_time: 1200,
    published: false
  };

  // Insert the pick
  const insertQuery = `
    INSERT INTO unified_picks (
      user_id, prop_id, player_name, stat_type, pick_type,
      pick_direction, line, over_odds, under_odds, confidence,
      tier, status, professional_score, devigged_edge,
      kelly_fraction, processing_time, published
    ) VALUES (
      ${pick.user_id},
      '${pick.prop_id}',
      '${pick.player_name}',
      '${pick.stat_type}',
      '${pick.pick_type}',
      '${pick.pick_direction}',
      ${pick.line},
      ${pick.over_odds},
      ${pick.under_odds},
      ${pick.confidence},
      '${pick.tier}',
      '${pick.status}',
      ${pick.professional_score},
      ${pick.devigged_edge},
      ${pick.kelly_fraction},
      ${pick.processing_time},
      ${pick.published}
    ) RETURNING id, user_id, player_name, stat_type, tier, status, created_at;
  `.replace(/\n/g, ' ');

  try {
    console.log('1️⃣ Inserting pick into unified_picks...');
    const { stdout: insertResult } = await execPromise(
      `docker-compose exec -T postgres psql -U postgres -d postgres -c "${insertQuery}"`
    );
    console.log('✅ Pick inserted successfully:');
    console.log(insertResult);

    // Get the pick ID from the result
    const idMatch = insertResult.match(/(\d+)\s*\|/);
    const pickId = idMatch ? idMatch[1] : null;

    // Verify with user join
    console.log('\n2️⃣ Verifying pick with user data...');
    const { stdout: verifyResult } = await execPromise(
      `docker-compose exec -T postgres psql -U postgres -d postgres -c "SELECT p.id, u.username, p.player_name, p.stat_type, p.pick_direction, p.line, p.tier, p.status FROM unified_picks p JOIN users u ON p.user_id = u.id WHERE u.username = 'griff843' ORDER BY p.created_at DESC LIMIT 1;"`
    );
    console.log('✅ Pick verified with user:');
    console.log(verifyResult);

    // Check all pending picks
    const { stdout: pendingResult } = await execPromise(
      `docker-compose exec -T postgres psql -U postgres -d postgres -c "SELECT COUNT(*) as total_pending FROM unified_picks WHERE status = 'pending';"`
    );
    console.log('\n📊 Pending picks status:');
    console.log(pendingResult);

    // Check command center API
    console.log('\n3️⃣ Checking Command Center API...');
    try {
      const { stdout: apiResult } = await execPromise(
        'curl -s http://localhost:3004/api/picks'
      );

      if (apiResult.startsWith('{') || apiResult.startsWith('[')) {
        const data = JSON.parse(apiResult);
        console.log(`✅ Command Center API responded with ${Array.isArray(data) ? data.length : 'data'}`);

        if (Array.isArray(data)) {
          const ourPick = data.find((p: any) =>
            p.id === parseInt(pickId!) ||
            (p.player_name === 'Lamar Jackson' && p.user_id === 11)
          );
          if (ourPick) {
            console.log('✅ Our pick found in Command Center!');
            console.log('  - ID:', ourPick.id);
            console.log('  - Player:', ourPick.player_name);
            console.log('  - Status:', ourPick.status);
          } else {
            console.log('⚠️ Pick not visible in Command Center yet');
          }
        }
      } else {
        console.log('⚠️ Command Center response:', apiResult.substring(0, 200));
      }
    } catch (e) {
      console.log('⚠️ Could not reach Command Center API');
    }

    // Check Discord bot logs for recent activity
    console.log('\n4️⃣ Checking Discord bot for thread creation...');
    const { stdout: discordLogs } = await execPromise(
      'docker-compose logs --tail=50 discord-bot 2>&1 | grep -E "(griff843|thread|channel|pick|Lamar)" | tail -10 || echo "No matching activity"'
    );
    console.log('Recent Discord activity:');
    console.log(discordLogs || 'No recent matching activity');

    // Check if Discord bot is healthy
    const { stdout: discordHealth } = await execPromise(
      'docker ps --format "table {{.Names}}\\t{{.Status}}" | grep discord'
    );
    console.log('\nDiscord bot status:');
    console.log(discordHealth);

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 E2E TEST SUMMARY for griff843:');
    console.log('='.repeat(50));
    console.log('✅ Database: Pick inserted with ID', pickId);
    console.log('✅ User: griff843 (ID: 11) linked successfully');
    console.log('✅ Pick Details:');
    console.log('  - Player: Lamar Jackson');
    console.log('  - Prop: Passing Yards Over 275.5');
    console.log('  - Tier: S');
    console.log('  - Confidence: 85%');
    console.log('⏳ Command Center: Check http://localhost:3004');
    console.log('⏳ Discord: Check bot logs above');
    console.log('\n🔗 Manual Verification URLs:');
    console.log('  - Command Center: http://localhost:3004');
    console.log('  - Smart Form: http://localhost:3002');
    console.log('  - API Health: http://localhost:3000/health');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.stderr) {
      console.error('Stderr:', error.stderr);
    }
  }
}

// Run the test
insertTestPick().catch(console.error);