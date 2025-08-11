import { fetchEvents } from '../src/agents/FeedAgent/optimal';
import 'dotenv/config';

/**
 * TEST OPTIMAL API LEAGUES
 * 
 * Check what leagues and sports are available in the Optimal API
 */

async function testOptimalApiLeagues() {
  console.log('🔍 TESTING OPTIMAL API LEAGUES');
  console.log('='.repeat(60));

  try {
    console.log('📡 Fetching events from Optimal API...');
    const events = await fetchEvents();

    if (events.length === 0) {
      console.log('❌ No events found');
      return;
    }

    console.log(`✅ Found ${events.length} total events`);

    // Group events by league
    const leagueGroups: Record<string, number> = {};
    const leagueSamples: Record<string, any[]> = {};

    events.forEach(event => {
      const league = event.league;
      leagueGroups[league] = (leagueGroups[league] || 0) + 1;
      
      if (!leagueSamples[league]) {
        leagueSamples[league] = [];
      }
      
      if (leagueSamples[league].length < 3) {
        leagueSamples[league].push({
          id: event.id,
          home: event.home_display || event.home,
          away: event.away_display || event.away,
          commence_time: event.commence_time,
          status: event.status
        });
      }
    });

    console.log('\n📊 LEAGUES AVAILABLE:');
    Object.entries(leagueGroups)
      .sort(([,a], [,b]) => b - a)
      .forEach(([league, count]) => {
        console.log(`  ${league}: ${count} events`);
      });

    console.log('\n📋 SAMPLE EVENTS BY LEAGUE:');
    Object.entries(leagueSamples)
      .sort(([,a], [,b]) => b.length - a.length)
      .forEach(([league, samples]) => {
        console.log(`\n🏆 ${league}:`);
        samples.forEach((sample, index) => {
          console.log(`  ${index + 1}. ${sample.away} @ ${sample.home} (${sample.status})`);
          console.log(`     ID: ${sample.id}, Time: ${sample.commence_time}`);
        });
      });

    console.log('\n' + '='.repeat(60));
    console.log('🎯 ANALYSIS SUMMARY');
    console.log('='.repeat(60));

    const availableLeagues = Object.keys(leagueGroups).sort();
    console.log('✅ AVAILABLE LEAGUES:', availableLeagues.join(', '));

    const targetLeagues = ['NBA', 'NFL', 'MLB', 'NHL', 'WNBA', 'NCAAF'];
    const missingLeagues = targetLeagues.filter(league => !availableLeagues.includes(league));
    const foundLeagues = targetLeagues.filter(league => availableLeagues.includes(league));

    console.log('\n📈 TARGET LEAGUE STATUS:');
    foundLeagues.forEach(league => {
      console.log(`  ✅ ${league}: ${leagueGroups[league]} events`);
    });

    if (missingLeagues.length > 0) {
      console.log('\n❌ MISSING TARGET LEAGUES:');
      missingLeagues.forEach(league => {
        console.log(`  ❌ ${league}: Not available`);
      });
    }

    console.log('\n💡 RECOMMENDATIONS:');
    if (foundLeagues.includes('NBA')) {
      console.log('  1. ✅ Create NBA player population script');
    }
    if (foundLeagues.includes('NFL')) {
      console.log('  2. ✅ Expand NFL player population script');
    }
    if (foundLeagues.includes('WNBA')) {
      console.log('  3. ✅ Create WNBA player population script');
    }
    if (foundLeagues.includes('NHL')) {
      console.log('  4. ✅ Create NHL player population script');
    }
    if (missingLeagues.includes('NCAAF')) {
      console.log('  5. ❌ NCAAF not available - check Odds API or other sources');
    }

  } catch (error) {
    console.error('💥 Failed to test Optimal API leagues:', error);
    
    if (error instanceof Error && error.message.includes('Rate limit')) {
      console.log('⏰ Rate limit hit - this is expected if testing frequently');
    } else if (error instanceof Error && error.message.includes('OPTIMAL_API_KEY')) {
      console.log('🔑 Missing Optimal API key - check environment variables');
    }
  }
}

// Run the test
testOptimalApiLeagues();