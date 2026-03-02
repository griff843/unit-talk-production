/**
 * Simulation: Fail-Closed Enforcement
 * Sprint: RISK-ENGINE-FOUNDATION-001
 *
 * Proves: When risk engine encounters any error, it returns BLOCK (never ALLOW).
 * Run: npx tsx apps/api/scripts/simulate_fail_closed.ts
 */

import { RiskEngine } from '../src/services/RiskEngine';

// Mock Supabase that throws on the exposure query
function createFailingSupabase() {
  return {
    from: (table: string) => {
      if (table === 'risk_engine_config') {
        return {
          select: () =>
            Promise.resolve({
              data: [{ config_key: 'engine_enabled', config_value: '1' }],
              error: null,
            }),
        };
      }
      if (table === 'risk_events') {
        return { insert: () => Promise.resolve({ error: null }) };
      }
      // All other tables throw
      return {
        select: () => ({
          eq: () => ({
            not: () => ({
              gt: () => Promise.reject(new Error('SIMULATED: Database connection lost')),
            }),
          }),
        }),
      };
    },
  } as any;
}

async function main() {
  console.log('=== SIMULATION: Fail-Closed Enforcement ===\n');

  RiskEngine.resetConfigCache();
  const engine = RiskEngine.getInstance();
  const supabase = createFailingSupabase();

  const decision = await engine.evaluateForPromotion(supabase, 'sim-pick-fail', 0.05);

  console.log('Decision:', JSON.stringify(decision, null, 2));

  const proof = {
    simulation: 'fail_closed',
    sprint: 'RISK-ENGINE-FOUNDATION-001',
    timestamp: new Date().toISOString(),
    input: {
      error_type: 'Database connection lost',
      scenario: 'Supabase throws on scored_legs query',
    },
    result: {
      allowed: decision.allowed,
      decision: decision.decision,
      blocked_reasons: decision.blocked_reasons,
    },
    assertion: {
      expected_blocked: true,
      actual_blocked: !decision.allowed,
      expected_reason: 'risk_engine_error',
      has_reason: decision.blocked_reasons.includes('risk_engine_error'),
      pass: !decision.allowed && decision.blocked_reasons.includes('risk_engine_error'),
    },
  };

  console.log('\nProof:', JSON.stringify(proof, null, 2));

  if (!proof.assertion.pass) {
    console.error('\nFAILED: Expected BLOCK with risk_engine_error');
    process.exit(1);
  }

  console.log('\nPASSED: Fail-closed correctly triggered BLOCK on error');
}

main().catch(console.error);
