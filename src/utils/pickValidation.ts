import { PickLeg } from '../db/types/capper';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface PickValidationOptions {
  maxUnitsPerPick: number;
  minUnitsPerPick: number;
  maxLegsPerParlay: number;
  minOdds: number;
  maxOdds: number;
  allowedSports: string[];
  submissionCutoffHour: number; // 9 AM cutoff
}

export const DEFAULT_VALIDATION_OPTIONS: PickValidationOptions = {
  maxUnitsPerPick: 10,
  minUnitsPerPick: 0.5,
  maxLegsPerParlay: 10,
  minOdds: -1000,
  maxOdds: 1000,
  allowedSports: ['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF', 'NCAAB', 'Soccer', 'Tennis', 'Golf'],
  submissionCutoffHour: 9
};

/**
 * Validates a single pick leg
 */
export function validatePickLeg(leg: PickLeg, options: PickValidationOptions = DEFAULT_VALIDATION_OPTIONS): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate required fields
  if (!leg.sport || leg.sport.trim() === '') {
    errors.push('Sport is required');
  }

  if (!leg.league || leg.league.trim() === '') {
    errors.push('League is required');
  }

  if (!leg.market_type || leg.market_type.trim() === '') {
    errors.push('Market type is required');
  }

  if (!leg.selection || leg.selection.trim() === '') {
    errors.push('Selection is required');
  }

  // Validate numeric fields
  if (typeof leg.line !== 'number' || isNaN(leg.line)) {
    errors.push('Line must be a valid number');
  }

  if (typeof leg.odds !== 'number' || isNaN(leg.odds)) {
    errors.push('Odds must be a valid number');
  } else {
    if (leg.odds < options.minOdds || leg.odds > options.maxOdds) {
      errors.push(`Odds must be between ${options.minOdds} and ${options.maxOdds}`);
    }
  }

  if (typeof leg.units !== 'number' || isNaN(leg.units)) {
    errors.push('Units must be a valid number');
  } else {
    if (leg.units < options.minUnitsPerPick || leg.units > options.maxUnitsPerPick) {
      errors.push(`Units must be between ${options.minUnitsPerPick} and ${options.maxUnitsPerPick}`);
    }
  }

  // Validate sport is allowed
  if (leg.sport && !options.allowedSports.includes(leg.sport)) {
    errors.push(`Sport "${leg.sport}" is not allowed. Allowed sports: ${options.allowedSports.join(', ')}`);
  }

  // Validate market type
  const validMarketTypes = ['spread', 'total', 'moneyline', 'player_prop'];
  if (leg.market_type && !validMarketTypes.includes(leg.market_type)) {
    errors.push(`Invalid market type "${leg.market_type}". Valid types: ${validMarketTypes.join(', ')}`);
  }

  // Validate player prop specific fields
  if (leg.market_type === 'player_prop') {
    if (!leg.player_name || leg.player_name.trim() === '') {
      errors.push('Player name is required for player props');
    }
    if (!leg.stat_type || leg.stat_type.trim() === '') {
      errors.push('Stat type is required for player props');
    }
  }

  // Validate team fields
  if (!leg.team_home || leg.team_home.trim() === '') {
    errors.push('Home team is required');
  }
  if (!leg.team_away || leg.team_away.trim() === '') {
    errors.push('Away team is required');
  }

  // Warnings for suspicious values
  if (leg.odds > 500) {
    warnings.push('Very high odds - please double-check');
  }
  if (leg.odds < -500) {
    warnings.push('Very low odds - consider the risk/reward');
  }
  if (leg.units > 5) {
    warnings.push('High unit bet - ensure you\'re confident');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates multiple pick legs for parlay
 */
export function validateParlay(legs: PickLeg[], options: PickValidationOptions = DEFAULT_VALIDATION_OPTIONS): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check parlay size
  if (legs.length > options.maxLegsPerParlay) {
    errors.push(`Parlay cannot have more than ${options.maxLegsPerParlay} legs`);
  }

  if (legs.length < 2) {
    errors.push('Parlay must have at least 2 legs');
  }

  // Validate each leg
  legs.forEach((leg, index) => {
    const legValidation = validatePickLeg(leg, options);
    legValidation.errors.forEach(error => {
      errors.push(`Leg ${index + 1}: ${error}`);
    });
    legValidation.warnings.forEach(warning => {
      warnings.push(`Leg ${index + 1}: ${warning}`);
    });
  });

  // Check for duplicate legs (same game, same market)
  const legSignatures = legs.map(leg => `${leg.game_id}-${leg.market_type}-${leg.stat_type || ''}`);
  const duplicates = legSignatures.filter((sig, index) => legSignatures.indexOf(sig) !== index);
  if (duplicates.length > 0) {
    errors.push('Parlay contains duplicate legs (same game and market)');
  }

  // Check for conflicting legs (same game, opposite sides)
  const gameMarkets = new Map<string, PickLeg[]>();
  legs.forEach(leg => {
    const key = `${leg.game_id}-${leg.market_type}`;
    if (!gameMarkets.has(key)) {
      gameMarkets.set(key, []);
    }
    gameMarkets.get(key)!.push(leg);
  });

  gameMarkets.forEach((gameLegs, key) => {
    // Use key to prevent unused warning
    void key;
    if (gameLegs.length > 1) {
      // Check for conflicting selections
      const selections = gameLegs.map(leg => leg.selection.toLowerCase());
      if (selections.includes('over') && selections.includes('under')) {
        errors.push('Parlay contains conflicting legs (over/under on same total)');
      }
      if (selections.includes('home') && selections.includes('away')) {
        errors.push('Parlay contains conflicting legs (home/away on same game)');
      }
    }
  });

  // Calculate total units and odds
  const totalUnits = legs.reduce((sum, leg) => sum + leg.units, 0);
  if (totalUnits > options.maxUnitsPerPick) {
    errors.push(`Total parlay units (${totalUnits}) cannot exceed ${options.maxUnitsPerPick}`);
  }

  // Warning for high-risk parlays
  if (legs.length > 5) {
    warnings.push('Large parlays have very low win probability');
  }

  const avgOdds = legs.reduce((sum, leg) => sum + leg.odds, 0) / legs.length;
  if (avgOdds > 200) {
    warnings.push('High average odds - this is a very risky parlay');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates submission timing
 */
export function validateSubmissionTiming(eventDate: string, options: PickValidationOptions = DEFAULT_VALIDATION_OPTIONS): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const cutoffTime = new Date(today);
  cutoffTime.setHours(options.submissionCutoffHour, 0, 0, 0);

  const eventDateObj = new Date(eventDate);
  const eventDateOnly = new Date(eventDateObj.getFullYear(), eventDateObj.getMonth(), eventDateObj.getDate());

  // Check if submission is after cutoff for today's games
  if (eventDateOnly.getTime() === today.getTime() && now > cutoffTime) {
    errors.push(`Submissions for today's games closed at ${options.submissionCutoffHour}:00 AM. Please submit picks for tomorrow's slate.`);
  }

  // Check if event date is in the past
  if (eventDateOnly < today) {
    errors.push('Cannot submit picks for past dates');
  }

  // Check if event date is too far in the future (more than 7 days)
  const maxFutureDate = new Date(today);
  maxFutureDate.setDate(maxFutureDate.getDate() + 7);
  if (eventDateOnly > maxFutureDate) {
    errors.push('Cannot submit picks more than 7 days in advance');
  }

  // Warning if submitting very close to cutoff
  const timeUntilCutoff = cutoffTime.getTime() - now.getTime();
  if (eventDateOnly.getTime() === today.getTime() && timeUntilCutoff < 30 * 60 * 1000) { // 30 minutes
    warnings.push('Submitting close to cutoff time - ensure you have enough time to review');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Formats odds for display
 */
export function formatOdds(odds: number): string {
  if (odds > 0) {
    return `+${odds}`;
  }
  return odds.toString();
}

/**
 * Calculates parlay odds from individual leg odds
 */
export function calculateParlayOdds(legs: PickLeg[]): number {
  // Convert American odds to decimal, multiply, then convert back
  const decimalOdds = legs.map(leg => {
    if (leg.odds > 0) {
      return (leg.odds / 100) + 1;
    } else {
      return (100 / Math.abs(leg.odds)) + 1;
    }
  });

  const combinedDecimal = decimalOdds.reduce((product, odds) => product * odds, 1);
  
  // Convert back to American odds
  if (combinedDecimal >= 2) {
    return Math.round((combinedDecimal - 1) * 100);
  } else {
    return Math.round(-100 / (combinedDecimal - 1));
  }
}

/**
 * Calculates potential payout for a bet
 */
export function calculatePayout(odds: number, units: number): number {
  if (odds > 0) {
    return units * (odds / 100);
  } else {
    return units * (100 / Math.abs(odds));
  }
}