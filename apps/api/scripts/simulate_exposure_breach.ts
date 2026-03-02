/**
 * Simulation: Exposure Breach Enforcement
 * Sprint: RISK-ENGINE-FOUNDATION-001
 *
 * Proves: When total kelly exposure exceeds threshold, RiskEngine returns BLOCK.
 * Run: npx tsx apps/api/scripts/simulate_exposure_breach.ts
 */

import { RiskEngine } from '../src/services/RiskEngine';
import type { RiskEngineConfig } from '../src/services/risk/types';

// Mock Supabase that returns high-exposure scored legs
function createHighExposureSupabase() {
  // 15 pending legs at 0.06 kelly each = 0.90 total (> 0.60 HIGH threshold)
  const exposureRows = Array.from({ length: 15 }, (_, i) => ({
    kelly_fraction: 0.06,
    ticket_legs: { event_id: `event-${i}`, leg_status: 'pending' },
  }));

  let callCount = 0;

  return {
    from: (table: string) => {
      if (table === 'risk_engine_config') {
        return {
          select: () =>
            Promise.resolve({
              data: [
                { config_key: 'total_kelly_high', config_value: '0.60' },
                { config_key: 'total_kelly_critical', config_value: '1.00' },
                { config_key: 'event_kelly_limit', config_value: '0.25' },
                { config_key: 'drift_brier_block', config_value: '0.35' },
                { config_key: 'drift_min_settled', config_value: '30' },
                { config_key: 'engine_enabled', config_value: '1' },
              ],
              error: null,
            }),
        };
      }
      if (table === 'risk_events') {
        return { insert: () => Promise.resolve({ error: null }) };
      }
      if (table === 'drift_snapshots') {
        return { insert: () => Promise.resolve({ error: null }) };
      }
      if (table === 'scored_legs') {
        callCount++;
        const rows = callCount === 1 ? exposureRows : [];
        return {
          select: () => ({
            eq: () => ({
              not: () => ({
                gt: () => Promise.resolve({ data: rows, error: null }),
              }),
            }),
          }),
        };
      }
      return {
        select: () => Promise.resolve({ data: [], error: null }),
        insert: () => Promise.resolve({ error: null }),
      };
    },
  } as any;
}

async function main() {
  console.log('=== SIMULATION: Exposure Breach Enforcement ===\n');

  RiskEngine.resetConfigCache();
  const engine = RiskEngine.getInstance();
  const supabase = createHighExposureSupabase();

  const decision = await engine.evaluateForPromotion(supabase, 'sim-pick-001', 0.06, 'event-0');

  console.log('Decision:', JSON.stringify(decision, null, 2));

  const proof = {
    simulation: 'exposure_breach',
    sprint: 'RISK-ENGINE-FOUNDATION-001',
    timestamp: new Date().toISOString(),
    input: {
      total_legs: 15,
      kelly_per_leg: 0.06,
      expected_total_kelly: 0.9,
      high_threshold: 0.6,
    },
    result: {
      allowed: decision.allowed,
      decision: decision.decision,
      blocked_reasons: decision.blocked_reasons,
      total_kelly_exposure: decision.exposure_state?.total_kelly_exposure,
    },
    assertion: {
      expected_blocked: true,
      actual_blocked: !decision.allowed,
      pass: !decision.allowed,
    },
  };

  console.log('\nProof:', JSON.stringify(proof, null, 2));

  if (!proof.assertion.pass) {
    console.error('\nFAILED: Expected BLOCK but got ALLOW');
    process.exit(1);
  }

  console.log('\nPASSED: Exposure breach correctly triggered BLOCK');
}

main().catch(console.error);
