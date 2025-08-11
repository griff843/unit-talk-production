#!/usr/bin/env npx tsx

/**
 * Check Current Grading Scores
 * 
 * Check the current state of grading scores after our NaN fixes
 * to see if we're getting valid scores and what the professional_score distribution looks like
 */

import { config } from 'dotenv';

import { supabaseClient } from '../services/supabaseClient';

config();

async function checkCurrentGradingScores() {
  console.log('📊 CHECKING CURRENT GRADING SCORES');
  console.log('===================================');
  
  try {
    // 1. Check raw_props table for edge_score distribution
    console.log('\n1. RAW_PROPS EDGE_SCORE DISTRIBUTION:');
    const { data: edgeScoreStats } = await supabaseClient
      .from('raw_props')
      .select('edge_score, sport')
      .not('edge_score', 'is', null);
    
    if (edgeScoreStats) {
      console.log(`Total props with edge_score: ${edgeScoreStats.length}`);
      
      // Group by sport
      const sportBreakdown = edgeScoreStats.reduce((acc, prop) => {
        if (!acc[prop.sport]) acc[prop.sport] = [];
        acc[prop.sport].push(prop.edge_score);
        return acc;
      }, {} as Record<string, number[]>);
      
      for (const [sport, scores] of Object.entries(sportBreakdown)) {
        const uniqueScores = [...new Set(scores)];
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        console.log(`  ${sport}: ${scores.length} props, avg: ${avgScore.toFixed(2)}, unique scores: ${uniqueScores.length}`);
        console.log(`    Score range: ${Math.min(...scores)} - ${Math.max(...scores)}`);
        
        if (uniqueScores.length <= 5) {
          console.log(`    Values: [${uniqueScores.join(', ')}]`);
        }
      }
    }
    
    // 2. Check recent grading activity
    console.log('\n2. RECENT GRADING ACTIVITY:');
    const { data: recentProps } = await supabaseClient
      .from('raw_props')
      .select('id, player_name, sport, stat_type, edge_score, tier, created_at')
      .not('edge_score', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (recentProps) {
      console.log('Recent 10 grading_status props:');
      recentProps.forEach(prop => {
        console.log(`  ${prop.sport} | ${prop.player_name} | ${prop.stat_type} | Score: ${prop.edge_score} | Tier: ${prop.tier}`);
      });
    }
    
    // 3. Check for NaN or invalid scores
    console.log('\n3. INVALID SCORES CHECK:');
    const { data: invalidScores } = await supabaseClient
      .from('raw_props')
      .select('id, player_name, sport, edge_score, tier')
      .or('edge_score.is.null,tier.is.null')
      .limit(5);
    
    if (invalidScores) {
      console.log(`Props with null scores: ${invalidScores.length}`);
      invalidScores.forEach(prop => {
        console.log(`  ${prop.sport} | ${prop.player_name} | Score: ${prop.edge_score} | Tier: ${prop.tier}`);
      });
    }
    
    // 4. Check tier distribution
    console.log('\n4. TIER DISTRIBUTION:');
    const { data: tierStats } = await supabaseClient
      .from('raw_props')
      .select('tier, sport')
      .not('tier', 'is', null);
    
    if (tierStats) {
      const tierBreakdown = tierStats.reduce((acc, prop) => {
        const key = `${prop.sport}-${prop.tier}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log('Tier breakdown by sport:');
      Object.entries(tierBreakdown).forEach(([key, count]) => {
        console.log(`  ${key}: ${count}`);
      });
    }
    
    // 5. Check promotion readiness
    console.log('\n5. PROMOTION READINESS:');
    const { data: promotableProps } = await supabaseClient
      .from('raw_props')
      .select('sport, tier, edge_score')
      .not('edge_score', 'is', null)
      .gt('edge_score', 0); // Props with positive edge
    
    if (promotableProps) {
      console.log(`Props with positive edge: ${promotableProps.length}`);
      
      const sportEdgeBreakdown = promotableProps.reduce((acc, prop) => {
        if (!acc[prop.sport]) acc[prop.sport] = { count: 0, avgEdge: 0, tiers: {} };
        acc[prop.sport].count++;
        acc[prop.sport].avgEdge += prop.edge_score;
        acc[prop.sport].tiers[prop.tier] = (acc[prop.sport].tiers[prop.tier] || 0) + 1;
        return acc;
      }, {} as Record<string, { count: number, avgEdge: number, tiers: Record<string, number> }>);
      
      for (const [sport, data] of Object.entries(sportEdgeBreakdown)) {
        data.avgEdge = data.avgEdge / data.count;
        console.log(`  ${sport}: ${data.count} props, avg edge: ${data.avgEdge.toFixed(2)}`);
        console.log(`    Tiers: ${Object.entries(data.tiers).map(([tier, count]) => `${tier}:${count}`).join(', ')}`);
      }
    }
    
    // 6. Sample a few props to test grading directly
    console.log('\n6. DIRECT GRADING TEST:');
    const { data: testProps } = await supabaseClient
      .from('raw_props')
      .select('*')
      .limit(3);
    
    if (testProps) {
      for (const prop of testProps) {
        console.log(`Testing ${prop.sport} prop: ${prop.player_name} (${prop.stat_type})`);
        console.log(`  Current scores - Edge: ${prop.edge_score}, Tier: ${prop.tier}`);
        console.log(`  Expected Value: ${prop.expected_value}`);
        console.log(`  Sharp Money: ${prop.sharp_money}`);
        
        // Check for potential issues
        const hasValidEV = !isNaN(parseFloat(prop.expected_value));
        const hasValidSharpMoney = !isNaN(parseFloat(prop.sharp_money));
        console.log(`  Data quality - EV: ${hasValidEV}, Sharp Money: ${hasValidSharpMoney}`);
      }
    }
    
    console.log('\n✅ Current grading scores analysis completed');
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
  }
}

// Run the check
if (require.main === module) {
  checkCurrentGradingScores()
    .then(() => {
      console.log('\n📊 Analysis completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Analysis failed:', error);
      process.exit(1);
    });
}

export { checkCurrentGradingScores };