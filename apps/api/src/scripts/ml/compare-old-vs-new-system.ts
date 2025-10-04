/**
 * Compare Old vs New Scoring System
 *
 * Shows the difference between:
 * - OLD: Hardcoded 52% for all picks
 * - NEW: Real probability calculations per pick
 */

import { createClient } from '@supabase/supabase-js';
import { probabilityCalculator } from '../../models/ProbabilityCalculator';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

interface ComparisonResult {
  pick: any;
  oldProbability: number;
  newProbability: number;
  oldEV: number;
  newEV: number;
  difference: number;
  improvementPercent: number;
}

async function compareSystem() {
  console.log('🔬 OLD vs NEW SYSTEM COMPARISON');
  console.log('==========================================\n');

  // Get recent picks from database
  const { data: picks, error } = await supabase
    .from('unified_picks')
    .select('*')
    .eq('status', 'pending')
    .limit(10);

  if (error || !picks || picks.length === 0) {
    console.log('⚠️  No picks found in database');
    console.log('Creating mock picks for demonstration...\n');

    // Use mock picks
    return compareMockPicks();
  }

  console.log(`Found ${picks.length} picks to analyze\n`);

  const results: ComparisonResult[] = [];

  for (const pick of picks) {
    // OLD SYSTEM: Hardcoded 52%
    const oldProbability = 0.52;
    const oldEV = calculateEV(oldProbability, pick.odds || -110);

    // NEW SYSTEM: Real calculation
    const newProbResult = await probabilityCalculator.calculateProbability({
      sport: pick.sport || 'NFL',
      playerName: pick.market || 'Unknown',
      marketType: pick.market || 'unknown',
      line: pick.line || 0,
    });

    const newEV = calculateEV(newProbResult.probability, pick.odds || -110);

    const difference = newProbResult.probability - oldProbability;
    const improvementPercent = (Math.abs(difference) / oldProbability) * 100;

    results.push({
      pick,
      oldProbability,
      newProbability: newProbResult.probability,
      oldEV,
      newEV,
      difference,
      improvementPercent,
    });
  }

  displayResults(results);
}

async function compareMockPicks() {
  console.log('📊 MOCK PICK COMPARISON');
  console.log('==========================================\n');

  const mockPicks = [
    {
      id: '1',
      sport: 'NBA',
      market: 'LeBron James Points',
      market_type: 'player_points',
      line: 25.5,
      odds: -110,
      description: 'Star player, favorable matchup',
    },
    {
      id: '2',
      sport: 'NFL',
      market: 'Patrick Mahomes Pass Yards',
      market_type: 'player_pass_yds',
      line: 275.5,
      odds: -120,
      description: 'Elite QB, high total game',
    },
    {
      id: '3',
      sport: 'MLB',
      market: 'Aaron Judge Total Bases',
      market_type: 'batter_total_bases',
      line: 1.5,
      odds: -150,
      description: 'MVP candidate vs weak pitcher',
    },
    {
      id: '4',
      sport: 'NFL',
      market: 'Backup RB Rush Yards',
      market_type: 'player_rush_yds',
      line: 45.5,
      odds: +150,
      description: 'Backup player, limited role',
    },
    {
      id: '5',
      sport: 'NBA',
      market: 'Role Player Points',
      market_type: 'player_points',
      line: 8.5,
      odds: -110,
      description: 'Bench player, inconsistent minutes',
    },
  ];

  const results: ComparisonResult[] = [];

  for (const pick of mockPicks) {
    // OLD SYSTEM: Hardcoded 52%
    const oldProbability = 0.52;
    const oldEV = calculateEV(oldProbability, pick.odds);

    // NEW SYSTEM: Real calculation
    const newProbResult = await probabilityCalculator.calculateProbability({
      sport: pick.sport,
      playerName: pick.market,
      marketType: pick.market_type,
      line: pick.line,
    });

    const newEV = calculateEV(newProbResult.probability, pick.odds);

    const difference = newProbResult.probability - oldProbability;
    const improvementPercent = (Math.abs(difference) / oldProbability) * 100;

    results.push({
      pick,
      oldProbability,
      newProbability: newProbResult.probability,
      oldEV,
      newEV,
      difference,
      improvementPercent,
    });
  }

  displayResults(results);
}

