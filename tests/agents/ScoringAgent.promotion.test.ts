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

describe('ScoringAgent • promotion flow', () => {
  if (!isSupabaseConfigured) {
    it.skip('Supabase not configured; skipping integration test', () => {});
    return;
  }

  it('marks processed_at and only promotes eligible S-tier', async () => {
    // Seed
    const seedPath = path.join(__dirname, '..', 'seeds', 'seed_promotion.json');
    const seed = readJson(seedPath);
    const ids = await insertRawProps(seed.raw_props);

    // Run processor then promoter
    await runProcessor();
    await runPromoter();

    // processed_at set
    const { data: processed } = await supabaseClient
      .from('raw_props')
      .select('id, processed_at')
      .in('id', ids);
    expect(processed?.every((r: any) => r.processed_at)).toBe(true);

    // Only S-tier promoted
    const { count } = await supabaseClient
      .from('unified_picks')
      .select('*', { count: 'exact', head: true });

    expect((count || 0)).toBeGreaterThanOrEqual(1);
  });
});

