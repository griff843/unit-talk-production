const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testSystemImprovements() {
  console.log('🧪 COMPREHENSIVE SYSTEM IMPROVEMENT TESTS');
  console.log('=========================================');
  console.log(`📅 Test Date: ${new Date().toLocaleString()}`);
  console.log('🎯 Validating database schema and functionality improvements\n');

  const results = {
    databaseIntegrity: { passed: 0, total: 0 },
    propsLinking: { passed: 0, total: 0 },
    apiPerformance: { passed: 0, total: 0 },
    timezoneHandling: { passed: 0, total: 0 },
    dataQuality: { passed: 0, total: 0 },
  };

  try {
    // ========================================
    // 1. DATABASE INTEGRITY TESTS
    // ========================================
    console.log('1️⃣ DATABASE INTEGRITY TESTS');
    console.log('============================');

    // Test 1.1: Props-Games Linking
    results.databaseIntegrity.total++;
    const { data: totalProps } = await supabase.from('raw_props').select('id', { count: 'exact' });

    const { data: linkedProps } = await supabase
      .from('raw_props')
      .select('id', { count: 'exact' })
      .not('game_id', 'is', null);

    const linkPercentage =
      totalProps?.length > 0
        ? Math.round(((linkedProps?.length || 0) / totalProps.length) * 100)
        : 0;

    console.log(
      `📊 Props-Games Linking: ${linkPercentage}% (${linkedProps?.length || 0}/${totalProps?.length || 0})`
    );

    if (linkPercentage >= 90) {
      console.log('✅ PASS: Excellent props linking (≥90%)');
      results.databaseIntegrity.passed++;
    } else if (linkPercentage >= 70) {
      console.log('⚠️  PARTIAL: Good props linking (70-89%)');
    } else {
      console.log('❌ FAIL: Poor props linking (<70%)');
    }

    // Test 1.2: Foreign Key Relationships
    results.databaseIntegrity.total++;
    try {
      const { data: orphanedProps } = await supabase
        .from('raw_props')
        .select('id, game_id')
        .not('game_id', 'is', null);

      if (orphanedProps && orphanedProps.length > 0) {
        const gameIds = [...new Set(orphanedProps.map(p => p.game_id))];
        const { data: existingGames } = await supabase.from('games').select('id').in('id', gameIds);

        const validLinks = existingGames?.length || 0;
        const totalLinks = gameIds.length;
        const validityPercentage =
          totalLinks > 0 ? Math.round((validLinks / totalLinks) * 100) : 100;

        console.log(
          `🔗 Foreign Key Validity: ${validityPercentage}% (${validLinks}/${totalLinks} valid references)`
        );

        if (validityPercentage >= 95) {
          console.log('✅ PASS: Excellent referential integrity (≥95%)');
          results.databaseIntegrity.passed++;
        } else {
          console.log('❌ FAIL: Poor referential integrity (<95%)');
        }
      } else {
        console.log('✅ PASS: No props to validate (empty database)');
        results.databaseIntegrity.passed++;
      }
    } catch (error) {
      console.log('❌ FAIL: Error checking foreign key relationships:', error.message);
    }

    // ========================================
    // 2. PROPS LINKING PERFORMANCE TESTS
    // ========================================
    console.log('\n2️⃣ PROPS LINKING PERFORMANCE TESTS');
    console.log('===================================');

    // Test 2.1: Props Availability by Sport
    results.propsLinking.total++;
    const sports = ['MLB', 'NBA', 'NFL', 'NCAAF'];
    let sportsWithProps = 0;

    for (const sport of sports) {
      const { data: sportProps } = await supabase
        .from('raw_props')
        .select('id', { count: 'exact' })
        .eq('sport', sport)
        .not('game_id', 'is', null);

      const propCount = sportProps?.length || 0;
      console.log(`🏈 ${sport}: ${propCount} linked props`);

      if (propCount > 0) sportsWithProps++;
    }

    console.log(`📊 Sports Coverage: ${sportsWithProps}/${sports.length} sports have props`);
    if (sportsWithProps >= 1) {
      console.log('✅ PASS: At least one sport has props');
      results.propsLinking.passed++;
    } else {
      console.log('❌ FAIL: No sports have props');
    }

    // Test 2.2: Props Distribution Quality
    results.propsLinking.total++;
    const { data: propsDistribution } = await supabase
      .from('raw_props')
      .select('game_id, sport')
      .not('game_id', 'is', null);

    if (propsDistribution && propsDistribution.length > 0) {
      const gamePropsCount = {};
      propsDistribution.forEach(prop => {
        gamePropsCount[prop.game_id] = (gamePropsCount[prop.game_id] || 0) + 1;
      });

      const gamesWithProps = Object.keys(gamePropsCount).length;
      const avgPropsPerGame = propsDistribution.length / gamesWithProps;

      console.log(`🎲 Games with props: ${gamesWithProps}`);
      console.log(`📊 Average props per game: ${avgPropsPerGame.toFixed(1)}`);

      if (avgPropsPerGame >= 5) {
        console.log('✅ PASS: Good props density (≥5 props per game)');
        results.propsLinking.passed++;
      } else {
        console.log('⚠️  PARTIAL: Low props density (<5 props per game)');
      }
    } else {
      console.log('❌ FAIL: No props distribution data');
    }

    // ========================================
    // 3. API PERFORMANCE TESTS
    // ========================================
    console.log('\n3️⃣ API PERFORMANCE TESTS');
    console.log('=========================');

    // Test 3.1: Games API Response Time
    results.apiPerformance.total++;
    try {
      const startTime = Date.now();
      const gamesResponse = await fetch('http://localhost:3002/api/games?sport=MLB');
      const gamesResult = await gamesResponse.json();
      const responseTime = Date.now() - startTime;

      console.log(`⚡ Games API Response Time: ${responseTime}ms`);
      console.log(`📊 Games API Success: ${gamesResult.success ? 'YES' : 'NO'}`);
      console.log(`🎯 Games Found: ${gamesResult.count || 0}`);

      if (gamesResult.success && responseTime < 2000) {
        console.log('✅ PASS: Games API fast and working (<2s)');
        results.apiPerformance.passed++;
      } else {
        console.log('❌ FAIL: Games API slow or failing');
      }
    } catch (error) {
      console.log('❌ FAIL: Games API unreachable:', error.message);
    }

    // Test 3.2: Props API Response Time
    results.apiPerformance.total++;
    try {
      // Get a game ID to test props with
      const { data: testGame } = await supabase
        .from('games')
        .select('id')
        .eq('league', 'MLB')
        .limit(1)
        .single();

      if (testGame) {
        const startTime = Date.now();
        const propsResponse = await fetch(
          `http://localhost:3002/api/props?game_id=${testGame.id}&sport=MLB&prop_type=player_props`
        );
        const propsResult = await propsResponse.json();
        const responseTime = Date.now() - startTime;

        console.log(`⚡ Props API Response Time: ${responseTime}ms`);
        console.log(`📊 Props API Success: ${propsResult.success ? 'YES' : 'NO'}`);
        console.log(`🎲 Props Source: ${propsResult.source}`);
        console.log(`🎯 Props Found: ${propsResult.count || 0}`);

        if (propsResult.success && responseTime < 3000) {
          console.log('✅ PASS: Props API fast and working (<3s)');
          results.apiPerformance.passed++;
        } else {
          console.log('❌ FAIL: Props API slow or failing');
        }
      } else {
        console.log('⚠️  SKIP: No test game available for props API test');
      }
    } catch (error) {
      console.log('❌ FAIL: Props API unreachable:', error.message);
    }

    // ========================================
    // 4. TIMEZONE HANDLING TESTS
    // ========================================
    console.log('\n4️⃣ TIMEZONE HANDLING TESTS');
    console.log('===========================');

    // Test 4.1: UTC Timestamp Availability
    results.timezoneHandling.total++;
    try {
      const gamesResponse = await fetch('http://localhost:3002/api/games?sport=MLB');
      const gamesResult = await gamesResponse.json();

      if (gamesResult.success && gamesResult.games && gamesResult.games.length > 0) {
        const gamesWithUTC = gamesResult.games.filter(game => game.utc_timestamp);
        const utcPercentage = Math.round((gamesWithUTC.length / gamesResult.games.length) * 100);

        console.log(
          `🕐 Games with UTC timestamps: ${utcPercentage}% (${gamesWithUTC.length}/${gamesResult.games.length})`
        );

        if (utcPercentage >= 80) {
          console.log('✅ PASS: Most games have UTC timestamps for timezone conversion');
          results.timezoneHandling.passed++;
        } else {
          console.log('⚠️  PARTIAL: Some games missing UTC timestamps');
        }
      } else {
        console.log('⚠️  SKIP: No games available for timezone test');
      }
    } catch (error) {
      console.log('❌ FAIL: Error testing timezone handling:', error.message);
    }

    // Test 4.2: Time Format Consistency
    results.timezoneHandling.total++;
    const { data: gamesWithTime } = await supabase
      .from('games')
      .select('id, commence_time, start_time')
      .not('commence_time', 'is', null)
      .limit(10);

    if (gamesWithTime && gamesWithTime.length > 0) {
      let validTimeFormats = 0;

      gamesWithTime.forEach(game => {
        const time = game.commence_time || game.start_time;
        if (time) {
          const date = new Date(time);
          if (!isNaN(date.getTime())) {
            validTimeFormats++;
          }
        }
      });

      const formatPercentage = Math.round((validTimeFormats / gamesWithTime.length) * 100);
      console.log(
        `📅 Valid time formats: ${formatPercentage}% (${validTimeFormats}/${gamesWithTime.length})`
      );

      if (formatPercentage >= 90) {
        console.log('✅ PASS: Consistent time formats');
        results.timezoneHandling.passed++;
      } else {
        console.log('❌ FAIL: Inconsistent time formats');
      }
    } else {
      console.log('⚠️  SKIP: No games with time data');
    }

    // ========================================
    // 5. DATA QUALITY TESTS
    // ========================================
    console.log('\n5️⃣ DATA QUALITY TESTS');
    console.log('======================');

    // Test 5.1: Mock Data Elimination
    results.dataQuality.total++;
    try {
      const propsResponse = await fetch(
        'http://localhost:3002/api/props?game_id=test&sport=MLB&prop_type=player_props'
      );
      const propsResult = await propsResponse.json();

      console.log(`🎭 Props API Source: ${propsResult.source}`);
      console.log(`📊 Mock Data Usage: ${propsResult.source === 'mock_data' ? 'YES' : 'NO'}`);

      if (propsResult.source !== 'mock_data') {
        console.log('✅ PASS: No mock data fallback used');
        results.dataQuality.passed++;
      } else {
        console.log('❌ FAIL: Still using mock data fallback');
      }
    } catch (error) {
      console.log('⚠️  SKIP: Could not test mock data elimination');
    }

    // Test 5.2: Data Completeness
    results.dataQuality.total++;
    const { data: completeGames } = await supabase
      .from('games')
      .select('id, home_team, away_team, league, game_date')
      .not('home_team', 'is', null)
      .not('away_team', 'is', null)
      .not('league', 'is', null)
      .not('game_date', 'is', null);

    const { data: allGames } = await supabase.from('games').select('id', { count: 'exact' });

    const completenessPercentage =
      allGames?.length > 0 ? Math.round(((completeGames?.length || 0) / allGames.length) * 100) : 0;

    console.log(
      `📋 Data Completeness: ${completenessPercentage}% (${completeGames?.length || 0}/${allGames?.length || 0} complete games)`
    );

    if (completenessPercentage >= 90) {
      console.log('✅ PASS: High data completeness (≥90%)');
      results.dataQuality.passed++;
    } else {
      console.log('❌ FAIL: Low data completeness (<90%)');
    }

    // ========================================
    // FINAL RESULTS SUMMARY
    // ========================================
    console.log('\n🏆 FINAL TEST RESULTS SUMMARY');
    console.log('==============================');

    const categories = [
      { name: 'Database Integrity', results: results.databaseIntegrity },
      { name: 'Props Linking', results: results.propsLinking },
      { name: 'API Performance', results: results.apiPerformance },
      { name: 'Timezone Handling', results: results.timezoneHandling },
      { name: 'Data Quality', results: results.dataQuality },
    ];

    let totalPassed = 0;
    let totalTests = 0;

    categories.forEach(category => {
      const percentage =
        category.results.total > 0
          ? Math.round((category.results.passed / category.results.total) * 100)
          : 0;
      const status = percentage >= 80 ? '✅' : percentage >= 60 ? '⚠️' : '❌';

      console.log(
        `${status} ${category.name}: ${percentage}% (${category.results.passed}/${category.results.total})`
      );

      totalPassed += category.results.passed;
      totalTests += category.results.total;
    });

    const overallPercentage = totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0;

    console.log('\n📊 OVERALL SYSTEM HEALTH');
    console.log('========================');
    console.log(
      `🎯 Overall Score: ${overallPercentage}% (${totalPassed}/${totalTests} tests passed)`
    );

    if (overallPercentage >= 90) {
      console.log('🎉 EXCELLENT: System improvements are highly successful!');
      console.log('✅ Database schema changes have significantly improved the platform');
    } else if (overallPercentage >= 70) {
      console.log('👍 GOOD: System improvements are mostly successful');
      console.log('⚠️  Some areas may need additional attention');
    } else if (overallPercentage >= 50) {
      console.log('⚠️  FAIR: System improvements show mixed results');
      console.log('🔧 Additional work needed to reach production standards');
    } else {
      console.log('❌ POOR: System improvements need significant work');
      console.log('🚨 Critical issues must be addressed before production');
    }

    console.log('\n📋 IMPROVEMENT RECOMMENDATIONS:');
    if (results.databaseIntegrity.passed < results.databaseIntegrity.total) {
      console.log('• 🔧 Address database integrity issues');
    }
    if (results.propsLinking.passed < results.propsLinking.total) {
      console.log('• 🎲 Improve props linking and distribution');
    }
    if (results.apiPerformance.passed < results.apiPerformance.total) {
      console.log('• ⚡ Optimize API response times');
    }
    if (results.timezoneHandling.passed < results.timezoneHandling.total) {
      console.log('• 🕐 Fix timezone handling implementation');
    }
    if (results.dataQuality.passed < results.dataQuality.total) {
      console.log('• 📊 Improve data quality and completeness');
    }

    if (overallPercentage >= 90) {
      console.log('🚀 System is ready for production deployment!');
    }
  } catch (error) {
    console.error('💥 Test suite failed:', error);
  }
}

testSystemImprovements();
