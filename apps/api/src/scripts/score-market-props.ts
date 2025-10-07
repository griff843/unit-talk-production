#!/usr/bin/env tsx
/**
 * Score market_props using REAL Enhanced45Factor Engine
 * Writes results to scored_props table
 *
 * NO MORE MOCK DATA - This uses the actual 45-factor professional scoring system
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

async function scoreMarketPropsEnhanced() {
  console.log('🎯 Scoring market_props through REAL Enhanced45Factor Engine...\n');

  // Initialize Enhanced45FactorEngine
  const featureStore = new FeatureStoreIntegration(supabase);
  const changeDetector = new MaterialChangeDetector(supabase);
  const engine = new Enhanced45FactorEngine(featureStore, changeDetector);

  // Get unscored props using helper function
  const { data: props, error } = await supabase
    .rpc('get_unscored_market_props', { limit_count: 100 });

  if (error) {
    console.error('❌ Error fetching unscored market_props:', error.message);
    return;
  }

  console.log(`Found ${props?.length || 0} unscored props\n`);

  if (!props || props.length === 0) {
    console.log('✅ No props to score - all props are already scored');
    return;
  }

  let scored = 0;
  let errors = 0;

  for (const prop of props as MarketProp[]) {
    try {
      // Convert market_prop to GradingFeatureSet format
      const features: GradingFeatureSet = {
        propId: prop.id,
        gameId: prop.metadata?.game_id || `game-${prop.sport}-${new Date(prop.game_date).toISOString().split('T')[0]}`,
        date: prop.game_date,
        sport: prop.sport,
        league: prop.sport, // Use sport as league for now
        player: prop.player_name,
        marketType: prop.market,
        odds: prop.odds,
        market: {
          type: prop.market,
          odds: prop.odds,
          line: prop.line
        },
        line: prop.line,

        // Initialize baseline features (Enhanced45Factor will compute these)
        expectedValue: 0,
        lineMovement: 0,
        matchupRating: 50,
        playerForm: 50,
        injuryImpact: 0,
        weatherImpact: 0,

        // Sharp metrics (will be computed by engine)
        sharpAction: 0,
        publicAction: 0,
        steamMoves: 0,
        closingLineValue: 0,

        // Confidence metrics
        confidence: 0.5,
        dataQuality: 0.7,
        modelAgreement: 0.6,

        // Additional context
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
      console.log(`  Scoring ${prop.player_name || prop.selection} (${prop.sport} ${prop.market})...`);

      const result = await engine.calculate45FactorScore(features);

      // Calculate edge and prob_win from totalScore
      // totalScore is 0-100, convert to probability and edge
      const impliedProb = result.totalScore / 100;
      const marketProb = oddsToProb(prop.odds);
      const edge = impliedProb - marketProb;
      const probWin = impliedProb;

      // Write to scored_props
      const { error: insertError } = await supabase
        .from('scored_props')
        .insert({
          prop_ref: prop.id,
          edge: edge,
          prob_win: probWin,
          professional_score: result.totalScore,
          tier: result.tier,
          confidence: result.confidence,
          kelly_fraction: result.kellyFraction,
          clv_pct: 0, // Will be updated by CLV tracking
          metadata: {
            sport: prop.sport,
            market: prop.market,
            scoredVia: 'Enhanced45FactorEngine',
            processingTimeMs: result.processingTimeMs,
            marketScore: result.marketScore,
            playerScore: result.playerScore,
            matchupScore: result.matchupScore,
            priceScore: result.priceScore,
            metaScore: result.metaScore,
            factorScores: result.factorScores,
            configUsed: result.configUsed,
            version: result.version
          }
        });

      if (insertError) {
        if (insertError.code === '23505') {
          // Duplicate - update instead
          const { error: updateError } = await supabase
            .from('scored_props')
            .update({
              edge: edge,
              prob_win: probWin,
              professional_score: result.totalScore,
              tier: result.tier,
              confidence: result.confidence,
              kelly_fraction: result.kellyFraction,
              updated_at: new Date().toISOString(),
              metadata: {
                sport: prop.sport,
                market: prop.market,
                scoredVia: 'Enhanced45FactorEngine',
                processingTimeMs: result.processingTimeMs,
                marketScore: result.marketScore,
                playerScore: result.playerScore,
                matchupScore: result.matchupScore,
                priceScore: result.priceScore,
                metaScore: result.metaScore,
                factorScores: result.factorScores,
                configUsed: result.configUsed,
                version: result.version
              }
            })
            .eq('prop_ref', prop.id);

          if (updateError) {
            throw updateError;
          }
        } else {
          throw insertError;
        }
      }

      scored++;

      console.log(`    ✅ Score: ${result.totalScore.toFixed(1)} | Tier: ${result.tier} | Edge: ${(edge * 100).toFixed(2)}% | Conf: ${result.confidence.toFixed(2)}`);

      if (scored % 10 === 0) {
        console.log(`  Progress: ${scored}/${props.length} props scored...\n`);
      }
    } catch (err) {
      errors++;
      console.error(`  ❌ Error scoring prop ${prop.id}:`, err instanceof Error ? err.message : 'Unknown');
      if (errors <= 5) {
        console.error(`     Details:`, err);
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`✅ Scoring complete via Enhanced45FactorEngine!`);
  console.log(`  Scored: ${scored}`);
  console.log(`  Errors: ${errors}`);
  console.log('='.repeat(70));

  // Verify scored_props
  const { count } = await supabase
    .from('scored_props')
    .select('*', { count: 'exact', head: true });

  console.log(`\nTotal scored_props in database: ${count}\n`);

  // Sample scored props
  const { data: sample } = await supabase
    .from('scored_props')
    .select('prop_ref, professional_score, tier, edge, confidence, metadata')
    .order('updated_at', { ascending: false })
    .limit(5);

  console.log('Sample scored_props (most recent):');
  console.log('-'.repeat(70));
  sample?.forEach((row: any) => {
    const processingTime = row.metadata?.processingTimeMs || 'N/A';
    console.log(`${row.prop_ref}`);
    console.log(`  Score: ${row.professional_score} | Tier: ${row.tier} | Edge: ${(row.edge * 100).toFixed(2)}% | Conf: ${row.confidence.toFixed(2)} | Time: ${processingTime}ms`);
    if (row.metadata?.marketScore) {
      console.log(`  Breakdown: Market=${row.metadata.marketScore.toFixed(1)} Player=${row.metadata.playerScore.toFixed(1)} Matchup=${row.metadata.matchupScore.toFixed(1)} Price=${row.metadata.priceScore.toFixed(1)} Meta=${row.metadata.metaScore.toFixed(1)}`);
    }
  });
  console.log('');
}

/**
 * Convert American odds to implied probability
 */
function oddsToProb(odds: number): number {
  if (odds > 0) {
    return 100 / (odds + 100);
  } else {
    return Math.abs(odds) / (Math.abs(odds) + 100);
  }
}

scoreMarketPropsEnhanced().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
