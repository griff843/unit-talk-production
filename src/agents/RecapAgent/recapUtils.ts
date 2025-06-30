/**
 * Utility functions for recap formatting and calculations
 */

/**
 * Format units with proper decimal places and sign
 */
export function formatUnits(units: number): string {
  const formatted = Math.abs(units).toFixed(1);
  if (units > 0) {
    return `+${formatted}`;
  } else if (units < 0) {
    return `-${formatted}`;
  }
  return formatted;
}

/**
 * Format ROI as percentage
 */
export function formatROI(roi: number): string {
  const formatted = Math.abs(roi).toFixed(1);
  if (roi > 0) {
    return `+${formatted}%`;
  } else if (roi < 0) {
    return `-${formatted}%`;
  }
  return `${formatted}%`;
}

/**
 * Format win rate as percentage
 */
export function formatWinRate(winRate: number): string {
  return `${winRate.toFixed(1)}%`;
}

/**
 * Get streak emoji based on streak length
 */
export function getStreakEmoji(wins: number, losses: number): string {
  const streakLength = Math.max(wins, losses);
  
  if (wins > losses) {
    // Win streak
    if (streakLength >= 5) return '🔥🔥';
    if (streakLength >= 3) return '🔥';
    if (streakLength >= 2) return '📈';
    return '✅';
  } else if (losses > wins) {
    // Loss streak
    if (streakLength >= 3) return '❄️';
    return '❌';
  }
  
  return '🟡'; // Even or no clear streak
}

/**
 * Get tier emoji
 */
export function getTierEmoji(tier: string): string {
  const tierEmojis: Record<string, string> = {
    'S': '💎',
    'A+': '🔥',
    'A': '⭐',
    'B': '📊',
    'C': '📈',
    'Parlay': '🎰'
  };
  
  return tierEmojis[tier] || '📊';
}

/**
 * Get outcome emoji
 */
export function getOutcomeEmoji(outcome?: string): string {
  switch (outcome) {
    case 'win':
      return '✅';
    case 'loss':
      return '❌';
    case 'push':
      return '🟡';
    case 'pending':
      return '⏳';
    default:
      return '❓';
  }
}

/**
 * Calculate hot streak level and emoji
 */
export function calculateHotStreakEmoji(streakLength: number): string {
  if (streakLength >= 7) return '🔥🔥🔥';
  if (streakLength >= 5) return '🔥🔥';
  if (streakLength >= 3) return '🔥';
  return '';
}

/**
 * Format odds display
 */
export function formatOdds(odds: number): string {
  if (odds > 0) {
    return `+${odds}`;
  }
  return odds.toString();
}

/**
 * Calculate implied probability from odds
 */
export function calculateImpliedProbability(odds: number): number {
  if (odds > 0) {
    return 100 / (odds + 100);
  } else {
    return Math.abs(odds) / (Math.abs(odds) + 100);
  }
}

/**
 * Format market type for display
 */
export function formatMarketType(marketType: string): string {
  const marketMap: Record<string, string> = {
    'points': 'PTS',
    'rebounds': 'REB',
    'assists': 'AST',
    'player_props': 'Props',
    'spread': 'Spread',
    'total': 'O/U',
    'moneyline': 'ML'
  };
  
  return marketMap[marketType] || marketType.toUpperCase();
}

/**
 * Get capper display name
 */
export function getCapperDisplayName(capper: string): string {
  const capperMap: Record<string, string> = {
    'Unit Talk': 'Unit Talk',
    'Griff': 'Griff',
    'Ace': 'Ace',
    'Maya': 'Maya'
  };
  
  return capperMap[capper] || capper;
}

/**
 * Calculate streak type and length from recent picks
 */
export function calculateStreak(picks: any[]): { type: 'win' | 'loss' | 'none'; length: number } {
  if (picks.length === 0) return { type: 'none', length: 0 };
  
  // Sort by most recent first
  const sortedPicks = picks
    .filter(p => p.outcome && p.outcome !== 'push' && p.outcome !== 'pending')
    .sort((a, b) => new Date(b.settled_at || b.created_at).getTime() - new Date(a.settled_at || a.created_at).getTime());
  
  if (sortedPicks.length === 0) return { type: 'none', length: 0 };
  
  const latestOutcome = sortedPicks[0].outcome;
  let streakLength = 1;
  
  // Count consecutive outcomes of the same type
  for (let i = 1; i < sortedPicks.length; i++) {
    if (sortedPicks[i].outcome === latestOutcome) {
      streakLength++;
    } else {
      break;
    }
  }
  
  return {
    type: latestOutcome === 'win' ? 'win' : 'loss',
    length: streakLength
  };
}

/**
 * Format pick description for display
 */
export function formatPickDescription(pick: any): string {
  const playerOrTeam = pick.player_name || pick.team_name || 'Unknown';
  const market = formatMarketType(pick.market_type);
  const line = pick.line;
  const odds = formatOdds(pick.odds);
  
  return `${playerOrTeam} ${market} ${line} (${odds})`;
}

