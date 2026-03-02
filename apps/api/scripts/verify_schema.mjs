/**
 * Verify probability columns exist in scored_legs table
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function verify() {
  console.log('=== SCHEMA VERIFICATION ===\n');

  // Try to select all probability columns
  const { data, error } = await supabase
    .from('scored_legs')
    .select(`
      id,
      leg_id,
      p_final,
      uncertainty_final,
      edge_final,
      clv_forecast,
      p_market_devig,
      devig_method,
      consensus_weights_json,
      probability_model_version,
      computed_at
    `)
    .limit(1);

  if (error) {
    console.log('❌ SCHEMA ERROR:', error.message);
    process.exit(1);
  }

  console.log('✅ All probability columns EXIST and accessible:');
  console.log('   - p_final');
  console.log('   - uncertainty_final');
  console.log('   - edge_final');
  console.log('   - clv_forecast');
  console.log('   - p_market_devig');
  console.log('   - devig_method');
  console.log('   - consensus_weights_json');
  console.log('   - probability_model_version');
  console.log('');
  console.log(`Records in scored_legs: ${data?.length ?? 0}`);
  console.log('');

  // Check views
  console.log('--- VIEW CHECK ---');

  const { error: v1err } = await supabase
    .from('view_scored_legs_latest')
    .select('p_final, p_market_devig, edge_final')
    .limit(1);

  if (v1err) {
    console.log('❌ view_scored_legs_latest:', v1err.message);
  } else {
    console.log('✅ view_scored_legs_latest: probability columns accessible');
  }

  const { error: v2err } = await supabase
    .from('view_scoring_audit')
    .select('p_final, p_market_devig, edge_final')
    .limit(1);

  if (v2err) {
    console.log('❌ view_scoring_audit:', v2err.message);
  } else {
    console.log('✅ view_scoring_audit: probability columns accessible');
  }

  console.log('\n=== VERIFICATION COMPLETE ===');
}

verify().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
