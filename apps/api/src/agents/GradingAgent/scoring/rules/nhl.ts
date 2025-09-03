export const nhlCoreStats = ['goals', 'assists', 'points', 'shots_on_goal', 'blocks', 'saves'];
export const nhlSynergy: Record<string, string[]> = {
  C: ['points', 'goals', 'shots_on_goal'],
  LW: ['points', 'goals', 'shots_on_goal'],
  RW: ['points', 'goals', 'shots_on_goal'],
  D: ['blocks', 'points', 'shots_on_goal'],
  G: ['saves', 'wins'],
};
