export function calculateExpectedValue(prop: any): number {
  // Example: basic EV formula with implied probability and odds
  const winProb = prop.projected_win_prob ?? 0.5; // e.g. 0.6 for 60%
  const odds = prop.odds ?? -110;
  const payout = odds > 0 ? odds / 100 : 100 / Math.abs(odds);

  // EV = (winProb * payout) - (1 - winProb)
  const ev = (winProb * payout) - (1 - winProb);
  return Math.round(ev * 100); // e.g. percent, so 5 = +5%
}
