// Test direct insertion of a manual pick for griff843

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function insertTestPick() {
  console.log('🚀 Testing Direct Pick Insertion for griff843');
  console.log('================================================\n');

  const pick = {
    user_id: 11, // griff843's ID
    capper_name: 'griff843',
    sport: 'NFL',
    event_name: 'Ravens vs Steelers',
    pick_type: 'spread',
    pick: 'Ravens -3.5',
    odds: '-110',
    units: 2,
    reasoning: 'Manual test pick - Ravens dominant at home',
    status: 'pending',
    source: 'manual',
    confidence: 80,
    tier: 'S',
    metadata: JSON.stringify({
      test: true,
      submitted_by: 'e2e_test',
      timestamp: new Date().toISOString()
    })
  };

  // Insert the pick
  const insertQuery = `
    INSERT INTO unified_picks (
      user_id, capper_name, sport, event_name, pick_type,
      pick, odds, units, reasoning, status, source,
      confidence, tier, metadata
    ) VALUES (
      ${pick.user_id},
      '${pick.capper_name}',
      '${pick.sport}',
      '${pick.event_name}',
      '${pick.pick_type}',
      '${pick.pick}',
      '${pick.odds}',
      ${pick.units},
      '${pick.reasoning}',
      '${pick.status}',
      '${pick.source}',
      ${pick.confidence},
      '${pick.tier}',
      '${pick.metadata}'
    ) RETURNING id, capper_name, sport, status, created_at;
  `.replace(/\n/g, ' ');

  try {
    console.log('1️⃣ Inserting pick into unified_picks...');
    const { stdout: insertResult } = await execPromise(
      `docker-compose exec -T postgres psql -U postgres -d postgres -c "${insertQuery}"`
    );
    console.log('✅ Pick inserted successfully:');
    console.log(insertResult);

    // Verify the pick exists
    console.log('\n2️⃣ Verifying pick in database...');
    const { stdout: verifyResult } = await execPromise(
      `docker-compose exec -T postgres psql -U postgres -d postgres -c "SELECT id, capper_name, sport, event_name, pick, status, created_at FROM unified_picks WHERE capper_name = 'griff843' ORDER BY created_at DESC LIMIT 1;"`
    );
    console.log('✅ Pick verified:');
    console.log(verifyResult);

    // Check pick count
    const { stdout: countResult } = await execPromise(
      `docker-compose exec -T postgres psql -U postgres -d postgres -t -c "SELECT COUNT(*) FROM unified_picks WHERE status = 'pending';"`
    );
    console.log(`📊 Total pending picks: ${countResult.trim()}`);

    // Check command center API
    console.log('\n3️⃣ Checking Command Center...');
    const { stdout: curlResult } = await execPromise(
      'curl -s http://localhost:3004/api/picks'
    );

    try {
      const picks = JSON.parse(curlResult);
      const ourPick = picks.find((p: any) => p.capper_name === 'griff843');
      if (ourPick) {
        console.log('✅ Pick found in Command Center:');
        console.log('  - ID:', ourPick.id);
        console.log('  - Status:', ourPick.status);
      } else {
        console.log('⚠️ Pick not visible in Command Center yet');
      }
    } catch (e) {
      console.log('⚠️ Command Center response:', curlResult.substring(0, 200));
    }

    // Check Discord bot status
    console.log('\n4️⃣ Checking Discord bot logs...');
    const { stdout: discordLogs } = await execPromise(
      'docker-compose logs --tail=20 discord-bot | grep -i "griff843\\|thread\\|channel" || echo "No recent activity"'
    );
    console.log('Discord bot activity:');
    console.log(discordLogs);

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST SUMMARY:');
    console.log('='.repeat(50));
    console.log('✅ Database: Pick inserted and verified');
    console.log('⏳ Command Center: Check http://localhost:3004');
    console.log('⏳ Discord: Check logs above for thread creation');
    console.log('\n🔗 URLs to verify:');
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