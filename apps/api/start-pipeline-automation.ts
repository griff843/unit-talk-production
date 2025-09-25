#!/usr/bin/env node
/**
 * Start Complete Pipeline Automation
 * This script starts the orchestrator and sets up continuous processing
 */

import { pipelineOrchestrator } from './src/orchestration/PipelineOrchestrator';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

async function startPipelineAutomation() {
  console.log('🚀 STARTING COMPLETE PIPELINE AUTOMATION');
  console.log('================================================================================');
  console.log('📋 This will:');
  console.log('   • Monitor raw_props table continuously');
  console.log('   • Process props through Enhanced45FactorEngine');
  console.log('   • Promote high-quality picks to unified_picks');
  console.log('   • Run every 30 seconds automatically');
  console.log('================================================================================\n');

  try {
    // Initialize orchestrator
    const initialized = await pipelineOrchestrator.initialize();
    if (!initialized) {
      throw new Error('Failed to initialize orchestrator');
    }

    // Start automated processing
    await pipelineOrchestrator.start();

    console.log('✅ Pipeline automation started successfully!\n');

    // Set up OddsAPI data fetch (runs every 5 minutes) - disabled in test env
    if (process.env.NODE_ENV !== 'test') setInterval(async () => {
      try {
        console.log('🎲 Fetching fresh data from OddsAPI...');

        // Get sports with active games
        const sports = ['americanfootball_nfl', 'basketball_nba', 'baseball_mlb', 'icehockey_nhl'];

        for (const sport of sports) {
          try {
            const response = await fetch(
              `https://api.the-odds-api.com/v4/sports/${sport}/odds?apiKey=${process.env.ODDS_API_KEY}&regions=us&markets=player_props&oddsFormat=american`
            );

            if (!response.ok) {
              console.log(`⚠️ ${sport}: ${response.status} ${response.statusText}`);
              continue;
            }

            const data = await response.json();
            console.log(`✅ ${sport}: Fetched ${data.length} games`);

            // Process and store props
            for (const game of data) {
              for (const bookmaker of game.bookmakers || []) {
                for (const market of bookmaker.markets || []) {
                  if (market.key.includes('player')) {
                    for (const outcome of market.outcomes || []) {
                      // Insert into raw_props
                      await supabase
                        .from('raw_props')
                        .upsert({
                          sport: sport.split('_')[0].toUpperCase(),
                          player_name: outcome.name,
                          stat_type: market.key,
                          line: outcome.point || 0,
                          over_odds: outcome.price,
                          status: 'pending',
                          created_at: new Date().toISOString()
                        }, {
                          onConflict: 'sport,player_name,stat_type,line'
                        });
                    }
                  }
                }
              }
            }

          } catch (err) {
            console.error(`❌ Error fetching ${sport}:`, err);
          }
        }

        // Check remaining quota
        const quotaResponse = await fetch(
          `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds?apiKey=${process.env.ODDS_API_KEY}&regions=us&markets=h2h`
        );
        const remaining = quotaResponse.headers.get('x-requests-remaining');
        const used = quotaResponse.headers.get('x-requests-used');
        console.log(`📊 API Quota: ${used} used, ${remaining} remaining`);

      } catch (error) {
        console.error('❌ OddsAPI fetch error:', error);
      }
    }, 300000); // Every 5 minutes

    // Monitor pipeline health - disabled in test env
    if (process.env.NODE_ENV !== 'test') setInterval(async () => {
      const { data: stats } = await supabase
        .from('raw_props')
        .select('status, COUNT(*)', { count: 'exact' })
        .in('status', ['pending', 'processed']);

      const pending = stats?.find(s => s.status === 'pending')?.count || 0;
      const processed = stats?.find(s => s.status === 'processed')?.count || 0;

      const { count: picks } = await supabase
        .from('unified_picks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', 'pipeline-orchestrator');

      console.log(`📈 Pipeline Status: ${pending} pending, ${processed} processed, ${picks} picks generated`);
    }, 60000); // Every minute

    // Keep process running
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down pipeline automation...');
      await pipelineOrchestrator.stop();
      process.exit(0);
    });

    // Keep alive - disabled in test env
    if (process.env.NODE_ENV !== 'test') setInterval(() => {}, 1000);

  } catch (error) {
    console.error('❌ Failed to start automation:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  startPipelineAutomation();
}