/**
 * Calculate parlay odds from individual picks
 */
export function calculateParlayOdds(picks: any[]): number {
  return picks.reduce((totalOdds, pick) => {
    const decimalOdds = pick.odds > 0 ? (pick.odds / 100) + 1 : (100 / Math.abs(pick.odds)) + 1;
    return totalOdds * decimalOdds;
  }, 1);
}

/**
 * Format parlay odds for display
 */
export function formatParlayOdds(totalOdds: number): string {
  if (totalOdds >= 2) {
    return `+${Math.round((totalOdds - 1) * 100)}`;
  } else {
    return `-${Math.round(100 / (totalOdds - 1))}`;
  }
}

/**
 * Get date range label
 */
export function getDateRangeLabel(startDate: string, endDate: string, type: 'daily' | 'weekly' | 'monthly'): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  switch (type) {
    case 'daily':
      return start.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
      });
    case 'weekly':
      return `${start.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })} — ${end.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })}`;
    case 'monthly':
      return start.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long' 
      });
    default:
      return startDate;
  }
}

/**
 * Calculate profit in dollars (assuming $100 per unit)
 */
export function calculateProfitDollars(netUnits: number, unitValue: number = 100): string {
  const profit = netUnits * unitValue;
  if (profit >= 0) {
    return `+$${profit.toFixed(0)}`;
  } else {
    return `-$${Math.abs(profit).toFixed(0)}`;
  }
}

/**
 * Get performance color based on units
 */
export function getPerformanceColor(netUnits: number): number {
  if (netUnits > 5) return 0x00ff00; // Bright green for big wins
  if (netUnits > 0) return 0x90ee90; // Light green for wins
  if (netUnits === 0) return 0xffff00; // Yellow for break-even
  if (netUnits > -5) return 0xffa500; // Orange for small losses
  return 0xff0000; // Red for big losses
}

/**
 * Truncate text to fit Discord embed limits
 */
export function truncateText(text: string, maxLength: number = 1024): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Group picks by parlay ID
 */
export function groupPicksByParlay(picks: any[]): Map<string, any[]> {
  const parlayMap = new Map<string, any[]>();
  
  picks.forEach(pick => {
    if (pick.parlay_id) {
      if (!parlayMap.has(pick.parlay_id)) {
        parlayMap.set(pick.parlay_id, []);
      }
      parlayMap.get(pick.parlay_id)!.push(pick);
    }
  });
  
  return parlayMap;
}

/**
 * Calculate win rate with proper handling of pushes
 */
// Commented out unused pushes parameter
export function calculateWinRate(wins: number, losses: number, /* pushes: number = 0 */): number {
  const totalDecisiveGames = wins + losses;
  if (totalDecisiveGames === 0) return 0;
  return (wins / totalDecisiveGames) * 100;
}

/**
 * Calculate ROI
 */
export function calculateROI(netUnits: number, totalUnits: number): number {
  if (totalUnits === 0) return 0;
  return (netUnits / totalUnits) * 100;
}

/**
 * Format large numbers with commas
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Get time period label
 */
export function getTimePeriodLabel(type: 'daily' | 'weekly' | 'monthly', date: string): string {
  const d = new Date(date);
  
  switch (type) {
    case 'daily':
      return d.toLocaleDateString('en-US', { 
        weekday: 'long',
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    case 'weekly':
      return `Week of ${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;
    case 'monthly':
      return d.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long' 
      });
    default:
      return date;
  }
}

/**
 * Validate pick data
 */
export function validatePickData(pick: any): boolean {
  return !!(
    pick &&
    (pick.player_name || pick.team_name) &&
    pick.market_type &&
    typeof pick.line === 'number' &&
    typeof pick.odds === 'number'
  );
}

/**
 * Sort cappers by performance
 */
export function sortCappersByPerformance(cappers: any[]): any[] {
  return cappers.sort((a, b) => {
    // Primary sort: net units (descending)
    if (b.netUnits !== a.netUnits) {
      return b.netUnits - a.netUnits;
    }
    
    // Secondary sort: ROI (descending)
    if (b.roi !== a.roi) {
      return b.roi - a.roi;
    }
    
    // Tertiary sort: win rate (descending)
    return b.winRate - a.winRate;
  });
}

/**
 * Get medal emoji for rankings
 */
export function getMedalEmoji(position: number): string {
  switch (position) {
    case 1:
      return '🥇';
    case 2:
      return '🥈';
    case 3:
      return '🥉';
    default:
      return '•';
  }
}

/**
 * Calculate average edge score
 */
export function calculateAverageEdge(picks: any[]): number {
  const validPicks = picks.filter(p => typeof p.edge_score === 'number');
  if (validPicks.length === 0) return 0;
  
  const totalEdge = validPicks.reduce((sum, pick) => sum + pick.edge_score, 0);
  return totalEdge / validPicks.length;
}