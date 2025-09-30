#!/usr/bin/env npx tsx

/**
 * Data Quality Analysis for raw_props
 * 
 * Analyzes schema mismatches, sport classification issues, and 
 * player vs team prop categorization problems.
 */

import { config } from 'dotenv';

import { supabaseClient } from '../utils/supabaseUtils';
import { Logger } from '../shared/logger';
import { requireSupabase } from '../utils/supabaseUtils';

// Load environment variables
config();

async function analyzeDataQuality() {
  console.log('🔍 RAW_PROPS DATA QUALITY ANALYSIS');
  console.log('===================================');

  const logger = new Logger('analyze-data-quality');

  try {
    // 1. Sample data analysis
    console.log('\n📊 Step 1: Sample Data Analysis...');
    
    const supabaseClient = requireSupabase();
      const { data: sampleData, error: sampleError } = await supabaseClient
      .from('sports_game_odds')
      .select('*')
      .limit(20);

    if (sampleError) {
      throw new Error(`Failed to get sample data: ${sampleError.message}`);
    }

    if (sampleData && sampleData.length > 0) {
      console.log('📋 Table Schema (from sample):');
      const firstRow = sampleData[0];
      Object.entries(firstRow).forEach(([key, value]) => {
        const type = typeof value;
        const sample = value ? String(value).substring(0, 50) : 'null';
        console.log(`  ${key}: ${type} | Example: "${sample}"`);
      });
    }

    // 2. Sport classification analysis
    console.log('\n🏈 Step 2: Sport Classification Issues...');
    
    const supabaseClient = requireSupabase();
      const { data: sportData, error: sportError } = await supabaseClient
      .from('sports_game_odds')
      .select('sport, player_name, stat_type, league, game_date')
      .limit(200);

    if (sportError) {
      console.warn('Could not analyze sport data:', sportError.message);
    } else if (sportData) {
      const sportAnalysis = analyzeSportIssues(sportData);
      
      console.log('🚨 Detected Sport Mismatches:');
      Object.entries(sportAnalysis.mismatches).forEach(([sport, issues]) => {
        console.log(`\n  ${sport.toUpperCase()} Issues:`);
        issues.forEach((issue, index) => {
          if (index < 5) { // Show first 5 examples
            console.log(`    - Player: "${issue.player}" | Stat: "${issue.stat}" | League: "${issue.league}"`);
          }
        });
        if (issues.length > 5) {
          console.log(`    ... and ${issues.length - 5} more issues`);
        }
      });
    }

    // 3. Player vs Team prop analysis
    console.log('\n👤 Step 3: Player vs Team Prop Classification...');
    
    const supabaseClient = requireSupabase();
      const { data: propData, error: propError } = await supabaseClient
      .from('sports_game_odds')
      .select('player_name, stat_type, sport')
      .limit(300);

    if (propError) {
      console.warn('Could not analyze prop data:', propError.message);
    } else if (propData) {
      const propAnalysis = analyzePlayerVsTeamProps(propData);
      
      console.log('📊 Prop Classification Results:');
      console.log(`  👤 Likely Player Props: ${propAnalysis.playerProps.length}`);
      console.log(`  🏈 Likely Team/Game Props: ${propAnalysis.teamProps.length}`);
      console.log(`  ❓ Ambiguous Props: ${propAnalysis.ambiguous.length}`);
      
      console.log('\n🚨 Misclassified Examples:');
      console.log('  Team props in player_name field:');
      propAnalysis.teamProps.slice(0, 5).forEach(prop => {
        console.log(`    - "${prop.player_name}" | ${prop.stat_type} | ${prop.sport}`);
      });
      
      console.log('\n  Ambiguous cases needing review:');
      propAnalysis.ambiguous.slice(0, 5).forEach(prop => {
        console.log(`    - "${prop.player_name}" | ${prop.stat_type} | ${prop.sport}`);
      });
    }

    // 4. Data consistency check
    console.log('\n🔍 Step 4: Data Consistency Issues...');
    
    const supabaseClient = requireSupabase();
      const { data: consistencyData, error: consistencyError } = await supabaseClient
      .from('sports_game_odds')
      .select('sport, player_name, stat_type, over_odds, under_odds, line')
      .not('player_name', 'is', null)
      .limit(100);

    if (consistencyError) {
      console.warn('Could not analyze consistency:', consistencyError.message);
    } else if (consistencyData) {
      const consistencyIssues = analyzeDataConsistency(consistencyData);
      
      console.log('⚠️ Data Consistency Issues:');
      console.log(`  Missing odds: ${consistencyIssues.missingOdds} records`);
      console.log(`  Invalid lines: ${consistencyIssues.invalidLines} records`);
      console.log(`  Empty player names: ${consistencyIssues.emptyPlayers} records`);
      console.log(`  Suspicious stat types: ${consistencyIssues.suspiciousStats.length} unique`);
      
      if (consistencyIssues.suspiciousStats.length > 0) {
        console.log('\n  Suspicious stat types:');
        consistencyIssues.suspiciousStats.slice(0, 10).forEach(stat => {
          console.log(`    - "${stat}"`);
        });
      }
    }

    // 5. Recommendations
    console.log('\n💡 Step 5: Recommendations...');
    console.log('=================');
    
    console.log('\n🏗️ Schema Improvements Needed:');
    console.log('  1. Create separate tables: player_props, team_props, game_props');
    console.log('  2. Add prop_category field: "player", "team", "game"');
    console.log('  3. Standardize sport values: NFL, NBA, MLB, NHL, NCAAF');
    console.log('  4. Add team_name field for team/game props');
    console.log('  5. Validate stat_type against sport-specific allowed values');
    
    console.log('\n🔧 Data Parsing Fixes Needed:');
    console.log('  1. Fix NCAAF games showing as NFL/NBA/NHL');
    console.log('  2. Move team totals from player_name to team_name field');
    console.log('  3. Standardize Over/Under formatting');
    console.log('  4. Validate odds ranges (typically -200 to +500)');
    console.log('  5. Clean up stat_type variations (normalize similar stats)');
    
    console.log('\n📋 Implementation Priority:');
    console.log('  HIGH: Sport classification fix (affects all data)');
    console.log('  HIGH: Player vs Team prop separation');
    console.log('  MEDIUM: Stat type standardization');
    console.log('  MEDIUM: Data validation rules');
    console.log('  LOW: Historical data cleanup');

  } catch (error) {
    console.error('\n❌ Analysis failed:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
  }
}

function analyzeSportIssues(data: any[]): { mismatches: Record<string, any[]> } {
  const mismatches: Record<string, any[]> = {};
  
  data.forEach(row => {
    const sport = row.sport?.toLowerCase() || 'unknown';
    const player = row.player_name || '';
    const stat = row.stat_type || '';
    const league = row.league || '';
    
    // Detect mismatches
    let isMismatch = false;
    
    // NCAAF showing as NFL
    if (sport === 'nfl' && (league?.includes('NCAA') || player.includes('College'))) {
      isMismatch = true;
    }
    
    // Team props in wrong sport
    if ((sport === 'nba' || sport === 'nhl') && (player.includes('Total') || stat.includes('Team'))) {
      isMismatch = true;
    }
    
    // Generic mismatch indicators
    if (sport === 'nfl' && stat?.includes('Goals')) { // Hockey stat in NFL
      isMismatch = true;
    }
    
    if (isMismatch) {
      if (!mismatches[sport]) mismatches[sport] = [];
      mismatches[sport].push({
        player,
        stat,
        league,
        reason: 'Sport classification mismatch'
      });
    }
  });
  
  return { mismatches };
}

function analyzePlayerVsTeamProps(data: any[]): {
  playerProps: any[];
  teamProps: any[];
  ambiguous: any[];
} {
  const playerProps: any[] = [];
  const teamProps: any[] = [];
  const ambiguous: any[] = [];
  
  const teamKeywords = ['total', 'team', 'over', 'under', 'spread', 'moneyline', 'game'];
  const playerKeywords = ['passing', 'rushing', 'receiving', 'points', 'assists', 'rebounds'];
  
  data.forEach(row => {
    const playerName = (row.player_name || '').toLowerCase();
    const statType = (row.stat_type || '').toLowerCase();
    
    const hasTeamKeyword = teamKeywords.some(keyword => 
      playerName.includes(keyword) || statType.includes(keyword)
    );
    
    const hasPlayerKeyword = playerKeywords.some(keyword => 
      statType.includes(keyword)
    );
    
    const looksLikeName = /^[A-Z][a-z]+ [A-Z][a-z]+/.test(row.player_name || '');
    
    if (hasTeamKeyword && !looksLikeName) {
      teamProps.push(row);
    } else if (hasPlayerKeyword && looksLikeName) {
      playerProps.push(row);
    } else {
      ambiguous.push(row);
    }
  });
  
  return { playerProps, teamProps, ambiguous };
}

function analyzeDataConsistency(data: any[]): {
  missingOdds: number;
  invalidLines: number;
  emptyPlayers: number;
  suspiciousStats: string[];
} {
  let missingOdds = 0;
  let invalidLines = 0;
  let emptyPlayers = 0;
  const suspiciousStats: Set<string> = new Set();
  
  data.forEach(row => {
    // Missing odds
    if (!row.over_odds || !row.under_odds) {
      missingOdds++;
    }
    
    // Invalid lines (should be numeric)
    if (row.line && (isNaN(parseFloat(row.line)) || row.line === '')) {
      invalidLines++;
    }
    
    // Empty player names
    if (!row.player_name || row.player_name.trim() === '') {
      emptyPlayers++;
    }
    
    // Suspicious stat types (very long, contains numbers, etc.)
    const stat = row.stat_type || '';
    if (stat.length > 50 || /\d{3,}/.test(stat) || stat.includes('http')) {
      suspiciousStats.add(stat);
    }
  });
  
  return {
    missingOdds,
    invalidLines,
    emptyPlayers,
    suspiciousStats: Array.from(suspiciousStats)
  };
}

// Run the analysis
if (require.main === module) {
  analyzeDataQuality()
    .then(() => {
      console.log('\n✅ Data quality analysis completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Analysis crashed:', error);
      process.exit(1);
    });
}

export { analyzeDataQuality };