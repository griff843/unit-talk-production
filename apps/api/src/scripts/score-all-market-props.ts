#!/usr/bin/env tsx
/**
 * Score all unscored market_props
 * Uses Enhanced45FactorEngine with fallback features
 */

import { createClient } from '@supabase/supabase-js';
import { Enhanced45FactorEngine } from '../agents/ScoringAgent/scoring/Enhanced45FactorEngine';
import { FeatureStoreIntegration } from '../agents/ScoringAgent/scoring/FeatureStoreIntegration';
import { MaterialChangeDetector } from '../agents/ScoringAgent/scoring/MaterialChangeDetector';
import { FeatureStoreService } from '../services/FeatureStoreService';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { randomUUID } from 'crypto';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function scoreAllProps() {
  console.log('🎯 SCORING ALL MARKET PROPS');
  console.log('='.repeat(80));

  // Initialize scoring engine
  console.log('\n⚙️  Initializing Enhanced45FactorEngine...');
  const featureStoreService = new FeatureStoreService();
  const featureStore = new FeatureStoreIntegration(featureStoreService);
  const changeDetector = new MaterialChangeDetector(featureStore);
  const engine = new Enhanced45FactorEngine(featureStore, changeDetector);
  console.log('✅ Scoring engine initialized');

  // Fetch unscored props
  console.log('\n📊 Fetching unscored market_props...');
  const { data: unscoredProps, error } = await supabase
    .from('market_props')
    .select('*')
    .is('scored_at', null)
    .order('game_date', { ascending: true })
    .limit(1000); // Score up to 1000 props

  if (error) {
    console.error('❌ Error fetching props:', error.message);
    return;
  }

  if (!unscoredProps || unscoredProps.length === 0) {
    console.log('✅ No unscored props found!');
    return;
  }

  console.log(`📦 Found ${unscoredProps.length} unscored props`);

  // Score props in batches
  let scored = 0;
  let errors = 0;
  const batchSize = 50;

  for (let i = 0; i < unscoredProps.length; i += batchSize) {
    const batch = unscoredProps.slice(i, i + batchSize);
    console.log(`\n🔄 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(unscoredProps.length/batchSize)}...`);

    for (const prop of batch) {
      try {
        // Build features object for scoring
        const features = {
          propId: prop.id,
          gameId: `game-${prop.external_game_id || 'unknown'}`,
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
            opponent: prop.opponent
          }
        };

        // Score with Enhanced45FactorEngine
        const result = await engine.calculate45FactorScore(features);

        // Insert into scored_props
        const scoredProp = {
          id: randomUUID(),
          prop_ref: prop.id,
          professional_score: result.totalScore,
          tier: result.tier,
          edge: result.expectedValue,
          prob_win: result.confidence,
          confidence: result.confidence,
          kelly_fraction: result.kellyFraction,
          clv_pct: 0, // Not yet calculated
          metadata: {
            marketScore: result.marketScore,
            playerScore: result.playerScore,
            matchupScore: result.matchupScore,
            priceScore: result.priceScore,
            metaScore: result.metaScore,
            processingTimeMs: result.processingTimeMs,
            dataQuality: result.dataQuality
          }
        };

        const { error: insertError } = await supabase
          .from('scored_props')
          .insert(scoredProp);

        if (insertError && insertError.code !== '23505') { // Ignore duplicates
          console.error(`  ❌ Error scoring prop ${prop.id}:`, insertError.message);
          errors++;
        } else {
          scored++;

          // Mark prop as scored
          await supabase
            .from('market_props')
            .update({ scored_at: new Date().toISOString() })
            .eq('id', prop.id);
        }

      } catch (err) {
        errors++;
        if (errors <= 5) {
          console.error(`  ❌ Error:`, err instanceof Error ? err.message : 'Unknown');
        }
      }
    }

    console.log(`  ✅ Batch complete: ${scored} scored, ${errors} errors`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 SCORING SUMMARY:');
  console.log(`  ✅ Scored: ${scored} props`);
  console.log(`  ❌ Errors: ${errors}`);
  console.log(`  📈 Success Rate: ${((scored / (scored + errors)) * 100).toFixed(1)}%`);

  // Check tier distribution
  const { data: tierData } = await supabase
    .from('scored_props')
    .select('tier');

  if (tierData) {
    const tiers = tierData.reduce((acc, p) => {
      acc[p.tier] = (acc[p.tier] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('\n🏆 TIER DISTRIBUTION:');
    Object.entries(tiers).sort().forEach(([tier, count]) => {
      console.log(`  ${tier}: ${count} props`);
    });
  }

  console.log('\n✅ SCORING COMPLETE');
  console.log('🎯 Next: Run verify-gates script to check system health');
  console.log('='.repeat(80));
}

scoreAllProps().catch(console.error);
