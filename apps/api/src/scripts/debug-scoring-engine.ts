#!/usr/bin/env tsx
/**
 * DEBUG SCORING ENGINE
 * Investigate why all scores are identical
 */

import { createClient } from '@supabase/supabase-js';
import { Enhanced45FactorEngine } from '../agents/ScoringAgent/scoring/Enhanced45FactorEngine';
import { FeatureStoreIntegration } from '../agents/ScoringAgent/scoring/FeatureStoreIntegration';
import { MaterialChangeDetector } from '../agents/ScoringAgent/scoring/MaterialChangeDetector';
import { FeatureStoreService } from '../services/FeatureStoreService';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function debugScoring() {
  console.log('🔍 DEBUGGING SCORING ENGINE');
  console.log('='.repeat(80));

  // Get a sample market prop
  const { data: sampleProps } = await supabase
    .from('market_props')
    .select('*')
    .eq('sport', 'NFL')
    .gte('game_date', '2025-10-12')
    .ilike('market', 'player%')
    .limit(5);

  console.log(`\nSample market_props (${sampleProps?.length || 0} props):\n`);

  if (!sampleProps || sampleProps.length === 0) {
    console.log('❌ No sample props found');
    return;
  }

  // Display sample props
  sampleProps.forEach((prop, i) => {
    console.log(`${i + 1}. ${prop.player_name} - ${prop.market}`);
    console.log(`   Line: ${prop.line}, Odds: ${prop.odds}`);
    console.log(`   Sport: ${prop.sport}, Game: ${prop.game_date}`);
    console.log('');
  });

  // Test scoring one prop
  console.log('Testing Enhanced45FactorEngine on first prop...\n');
  const testProp = sampleProps[0];

  try {
    // ✅ FIX: Create FeatureStoreService instead of passing supabase directly
    const featureStoreService = new FeatureStoreService();
    const featureStore = new FeatureStoreIntegration(featureStoreService);
    const changeDetector = new MaterialChangeDetector(featureStore);
    const engine = new Enhanced45FactorEngine(featureStore, changeDetector);

    const features = {
      propId: testProp.id,
      gameId: `test-game-${testProp.sport}`,
      date: testProp.game_date,
      sport: testProp.sport,
      league: testProp.sport,
      player: testProp.player_name,
      marketType: testProp.market,
      odds: testProp.odds,
      market: {
        type: testProp.market,
        odds: testProp.odds,
        line: testProp.line
      },
      line: testProp.line,
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
        bookmaker: testProp.bookmaker_key,
        team: testProp.team,
        opponent: testProp.opponent
      }
    };

    console.log('Calling engine.calculate45FactorScore()...\n');
    const result = await engine.calculate45FactorScore(features);

    console.log('✅ Scoring Result:');
    console.log(`  Total Score: ${result.totalScore}`);
    console.log(`  Tier: ${result.tier}`);
    console.log(`  Confidence: ${result.confidence}`);
    console.log(`  Kelly Fraction: ${result.kellyFraction}`);
    console.log(`  Processing Time: ${result.processingTimeMs}ms`);

    console.log('\n  Component Scores:');
    console.log(`    Market: ${result.marketScore}`);
    console.log(`    Player: ${result.playerScore}`);
    console.log(`    Matchup: ${result.matchupScore}`);
    console.log(`    Price: ${result.priceScore}`);
    console.log(`    Meta: ${result.metaScore}`);

    console.log('\n  Factor Scores (sample):');
    const factorKeys = Object.keys(result.factorScores || {});
    factorKeys.slice(0, 10).forEach(key => {
      console.log(`    ${key}: ${result.factorScores[key]}`);
    });

    // Count how many factors are at default values
    const factorValues = Object.values(result.factorScores || {}).filter(v => v !== null);
    const at50 = factorValues.filter(v => v === 50).length;
    const at100 = factorValues.filter(v => v === 100).length;
    const at0 = factorValues.filter(v => v === 0).length;
    const unique = new Set(factorValues).size;

    console.log('\n📊 Factor Analysis:');
    console.log(`  Total factors: ${factorValues.length}`);
    console.log(`  At 50 (default): ${at50} (${(at50/factorValues.length*100).toFixed(1)}%)`);
    console.log(`  At 100: ${at100}`);
    console.log(`  At 0: ${at0}`);
    console.log(`  Unique values: ${unique}`);

    if (at50 > factorValues.length * 0.5) {
      console.log('\n❌ ISSUE: >50% of factors are at default value (50)');
      console.log('This indicates the feature store is not providing real data');
    }

    // Test scoring another prop to see if score changes
    console.log('\n\nTesting second prop to check for score variation...\n');
    const testProp2 = sampleProps[1];
    const features2 = { ...features, propId: testProp2.id, player: testProp2.player_name };
    const result2 = await engine.calculate45FactorScore(features2);

    console.log(`Prop 1 Score: ${result.totalScore}`);
    console.log(`Prop 2 Score: ${result2.totalScore}`);

    if (result.totalScore === result2.totalScore) {
      console.log('\n❌ CRITICAL: Both props have identical scores!');
      console.log('This proves scoring engine is using hardcoded/default values');
    } else {
      console.log('\n✅ Scores vary - engine is calculating properly');
    }

  } catch (error) {
    console.error('❌ Scoring Error:', error);
    if (error instanceof Error) {
      console.error('Stack:', error.stack);
    }
  }

  console.log('\n' + '='.repeat(80));
}

debugScoring().catch(console.error);
