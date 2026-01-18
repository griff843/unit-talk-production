#!/usr/bin/env node
/**
 * Pre-deployment gate verification script
 * Validates system readiness before blue-green cutover
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

interface GateCheck {
  name: string;
  check: () => Promise<boolean>;
  critical: boolean;
}

const gates: GateCheck[] = [
  {
    name: 'Database Connection',
    check: async () => {
      if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Missing Supabase credentials');
        return false;
      }
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { error } = await supabase.from('agent_health').select('count').limit(1);
        return !error;
      } catch (err) {
        console.error('❌ Database connection failed:', err);
        return false;
      }
    },
    critical: true,
  },
  {
    name: 'Agent Health Check',
    check: async () => {
      if (!supabaseUrl || !supabaseKey) return false;
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data, error } = await supabase
          .from('agent_health')
          .select('agent_name, status')
          .eq('status', 'healthy');

        if (error) {
          console.error('❌ Agent health query failed:', error);
          return false;
        }

        const healthyCount = data?.length || 0;
        if (healthyCount === 0) {
          console.warn('⚠️  No healthy agents found');
          return false;
        }

        console.log(`✅ ${healthyCount} healthy agents found`);
        return true;
      } catch (err) {
        console.error('❌ Agent health check failed:', err);
        return false;
      }
    },
    critical: false,
  },
  {
    name: 'Database Schema Version',
    check: async () => {
      if (!supabaseUrl || !supabaseKey) return false;
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        // Check that unified_picks table exists
        const { error } = await supabase.from('unified_picks').select('count').limit(1);
        return !error;
      } catch (err) {
        console.error('❌ Schema version check failed:', err);
        return false;
      }
    },
    critical: true,
  },
];

async function runGateChecks(): Promise<boolean> {
  console.log('🔍 Running pre-deployment gate checks...\n');

  let allPassed = true;
  let criticalFailed = false;

  for (const gate of gates) {
    process.stdout.write(`Checking: ${gate.name}... `);

    try {
      const result = await gate.check();

      if (result) {
        console.log('✅ PASS');
      } else {
        console.log(gate.critical ? '❌ FAIL (CRITICAL)' : '⚠️  FAIL (WARNING)');
        allPassed = false;

        if (gate.critical) {
          criticalFailed = true;
        }
      }
    } catch (err) {
      console.log(gate.critical ? '❌ ERROR (CRITICAL)' : '⚠️  ERROR (WARNING)');
      console.error(`  Error: ${err}`);
      allPassed = false;

      if (gate.critical) {
        criticalFailed = true;
      }
    }
  }

  console.log('\n' + '='.repeat(50));

  if (criticalFailed) {
    console.log('❌ CRITICAL GATE FAILURES - DEPLOYMENT BLOCKED');
    return false;
  } else if (!allPassed) {
    console.log('⚠️  SOME GATES FAILED - PROCEED WITH CAUTION');
    return true; // Non-critical failures don't block deployment
  } else {
    console.log('✅ ALL GATES PASSED - READY FOR DEPLOYMENT');
    return true;
  }
}

// Run gate checks
runGateChecks()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((err) => {
    console.error('❌ Gate check execution failed:', err);
    process.exit(1);
  });
