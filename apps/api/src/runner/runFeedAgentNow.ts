#!/usr/bin/env node

/**
 * Enhanced Feed Agent Runner with Shadow Mode and Run Reports
 *
 * Features:
 * - Shadow mode support (--mode=shadow)
 * - Sport filtering (--sport=nfl,nba,mlb,nhl)
 * - Event limiting (--maxEvents=10)
 * - Cache-first option (--cacheFirst=1)
 * - Write persistence support (--write=1 --dryRun=0)
 * - Credit logging and run reports
 * - Exit 0 on no data (agent stability)
 */

import 'dotenv/config';
import { agentRunner } from '../services/agentRunner.js';
import { creditLogger } from '../services/creditLogger.js';
import { cacheClient } from '../services/cacheClient.js';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

interface RunArgs {
  mode: 'shadow' | 'canary' | 'production';
  sport: string;
  maxEvents: number;
  cacheFirst: boolean;
  write: boolean;
  dryRun: boolean;
  providers: string[];
  markets: string[];
  regions: string;
  bookmakers: string;
  oddsFormat: string;
  dateFormat: string;
  eventBatchSize: number;
  eventLookaheadHours: number;
}

interface WriteMetrics {
  attemptedWrites: number;
  inserted: number;
  skippedDedup: number;
  errors: number;
}

function parseArgs(): RunArgs {
  const args = process.argv.slice(2);
  const parsed: any = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');

      if (value !== undefined) {
        // Format: --key=value
        parsed[key] = value;
      } else {
        // Format: --key value (check next argument)
        const nextArg = args[i + 1];
        if (nextArg && !nextArg.startsWith('--')) {
          parsed[key] = nextArg;
          i++; // Skip next argument since we consumed it
        } else {
          // Just a flag without value
          parsed[key] = 'true';
        }
      }
    }
  }

  // Enhanced mode resolution with SMOKE_MODE fallback
  const resolvedMode = parsed.mode || process.env.SMOKE_MODE || 'canary';

  // Provider resolution with priority order: CLI -> ENV -> default
  let providers: string[] = ['odds-api']; // Default to odds-api only

  if (parsed.providers) {
    // CLI --providers=odds-api,sgo-api or --providers="odds-api sgo-api"
    providers = parsed.providers.split(/[,\s]+/).map((p: string) => p.trim()).filter(Boolean);
  } else if (process.env.FEED_PROVIDERS) {
    // Environment variable FEED_PROVIDERS
    providers = process.env.FEED_PROVIDERS.split(/[,\s]+/).map(p => p.trim()).filter(Boolean);
  }

  // If FEED_DISABLE_SGO is truthy, remove sgo-api from the list
  if (process.env.FEED_DISABLE_SGO && ['1', 'true', 'yes'].includes(process.env.FEED_DISABLE_SGO.toLowerCase())) {
    providers = providers.filter(p => p !== 'sgo-api');
    console.log('[RunFeed] FEED_DISABLE_SGO=1 detected - SGO removed from providers list');
  }

  // Markets resolution with priority: CLI -> ENV -> default ['h2h', 'spreads', 'totals']
  let markets: string[] = ['h2h', 'spreads', 'totals']; // Default to core markets

  if (parsed.markets) {
    // CLI --markets=h2h,spreads,totals or --markets="h2h spreads"
    markets = parsed.markets.split(/[,\s]+/).map((m: string) => m.trim()).filter(Boolean);
  } else if (process.env.FEED_MARKETS) {
    // Environment variable FEED_MARKETS
    markets = process.env.FEED_MARKETS.split(/[,\s]+/).map(m => m.trim()).filter(Boolean);
  }

  // Regions resolution: CLI -> ENV -> default 'us'
  const regions = parsed.regions || process.env.FEED_REGIONS || 'us';

  // Bookmakers resolution: CLI -> ENV -> default
  const bookmakers = parsed.bookmakers ||
                     process.env.FEED_BOOKMAKERS ||
                     'draftkings,fanduel,betmgm,caesars';

  // Odds format resolution: CLI -> ENV -> default 'american'
  const oddsFormat = parsed.oddsFormat || process.env.ODDS_API_ODDS_FORMAT || 'american';

  // Date format resolution: CLI -> ENV -> default 'iso'
  const dateFormat = parsed.dateFormat || process.env.ODDS_API_DATE_FORMAT || 'iso';

  // Event batch size and lookahead hours
  const eventBatchSize = parseInt(parsed.eventBatchSize || process.env.FEED_EVENT_BATCH_SIZE || '20', 10);
  const eventLookaheadHours = parseInt(parsed.eventLookaheadHours || process.env.FEED_EVENT_LOOKAHEAD_HOURS || '48', 10);

  return {
    mode: resolvedMode as 'shadow' | 'canary' | 'production',
    sport: parsed.sport || 'nfl',
    maxEvents: parseInt(parsed.maxEvents || '50', 10),
    cacheFirst: parsed.cacheFirst === '1' || parsed.cacheFirst === 'true',
    write: parsed.write === '1' || parsed.write === 'true',
    dryRun: parsed.dryRun === '1' || parsed.dryRun === 'true',
    providers,
    markets,
    regions,
    bookmakers,
    oddsFormat,
    dateFormat,
    eventBatchSize,
    eventLookaheadHours
  };
}

