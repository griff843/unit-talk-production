export function calculateConfidenceScore(scores: { trend_score: number, matchup_score: number, ev_percent: number }): number {
  // Example: simple weighted average
  const { trend_score, matchup_score, ev_percent } = scores;
  return Math.round(
    0.4 * (trend_score ?? 0) +
    0.3 * (matchup_score ?? 0) +
    0.3 * ((ev_percent ?? 0) / 10)
  );
}
