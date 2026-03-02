/**
 * PHASE_2B_INTELLIGENCE_SUPERIORITY_REAUDIT-003
 * Run instrumentation coverage audit queries via Supabase JS client
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runAudit() {
  console.log('=== INTELLIGENCE INSTRUMENTATION AUDIT ===');
  console.log('Date:', new Date().toISOString());
  console.log('Method: Supabase JS Client (HTTPS)');
  console.log('');

  // Query 1: Overall coverage - count records with probability fields
  console.log('--- QUERY 1: OVERALL INSTRUMENTATION COVERAGE ---');

  const { data: allLegs, error: e1 } = await supabase
    .from('scored_legs')
    .select('id, p_final, uncertainty_final, edge_final, p_market_devig, consensus_weights_json, probability_model_version', { count: 'exact', head: true });

  if (e1) {
    console.log('Error:', e1.message);
  }

  const { count: totalCount } = await supabase
    .from('scored_legs')
    .select('*', { count: 'exact', head: true });

  const { count: withPFinal } = await supabase
    .from('scored_legs')
    .select('*', { count: 'exact', head: true })
    .not('p_final', 'is', null);

  const { count: withPMarket } = await supabase
    .from('scored_legs')
    .select('*', { count: 'exact', head: true })
    .not('p_market_devig', 'is', null);

  const { count: withEdge } = await supabase
    .from('scored_legs')
    .select('*', { count: 'exact', head: true })
    .not('edge_final', 'is', null);

  const { count: withConsensus } = await supabase
    .from('scored_legs')
    .select('*', { count: 'exact', head: true })
    .not('consensus_weights_json', 'is', null);

  console.log(JSON.stringify({
    total_scored_legs: totalCount,
    with_p_final: withPFinal,
    with_p_market_devig: withPMarket,
    with_edge_final: withEdge,
    with_consensus_weights: withConsensus,
    pct_p_final: totalCount > 0 ? ((withPFinal / totalCount) * 100).toFixed(2) : 0,
    pct_p_market: totalCount > 0 ? ((withPMarket / totalCount) * 100).toFixed(2) : 0
  }, null, 2));
  console.log('');

  // Query 2: Sample of instrumented records
  console.log('--- QUERY 2: SAMPLE OF INSTRUMENTED RECORDS ---');
  const { data: samples, error: e2 } = await supabase
    .from('scored_legs')
    .select('id, scored_at_utc, p_final, p_market_devig, edge_final, uncertainty_final, devig_method, probability_model_version')
    .not('p_final', 'is', null)
    .order('scored_at_utc', { ascending: false })
    .limit(5);

  if (e2) {
    console.log('Error:', e2.message);
  } else if (samples && samples.length > 0) {
    console.log(JSON.stringify(samples, null, 2));
  } else {
    console.log('No instrumented records found (probability fields all NULL)');
    console.log('This is expected if migrations have not been applied or no picks scored since integration.');
  }
  console.log('');

  // Query 3: Check if probability columns exist
  console.log('--- QUERY 3: SCHEMA CHECK ---');
  const { data: schemaCheck, error: e3 } = await supabase
    .from('scored_legs')
    .select('p_final, uncertainty_final, edge_final, clv_forecast, p_market_devig, devig_method')
    .limit(1);

  if (e3) {
    if (e3.message.includes('does not exist')) {
      console.log('SCHEMA STATUS: Probability columns NOT PRESENT');
      console.log('Migration 20260301100000_probability_foundation.sql needs to be applied');
    } else {
      console.log('Error:', e3.message);
    }
  } else {
    console.log('SCHEMA STATUS: Probability columns EXIST');
    console.log('Columns verified: p_final, uncertainty_final, edge_final, clv_forecast, p_market_devig, devig_method');
  }
  console.log('');

  // Query 4: Model version distribution
  console.log('--- QUERY 4: MODEL VERSION DISTRIBUTION ---');
  const { data: modelVersions, error: e4 } = await supabase
    .from('scored_legs')
    .select('probability_model_version')
    .not('probability_model_version', 'is', null)
    .limit(100);

  if (e4) {
    console.log('Error:', e4.message);
  } else if (modelVersions && modelVersions.length > 0) {
    const versionCounts = {};
    modelVersions.forEach(r => {
      versionCounts[r.probability_model_version] = (versionCounts[r.probability_model_version] || 0) + 1;
    });
    console.log(JSON.stringify(versionCounts, null, 2));
  } else {
    console.log('No model versions found (all NULL)');
  }

  console.log('');
  console.log('=== AUDIT COMPLETE ===');
}

runAudit().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
