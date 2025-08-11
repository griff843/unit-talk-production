export const nbaCoreStats = ['points', 'rebounds', 'assists', '3PM', 'steals', 'blocks'];
export const nbaSynergy: Record<string, string[]> = {
  PG: ['assists', 'points', '3PM', 'steals'],
  SG: ['points', '3PM', 'steals'],
  SF: ['points', 'rebounds', 'steals'],
  PF: ['rebounds', 'blocks', 'points'],
  C: ['rebounds', 'blocks', 'points'],
};
