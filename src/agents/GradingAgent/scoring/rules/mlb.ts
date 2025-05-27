export const mlbCoreStats = ['hits', 'home_runs', 'rbi', 'runs', 'total_bases'];
export const mlbSynergy: Record<string, string[]> = {
  SP: ['strikeouts', 'outs', 'wins'],
  RP: ['strikeouts', 'outs', 'holds'],
  "1B": ['hits', 'total_bases', 'rbi'],
  "2B": ['hits', 'total_bases', 'runs'],
  "3B": ['hits', 'total_bases', 'runs'],
  SS: ['hits', 'total_bases', 'runs'],
  OF: ['hits', 'total_bases', 'runs', 'home_runs'],
  C: ['hits', 'rbi'],
  DH: ['hits', 'home_runs'],
};
