/**
 * PHASE_2B_INTELLIGENCE_SUPERIORITY_REAUDIT-003
 * Run instrumentation coverage audit queries
 */
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL not set');
  process.exit(1);
}

const client = new pg.Client({ connectionString: DATABASE_URL });

async function runAudit() {
  await client.connect();
  console.log('=== INTELLIGENCE INSTRUMENTATION AUDIT ===');
  console.log('Date:', new Date().toISOString());
  console.log('');

  // Query 1: Overall coverage
  console.log('--- QUERY 1: OVERALL INSTRUMENTATION COVERAGE ---');
  const q1 = await client.query(`
    SELECT
      COUNT(*) AS total_scored_legs,
      COUNT(p_final) AS with_p_final,
      COUNT(uncertainty_final) AS with_uncertainty,
      COUNT(edge_final) AS with_edge,
      COUNT(clv_forecast) AS with_clv,
      COUNT(p_market_devig) AS with_p_market,
      COUNT(consensus_weights_json) AS with_consensus,
      COUNT(probability_model_version) AS with_model_version,
      ROUND(COUNT(p_final)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 2) AS pct_p_final,
      ROUND(COUNT(p_market_devig)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 2) AS pct_p_market
    FROM scored_legs
  `);
  console.log(JSON.stringify(q1.rows[0], null, 2));
  console.log('');

  // Query 2: Recent coverage (7 days)
  console.log('--- QUERY 2: RECENT COVERAGE (7 DAYS) ---');
  const q2 = await client.query(`
    SELECT
      COUNT(*) AS total_recent,
      COUNT(p_final) AS with_p_final,
      ROUND(COUNT(p_final)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 2) AS pct_p_final,
      COUNT(CASE WHEN p_final IS NOT NULL AND p_market_devig IS NOT NULL AND edge_final IS NOT NULL THEN 1 END) AS fully_instrumented,
      ROUND(COUNT(CASE WHEN p_final IS NOT NULL AND p_market_devig IS NOT NULL AND edge_final IS NOT NULL THEN 1 END)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 2) AS pct_fully_instrumented
    FROM scored_legs
    WHERE scored_at_utc >= NOW() - INTERVAL '7 days'
  `);
  console.log(JSON.stringify(q2.rows[0], null, 2));
  console.log('');

  // Query 3: Edge distribution
  console.log('--- QUERY 3: EDGE DISTRIBUTION ---');
  const q3 = await client.query(`
    SELECT
      COUNT(*) AS sample_size,
      ROUND(AVG(edge_final)::NUMERIC, 5) AS mean_edge,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY edge_final)::NUMERIC, 5) AS median_edge,
      ROUND(PERCENTILE_CONT(0.05) WITHIN GROUP (ORDER BY edge_final)::NUMERIC, 5) AS p5_edge,
      ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY edge_final)::NUMERIC, 5) AS p95_edge,
      ROUND(MIN(edge_final)::NUMERIC, 5) AS min_edge,
      ROUND(MAX(edge_final)::NUMERIC, 5) AS max_edge
    FROM scored_legs
    WHERE edge_final IS NOT NULL
  `);
  console.log(JSON.stringify(q3.rows[0], null, 2));
  console.log('');

  // Query 4: P_final distribution (realism check)
  console.log('--- QUERY 4: P_FINAL DISTRIBUTION (REALISM CHECK) ---');
  const q4 = await client.query(`
    SELECT
      COUNT(*) AS sample_size,
      ROUND(AVG(p_final)::NUMERIC, 4) AS mean_p,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY p_final)::NUMERIC, 4) AS median_p,
      ROUND(MIN(p_final)::NUMERIC, 4) AS min_p,
      ROUND(MAX(p_final)::NUMERIC, 4) AS max_p,
      COUNT(CASE WHEN p_final < 0.4 OR p_final > 0.6 THEN 1 END) AS extreme_count,
      ROUND(COUNT(CASE WHEN p_final < 0.4 OR p_final > 0.6 THEN 1 END)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 2) AS pct_extreme
    FROM scored_legs
    WHERE p_final IS NOT NULL
  `);
  console.log(JSON.stringify(q4.rows[0], null, 2));
  console.log('');

  // Query 5: Uncertainty distribution
  console.log('--- QUERY 5: UNCERTAINTY DISTRIBUTION ---');
  const q5 = await client.query(`
    SELECT
      COUNT(*) AS sample_size,
      ROUND(AVG(uncertainty_final)::NUMERIC, 4) AS mean_uncertainty,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY uncertainty_final)::NUMERIC, 4) AS median_uncertainty,
      ROUND(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY uncertainty_final)::NUMERIC, 4) AS p90_uncertainty,
      COUNT(CASE WHEN uncertainty_final > 0.15 THEN 1 END) AS high_uncertainty_count
    FROM scored_legs
    WHERE uncertainty_final IS NOT NULL
  `);
  console.log(JSON.stringify(q5.rows[0], null, 2));
  console.log('');

  // Query 6: Model version distribution
  console.log('--- QUERY 6: MODEL VERSION DISTRIBUTION ---');
  const q6 = await client.query(`
    SELECT
      probability_model_version,
      COUNT(*) AS count,
      MIN(scored_at_utc) AS first_seen,
      MAX(scored_at_utc) AS last_seen
    FROM scored_legs
    WHERE probability_model_version IS NOT NULL
    GROUP BY probability_model_version
    ORDER BY last_seen DESC
    LIMIT 10
  `);
  console.log(JSON.stringify(q6.rows, null, 2));
  console.log('');

  // Query 7: Devig method distribution
  console.log('--- QUERY 7: DEVIG METHOD DISTRIBUTION ---');
  const q7 = await client.query(`
    SELECT
      devig_method,
      COUNT(*) AS count,
      ROUND(COUNT(*)::NUMERIC / SUM(COUNT(*)) OVER() * 100, 2) AS pct
    FROM scored_legs
    WHERE devig_method IS NOT NULL
    GROUP BY devig_method
    ORDER BY count DESC
  `);
  console.log(JSON.stringify(q7.rows, null, 2));
  console.log('');

  // Query 8: Consensus weights sample (audit trail)
  console.log('--- QUERY 8: CONSENSUS WEIGHTS SAMPLE ---');
  const q8 = await client.query(`
    SELECT
      id,
      scored_at_utc,
      p_final,
      p_market_devig,
      edge_final,
      consensus_weights_json
    FROM scored_legs
    WHERE consensus_weights_json IS NOT NULL
    ORDER BY scored_at_utc DESC
    LIMIT 3
  `);
  console.log(JSON.stringify(q8.rows, null, 2));

  await client.end();
}

runAudit().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
