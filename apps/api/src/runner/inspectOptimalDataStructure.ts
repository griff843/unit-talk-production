/**
 * Inspect Optimal API Data Structure
 * Find out how odds and outcomes are stored in the database
 */

import { createClient } from '@supabase/supabase-js';
// Load environment variables from root directory
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

async function inspectOptimalDataStructure() {
  console.log('🔍 INSPECTING OPTIMAL API DATA STRUCTURE');
  console.log('='.repeat(60));
  
  try {
    // Get a sample of raw props to see all available columns
    const { data: sampleProps, error } = await supabase
      .from('raw_props')
      .select('*')
      .eq('provider', 'Optimal')
      .not('player_name', 'is', null)
      .limit(5);
      
    if (error) {
      console.error('❌ Error fetching sample props:', error);
      return;
    }
    
    if (!sampleProps || sampleProps.length === 0) {
      console.log('❌ No Optimal props found in database');
      return;
    }
    
    console.log(`📊 Found ${sampleProps.length} sample props from Optimal API`);
    console.log('\n📋 AVAILABLE COLUMNS:');
    const allColumns = Object.keys(sampleProps[0]).sort();
    console.log(allColumns.join(', '));
    
    console.log('\n🎯 ODDS-RELATED COLUMNS ANALYSIS:');
    const oddsColumns = allColumns.filter(col => 
      col.includes('odd') || 
      col.includes('over') || 
      col.includes('under') || 
      col.includes('outcome') ||
      col.includes('book') ||
      col.includes('price') ||
      col.includes('line')
    );
    console.log('Potential odds columns:', oddsColumns);
    
    console.log('\n📖 SAMPLE DATA ANALYSIS:');
    sampleProps.forEach((prop, i) => {
      console.log(`\n${i+1}. ${prop.player_name} ${prop.stat_type} ${prop.line}`);
      console.log('   🎲 Odds-related fields:');
      console.log(`   - over: ${prop.over} (type: ${typeof prop.over})`);
      console.log(`   - under: ${prop.under} (type: ${typeof prop.under})`);
      console.log(`   - over_odds: ${prop.over_odds} (type: ${typeof prop.over_odds})`);
      console.log(`   - under_odds: ${prop.under_odds} (type: ${typeof prop.under_odds})`);
      console.log(`   - outcome: ${prop.outcome} (type: ${typeof prop.outcome})`);
      console.log(`   - bookmaker: ${prop.bookmaker}`);
      console.log(`   - book: ${prop.book}`);
      console.log(`   - provider: ${prop.provider}`);
      
      console.log('   📊 All non-null fields for this prop:');
      Object.entries(prop).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          console.log(`      ${key}: ${value} (${typeof value})`);
        }
      });
    });
    
    // Check if there are any patterns in how odds are stored
    console.log('\n🔍 COLUMN VALUE ANALYSIS:');
    const fieldAnalysis: Record<string, any> = {};
    
    sampleProps.forEach(prop => {
      Object.entries(prop).forEach(([key, value]) => {
        if (!fieldAnalysis[key]) {
          fieldAnalysis[key] = { nullCount: 0, nonNullValues: [], types: new Set() };
        }
        
        if (value === null || value === undefined || value === '') {
          fieldAnalysis[key].nullCount++;
        } else {
          if (fieldAnalysis[key].nonNullValues.length < 3) {
            fieldAnalysis[key].nonNullValues.push(value);
          }
          fieldAnalysis[key].types.add(typeof value);
        }
      });
    });
    
    console.log('\n📈 FIELD COMPLETENESS:');
    Object.entries(fieldAnalysis)
      .filter(([key, info]) => key.includes('over') || key.includes('under') || key.includes('odd') || key.includes('outcome'))
      .forEach(([key, info]) => {
        const nonNullCount = sampleProps.length - info.nullCount;
        const completeness = ((nonNullCount / sampleProps.length) * 100).toFixed(1);
        console.log(`   ${key}: ${completeness}% complete (${nonNullCount}/${sampleProps.length}) - Types: ${[...info.types].join(', ')}`);
        if (info.nonNullValues.length > 0) {
          console.log(`      Sample values: ${info.nonNullValues.join(', ')}`);
        }
      });
      
    // Look for any fields that might contain JSON or structured data
    console.log('\n🔍 LOOKING FOR STRUCTURED DATA:');
    sampleProps.forEach(prop => {
      Object.entries(prop).forEach(([key, value]) => {
        if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
          console.log(`   ${key} might contain JSON: ${value.substring(0, 100)}...`);
        }
      });
    });
    
  } catch (error) {
    console.error('❌ Error inspecting data structure:', error);
  }
}

inspectOptimalDataStructure().then(() => {
  console.log('\n✅ DATA STRUCTURE INSPECTION COMPLETE');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Inspection failed:', error);
  process.exit(1);
});