async function main() {
  const args = parseArgs();

  // Determine if writes are enabled based on mode and flags
  const writeEnabled = args.mode === 'canary' || (args.write && !args.dryRun);

  // Log target backend at start
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const useSupabase = !!supabaseServiceRoleKey;

  // Ensure we have Supabase credentials in canary/production mode
  if (args.mode !== 'shadow' && !useSupabase) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY required for canary/production mode');
  }

  // Log the final resolved config at start
  const resolvedConfig = {
    resolvedMode: args.mode,
    writeEnabled,
    target: useSupabase ? 'supabase' : 'postgres',
    providers: args.providers,
    markets: args.markets,
    regions: args.regions,
    bookmakers: args.bookmakers,
    oddsFormat: args.oddsFormat,
    dateFormat: args.dateFormat,
    eventBatchSize: args.eventBatchSize,
    eventLookaheadHours: args.eventLookaheadHours,
    sport: args.sport,
    supabaseRole: useSupabase ? 'service_role' : 'none',
    hasServiceKey: !!supabaseServiceRoleKey
  };

  console.log(`🚀 Starting FeedAgent`);
  console.log(`📊 Resolved Config =>`, JSON.stringify(resolvedConfig, null, 2));
  console.log(`📊 Sport: ${args.sport}, Max Events: ${args.maxEvents}, Cache First: ${args.cacheFirst}`);
  console.log(`💾 Write: ${args.write}, Dry Run: ${args.dryRun}, Write Enabled: ${writeEnabled}`);

  const runId = agentRunner.beginRun('FeedAgent', args);

  let writeMetrics: WriteMetrics = {
    attemptedWrites: 0,
    inserted: 0,
    skippedDedup: 0,
    errors: 0
  };

  try {
    // Set environment variables based on args
    if (args.cacheFirst) {
      process.env.CACHE_FIRST = '1';
    }
    if (writeEnabled) {
      process.env.ENABLE_WRITES = '1';
    }

    // Initialize credit logger
    creditLogger.beginRun('feedagent');

    let processed = 0;
    let noOps = 0;

    // Shadow mode: simulate processing without real API calls
    if (args.mode === 'shadow') {
      console.log('🌒 Shadow mode: Simulating feed processing...');
      processed = Math.min(args.maxEvents, 5); // Simulate processing 5 items
      noOps = 0;

      // Simulate some cache hits
      await cacheClient.get(`shadow:${args.sport}:test`);
      await cacheClient.set(`shadow:${args.sport}:test`, { mock: true }, 60);

      console.log(`✅ Shadow processing completed: ${processed} items simulated`);
    } else {
      // Real processing: use event-first core markets flow
      console.log('🔄 Real mode processing: event-first core markets...');

      // Import core markets function
      const { fetchAndWriteCoreMarkets } = await import('../agents/FeedAgent/oddsApi.js');

      // Map sport to sport_key
      const sportKeyMap: Record<string, string> = {
        'nfl': 'americanfootball_nfl',
        'ncaaf': 'americanfootball_ncaaf',
        'nba': 'basketball_nba',
        'ncaab': 'basketball_ncaab',
        'wnba': 'basketball_wnba',
        'mlb': 'baseball_mlb',
        'nhl': 'icehockey_nhl',
      };

      const sportKey = sportKeyMap[args.sport.toLowerCase()] || args.sport;

      console.log(`🔧 Core Markets Configuration:`, {
        sport: args.sport,
        sportKey,
        providers: args.providers,
        markets: args.markets,
        regions: args.regions,
        bookmakers: args.bookmakers.split(',').map(b => b.trim()),
        oddsFormat: args.oddsFormat,
        dateFormat: args.dateFormat,
        eventBatchSize: args.eventBatchSize,
        eventLookaheadHours: args.eventLookaheadHours,
        writeEnabled
      });

      try {
        // Fetch and write core markets
        const result = await fetchAndWriteCoreMarkets(sportKey as any, {
          markets: args.markets,
          regions: args.regions,
          bookmakers: args.bookmakers.split(',').map(b => b.trim()),
          oddsFormat: args.oddsFormat as 'decimal' | 'american',
          dateFormat: args.dateFormat as 'iso' | 'unix',
          daysFrom: args.eventLookaheadHours / 24,
        });

        // Update metrics from result
        processed = result.eventsFetched;
        writeMetrics = result.coreMarketWrites;

        console.log(`✅ Core markets processing completed`);
        console.log(`📊 Events fetched: ${result.eventsFetched}`);
        console.log(`📊 Markets processed:`, result.marketsProcessed);
        console.log(`📊 Core market writes:`, result.coreMarketWrites);

        // Store additional metrics for report
        (writeMetrics as any).eventsFetched = result.eventsFetched;
        (writeMetrics as any).marketsProcessed = result.marketsProcessed;

        // Import and use summarize helper
        const { summarizeWriteMetrics } = await import('../services/unifiedPicksWriter.js');
        console.log(`📊 Summary: ${summarizeWriteMetrics(writeMetrics, result.eventsFetched, processed)}`);

      } catch (error: any) {
        console.error('❌ Core markets error:', error.message);
        writeMetrics.errors++;
        throw error;
      }
    }

    // Update run summary with write metrics and resolved config
    agentRunner.updateSummary({
      processed,
      noOps,
      writeMetrics: writeMetrics,
      resolvedConfig: resolvedConfig
    });

    // Flush credits
    await creditLogger.flush();

    // Export cache stats
    cacheClient.exportStats();

    // End successful run and get report path
    const reportPath = await agentRunner.endRun(true);
    console.log(`📋 Run report: ${reportPath}`);

    // Write enhanced report with write metrics
    if (reportPath) {
      try {
        const reportData = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        reportData.writeMetrics = writeMetrics;
        reportData.resolvedConfig = resolvedConfig;
        reportData.summary = {
          ...reportData.summary,
          processed,
          writeMetrics,
          resolvedConfig
        };
        // Include first write error for smoke test reporting
        if (writeMetrics.firstError) {
          reportData.firstWriteError = writeMetrics.firstError;
        }

        // Add pass reason for observability
        const hasInserts = writeMetrics.inserted > 0;
        const hasDedup = (writeMetrics.skippedDedup ?? 0) > 0;
        const hasErrors = (writeMetrics.errors ?? 0) > 0;

        let passReason = 'Unknown';
        if (hasInserts && !hasErrors) {
          passReason = `Success: ${writeMetrics.inserted} picks inserted`;
        } else if (hasDedup && !hasErrors && !hasInserts) {
          passReason = `Success: ${writeMetrics.skippedDedup} picks deduplicated (repeat run)`;
        } else if (hasInserts && hasDedup && !hasErrors) {
          passReason = `Success: ${writeMetrics.inserted} inserted, ${writeMetrics.skippedDedup} deduplicated`;
        } else if (hasErrors) {
          passReason = `Failure: ${writeMetrics.errors} errors occurred`;
        } else if (processed === 0) {
          passReason = 'No data processed';
        }

        reportData.passReason = passReason;

        fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
        console.log(`📊 Write metrics: ${JSON.stringify(writeMetrics)}`);
        console.log(`✅ Pass reason: ${passReason}`);
      } catch (e) {
        console.warn('Failed to enhance report with write metrics:', e);
      }
    }

    // Exit 0 even if no data processed (stability requirement)
    process.exit(0);

  } catch (error: any) {
    console.error('❌ FeedAgent error:', error.message);

    agentRunner.recordError(error);
    writeMetrics.errors++;

    try {
      await creditLogger.flush();
      const reportPath = await agentRunner.endRun(false);
      console.log(`📋 Error report: ${reportPath}`);

      // Add write metrics to error report too
      if (reportPath) {
        try {
          const reportData = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
          reportData.writeMetrics = writeMetrics;
          fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
        } catch (e) {
          console.warn('Failed to add write metrics to error report:', e);
        }
      }
    } catch (reportError) {
      console.error('Failed to write error report:', reportError);
    }

    // Exit 1 on actual errors, but not on no-data conditions
    if (error.message.includes('no data') || error.message.includes('empty result')) {
      console.log('ℹ️ No data found, but this is not an error condition');
      process.exit(0);
    }

    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}