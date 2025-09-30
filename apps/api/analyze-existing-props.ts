#!/usr/bin/env node

/**
 * ANALYZE EXISTING PROPS - Understanding What We Have
 *
 * Analyze the 1.4M props to understand sports, sources, and structure
 */

import { supabaseClient } from './src/services/supabaseClient';

async function analyzeExistingProps() {
  console.log('🔍 ANALYZE EXISTING PROPS - Understanding What We Have');
  console.log('======================================================================');

  try {
    console.log('\n📊 STEP 1: Check sports distribution...');

    // Get sport distribution
    const { data: sportsData, error: sportsError } = await supabaseClient
      .from('raw_props')
      .select('sport')
      .neq('sport', null)
      .limit(10000);

    if (sportsError) {
      console.log(`❌ Sports analysis error: ${sportsError.message}`);
    } else {
      const sportsCount = {};
      sportsData.forEach((prop: any) => {
        if (prop.sport) {
          sportsCount[prop.sport] = (sportsCount[prop.sport] || 0) + 1;
        }
      });

      console.log('🏈 Sports Distribution (sample):');
      Object.entries(sportsCount)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .forEach(([sport, count]) => {
          console.log(`   ${sport}: ${count}`);
        });
    }

    console.log('\n📊 STEP 2: Check MLB specifically...');

    // Check MLB props specifically
    const { count: mlbCount, error: mlbError } = await supabaseClient
      .from('raw_props')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'MLB');

    console.log(`MLB props: ${mlbCount || 0}`);
    if (mlbError) console.log(`MLB error: ${mlbError.message}`);

    // Check case variations
    const { count: mlbLowerCount } = await supabaseClient
      .from('raw_props')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'mlb');

    console.log(`mlb (lowercase) props: ${mlbLowerCount || 0}`);

    // Check for contains
    const { count: mlbContainsCount } = await supabaseClient
      .from('raw_props')
      .select('*', { count: 'exact', head: true })
      .ilike('sport', '%mlb%');

    console.log(`Sports containing 'mlb': ${mlbContainsCount || 0}`);

    console.log('\n📊 STEP 3: Check for null sports...');

    const { count: nullSportCount } = await supabaseClient
      .from('raw_props')
      .select('*', { count: 'exact', head: true })
      .is('sport', null);

    console.log(`Null sport props: ${nullSportCount || 0}`);

    console.log('\n📊 STEP 4: Sample prop analysis...');

    // Get sample props to understand structure
    const { data: sampleProps, error: sampleError } = await supabaseClient
      .from('raw_props')
      .select('sport, source, provider, stat_type, player_name, line, created_at')
      .limit(10);

    if (!sampleError && sampleProps) {
      console.log('Sample props:');
      sampleProps.forEach((prop: any, index: number) => {
        console.log(`   ${index + 1}. Sport: ${prop.sport || 'NULL'}, Source: ${prop.source || 'NULL'}, Player: ${prop.player_name || 'NULL'}, Stat: ${prop.stat_type || 'NULL'}`);
      });
    }

    console.log('\n📊 STEP 5: Check for patterns...');

    // Check for common patterns
    const patterns = ['basketball', 'football', 'baseball', 'hockey'];
    for (const pattern of patterns) {
      const { count } = await supabaseClient
        .from('raw_props')
        .select('*', { count: 'exact', head: true })
        .ilike('sport', `%${pattern}%`);

      if (count && count > 0) {
        console.log(`Props containing '${pattern}': ${count}`);
      }
    }

    console.log('\n🎯 ANALYSIS COMPLETE');
    console.log('======================================================================');

  } catch (error: any) {
    console.error('❌ Analysis failed:', error.message);
  }
}

analyzeExistingProps().catch(console.error);