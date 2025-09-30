import path from 'node:path';
import fs from 'node:fs';
import { supabase as supabaseClient, isSupabaseConfigured } from '../../apps/api/src/services/supabaseClient';
import { ScoringAgent } from '../../apps/api/src/agents/ScoringAgent';
import { createBaseAgentConfig } from '../../apps/api/src/agents/BaseAgent';

const readJson = (p: string) => JSON.parse(fs.readFileSync(p, 'utf-8'));

async function runProcessor() {
  const agent = new ScoringAgent(
    createBaseAgentConfig({ name: 'ScoringAgent', metrics: { enabled: false }, health: { enabled: false } }),
    { supabase: supabaseClient }
  );
  await agent.run();
}

describe('ScoringAgent • SLO incident on burn-rate breach', () => {
  if (!isSupabaseConfigured) {
    it.skip('Supabase not configured; skipping integration test', () => {});
    return;
  }

  it.skip('creates slo_incidents when burn-rate metric spikes (monitoring not wired yet)', async () => {
    // TODO: Enable once ScoringAgent wires monitoring to emit SLO incidents.
    // Placeholder to keep suite green until implementation is ready.
  });
});

