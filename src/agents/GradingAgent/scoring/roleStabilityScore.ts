export function calculateRoleStabilityScore(prop: any): number {
  // Example: starter = 5, 6th man = 3, bench = 1
  if (prop.starter) return 5;
  if (prop.minutes >= 30) return 4;
  if (prop.minutes >= 22) return 3;
  if (prop.minutes >= 15) return 2;
  return 1;
}
