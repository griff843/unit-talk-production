#!/usr/bin/env npx tsx

/**
 * Analyze Prop Data Quality
 * 
 * Check what data we have available in raw_props and identify 
 * which props have sufficient data for sophisticated grading
 */

import { config } from 'dotenv';

import { supabaseClient } from '../services/supabaseClient';

config();

async function analyzePropDataQuality() {
  console.log('🔍 ANALYZING PROP DATA QUALITY');
  console.log('===============================');
  
  try {
    // 1. Overall data availability
    console.log('\n1. OVERALL DATA AVAILABILITY:');
    const { data: allProps, count } = await supabaseClient
      .from('raw_props')
      .select('*', { count: 'exact' })
      .limit(1);
    
    console.log(`Total props in database: ${count}`);
    
    // 2. Check data completeness for key fields
    console.log('\n2. KEY FIELD COMPLETENESS:');
    const keyFields = [
      'expected_value',
      'sharp_money', 
      'line_movement',
      'matchup_rating',
      'player_form',
      'market_intelligence',
      'volume_profile',
      'closing_line_value'
    ];
    
    for (const field of keyFields) {
      const { count: nonNullCount } = await supabaseClient
        .from('raw_props')
        .select('*', { count: 'exact' })
        .not(field, 'is', null)
        .limit(0);
      
      const percentage = count ? (nonNullCount! * 100 / count).toFixed(1) : '0';
      console.log(`  ${field}: ${nonNullCount} props (${percentage}%)`);
    }
    
    // 3. Props with minimum required data
    console.log('\n3. MINIMUM GRADING REQUIREMENTS:');
    const { data: minRequiredProps, count: minRequiredCount } = await supabaseClient
      .from('raw_props')
      .select('*', { count: 'exact' })
      .not('line', 'is', null)
      .not('player_name', 'is', null)
      .not('stat_type', 'is', null)
      .limit(10);
    
    console.log(`Props with basic requirements (line, player, stat): ${minRequiredCount}`);
    
    // 4. Props with enhanced data for sophisticated scoring
    console.log('\n4. SOPHISTICATED SCORING CANDIDATES:');
    const { data: enhancedProps, count: enhancedCount } = await supabaseClient
      .from('raw_props')
      .select('*', { count: 'exact' })
      .not('line', 'is', null)
      .not('expected_value', 'is', null)
      .not('sharp_money', 'is', null)
      .limit(5);
    
    console.log(`Props with expected_value AND sharp_money: ${enhancedCount}`);
    
    if (enhancedProps && enhancedProps.length > 0) {
      console.log('\nSample enhanced props:');
      enhancedProps.forEach((prop, index) => {
        console.log(`  ${index + 1}. ${prop.sport} | ${prop.player_name} | ${prop.stat_type}`);
        console.log(`     Expected Value: ${prop.expected_value}`);
        console.log(`     Sharp Money: ${prop.sharp_money}`);
        console.log(`     Line Movement: ${prop.line_movement}`);
      });
    }
    
    // 5. Data quality by sport
    console.log('\n5. DATA QUALITY BY SPORT:');
    const { data: sportData } = await supabaseClient
      .from('raw_props')
      .select('sport, expected_value, sharp_money');
    
    if (sportData) {
      const sportQuality = sportData.reduce((acc, prop) => {
        if (!acc[prop.sport]) {
          acc[prop.sport] = { total: 0, withEV: 0, withSharp: 0, withBoth: 0 };
        }
        acc[prop.sport].total++;
        if (prop.expected_value !== null) acc[prop.sport].withEV++;
        if (prop.sharp_money !== null) acc[prop.sport].withSharp++;
        if (prop.expected_value !== null && prop.sharp_money !== null) acc[prop.sport].withBoth++;
        return acc;
      }, {} as Record<string, { total: number, withEV: number, withSharp: number, withBoth: number }>);
      
      console.log('Sport breakdown:');
      for (const [sport, stats] of Object.entries(sportQuality)) {
        const evPercent = (stats.withEV * 100 / stats.total).toFixed(1);
        const sharpPercent = (stats.withSharp * 100 / stats.total).toFixed(1);
        const bothPercent = (stats.withBoth * 100 / stats.total).toFixed(1);
        console.log(`  ${sport}: ${stats.total} props`);
        console.log(`    Expected Value: ${stats.withEV} (${evPercent}%)`);
        console.log(`    Sharp Money: ${stats.withSharp} (${sharpPercent}%)`);
        console.log(`    Both (Gradable): ${stats.withBoth} (${bothPercent}%)`);
      }
    }
    
    // 6. Recent data analysis
    console.log('\n6. RECENT DATA ANALYSIS:');
    const { data: recentProps } = await supabaseClient
      .from('raw_props')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (recentProps) {
      console.log('Most recent 10 props data quality:');
      recentProps.forEach((prop, index) => {
        const hasEV = prop.expected_value !== null;
        const hasSharp = prop.sharp_money !== null;
        const gradable = hasEV && hasSharp;
        console.log(`  ${index + 1}. ${prop.sport} | ${prop.player_name} | Gradable: ${gradable ? '✅' : '❌'}`);
      });
    }
    
    // 7. Recommendation
    console.log('\n7. RECOMMENDATIONS:');
    if (enhancedCount === 0) {
      console.log('❌ NO PROPS WITH SOPHISTICATED DATA AVAILABLE');
      console.log('The database lacks expected_value and sharp_money data required for sophisticated scoring.');
      console.log('');
      console.log('Options:');
      console.log('  1. Run FeedAgent to populate expected_value and sharp_money from API sources');
      console.log('  2. Use simplified grading for props with basic data (line, player, stat)');
      console.log('  3. Generate synthetic expected_value data for testing purposes');
    } else {
      console.log(`✅ ${enhancedCount} PROPS READY FOR SOPHISTICATED GRADING`);
      console.log('These props have the required data for our advanced scoring system.');
    }
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
  }
}

// Run the analysis
if (require.main === module) {
  analyzePropDataQuality()
    .then(() => {
      console.log('\n📊 Data quality analysis completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Analysis failed:', error);
      process.exit(1);
    });
}

export { analyzePropDataQuality };