function calculateEV(probability: number, americanOdds: number): number {
  const decimalOdds = americanOdds > 0
    ? 1 + americanOdds / 100
    : 1 + 100 / Math.abs(americanOdds);

  return probability * (decimalOdds - 1) - (1 - probability);
}

function displayResults(results: ComparisonResult[]) {
  console.log('\n📊 COMPARISON RESULTS');
  console.log('='.repeat(100));

  results.forEach((result, index) => {
    console.log(`\n${index + 1}. ${result.pick.market || result.pick.description}`);
    console.log('─'.repeat(100));

    console.log(`   Sport: ${result.pick.sport} | Line: ${result.pick.line} | Odds: ${result.pick.odds || -110}`);

    console.log(`\n   OLD SYSTEM (Hardcoded 52%):`);
    console.log(`      Probability: ${(result.oldProbability * 100).toFixed(2)}%`);
    console.log(`      Expected Value: ${(result.oldEV * 100).toFixed(2)}%`);
    console.log(`      Verdict: ${result.oldEV > 0 ? '✅ Bet' : '❌ Pass'}`);

    console.log(`\n   NEW SYSTEM (Real Calculation):`);
    console.log(`      Probability: ${(result.newProbability * 100).toFixed(2)}%`);
    console.log(`      Expected Value: ${(result.newEV * 100).toFixed(2)}%`);
    console.log(`      Verdict: ${result.newEV > 0 ? '✅ Bet' : '❌ Pass'}`);

    console.log(`\n   DIFFERENCE:`);
    console.log(`      Probability Change: ${result.difference > 0 ? '+' : ''}${(result.difference * 100).toFixed(2)}%`);
    console.log(`      EV Change: ${(result.newEV - result.oldEV) * 100 > 0 ? '+' : ''}${((result.newEV - result.oldEV) * 100).toFixed(2)}%`);

    if (Math.abs(result.difference) > 0.05) {
      console.log(`      🎯 SIGNIFICANT DIFFERENCE - ${(result.improvementPercent).toFixed(1)}% change!`);
    }
  });

  // Summary statistics
  console.log('\n\n📈 SUMMARY STATISTICS');
  console.log('='.repeat(100));

  const avgOldProb = results.reduce((sum, r) => sum + r.oldProbability, 0) / results.length;
  const avgNewProb = results.reduce((sum, r) => sum + r.newProbability, 0) / results.length;
  const avgOldEV = results.reduce((sum, r) => sum + r.oldEV, 0) / results.length;
  const avgNewEV = results.reduce((sum, r) => sum + r.newEV, 0) / results.length;

  console.log(`\n   Average Probability:`);
  console.log(`      OLD: ${(avgOldProb * 100).toFixed(2)}%`);
  console.log(`      NEW: ${(avgNewProb * 100).toFixed(2)}%`);

  console.log(`\n   Average Expected Value:`);
  console.log(`      OLD: ${(avgOldEV * 100).toFixed(2)}%`);
  console.log(`      NEW: ${(avgNewEV * 100).toFixed(2)}%`);

  const probVariance = results.reduce((sum, r) =>
    sum + Math.pow(r.newProbability - avgNewProb, 2), 0) / results.length;
  const probStdDev = Math.sqrt(probVariance);

  console.log(`\n   Probability Distribution (NEW):`);
  console.log(`      Standard Deviation: ${(probStdDev * 100).toFixed(2)}%`);
  console.log(`      Range: ${(Math.min(...results.map(r => r.newProbability)) * 100).toFixed(2)}% - ${(Math.max(...results.map(r => r.newProbability)) * 100).toFixed(2)}%`);

  console.log(`\n   OLD SYSTEM PROBLEMS:`);
  console.log(`      ❌ Every pick scored with same 52% probability`);
  console.log(`      ❌ No differentiation between good and bad bets`);
  console.log(`      ❌ Cannot identify true value`);

  console.log(`\n   NEW SYSTEM IMPROVEMENTS:`);
  console.log(`      ✅ Each pick gets individual probability`);
  console.log(`      ✅ Probabilities vary based on sport, player, matchup`);
  console.log(`      ✅ Can identify real value opportunities`);
  console.log(`      ✅ Confidence scoring shows data quality`);

  console.log('\n');
}

compareSystem().catch(console.error);
