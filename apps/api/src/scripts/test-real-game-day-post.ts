import { VIPPlusChannelService } from '../services/VIPPlusChannelService';
import { logger } from '../shared/logger';

/**
 * REAL TEST: Post actual content to Game Day Live Channel
 *
 * This will create a REAL post in your Discord Game Day Live channel
 * to show what the new implementation looks like.
 */

async function testRealGameDayPost() {
  const correlationId = `real-game-day-test-${Date.now()}`;
  const testLogger = logger.child({ correlationId });

  try {
    console.log('🎯 POSTING REAL TEST TO GAME DAY LIVE CHANNEL');
    console.log('='.repeat(60));

    // Initialize VIP+ service
    const vipPlusService = new VIPPlusChannelService();

    // Create realistic game data for TODAY
    const todayGameData = {
      id: 'test-nfl-chiefs-bills-championship',
      sport: 'NFL',
      away: 'Kansas City Chiefs',
      home: 'Buffalo Bills',
      teams: 'Chiefs @ Bills',
      quarter: 'Q2',
      time: '12:45',
      awayScore: 14,
      homeScore: 17,
      liveSpread: 'Bills -2.5',
      openingSpread: '-3',
      liveTotal: 'O/U 51.5',
      openingTotal: '53',
      keyEvents: 'Josh Allen 25-yard rushing TD, Mahomes intercepted in red zone',
      liveBet: 'Bills -2.5 - controlling game flow and momentum',
      valuePlay: 'Live Under 51.5 - pace slowing in championship game',
      hedgePlay: 'Original over bettors can hedge under at good number',
      timing: 'Best entry before next Bills drive',
      analysis:
        'Bills defense forcing Mahomes into mistakes. Home crowd factor massive in championship game. Buffalo taking control of tempo and field position battle.',
    };

    // Create realistic capper pick
    const capperPick = {
      id: 'test-pick-kingro-bills',
      player: 'Buffalo Bills',
      statType: '-2.5 spread',
      meta: {
        capper: 'KingRo623',
        confidence: 92,
        stake: 4,
      },
      sport: 'NFL',
      teams: 'Chiefs @ Bills',
      selection: 'Bills -2.5',
      odds: '-110',
      units: 4,
      reasoning:
        'Championship game at home is different for Buffalo. Josh Allen has been elite in playoffs, defense creating turnovers. Mahomes struggles in Buffalo cold weather conditions.',
    };

    const testInsights = {
      systemGrade: 'S-tier',
      systemConfidence: 92,
      expectedValue: 15.8,
      riskFactors: ['Weather conditions', 'Championship game variance'],
      marketIntelligence:
        'Strong sharp money backing Bills -2.5. Line movement from -3 to -2.5 indicates professional action on Buffalo. Historical data shows Bills perform exceptionally well at home in January.',
    };

    console.log('\n📋 TEST DATA PREPARED:');
    console.log(`🏈 Game: ${todayGameData.teams}`);
    console.log(
      `📊 Score: ${todayGameData.away} ${todayGameData.awayScore} - ${todayGameData.home} ${todayGameData.homeScore}`
    );
    console.log(`🎯 Pick: ${capperPick.selection} by ${capperPick.meta.capper}`);
    console.log(`💪 Confidence: ${testInsights.systemConfidence}%`);

    console.log('\n🚀 POSTING TO REAL DISCORD CHANNEL...');
    console.log('-'.repeat(50));

    // Test 1: Post exclusive analysis (this should work with current implementation)
    console.log('1️⃣ Testing Exclusive Analysis Post...');
    try {
      await vipPlusService.postExclusiveAnalysis(capperPick, testInsights, correlationId);
      console.log('   ✅ Exclusive Analysis posted successfully!');
    } catch (error) {
      console.log(
        `   ❌ Exclusive Analysis failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Test 2: Post market movement
    console.log('\n2️⃣ Testing Market Movement Post...');
    const marketData = {
      side: 'Bills -2.5',
      opening: '-3',
      current: '-2.5',
      movement: '+0.5 pts',
      recommendation: 'Bills -2.5',
      alternateTarget: '-1.5',
      projected: '-2',
    };

    try {
      await vipPlusService.postMarketMovement(marketData, correlationId);
      console.log('   ✅ Market Movement posted successfully!');
    } catch (error) {
      console.log(
        `   ❌ Market Movement failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Test 3: Post to Game Threads (this tests the corrected routing)
    console.log('\n3️⃣ Testing Game Thread Routing...');
    const mockThreadId = '1234567890123456789'; // This would be real thread ID

    try {
      // Use the new corrected method that routes TO threads
      await vipPlusService.routeToGameThread(capperPick, mockThreadId, correlationId);
      console.log('   ✅ Game Thread routing logic works!');
    } catch (error) {
      console.log(
        `   ❌ Game Thread routing failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Test 4: Post period update
    console.log('\n4️⃣ Testing Period Update...');
    try {
      const updateData = {
        sport: 'NFL',
        period: 'Q2',
        teams: todayGameData.teams,
        score: `${todayGameData.away} ${todayGameData.awayScore} - ${todayGameData.home} ${todayGameData.homeScore}`,
        yards: 'Chiefs 156 - Bills 189',
        timeOfPossession: 'Chiefs 12:45 - Bills 17:15',
        turnovers: 'Chiefs 1 - Bills 0',
      };

      await vipPlusService.postPerPeriodUpdate(
        todayGameData.id,
        mockThreadId,
        updateData,
        correlationId
      );
      console.log('   ✅ Period Update logic works!');
    } catch (error) {
      console.log(
        `   ❌ Period Update failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    console.log('\n📸 CHECK YOUR DISCORD NOW!');
    console.log('='.repeat(40));
    console.log('🎯 Navigate to Game Day Live channel in Discord');
    console.log('🔍 Look for new posts with:');
    console.log('   ✅ VIP+ EXCLUSIVE ANALYSIS with KingRo623 pick');
    console.log('   ✅ TRADER INSIGHTS with market movement data');
    console.log('   ✅ Check timestamps to confirm these are NEW posts');

    console.log('\n💡 WHAT YOU SHOULD SEE:');
    console.log('-'.repeat(30));
    console.log('📊 Professional embeds with purple VIP+ colors');
    console.log('🎯 Real game data (Chiefs @ Bills)');
    console.log('📈 Actual analysis and confidence scores');
    console.log('⏰ Fresh timestamps from just now');

    testLogger.info('Real Discord post test completed', {
      channelTested: 'game-day-live',
      postsAttempted: 4,
      gameData: todayGameData.teams,
    });
  } catch (error) {
    testLogger.error('Real Discord post test failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// Execute real test
if (require.main === module) {
  testRealGameDayPost()
    .then(() => {
      console.log('\n✅ Real Discord posting test completed!');
      console.log('📱 Check your Discord Game Day Live channel now!');
    })
    .catch(error => {
      console.error('❌ Real test failed:', error);
    });
}

export { testRealGameDayPost };
