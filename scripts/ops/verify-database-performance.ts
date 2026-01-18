/**
 * Database Performance Verification Script
 *
 * Verifies:
 * 1. Query performance for processed_by filter
 * 2. Current raw_props volume
 * 3. Index status (if accessible)
 * 4. Recommendations for production readiness
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

interface PerformanceMetrics {
  timestamp: string;
  total_raw_props: number;
  processed_count: number;
  professional_system_count: number;
  query_time_ms: number;
  query_success: boolean;
  query_error?: string;
  recommendations: string[];
  verdict: 'PASS' | 'WARN' | 'FAIL';
}

async function main() {
  console.log('\n=== Database Performance Verification ===\n');

  const metrics: PerformanceMetrics = {
    timestamp: new Date().toISOString(),
    total_raw_props: 0,
    processed_count: 0,
    professional_system_count: 0,
    query_time_ms: 0,
    query_success: false,
    recommendations: [],
    verdict: 'PASS',
  };

  try {
    // Test 1: Get total counts
    console.log('[Test 1] Querying raw_props counts...');

    const { count: totalCount } = await supabase
      .from('raw_props')
      .select('id', { count: 'exact', head: true });

    const { count: processedCount } = await supabase
      .from('raw_props')
      .select('id', { count: 'exact', head: true })
      .not('processed_at', 'is', null);

    metrics.total_raw_props = totalCount || 0;
    metrics.processed_count = processedCount || 0;

    console.log(`  Total raw_props: ${metrics.total_raw_props}`);
    console.log(`  Processed (any): ${metrics.processed_count}`);

    // Test 2: Query performance with processed_by filter
    console.log('\n[Test 2] Testing query performance with processed_by filter...');

    const startTime = Date.now();
    const { data, error, count: professionalCount } = await supabase
      .from('raw_props')
      .select('id, processed_at, processed_by, player_name', { count: 'exact' })
      .eq('processed_by', 'professional_system')
      .limit(10);

    metrics.query_time_ms = Date.now() - startTime;
    metrics.professional_system_count = professionalCount || 0;

    if (error) {
      metrics.query_success = false;
      metrics.query_error = error.message;
      metrics.verdict = 'FAIL';
      console.log(`  ❌ Query FAILED after ${metrics.query_time_ms}ms: ${error.message}`);
    } else {
      metrics.query_success = true;
      console.log(`  ✅ Query SUCCESS after ${metrics.query_time_ms}ms`);
      console.log(`  Rows matched: ${metrics.professional_system_count}`);
      console.log(`  Sample: ${data?.length || 0} rows returned`);
    }

    // Analyze and provide recommendations
    console.log('\n[Analysis] Performance Analysis...\n');

    if (metrics.query_time_ms > 1000) {
      metrics.recommendations.push('⚠️  Query timeout risk: Add database index on raw_props.processed_by');
      metrics.verdict = 'WARN';
    } else if (metrics.query_time_ms > 500) {
      metrics.recommendations.push('ℹ️  Query is slow: Consider adding index for production scale');
      if (metrics.verdict === 'PASS') metrics.verdict = 'WARN';
    } else {
      metrics.recommendations.push('✅ Query performance is acceptable for current volume');
    }

    if (metrics.total_raw_props > 10000) {
      metrics.recommendations.push('⚠️  High volume detected: Index recommended for production scale');
      if (metrics.verdict === 'PASS') metrics.verdict = 'WARN';
    } else {
      metrics.recommendations.push(`ℹ️  Current volume (${metrics.total_raw_props}) is manageable without index`);
    }

    if (metrics.professional_system_count === 0) {
      metrics.recommendations.push('ℹ️  No props processed by professional_system yet');
    } else {
      metrics.recommendations.push(`✅ ${metrics.professional_system_count} props processed successfully`);
    }

    // Test 3: Test with large limit to simulate production load
    if (metrics.professional_system_count > 50) {
      console.log('\n[Test 3] Testing with production-scale limit...');

      const prodStartTime = Date.now();
      const { error: prodError } = await supabase
        .from('raw_props')
        .select('id')
        .eq('processed_by', 'professional_system')
        .limit(100);

      const prodQueryTime = Date.now() - prodStartTime;

      if (prodError) {
        metrics.recommendations.push('❌ Production-scale query FAILED: Index is REQUIRED');
        metrics.verdict = 'FAIL';
        console.log(`  ❌ Production query FAILED after ${prodQueryTime}ms`);
      } else if (prodQueryTime > 1000) {
        metrics.recommendations.push('⚠️  Production-scale query is slow: Index is RECOMMENDED');
        metrics.verdict = 'WARN';
        console.log(`  ⚠️  Production query SLOW: ${prodQueryTime}ms`);
      } else {
        console.log(`  ✅ Production query OK: ${prodQueryTime}ms`);
      }
    }

    // Display recommendations
    console.log('\n=== Recommendations ===\n');
    metrics.recommendations.forEach(rec => console.log(`  ${rec}`));

    // Final verdict
    console.log(`\n=== VERDICT: ${metrics.verdict} ===\n`);

    if (metrics.verdict === 'FAIL') {
      console.log('❌ Database index is REQUIRED for production use');
      console.log('\nRun this migration:');
      console.log('CREATE INDEX IF NOT EXISTS idx_raw_props_processed_by');
      console.log('ON raw_props(processed_by)');
      console.log('WHERE processed_by IS NOT NULL;\n');
    } else if (metrics.verdict === 'WARN') {
      console.log('⚠️  Database index is RECOMMENDED for production scale');
      console.log('Current performance is acceptable but may degrade at scale.\n');
    } else {
      console.log('✅ Performance is acceptable for current volume');
      console.log('Monitor performance as volume grows.\n');
    }

    // Write metrics
    const { writeFileSync, mkdirSync } = await import('fs');
    const { join } = await import('path');

    const outDir = join('out', 'ops', 'cutover', 'metrics', 'phase15');
    mkdirSync(outDir, { recursive: true });

    const metricsPath = join(outDir, 'DATABASE_PERFORMANCE_VERIFICATION.json');
    writeFileSync(metricsPath, JSON.stringify(metrics, null, 2));

    console.log(`Metrics written to: ${metricsPath}\n`);

    process.exit(metrics.verdict === 'FAIL' ? 1 : 0);

  } catch (error) {
    console.error('\n❌ Verification failed:', error);
    metrics.verdict = 'FAIL';
    metrics.recommendations.push('❌ System error during verification');
    process.exit(1);
  }
}

main();
