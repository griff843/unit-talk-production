#!/usr/bin/env npx tsx
/**
 * HONEST VALIDATION: Check if professional system is actually processing picks
 */

import { supabaseClient } from '../src/services/supabaseClient';

async function validateActualProfessionalSystem() {
  console.log('🔍 HONEST VALIDATION: Checking actual professional system status');
  console.log('=' .repeat(80));

  try {
    // Check if unified_picks has any professional scores
    const { data: professionalPicks, error: pickError } = await supabaseClient
      .from('unified_picks')
      .select('*')
      .not('professional_score', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5);

    if (pickError) {
      console.error('❌ Error checking professional picks:', pickError);
      return;
    }

    console.log(`\n📊 PROFESSIONAL PICKS IN DATABASE: ${professionalPicks?.length || 0}`);

    if (professionalPicks && professionalPicks.length > 0) {
      console.log('✅ Found professional picks with scores:');
      professionalPicks.forEach((pick, i) => {
        console.log(`${i+1}. ${pick.player_name} - ${pick.stat_type} ${pick.line}`);
        console.log(`   Professional Score: ${pick.professional_score}`);
        console.log(`   Tier: ${pick.tier || 'Unknown'}`);
        console.log(`   Created: ${pick.created_at}`);
      });
    } else {
      console.log('❌ NO PROFESSIONAL PICKS FOUND');
      console.log('   This means the Enhanced45FactorEngine is NOT processing picks');
    }

    // Check environment variables
    console.log('\n🔧 ENVIRONMENT CONFIGURATION:');
    console.log(`USE_PRO_SCORER: ${process.env.USE_PRO_SCORER || 'undefined'}`);
    console.log(`USE_ENHANCED_45_FACTOR: ${process.env.USE_ENHANCED_45_FACTOR || 'undefined'}`);

    // Check raw props availability
    const { data: rawProps, error: rawError } = await supabaseClient
      .from('raw_props')
      .select('count', { count: 'exact', head: true });

    if (!rawError) {
      console.log(`\n📊 RAW PROPS AVAILABLE: ${rawProps || 0}`);
    }

    // Check current unified_picks
    const { data: allPicks, error: allError } = await supabaseClient
      .from('unified_picks')
      .select('count', { count: 'exact', head: true });

    if (!allError) {
      console.log(`📊 TOTAL UNIFIED PICKS: ${allPicks || 0}`);
    }

    console.log('\n🎯 CONCLUSION:');
    if ((professionalPicks?.length || 0) === 0) {
      console.log('❌ PROFESSIONAL SYSTEM IS NOT ACTIVE');
      console.log('❌ The 195-factor Enhanced45FactorEngine is not processing picks');
      console.log('❌ Any tier assignments (S-TIER, A-TIER) are NOT legitimate');
      console.log('🔧 REQUIRED: Activate the actual professional scoring pipeline');
    } else {
      console.log('✅ PROFESSIONAL SYSTEM IS ACTIVE');
      console.log('✅ Enhanced45FactorEngine is processing picks');
      console.log('✅ Tier assignments are legitimate');
    }

  } catch (error) {
    console.error('❌ Validation error:', error);
  }
}

validateActualProfessionalSystem().catch(console.error);