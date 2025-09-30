/**
 * Monitor Optimal API Odds Data Quality
 * Tracks odds completeness and quality metrics for production monitoring
 */

import { createClient } from '@supabase/supabase-js';
// Load environment variables from root directory
import dotenv from 'dotenv';
import path from 'path';
import { requireSupabase } from '../utils/supabaseUtils';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface QualityMetrics {
  timestamp: string;
  sport: string;
  totalProps: number;
  propsWithBothOdds: number;
  oddsQuality: number;
  avgOverOdds: number;
  avgUnderOdds: number;
  uniquePlayers: number;
  uniquePropTypes: number;
  processingTimeMs: number;
}

async function monitorOptimalOddsQuality() {
  console.log('📊 MONITORING OPTIMAL ODDS DATA QUALITY');
  console.log('='.repeat(60));
  
  const sports = ['MLB', 'NBA', 'NFL', 'NHL'];
  const allMetrics: QualityMetrics[] = [];
  
  for (const sport of sports) {
    console.log(`\n🏀 Monitoring ${sport}...`);
    const startTime = Date.now();
    
    try {
      // Fetch props from Optimal API
      const rawProps = await fetchOptimalProps(sport);
      const processingTime = Date.now() - startTime;
      
      if (rawProps.length === 0) {
        console.log(`   ⚠️  No props available for ${sport}`);
        continue;
      }
      
      // Analyze odds quality
      const propsWithBothOdds = rawProps.filter(prop => 
        prop.over_odds && prop.under_odds && 
        prop.over_odds !== 0 && prop.under_odds !== 0 &&
        !isNaN(prop.over_odds) && !isNaN(prop.under_odds)
      );
      
      const oddsQuality = (propsWithBothOdds.length / rawProps.length) * 100;
      
      // Calculate averages
      const avgOverOdds = propsWithBothOdds.reduce((sum, p) => sum + (p.over_odds || 0), 0) / propsWithBothOdds.length;
      const avgUnderOdds = propsWithBothOdds.reduce((sum, p) => sum + (p.under_odds || 0), 0) / propsWithBothOdds.length;
      
      // Count unique players and prop types
      const uniquePlayers = new Set(rawProps.map(p => p.player_name)).size;
      const uniquePropTypes = new Set(rawProps.map(p => p.stat_type)).size;
      
      const metrics: QualityMetrics = {
        timestamp: new Date().toISOString(),
        sport,
        totalProps: rawProps.length,
        propsWithBothOdds: propsWithBothOdds.length,
        oddsQuality,
        avgOverOdds: Math.round(avgOverOdds),
        avgUnderOdds: Math.round(avgUnderOdds),
        uniquePlayers,
        uniquePropTypes,
        processingTimeMs: processingTime
      };
      
      allMetrics.push(metrics);
      
      // Log results
      console.log(`   📈 Quality: ${oddsQuality.toFixed(1)}% (${propsWithBothOdds.length}/${rawProps.length})`);
      console.log(`   📊 Players: ${uniquePlayers} | Prop types: ${uniquePropTypes}`);
      console.log(`   ⏱️  Processing time: ${processingTime}ms`);
      
      // Quality assessment
      if (oddsQuality >= 95) {
        console.log(`   ✅ EXCELLENT: Quality exceeds 95% target`);
      } else if (oddsQuality >= 90) {
        console.log(`   ⚠️  WARNING: Quality below 95% target but above 90%`);
      } else {
        console.log(`   ❌ CRITICAL: Quality below 90% - immediate attention required`);
      }
      
    } catch (error) {
      console.error(`   ❌ Error monitoring ${sport}:`, error instanceof Error ? error.message : 'Unknown error');
    }
  }
  
  // Overall summary
  console.log('\n📋 OVERALL QUALITY SUMMARY');
  console.log('='.repeat(40));
  
  if (allMetrics.length === 0) {
    console.log('❌ No metrics collected - check API connectivity');
    return;
  }
  
  const totalProps = allMetrics.reduce((sum, m) => sum + m.totalProps, 0);
  const totalWithOdds = allMetrics.reduce((sum, m) => sum + m.propsWithBothOdds, 0);
  const overallQuality = (totalWithOdds / totalProps) * 100;
  
  console.log(`Sports monitored: ${allMetrics.length}`);
  console.log(`Total props: ${totalProps.toLocaleString()}`);
  console.log(`Props with complete odds: ${totalWithOdds.toLocaleString()}`);
  console.log(`Overall quality: ${overallQuality.toFixed(1)}%`);
  
  // Store metrics in database for historical tracking
  try {
    const supabaseClient = requireSupabase();
      const { error } = await supabase
      .from('optimal_quality_metrics')
      .insert(allMetrics);
      
    if (error) {
      console.log(`⚠️  Could not store metrics in database: ${error.message}`);
      console.log(`   (This is OK - table may not exist yet)`);
    } else {
      console.log(`✅ Metrics stored in database for historical tracking`);
    }
  } catch (dbError) {
    console.log(`⚠️  Database storage skipped: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`);
  }
  
  // Alert conditions
  const criticalSports = allMetrics.filter(m => m.oddsQuality < 90);
  const warningSports = allMetrics.filter(m => m.oddsQuality >= 90 && m.oddsQuality < 95);
  
  if (criticalSports.length > 0) {
    console.log(`\n🚨 CRITICAL ALERT: ${criticalSports.length} sports below 90% quality:`);
    criticalSports.forEach(m => {
      console.log(`   ${m.sport}: ${m.oddsQuality.toFixed(1)}%`);
    });
  }
  
  if (warningSports.length > 0) {
    console.log(`\n⚠️  WARNING: ${warningSports.length} sports below 95% target:`);
    warningSports.forEach(m => {
      console.log(`   ${m.sport}: ${m.oddsQuality.toFixed(1)}%`);
    });
  }
  
  if (overallQuality >= 95) {
    console.log('\n🎉 SUCCESS: Overall system quality exceeds 95% target');
  } else {
    console.log('\n⚠️  ATTENTION: Overall system quality below 95% target');
  }
}

monitorOptimalOddsQuality().then(() => {
  console.log('\n✅ OPTIMAL ODDS QUALITY MONITORING COMPLETE');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Monitoring failed:', error);
  process.exit(1);
});