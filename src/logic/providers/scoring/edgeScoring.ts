export interface PropObject {
  player_name: string;
  market_type: string;
  line: number;
  source: string;
  sport: string;
  [key: string]: any;
}

export function scorePropEdge(prop: PropObject): number {
  let score = 15;

  switch (prop.market_type) {
    case 'Points':
      score += 2;
      break;
    case 'Home Runs':
    case 'HR':
      score += 3;
      break;
    case 'Goals':
      score += 3;
      break;
    case 'TD':
    case 'Touchdowns':
      score += 3;
      break;
    default:
      score += 1;
  }

  if (prop.source === 'SGO') score += 1;
  if (prop.line > 50) score -= 1;

  return Math.min(25, Math.max(0, score));
}
