/**
 * FeedAgent Configuration Diagnostics
 *
 * Prints resolved configuration using the same logic as runFeedAgentNow.ts
 */

import { getEnv } from '../../utils/getEnv';

async function diagnoseFeedConfig() {
  console.log('🔍 FEEDAGENT CONFIGURATION DIAGNOSTICS');
  console.log('='.repeat(60));

  try {
    // Import the same resolution logic from runFeedAgentNow.ts
    const env = process.env;

    // Simulate typical MLB props configuration
    const mockParsed = {
      mode: 'canary',
      sport: 'mlb',
      providers: 'odds-api',
      markets: 'h2h,spreads,totals,player-props',
      regions: 'us',
      bookmakers: 'draftkings,fanduel,betmgm,caesars',
      maxEvents: '30',
      cacheFirst: '1',
      write: '0',
      dryRun: '1'
    };

    // Apply same resolution logic as runFeedAgentNow.ts
    const resolvedMode = mockParsed.mode || env.SMOKE_MODE || 'canary';

    // Provider resolution
    let providers: string[] = ['odds-api'];
    if (mockParsed.providers) {
      providers = mockParsed.providers.split(/[,\s]+/).map((p: string) => p.trim()).filter(Boolean);
    } else if (env.FEED_PROVIDERS) {
      providers = env.FEED_PROVIDERS.split(/[,\s]+/).map(p => p.trim()).filter(Boolean);
    }

    // Markets resolution
    let markets: string[] = ['h2h', 'spreads', 'totals'];
    if (mockParsed.markets) {
      markets = mockParsed.markets.split(/[,\s]+/).map((m: string) => m.trim()).filter(Boolean);
    } else if (env.FEED_MARKETS) {
      markets = env.FEED_MARKETS.split(/[,\s]+/).map(m => m.trim()).filter(Boolean);
    }

    const resolvedConfig = {
      // Core settings
      mode: resolvedMode,
      sport: mockParsed.sport || 'mlb',
      providers,
      markets,
      regions: mockParsed.regions || env.FEED_REGIONS || 'us',
      bookmakers: mockParsed.bookmakers || env.FEED_BOOKMAKERS || 'draftkings,fanduel,betmgm,caesars',

      // Event processing
      maxEvents: parseInt(mockParsed.maxEvents) || 50,
      eventBatchSize: parseInt(mockParsed.eventBatchSize) || 20,
      eventLookaheadHours: parseInt(mockParsed.eventLookaheadHours) || 48,

      // Cache settings
      cacheFirst: mockParsed.cacheFirst === '1' || mockParsed.cacheFirst === 'true',

      // Write settings
      write: mockParsed.write === '1' || mockParsed.write === 'true',
      dryRun: mockParsed.dryRun === '1' || mockParsed.dryRun === 'true',

      // Props settings
      propsEnabled: env.FEED_ENABLE_PROPS !== 'false',

      // Environment flags
      feedDisableSgo: env.FEED_DISABLE_SGO === '1',

      // Redis configuration
      redis: {
        host: env.REDIS_HOST || 'redis',
        port: parseInt(env.REDIS_PORT || '6379'),
        fallbackEnabled: true,
      },

      // API credentials
      oddsApiKey: env.ODDS_API_KEY ? '***CONFIGURED***' : 'MISSING',
      supabaseUrl: env.SUPABASE_URL ? '***CONFIGURED***' : 'MISSING',
      supabaseKey: env.SUPABASE_SERVICE_ROLE_KEY ? '***CONFIGURED***' : 'MISSING',

      // Credit guards
      credits: {
        monthlyLimit: 5000000,
        minRemainingCredits: 25,
        adaptiveBackoff: true,
      },

      // Concurrency (from oddsApi.ts)
      concurrency: {
        eventConcurrency: 1, // Sequential event processing
        propsPerEventConcurrency: 1, // Sequential props per event
      }
    };

    console.log('\nRESOLVED_CONFIG:');
    console.log(JSON.stringify(resolvedConfig, null, 2));

    // Market expansion test
    console.log('\n📊 MARKET EXPANSION TEST:');

    try {
      // Test MLB market expansion
      const { expandMarketAliases } = await import('../../agents/FeedAgent/oddsApi');
      const expandedMarkets = expandMarketAliases(['player-props'], 'baseball_mlb');
      console.log('MLB player-props expansion:', expandedMarkets.length, 'markets');
      console.log('Sample markets:', expandedMarkets.slice(0, 8).join(', '));

      // Test NFL market expansion
      const nflExpandedMarkets = expandMarketAliases(['player-props'], 'americanfootball_nfl');
      console.log('NFL player-props expansion:', nflExpandedMarkets.length, 'markets');
      console.log('Sample markets:', nflExpandedMarkets.slice(0, 8).join(', '));
    } catch (err) {
      console.log('Market expansion test failed:', err.message);
    }

    console.log('\n✅ Configuration diagnostics complete!');

  } catch (error) {
    console.error('❌ Diagnostics failed:', error.message);
    process.exit(1);
  }
}

diagnoseFeedConfig();