import { createLogger, Logger } from '../../utils/logger';

export type SettlementOutcome = 'win' | 'loss' | 'push' | 'void';

export interface SettlementInput {
  league: string;
  market: string;
  line: number;
  betType: string; // 'over', 'under', 'yes', 'no', etc.
  actualStat: number;
}

export interface SettlementResult {
  actualStat: number;
  outcome: SettlementOutcome;
  reason?: string;
}

export class SettlementEngine {
  private logger: Logger;

  constructor() {
    this.logger = createLogger('SettlementEngine');
  }

  /**
   * Evaluate the outcome of a bet based on actual stats
   */
  evaluate(input: SettlementInput): SettlementResult {
    const { league, market, line, betType, actualStat } = input;

    // Handle void cases
    if (actualStat === null || actualStat === undefined) {
      return {
        actualStat: 0,
        outcome: 'void',
        reason: 'No stat data available'
      };
    }

    // Normalize bet type
    const normalizedBetType = this.normalizeBetType(betType);

    // Evaluate based on bet type
    switch (normalizedBetType) {
      case 'over':
        return this.evaluateOverUnder(actualStat, line, true);
      
      case 'under':
        return this.evaluateOverUnder(actualStat, line, false);
      
      case 'yes':
        return this.evaluateYesNo(actualStat, true, market);
      
      case 'no':
        return this.evaluateYesNo(actualStat, false, market);
      
      case 'alternate_over':
        return this.evaluateAlternateLine(actualStat, line, true);
      
      case 'alternate_under':
        return this.evaluateAlternateLine(actualStat, line, false);
      
      default:
        this.logger.warn('Unknown bet type', { betType, market });
        return {
          actualStat,
          outcome: 'void',
          reason: `Unknown bet type: ${betType}`
        };
    }
  }

  private normalizeBetType(betType: string): string {
    const normalized = betType.toLowerCase().trim();
    
    // Map common variations
    const mappings: Record<string, string> = {
      'o': 'over',
      'u': 'under',
      'ov': 'over',
      'un': 'under',
      'more': 'over',
      'less': 'under',
      'higher': 'over',
      'lower': 'under',
      'y': 'yes',
      'n': 'no',
      'alt_over': 'alternate_over',
      'alt_under': 'alternate_under'
    };

    return mappings[normalized] || normalized;
  }

  private evaluateOverUnder(
    actualStat: number,
    line: number,
    isOver: boolean
  ): SettlementResult {
    // Handle push (exact match)
    if (actualStat === line) {
      return {
        actualStat,
        outcome: 'push',
        reason: `Actual stat (${actualStat}) equals line (${line})`
      };
    }

    // Evaluate over/under
    const actualIsOver = actualStat > line;
    const outcome = actualIsOver === isOver ? 'win' : 'loss';

    return {
      actualStat,
      outcome,
      reason: `Actual: ${actualStat}, Line: ${line}, Bet: ${isOver ? 'over' : 'under'}`
    };
  }

  private evaluateYesNo(
    actualStat: number,
    isYes: boolean,
    market: string
  ): SettlementResult {
    // For yes/no markets (like "Anytime TD Scorer")
    // Typically: 1 = yes (scored), 0 = no (didn't score)
    
    // Special handling for specific markets
    if (market.toLowerCase().includes('anytime') || 
        market.toLowerCase().includes('scorer')) {
      const didOccur = actualStat > 0;
      const outcome = didOccur === isYes ? 'win' : 'loss';
      
      return {
        actualStat,
        outcome,
        reason: `Event ${didOccur ? 'occurred' : 'did not occur'}, Bet: ${isYes ? 'yes' : 'no'}`
      };
    }

    // For other yes/no markets, treat as binary
    const didOccur = actualStat >= 1;
    const outcome = didOccur === isYes ? 'win' : 'loss';

    return {
      actualStat,
      outcome,
      reason: `Actual: ${actualStat}, Bet: ${isYes ? 'yes' : 'no'}`
    };
  }

  private evaluateAlternateLine(
    actualStat: number,
    line: number,
    isOver: boolean
  ): SettlementResult {
    // Alternate lines typically don't push - they're win or loss only
    const actualIsOver = actualStat > line;
    const outcome = actualIsOver === isOver ? 'win' : 'loss';

    return {
      actualStat,
      outcome,
      reason: `Alternate line - Actual: ${actualStat}, Line: ${line}, Bet: ${isOver ? 'over' : 'under'}`
    };
  }

  /**
   * Evaluate parlay outcome based on individual leg outcomes
   */
  evaluateParlay(legOutcomes: SettlementOutcome[]): SettlementOutcome {
    // If any leg is void, the parlay is typically reduced
    // (but we'll treat as void for simplicity)
    if (legOutcomes.includes('void')) {
      return 'void';
    }

    // If any leg loses, the parlay loses
    if (legOutcomes.includes('loss')) {
      return 'loss';
    }

    // If all legs push, the parlay pushes
    if (legOutcomes.every(outcome => outcome === 'push')) {
      return 'push';
    }

    // If some legs push and others win, the parlay is reduced
    // For simplicity, we'll treat this as a win with reduced odds
    // (actual implementation would need to recalculate odds)
    if (legOutcomes.includes('push') && legOutcomes.includes('win')) {
      return 'win'; // Note: odds would be adjusted in real implementation
    }

    // If all legs win, the parlay wins
    if (legOutcomes.every(outcome => outcome === 'win')) {
      return 'win';
    }

    // Fallback (shouldn't happen)
    return 'void';
  }

  /**
   * Validate that a settlement is reasonable
   */
  validateSettlement(
    league: string,
    market: string,
    actualStat: number
  ): boolean {
    // Sport-specific validation
    const maxValues: Record<string, Record<string, number>> = {
      MLB: {
        total_bases: 20,
        hits: 10,
        home_runs: 5,
        rbis: 15,
        strikeouts: 25
      },
      NFL: {
        passing_yards: 600,
        rushing_yards: 350,
        receiving_yards: 350,
        touchdowns: 8
      },
      NBA: {
        points: 70,
        rebounds: 35,
        assists: 25,
        '3_pointers_made': 15
      }
    };

    const leagueMax = maxValues[league.toUpperCase()];
    if (!leagueMax) {
      // No validation rules for this league
      return true;
    }

    const marketKey = market.toLowerCase().replace(/[\s-]/g, '_');
    const maxValue = leagueMax[marketKey];
    
    if (maxValue && actualStat > maxValue) {
      this.logger.warn('Suspicious stat value detected', {
        league,
        market,
        actualStat,
        maxExpected: maxValue
      });
      // Still return true but log the warning
      return true;
    }

    return true;
  }
}