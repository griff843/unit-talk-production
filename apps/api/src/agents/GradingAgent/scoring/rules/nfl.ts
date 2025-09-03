export const nflCoreStats = [
  'passing_yards', 'passing_tds', 'rushing_yards', 'rushing_tds',
  'receiving_yards', 'receiving_tds', 'receptions', 'completions', 'interceptions'
];
export const nflSynergy: Record<string, string[]> = {
  QB: ['passing_yards', 'passing_tds', 'completions', 'interceptions'],
  RB: ['rushing_yards', 'rushing_tds', 'receptions'],
  WR: ['receiving_yards', 'receiving_tds', 'receptions'],
  TE: ['receiving_yards', 'receiving_tds', 'receptions'],
  DEF: ['sacks', 'interceptions', 'defensive_tds'],
};
