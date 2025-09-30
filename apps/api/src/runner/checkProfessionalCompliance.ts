/**
 * Check Professional System Compliance in Unified Picks
 */

import { createClient } from '@supabase/supabase-js';
// Load environment variables from root directory
import dotenv from 'dotenv';
import path from 'path';
import { requireSupabase } from '../utils/supabaseUtils';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

async function checkProfessionalCompliance() {
  console.log('🔍 CHECKING PROFESSIONAL SYSTEM COMPLIANCE');
  console.log('='.repeat(60));
  
  const supabaseClient = requireSupabase();
      const { data: picks } = await supabase
    .from('unified_picks')
    .select('*')
    .order('created_at', { ascending: false });
    
  console.log('📊 UNIFIED PICKS ANALYSIS:');
  console.log(`Total picks: ${picks?.length || 0}`);
  
  picks?.forEach((pick, i) => {
    console.log(`\n${i+1}. ${pick.player_name} ${pick.stat_type}`);
    console.log(`   Professional Score: ${pick.professional_score || 'MISSING ❌'}`);
    console.log(`   Devigged Edge: ${pick.devigged_edge || 'MISSING ❌'}`);
    console.log(`   CLV Tracking ID: ${pick.clv_tracking_id || 'MISSING ❌'}`);
    console.log(`   Kelly Fraction: ${pick.kelly_fraction || 'MISSING ❌'}`);
    console.log(`   Processing Time: ${pick.processing_time || 'MISSING ❌'}`);
    console.log(`   Auto Approved: ${pick.published !== null ? pick.published : 'MISSING ❌'}`);
    console.log(`   Tier: ${pick.tier || 'MISSING ❌'}`);
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('🏆 PROFESSIONAL SYSTEM STATUS:');
  
  const professionalFields = ['professional_score', 'devigged_edge', 'clv_tracking_id', 'kelly_fraction'];
  let compliantPicks = 0;
  
  picks?.forEach(pick => {
    const hasAllFields = professionalFields.every(field => {
      const value = pick[field];
      return value !== null && value !== undefined && value !== 0;
    });
    if (hasAllFields) compliantPicks++;
  });
  
  const complianceRate = picks?.length ? (compliantPicks / picks.length) * 100 : 0;
  console.log(`Compliance Rate: ${complianceRate.toFixed(1)}%`);
  console.log(`Status: ${complianceRate >= 95 ? '✅ COMPLIANT' : '❌ NON-COMPLIANT'}`);
  
  if (complianceRate < 95) {
    console.log('\n⚠️ CRITICAL: Picks are bypassing professional system!');
    console.log('This violates Non-Negotiable Sharp Grading Rules.');
    console.log('\n📋 REQUIRED ACTIONS:');
    console.log('1. All picks must go through ProfessionalPropProcessor');
    console.log('2. Devigging must be applied to ALL odds');
    console.log('3. CLV tracking must be initiated for ALL picks');
    console.log('4. Professional grading scores must be calculated');
    console.log('5. Kelly criterion sizing must be applied');
  }
  
  console.log('\n🔧 DIAGNOSIS:');
  console.log('The basic pipeline (raw_props → unified_picks) is working,');
  console.log('but picks are bypassing the professional processing system.');
  console.log('This suggests the ProfessionalPropProcessor is not being invoked.');
}

checkProfessionalCompliance().then(() => {
  console.log('\n✅ COMPLIANCE CHECK COMPLETE');
  process.exit(0);
}).catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});