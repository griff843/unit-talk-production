import { fetchOptimalProps, fetchEvents, getRateLimitStatus } from './apps/api/src/agents/FeedAgent/optimal.js';

async function testOptimalNFLTonight() {
  try {
    // Check rate limit status first
    console.log('🚀 Checking Optimal API rate limit status...');
    const rateLimitStatus = getRateLimitStatus();
    console.log('Rate limit status:', rateLimitStatus);

    if (!rateLimitStatus.canMakeRequest) {
      console.error('❌ Rate limit exceeded. Cannot make request.');
      return;
    }

    // First, fetch all events to see what's available
    console.log('📅 Fetching all available events...');
    const events = await fetchEvents();
    console.log(`✅ Found ${events.length} total events`);

    // Filter for NFL events
    const nflEvents = events.filter(event =>
      event.league.toUpperCase() === 'NFL'
    );

    console.log(`🏈 Found ${nflEvents.length} NFL events:`);
    nflEvents.forEach((event, i) => {
      console.log(`${i+1}. ${event.away} @ ${event.home} - ${event.commence_time}`);
    });

    if (nflEvents.length === 0) {
      console.log('⚠️ No NFL events found - may be off-season or no games tonight');

      // Let's also check what sports ARE available
      const availableSports = [...new Set(events.map(e => e.league))];
      console.log('Available sports:', availableSports);
      return;
    }

    // Fetch NFL props
    console.log('🎯 Fetching NFL props...');
    const nflProps = await fetchOptimalProps('NFL');
    console.log(`✅ Found ${nflProps.length} NFL props`);

    if (nflProps.length === 0) {
      console.log('⚠️ No NFL props found');
      return;
    }

    // Show sample props
    console.log('📊 Sample NFL props:');
    nflProps.slice(0, 10).forEach((prop, i) => {
      console.log(`${i+1}. ${prop.player_name} - ${prop.stat_type} - Line: ${prop.line} - Over: ${prop.over_odds} Under: ${prop.under_odds}`);
    });

    // Group by game/team for better organization
    const propsByTeam = nflProps.reduce((acc, prop) => {
      if (!acc[prop.team]) {
        acc[prop.team] = [];
      }
      acc[prop.team].push(prop);
      return acc;
    }, {} as Record<string, any[]>);

    console.log('🎯 Props by team:');
    Object.entries(propsByTeam).forEach(([team, props]) => {
      console.log(`  ${team}: ${props.length} props`);
    });

    return nflProps;

  } catch (error) {
    console.error('❌ Error testing Optimal NFL props:', error);
    throw error;
  }
}

testOptimalNFLTonight().catch(console.error);