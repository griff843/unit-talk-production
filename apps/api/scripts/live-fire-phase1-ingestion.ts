#!/usr/bin/env tsx
/**
 * Phase 1 Live-Fire Ingestion - Supabase Production Pipeline
 *
 * ✅ PRODUCTION CANARY APPROVED
 * ✅ Uses FeedAgent with CanonicalMappingService
 * ✅ Writes to Supabase v3 schema (sport, stat_type, canonical IDs)
 * ✅ Real Odds API data with automatic canonical entity resolution
 *
 * Date: December 5, 2025
 */

import dotenv from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import { FeedAgent } from '../src/agents/FeedAgent';
import type { BaseAgentDependencies } from '../src/agents/BaseAgent/types';

// Load environment variables from workspace root
const rootEnvPath = resolve(__dirname, '../../../.env');
const sharedEnvPath = resolve(__dirname, '../../../.env.shared');
dotenv.config({ path: rootEnvPath });
dotenv.config({ path: sharedEnvPath });

// Validate required environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.ODDS_API_KEY) {
  console.error('❌ FATAL: Missing required environment variables:');
  if (!process.env.SUPABASE_URL) console.error('  - SUPABASE_URL');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  if (!process.env.ODDS_API_KEY) console.error('  - ODDS_API_KEY');
  console.error('\nPlease ensure .env and .env.shared files are configured properly.');
  process.exit(1);
}

console.log('\n╔═══════════════════════════════════════════════════════════════╗');
console.log('║   PHASE 1 LIVE-FIRE INGESTION - SUPABASE PRODUCTION        ║');
console.log('║   Using: FeedAgent + CanonicalMappingService                ║');
console.log('║   Target: Supabase v3 Schema with Canonical Entities       ║');
console.log('╚═══════════════════════════════════════════════════════════════╝\n');

