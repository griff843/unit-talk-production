import fs from 'fs';
import path from 'path';

// Minimal, CI-safe audit that inspects code to verify scoring "shape" without DB
// - Counts Enhanced45FactorEngine factor weights (should be 45)
// - Counts unified-edge-score breakdown keys for a synthetic prop per-league
// - Emits out/db/verify-shape.json

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

async function main() {
  const outDir = path.resolve(process.cwd(), 'out', 'db');
  ensureDir(outDir);

  // Lazy import to avoid ts-node ESM issues
  const enhanced = await import(path.resolve(process.cwd(), 'apps/api/src/agents/ScoringAgent/scoring/Enhanced45FactorEngine'));
  const unified = await import(path.resolve(process.cwd(), 'apps/api/src/logic/scoring/unified-edge-score'));
  const nba = await import(path.resolve(process.cwd(), 'apps/api/src/logic/scoring/rules/nba'));
  const nfl = await import(path.resolve(process.cwd(), 'apps/api/src/logic/scoring/rules/nfl'));
  const mlb = await import(path.resolve(process.cwd(), 'apps/api/src/logic/scoring/rules/mlb'));
  const nhl = await import(path.resolve(process.cwd(), 'apps/api/src/logic/scoring/rules/nhl'));

  // Count 45-factor registry
  const defaultWeights: Record<string, number> = new enhanced.Enhanced45FactorEngine({} as any, {} as any)[
    // @ts-ignore access private via helper: getFlattenedWeights through default config merge
    'getFlattenedWeights'
  ](
    // Build a default config by calling private mergeConfig with empty override via bracket access
    new enhanced.Enhanced45FactorEngine({} as any, {} as any)['mergeConfig']?.call(
      new enhanced.Enhanced45FactorEngine({} as any, {} as any),
      {}
    )
  );
  const factorKeys = Object.keys(defaultWeights);

  // Build a synthetic prop that lights up as many breakdown entries as possible
  const sampleProp: any = {
    league: 'NBA', market_type: 'points', odds: -115,
    trend_score: 0.9, matchup_score: 0.8, role_score: 0.7, line_value_score: 0.8,
    source: 'premium', is_rocket: true, is_ladder: true,
    tags: ['injury', 'rest']
  };

  const leagues = [
    { l: 'NBA', core: nba.nbaCoreStats, syn: nba.nbaSynergy },
    { l: 'NFL', core: (await nfl).nflCoreStats, syn: (await nfl).nflSynergy },
    { l: 'MLB', core: (await mlb).mlbCoreStats, syn: (await mlb).mlbSynergy },
    { l: 'NHL', core: (await nhl).nhlCoreStats, syn: (await nhl).nhlSynergy },
  ].filter(x => typeof x.core === 'function' && typeof x.syn === 'function');

  const breakdownKeySet = new Set<string>();
  for (const lg of leagues) {
    const p = { ...sampleProp, league: lg.l };
    const res = unified.unifiedEdgeScore(p, unified.DEFAULT_EDGE_CONFIG, { useLeagueRules: true });
    Object.keys(res.breakdown).forEach(k => breakdownKeySet.add(k));
  }

  const registryCount = factorKeys.length; // expected 45
  const breakdownCount = breakdownKeySet.size;
  const totalSignals = registryCount + breakdownCount;

  const payload = {
    ok: totalSignals >= 60, // soft gate from code-only view; CI gates can require higher when DB features present
    registryCount,
    breakdownCount,
    totalSignals,
    factorKeys: factorKeys.slice(0, 10), // preview
    sampledAt: new Date().toISOString()
  };

  const outPath = path.join(outDir, 'verify-shape.json');
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${outPath}`);
}

main().catch(err => {
  console.error('verify-shape failed', err);
  process.exitCode = 1;
});

