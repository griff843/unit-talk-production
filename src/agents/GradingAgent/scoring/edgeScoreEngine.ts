import type { RawProp } from '../../../types/rawProps';
import { nbaCoreStats, nbaSynergy } from './rules/nba';
import { mlbCoreStats, mlbSynergy } from './rules/mlb';
import { nhlCoreStats, nhlSynergy } from './rules/nhl';
import { nflCoreStats, nflSynergy } from './rules/nfl';


export function calculateEdgeScore(prop: RawProp): number {
  const league = (prop['league'] || '').toUpperCase();
  let score = 0;
  let coreStats: string[] = [];
  let synergy: Record<string, string[]> = {};

  if (league === 'NBA') {
    coreStats = nbaCoreStats;
    synergy = nbaSynergy;
  } else if (league === 'MLB') {
    coreStats = mlbCoreStats;
    synergy = mlbSynergy;
  } else if (league === 'NHL') {
    coreStats = nhlCoreStats;
    synergy = nhlSynergy;
  } else if (league === 'NFL') {
    coreStats = nflCoreStats;
    synergy = nflSynergy;
  } else {
    // Unknown league, fallback to basic scoring
    coreStats = [];
    synergy = {};
  }

  // 1. Odds sweet-spot (use either 'odds', 'over_odds', or 'under_odds', adjust as needed)
  const odds = typeof prop['odds'] === 'number'
    ? prop['odds']
    : typeof prop['over_odds'] === 'number'
      ? prop['over_odds']
      : typeof prop['under_odds'] === 'number'
        ? prop['under_odds']
        : 0;
  if (odds >= -125 && odds <= 115) score += 1;

  // 2. Core stat type (stat_type, not statType)
  if (coreStats.includes((prop['stat_type'] || '').toLowerCase())) score += 1;

  // 3. DVP or matchup score
  if (typeof prop['dvp_score'] === 'number' && prop['dvp_score'] >= 1) score += 1;

  // 4. Synergy: position to stat
  const pos = prop['position'] || '';
  const stat = (prop['stat_type'] || '').toLowerCase();
  if (synergy[pos]?.some((s) => s.toLowerCase() === stat)) score += 1;

  // 5. No injury/context flag
  if (!prop['context_flag']) score += 1;

  return score;
}