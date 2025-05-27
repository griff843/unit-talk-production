export function calculateMatchupScore(prop: any): number {
  // Example: DVP rank or defense vs position (lower is better)
  const dvpRank = prop.dvp_rank ?? 16;
  if (dvpRank <= 5) return 5;
  if (dvpRank <= 10) return 4;
  if (dvpRank <= 15) return 3;
  if (dvpRank <= 20) return 2;
  return 1;
}
