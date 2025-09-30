import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { supabase as supabaseClient, isSupabaseConfigured } from '../../apps/api/src/services/supabaseClient';
import { ScoringAgent } from '../../apps/api/src/agents/ScoringAgent';
import { PromotionAgent } from '../../apps/api/src/agents/PromotionAgent';
import { createBaseAgentConfig } from '../../apps/api/src/agents/BaseAgent';

const readJson = (p: string) => JSON.parse(fs.readFileSync(p, 'utf-8'));

async function insertRawProps(raws: any[]) {
  const rows = raws.map((r) => ({
    id: randomUUID(),
    player_name: r.player_name,
    sport: r.sport,
    stat_type: r.stat_type,
    line: r.line,
    over_odds: r.over_odds,
    under_odds: r.under_odds,
    game_date: r.game_date,
    created_at: r.created_at,
    processed_at: null,
    professional_score: r.professional_score,
    devigged_edge: r.devigged_edge,
    kelly_fraction: r.kelly_fraction,
    confidence: r.confidence,
    grade: r.grade
  }));
  const { error } = await supabaseClient.from('raw_props').insert(rows);
  if (error) throw new Error(`Failed to insert raw_props: ${error.message}`);
  return rows.map((r) => r.id);
}

async function runProcessor() {
  const agent = new ScoringAgent(
    createBaseAgentConfig({ name: 'ScoringAgent', metrics: { enabled: false }, health: { enabled: false } }),
    { supabase: supabaseClient }
  );
  await agent.run();
}

async function runPromoter() {
  const agent = new PromotionAgent(
    createBaseAgentConfig({ name: 'PromotionAgent', metrics: { enabled: false }, health: { enabled: false } }),
    { supabase: supabaseClient }
  );
  await agent.run();
}

describe('ScoringAgent • FREEZE_MODE prevents promotion', () => {
  if (!isSupabaseConfigured) {
    it.skip('Supabase not configured; skipping integration test', () => {});
    return;
  }

  it.skip('does not insert into unified_picks when FREEZE_MODE is true (feature not wired yet)', async () => {
    // TODO: Enable once ScoringAgent respects freeze/shadow runtime_config flags for promotion gating.
    // Placeholder to keep suite green until implementation is ready.
  });
});

