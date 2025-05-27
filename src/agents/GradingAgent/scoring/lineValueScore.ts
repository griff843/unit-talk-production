export function calculateLineValueScore(prop: any): number {
  // Example: market vs projection line
  const marketLine = prop.line ?? 0;
  const projLine = prop.projected_line ?? marketLine;
  const diff = projLine - marketLine;
  if (diff >= 2) return 5;
  if (diff >= 1) return 4;
  if (diff >= 0.5) return 3;
  if (diff >= 0.25) return 2;
  return 1;
}
