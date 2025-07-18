import { SyndicateGradingEngine } from '../agents/GradingAgent/scoring/gradingEngine';
import { getHistoricalPicks } from '../db/picks';

async function runBacktest(start: string, end: string) {
  const picks = await getHistoricalPicks(start, end); // Each pick includes full feature set + result

  // Initialize grading engine
  const gradingEngine = new SyndicateGradingEngine();

  let resultsByTier: Record<string, { total: number; wins: number; roi: number }> = {};
  for (const pick of picks) {
    const scored = await gradingEngine.gradeProp(pick.features);
    // Compare predicted (scored.tier) to actual result (pick.result)

    if (!resultsByTier[scored.tier]) {
      resultsByTier[scored.tier] = { total: 0, wins: 0, roi: 0 };
    }

    const tierResult = resultsByTier[scored.tier]!;
    tierResult.total++;
    if (pick.result === 'win') {
      tierResult.wins++;
    }
  }

  return resultsByTier;
}

export { runBacktest };
