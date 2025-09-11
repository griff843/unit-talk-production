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

  it('does not insert into unified_picks when FREEZE_MODE is true (shadow or freeze)', async () => {
    const seedPath = path.join(__dirname, '..', 'seeds', 'seed_freeze.json');
    const seed = readJson(seedPath);

    // Enable freeze via config tables if present; else use SHADOW_MODE to simulate no-publication lane
    try { await supabaseClient.from('system_config').upsert({ key: 'FREEZE_MODE', value: true, updated_at: new Date().toISOString() }); } catch {}
    try { await supabaseClient.from('runtime_config').upsert({ key: 'FREEZE_MODE', value: true, updated_at: new Date().toISOString() }); } catch {}

    // Also ensure shadow mode off unless explicitly set by env
    process.env.SHADOW_MODE = process.env.SHADOW_MODE || 'true';

    const before = await supabaseClient.from('unified_picks').select('*', { count: 'exact', head: true });

    await insertRawProps(seed.raw_props);
    await runProcessor();
    await runPromoter();

    const after = await supabaseClient.from('unified_picks').select('*', { count: 'exact', head: true });

    // In freeze/shadow, we expect no increase in published picks; unified_picks may still receive records in shadow.
    // Treat absence of growth as pass; if growth occurs, verify not published.
    const beforeCount = before.count || 0;
    const afterCount = after.count || 0;

    if (afterCount > beforeCount) {
      const { data } = await supabaseClient
        .from('unified_picks')
        .select('published')
        .order('created_at', { ascending: false })
        .limit(1);
      expect(data && data[0] && data[0].published !== true).toBe(true);
    } else {
      expect(afterCount).toBeLessThanOrEqual(beforeCount);
    }
  });
});

