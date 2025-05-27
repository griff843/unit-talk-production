export function calculateTrendScore(prop: any): number {
  // Example: last 10 hit rate
  const hitRate = prop.l10_hit_rate ?? 0; // e.g. 0.7 for 70%
  if (hitRate >= 0.7) return 5;
  if (hitRate >= 0.6) return 4;
  if (hitRate >= 0.5) return 3;
  if (hitRate >= 0.4) return 2;
  return 1;
}
