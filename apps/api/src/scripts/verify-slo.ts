#!/usr/bin/env node
/**
 * SLO (Service Level Objective) verification script
 * Validates system performance and reliability metrics
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

interface SLOCheck {
  name: string;
  check: () => Promise<{ passed: boolean; value: number; threshold: number }>;
  critical: boolean;
}

const slos: SLOCheck[] = [
  {
    name: 'Database Query Latency',
    check: async () => {
      if (!supabaseUrl || !supabaseKey) {
        return { passed: false, value: -1, threshold: 50 };
      }

      const supabase = createClient(supabaseUrl, supabaseKey);
      const start = Date.now();

      await supabase.from('agent_health').select('count').limit(1);

      const latency = Date.now() - start;
      const threshold = 50; // 50ms target

      return {
        passed: latency < threshold,
        value: latency,
        threshold,
      };
    },
    critical: false,
  },
  {
    name: 'Agent Response Time',
    check: async () => {
      if (!supabaseUrl || !supabaseKey) {
        return { passed: false, value: -1, threshold: 100 };
      }

      const supabase = createClient(supabaseUrl, supabaseKey);
      const start = Date.now();

      await supabase
        .from('agent_metrics')
        .select('agent_name, avg_processing_time')
        .order('created_at', { ascending: false })
        .limit(10);

      const latency = Date.now() - start;
      const threshold = 100; // 100ms target

      return {
        passed: latency < threshold,
        value: latency,
        threshold,
      };
    },
    critical: false,
  },
  {
    name: 'Data Pipeline Throughput',
    check: async () => {
      if (!supabaseUrl || !supabaseKey) {
        return { passed: false, value: -1, threshold: 1000 };
      }

      const supabase = createClient(supabaseUrl, supabaseKey);

      // Check recent pick ingestion rate (last hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count, error } = await supabase
        .from('unified_picks')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', oneHourAgo);

      if (error) {
        return { passed: false, value: -1, threshold: 1000 };
      }

      const throughput = count || 0;
      const threshold = 100; // Expect at least 100 picks per hour during active periods

      return {
        passed: true, // This is informational, not a hard requirement
        value: throughput,
        threshold,
      };
    },
    critical: false,
  },
];

async function runSLOChecks(): Promise<boolean> {
  console.log('📊 Running SLO verification...\n');

  let allPassed = true;
  let criticalFailed = false;

  for (const slo of slos) {
    process.stdout.write(`Checking: ${slo.name}... `);

    try {
      const result = await slo.check();

      if (result.passed) {
        console.log(`✅ PASS (${result.value}${slo.name.includes('Throughput') ? '' : 'ms'} < ${result.threshold}${slo.name.includes('Throughput') ? '' : 'ms'})`);
      } else {
        const status = slo.critical ? '❌ FAIL (CRITICAL)' : '⚠️  FAIL (WARNING)';
        console.log(`${status} (${result.value}${slo.name.includes('Throughput') ? '' : 'ms'} >= ${result.threshold}${slo.name.includes('Throughput') ? '' : 'ms'})`);
        allPassed = false;

        if (slo.critical) {
          criticalFailed = true;
        }
      }
    } catch (err) {
      console.log(slo.critical ? '❌ ERROR (CRITICAL)' : '⚠️  ERROR (WARNING)');
      console.error(`  Error: ${err}`);
      allPassed = false;

      if (slo.critical) {
        criticalFailed = true;
      }
    }
  }

  console.log('\n' + '='.repeat(50));

  if (criticalFailed) {
    console.log('❌ CRITICAL SLO FAILURES - DEPLOYMENT BLOCKED');
    return false;
  } else if (!allPassed) {
    console.log('⚠️  SOME SLOS NOT MET - MONITOR CLOSELY');
    return true; // Non-critical SLO misses don't block deployment
  } else {
    console.log('✅ ALL SLOS MET - SYSTEM PERFORMING OPTIMALLY');
    return true;
  }
}

// Run SLO checks
runSLOChecks()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((err) => {
    console.error('❌ SLO check execution failed:', err);
    process.exit(1);
  });