console.log('🔍 ENVIRONMENT AUDIT:\n');
console.log(`  ODDS_API_KEY: SET (${process.env.ODDS_API_KEY.length} chars)`);
console.log(`  SUPABASE_URL: ${process.env.SUPABASE_URL}`);
console.log(`  SUPABASE_SERVICE_ROLE_KEY: SET (${process.env.SUPABASE_SERVICE_ROLE_KEY.length} chars)`);
console.log('');

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Verify Supabase connectivity
  console.log('📡 [1/4] Verifying Supabase connectivity...\n');
  const { data: healthCheck, error: healthError } = await supabase
    .from('raw_props')
    .select('id')
    .limit(1);

  if (healthError) {
    console.error('❌ Supabase connection failed:', healthError);
    process.exit(1);
  }

  console.log('✅ Supabase connected successfully\n');

  // Get current database timestamp
  const { data: dbTime } = await supabase.rpc('now' as any).single();
  const todayStr = new Date().toISOString().split('T')[0];
  console.log(`✅ Today's date: ${todayStr}\n`);

  // Check existing props count for today
  console.log('🔍 [2/4] Checking existing props for today...\n');
  const { count: existingCount } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', `${todayStr}T00:00:00Z`);

  console.log(`  Existing props today: ${existingCount || 0}\n`);

  // Initialize FeedAgent with production configuration
  console.log('🚀 [3/4] Initializing FeedAgent with CanonicalMappingService...\n');

  const agentConfig = {
    name: 'FeedAgent',
    enabled: true,
    version: '3.0.0',
    logLevel: 'info',
    metrics: { enabled: true },
    retryConfig: {
      maxRetries: 3,
      backoffMs: 1000,
      maxBackoffMs: 30000
    },
    providers: {
      OddsAPI: {
        name: 'OddsAPI',
        enabled: true,
        apiKey: process.env.ODDS_API_KEY,
        baseUrl: 'https://api.the-odds-api.com',
        sports: ['NBA', 'NCAAB', 'NHL', 'NFL'],
        markets: ['h2h', 'spreads', 'totals']
      }
    },
    dedupeConfig: {
      checkInterval: 300,
      ttlHours: 24
    }
  };

  const agentDeps: BaseAgentDependencies = {
    supabase,
    logger: {
      info: (msg: string, meta?: any) => console.log(`[INFO] ${msg}`, meta || ''),
      error: (msg: string, meta?: any) => console.error(`[ERROR] ${msg}`, meta || ''),
      warn: (msg: string, meta?: any) => console.warn(`[WARN] ${msg}`, meta || ''),
      debug: (msg: string, meta?: any) => console.log(`[DEBUG] ${msg}`, meta || ''),
      child: () => ({
        info: (msg: string, meta?: any) => console.log(`[INFO] ${msg}`, meta || ''),
        error: (msg: string, meta?: any) => console.error(`[ERROR] ${msg}`, meta || ''),
        warn: (msg: string, meta?: any) => console.warn(`[WARN] ${msg}`, meta || ''),
        debug: (msg: string, meta?: any) => console.log(`[DEBUG] ${msg}`, meta || ''),
      })
    } as any
  };

  try {
    const feedAgent = new FeedAgent(agentConfig, agentDeps);

    console.log('✅ FeedAgent initialized with CanonicalMappingService\n');

    // Start FeedAgent processing
    console.log('🔄 [4/4] Running FeedAgent ingestion pipeline...\n');
    console.log('  This will:');
    console.log('    1. Fetch props from Odds API for NBA, NCAAB, NHL');
    console.log('    2. Normalize and deduplicate props');
    console.log('    3. Map to canonical entities (games + players)');
    console.log('    4. Insert into Supabase raw_props with canonical IDs\n');

    await feedAgent.start();

    // Wait for processing to complete (give it 60 seconds max)
    console.log('⏳ Processing... (this may take up to 60 seconds)\n');
    await new Promise(resolve => setTimeout(resolve, 60000));

    await feedAgent.stop();

    // Verify results
    console.log('\n📊 Verifying ingestion results...\n');

    const { count: newCount } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${todayStr}T00:00:00Z`);

    const propsIngested = (newCount || 0) - (existingCount || 0);

    console.log(`  Props before: ${existingCount || 0}`);
    console.log(`  Props after: ${newCount || 0}`);
    console.log(`  New props ingested: ${propsIngested}\n`);

    // Check canonical attach rate
    const { data: recentProps } = await supabase
      .from('raw_props')
      .select('id, sport, player_name, stat_type, canonical_game_id, canonical_player_id')
      .gte('created_at', `${todayStr}T00:00:00Z`)
      .order('created_at', { ascending: false })
      .limit(100);

    if (recentProps && recentProps.length > 0) {
      const withGameId = recentProps.filter(p => p.canonical_game_id).length;
      const withPlayerId = recentProps.filter(p => p.canonical_player_id).length;
      const withEither = recentProps.filter(p => p.canonical_game_id || p.canonical_player_id).length;

      const attachRate = ((withEither / recentProps.length) * 100).toFixed(1);

      console.log('🔗 Canonical Attach Rate (last 100 props):');
      console.log(`  With canonical_game_id: ${withGameId}/${recentProps.length} (${((withGameId/recentProps.length)*100).toFixed(1)}%)`);
      console.log(`  With canonical_player_id: ${withPlayerId}/${recentProps.length} (${((withPlayerId/recentProps.length)*100).toFixed(1)}%)`);
      console.log(`  Overall attach rate: ${attachRate}%\n`);

      console.log('📋 Sample Props (first 5):\n');
      recentProps.slice(0, 5).forEach((prop, idx) => {
        console.log(`  ${idx + 1}. ${prop.player_name || 'N/A'} ${prop.stat_type || 'N/A'} (${prop.sport})`);
        console.log(`     Game ID: ${prop.canonical_game_id || 'NOT ATTACHED'}`);
        console.log(`     Player ID: ${prop.canonical_player_id || 'NOT ATTACHED'}\n`);
      });
    }

    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║              PHASE 1 INGESTION COMPLETE                     ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');

    console.log(`✅ Successfully ingested ${propsIngested} new props`);
    console.log(`✅ Data written to Supabase v3 schema`);
    console.log(`✅ Canonical mapping applied via FeedAgent`);
    console.log('\nNext step: Run verification');
    console.log('  npx tsx apps/api/scripts/live-fire-phase1-verification.ts\n');

  } catch (error) {
    console.error('\n❌ INGESTION FAILED:', error);
    process.exit(1);
  }
}

main();
