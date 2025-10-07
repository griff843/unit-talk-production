#!/usr/bin/env tsx
/**
 * Auto-Score Market Props (Continuous Loop)
 *
 * Runs the Enhanced45FactorEngine scoring continuously
 * Checks for unscored props every 30 seconds
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { Enhanced45FactorEngine } from '../agents/ScoringAgent/scoring/Enhanced45FactorEngine';
import { FeatureStoreIntegration } from '../agents/ScoringAgent/scoring/FeatureStoreIntegration';
import { MaterialChangeDetector } from '../agents/ScoringAgent/scoring/MaterialChangeDetector';
import { GradingFeatureSet } from '../types/GradingFeatureSet';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface MarketProp {
  id: string;
  sport: string;
  market: string;
  selection: string;
  line: number;
  odds: number;
  over_odds?: number;
  under_odds?: number;
  player_name: string;
  game_date: string;
  team?: string;
  opponent?: string;
  bookmaker_key?: string;
  metadata: any;
}

const CHECK_INTERVAL_MS = 30000; // Check every 30 seconds
const BATCH_SIZE = 50; // Score 50 props at a time

let totalScored = 0;
let totalErrors = 0;
let cycleCount = 0;

async function scoringLoop() {
  console.log('🎯 Auto-Scoring Market Props - Enhanced45FactorEngine\n');
  console.log(`Check Interval: ${CHECK_INTERVAL_MS / 1000}s | Batch Size: ${BATCH_SIZE}`);
  console.log('Press Ctrl+C to stop\n');
  console.log('='.repeat(70));

  // Initialize Enhanced45FactorEngine
  const featureStore = new FeatureStoreIntegration(supabase);
  const changeDetector = new MaterialChangeDetector(supabase);
  const engine = new Enhanced45FactorEngine(featureStore, changeDetector);

  while (true) {
    cycleCount++;
    const cycleStart = Date.now();

    try {
      console.log(`\n[Cycle ${cycleCount}] Checking for unscored props...`);

      // Get unscored props using helper function
      const { data: props, error } = await supabase
        .rpc('get_unscored_market_props', { limit_count: BATCH_SIZE });

      if (error) {
        console.error('❌ Error fetching unscored props:', error.message);
        await sleep(CHECK_INTERVAL_MS);
        continue;
      }

      if (!props || props.length === 0) {
        console.log('✅ No props to score - all props up to date');
        await sleep(CHECK_INTERVAL_MS);
        continue;
      }

      console.log(`📥 Found ${props.length} props to score`);

      let batchScored = 0;
      let batchErrors = 0;

      for (const prop of props as MarketProp[]) {
        try {
          // Convert to GradingFeatureSet
          const features: GradingFeatureSet = {
            propId: prop.id,
            gameId: prop.metadata?.game_id || `game-${prop.sport}-${new Date(prop.game_date).toISOString().split('T')[0]}`,
            date: prop.game_date,
            sport: prop.sport,
            league: prop.sport,
            player: prop.player_name,
            marketType: prop.market,
            odds: prop.odds,
            market: {
              type: prop.market,
              odds: prop.odds,
              line: prop.line
            },
            line: prop.line,
            expectedValue: 0,
            lineMovement: 0,
            matchupRating: 50,
            playerForm: 50,
            injuryImpact: 0,
            weatherImpact: 0,
            sharpAction: 0,
            publicAction: 0,
            steamMoves: 0,
            closingLineValue: 0,
            confidence: 0.5,
            dataQuality: 0.7,
            modelAgreement: 0.6,
            metadata: {
              bookmaker: prop.bookmaker_key,
              team: prop.team,
              opponent: prop.opponent,
              over_odds: prop.over_odds,
              under_odds: prop.under_odds,
              ...prop.metadata
            }
          };

          // Score via Enhanced45FactorEngine
          const result = await engine.calculate45FactorScore(features);

          // Calculate edge and prob_win
          const impliedProb = result.totalScore / 100;
          const marketProb = oddsToProb(prop.odds);
          const edge = impliedProb - marketProb;
          const probWin = impliedProb;

          // Write to scored_props (upsert to handle re-scoring)
          const { error: upsertError } = await supabase
            .from('scored_props')
            .upsert({
              prop_ref: prop.id,
              edge,
              prob_win: probWin,
              professional_score: result.totalScore,
              tier: result.tier,
              confidence: result.confidence,
              kelly_fraction: result.kellyFraction,
              clv_pct: 0,
              metadata: {
                sport: prop.sport,
                market: prop.market,
                scoredVia: 'Enhanced45FactorEngine_AutoLoop',
                processingTimeMs: result.processingTimeMs,
                marketScore: result.marketScore,
                playerScore: result.playerScore,
                matchupScore: result.matchupScore,
                priceScore: result.priceScore,
                metaScore: result.metaScore,
                configUsed: result.configUsed,
                version: result.version
              },
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'prop_ref'
            });

          if (upsertError) {
            console.error(`  ❌ Error upserting ${prop.id}:`, upsertError.message);
            batchErrors++;
          } else {
            batchScored++;
          }
        } catch (err) {
          batchErrors++;
          console.error(`  ❌ Error scoring ${prop.id}:`, err instanceof Error ? err.message : 'Unknown');
        }
      }

      totalScored += batchScored;
      totalErrors += batchErrors;

      const cycleDuration = Date.now() - cycleStart;

      console.log(`✅ Cycle complete: ${batchScored} scored, ${batchErrors} errors (${cycleDuration}ms)`);
      console.log(`📊 Total: ${totalScored} scored, ${totalErrors} errors across ${cycleCount} cycles`);

      // Wait before next check
      await sleep(CHECK_INTERVAL_MS);
    } catch (err) {
      console.error('❌ Error in scoring loop:', err);
      await sleep(CHECK_INTERVAL_MS);
    }
  }
}

function oddsToProb(odds: number): number {
  if (odds > 0) {
    return 100 / (odds + 100);
  } else {
    return Math.abs(odds) / (Math.abs(odds) + 100);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n' + '='.repeat(70));
  console.log('🛑 Shutting down auto-scoring loop...');
  console.log(`📊 Final Stats:`);
  console.log(`  Total Scored: ${totalScored}`);
  console.log(`  Total Errors: ${totalErrors}`);
  console.log(`  Total Cycles: ${cycleCount}`);
  console.log('='.repeat(70));
  process.exit(0);
});

scoringLoop().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
