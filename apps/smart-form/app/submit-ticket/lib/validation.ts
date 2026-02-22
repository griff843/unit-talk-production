/**
 * SMARTFORM-V1.1-ENTERPRISE-COMPLIANCE-036 (HARDENED)
 * Validation Module
 *
 * Extracted from PickWizard.tsx for:
 * - Unit testability
 * - Reusability
 * - Single responsibility
 */

import { BetCategory, Direction } from '../types';

export interface PickState {
  sport: string;
  betCategory: BetCategory | '';
  team: string;
  teamId: string;
  player: string;
  playerId: string;
  statType: string;
  line: string;
  direction: Direction | '';
  odds: string;
  gameId: string;
  gameLabel: string;
  source: 'api' | 'manual';
  // SPRINT-108B: Book enforcement (Contract v1.2)
  providerId: string;
  providerName: string;
}

export interface ValidationErrors {
  [key: string]: string;
}

/**
 * Validates Step 1: Sport & Bet Type
 */
export function validateStep1(pick: PickState): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!pick.sport) {
    errors.sport = 'Sport is required';
  }

  if (!pick.betCategory) {
    errors.betCategory = 'Bet type is required';
  }

  return errors;
}

/**
 * Validates Step 2: Participant
 */
export function validateStep2(pick: PickState): ValidationErrors {
  const errors: ValidationErrors = {};

  if (pick.betCategory === 'player_prop') {
    if (!pick.player) {
      errors.player = 'Player is required';
    }
    if (!pick.statType) {
      errors.statType = 'Stat type is required';
    }
  } else if (['spread', 'moneyline', 'team_prop'].includes(pick.betCategory)) {
    if (!pick.team) {
      errors.team = 'Team is required';
    }
  }

  return errors;
}

/**
 * Validates Step 3: Line & Odds
 * SPRINT-108B: Added book validation (Contract v1.2)
 */
export function validateStep3(pick: PickState): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!pick.odds) {
    errors.odds = 'Odds are required';
  } else if (!isValidOdds(pick.odds)) {
    errors.odds = 'Invalid odds format (use American odds like -110 or +150)';
  }

  const needsLine = ['spread', 'total', 'player_prop', 'team_prop'].includes(pick.betCategory);
  if (needsLine && !pick.line) {
    errors.line = 'Line is required';
  } else if (needsLine && !isValidLine(pick.line)) {
    errors.line = 'Invalid line format';
  }

  const needsDirection = ['total', 'player_prop'].includes(pick.betCategory);
  if (needsDirection && !pick.direction) {
    errors.direction = 'Direction (Over/Under) is required';
  }

  // SPRINT-108B: Provider is REQUIRED per Contract v1.2
  // Accepts provider code (TEXT like 'fanduel') - validated server-side against provider_registry
  if (!pick.providerId) {
    errors.providerId = 'Provider is required';
  } else if (!isValidProviderCode(pick.providerId)) {
    errors.providerId = 'Invalid provider selection';
  }

  return errors;
}

/**
 * SPRINT-108B: Validates provider code format
 * Accepts alphanumeric codes with underscores (e.g., 'fanduel', 'espn_bet')
 */
export function isValidProviderCode(code: string): boolean {
  if (!code) return false;
  // Provider codes are lowercase alphanumeric with optional underscores
  const codeRegex = /^[a-z0-9_]+$/i;
  return codeRegex.test(code) && code.length >= 2 && code.length <= 50;
}

/**
 * Validates a specific step
 */
export function validateStep(step: number, pick: PickState): ValidationErrors {
  switch (step) {
    case 1:
      return validateStep1(pick);
    case 2:
      return validateStep2(pick);
    case 3:
      return validateStep3(pick);
    default:
      return {};
  }
}

/**
 * Checks if step can proceed
 * SPRINT-108B: Added book validation for step 3 (Contract v1.2)
 */
export function canProceedToNextStep(step: number, pick: PickState, legsCount: number): boolean {
  switch (step) {
    case 1:
      return !!pick.sport && !!pick.betCategory;
    case 2:
      if (pick.betCategory === 'player_prop') {
        return !!pick.player && !!pick.statType;
      }
      if (['spread', 'moneyline', 'team_prop'].includes(pick.betCategory)) {
        return !!pick.team;
      }
      return true; // Total doesn't need participant
    case 3: {
      const hasOdds = !!pick.odds;
      const needsLine = ['spread', 'total', 'player_prop', 'team_prop'].includes(pick.betCategory);
      const hasLine = !needsLine || !!pick.line;
      const needsDirection = ['total', 'player_prop'].includes(pick.betCategory);
      const hasDirection = !needsDirection || !!pick.direction;
      // SPRINT-108B: Provider is REQUIRED per Contract v1.2
      const hasProvider = !!pick.providerId && isValidProviderCode(pick.providerId);
      return hasOdds && hasLine && hasDirection && hasProvider;
    }
    case 4:
      return legsCount > 0;
    default:
      return false;
  }
}

/**
 * Validates American odds format
 */
export function isValidOdds(odds: string): boolean {
  if (!odds) return false;
  const cleaned = odds.replace(/[^-+\d]/g, '');
  const num = parseInt(cleaned, 10);
  if (isNaN(num)) return false;
  // American odds are typically -110 to -10000 or +100 to +10000
  if (num > 0 && num < 100) return false;
  return true;
}

/**
 * Validates line format
 */
export function isValidLine(line: string): boolean {
  if (!line) return false;
  const num = parseFloat(line);
  return !isNaN(num);
}

/**
 * Parses American odds to numeric value
 */
export function parseOdds(odds: string): number {
  const cleaned = odds.replace(/[^-+\d]/g, '');
  return parseInt(cleaned, 10) || -110;
}

/**
 * Parses line to numeric value
 */
export function parseLine(line: string): number {
  return parseFloat(line) || 0;
}
