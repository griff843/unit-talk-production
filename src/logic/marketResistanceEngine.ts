// 📁 src/logic/marketResistanceEngine.ts
import { fetchHistoricalOdds, fetchCurrentOdds } from '@/services/oddsService';
import { FinalPick, MarketReaction } from '@/types/picks';

/**
 * Detects market reaction for a given pick.
 * Compares current line to opening line and infers signal strength.
 */
export async function analyzeMarketResistance(pick: FinalPick): Promise<MarketReaction> {
  const { player_name, stat_type, line, matchup, game_date } = pick;

  const historical = await fetchHistoricalOdds(player_name, stat_type, matchup, game_date);
  const current = await fetchCurrentOdds(player_name, stat_type, matchup);

  if (!historical || !current || historical.line === undefined || current.line === undefined) {
    return { reaction: 'unknown', movement: 0 };
  }

  const movement = current.line - historical.line;
  const movementPct = Math.abs(movement / historical.line) * 100;

  let reaction: MarketReaction['reaction'] = 'neutral';

  if (movementPct >= 3) {
    if ((pick.direction === 'over' && movement > 0) || (pick.direction === 'under' && movement < 0)) {
      reaction = 'sharp_agree';
    } else {
      reaction = 'sharp_fade';
    }
  }

  return {
    reaction,
    movement: parseFloat(movement.toFixed(2)),
    movementPct: parseFloat(movementPct.toFixed(1)),
    updated_line: current.line,
  };
}
